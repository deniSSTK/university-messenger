import { InjectionToken } from '@angular/core';
interface ChatPersonRecord {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
interface ChatMessageRecord {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  readAt?: string | null;
  attachment?: { name: string; mediaType: string; size: number } | null;
}
interface ChatRecord {
  id: string;
  person: ChatPersonRecord;
  lastMessage: ChatMessageRecord | null;
  activityAt: string;
  unreadCount?: number;
}
interface ChatPageRecord {
  chats: ChatRecord[];
  hasMore: boolean;
}
interface HistoryRecord {
  messages: ChatMessageRecord[];
  nextBefore: string | null;
}
type ChatRepositoryErrorCode = 'unavailable' | 'missing' | 'validation';
class ChatRepositoryError extends Error {
  constructor(readonly code: ChatRepositoryErrorCode) {
    super(code);
  }
}
interface ChatsRepository {
  viewer(): Promise<ChatPersonRecord>;
  list(page: number, limit: number): Promise<ChatPageRecord>;
  open(person: ChatPersonRecord): Promise<ChatRecord>;
  get(chatId: string): Promise<ChatRecord>;
  history(chatId: string, before: string | null, limit: number): Promise<HistoryRecord>;
  send(chatId: string, text: string): Promise<ChatMessageRecord>;
}
const CHATS_REPOSITORY = new InjectionToken<ChatsRepository>('CHATS_REPOSITORY');

export { CHATS_REPOSITORY, ChatRepositoryError };
export type {
  ChatsRepository,
  ChatPersonRecord,
  ChatMessageRecord,
  ChatRecord,
  ChatPageRecord,
  HistoryRecord,
  ChatRepositoryErrorCode,
};
