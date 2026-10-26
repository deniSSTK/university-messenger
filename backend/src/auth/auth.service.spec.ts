import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

describe('AuthService', () => {
  const user = {
    id: randomUUID(),
    email: 'user@example.com',
    username: 'user',
    displayName: 'User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const input = {
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    password: 'password123',
  };
  let service: AuthService;
  let database: {
    user: { create: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock };
    userSession: {
      create: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let passwords: { hash: jest.Mock; verify: jest.Mock };

  beforeEach(() => {
    database = {
      user: {
        create: jest.fn().mockResolvedValue(user),
        findUnique: jest.fn().mockResolvedValue({
          ...user,
          passwordHash: 'hash',
          deletedAt: null,
        }),
        findFirst: jest.fn().mockResolvedValue(user),
      },
      userSession: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: { expiresAt: Date } }) =>
            Promise.resolve({ id: randomUUID(), ...data }),
          ),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(),
    };
    database.$transaction.mockImplementation(
      (callback: (tx: unknown) => unknown) => callback(database),
    );
    passwords = {
      hash: jest.fn().mockResolvedValue('hash'),
      verify: jest.fn().mockResolvedValue(true),
    };
    service = new AuthService(
      database as unknown as PrismaService,
      passwords as unknown as PasswordService,
      new JwtService({
        secret: 'test-secret',
        signOptions: { expiresIn: 900 },
      }),
    );
  });

  it('registers a user and stores only a SHA-256 hash of the refresh token', async () => {
    const result = await service.register(input);
    expect(passwords.hash).toHaveBeenCalledWith(input.password);
    expect(database.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          passwordHash: 'hash',
        },
      }),
    );
    const [args] = database.userSession.create.mock.calls[0] as [
      Prisma.UserSessionCreateArgs,
    ];
    expect(args.data).toMatchObject({
      userId: user.id,
      tokenHash: createHash('sha256').update(result.refreshToken).digest('hex'),
    });
    expect(result.body.user).toEqual(user);
    expect(result.body).not.toHaveProperty('refreshToken');
  });

  it('converts database uniqueness errors into a conflict', async () => {
    database.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    await expect(service.register(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not hide unexpected database errors', async () => {
    database.user.create.mockRejectedValue(new Error('database unavailable'));
    await expect(service.register(input)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('creates a new session on login', async () => {
    const result = await service.login(input);
    expect(passwords.verify).toHaveBeenCalledWith(input.password, 'hash');
    expect(result.body.accessToken).toBeDefined();
    expect(database.userSession.create).toHaveBeenCalledTimes(1);
  });

  it.each(['missing', 'wrong-password', 'deleted'])(
    'rejects login: %s',
    async (scenario) => {
      if (scenario === 'missing')
        database.user.findUnique.mockResolvedValue(null);
      if (scenario === 'wrong-password')
        passwords.verify.mockResolvedValue(false);
      if (scenario === 'deleted')
        database.user.findUnique.mockResolvedValue({
          ...user,
          passwordHash: 'hash',
          deletedAt: new Date(),
        });
      await expect(service.login(input)).rejects.toThrow(
        'Invalid email or password',
      );
      expect(database.userSession.create).not.toHaveBeenCalled();
    },
  );

  it('rejects a user deleted between the password check and session creation', async () => {
    database.user.findFirst.mockResolvedValue(null);
    await expect(service.login(input)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([undefined, '', 'malformed', { token: 'value' }])(
    'rejects malformed refresh token %p',
    async (token) => {
      await expect(service.refresh(token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(database.$transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects unknown, revoked or expired refresh tokens', async () => {
    database.userSession.findFirst.mockResolvedValue(null);
    await expect(service.refresh('a'.repeat(43))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates refresh tokens without extending the session lifetime', async () => {
    const expiresAt = new Date(Date.now() + 60000);
    const id = randomUUID();
    database.userSession.findFirst.mockResolvedValue({ id, user, expiresAt });
    const result = await service.refresh('a'.repeat(43));
    expect(result.refreshToken).not.toBe('a'.repeat(43));
    expect(result.expiresAt).toEqual(expiresAt);
    const [args] = database.userSession.updateMany.mock.calls[0] as [
      Prisma.UserSessionUpdateManyArgs,
    ];
    expect(args.where).toMatchObject({
      id,
      tokenHash: createHash('sha256').update('a'.repeat(43)).digest('hex'),
      revokedAt: null,
    });
    expect(args.data).toEqual({
      tokenHash: createHash('sha256').update(result.refreshToken).digest('hex'),
    });
  });

  it('rejects a concurrent refresh that already consumed the token', async () => {
    database.userSession.findFirst.mockResolvedValue({
      id: randomUUID(),
      user,
      expiresAt: new Date(Date.now() + 60000),
    });
    database.userSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refresh('a'.repeat(43))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes only the current user session', async () => {
    const sessionId = randomUUID();
    await service.logout(sessionId, user.id);
    const [args] = database.userSession.updateMany.mock.calls[0] as [
      Prisma.UserSessionUpdateManyArgs,
    ];
    expect(args.where).toEqual({
      id: sessionId,
      userId: user.id,
      revokedAt: null,
    });
    expect(args.data.revokedAt).toBeInstanceOf(Date);
  });
});
