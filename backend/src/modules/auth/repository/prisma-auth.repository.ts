import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';

import { DuplicateUserError } from '../domain/auth.errors.js';
import type {
  AuthRepository,
  AuthRepositoryOperations,
  CreateUserInput,
  CreateSessionInput,
  RotateRefreshTokenInput,
} from '../domain/auth.repository.js';
import type {
  PublicUser,
  AuthUser,
  Session,
  RefreshSession,
  ActiveSession,
} from '../domain/auth.models.js';

const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

class PrismaAuthRepositoryOperations implements AuthRepositoryOperations {
  constructor(private readonly database: Prisma.TransactionClient) {}

  async createUser(data: CreateUserInput): Promise<PublicUser> {
    try {
      return await this.database.user.create({
        data,
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DuplicateUserError();
      }

      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const users = await this.database.$queryRaw<AuthUser[]>`
      SELECT "id", "email", "username", "displayName", "createdAt", "updatedAt", "passwordHash", "deletedAt"
      FROM "User"
      WHERE LOWER("email") = LOWER(${email})
      LIMIT 1
    `;

    return users[0] ?? null;
  }

  findActiveUser(userId: string): Promise<PublicUser | null> {
    return this.database.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: publicUserSelect,
    });
  }

  createSession(data: CreateSessionInput): Promise<Session> {
    return this.database.userSession.create({
      data,
      select: { id: true, expiresAt: true },
    });
  }

  findRefreshSession(
    tokenHash: string,
    now: Date,
  ): Promise<RefreshSession | null> {
    return this.database.userSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { deletedAt: null },
      },
      select: { id: true, expiresAt: true, user: { select: publicUserSelect } },
    });
  }

  async rotateRefreshToken(input: RotateRefreshTokenInput): Promise<boolean> {
    const { sessionId, previousHash, nextHash, now } = input;

    // Compare-and-swap prevents concurrent requests from consuming the same token.
    const result = await this.database.userSession.updateMany({
      where: {
        id: sessionId,
        tokenHash: previousHash,
        revokedAt: null,
        expiresAt: { gt: now },
        user: { deletedAt: null },
      },
      data: { tokenHash: nextHash },
    });

    return result.count === 1;
  }

  findActiveSession(
    sessionId: string,
    userId: string,
  ): Promise<ActiveSession | null> {
    return this.database.userSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { deletedAt: null },
      },
      select: {
        id: true,
        user: { select: publicUserSelect },
      },
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.database.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

@Injectable()
class PrismaAuthRepository
  extends PrismaAuthRepositoryOperations
  implements AuthRepository
{
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }

  transaction<T>(
    operation: (repository: AuthRepositoryOperations) => Promise<T>,
  ) {
    return this.prisma.$transaction((transaction) =>
      operation(new PrismaAuthRepositoryOperations(transaction)),
    );
  }
}

export { PrismaAuthRepository };
