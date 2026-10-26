import { randomUUID, createHash } from 'node:crypto';
import type {
  AuthRepository,
  AuthRepositoryOperations,
} from '../domain/auth.repository.js';
import type {
  PasswordHasher,
  AccessTokenIssuer,
} from '../domain/auth.ports.js';
import {
  DuplicateUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidSessionError,
} from '../domain/auth.errors.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const user = {
    id: randomUUID(),
    email: 'Alice@Example.com',
    username: 'alice',
    displayName: 'Alice',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const input = {
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    password: 'password123',
  };
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 3600000);
  let operations: jest.Mocked<AuthRepositoryOperations>;
  let repository: AuthRepository;
  let transactionSpy: jest.SpyInstance;
  let passwords: jest.Mocked<PasswordHasher>;
  let tokens: jest.Mocked<AccessTokenIssuer>;
  let service: AuthService;

  beforeEach(() => {
    operations = {
      createUser: jest.fn(),
      findUserByEmail: jest.fn(),
      findActiveUser: jest.fn(),
      createSession: jest.fn(),
      findRefreshSession: jest.fn(),
      rotateRefreshToken: jest.fn(),
      findActiveSession: jest.fn(),
      revokeSession: jest.fn(),
    };
    operations.createUser.mockResolvedValue(user);
    operations.findUserByEmail.mockResolvedValue({
      ...user,
      passwordHash: 'hash',
      deletedAt: null,
    });
    operations.findActiveUser.mockResolvedValue(user);
    operations.createSession.mockImplementation((data) =>
      Promise.resolve({ id: sessionId, expiresAt: data.expiresAt }),
    );
    operations.findRefreshSession.mockResolvedValue({
      id: sessionId,
      user,
      expiresAt,
    });
    operations.rotateRefreshToken.mockResolvedValue(true);
    operations.findActiveSession.mockResolvedValue({ id: sessionId, user });
    repository = {
      ...operations,
      transaction<T>(
        operation: (repository: AuthRepositoryOperations) => Promise<T>,
      ): Promise<T> {
        return operation(operations);
      },
    };
    transactionSpy = jest.spyOn(repository, 'transaction');
    passwords = { hash: jest.fn(), verify: jest.fn() };
    passwords.hash.mockResolvedValue('hash');
    passwords.verify.mockResolvedValue(true);
    tokens = { issue: jest.fn() };
    tokens.issue.mockResolvedValue('signed-access-token');
    service = new AuthService(repository, passwords, tokens, {
      accessTokenTtl: 120,
      sessionTtl: 3600000,
    });
  });

  it('registers with hashed secrets and the configured token lifetimes', async () => {
    const startedAt = Date.now();
    const result = await service.register(input);

    expect(operations.createUser.mock.calls).toContainEqual([
      {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        passwordHash: 'hash',
      },
    ]);
    expect(operations.createSession.mock.calls).toContainEqual([
      {
        userId: user.id,
        tokenHash: createHash('sha256')
          .update(result.refreshToken)
          .digest('hex'),
        expiresAt: result.expiresAt,
      },
    ]);
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      startedAt + 3600000,
    );
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 3600000,
    );
    expect(result.expiresIn).toBe(120);
    expect(result.user).toEqual(user);
    expect(tokens.issue.mock.calls).toContainEqual([user.id, sessionId]);
  });

  it('preserves domain duplicate errors', async () => {
    operations.createUser.mockRejectedValue(new DuplicateUserError());

    await expect(service.register(input)).rejects.toBeInstanceOf(
      DuplicateUserError,
    );
  });

  it('preserves unexpected repository errors', async () => {
    operations.createUser.mockRejectedValue(new Error('database unavailable'));

    await expect(service.register(input)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('logs in using the original email and creates a session', async () => {
    const result = await service.login(input);

    expect(operations.findUserByEmail.mock.calls).toContainEqual([input.email]);
    expect(passwords.verify.mock.calls).toContainEqual([
      input.password,
      'hash',
    ]);
    expect(operations.createSession.mock.calls).toHaveLength(1);
    expect(result.accessToken).toBe('signed-access-token');
  });

  it.each(['missing', 'wrong-password', 'deleted'])(
    'rejects login: %s',
    async (scenario) => {
      if (scenario === 'missing') {
        operations.findUserByEmail.mockResolvedValue(null);
      }

      if (scenario === 'wrong-password') {
        passwords.verify.mockResolvedValue(false);
      }

      if (scenario === 'deleted') {
        operations.findUserByEmail.mockResolvedValue({
          ...user,
          passwordHash: 'hash',
          deletedAt: new Date(),
        });
      }

      await expect(service.login(input)).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
      expect(operations.createSession.mock.calls).toHaveLength(0);
    },
  );

  it('rejects a user deleted before session creation', async () => {
    operations.findActiveUser.mockResolvedValue(null);

    await expect(service.login(input)).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(operations.createSession.mock.calls).toHaveLength(0);
  });

  it.each([undefined, '', 'malformed', { token: 'value' }])(
    'rejects malformed refresh token %p',
    async (token) => {
      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        InvalidRefreshTokenError,
      );
      expect(transactionSpy).not.toHaveBeenCalled();
    },
  );

  it('rejects missing, revoked or expired refresh sessions', async () => {
    operations.findRefreshSession.mockResolvedValue(null);

    await expect(service.refresh('a'.repeat(43))).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('rotates refresh hashes without extending session expiry', async () => {
    const token = 'a'.repeat(43);
    const result = await service.refresh(token);
    const [rotation] = operations.rotateRefreshToken.mock.calls[0];

    expect(result.refreshToken).not.toBe(token);
    expect(result.expiresAt).toEqual(expiresAt);
    expect(rotation.sessionId).toBe(sessionId);
    expect(rotation.previousHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(rotation.nextHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(rotation.now).toBeInstanceOf(Date);
  });

  it('rejects a concurrently consumed refresh token without issuing access', async () => {
    operations.rotateRefreshToken.mockResolvedValue(false);

    await expect(service.refresh('a'.repeat(43))).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(tokens.issue.mock.calls).toHaveLength(0);
  });

  it('returns authentication context for an active session', async () => {
    await expect(service.getActiveSession(sessionId, user.id)).resolves.toEqual(
      { user, sessionId },
    );
    expect(operations.findActiveSession.mock.calls).toContainEqual([
      sessionId,
      user.id,
    ]);
  });

  it('rejects inactive sessions', async () => {
    operations.findActiveSession.mockResolvedValue(null);

    await expect(
      service.getActiveSession(sessionId, user.id),
    ).rejects.toBeInstanceOf(InvalidSessionError);
  });

  it('revokes only the current session', async () => {
    await service.logout(sessionId, user.id);

    expect(operations.revokeSession.mock.calls).toContainEqual([
      sessionId,
      user.id,
    ]);
  });
});
