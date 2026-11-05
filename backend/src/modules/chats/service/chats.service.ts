import {
  CannotCreateChatWithSelfError,
  ChatNotFoundError,
  ChatParticipantNotFoundError,
  InvalidMessageCursorError,
  InvalidMessageTextError,
} from '../domain/chats.errors.js';
import { MESSAGE_TEXT_MAX_LENGTH } from '../domain/chats.constants.js';
import type {
  IChatsRepository,
  IMessagesRepository,
} from '../domain/chats.repository.js';
import type { ChatMessage, MessageCursor } from '../domain/chats.models.js';
import type {
  CreateChatInput,
  ChatDetailsResult,
  ListChatMessagesInput,
  ListChatMessagesResult,
  ListChatsInput,
  ListChatsResult,
  SendChatMessageInput,
} from './chats.types.js';

const CURSOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function decodeCursor(cursor: string | undefined): MessageCursor | null {
  if (cursor === undefined) {
    return null;
  }

  if (!/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) {
    throw new InvalidMessageCursorError();
  }

  let decoded: unknown;

  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidMessageCursorError();
  }

  if (
    !decoded ||
    typeof decoded !== 'object' ||
    !('createdAt' in decoded) ||
    typeof decoded.createdAt !== 'string' ||
    !('id' in decoded) ||
    typeof decoded.id !== 'string' ||
    !CURSOR_ID_PATTERN.test(decoded.id)
  ) {
    throw new InvalidMessageCursorError();
  }

  const createdAt = new Date(decoded.createdAt);

  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== decoded.createdAt
  ) {
    throw new InvalidMessageCursorError();
  }

  return { createdAt, id: decoded.id };
}

function encodeCursor(cursor: MessageCursor): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt.toISOString(),
      id: cursor.id,
    }),
  ).toString('base64url');
}

class ChatsService {
  constructor(
    private readonly chatsRepository: IChatsRepository,
    private readonly messagesRepository: IMessagesRepository,
  ) {}

  async createChat(input: CreateChatInput): Promise<ChatDetailsResult> {
    if (input.currentUserId.toLowerCase() === input.recipientId.toLowerCase()) {
      throw new CannotCreateChatWithSelfError();
    }

    const chat = await this.chatsRepository.createOrFindPrivateChat(input);

    if (!chat) {
      throw new ChatParticipantNotFoundError();
    }

    return chat;
  }

  async getChat(
    chatId: string,
    currentUserId: string,
  ): Promise<ChatDetailsResult> {
    const chat = await this.chatsRepository.findChat(chatId, currentUserId);

    if (!chat) {
      throw new ChatNotFoundError();
    }

    return chat;
  }

  async listChats(input: ListChatsInput): Promise<ListChatsResult> {
    const result = await this.chatsRepository.findChats({
      currentUserId: input.currentUserId,
      offset: (input.page - 1) * input.limit,
      take: input.limit,
    });

    return {
      items: result.items,
      page: input.page,
      limit: input.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / input.limit),
    };
  }

  async sendMessage(input: SendChatMessageInput): Promise<ChatMessage> {
    if (
      !/\S/u.test(input.text) ||
      [...input.text].length > MESSAGE_TEXT_MAX_LENGTH
    ) {
      throw new InvalidMessageTextError();
    }

    const isMember = await this.chatsRepository.isActiveMember(
      input.chatId,
      input.senderId,
    );

    if (!isMember) {
      throw new ChatNotFoundError();
    }

    return this.messagesRepository.sendMessage(input);
  }

  async listMessages(
    input: ListChatMessagesInput,
  ): Promise<ListChatMessagesResult> {
    const result = await this.messagesRepository.findMessages({
      chatId: input.chatId,
      cursor: decodeCursor(input.cursor),
      take: input.limit,
    });
    const lastMessage = result.items.at(-1);
    const nextCursor =
      result.hasMore && lastMessage
        ? encodeCursor({
            createdAt: lastMessage.createdAt,
            id: lastMessage.id,
          })
        : null;

    return {
      items: result.items,
      nextCursor,
    };
  }

  async isActiveMember(chatId: string, userId: string): Promise<boolean> {
    return this.chatsRepository.isActiveMember(chatId, userId);
  }
}

export { ChatsService };
