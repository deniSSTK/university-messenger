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

import {
  GIF_TYPE,
  PHOTO_TYPES,
  mediaCategory,
} from '../domain/shared-media.js';
import type { MediaCategory, MediaCounts } from '../domain/shared-media.js';

import type {
  ReactionCount,
  ReactionState,
  ReactionType,
} from '@university-messenger/events';
import type {
  SetReactionInput,
  ReactionSnapshot,
} from '../domain/message-reactions.js';

const sharedAttachment: Prisma.AttachmentWhereInput = {
  fileName: { not: null },
  OR: [{ fileKey: { not: null } }, { fileData: { not: null } }],
};
const photos: Prisma.AttachmentWhereInput = {
  fileType: { in: PHOTO_TYPES, mode: 'insensitive' },
};
const gifs: Prisma.AttachmentWhereInput = {
  fileType: { equals: GIF_TYPE, mode: 'insensitive' },
};
const videos: Prisma.AttachmentWhereInput = {
  fileType: { startsWith: 'video/', mode: 'insensitive' },
};
const audio: Prisma.AttachmentWhereInput = {
  fileType: { startsWith: 'audio/', mode: 'insensitive' },
};
const mediaFilters: Record<MediaCategory, Prisma.AttachmentWhereInput> = {
  photos,
  gifs,
  videos,
  audio,
  voice: {},
  files: { OR: [{ fileType: null }, { NOT: [photos, gifs, videos, audio] }] },
};

const participantSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  avatarKey: true,
} as const;

const messageSelect = {
  reactionVersion: true,
  id: true,
  chatId: true,
  text: true,
  senderId: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  readAt: true,
  attachment: {
    select: {
      fileName: true,
      fileType: true,
      fileSize: true,
      voice: { select: { durationMs: true, waveform: true } },
    },
  },
  sender: { select: participantSelect },
  replyTo: {
    select: {
      id: true,
      chatId: true,
      deletedAt: true,
      createdAt: true,
      text: true,
      sender: { select: { id: true, displayName: true } },
      attachment: { select: { type: true, fileName: true, fileType: true } },
    },
  },
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
  lastMessageId: string | null;
  unreadCount: number;
};

function mapMessage(
  message: Prisma.MessageGetPayload<{ select: typeof messageSelect }>,
  reactionState?: ReactionState,
  clearedThrough?: Date | null,
): ChatMessage {
  const file = message.attachment;
  const reply = message.replyTo;
  const visibleReply =
    reply &&
    reply.chatId === message.chatId &&
    !reply.deletedAt &&
    (!clearedThrough || reply.createdAt > clearedThrough);

  return {
    id: message.id,
    chatId: message.chatId,
    text: message.text,
    senderId: message.senderId,
    sender: message.sender,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    readAt: message.readAt,
    ...(reply && clearedThrough !== undefined
      ? {
          reply: {
            id: reply.id,
            author: visibleReply ? reply.sender : null,
            preview: visibleReply
              ? [...replyPreviewText(reply.text, reply.attachment).trim()]
                  .slice(0, 160)
                  .join('')
              : '',
          },
        }
      : {}),
    ...(reactionState
      ? { reactionState }
      : message.reactionVersion === 0
        ? {
            reactionState: {
              reactionVersion: 0,
              reactions: [],
              myReaction: null,
            },
          }
        : {}),
    attachment: file?.fileName
      ? {
          name: file.fileName,
          mediaType: file.fileType ?? 'application/octet-stream',
          size: file.fileSize ?? 0,
          ...(file.voice ? { voice: file.voice } : {}),
        }
      : null,
  };
}

function replyPreviewText(
  text: string,
  file: {
    type: string;
    fileName: string | null;
    fileType: string | null;
  } | null,
): string {
  if (!file) {
    return text;
  }

  if (file.type === 'VOICE') {
    return 'Голосове повідомлення';
  }

  if (file.fileType?.startsWith('image/')) {
    return 'Фото';
  }

  if (file.fileType?.startsWith('video/')) {
    return 'Відео';
  }

  return file.fileName ?? 'Файл';
}

function mapPrivateChat(chat: PrivateChatRow): PrivateChat | null {
  const recipient = chat.members[0]?.user;

  if (!recipient) {
    return null;
  }

  return { id: chat.id, createdAt: chat.createdAt, recipient };
}

