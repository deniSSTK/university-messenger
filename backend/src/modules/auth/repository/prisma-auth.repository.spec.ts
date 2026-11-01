import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { DuplicateUserError } from '../domain/auth.errors.js';
import { PrismaAuthRepository } from './prisma-auth.repository.js';

describe('PrismaAuthRepository', () => {
  const input = {
    email: 'Alice@Example.com',
    username: 'alice',
    displayName: 'Alice',
    passwordHash: 'hash',
  };
  let database: {
    user: { create: jest.Mock; findFirst: jest.Mock };
    userSession: { findFirst: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let repository: PrismaAuthRepository;

  beforeEach(() => {
    database = {
      user: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      userSession: { findFirst: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(),
    };
    repository = new PrismaAuthRepository(database as unknown as PrismaService);
  });

  it('translates Prisma uniqueness errors to a domain error', async () => {
    database.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );

    await expect(repository.createUser(input)).rejects.toBeInstanceOf(
      DuplicateUserError,
    );
  });

  it('does not hide unexpected storage failures', async () => {
    database.user.create.mockRejectedValue(new Error('database unavailable'));

    await expect(repository.createUser(input)).rejects.toThrow(
      'database unavailable',
    );
  });

  it('looks up emails case-insensitively through the configured Prisma schema', async () => {
    await expect(repository.findUserByEmail(input.email)).resolves.toBeNull();

    const [args] = database.user.findFirst.mock.calls[0] as [
      Prisma.UserFindFirstArgs,
    ];

    expect(args.where).toEqual({
      email: { equals: input.email, mode: 'insensitive' },
    });
    expect(args.select).toMatchObject({ passwordHash: true, deletedAt: true });
  });

  it('uses the transaction client for operations inside a transaction', async () => {
    const transactionQuery = jest.fn().mockResolvedValue(null);
    database.$transaction.mockImplementation(
      (operation: (client: unknown) => unknown) =>
        operation({ user: { findFirst: transactionQuery } }),
    );

    await repository.transaction((transaction) =>
      transaction.findUserByEmail(input.email),
    );

    expect(transactionQuery).toHaveBeenCalledTimes(1);
    expect(database.user.findFirst).not.toHaveBeenCalled();
  });

  it('preserves all active-session restrictions', async () => {
    database.userSession.findFirst.mockResolvedValue(null);

    await repository.findActiveSession('session-id', 'user-id');

    const [args] = database.userSession.findFirst.mock.calls[0] as [
      Prisma.UserSessionFindFirstArgs,
    ];

    expect(args.where).toMatchObject({
      id: 'session-id',
      userId: 'user-id',
      revokedAt: null,
      user: { deletedAt: null },
    });
    expect(args.where?.expiresAt).toHaveProperty('gt', expect.any(Date));
  });

  it('uses compare-and-swap when rotating refresh tokens', async () => {
    database.userSession.updateMany.mockResolvedValue({ count: 0 });
    const now = new Date();

    await expect(
      repository.rotateRefreshToken({
        sessionId: 'session-id',
        previousHash: 'old',
        nextHash: 'new',
        now,
      }),
    ).resolves.toBe(false);
    expect(database.userSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-id',
        tokenHash: 'old',
        revokedAt: null,
        expiresAt: { gt: now },
        user: { deletedAt: null },
      },
      data: { tokenHash: 'new' },
    });
  });
});
