import { MediaModule } from '../media/media.module.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../media/domain/object-storage.port.js';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AccessTokenGuard } from './delivery/http/guards/access-token.guard.js';
import { AppConfig } from '../../core/config/app.config.js';
import { AppConfigModule } from '../../core/config/config.module.js';
import { AuthController } from './delivery/http/auth.controller.js';
import { AuthOriginGuard } from './delivery/http/guards/auth-origin.guard.js';
import { PrismaAuthRepository } from './repository/prisma-auth.repository.js';
import {
  AUTH_REPOSITORY,
  type AuthRepository,
} from './domain/auth.repository.js';
import { AccessTokenService } from './service/access-token.service.js';
import { AuthService } from './service/auth.service.js';
import { PasswordService } from './service/password.service.js';

@Module({
  imports: [
    PrismaModule,
    AppConfigModule,
    MediaModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtSecret,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.accessTokenTtl,
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
  providers: [
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    {
      provide: AuthService,
      inject: [
        AUTH_REPOSITORY,
        PasswordService,
        AccessTokenService,
        AppConfig,
        OBJECT_STORAGE,
      ],
      useFactory: (
        repository: AuthRepository,
        passwords: PasswordService,
        tokens: AccessTokenService,
        config: AppConfig,
        storage: ObjectStorage,
      ) => new AuthService(repository, passwords, tokens, config, storage),
    },
    AccessTokenService,
    PasswordService,
    AccessTokenGuard,
    AuthOriginGuard,
  ],
  exports: [AccessTokenGuard, AuthService, JwtModule],
})
class AuthModule {}

export { AuthModule };
