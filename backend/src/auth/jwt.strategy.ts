import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '../users/user.schema';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRole;
  tokenType: 'access';
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: AccessTokenPayload) {
    if (payload.tokenType !== 'access') {
      this.logger.warn(`[access] Rejected token with type=${payload.tokenType}; expected access token.`);
      throw new UnauthorizedException('Invalid access token.');
    }

    const expiresAt = payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown';
    this.logger.log(
      `[access] JWT signature and expiry verified for userId=${payload.sub}; type=access, expiresAt=${expiresAt}.`,
    );
    return payload;
  }
}
