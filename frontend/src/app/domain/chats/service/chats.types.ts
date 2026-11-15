import { WebSocketEventType } from '@university-messenger/events';
interface ChatPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  readAt?: string | null;
  attachment?: {
    name: string;
    mediaType: string;
    size: number;
    voice?: { durationMs: number; waveform: number[] };
  } | null;
}
interface Conversation {
  id: string;
  person: ChatPerson;
  lastMessage: ChatMessage | null;
  activityAt: string;
  unreadCount?: number;
}
interface ChatPage {
  chats: Conversation[];
  hasMore: boolean;
}
interface HistoryPage {
  messages: ChatMessage[];
  nextBefore: string | null;
}
type ChatActivity = {
  type:
    | WebSocketEventType.Ready
    | WebSocketEventType.Offline
    | WebSocketEventType.Changed
    | WebSocketEventType.Typing;
  chatId?: string;
  userId?: string;
  typing?: boolean;
};
type ChatFile = { name: string; mediaType: string; bytes: Uint8Array };

type VoiceRecordingInput = { id: string; mediaType: string; bytes: Uint8Array };

export type {
  VoiceRecordingInput,
  ChatPerson,
  ChatMessage,
  Conversation,
  ChatPage,
  HistoryPage,
  ChatActivity,
  ChatFile,
};
