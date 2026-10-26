import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AccessTokenIssuer } from '../domain/auth.ports.js';

@Injectable()
class AccessTokenService implements AccessTokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  issue(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'access' },
      { jwtid: randomUUID() },
    );
  }
}

export { AccessTokenService };
