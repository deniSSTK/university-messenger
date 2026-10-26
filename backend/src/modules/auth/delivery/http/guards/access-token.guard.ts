import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { InvalidSessionError } from '../../../domain/auth.errors.js';
import { AuthService } from '../../../service/auth.service.js';
import { type AuthenticatedRequest } from '../auth-http.types.js';

type AccessTokenClaims = {
  sub: string;
  sid: string;
  type: 'access';
  exp: number;
};

function isAccessTokenClaims(value: unknown): value is AccessTokenClaims {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'type' in value &&
    value.type === 'access' &&
    'exp' in value &&
    typeof value.exp === 'number' &&
    'sub' in value &&
    typeof value.sub === 'string' &&
    isUUID(value.sub) &&
    'sid' in value &&
    typeof value.sid === 'string' &&
    isUUID(value.sid)
  );
}

@Injectable()
class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s]+)$/i.exec(
      request.headers.authorization ?? '',
    );

    if (!match) {
      throw new UnauthorizedException();
    }

    let claims: unknown;

    try {
      claims = await this.jwt.verifyAsync<object>(match[1]);
    } catch {
      throw new UnauthorizedException();
    }

    if (!isAccessTokenClaims(claims)) {
      throw new UnauthorizedException();
    }

    try {
      request.auth = await this.auth.getActiveSession(claims.sid, claims.sub);
    } catch (error) {
      if (error instanceof InvalidSessionError) {
        throw new UnauthorizedException();
      }

      throw error;
    }

    return true;
  }
}

export { AccessTokenGuard };
