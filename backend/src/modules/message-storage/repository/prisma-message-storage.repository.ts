import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client.js';
import { Prisma as ShardPrisma } from '../../../generated/message-shards/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { MessageShardRegistry } from './message-shard.registry.js';
import type { MessageStorageRepository } from '../domain/message-storage.repository.js';
import type {
  StoredMessage,
  AppendMessageInput,
  MessageHistoryInput,
  MoveChatResult,
} from '../domain/message-storage.models.js';
import {
  MessageAccessError,
  MessageConflictError,
} from '../domain/message-storage.errors.js';

const messageSelect = {
  id: true,
  chatId: true,
  senderId: true,
  text: true,
  createdAt: true,
  editedAt: true,
  readAt: true,
  deletedAt: true,
} as const;
type ChatRoute = { id: string; messageShardId: string | null };
type MessageReadWhere = {
  chatId?: string;
  id?: string;
  deletedAt?: null;
  OR?: {
    createdAt: Date | { lt?: Date; gt?: Date };
    id?: { lt?: string; gt?: string };
  }[];
};
type MessageReadArgs = {
  where: MessageReadWhere;
  select: typeof messageSelect;
  orderBy?: { createdAt?: 'asc' | 'desc'; id?: 'asc' | 'desc' }[];
  take?: number;
};
type MessageStore = {
  findFirst: (args: {
    where: { id: string; createdAt: Date };
    select: typeof messageSelect;
  }) => Promise<StoredMessage | null>;
  findMany: (args: MessageReadArgs) => Promise<StoredMessage[]>;
  create: (args: {
    data: AppendMessageInput;
    select: typeof messageSelect;
  }) => Promise<StoredMessage>;
};

function serializeMessage(message: StoredMessage): string {
  return JSON.stringify([
    message.id,
    message.chatId,
    message.senderId,
    message.text,
    message.createdAt,
    message.editedAt,
    message.readAt,
    message.deletedAt,
  ]);
}

function positionAfter(message: StoredMessage) {
  return {
    OR: [
      { createdAt: { gt: message.createdAt } },
      { createdAt: message.createdAt, id: { gt: message.id } },
    ],
  };
}

@Injectable()
class PrismaMessageStorageRepository implements MessageStorageRepository {
  constructor(
    private readonly main: PrismaService,
    private readonly shards: MessageShardRegistry,
  ) {}

  private store(
    transaction: Prisma.TransactionClient,
    shardId: string | null,
  ): MessageStore {
    if (shardId === null) {
      return {
        findFirst: (args) => transaction.message.findFirst(args),
        findMany: (args) => transaction.message.findMany(args),
        create: (args) => transaction.message.create(args),
      };
    }

    const client = this.shards.get(shardId);

    return {
      findFirst: (args) => client.storedMessage.findFirst(args),
      findMany: (args) => client.storedMessage.findMany(args),
      create: (args) => client.storedMessage.create(args),
    };
  }

  private async lockChat(
    transaction: Prisma.TransactionClient,
    chatId: string,
  ): Promise<ChatRoute> {
    const chats = await transaction.$queryRaw<ChatRoute[]>`
      SELECT "id", "messageShardId" FROM "Chat"
      WHERE "id" = ${chatId}::uuid AND "deletedAt" IS NULL FOR UPDATE
    `;

    if (!chats[0]) {
      throw new MessageAccessError();
    }

    return chats[0];
  }

  private async requireMember(
    transaction: Prisma.TransactionClient,
    chatId: string,
    userId: string,
  ) {
    const member = await transaction.chatMember.findFirst({
      where: { chatId, userId, deletedAt: null, user: { deletedAt: null } },
      select: { userId: true },
    });

    if (!member) {
      throw new MessageAccessError();
    }
  }

