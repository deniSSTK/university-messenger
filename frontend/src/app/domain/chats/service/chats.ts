import { ACTIVITY_REPOSITORY } from '../repository/activity.repository';
import type { ChatActivity, ChatFile, SharedMediaCategory, SharedMediaCounts } from './chats.types';
import { Injectable, inject } from '@angular/core';
import { countCodePoints } from '../../../core/text/unicode';
import { MESSAGE_TEXT_MAX_LENGTH } from '../chats.constants';
import { CHATS_REPOSITORY, ChatRepositoryError } from '../repository/chats.repository';
import type {
  ChatMessageRecord,
  ChatRecord,
  ChatPersonRecord,
} from '../repository/chats.repository';
import type { ChatMessage, ChatPerson, Conversation, ChatPage, HistoryPage } from './chats.types';
class ChatError extends Error {
  constructor(readonly code: 'unavailable' | 'missing' | 'validation') {
    super(code);
  }
}
function mapPerson(person: ChatPersonRecord): ChatPerson {
  return {
    id: person.id,
    username: person.username,
    displayName: person.displayName,
    avatarUrl: person.avatarUrl ?? null,
  };
}
function mapMessage(message: ChatMessageRecord): ChatMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
    ...(message.editedAt !== undefined ? { editedAt: message.editedAt } : {}),
    ...(message.readAt !== undefined ? { readAt: message.readAt } : {}),
    ...(message.attachment !== undefined
      ? {
          attachment: message.attachment
            ? {
                name: message.attachment.name,
                mediaType: message.attachment.mediaType,
                size: message.attachment.size,
              }
            : null,
        }
      : {}),
  };
}
function mapChat(chat: ChatRecord): Conversation {
  return {
    id: chat.id,
    person: mapPerson(chat.person),
    lastMessage: chat.lastMessage ? mapMessage(chat.lastMessage) : null,
    activityAt: chat.activityAt,
    ...(chat.unreadCount !== undefined ? { unreadCount: chat.unreadCount } : {}),
  };
}
@Injectable({ providedIn: 'root' })
class ChatService {
  private repository = inject(CHATS_REPOSITORY);
  private activity = inject(ACTIVITY_REPOSITORY, { optional: true });

  upload(chatId: string, file: ChatFile): Promise<void> {
    if (file.bytes.length < 1 || file.bytes.length > 5242880) {
      return Promise.reject(new ChatError('validation'));
    }
    return this.run(async () => {
      if (!this.activity) {
        throw new ChatError('unavailable');
      }
      await this.activity.upload(chatId, {
        name: file.name,
        mediaType: file.mediaType,
        bytes: file.bytes,
      });
    });
  }

  download(chatId: string, messageId: string): Promise<ChatFile> {
    return this.run(async () => {
      if (!this.activity) {
        throw new ChatError('unavailable');
      }
      const file = await this.activity.download(chatId, messageId);
      return { name: file.name, mediaType: file.mediaType, bytes: file.bytes };
    });
  }

  watch(listener: (event: ChatActivity) => void): () => void {
    return (
      this.activity?.watch((event) =>
        listener({
          type: event.type,
          chatId: event.chatId,
          userId: event.userId,
          typing: event.typing,
        }),
      ) ?? (() => {})
    );
  }

  typing(chatId: string, typing: boolean): void {
    this.activity?.typing(chatId, typing);
  }

  edit(chatId: string, messageId: string, text: string): Promise<void> {
    if (!text.trim() || countCodePoints(text) > MESSAGE_TEXT_MAX_LENGTH) {
      return Promise.reject(new ChatError('validation'));
    }
    return this.run(async () => {
      if (!this.activity) {
        throw new ChatError('unavailable');
      }
      await this.activity.edit(chatId, messageId, text);
    });
  }

  remove(chatId: string, messageId: string): Promise<void> {
    return this.run(async () => {
      if (!this.activity) {
        throw new ChatError('unavailable');
      }
      await this.activity.remove(chatId, messageId);
    });
  }

