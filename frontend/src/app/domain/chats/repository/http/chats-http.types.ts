interface ChatPersonHttpResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}
interface ChatMessageHttpResponse {
  id: string;
  chatId: string;
  senderId: string;
  sender: ChatPersonHttpResponse;
  text: string;
  createdAt: string;
  editedAt: string | null;
  readAt?: string | null;
  attachment?: {
    name: string;
    mediaType: string;
    size: number;
    voice?: { durationMs: number; waveform: number[] };
  } | null;
}
interface ChatDetailsHttpResponse {
  id: string;
  createdAt: string;
  recipient: ChatPersonHttpResponse;
}
interface ChatListHttpResponse {
  items: {
    id: string;
    recipient: ChatPersonHttpResponse;
    lastMessage: ChatMessageHttpResponse | null;
    lastActivityAt: string;
    unreadCount?: number;
  }[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
interface ChatHistoryHttpResponse {
  items: ChatMessageHttpResponse[];
  nextCursor: string | null;
}
interface CreateChatHttpRequest {
  recipientId: string;
}
interface SendMessageHttpRequest {
  text: string;
}

type SendVoiceHttpRequest = { id: string; mediaType: string; content: string };

type SharedMediaHttpResponse = {
  photos: number;
  videos: number;
  files: number;
  audio: number;
  voice: number;
  gifs: number;
};

export type {
  SendVoiceHttpRequest,
  SharedMediaHttpResponse,
  ChatPersonHttpResponse,
  ChatMessageHttpResponse,
  ChatDetailsHttpResponse,
  ChatListHttpResponse,
  ChatHistoryHttpResponse,
  CreateChatHttpRequest,
  SendMessageHttpRequest,
};
