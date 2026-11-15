import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { ChatNotFoundError } from '../domain/chats.errors.js';
import type { ChatMessage, PrivateChat } from '../domain/chats.models.js';
import type {
  IChatsRepository,
  IMessagesRepository,
  CreatePrivateChatInput,
  FindChatsInput,
  FindChatsResult,
  FindMessagesInput,
  FindMessagesResult,
  SendMessageInput,
  SendVoiceMessageInput,
  SaveMessageResult,
  ChangeMessageInput,
  AttachmentData,
} from '../domain/chats.repository.js';

const participantSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  avatarKey: true,
} as const;

const messageSelect = {
  id: true,
  chatId: true,
  text: true,
  senderId: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  readAt: true,
  fileName: true,
  voiceDurationMs: true,
  voiceWaveform: true,
  fileType: true,
  fileSize: true,
  sender: { select: participantSelect },
} as const;

function selectPrivateChat(currentUserId: string) {
  return {
    id: true,
    createdAt: true,
    members: {
      where: {
        userId: { not: currentUserId },
      },
      take: 1,
      select: { user: { select: participantSelect } },
    },
  } satisfies Prisma.ChatSelect;
}

type PrivateChatRow = Prisma.ChatGetPayload<{
  select: ReturnType<typeof selectPrivateChat>;
}>;

type ChatPageRow = {
  id: string | null;
  total: number;
};

function mapMessage(
  message: Prisma.MessageGetPayload<{ select: typeof messageSelect }>,
): ChatMessage {
  return {
    id: message.id,
    chatId: message.chatId,
    text: message.text,
    senderId: message.senderId,
    sender: message.sender,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    readAt: message.readAt,
    attachment: message.fileName
      ? {
          ...(message.voiceDurationMs === null
            ? {}
            : {
                voice: {
                  durationMs: message.voiceDurationMs,
                  waveform: message.voiceWaveform,
                },
              }),
          name: message.fileName,
          mediaType: message.fileType ?? 'application/octet-stream',
          size: message.fileSize ?? 0,
        }
      : null,
  };
}

function mapPrivateChat(chat: PrivateChatRow): PrivateChat | null {
  const recipient = chat.members[0]?.user;

  if (!recipient) {
    return null;
  }

  return { id: chat.id, createdAt: chat.createdAt, recipient };
}

