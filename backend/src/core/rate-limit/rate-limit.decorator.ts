import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { RATE_LIMIT_POLICY, RateLimitGuard } from './rate-limit.guard.js';
import { PERIOD_MS, RateLimitPeriod } from './rate-limit.store.js';
import type { RateLimitPolicy } from './rate-limit.store.js';

function RateLimit(
  requestCount: number,
  period: RateLimitPeriod,
): MethodDecorator {
  if (
    !Number.isSafeInteger(requestCount) ||
    requestCount <= 0 ||
    !Object.hasOwn(PERIOD_MS, period)
  ) {
    throw new Error(
      'RateLimit requires a positive integer request count and a valid period',
    );
  }

  return (target, property, descriptor) => {
    const policy: RateLimitPolicy = {
      endpoint: `${target.constructor.name}.${String(property)}`,
      requestCount,
      windowMs: PERIOD_MS[period],
    };
    applyDecorators(
      SetMetadata(RATE_LIMIT_POLICY, policy),
      UseGuards(RateLimitGuard),
      ApiTooManyRequestsResponse({
        description: 'Request limit exceeded.',
        headers: {
          'Retry-After': {
            schema: { type: 'integer' },
            description: 'Seconds until retry.',
          },
        },
      }),
    )(target, property, descriptor);
  };
}

export { RateLimit, RateLimitPeriod };
