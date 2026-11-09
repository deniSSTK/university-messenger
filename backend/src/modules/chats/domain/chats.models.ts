type ChatParticipant = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarKey?: string | null;
};

type ChatMessage = {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  sender: ChatParticipant;
  createdAt: Date;
  attachment?: { name: string; mediaType: string; size: number } | null;
  editedAt: Date | null;
  readAt?: Date | null;
};

type PrivateChat = {
  id: string;
  createdAt: Date;
  recipient: ChatParticipant;
};

type ChatListItem = {
  id: string;
  recipient: ChatParticipant;
  lastMessage: ChatMessage | null;
  lastActivityAt: Date;
  unreadCount?: number;
};

type MessageCursor = {
  createdAt: Date;
  id: string;
};

export type {
  ChatListItem,
  ChatMessage,
  ChatParticipant,
  MessageCursor,
  PrivateChat,
};
