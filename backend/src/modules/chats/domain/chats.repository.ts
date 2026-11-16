import type {
  ChatListItem,
  ChatMessage,
  MessageCursor,
  PrivateChat,
  VoiceMetadata,
} from './chats.models.js';

import type { MediaCategory, MediaCounts } from './shared-media.js';

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

type MessageFile = {
  name: string;
  mediaType: string;
  size: number;
  key: string;
};

type SendMessageInput = {
  chatId: string;
  senderId: string;
  text: string;
  file?: MessageFile;
};

type SendVoiceMessageInput = SendMessageInput & {
  id: string;
  file: MessageFile;
  voice: VoiceMetadata;
};
type SaveMessageResult = { message: ChatMessage; created: boolean };

type FindMessagesInput = {
  chatId: string;
  userId: string;
  cursor: MessageCursor | null;
  category?: MediaCategory;
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
  hideChat(chatId: string, userId: string): Promise<boolean>;
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
    userId: string,
  ): Promise<AttachmentData | null>;
  changeMessage(input: ChangeMessageInput): Promise<ChatMessage | null>;
  markRead(
    chatId: string,
    userId: string,
    throughMessageId: string,
  ): Promise<boolean>;
  sendMessage(input: SendMessageInput): Promise<ChatMessage>;
  sendVoiceMessage(input: SendVoiceMessageInput): Promise<SaveMessageResult>;
  countMedia(chatId: string, userId: string): Promise<MediaCounts>;
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
  SendVoiceMessageInput,
  SaveMessageResult,
};
