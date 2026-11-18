import type { ReactionState, ReactionType } from '@university-messenger/events';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '../../../../core/http/http-client.service';
import { environment } from '../../../../../environments/environment';
import { encodeBase64 } from './file-content';
import { ChatRepositoryError } from '../chats.repository';
import type {
  ChatsRepository,
  ChatPersonRecord,
  VoiceRecordingRecord,
  ChatMessageRecord,
  ChatRecord,
  ChatPageRecord,
  HistoryRecord,
  MediaCategoryRecord,
  MediaCountsRecord,
} from '../chats.repository';
import type {
  ChatPersonHttpResponse,
  ChatMessageHttpResponse,
  ChatDetailsHttpResponse,
  ChatListHttpResponse,
  ChatHistoryHttpResponse,
  CreateChatHttpRequest,
  SendMessageHttpRequest,
  SendVoiceHttpRequest,
  SharedMediaHttpResponse,
} from './chats-http.types';

function mapPerson(person: ChatPersonHttpResponse): ChatPersonRecord {
  return {
    id: person.id,
    username: person.username,
    displayName: person.displayName,
    avatarUrl: person.avatarUrl ?? null,
    ...(person.defaultReaction ? { defaultReaction: person.defaultReaction } : {}),
  };
}
function mapMessage(message: ChatMessageHttpResponse): ChatMessageRecord {
  return {
    id: message.id,
    senderId: message.senderId,
    ...(message.sender ? { sender: mapPerson(message.sender) } : {}),
    ...(message.reply
      ? { reply: { ...message.reply, author: message.reply.author && { ...message.reply.author } } }
      : {}),
    text: message.text,
    createdAt: message.createdAt,
    ...(message.reactionState ? { reactionState: message.reactionState } : {}),
    ...(message.editedAt !== undefined ? { editedAt: message.editedAt } : {}),
    ...(message.readAt !== undefined ? { readAt: message.readAt } : {}),
    ...(message.attachment !== undefined
      ? {
          attachment: message.attachment
            ? {
                name: message.attachment.name,
                mediaType: message.attachment.mediaType,
                size: message.attachment.size,
                ...(message.attachment.voice
                  ? {
                      voice: {
                        durationMs: message.attachment.voice.durationMs,
                        waveform: message.attachment.voice.waveform,
                      },
                    }
                  : {}),
              }
            : null,
        }
      : {}),
  };
}
function mapDetails(chat: ChatDetailsHttpResponse): ChatRecord {
  return {
    id: chat.id,
    person: mapPerson(chat.recipient),
    lastMessage: null,
    activityAt: chat.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
class ChatsHttpAdapter implements ChatsRepository {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  viewer(): Promise<ChatPersonRecord> {
    return this.translateErrors(async () => {
      const response = await firstValueFrom(
        this.http.get<ChatPersonHttpResponse>(`${this.apiUrl}/auth/me`),
      );
      return mapPerson(response);
    });
  }

  list(page: number, limit: number): Promise<ChatPageRecord> {
    return this.translateErrors(async () => {
      const response = await firstValueFrom(
        this.http.get<ChatListHttpResponse>(`${this.apiUrl}/chats`, { params: { page, limit } }),
      );
      return {
        chats: response.items.map((chat) => ({
          id: chat.id,
          person: mapPerson(chat.recipient),
          lastMessage: chat.lastMessage ? mapMessage(chat.lastMessage) : null,
          activityAt: chat.lastActivityAt,
          unreadCount: chat.unreadCount ?? 0,
        })),
        hasMore: response.meta.page < response.meta.totalPages,
      };
    });
  }

  open(person: ChatPersonRecord): Promise<ChatRecord> {
    const body: CreateChatHttpRequest = { recipientId: person.id };
    return this.translateErrors(async () => {
      const response = await firstValueFrom(
        this.http.post<ChatDetailsHttpResponse>(`${this.apiUrl}/chats`, body),
      );
      return mapDetails(response);
    });
  }

  get(chatId: string): Promise<ChatRecord> {
    return this.translateErrors(async () => {
      const response = await firstValueFrom(
        this.http.get<ChatDetailsHttpResponse>(this.chatUrl(chatId)),
      );
      return mapDetails(response);
    });
  }

  history(chatId: string, before: string | null, limit: number): Promise<HistoryRecord> {
    return this.fetchHistory(chatId, before, limit);
  }

  media(
    chatId: string,
    category: MediaCategoryRecord,
    cursor: string | null,
    limit: number,
  ): Promise<HistoryRecord> {
    return this.fetchHistory(chatId, cursor, limit, category);
  }

  mediaCounts(chatId: string): Promise<MediaCountsRecord> {
    return this.translateErrors(async () => {
      const counts = await firstValueFrom(
        this.http.get<SharedMediaHttpResponse>(`${this.chatUrl(chatId)}/media`),
      );

      return {
        photos: counts.photos,
        videos: counts.videos,
        files: counts.files,
        audio: counts.audio,
        voice: counts.voice,
        gifs: counts.gifs,
      };
    });
  }

  hide(chatId: string): Promise<void> {
    return this.translateErrors(async () => {
      await firstValueFrom(this.http.delete(`${this.chatUrl(chatId)}/visibility`));
    });
  }

  private fetchHistory(
    chatId: string,
    before: string | null,
    limit: number,
    category?: MediaCategoryRecord,
  ): Promise<HistoryRecord> {
    return this.translateErrors(async () => {
      const response = await firstValueFrom(
        this.http.get<ChatHistoryHttpResponse>(`${this.chatUrl(chatId)}/messages`, {
          params: {
            limit,
            ...(before !== null ? { cursor: before } : {}),
            ...(category ? { category } : {}),
          },
        }),
      );
      const messages = response.items.map(mapMessage);

      return {
        messages: category ? messages : messages.reverse(),
        nextBefore: response.nextCursor,
      };
    });
  }

  send(chatId: string, text: string, replyToId?: string): Promise<ChatMessageRecord> {
    const body: SendMessageHttpRequest = { text, ...(replyToId ? { replyToId } : {}) };
    return this.translateErrors(async () => {
      const response = await firstValueFrom(
        this.http.post<ChatMessageHttpResponse>(`${this.chatUrl(chatId)}/messages`, body),
      );
      return mapMessage(response);
    });
  }

  setReaction(
    chatId: string,
    messageId: string,
    type: ReactionType | null,
  ): Promise<ReactionState> {
    return this.translateErrors(() =>
      firstValueFrom(
        this.http.put<ReactionState>(
          `${this.chatUrl(chatId)}/messages/${encodeURIComponent(messageId)}/reaction`,
          { type },
        ),
      ),
    );
  }

  sendVoice(chatId: string, recording: VoiceRecordingRecord): Promise<ChatMessageRecord> {
    return this.translateErrors(async () => {
      const body: SendVoiceHttpRequest = {
        id: recording.id,
        ...(recording.replyToId ? { replyToId: recording.replyToId } : {}),
        mediaType: recording.mediaType,
        content: encodeBase64(recording.bytes),
      };
      const response = await firstValueFrom(
        this.http.post<ChatMessageHttpResponse>(`${this.chatUrl(chatId)}/voice`, body),
      );
      return mapMessage(response);
    });
  }

  private chatUrl(chatId: string) {
    return `${this.apiUrl}/chats/${encodeURIComponent(chatId)}`;
  }

  private async translateErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 403 || error.status === 404) {
          throw new ChatRepositoryError('missing');
        }

        if (error.status === 400) {
          throw new ChatRepositoryError('validation');
        }
      }

      throw new ChatRepositoryError('unavailable');
    }
  }
}

export { ChatsHttpAdapter };
