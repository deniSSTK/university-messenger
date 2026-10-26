import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { InvalidSessionError } from '../../../domain/auth.errors.js';
import { AuthService } from '../../../service/auth.service.js';
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
  let getActiveSession: jest.Mock;
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
    getActiveSession = jest
      .fn()
      .mockResolvedValue({ sessionId: sid, user: { id: sub } });
    guard = new AccessTokenGuard(jwt, {
      getActiveSession,
    } as unknown as AuthService);
  });

  it('authenticates a signed token backed by an active session', async () => {
    const token = jwt.sign({ sub, sid, type: 'access' });
    const request = context(`Bearer ${token}`);
    expect(await guard.canActivate(request.context)).toBe(true);
    expect(request.request).toHaveProperty('auth', {
      user: { id: sub },
      sessionId: sid,
    });
    expect(getActiveSession).toHaveBeenCalledWith(sid, sub);
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
    expect(getActiveSession).not.toHaveBeenCalled();
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

    if (scenario === 'expired') {
      token = jwt.sign(payload, { expiresIn: -1 });
    } else if (scenario === 'wrong-secret') {
      token = jwt.sign(payload, { secret: 'other-secret' });
    } else if (scenario === 'wrong-type') {
      token = jwt.sign({ ...payload, type: 'refresh' });
    } else if (scenario === 'wrong-subject') {
      token = jwt.sign({ ...payload, sub: 'bad-id' });
    } else if (scenario === 'wrong-session') {
      token = jwt.sign({ ...payload, sid: 'bad-id' });
    } else if (scenario === 'wrong-audience') {
      token = jwt.sign(payload, { audience: 'different-api' });
    } else {
      token = new JwtService({ secret: 'test-secret' }).sign(payload, {
        issuer: 'test',
        audience: 'test-api',
      });
    }

    await expect(
      guard.canActivate(context(`Bearer ${token}`).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getActiveSession).not.toHaveBeenCalled();
  });

  it('rejects a revoked/expired session or a deleted user', async () => {
    getActiveSession.mockRejectedValue(new InvalidSessionError());
    await expect(
      guard.canActivate(
        context(`Bearer ${jwt.sign({ sub, sid, type: 'access' })}`).context,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('preserves database errors instead of reporting invalid credentials', async () => {
    getActiveSession.mockRejectedValue(new Error('database unavailable'));
    await expect(
      guard.canActivate(
        context(`Bearer ${jwt.sign({ sub, sid, type: 'access' })}`).context,
      ),
    ).rejects.toThrow('database unavailable');
  });
});
