import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AccessTokenPayload } from './jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { Protected } from './decoraters/protected.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  logout(@Body() body: RefreshTokenDto) {
    return this.authService.logout(body.refreshToken);
  }

  // @UseGuards(JwtAuthGuard)
  @Protected('access-token')
  @Get('me')
  me(@Req() request: Request & { user: AccessTokenPayload }) {
    return this.authService.getProfile(request.user.sub);
  }
}
