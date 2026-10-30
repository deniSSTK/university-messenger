type StoredMessage = {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Date;
  editedAt: Date | null;
  readAt: Date | null;
  deletedAt: Date | null;
};

type MessagePosition = { id: string; createdAt: Date };
type AppendMessageInput = {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: Date;
};
type MessageHistoryInput = {
  chatId: string;
  userId: string;
  limit: number;
  before?: MessagePosition;
};
type MoveChatResult = {
  chatId: string;
  previousShardId: string | null;
  shardId: string;
  copiedMessages: number;
};

export type {
  StoredMessage,
  MessagePosition,
  AppendMessageInput,
  MessageHistoryInput,
  MoveChatResult,
};
