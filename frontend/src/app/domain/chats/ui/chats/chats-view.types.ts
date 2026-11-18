import type { ReactionState, ReactionType } from '@university-messenger/events';
interface PersonView {
  defaultReaction?: ReactionType;
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
interface MessageView {
  reply?: { id: string; author: { id: string; displayName: string } | null; preview: string };
  sender?: PersonView;
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
interface ConversationView {
  id: string;
  person: PersonView;
  lastMessage: MessageView | null;
  activityAt: string;
  unreadCount?: number;
}

export type { PersonView, MessageView, ConversationView };
