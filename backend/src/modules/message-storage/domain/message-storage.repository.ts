import type {
  StoredMessage,
  AppendMessageInput,
  MessageHistoryInput,
  MoveChatResult,
} from './message-storage.models.js';

interface MessageStorageRepository {
  append(input: AppendMessageInput): Promise<StoredMessage>;
  history(input: MessageHistoryInput): Promise<StoredMessage[]>;
  moveChat(chatId: string, targetShardId?: string): Promise<MoveChatResult>;
}

const MESSAGE_STORAGE_REPOSITORY = Symbol('MESSAGE_STORAGE_REPOSITORY');

export { MESSAGE_STORAGE_REPOSITORY };
export type { MessageStorageRepository };