async function visibleHistory(
  database: Prisma.TransactionClient,
  chatId: string,
  userId: string,
): Promise<{ createdAt?: { gt: Date } }> {
  const membership = await database.chatMember.findFirst({
    where: { chatId, userId, deletedAt: null, chat: { deletedAt: null } },
    select: { historyClearedThrough: true },
  });

  if (!membership) {
    throw new ChatNotFoundError();
  }

  return membership.historyClearedThrough
    ? { createdAt: { gt: membership.historyClearedThrough } }
    : {};
}

async function reactionStates(
  database: Prisma.TransactionClient,
  messages: { id: string; reactionVersion: number }[],
  userId: string,
): Promise<Map<string, ReactionState>> {
  const states = new Map<string, ReactionState>(
    messages.map(({ id, reactionVersion }) => [
      id,
      { reactionVersion, reactions: [], myReaction: null },
    ]),
  );
  const reacted = messages.filter(({ reactionVersion }) => reactionVersion > 0);

  if (!reacted.length) {
    return states;
  }

  const rows = await database.$queryRaw<
    {
      messageId: string;
      type: ReactionType;
      count: number;
      mine: boolean;
    }[]
  >`
    SELECT "messageId", "type", count(*)::int AS count, bool_or("userId" = ${userId}::uuid) AS mine
    FROM "MessageReaction"
    WHERE "messageId" IN (${Prisma.join(reacted.map(({ id }) => Prisma.sql`${id}::uuid`))})
    GROUP BY "messageId", "type"
  `;

  for (const row of rows) {
    const state = states.get(row.messageId);

    if (state) {
      state.reactions.push({ type: row.type, count: row.count });

      if (row.mine) {
        state.myReaction = row.type;
      }
    }
  }

  return states;
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

          await transaction.chatMember.updateMany({
            where: {
              chatId: existingChat.id,
              userId: currentUserId,
              deletedAt: null,
              hiddenAt: { not: null },
            },
            data: { hiddenAt: null },
          });

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
            SELECT chat."id", chat."createdAt", membership."historyClearedThrough"
            FROM "Chat" AS chat
            JOIN "ChatMember" AS membership ON membership."chatId" = chat."id"
            WHERE chat."deletedAt" IS NULL
              AND membership."userId" = ${currentUserId}::uuid
              AND membership."deletedAt" IS NULL
              AND membership."hiddenAt" IS NULL
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
            SELECT eligible."id", eligible."historyClearedThrough", latest."id" AS "lastMessageId",
                   COALESCE(latest."createdAt", eligible."createdAt") AS activity
            FROM eligible
            LEFT JOIN LATERAL (
              SELECT message."id", message."createdAt"
              FROM "Message" AS message
              WHERE message."chatId" = eligible."id" AND message."deletedAt" IS NULL
                AND message."createdAt" > COALESCE(eligible."historyClearedThrough", '-infinity'::timestamptz)
              ORDER BY message."createdAt" DESC, message."id" DESC
              LIMIT 1
            ) AS latest ON TRUE
            ORDER BY activity DESC, eligible."id" DESC
            LIMIT ${take} OFFSET ${offset}
          )
          SELECT page."id", totals.total, page."lastMessageId",
                 (
                   SELECT count(*)::int
                   FROM "Message" AS unread
                   WHERE unread."chatId" = page."id"
                     AND unread."deletedAt" IS NULL
                     AND unread."readAt" IS NULL
                     AND unread."senderId" <> ${currentUserId}::uuid
                     AND unread."createdAt" > COALESCE(page."historyClearedThrough", '-infinity'::timestamptz)
                 ) AS "unreadCount"
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
          select: selectPrivateChat(currentUserId),
        });
        const latestIds = page.flatMap((row) =>
          row.lastMessageId ? [row.lastMessageId] : [],
        );
        const latestMessages = await transaction.message.findMany({
          where: { id: { in: latestIds } },
          select: messageSelect,
        });
        const latestById = new Map(
          latestMessages.map((message) => [message.id, message]),
        );
        const chatsById = new Map(chats.map((chat) => [chat.id, chat]));
        const items = page.flatMap(({ id, lastMessageId, unreadCount }) => {
          if (!id) {
            return [];
          }

          const row = chatsById.get(id);
          const chat = row && mapPrivateChat(row);

          if (!chat) {
            throw new Error(`Could not load eligible private chat ${id}`);
          }

          const latest = lastMessageId
            ? latestById.get(lastMessageId)
            : undefined;

          return [
            {
              id: chat.id,
              recipient: chat.recipient,
              lastMessage: latest ? mapMessage(latest) : null,
              lastActivityAt: latest?.createdAt ?? chat.createdAt,
              unreadCount,
            },
          ];
        });

        return { items, total };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async hideChat(chatId: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const [chat] = await transaction.$queryRaw<{ id: string }[]>`
        SELECT chat."id"
        FROM "Chat" AS chat
        JOIN "ChatMember" AS member ON member."chatId" = chat."id"
        WHERE chat."id" = ${chatId}::uuid AND chat."deletedAt" IS NULL
          AND member."userId" = ${userId}::uuid AND member."deletedAt" IS NULL
        FOR UPDATE OF chat
      `;

      if (!chat) {
        return false;
      }

      const latest = await transaction.message.findFirst({
        where: { chatId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true },
      });
      const result = await transaction.chatMember.updateMany({
        where: { chatId, userId, deletedAt: null },
        data: {
          hiddenAt: new Date(),
          historyClearedThrough: latest?.createdAt ?? null,
        },
      });

      return result.count > 0;
    });
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
      const [membership] = await transaction.$queryRaw<
        { historyClearedThrough: Date | null }[]
      >`
        SELECT membership."historyClearedThrough"
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
          if (
            existing.deletedAt ||
            (membership.historyClearedThrough &&
              existing.createdAt <= membership.historyClearedThrough)
          ) {
            throw new ChatNotFoundError();
          }

          return {
            message: mapMessage(
              existing,
              undefined,
              membership.historyClearedThrough,
            ),
            created: false,
          };
        }
      }

      if (input.replyToId) {
        const [target] = await transaction.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Message"
          WHERE "id" = ${input.replyToId}::uuid AND "chatId" = ${input.chatId}::uuid
            AND "deletedAt" IS NULL
            AND (${membership.historyClearedThrough}::timestamptz IS NULL
              OR "createdAt" > ${membership.historyClearedThrough}::timestamptz)
          FOR SHARE
        `;

        if (!target) {
          throw new ChatNotFoundError();
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
          chat: { connect: { id: input.chatId } },
          sender: { connect: { id: input.senderId } },
          text: input.text,
          ...(input.file
            ? {
                attachment: {
                  create: {
                    type: voice ? ('VOICE' as const) : ('FILE' as const),
                    fileName: input.file.name,
                    fileType: input.file.mediaType,
                    fileSize: input.file.size,
                    fileKey: input.file.key,
                    createdAt: activity.activityAt,
                    ...(voice ? { voice: { create: voice.voice } } : {}),
                  },
                },
              }
            : {}),
          ...(voice ? { voiceRequestId: voice.id } : {}),
          ...(input.replyToId
            ? { replyTo: { connect: { id: input.replyToId } } }
            : {}),
          createdAt: activity.activityAt,
        },
        select: messageSelect,
      });

      await transaction.chat.update({
        where: { id: input.chatId },
        data: { updatedAt: activity.activityAt },
      });

      await transaction.chatMember.updateMany({
        where: {
          chatId: input.chatId,
          deletedAt: null,
          hiddenAt: { not: null },
        },
        data: { hiddenAt: null },
      });

      return {
        message: mapMessage(
          message,
          undefined,
          membership.historyClearedThrough,
        ),
        created: true,
      };
    });
  }

  async findAttachment(
    chatId: string,
    messageId: string,
    userId: string,
  ): Promise<AttachmentData | null> {
    const visible = await visibleHistory(this.prisma, chatId, userId);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, chatId, deletedAt: null, ...visible },
      select: {
        attachment: {
          select: {
            fileName: true,
            fileType: true,
            fileData: true,
            fileKey: true,
          },
        },
      },
    });
    const file = message?.attachment;

    if (!file?.fileName || (!file.fileData && !file.fileKey)) {
      return null;
    }

    return {
      name: file.fileName,
      mediaType: file.fileType ?? 'application/octet-stream',
      key: file.fileKey,
      legacyBytes: file.fileData,
    };
  }

  async setReaction(input: SetReactionInput): Promise<ReactionSnapshot> {
    return this.prisma.$transaction(async (transaction) => {
      const { chatId, messageId, userId, type } = input;
      const [message] = await transaction.$queryRaw<
        { createdAt: Date; reactionVersion: number }[]
      >`
        SELECT message."createdAt", message."reactionVersion"
        FROM "Message" AS message
        JOIN "Chat" AS chat ON chat."id" = message."chatId"
        JOIN "ChatMember" AS member ON member."chatId" = chat."id"
        WHERE message."id" = ${messageId}::uuid AND chat."id" = ${chatId}::uuid
          AND chat."deletedAt" IS NULL AND message."deletedAt" IS NULL
          AND member."userId" = ${userId}::uuid AND member."deletedAt" IS NULL
          AND (member."historyClearedThrough" IS NULL OR message."createdAt" > member."historyClearedThrough")
        FOR UPDATE OF chat, message, member
      `;

      if (!message) {
        throw new ChatNotFoundError();
      }

      const key = { userId, messageId };
      const previous = await transaction.messageReaction.findUnique({
        where: { userId_messageId: key },
        select: { type: true },
      });
      const changed = (previous?.type ?? null) !== type;

      if (changed) {
        if (type === null) {
          await transaction.messageReaction.delete({
            where: { userId_messageId: key },
          });
        } else {
          await transaction.messageReaction.upsert({
            where: { userId_messageId: key },
            create: { ...key, type },
            update: { type },
          });
        }

        await transaction.message.update({
          where: { id: messageId },
          data: { reactionVersion: { increment: 1 } },
        });
      }

      const selections = await transaction.messageReaction.findMany({
        where: { messageId },
        select: { userId: true, type: true },
      });
      const counts = new Map<ReactionType, number>();

      for (const selection of selections) {
        counts.set(selection.type, (counts.get(selection.type) ?? 0) + 1);
      }

      const reactions: ReactionCount[] = [...counts].map(([type, count]) => ({
        type,
        count,
      }));
      const recipients = changed
        ? (
            await transaction.chatMember.findMany({
              where: {
                chatId,
                deletedAt: null,
                OR: [
                  { historyClearedThrough: null },
                  { historyClearedThrough: { lt: message.createdAt } },
                ],
              },
              select: { userId: true },
            })
          ).map(({ userId }) => userId)
        : [];

      return {
        reactionVersion: message.reactionVersion + Number(changed),
        reactions,
        selections,
        recipients,
        changed,
      };
    });
  }

  async changeMessage(input: ChangeMessageInput): Promise<ChatMessage | null> {
    return this.prisma.$transaction(async (transaction) => {
      const visible = await visibleHistory(
        transaction,
        input.chatId,
        input.userId,
      );
      const changed = await transaction.message.updateMany({
        where: {
          id: input.messageId,
          chatId: input.chatId,
          senderId: input.userId,
          deletedAt: null,
          ...visible,
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

      if (input.text === null) {
        await transaction.messageReaction.deleteMany({
          where: { messageId: input.messageId },
        });

        return mapMessage(message);
      }

      const reactions = await reactionStates(
        transaction,
        [message],
        input.userId,
      );

      return mapMessage(
        message,
        reactions.get(message.id),
        visible.createdAt?.gt ?? null,
      );
    });
  }

  async markRead(
    chatId: string,
    userId: string,
    throughMessageId: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const visible = await visibleHistory(transaction, chatId, userId);
      const boundary = await transaction.message.findFirst({
        where: { id: throughMessageId, chatId, deletedAt: null, ...visible },
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
          ...visible,
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

  async countMedia(chatId: string, userId: string): Promise<MediaCounts> {
    const rows = await this.prisma.$transaction(
      async (transaction) => {
        const visible = await visibleHistory(transaction, chatId, userId);

        return transaction.attachment.groupBy({
          by: ['type', 'fileType'],
          where: {
            ...sharedAttachment,
            message: { chatId, deletedAt: null, ...visible },
          },
          _count: { _all: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const counts: MediaCounts = {
      photos: 0,
      videos: 0,
      files: 0,
      audio: 0,
      voice: 0,
      gifs: 0,
    };

    for (const row of rows) {
      const category =
        row.type === 'VOICE' ? 'voice' : mediaCategory(row.fileType);
      counts[category] += row._count._all;
    }

    return counts;
  }

  async findMessages(input: FindMessagesInput): Promise<FindMessagesResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        const visible = await visibleHistory(
          transaction,
          input.chatId,
          input.userId,
        );
        const category = input.category;
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

        const messages = await transaction.message.findMany({
          where: {
            chatId: input.chatId,
            deletedAt: null,
            ...visible,
            ...cursorFilter,
            ...(input.messageId ? { id: input.messageId } : {}),
            ...(category
              ? {
                  attachment: {
                    AND: [sharedAttachment, mediaFilters[category]],
                    type: category === 'voice' ? 'VOICE' : 'FILE',
                  },
                }
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: input.take + 1,
          select: messageSelect,
        });

        const hasMore = messages.length > input.take;
        const page = hasMore ? messages.slice(0, input.take) : messages;

        const states = await reactionStates(transaction, page, input.userId);

        return {
          items: page.map((message) =>
            mapMessage(
              message,
              states.get(message.id),
              visible.createdAt?.gt ?? null,
            ),
          ),
          hasMore,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

export { PrismaChatsRepository };
