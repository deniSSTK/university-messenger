import { WebSocketEventType } from '@university-messenger/events';
import { randomUUID } from 'node:crypto';
import type { ObjectStorage } from '../../media/domain/object-storage.port.js';
import { MediaUnavailableError } from '../../media/domain/object-storage.port.js';
import { avatarUrl } from '../../../common/utils/avatar-url.js';
import type { ChatParticipant } from '../domain/chats.models.js';
import type { ChangeChatMessageInput } from './chats.types.js';
import type { VoiceAudio } from '../domain/voice-audio.port.js';
import type {
  SendFileInput,
  SendVoiceInput,
  FileResult,
} from './chats.types.js';
import type { ChatEventsPort } from '../domain/chat-events.port.js';
import {
  CannotCreateChatWithSelfError,
  ChatNotFoundError,
  ChatParticipantNotFoundError,
  InvalidMessageCursorError,
  InvalidMessageTextError,
  InvalidVoiceAudioError,
} from '../domain/chats.errors.js';
import { MESSAGE_TEXT_MAX_LENGTH } from '../domain/chats.constants.js';
import type {
  IChatsRepository,
  IMessagesRepository,
  SaveMessageResult,
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

import type { ReactionState } from '@university-messenger/events';
import type { SetReactionInput } from '../domain/message-reactions.js';

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
    private readonly events: ChatEventsPort = { publish: () => {} },
    private readonly storage?: ObjectStorage,
    private readonly voiceAudio?: VoiceAudio,
  ) {}

  async createChat(input: CreateChatInput): Promise<ChatDetailsResult> {
    if (input.currentUserId.toLowerCase() === input.recipientId.toLowerCase()) {
      throw new CannotCreateChatWithSelfError();
    }

    const chat = await this.chatsRepository.createOrFindPrivateChat(input);

    if (!chat) {
      throw new ChatParticipantNotFoundError();
    }

    this.events.publish({ type: WebSocketEventType.Changed, chatId: chat.id });

    return { ...chat, recipient: await this.presentPerson(chat.recipient) };
  }

  async getChat(
    chatId: string,
    currentUserId: string,
  ): Promise<ChatDetailsResult> {
    const chat = await this.chatsRepository.findChat(chatId, currentUserId);

    if (!chat) {
      throw new ChatNotFoundError();
    }

    return { ...chat, recipient: await this.presentPerson(chat.recipient) };
  }

  async listChats(input: ListChatsInput): Promise<ListChatsResult> {
    const result = await this.chatsRepository.findChats({
      currentUserId: input.currentUserId,
      offset: (input.page - 1) * input.limit,
      take: input.limit,
    });

    return {
      items: await Promise.all(
        result.items.map(async (chat) => ({
          ...chat,
          recipient: await this.presentPerson(chat.recipient),
          lastMessage: chat.lastMessage
            ? await this.presentMessage(chat.lastMessage)
            : null,
        })),
      ),
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

    const message = await this.messagesRepository.sendMessage(input);
    this.events.publish({
      type: WebSocketEventType.Changed,
      chatId: input.chatId,
    });

    return this.presentMessage(message);
  }

  async sendFile(input: SendFileInput): Promise<ChatMessage> {
    const name = input.name.trim();

    if (
      !name ||
      [...name].length > 255 ||
      [...name].some(
        (character) =>
          character.charCodeAt(0) < 32 ||
          character === '/' ||
          character === '\\',
      ) ||
      input.bytes.length < 1 ||
      input.bytes.length > 5242880 ||
      !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(input.mediaType)
    ) {
      throw new InvalidMessageTextError();
    }

    if (!(await this.isActiveMember(input.chatId, input.senderId))) {
      throw new ChatNotFoundError();
    }

    return this.storeAttachment(
      input.chatId,
      input.mediaType,
      input.bytes,
      async (key) => ({
        message: await this.messagesRepository.sendMessage({
          chatId: input.chatId,
          senderId: input.senderId,
          text: name,
          file: {
            name,
            mediaType: input.mediaType,
            size: input.bytes.length,
            key,
          },
        }),
        created: true,
      }),
    );
  }

  async sendVoice(input: SendVoiceInput): Promise<ChatMessage> {
    if (!(await this.isActiveMember(input.chatId, input.senderId))) {
      throw new ChatNotFoundError();
    }

    if (input.bytes.length < 1 || input.bytes.length > 5242880) {
      throw new InvalidVoiceAudioError();
    }

    if (!this.storage || !this.voiceAudio) {
      throw new MediaUnavailableError();
    }

    const audio = await this.voiceAudio.prepare(input.bytes, input.mediaType);

    return this.storeAttachment(
      input.chatId,
      audio.mediaType,
      audio.bytes,
      (key) =>
        this.messagesRepository.sendVoiceMessage({
          id: input.id,
          chatId: input.chatId,
          senderId: input.senderId,
          text: 'Голосове повідомлення',
          file: {
            key,
            name: `voice.${audio.extension}`,
            mediaType: audio.mediaType,
            size: audio.bytes.length,
          },
          voice: { durationMs: audio.durationMs, waveform: audio.waveform },
        }),
    );
  }

  private async storeAttachment(
    chatId: string,
    mediaType: string,
    bytes: Uint8Array,
    persist: (key: string) => Promise<SaveMessageResult>,
  ): Promise<ChatMessage> {
    const storage = this.storage;

    if (!storage) {
      throw new MediaUnavailableError();
    }

    const key = `attachments/${chatId}/${randomUUID()}`;
    let result: SaveMessageResult;

    try {
      await storage.put({ key, bytes, mediaType });
      result = await persist(key);
    } catch (error: unknown) {
      await storage.remove(key).catch(() => undefined);
      throw error;
    }

    if (result.created) {
      this.events.publish({ type: WebSocketEventType.Changed, chatId });
    } else {
      await storage.remove(key).catch(() => undefined);
    }

    return this.presentMessage(result.message);
  }

  async getFile(
    chatId: string,
    messageId: string,
    userId: string,
  ): Promise<FileResult> {
    if (!(await this.isActiveMember(chatId, userId))) {
      throw new ChatNotFoundError();
    }

    const file = await this.messagesRepository.findAttachment(
      chatId,
      messageId,
      userId,
    );

    if (!file) {
      throw new ChatNotFoundError();
    }

    const bytes =
      file.key && this.storage
        ? await this.storage.get(file.key)
        : file.legacyBytes;

    if (!bytes) {
      throw new MediaUnavailableError();
    }

    return { name: file.name, mediaType: file.mediaType, bytes };
  }

  async setReaction(input: SetReactionInput): Promise<ReactionState> {
    const { changed, selections, reactions, reactionVersion, recipients } =
      await this.messagesRepository.setReaction(input);

    if (changed) {
      this.events.publish({
        type: WebSocketEventType.Reaction,
        chatId: input.chatId,
        messageId: input.messageId,
        reactionVersion,
        reactions,
        selections,
        recipients,
      });
    }

    return {
      reactionVersion,
      reactions,
      myReaction:
        selections.find(({ userId }) => userId === input.userId)?.type ?? null,
    };
  }

  async changeMessage(input: ChangeChatMessageInput): Promise<ChatMessage> {
    if (
      input.text !== null &&
      (!/\S/u.test(input.text) ||
        [...input.text].length > MESSAGE_TEXT_MAX_LENGTH)
    ) {
      throw new InvalidMessageTextError();
    }

    if (!(await this.isActiveMember(input.chatId, input.userId))) {
      throw new ChatNotFoundError();
    }

    const message = await this.messagesRepository.changeMessage({
      chatId: input.chatId,
      messageId: input.messageId,
      userId: input.userId,
      text: input.text,
    });

    if (!message) {
      throw new ChatNotFoundError();
    }

    this.events.publish({
      type: WebSocketEventType.Changed,
      chatId: input.chatId,
    });

    return this.presentMessage(message);
  }

  async markRead(
    chatId: string,
    userId: string,
    throughMessageId: string,
  ): Promise<void> {
    if (!(await this.isActiveMember(chatId, userId))) {
      throw new ChatNotFoundError();
    }

    const changed = await this.messagesRepository.markRead(
      chatId,
      userId,
      throughMessageId,
    );

    if (changed) {
      this.events.publish({ type: WebSocketEventType.Changed, chatId });
    }
  }

  async typing(chatId: string, userId: string, typing: boolean): Promise<void> {
    if (!(await this.isActiveMember(chatId, userId))) {
      throw new ChatNotFoundError();
    }

    this.events.publish({
      type: WebSocketEventType.Typing,
      chatId,
      userId,
      typing,
    });
  }

  async hideChat(chatId: string, userId: string): Promise<void> {
    if (!(await this.chatsRepository.hideChat(chatId, userId))) {
      throw new ChatNotFoundError();
    }

    this.events.publish({ type: WebSocketEventType.Changed, chatId });
  }

  countMedia(chatId: string, userId: string) {
    return this.messagesRepository.countMedia(chatId, userId);
  }

  async listMessages(
    input: ListChatMessagesInput,
  ): Promise<ListChatMessagesResult> {
    const result = await this.messagesRepository.findMessages({
      chatId: input.chatId,
      userId: input.userId,
      cursor: decodeCursor(input.cursor),
      take: input.limit,
      ...(input.mediaCategory ? { category: input.mediaCategory } : {}),
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
      items: await Promise.all(
        result.items.map((message) => this.presentMessage(message)),
      ),
      nextCursor,
    };
  }

  private async presentPerson(
    person: ChatParticipant,
  ): Promise<ChatParticipant> {
    const url = await avatarUrl(person, this.storage);

    return {
      id: person.id,
      username: person.username,
      displayName: person.displayName,
      ...(url !== undefined ? { avatarUrl: url } : {}),
    };
  }
  private async presentMessage(message: ChatMessage): Promise<ChatMessage> {
    return { ...message, sender: await this.presentPerson(message.sender) };
  }

  async isActiveMember(chatId: string, userId: string): Promise<boolean> {
    return this.chatsRepository.isActiveMember(chatId, userId);
  }
}

export { ChatsService };
