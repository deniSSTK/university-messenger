import type {
  ProfileUpdateResult,
  ProfileUpdate,
} from '../domain/profile.models.js';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  UsersRepository,
  FindUsersInput,
  FindUsersResult,
} from '../domain/users.repository.js';

function escapeLikePrefix(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

@Injectable()
class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(input: ProfileUpdate): Promise<ProfileUpdateResult> {
    return this.prisma.$transaction(async (transaction) => {
      const [previous] = await transaction.$queryRaw<
        { avatarKey: string | null }[]
      >`
        SELECT "avatarKey" FROM "User" WHERE "id" = ${input.userId}::uuid AND "deletedAt" IS NULL FOR UPDATE
      `;
      const user = await transaction.user.update({
        where: { id: input.userId, deletedAt: null },
        data: {
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          avatarKey: input.avatarKey,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          avatarKey: true,
        },
      });

      return {
        previousAvatarKey: previous?.avatarKey ?? null,
        profile: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          avatarKey: user.avatarKey,
        },
      };
    });
  }

  async findByUsernamePrefix(input: FindUsersInput): Promise<FindUsersResult> {
    const prefix = `${escapeLikePrefix(input.usernamePrefix.toLowerCase())}%`;
    const where = Prisma.sql`"deletedAt" IS NULL AND "id" <> ${input.excludedUserId}::uuid AND LOWER("username") LIKE ${prefix}`;

    const [users, counts] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<FindUsersResult['users']>`
          SELECT "id", "username", "displayName" FROM "User" WHERE ${where}
          ORDER BY "username" ASC, "id" ASC LIMIT ${input.take} OFFSET ${input.offset}
        `,
        this.prisma.$queryRaw<
          { total: bigint }[]
        >`SELECT COUNT(*) AS total FROM "User" WHERE ${where}`,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return {
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      })),
      total: Number(counts[0].total),
    };
  }
}

export { PrismaUsersRepository };
