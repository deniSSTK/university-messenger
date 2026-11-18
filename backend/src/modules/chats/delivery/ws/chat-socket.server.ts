import type { ReplyPreview } from '../../domain/chats.models.js';
import { WebSocketEventType } from '@university-messenger/events';
import {
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { isUUID } from 'class-validator';
import { AppConfig } from '../../../../core/config/app.config.js';
import { AuthService } from '../../../auth/service/auth.service.js';
import { ChatsService } from '../../service/chats.service.js';
import { ChatEvents } from '../../service/chat-events.js';
import type { ChatEvent } from '../../domain/chat-events.port.js';

type Connection = {
  token: string;
  userId: string;
  sessionId: string;
  expiresAt: number;
  busy: boolean;
  lastTypingAt: number;
  alive: boolean;
};

@Injectable()
class ChatSocketServer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly server = new WebSocketServer({
    noServer: true,
    maxPayload: 8192,
  });
  private readonly connections = new Map<WebSocket, Connection>();
  private unsubscribe?: () => void;
  private heartbeat?: ReturnType<typeof setInterval>;

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly chats: ChatsService,
    private readonly events: ChatEvents,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    const http = this.adapter.httpAdapter.getHttpServer() as Server;
    http.on('upgrade', (request, socket, head) => {
      if (
        request.url !== '/events' ||
        request.headers.origin !== this.config.frontendOrigin
      ) {
        socket.destroy();

        return;
      }

      this.server.handleUpgrade(request, socket, head, (client) =>
        this.connect(client),
      );
    });

    this.unsubscribe = this.events.subscribe((event) => {
      void this.broadcast(event);
    });
    this.heartbeat = setInterval(() => {
      for (const [client, connection] of this.connections) {
        void this.validate(connection).then((valid) => {
          if (!valid) {
            client.close(4001, 'Session expired');
          } else if (!connection.alive || client.bufferedAmount > 65536) {
            client.terminate();
          } else {
            connection.alive = false;
            client.ping();
          }
        });
      }
    }, 15000);
    this.heartbeat.unref();
  }

  private connect(client: WebSocket): void {
    const timeout = setTimeout(
      () => client.close(4001, 'Authentication required'),
      5000,
    );
    let authenticating = false;

    client.on('error', () => client.terminate());
    client.on('close', () => {
      clearTimeout(timeout);
      this.connections.delete(client);
    });
    client.on('pong', () => {
      const connection = this.connections.get(client);

      if (connection) {
        connection.alive = true;
      }
    });
    client.on('message', (data, isBinary) => {
      if (isBinary || !Buffer.isBuffer(data)) {
        client.close(1008, 'Text events required');

        return;
      }

      void (async () => {
        const packet: unknown = JSON.parse(data.toString('utf8'));

        if (!packet || typeof packet !== 'object' || !('type' in packet)) {
          client.close(1008, 'Invalid event');

          return;
        }

        const connection = this.connections.get(client);

        if (!connection) {
          if (
            authenticating ||
            packet.type !== WebSocketEventType.Auth ||
            !('token' in packet) ||
            typeof packet.token !== 'string'
          ) {
            client.close(4001, 'Authentication required');

            return;
          }

          authenticating = true;
          const claims: unknown = await this.jwt.verifyAsync(packet.token);

          if (
            !claims ||
            typeof claims !== 'object' ||
            !('type' in claims) ||
            claims.type !== 'access' ||
            !('sub' in claims) ||
            typeof claims.sub !== 'string' ||
            !isUUID(claims.sub) ||
            !('sid' in claims) ||
            typeof claims.sid !== 'string' ||
            !isUUID(claims.sid) ||
            !('exp' in claims) ||
            typeof claims.exp !== 'number'
          ) {
            client.close(4001, 'Invalid token');

            return;
          }

          await this.auth.getActiveSession(claims.sid, claims.sub);

          if (client.readyState !== WebSocket.OPEN) {
            return;
          }

          this.connections.set(client, {
            token: packet.token,
            userId: claims.sub,
            sessionId: claims.sid,
            expiresAt: claims.exp * 1000,
            busy: false,
            lastTypingAt: 0,
            alive: true,
          });
          clearTimeout(timeout);
          client.send(JSON.stringify({ type: WebSocketEventType.Ready }));

          return;
        }

        if (connection.busy || Date.now() - connection.lastTypingAt < 500) {
          return;
        }

        if (
          packet.type === WebSocketEventType.Typing &&
          'chatId' in packet &&
          typeof packet.chatId === 'string' &&
          isUUID(packet.chatId) &&
          'typing' in packet &&
          typeof packet.typing === 'boolean'
        ) {
          connection.busy = true;
          connection.lastTypingAt = Date.now();

          try {
            if (!(await this.validate(connection))) {
              client.close(4001, 'Session expired');

              return;
            }

            await this.chats.typing(
              packet.chatId,
              connection.userId,
              packet.typing,
            );
          } finally {
            connection.busy = false;
          }
        }
      })().catch(() =>
        client.close(
          this.connections.has(client) ? 1008 : 4001,
          'Invalid or unauthorized event',
        ),
      );
    });
  }

  private async validate(connection: Connection): Promise<boolean> {
    if (Date.now() >= connection.expiresAt) {
      return false;
    }

    try {
      await this.auth.getActiveSession(connection.sessionId, connection.userId);

      return true;
    } catch {
      return false;
    }
  }

  private async broadcast(event: ChatEvent): Promise<void> {
    const replies = new Map<string, Promise<ReplyPreview | undefined>>();
    const payloadFor = async (userId: string) => {
      if (event.type !== WebSocketEventType.Changed || !event.messageId) {
        return event;
      }

      let lookup = replies.get(userId);

      if (!lookup) {
        lookup = this.chats.liveReply(event.chatId, event.messageId, userId);
        replies.set(userId, lookup);
      }

      const reply = await lookup;

      return reply
        ? {
            type: event.type,
            chatId: event.chatId,
            messageId: event.messageId,
            reply,
          }
        : { type: event.type, chatId: event.chatId };
    };

    await Promise.all(
      [...this.connections].map(async ([client, connection]) => {
        try {
          if (
            event.type === WebSocketEventType.Reaction &&
            !event.recipients.includes(connection.userId)
          ) {
            return;
          }

          if (!(await this.validate(connection))) {
            client.close(4001, 'Session expired');

            return;
          }

          if (
            client.readyState === WebSocket.OPEN &&
            (await this.chats.isActiveMember(event.chatId, connection.userId))
          ) {
            const payload =
              event.type === WebSocketEventType.Reaction
                ? {
                    type: event.type,
                    chatId: event.chatId,
                    messageId: event.messageId,
                    reactionVersion: event.reactionVersion,
                    reactions: event.reactions,
                    myReaction:
                      event.selections.find(
                        ({ userId }) => userId === connection.userId,
                      )?.type ?? null,
                  }
                : await payloadFor(connection.userId);
            client.send(JSON.stringify(payload));
          }
        } catch {
          client.close(1011, 'Connection failed');
        }
      }),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    clearInterval(this.heartbeat);
    for (const client of this.server.clients) {
      client.terminate();
    }

    this.server.close();
  }
}

export { ChatSocketServer };
