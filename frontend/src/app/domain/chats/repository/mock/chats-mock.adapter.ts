import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '../../../../core/http/http-client.service';
import { environment } from '../../../../../environments/environment';
import { ChatRepositoryError } from '../chats.repository';
import type {
  ChatsRepository,
  ChatPersonRecord,
  ChatMessageRecord,
  ChatRecord,
} from '../chats.repository';

interface ViewerHttpResponse {
  id: string;
  username: string;
  displayName: string;
}
interface StoredChat {
  id: string;
  participants: ChatPersonRecord[];
  createdAt: string;
  messages: ChatMessageRecord[];
}
const MOCK_STORAGE_KEY = 'university-messenger.demo-chats.v1';

function isPerson(value: unknown): value is ChatPersonRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'username' in value &&
    typeof value.username === 'string' &&
    'displayName' in value &&
    typeof value.displayName === 'string'
  );
}
function isMessage(value: unknown): value is ChatMessageRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'senderId' in value &&
    typeof value.senderId === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt))
  );
}
function isChat(value: unknown): value is StoredChat {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    'participants' in value &&
    Array.isArray(value.participants) &&
    value.participants.length === 2 &&
    value.participants.every(isPerson) &&
    'messages' in value &&
    Array.isArray(value.messages) &&
    value.messages.every(isMessage)
  );
}
function compareMessages(left: ChatMessageRecord, right: ChatMessageRecord) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}

@Injectable({ providedIn: 'root' })
class ChatsMockAdapter implements ChatsRepository {
  private http = inject(HttpClient);

  async viewer(): Promise<ChatPersonRecord> {
    try {
      const user = await firstValueFrom(
        this.http.get<ViewerHttpResponse>(`${environment.apiUrl}/auth/me`),
      );
      return { id: user.id, username: user.username, displayName: user.displayName };
    } catch {
      throw new ChatRepositoryError('unavailable');
    }
  }

  async list(page: number, limit: number) {
    const viewer = await this.viewer();
    const chats = this.read()
      .filter((chat) => chat.participants.some((user) => user.id === viewer.id))
      .map((chat) => this.toRecord(chat, viewer.id))
      .sort(
        (left, right) =>
          right.activityAt.localeCompare(left.activityAt) || right.id.localeCompare(left.id),
      );
    const offset = (page - 1) * limit;
    return { chats: chats.slice(offset, offset + limit), hasMore: offset + limit < chats.length };
  }

  async open(person: ChatPersonRecord): Promise<ChatRecord> {
    const viewer = await this.viewer();

    if (viewer.id === person.id) {
      throw new ChatRepositoryError('validation');
    }

    const id = `demo-${[viewer.id, person.id].sort().join('_')}`;
    const chats = this.read();
    let chat = chats.find((entry) => entry.id === id);

    if (!chat) {
      chat = {
        id,
        participants: [{ ...viewer }, { ...person }],
        createdAt: new Date().toISOString(),
        messages: [],
      };
      this.write([...chats, chat]);
    }

    return this.toRecord(chat, viewer.id);
  }

  async get(chatId: string) {
    const viewer = await this.viewer();
    return this.toRecord(this.requireChat(this.read(), chatId, viewer.id), viewer.id);
  }

  async history(chatId: string, before: string | null, limit: number) {
    const viewer = await this.viewer();
    const chat = this.requireChat(this.read(), chatId, viewer.id);
    const sorted = [...chat.messages].sort(compareMessages);
    const end =
      before === null ? sorted.length : sorted.findIndex((message) => message.id === before);

    if (end < 0) {
      throw new ChatRepositoryError('validation');
    }

    const start = Math.max(0, end - limit);
    return {
      messages: sorted.slice(start, end).map((message) => ({ ...message })),
      nextBefore: start > 0 ? sorted[start].id : null,
    };
  }

  async send(chatId: string, text: string) {
    const viewer = await this.viewer();

    if (!text.trim() || text.length > 4000) {
      throw new ChatRepositoryError('validation');
    }

    const chats = this.read();
    const chat = this.requireChat(chats, chatId, viewer.id);
    const message = {
      id: crypto.randomUUID(),
      senderId: viewer.id,
      text,
      createdAt: new Date().toISOString(),
    };
    chat.messages.push(message);
    this.write(chats);
    return { ...message };
  }

  private requireChat(chats: StoredChat[], chatId: string, viewerId: string) {
    const chat = chats.find(
      (entry) => entry.id === chatId && entry.participants.some((user) => user.id === viewerId),
    );

    if (!chat) {
      throw new ChatRepositoryError('missing');
    }

    return chat;
  }

  private toRecord(chat: StoredChat, viewerId: string): ChatRecord {
    const person = chat.participants.find((user) => user.id !== viewerId);

    if (!person) {
      throw new ChatRepositoryError('missing');
    }

    const lastMessage = [...chat.messages].sort(compareMessages).at(-1) ?? null;
    return {
      id: chat.id,
      person: { ...person },
      lastMessage: lastMessage ? { ...lastMessage } : null,
      activityAt: lastMessage?.createdAt ?? chat.createdAt,
    };
  }

  private read(): StoredChat[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) ?? '[]');

      if (!Array.isArray(value) || !value.every(isChat)) {
        throw new Error('Invalid demo data');
      }

      return value;
    } catch {
      throw new ChatRepositoryError('unavailable');
    }
  }

  private write(chats: StoredChat[]) {
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(chats));
    } catch {
      throw new ChatRepositoryError('unavailable');
    }
  }
}
export { ChatsMockAdapter, MOCK_STORAGE_KEY };
