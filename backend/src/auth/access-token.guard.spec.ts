import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessTokenGuard } from './access-token.guard.js';

describe('AccessTokenGuard', () => {
  const jwt = new JwtService({
    secret: 'test-secret',
    signOptions: { expiresIn: 900, issuer: 'test', audience: 'test-api' },
    verifyOptions: {
      algorithms: ['HS256'],
      issuer: 'test',
      audience: 'test-api',
    },
  });
  const sub = randomUUID();
  const sid = randomUUID();
  let findFirst: jest.Mock;
  let guard: AccessTokenGuard;

  function context(authorization?: string) {
    const request = { headers: { authorization } };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  }

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue({ id: sid, user: { id: sub } });
    guard = new AccessTokenGuard(jwt, {
      userSession: { findFirst },
    } as unknown as PrismaService);
  });

  it('authenticates a signed token backed by an active session', async () => {
    const token = jwt.sign({ sub, sid, type: 'access' });
    const request = context(`Bearer ${token}`);
    expect(await guard.canActivate(request.context)).toBe(true);
    expect(request.request).toHaveProperty('auth', {
      user: { id: sub },
      sessionId: sid,
    });
    const [args] = findFirst.mock.calls[0] as [Prisma.UserSessionFindFirstArgs];
    expect(args.where).toMatchObject({
      id: sid,
      userId: sub,
      revokedAt: null,
      user: { deletedAt: null },
    });
    expect(args.where?.expiresAt).toHaveProperty('gt', expect.any(Date));
  });

  it.each([
    undefined,
    '',
    'Basic credentials',
    'Bearer invalid',
    'Bearer token extra',
  ])('rejects malformed authorization %p', async (authorization) => {
    await expect(
      guard.canActivate(context(authorization).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it.each([
    'expired',
    'wrong-secret',
    'wrong-type',
    'wrong-subject',
    'wrong-session',
    'wrong-audience',
    'no-expiry',
  ])('rejects token: %s', async (scenario) => {
    let token: string;
    const payload = { sub, sid, type: 'access' };
    if (scenario === 'expired') token = jwt.sign(payload, { expiresIn: -1 });
    else if (scenario === 'wrong-secret')
      token = jwt.sign(payload, { secret: 'other-secret' });
    else if (scenario === 'wrong-type')
      token = jwt.sign({ ...payload, type: 'refresh' });
    else if (scenario === 'wrong-subject')
      token = jwt.sign({ ...payload, sub: 'bad-id' });
    else if (scenario === 'wrong-session')
      token = jwt.sign({ ...payload, sid: 'bad-id' });
    else if (scenario === 'wrong-audience')
      token = jwt.sign(payload, { audience: 'different-api' });
    else
      token = new JwtService({ secret: 'test-secret' }).sign(payload, {
        issuer: 'test',
        audience: 'test-api',
      });
    await expect(
      guard.canActivate(context(`Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects a revoked/expired session or a deleted user', async () => {
    findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(
        context(`Bearer ${jwt.sign({ sub, sid, type: 'access' })}`).context,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('preserves database errors instead of reporting invalid credentials', async () => {
    findFirst.mockRejectedValue(new Error('database unavailable'));
    await expect(
      guard.canActivate(
        context(`Bearer ${jwt.sign({ sub, sid, type: 'access' })}`).context,
      ),
    ).rejects.toThrow('database unavailable');
  });
});
