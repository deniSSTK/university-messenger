import {
  RateLimit,
  RateLimitPeriod,
} from '../../../../core/rate-limit/rate-limit.decorator.js';
import { ApiServiceUnavailableResponse } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { AppConfig } from '../../../../core/config/app.config.js';
import { REFRESH_COOKIE } from './auth.constants.js';
import { LoginDto, RegisterDto } from './dto/auth-request.dto.js';
import { AuthOriginGuard } from './guards/auth-origin.guard.js';
import { AuthExceptionFilter } from './auth-exception.filter.js';
import type { AuthResult } from '../../service/auth.types.js';
import { AuthService } from '../../service/auth.service.js';
import type { AuthenticatedRequest } from './auth-http.types.js';
import { AuthResponseDto, PublicUserDto } from './dto/auth-response.dto.js';

@ApiServiceUnavailableResponse({
  description: 'Object storage is temporarily unavailable.',
})
@ApiTags('Auth')
@ApiForbiddenResponse({
  description: 'Request origin is not allowed (POST endpoints).',
})
@Controller('auth')
@UseFilters(AuthExceptionFilter)
@UseGuards(AuthOriginGuard)
class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  @Post('register')
  @RateLimit(10, RateLimitPeriod.MINUTE)
  @ApiOperation({
    summary: 'Register a user and create a session',
    description:
      'Preserves email casing, normalizes username to lowercase, and sets an HttpOnly refreshToken cookie. Email uniqueness is case-insensitive.',
  })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid fields or unexpected properties.',
  })
  @ApiConflictResponse({ description: 'Email or username is already in use.' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.setAuthCookieAndBuildResponse(
      await this.auth.register({
        email: dto.email,
        password: dto.password,
        username: dto.username,
        displayName: dto.displayName,
      }),
      response,
    );
  }

  @Post('login')
  @RateLimit(15, RateLimitPeriod.MINUTE)
  @ApiOperation({
    summary: 'Log in and create a session',
    description:
      'Sets an HttpOnly refreshToken cookie. Deleted users cannot log in.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid email or password format.' })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials or deleted user.',
  })
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.setAuthCookieAndBuildResponse(
      await this.auth.login({ email: dto.email, password: dto.password }),
      response,
    );
  }

  @Post('refresh')
  @RateLimit(60, RateLimitPeriod.MINUTE)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue an access token',
    description:
      'Uses the refreshToken cookie, replaces it on success, and preserves the original session expiry. No request body or access token is required.',
  })
  @ApiCookieAuth()
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({
    description:
      'Missing, invalid, reused, expired, or revoked refresh token, or deleted user.',
  })
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = request.cookies as Record<string, unknown> | undefined;

    return this.setAuthCookieAndBuildResponse(
      await this.auth.refresh(cookies?.[REFRESH_COOKIE]),
      response,
    );
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Revoke the current session',
    description:
      'Invalidates its access and refresh tokens and clears the refreshToken cookie.',
  })
  @ApiBearerAuth()
  @ApiNoContentResponse({
    description: 'Session revoked and refresh cookie cleared.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing or invalid access token, inactive session, or deleted user.',
  })
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
  @ApiOperation({ summary: 'Get the current user' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: PublicUserDto })
  @ApiUnauthorizedResponse({
    description:
      'Missing or invalid access token, inactive session, or deleted user.',
  })
  @UseGuards(AccessTokenGuard)
  me(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');

    return request.auth.user;
  }

  private setAuthCookieAndBuildResponse(
    result: AuthResult,
    response: Response,
  ) {
    response.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions(),
      expires: result.expiresAt,
    });
    response.setHeader('Cache-Control', 'no-store');

    return {
      user: result.user,
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
    } satisfies AuthResponseDto;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secureCookies,
      sameSite: 'lax',
      path: this.config.authCookiePath,
    };
  }
}

export { AuthController };
