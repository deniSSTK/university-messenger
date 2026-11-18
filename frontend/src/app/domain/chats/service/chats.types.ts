import type { ReactionState, ReactionType } from '@university-messenger/events';
import { WebSocketEventType } from '@university-messenger/events';
interface ChatPerson {
  defaultReaction?: ReactionType;
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
interface ChatMessage {
  reply?: { id: string; author: { id: string; displayName: string } | null; preview: string };
  sender?: ChatPerson;
  reactionState?: ReactionState;
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
    | WebSocketEventType.Typing
    | WebSocketEventType.Reaction;
  chatId?: string;
  userId?: string;
  typing?: boolean;
  reaction?: ReactionState & { messageId: string };
};
type ChatFile = { name: string; mediaType: string; bytes: Uint8Array; replyToId?: string };

type VoiceRecordingInput = { id: string; mediaType: string; bytes: Uint8Array; replyToId?: string };

type SharedMediaCategory = 'photos' | 'videos' | 'files' | 'audio' | 'voice' | 'gifs';
type SharedMediaCounts = Record<SharedMediaCategory, number>;

export type {
  VoiceRecordingInput,
  SharedMediaCategory,
  SharedMediaCounts,
  ChatPerson,
  ChatMessage,
  Conversation,
  ChatPage,
  HistoryPage,
  ChatActivity,
  ChatFile,
};
