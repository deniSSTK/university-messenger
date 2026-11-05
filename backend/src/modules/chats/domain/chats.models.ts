type ChatParticipant = {
  id: string;
  username: string;
  displayName: string;
};

type ChatMessage = {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  sender: ChatParticipant;
  createdAt: Date;
  editedAt: Date | null;
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
