import { Injectable, inject } from '@angular/core';
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
  return { id: person.id, username: person.username, displayName: person.displayName };
}
function mapMessage(message: ChatMessageRecord): ChatMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
  };
}
function mapChat(chat: ChatRecord): Conversation {
  return {
    id: chat.id,
    person: mapPerson(chat.person),
    lastMessage: chat.lastMessage ? mapMessage(chat.lastMessage) : null,
    activityAt: chat.activityAt,
  };
}
@Injectable({ providedIn: 'root' })
class ChatService {
  private repository = inject(CHATS_REPOSITORY);

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
    if (!text.trim() || text.length > 4000) {
      return Promise.reject(new ChatError('validation'));
    }

    return this.run(async () => mapMessage(await this.repository.send(chatId, text)));
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
