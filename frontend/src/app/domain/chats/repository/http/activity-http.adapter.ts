import { WebSocketEventType } from '@university-messenger/events';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpClient } from '../../../../core/http/http-client.service';
import { SessionService } from '../../../../core/http/session.service';
import { environment } from '../../../../../environments/environment';
import { ChatRepositoryError } from '../chats.repository';
import type { ActivityRepository, ActivityRecord, FileRecord } from '../activity.repository';

@Injectable({ providedIn: 'root' })
class ActivityHttpAdapter implements ActivityRepository {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private socket: WebSocket | null = null;

  watch(listener: (event: ActivityRecord) => void): () => void {
    let stopped = false;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const token = this.session.getAccessToken();
      if (stopped || !token) {
        return;
      }
      const url = new URL(`${environment.apiUrl}/events`, location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      this.socket = socket;
      socket.onopen = () => socket.send(JSON.stringify({ type: WebSocketEventType.Auth, token }));
      socket.onmessage = (message: MessageEvent<unknown>) => {
        if (stopped || typeof message.data !== 'string') {
          return;
        }
        try {
          const event: unknown = JSON.parse(message.data);
          if (!event || typeof event !== 'object' || !('type' in event)) {
            return;
          }
          if (event.type === WebSocketEventType.Ready) {
            attempt = 0;
            listener({ type: WebSocketEventType.Ready });
          } else if ('chatId' in event && typeof event.chatId === 'string') {
            if (event.type === WebSocketEventType.Changed) {
              listener({ type: WebSocketEventType.Changed, chatId: event.chatId });
            } else if (
              event.type === WebSocketEventType.Typing &&
              'userId' in event &&
              typeof event.userId === 'string' &&
              'typing' in event &&
              typeof event.typing === 'boolean'
            ) {
              listener({
                type: WebSocketEventType.Typing,
                chatId: event.chatId,
                userId: event.userId,
                typing: event.typing,
              });
            }
          }
        } catch {
          socket.close();
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = (event) => {
        if (stopped) {
          return;
        }
        listener({ type: WebSocketEventType.Offline });
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5));
        retry = setTimeout(() => {
          void (async () => {
            if (event.code === 4001 && this.session.getAccessToken() === token) {
              try {
                await this.session.refresh();
              } catch {
                // Network errors keep retrying; an expired session clears the token.
              }
            }
            connect();
          })();
        }, delay);
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      this.socket?.close();
      this.socket = null;
    };
  }

  typing(chatId: string, typing: boolean): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: WebSocketEventType.Typing, chatId, typing }));
    }
  }

  edit(chatId: string, messageId: string, text: string): Promise<void> {
    return this.run(async () => {
      await firstValueFrom(this.http.patch(`${this.messageUrl(chatId, messageId)}`, { text }));
    });
  }

  remove(chatId: string, messageId: string): Promise<void> {
    return this.run(async () => {
      await firstValueFrom(this.http.delete(this.messageUrl(chatId, messageId)));
    });
  }

  read(chatId: string, messageId: string): Promise<void> {
    return this.run(async () => {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/chats/${encodeURIComponent(chatId)}/read`, {
          throughMessageId: messageId,
        }),
      );
    });
  }

  upload(chatId: string, file: FileRecord): Promise<void> {
    return this.run(async () => {
      let binary = '';
      for (const byte of file.bytes) {
        binary += String.fromCharCode(byte);
      }
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/chats/${encodeURIComponent(chatId)}/attachments`, {
          name: file.name,
          mediaType: file.mediaType,
          content: btoa(binary),
        }),
      );
    });
  }

  async download(chatId: string, messageId: string): Promise<FileRecord> {
    let result: FileRecord | undefined;
    await this.run(async () => {
      const response = await firstValueFrom(
        this.http.get<{ name: string; mediaType: string; content: string }>(
          `${this.messageUrl(chatId, messageId)}/attachment`,
        ),
      );
      const binary = atob(response.content);
      result = {
        name: response.name,
        mediaType: response.mediaType,
        bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)),
      };
    });
    if (!result) {
      throw new ChatRepositoryError('unavailable');
    }
    return result;
  }

  private messageUrl(chatId: string, messageId: string): string {
    return `${environment.apiUrl}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`;
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 400) {
        throw new ChatRepositoryError('validation');
      }
      if (error instanceof HttpErrorResponse && error.status === 404) {
        throw new ChatRepositoryError('missing');
      }
      throw new ChatRepositoryError('unavailable');
    }
  }
}

export { ActivityHttpAdapter };
