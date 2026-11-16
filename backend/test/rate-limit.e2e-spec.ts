import {
  Controller,
  Get,
  Injectable,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Application, Request } from 'express';
import type { App } from 'supertest/types';
import { clientIpIdentity } from '../src/core/rate-limit/client-ip.js';
import { MemoryRateLimitStore } from '../src/core/rate-limit/memory-rate-limit.store.js';
import {
  RateLimit,
  RateLimitPeriod,
} from '../src/core/rate-limit/rate-limit.decorator.js';
import { RATE_LIMIT_STORE } from '../src/core/rate-limit/rate-limit.store.js';

type FixtureRequest = Request & { auth?: { user: { id: string } } };

@Injectable()
class TestIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FixtureRequest>();
    const id = req.header('x-test-user');

    if (id) {
      req.auth = { user: { id } };
    }

    return true;
  }
}

@Controller()
@UseGuards(TestIdentityGuard)
class RateLimitTestController {
  @Get('limited')
  @RateLimit(2, RateLimitPeriod.SECOND)
  limited(): string {
    return 'ok';
  }

  @Get('other')
  @RateLimit(2, RateLimitPeriod.SECOND)
  other(): string {
    return 'ok';
  }
}

describe('HTTP rate limiting', () => {
  let app: INestApplication<App>;
  let now: number;

  beforeEach(async () => {
    now = 0;
    const module = await Test.createTestingModule({
      controllers: [RateLimitTestController],
      providers: [
        {
          provide: RATE_LIMIT_STORE,
          useValue: new MemoryRateLimitStore(4, () => now),
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('allows the configured count under concurrency and resets after the window', async () => {
    const api = request(app.getHttpServer());
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => api.get('/limited')),
    );
    expect(outcomes.map(({ status }) => status).sort()).toEqual([
      200, 200, 429, 429, 429, 429,
    ]);

    for (const rejected of outcomes.filter(({ status }) => status === 429)) {
      expect(rejected.headers['retry-after']).toBe('1');
    }

    await api.get('/other').expect(200);
    now = 999;
    await api.get('/limited').expect(429);
    now = 1000;
    await api.get('/limited').expect(200);
  });

  it('separates authenticated users from each other and from their shared IP', async () => {
    const api = request(app.getHttpServer());
    await api.get('/limited').set('x-test-user', 'alice').expect(200);
    await api.get('/limited').set('x-test-user', 'alice').expect(200);
    await api.get('/limited').set('x-test-user', 'alice').expect(429);
    await api.get('/limited').set('x-test-user', 'bob').expect(200);
    await api.get('/limited').expect(200);
  });

  it('ignores forwarded IPs for direct requests and uses the closest proxy address when configured', async () => {
    const api = request(app.getHttpServer());
    await api.get('/limited').set('X-Forwarded-For', '192.0.2.1').expect(200);
    await api.get('/limited').set('X-Forwarded-For', '192.0.2.2').expect(200);
    await api.get('/limited').set('X-Forwarded-For', '192.0.2.3').expect(429);

    const adapter = app.getHttpAdapter();
    const express = adapter.getInstance() as Application;
    express.set('trust proxy', 1);
    await api
      .get('/limited')
      .set('X-Forwarded-For', '192.0.2.10, 192.0.2.20')
      .expect(200);
    await api
      .get('/limited')
      .set('X-Forwarded-For', '192.0.2.11, 192.0.2.20')
      .expect(200);
    await api
      .get('/limited')
      .set('X-Forwarded-For', '192.0.2.12, 192.0.2.20')
      .expect(429);
    await api
      .get('/limited')
      .set('X-Forwarded-For', '192.0.2.10, 192.0.2.21')
      .expect(200);
  });

  it('bounds the number of identities without evicting existing counters', async () => {
    const api = request(app.getHttpServer());

    for (let index = 1; index <= 4; index++) {
      await api.get('/limited').set('x-test-user', String(index)).expect(200);
    }

    await api.get('/limited').set('x-test-user', '5').expect(429);
    await api.get('/limited').set('x-test-user', '1').expect(200);
    await api.get('/limited').set('x-test-user', '1').expect(429);
    now = 1000;
    await api.get('/limited').set('x-test-user', '5').expect(200);
  });

  it('normalizes IPv4-mapped addresses and groups IPv6 addresses by subnet', () => {
    expect(clientIpIdentity('::ffff:192.0.2.1')).toBe(
      clientIpIdentity('192.0.2.1'),
    );
    expect(clientIpIdentity('::ffff:c000:201')).toBe(
      clientIpIdentity('192.0.2.1'),
    );
    expect(clientIpIdentity('2001:db8:1:2::4')).toBe(
      clientIpIdentity('2001:db8:1:2::5'),
    );
    expect(clientIpIdentity('2001:db8:1:2::4')).not.toBe(
      clientIpIdentity('2001:db8:1:3::4'),
    );
  });
});
