import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthConfig, REFRESH_COOKIE } from './auth.config.js';
import { LoginDto, RegisterDto } from './auth.dto.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Controller('auth')
@UseGuards(AuthOriginGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AuthConfig,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(await this.auth.register(dto), response);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.respond(await this.auth.login(dto), response);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    return this.respond(
      await this.auth.refresh(cookies?.[REFRESH_COOKIE]),
      response,
    );
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logout(request.auth.sessionId, request.auth.user.id);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    response.setHeader('Cache-Control', 'no-store');
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return request.auth.user;
  }

  private respond(
    result: Awaited<ReturnType<AuthService['login']>>,
    response: Response,
  ) {
    response.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.expiresAt,
    });
    response.setHeader('Cache-Control', 'no-store');
    return result.body;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: '/auth',
    };
  }
}
