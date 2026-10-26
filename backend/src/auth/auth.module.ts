import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { ACCESS_TOKEN_TTL, AuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

@Module({ providers: [AuthConfig], exports: [AuthConfig] })
export class AuthConfigModule {}

@Module({
  imports: [
    PrismaModule,
    AuthConfigModule,
    JwtModule.registerAsync({
      imports: [AuthConfigModule],
      inject: [AuthConfig],
      useFactory: (config: AuthConfig) => ({
        secret: config.jwtSecret,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: ACCESS_TOKEN_TTL,
          issuer: 'university-messenger',
          audience: 'university-messenger-api',
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: 'university-messenger',
          audience: 'university-messenger-api',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, AccessTokenGuard, AuthOriginGuard],
  exports: [AccessTokenGuard, JwtModule, AuthConfigModule, PrismaModule],
})
export class AuthModule {}
