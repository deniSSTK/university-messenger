import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { clientIpIdentity } from './client-ip.js';
import { RATE_LIMIT_STORE } from './rate-limit.store.js';
import type { RateLimitPolicy, RateLimitStore } from './rate-limit.store.js';

const RATE_LIMIT_POLICY = Symbol('RATE_LIMIT_POLICY');
type RateLimitedRequest = Request & { auth?: { user: { id: string } } };

@Injectable()
class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<RateLimitPolicy | undefined>(
      RATE_LIMIT_POLICY,
      context.getHandler(),
    );

    if (!policy) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitedRequest>();
    const userId = request.auth?.user.id;
    const identity = userId
      ? `user:${userId}`
      : clientIpIdentity(request.ip ?? request.socket.remoteAddress);
    const result = await this.store.consume(policy, identity);

    if (!result.allowed) {
      http
        .getResponse<Response>()
        .setHeader(
          'Retry-After',
          Math.max(1, Math.ceil(result.retryAfterMs / 1000)),
        );
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

export { RATE_LIMIT_POLICY, RateLimitGuard };
