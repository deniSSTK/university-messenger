import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import {
  ChatNotFoundError,
  ChatParticipantNotFoundError,
} from '../domain/chats.errors.js';
import type {
  ChatListItem,
  ChatMessage,
  ChatParticipant,
  PrivateChat,
} from '../domain/chats.models.js';
import type {
  IChatsRepository,
  IMessagesRepository,
  CreatePrivateChatInput,
  FindChatsInput,
  FindChatsResult,
  FindMessagesInput,
  FindMessagesResult,
  SendMessageInput,
} from '../domain/chats.repository.js';

const participantSelect = {
  id: true,
  username: true,
  displayName: true,
} as const;

const messageSelect = {
  id: true,
  text: true,
  senderId: true,
  createdAt: true,
  editedAt: true,
  sender: { select: participantSelect },
} as const;

function mapParticipant(participant: ChatParticipant): ChatParticipant {
  return {
    id: participant.id,
    username: participant.username,
    displayName: participant.displayName,
  };
}

function mapMessage(message: {
  id: string;
  text: string;
  senderId: string;
  createdAt: Date;
  editedAt: Date | null;
  sender: ChatParticipant;
}): ChatMessage {
  return {
    id: message.id,
    text: message.text,
    senderId: message.senderId,
    sender: mapParticipant(message.sender),
    createdAt: message.createdAt,
    editedAt: message.editedAt,
  };
}

function mapPrivateChat(chat: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  members: { user: ChatParticipant }[];
}): PrivateChat {
  return {
    id: chat.id,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    participants: chat.members.map((member) => mapParticipant(member.user)),
  };
}

@Injectable()
class PrismaChatsRepository implements IChatsRepository, IMessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrFindPrivateChat(
    input: CreatePrivateChatInput,
  ): Promise<PrivateChat> {
    const userIds = [
      input.currentUserId.toLowerCase(),
      input.recipientId.toLowerCase(),
    ].sort();
    const lockKey = `${userIds[0]}:${userIds[1]}`;

    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw<{ acquired: boolean }[]>`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey})) IS NULL AS "acquired"
        `;

        const activeUsers = await transaction.user.count({
          where: {
            id: { in: userIds },
            deletedAt: null,
          },
        });

        if (activeUsers !== 2) {
          throw new ChatParticipantNotFoundError();
        }

        const existingChats = await transaction.chat.findMany({
          where: {
            deletedAt: null,
            AND: userIds.map((userId) => ({
              members: {
                some: { userId, deletedAt: null },
              },
            })),
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            members: {
              where: { deletedAt: null },
              select: { user: { select: participantSelect } },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });

        const existingChat = existingChats.find(
          (chat) =>
            chat.members.length === 2 &&
            userIds.every((userId) =>
              chat.members.some((member) => member.user.id === userId),
            ),
        );

        if (existingChat) {
          return mapPrivateChat(existingChat);
        }

        const chat = await transaction.chat.create({
          data: {
            members: {
              create: userIds.map((userId) => ({ userId })),
            },
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            members: {
              select: { user: { select: participantSelect } },
            },
          },
        });

        return mapPrivateChat(chat);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async findChats(input: FindChatsInput): Promise<FindChatsResult> {
    const where = {
      deletedAt: null,
      AND: [
        {
          members: {
            some: { userId: input.currentUserId, deletedAt: null },
          },
        },
        {
          members: {
            some: {
              userId: { not: input.currentUserId },
              deletedAt: null,
              user: { deletedAt: null },
            },
          },
        },
      ],
    };

    const [chats, total] = await this.prisma.$transaction(
      [
        this.prisma.chat.findMany({
          where,
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            members: {
              where: {
                deletedAt: null,
                user: { deletedAt: null },
              },
              select: { user: { select: participantSelect } },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: messageSelect,
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          skip: input.offset,
          take: input.take,
        }),
        this.prisma.chat.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const items = chats.map((chat): ChatListItem => {
      const recipient = chat.members.find(
        (member) => member.user.id !== input.currentUserId,
      );

      if (!recipient) {
        throw new Error(`Private chat ${chat.id} has no other active member`);
      }

      const lastMessage = chat.messages[0]
        ? mapMessage(chat.messages[0])
        : null;

      return {
        id: chat.id,
        recipient: mapParticipant(recipient.user),
        lastMessage,
        lastActivityAt: lastMessage?.createdAt ?? chat.updatedAt,
      };
    });

    return { items, total };
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
    return this.prisma.$transaction(async (transaction) => {
      const chats = await transaction.chat.updateMany({
        where: { id: input.chatId, deletedAt: null },
        data: { updatedAt: new Date() },
      });

      if (chats.count === 0) {
        throw new ChatNotFoundError();
      }

      const membership = await transaction.chatMember.findUnique({
        where: {
          chatId_userId: {
            chatId: input.chatId,
            userId: input.senderId,
          },
        },
        select: { deletedAt: true },
      });

      if (!membership || membership.deletedAt) {
        throw new ChatNotFoundError();
      }

      const [activity] = await transaction.$queryRaw<
        { activityAt: Date }[]
      >`SELECT clock_timestamp() AS "activityAt"`;

      if (!activity) {
        throw new Error('Could not determine chat activity time');
      }

      const message = await transaction.message.create({
        data: {
          chatId: input.chatId,
          senderId: input.senderId,
          text: input.text,
          createdAt: activity.activityAt,
        },
        select: messageSelect,
      });

      await transaction.chat.update({
        where: { id: input.chatId },
        data: { updatedAt: activity.activityAt },
      });

      return mapMessage(message);
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
