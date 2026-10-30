import type { MessageStorageRepository } from '../domain/message-storage.repository.js';
import type {
  AppendMessageInput,
  MessageHistoryInput,
} from '../domain/message-storage.models.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error('A valid UUID is required');
  }
}

class MessageStorageService {
  constructor(private readonly repository: MessageStorageRepository) {}

  append(input: AppendMessageInput) {
    requireUuid(input.id);
    requireUuid(input.chatId);
    requireUuid(input.senderId);

    if (
      !input.text.trim() ||
      input.text.length > 10000 ||
      !Number.isFinite(input.createdAt.getTime())
    ) {
      throw new Error(
        'A message requires text up to 10000 characters and a valid creation date',
      );
    }

    return this.repository.append({
      id: input.id.toLowerCase(),
      chatId: input.chatId.toLowerCase(),
      senderId: input.senderId.toLowerCase(),
      text: input.text,
      createdAt: input.createdAt,
    });
  }

  history(input: MessageHistoryInput) {
    requireUuid(input.chatId);
    requireUuid(input.userId);

    if (
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 100
    ) {
      throw new Error('Message history limit must be between 1 and 100');
    }

    if (input.before) {
      requireUuid(input.before.id);

      if (!Number.isFinite(input.before.createdAt.getTime())) {
        throw new Error('A valid history position is required');
      }
    }

    return this.repository.history({
      chatId: input.chatId.toLowerCase(),
      userId: input.userId.toLowerCase(),
      limit: input.limit,
      before: input.before
        ? {
            id: input.before.id.toLowerCase(),
            createdAt: input.before.createdAt,
          }
        : undefined,
    });
  }

  moveChat(chatId: string, targetShardId?: string) {
    requireUuid(chatId);

    return this.repository.moveChat(chatId.toLowerCase(), targetShardId);
  }
}

export { MessageStorageService };
