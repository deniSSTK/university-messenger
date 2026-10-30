import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../../../../../core/config/app.config.js';

@Injectable()
class AuthOriginGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    const isSameOrigin = request.headers['sec-fetch-site'] === 'same-origin';

    if (request.method === 'GET' || isSameOrigin) {
      return true;
    }

    const origin = request.headers.origin;
    const hasUntrustedOrigin = origin && origin !== this.config.frontendOrigin;
    const isCrossSiteWithoutOrigin =
      !origin && request.headers['sec-fetch-site'] === 'cross-site';

    // CORS alone does not stop cross-origin requests from mutating cookies/sessions.
    if (hasUntrustedOrigin || isCrossSiteWithoutOrigin) {
      throw new ForbiddenException('Origin not allowed');
    }

    return true;
  }
}

export { AuthOriginGuard };
