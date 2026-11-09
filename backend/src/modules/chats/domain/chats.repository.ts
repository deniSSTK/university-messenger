import type {
  ChatListItem,
  ChatMessage,
  MessageCursor,
  PrivateChat,
} from './chats.models.js';

type CreatePrivateChatInput = {
  currentUserId: string;
  recipientId: string;
};

type FindChatsInput = {
  currentUserId: string;
  offset: number;
  take: number;
};

type FindChatsResult = {
  items: ChatListItem[];
  total: number;
};

type SendMessageInput = {
  chatId: string;
  senderId: string;
  text: string;
  file?: { name: string; mediaType: string; size: number; key: string };
};

type FindMessagesInput = {
  chatId: string;
  cursor: MessageCursor | null;
  take: number;
};

type FindMessagesResult = {
  items: ChatMessage[];
  hasMore: boolean;
};

interface IChatsRepository {
  createOrFindPrivateChat(
    input: CreatePrivateChatInput,
  ): Promise<PrivateChat | null>;
  findChat(chatId: string, currentUserId: string): Promise<PrivateChat | null>;
  findChats(input: FindChatsInput): Promise<FindChatsResult>;
  isActiveMember(chatId: string, userId: string): Promise<boolean>;
}

type ChangeMessageInput = {
  chatId: string;
  messageId: string;
  userId: string;
  text: string | null;
};

type AttachmentData = {
  name: string;
  mediaType: string;
  key: string | null;
  legacyBytes: Uint8Array | null;
};
interface IMessagesRepository {
  findAttachment(
    chatId: string,
    messageId: string,
  ): Promise<AttachmentData | null>;
  changeMessage(input: ChangeMessageInput): Promise<ChatMessage | null>;
  markRead(
    chatId: string,
    userId: string,
    throughMessageId: string,
  ): Promise<boolean>;
  sendMessage(input: SendMessageInput): Promise<ChatMessage>;
  findMessages(input: FindMessagesInput): Promise<FindMessagesResult>;
}

const CHATS_REPOSITORY = Symbol('CHATS_REPOSITORY');
const MESSAGES_REPOSITORY = Symbol('MESSAGES_REPOSITORY');

export { CHATS_REPOSITORY, MESSAGES_REPOSITORY };
export type {
  AttachmentData,
  ChangeMessageInput,
  CreatePrivateChatInput,
  FindChatsInput,
  FindChatsResult,
  FindMessagesInput,
  FindMessagesResult,
  IChatsRepository,
  IMessagesRepository,
  SendMessageInput,
};