  read(chatId: string, messageId: string): Promise<void> {
    return this.run(async () => {
      await this.activity?.read(chatId, messageId);
    });
  }

  async syncHistory(chatId: string, oldestCreatedAt: string | null): Promise<HistoryPage> {
    let page = await this.history(chatId);
    const messages = [...page.messages];
    const visited = new Set<string>();
    while (
      oldestCreatedAt &&
      page.nextBefore &&
      (!page.messages.length || page.messages[0].createdAt >= oldestCreatedAt)
    ) {
      if (visited.has(page.nextBefore)) {
        throw new ChatError('unavailable');
      }
      visited.add(page.nextBefore);
      page = await this.history(chatId, page.nextBefore);
      messages.unshift(...page.messages);
    }
    return {
      messages: [...new Map(messages.map((message) => [message.id, message])).values()],
      nextBefore: page.nextBefore,
    };
  }

  viewer(): Promise<ChatPerson> {
    return this.run(async () => mapPerson(await this.repository.viewer()));
  }
  list(page: number): Promise<ChatPage> {
    return this.run(async () => {
      const result = await this.repository.list(page, 20);
      return { chats: result.chats.map(mapChat), hasMore: result.hasMore };
    });
  }
  open(person: ChatPerson): Promise<Conversation> {
    return this.run(async () =>
      mapChat(
        await this.repository.open({
          id: person.id,
          username: person.username,
          displayName: person.displayName,
        }),
      ),
    );
  }
  get(chatId: string): Promise<Conversation> {
    return this.run(async () => mapChat(await this.repository.get(chatId)));
  }
  history(chatId: string, before: string | null = null): Promise<HistoryPage> {
    return this.run(async () => {
      const result = await this.repository.history(chatId, before, 30);
      return { messages: result.messages.map(mapMessage), nextBefore: result.nextBefore };
    });
  }
  async refreshHistory(chatId: string, latestKnownId: string | null): Promise<HistoryPage> {
    let page = await this.history(chatId);
    const messages = [...page.messages];
    const visited = new Set<string>();

    while (
      latestKnownId &&
      !messages.some((message) => message.id === latestKnownId) &&
      page.nextBefore
    ) {
      if (visited.has(page.nextBefore)) {
        throw new ChatError('unavailable');
      }

      visited.add(page.nextBefore);
      page = await this.history(chatId, page.nextBefore);
      messages.unshift(...page.messages);
    }

    const unique = new Map(messages.map((message) => [message.id, message]));
    return { messages: [...unique.values()], nextBefore: page.nextBefore };
  }
  send(chatId: string, text: string): Promise<ChatMessage> {
    if (!text.trim() || countCodePoints(text) > MESSAGE_TEXT_MAX_LENGTH) {
      return Promise.reject(new ChatError('validation'));
    }

    return this.run(async () => mapMessage(await this.repository.send(chatId, text)));
  }
  mediaCounts(chatId: string): Promise<SharedMediaCounts> {
    return this.run(async () => {
      const counts = await this.repository.mediaCounts(chatId);

      return {
        photos: counts.photos,
        videos: counts.videos,
        files: counts.files,
        audio: counts.audio,
        gifs: counts.gifs,
      };
    });
  }

  media(
    chatId: string,
    category: SharedMediaCategory,
    cursor: string | null,
  ): Promise<HistoryPage> {
    return this.run(async () => {
      const page = await this.repository.media(chatId, category, cursor, 20);

      return { messages: page.messages.map(mapMessage), nextBefore: page.nextBefore };
    });
  }

  hide(chatId: string): Promise<void> {
    return this.run(() => this.repository.hide(chatId));
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw new ChatError(error instanceof ChatRepositoryError ? error.code : 'unavailable');
    }
  }
}

export { ChatService, ChatError };