  append(input: AppendMessageInput): Promise<StoredMessage> {
    return this.main
      .$transaction(async (transaction) => {
        const chat = await this.lockChat(transaction, input.chatId);
        await this.requireMember(transaction, input.chatId, input.senderId);

        if (
          chat.messageShardId === null &&
          this.shards.settings.shards.length > 0
        ) {
          const legacyMessages = await transaction.message.count({
            where: { chatId: input.chatId },
          });

          if (legacyMessages === 0) {
            chat.messageShardId = this.shards.select(input.chatId);
            await transaction.chat.update({
              where: { id: input.chatId },
              data: { messageShardId: chat.messageShardId },
            });
          }
        }

        const delegate = this.store(transaction, chat.messageShardId);
        const existing = await delegate.findFirst({
          where: { id: input.id, createdAt: input.createdAt },
          select: messageSelect,
        });

        if (existing) {
          if (
            existing.chatId !== input.chatId ||
            existing.senderId !== input.senderId ||
            existing.text !== input.text ||
            existing.createdAt.getTime() !== input.createdAt.getTime()
          ) {
            throw new MessageConflictError();
          }

          return existing;
        }

        return delegate.create({ data: { ...input }, select: messageSelect });
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new MessageConflictError();
        }

        throw error;
      });
  }

  async history(input: MessageHistoryInput): Promise<StoredMessage[]> {
    return this.main.$transaction(async (transaction) => {
      const chat = await transaction.chat.findFirst({
        where: { id: input.chatId, deletedAt: null },
        select: { id: true, messageShardId: true },
      });

      if (!chat) {
        throw new MessageAccessError();
      }

      await this.requireMember(transaction, input.chatId, input.userId);
      const delegate = this.store(transaction, chat.messageShardId);

      return delegate.findMany({
        where: {
          chatId: input.chatId,
          deletedAt: null,
          ...(input.before
            ? {
                OR: [
                  { createdAt: { lt: input.before.createdAt } },
                  {
                    createdAt: input.before.createdAt,
                    id: { lt: input.before.id },
                  },
                ],
              }
            : {}),
        },
        select: messageSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit,
      });
    });
  }

  moveChat(chatId: string, targetShardId?: string): Promise<MoveChatResult> {
    const shardId = targetShardId ?? this.shards.select(chatId);
    const target = this.shards.get(shardId);

    return this.main.$transaction(
      async (transaction) => {
        const timeout = `${this.shards.settings.migrationTimeoutMs}ms`;
        await transaction.$queryRaw`SELECT set_config('idle_in_transaction_session_timeout', ${timeout}, true)`;
        const chat = await this.lockChat(transaction, chatId);

        if (chat.messageShardId === shardId) {
          return {
            chatId,
            previousShardId: shardId,
            shardId,
            copiedMessages: 0,
          };
        }

        const source = this.store(transaction, chat.messageShardId);
        let copiedMessages = 0;
        const sourceHash = createHash('sha256');

        await target.$transaction(
          async (destination) => {
            await destination.$queryRaw`SELECT set_config('idle_in_transaction_session_timeout', ${timeout}, true)`;
            await destination.storedMessage.deleteMany({ where: { chatId } });
            let last: StoredMessage | undefined;

            while (true) {
              const batch: StoredMessage[] = await source.findMany({
                where: { chatId, ...(last ? positionAfter(last) : {}) },
                select: messageSelect,
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                take: 500,
              });

              if (batch.length === 0) {
                break;
              }

              await destination.storedMessage.createMany({ data: batch });

              for (const message of batch) {
                sourceHash.update(serializeMessage(message));
              }

              copiedMessages += batch.length;
              last = batch[batch.length - 1];
            }

            const destinationHash = createHash('sha256');
            let verifiedMessages = 0;
            last = undefined;

            while (true) {
              const batch: StoredMessage[] =
                await destination.storedMessage.findMany({
                  where: { chatId, ...(last ? positionAfter(last) : {}) },
                  select: messageSelect,
                  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                  take: 500,
                });

              if (batch.length === 0) {
                break;
              }

              for (const message of batch) {
                destinationHash.update(serializeMessage(message));
              }

              verifiedMessages += batch.length;
              last = batch[batch.length - 1];
            }

            if (
              verifiedMessages !== copiedMessages ||
              sourceHash.digest('hex') !== destinationHash.digest('hex')
            ) {
              throw new Error('Message transfer verification failed');
            }
          },
          {
            timeout: this.shards.settings.migrationTimeoutMs,
            maxWait: this.shards.database.connectionTimeoutMillis,
            isolationLevel:
              ShardPrisma.TransactionIsolationLevel.RepeatableRead,
          },
        );

        await transaction.chat.update({
          where: { id: chatId },
          data: { messageShardId: shardId },
        });

        return {
          chatId,
          previousShardId: chat.messageShardId,
          shardId,
          copiedMessages,
        };
      },
      { timeout: this.shards.settings.migrationTimeoutMs },
    );
  }
}

export { PrismaMessageStorageRepository };
