import 'dotenv/config';
import { Injectable } from '@nestjs/common';

export const ACCESS_TOKEN_TTL = 15 * 60;
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE = 'refreshToken';

@Injectable()
export class AuthConfig {
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
    if (
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash ||
      (this.secureCookies && origin.protocol !== 'https:')
    ) {
      throw new Error(
        'FRONTEND_ORIGIN must be a valid origin (HTTPS in production)',
      );
    }
    this.frontendOrigin = origin.origin;
  }
}
