import type {
  ChatListItem,
  ChatMessage,
  ChatParticipant,
} from '../domain/chats.models.js';

type CreateChatInput = {
  currentUserId: string;
  recipientId: string;
};

type ListChatsInput = {
  currentUserId: string;
  page: number;
  limit: number;
};

type ListChatsResult = {
  items: ChatListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type SendChatMessageInput = {
  chatId: string;
  senderId: string;
  text: string;
};

type ListChatMessagesInput = {
  chatId: string;
  cursor: string | undefined;
  limit: number;
};

type ListChatMessagesResult = {
  items: ChatMessage[];
  nextCursor: string | null;
};

type ChatDetailsResult = {
  id: string;
  createdAt: Date;
  recipient: ChatParticipant;
};

type SendFileInput = {
  chatId: string;
  senderId: string;
  name: string;
  mediaType: string;
  bytes: Uint8Array;
};
type SendVoiceInput = Omit<SendFileInput, 'name'> & { id: string };

type FileResult = { name: string; mediaType: string; bytes: Uint8Array };
type ChangeChatMessageInput = {
  chatId: string;
  messageId: string;
  userId: string;
  text: string | null;
};

export type {
  CreateChatInput,
  ChatDetailsResult,
  ListChatMessagesInput,
  ListChatMessagesResult,
  ListChatsInput,
  ListChatsResult,
  SendChatMessageInput,
  SendFileInput,
  SendVoiceInput,
  FileResult,
  ChangeChatMessageInput,
};
