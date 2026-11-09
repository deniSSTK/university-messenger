import { readStorageConfig } from './storage.config.js';
import { Injectable } from '@nestjs/common';
import {
  readDatabaseConfig,
  readPort,
  readPositiveInteger,
  type DatabaseConfig,
} from './environment.js';

@Injectable()
class AppConfig {
  readonly storage = readStorageConfig();
  readonly accessTokenTtl = readPositiveInteger('JWT_ACCESS_TOKEN_TTL');
  readonly sessionTtl = readPositiveInteger('JWT_SESSION_TTL');
  readonly port = readPort('PORT', 3000);
  readonly authCookiePath = process.env.AUTH_COOKIE_PATH ?? '/auth';
  readonly database: DatabaseConfig;
  readonly jwtSecret: string;
  readonly frontendOrigin: string;
  readonly secureCookies = process.env.NODE_ENV === 'production';

  constructor() {
    const secret = process.env.JWT_SECRET;

    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error('JWT_SECRET must contain at least 32 bytes');
    }

    this.jwtSecret = secret;

    if (!['/auth', '/api/auth'].includes(this.authCookiePath)) {
      throw new Error('AUTH_COOKIE_PATH must be /auth or /api/auth');
    }

    const origin = new URL(
      process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200',
    );
    const hasUnsupportedProtocol = !['http:', 'https:'].includes(
      origin.protocol,
    );
    const hasCredentials = Boolean(origin.username || origin.password);
    const hasExtraUrlParts = Boolean(
      origin.pathname !== '/' || origin.search || origin.hash,
    );
    const isInsecureProductionOrigin =
      this.secureCookies && origin.protocol !== 'https:';

    if (
      hasUnsupportedProtocol ||
      hasCredentials ||
      hasExtraUrlParts ||
      isInsecureProductionOrigin
    ) {
      throw new Error(
        'FRONTEND_ORIGIN must be a valid origin (HTTPS in production)',
      );
    }

    this.frontendOrigin = origin.origin;
    this.database = readDatabaseConfig();
  }
}

export { AppConfig };