@Injectable()
class PrismaChatsRepository implements IChatsRepository, IMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrFindPrivateChat(
    input: CreatePrivateChatInput,
  ): Promise<PrivateChat | null> {
    const currentUserId = input.currentUserId.toLowerCase();
    const [privateUserAId, privateUserBId] = [
      currentUserId,
      input.recipientId.toLowerCase(),
    ].sort();
    const lockKey = `${privateUserAId}:${privateUserBId}`;
    const select = selectPrivateChat(currentUserId);

    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey})) IS NULL AS "acquired"
        `;

        const activeUsers = await transaction.user.count({
          where: {
            id: { in: [privateUserAId, privateUserBId] },
            deletedAt: null,
          },
        });

        if (activeUsers !== 2) {
          return null;
        }

        const existingChat = await transaction.chat.findFirst({
          where: { privateUserAId, privateUserBId, deletedAt: null },
          select: {
            ...select,
            _count: { select: { members: { where: { deletedAt: null } } } },
          },
        });

        if (existingChat) {
          if (existingChat._count.members !== 2) {
            return null;
          }

          return mapPrivateChat(existingChat);
        }

        const chat = await transaction.chat.create({
          data: {
            privateUserAId,
            privateUserBId,
            members: {
              create: [{ userId: privateUserAId }, { userId: privateUserBId }],
            },
          },
          select,
        });

        return mapPrivateChat(chat);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async findChat(
    chatId: string,
    currentUserId: string,
  ): Promise<PrivateChat | null> {
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        deletedAt: null,
        members: { some: { userId: currentUserId, deletedAt: null } },
      },
      select: selectPrivateChat(currentUserId),
    });

    return chat ? mapPrivateChat(chat) : null;
  }

  async findChats(input: FindChatsInput): Promise<FindChatsResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const { currentUserId, offset, take } = input;
        const page = await transaction.$queryRaw<ChatPageRow[]>`
          WITH eligible AS (
            SELECT chat."id", chat."createdAt"
            FROM "Chat" AS chat
            JOIN "ChatMember" AS membership ON membership."chatId" = chat."id"
            WHERE chat."deletedAt" IS NULL
              AND membership."userId" = ${currentUserId}::uuid
              AND membership."deletedAt" IS NULL
              AND EXISTS (
                SELECT 1
                FROM "ChatMember" AS other
                JOIN "User" AS recipient ON recipient."id" = other."userId"
                WHERE other."chatId" = chat."id"
                  AND other."userId" <> membership."userId"
                  AND other."deletedAt" IS NULL
                  AND recipient."deletedAt" IS NULL
              )
          ), page AS (
            SELECT eligible."id",
                   COALESCE(latest."createdAt", eligible."createdAt") AS activity
            FROM eligible
            LEFT JOIN LATERAL (
              SELECT message."createdAt"
              FROM "Message" AS message
              WHERE message."chatId" = eligible."id" AND message."deletedAt" IS NULL
              ORDER BY message."createdAt" DESC, message."id" DESC
              LIMIT 1
            ) AS latest ON TRUE
            ORDER BY activity DESC, eligible."id" DESC
            LIMIT ${take} OFFSET ${offset}
          )
          SELECT page."id", totals.total
          FROM (SELECT count(*)::int AS total FROM eligible) AS totals
          LEFT JOIN page ON TRUE
          ORDER BY page.activity DESC, page."id" DESC
        `;
        const ids = page.flatMap((row) => (row.id === null ? [] : [row.id]));
        const total = page[0].total;

        if (ids.length === 0) {
          return { items: [], total };
        }

        const chats = await transaction.chat.findMany({
          where: { id: { in: ids } },
          select: {
            ...selectPrivateChat(currentUserId),
            _count: {
              select: {
                messages: {
                  where: {
                    deletedAt: null,
                    readAt: null,
                    senderId: { not: currentUserId },
                  },
                },
              },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: messageSelect,
            },
          },
        });

        const chatsById = new Map(chats.map((chat) => [chat.id, chat]));
        const items = ids.map((id) => {
          const row = chatsById.get(id);
          const chat = row && mapPrivateChat(row);

          if (!row || !chat) {
            throw new Error(`Could not load eligible private chat ${id}`);
          }

          const latest = row.messages[0];

          return {
            id: chat.id,
            recipient: chat.recipient,
            lastMessage: latest ? mapMessage(latest) : null,
            lastActivityAt: latest?.createdAt ?? chat.createdAt,
            unreadCount: row._count.messages,
          };
        });

        return { items, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async isActiveMember(chatId: string, userId: string): Promise<boolean> {
    const chat = await this.prisma.chat.findFirst({
      where: {
        id: chatId,
        deletedAt: null,
        members: {
          some: { userId, deletedAt: null },
        },
      },
      select: { id: true },
    });

    return chat !== null;
  }

  async sendMessage(input: SendMessageInput): Promise<ChatMessage> {
    return (await this.persistMessage(input)).message;
  }

  sendVoiceMessage(input: SendVoiceMessageInput): Promise<SaveMessageResult> {
    return this.persistMessage(input, input);
  }

  private persistMessage(
    input: SendMessageInput,
    voice?: SendVoiceMessageInput,
  ): Promise<SaveMessageResult> {
    return this.prisma.$transaction(async (transaction) => {
      const [membership] = await transaction.$queryRaw<{ id: string }[]>`
        SELECT chat."id"
        FROM "Chat" AS chat
        JOIN "ChatMember" AS membership ON membership."chatId" = chat."id"
        WHERE chat."id" = ${input.chatId}::uuid
          AND chat."deletedAt" IS NULL
          AND membership."userId" = ${input.senderId}::uuid
          AND membership."deletedAt" IS NULL
        FOR UPDATE OF chat, membership
      `;

      if (!membership) {
        throw new ChatNotFoundError();
      }

      if (voice) {
        const existing = await transaction.message.findUnique({
          where: {
            chatId_senderId_voiceRequestId: {
              chatId: input.chatId,
              senderId: input.senderId,
              voiceRequestId: voice.id,
            },
          },
          select: messageSelect,
        });

        if (existing) {
          if (existing.deletedAt) {
            throw new ChatNotFoundError();
          }

          return { message: mapMessage(existing), created: false };
        }
      }

      // A later send must sort ahead of the previous message even within one millisecond.
      const [activity] = await transaction.$queryRaw<{ activityAt: Date }[]>`
        SELECT GREATEST(
          clock_timestamp()::timestamptz(3),
          (
            SELECT "createdAt" + interval '1 millisecond'
            FROM "Message"
            WHERE "chatId" = ${input.chatId}::uuid
            ORDER BY "createdAt" DESC, "id" DESC
            LIMIT 1
          )
        ) AS "activityAt"
      `;

      if (!activity) {
        throw new Error('Could not determine chat activity time');
      }

      const message = await transaction.message.create({
        data: {
          chatId: input.chatId,
          senderId: input.senderId,
          text: input.text,
          ...(input.file
            ? {
                fileName: input.file.name,
                fileType: input.file.mediaType,
                fileSize: input.file.size,
                fileKey: input.file.key,
              }
            : {}),
          ...(voice
            ? {
                voiceRequestId: voice.id,
                voiceDurationMs: voice.voice.durationMs,
                voiceWaveform: voice.voice.waveform,
              }
            : {}),
          createdAt: activity.activityAt,
        },
        select: messageSelect,
      });

      await transaction.chat.update({
        where: { id: input.chatId },
        data: { updatedAt: activity.activityAt },
      });

      return { message: mapMessage(message), created: true };
    });
  }

  async findAttachment(
    chatId: string,
    messageId: string,
  ): Promise<AttachmentData | null> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, chatId, deletedAt: null },
      select: { fileName: true, fileType: true, fileData: true, fileKey: true },
    });

    if (!message?.fileName || (!message.fileData && !message.fileKey)) {
      return null;
    }

    return {
      name: message.fileName,
      mediaType: message.fileType ?? 'application/octet-stream',
      key: message.fileKey,
      legacyBytes: message.fileData,
    };
  }

  async changeMessage(input: ChangeMessageInput): Promise<ChatMessage | null> {
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.message.updateMany({
        where: {
          id: input.messageId,
          chatId: input.chatId,
          senderId: input.userId,
          deletedAt: null,
          chat: {
            deletedAt: null,
            members: { some: { userId: input.userId, deletedAt: null } },
          },
        },
        data:
          input.text === null
            ? { deletedAt: new Date() }
            : { text: input.text, editedAt: new Date() },
      });

      if (!changed.count) {
        return null;
      }

      const message = await transaction.message.findUniqueOrThrow({
        where: { id: input.messageId },
        select: messageSelect,
      });

      return mapMessage(message);
    });
  }

  async markRead(
    chatId: string,
    userId: string,
    throughMessageId: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const boundary = await transaction.message.findFirst({
        where: { id: throughMessageId, chatId, deletedAt: null },
        select: { createdAt: true, id: true },
      });

      if (!boundary) {
        return false;
      }

      const result = await transaction.message.updateMany({
        where: {
          chatId,
          senderId: { not: userId },
          deletedAt: null,
          readAt: null,
          chat: {
            deletedAt: null,
            members: { some: { userId, deletedAt: null } },
          },
          OR: [
            { createdAt: { lt: boundary.createdAt } },
            { createdAt: boundary.createdAt, id: { lte: boundary.id } },
          ],
        },
        data: { readAt: new Date() },
      });

      return result.count > 0;
    });
  }

  async findMessages(input: FindMessagesInput): Promise<FindMessagesResult> {
    const cursorFilter = input.cursor
      ? {
          OR: [
            { createdAt: { lt: input.cursor.createdAt } },
            {
              createdAt: input.cursor.createdAt,
              id: { lt: input.cursor.id },
            },
          ],
        }
      : {};

    const messages = await this.prisma.message.findMany({
      where: {
        chatId: input.chatId,
        deletedAt: null,
        ...cursorFilter,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.take + 1,
      select: messageSelect,
    });

    const hasMore = messages.length > input.take;
    const page = hasMore ? messages.slice(0, input.take) : messages;

    return {
      items: page.map(mapMessage),
      hasMore,
    };
  }
}

export { PrismaChatsRepository };
