import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthConfig } from './auth.config.js';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: AuthConfig) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'GET') return true;
    const origin = request.headers.origin;
    // CORS alone does not stop cross-origin requests from mutating cookies/sessions.
    if (
      (origin && origin !== this.config.frontendOrigin) ||
      (!origin && request.headers['sec-fetch-site'] === 'cross-site')
    )
      throw new ForbiddenException('Origin not allowed');
    return true;
  }
}
