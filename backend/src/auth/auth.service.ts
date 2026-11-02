import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface TokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  tokenType: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto) {
    this.logger.log(
      `[register] Validated request received: ${JSON.stringify({
        username: this.maskUsername(input.username),
        password: '[REDACTED]',
        name: '[REDACTED]',
        phoneNumber: '[REDACTED]',
      })}`,
    );

    const username = input.username.trim().toLowerCase();
    this.logger.log(
      `[register] Checking whether normalized username ${this.maskUsername(username)} already exists.`,
    );
    const existingUser = await this.users.exists({ username });
    if (existingUser) {
      this.logger.warn(
        `[register] Registration rejected because normalized username ${this.maskUsername(username)} is already in use.`,
      );
      throw new ConflictException('That username is already taken.');
    }

    this.logger.log('[register] Hashing password before persistence; plaintext password is not logged.');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const userToCreate = {
      username,
      passwordHash,
      name: input.name.trim(),
      phoneNumber: input.phoneNumber.trim(),
      role: 'user' as const,
    };
    this.logger.log(
      `[register] Creating MongoDB users document: ${JSON.stringify({
        username: this.maskUsername(userToCreate.username),
        passwordHash: '[REDACTED]',
        name: '[REDACTED]',
        phoneNumber: '[REDACTED]',
        role: userToCreate.role,
      })}`,
    );

    try {
      const createdUser = await this.users.create(userToCreate);
      this.logger.log(
        `[register] MongoDB insert succeeded: collection=users, userId=${createdUser.id}, role=${createdUser.role}.`,
      );
      return { message: 'Account created. You can now sign in.' };
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        this.logger.warn(
          `[register] MongoDB rejected duplicate username ${this.maskUsername(username)}.`,
        );
        throw new ConflictException('That username is already taken.');
      }
      this.logger.error(
        `[register] MongoDB insert failed (${this.getErrorName(error)}); request will fail.`,
      );
      throw error;
    }
  }

  async login(input: LoginDto) {
    this.logger.log(
      `[login] Validated request received: ${JSON.stringify({
        username: this.maskUsername(input.username),
        password: '[REDACTED]',
      })}`,
    );
    const username = input.username.trim().toLowerCase();
    this.logger.log(`[login] Looking up normalized username ${this.maskUsername(username)} in MongoDB.`);
    const user = await this.users
      .findOne({ username })
      .select('+refreshTokenHash');

    if (!user) {
      this.logger.warn('[login] No matching account found; authentication rejected.');
      throw new UnauthorizedException('Invalid username or password.');
    }

    this.logger.log(
      `[login] Account found (userId=${user.id}); comparing submitted password with stored password hash.`,
    );
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      this.logger.warn(`[login] Password verification failed for userId=${user.id}.`);
      throw new UnauthorizedException('Invalid username or password.');
    }

    this.logger.log(`[login] Password verified for userId=${user.id}; issuing token pair.`);
    return this.issueTokenPair(user);
  }

  async refresh(refreshToken: string) {
    this.logger.log('[refresh] Refresh request received; token value is not logged.');
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      this.logger.warn('[refresh] JWT signature verification failed or refresh token expired.');
      throw new UnauthorizedException('Refresh token is invalid or expired. Please sign in again.');
    }

    if (payload.tokenType !== 'refresh') {
      this.logger.warn('[refresh] A non-refresh token was submitted to the refresh endpoint.');
      throw new UnauthorizedException('Refresh token is invalid or expired. Please sign in again.');
    }

    this.logger.log(`[refresh] JWT verified for userId=${payload.sub}; checking stored refresh-token hash.`);
    const user = await this.users.findById(payload.sub).select('+refreshTokenHash');
    if (!user?.refreshTokenHash || !(await bcrypt.compare(refreshToken, user.refreshTokenHash))) {
      this.logger.warn(`[refresh] No matching stored token hash for userId=${payload.sub}; request rejected.`);
      throw new UnauthorizedException('Refresh token is invalid or expired. Please sign in again.');
    }

    this.logger.log(`[refresh] Stored token hash matched for userId=${user.id}; creating rotated token pair.`);
    const tokenPair = await this.createTokenPair(user);
    const refreshTokenHash = await bcrypt.hash(tokenPair.refreshToken, 12);
    const result = await this.users.updateOne(
      { _id: user._id, refreshTokenHash: user.refreshTokenHash },
      { $set: { refreshTokenHash } },
    );

    if (result.modifiedCount !== 1) {
      this.logger.warn(`[refresh] Token rotation lost a concurrent update for userId=${user.id}; old token rejected.`);
      throw new UnauthorizedException('Refresh token has already been used. Please sign in again.');
    }

    this.logger.log(`[refresh] Token rotation succeeded for userId=${user.id}; new hash saved, raw tokens not logged.`);
    return { ...tokenPair, user: this.toPublicUser(user) };
  }

  async logout(refreshToken: string) {
    this.logger.log('[logout] Sign-out request received; token value is not logged.');
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      this.logger.log('[logout] Submitted token was invalid or expired; completing sign-out response.');
      return { message: 'Signed out.' };
    }

    if (payload.tokenType === 'refresh') {
      await this.users.updateOne(
        { _id: payload.sub },
        { $unset: { refreshTokenHash: 1 } },
      );
      this.logger.log(`[logout] Stored refresh-token hash removed for userId=${payload.sub}.`);
    }
    return { message: 'Signed out.' };
  }

  async getProfile(userId: string) {
    this.logger.log(`[profile] Protected profile requested for userId=${userId}; access token was validated by JwtStrategy.`);
    const user = await this.users.findById(userId);
    if (!user) {
      this.logger.warn(`[profile] No MongoDB user found for validated token subject userId=${userId}.`);
      throw new UnauthorizedException('Account no longer exists.');
    }
    this.logger.log(`[profile] Returning public profile for userId=${user.id}; password and token hashes excluded.`);
    return this.toPublicUser(user);
  }

  private async issueTokenPair(user: UserDocument) {
    this.logger.log(`[login] Creating access and refresh tokens for userId=${user.id}; token values are not logged.`);
    const tokenPair = await this.createTokenPair(user);
    this.logger.log(`[login] Hashing refresh token for persistence; raw token is not logged.`);
    user.refreshTokenHash = await bcrypt.hash(tokenPair.refreshToken, 12);
    await user.save();
    this.logger.log(`[login] Authentication completed for userId=${user.id}; refresh-token hash saved.`);
    return { ...tokenPair, user: this.toPublicUser(user) };
  }

  private async createTokenPair(user: UserDocument) {
    const common = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...common, tokenType: 'access' },
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '1m' },
      ),
      this.jwt.signAsync(
        { ...common, tokenType: 'refresh' },
        { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: '7d' },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private toPublicUser(user: UserDocument) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error &&
      (error as { code?: unknown }).code === 11000;
  }

  private maskUsername(username: string): string {
    const normalized = username.trim();
    return normalized.length <= 2
      ? `${normalized.slice(0, 1)}***`
      : `${normalized.slice(0, 2)}***`;
  }

  private getErrorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
