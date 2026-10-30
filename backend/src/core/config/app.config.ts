import { Injectable } from '@nestjs/common';
import { readMessageStorageConfig } from './message-storage.config.js';
import {
  readDatabaseConfig,
  readPort,
  readPositiveInteger,
  type DatabaseConfig,
} from './environment.js';

@Injectable()
class AppConfig {
  readonly messageStorage = readMessageStorageConfig();
  readonly accessTokenTtl = readPositiveInteger('JWT_ACCESS_TOKEN_TTL');
  readonly sessionTtl = readPositiveInteger('JWT_SESSION_TTL');
  readonly port = readPort('PORT', 3000);
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
