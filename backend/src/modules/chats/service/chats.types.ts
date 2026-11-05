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

export type {
  CreateChatInput,
  ChatDetailsResult,
  ListChatMessagesInput,
  ListChatMessagesResult,
  ListChatsInput,
  ListChatsResult,
  SendChatMessageInput,
};
