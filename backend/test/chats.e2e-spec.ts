import { WebSocketEventType } from '@university-messenger/events';
import { MediaMigration } from '../src/modules/media/service/migrate-media.js';
import { PrismaLegacyMediaRepository } from '../src/modules/media/repository/prisma-legacy-media.repository.js';
import type { ObjectStorage } from '../src/modules/media/domain/object-storage.port.js';
import { OBJECT_STORAGE } from '../src/modules/media/domain/object-storage.port.js';
import { MemoryObjectStorage } from './memory-object-storage.js';
import { WebSocket } from 'ws';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { Response } from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const describeDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

type AuthResponse = {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
  };
  accessToken: string;
};

type ChatResponse = {
  id: string;
  createdAt: string;
  recipient: {
    id: string;
    username: string;
    displayName: string;
  };
};

type MessageResponse = {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  createdAt: string;
};

type ChatListResponse = {
  items: {
    id: string;
    recipient: { id: string };
    lastMessage: { id: string; text: string } | null;
    lastActivityAt: string;
  }[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type MessageHistoryResponse = {
  items: MessageResponse[];
  nextCursor: string | null;
};

function sampleVoice(duration = 1, container = 'webm'): string {
  return execFileSync(
    'ffmpeg',
    [
      '-nostdin',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${duration}`,
      '-c:a',
      container === 'mp4' ? 'aac' : 'libopus',
      ...(container === 'mp4' ? ['-movflags', 'frag_keyframe+empty_moov'] : []),
      '-f',
      container,
      'pipe:1',
    ],
    { maxBuffer: 6_000_000 },
  ).toString('base64');
}

function responseBody<T>(response: Response): T {
  return response.body as T;
}

describeDatabase('Chats API (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let prisma: PrismaClient;
  const storage = new MemoryObjectStorage();
  const schema = `chats_test_${randomUUID().replaceAll('-', '')}`;
  const previousDatabase = {
    JWT_ACCESS_TOKEN_TTL: process.env.JWT_ACCESS_TOKEN_TTL,
    JWT_SESSION_TTL: process.env.JWT_SESSION_TTL,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  };
  const previousSecret = process.env.JWT_SECRET;
  const previousOrigin = process.env.FRONTEND_ORIGIN;

  beforeAll(async () => {
    process.env.JWT_ACCESS_TOKEN_TTL = '900';
    process.env.JWT_SESSION_TTL = '604800000';
    process.env.DB_USER = 'test-user';
    process.env.DB_PASSWORD = 'test-password';
    process.env.DB_NAME = 'test-db';
    process.env.JWT_SECRET = 'test-only-secret-at-least-32-bytes-long';
    process.env.FRONTEND_ORIGIN = 'http://localhost:4200';

    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const connection = await pool.connect();

    try {
      await connection.query(`CREATE SCHEMA "${schema}"`);
      await connection.query(`SET search_path TO "${schema}"`);
      const migrationsPath = join(process.cwd(), 'prisma/migrations');
      const entries = await readdir(migrationsPath, { withFileTypes: true });
      const migrations = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      for (const name of migrations) {
        const migration = await readFile(
          join(migrationsPath, name, 'migration.sql'),
          'utf8',
        );
        await connection.query(migration);
      }
    } finally {
      connection.release();
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg(
        {
          connectionString: process.env.TEST_DATABASE_URL,
          options: `-c search_path=${schema}`,
        },
        { schema },
      ),
    });
    await prisma.$connect();

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OBJECT_STORAGE)
      .useValue(storage)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  }, 30000);

  beforeEach(async () => {
    await prisma.message.deleteMany();
    await prisma.chatMember.deleteMany();
    await prisma.chat.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();

    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }

    for (const [key, value] of Object.entries(previousDatabase)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }

    if (previousOrigin === undefined) {
      delete process.env.FRONTEND_ORIGIN;
    } else {
      process.env.FRONTEND_ORIGIN = previousOrigin;
    }
  });

  it('registers users, creates a unique chat, sends messages and paginates history and chats', async () => {
    const runId = randomUUID().replaceAll('-', '').slice(0, 8);
    const registerUser = async (
      username: string,
      displayName: string,
    ): Promise<AuthResponse> => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `${username}@example.com`,
          username,
          displayName,
          password: 'valid-password123',
        })
        .expect(201);

      return responseBody<AuthResponse>(response);
    };

    const firstUser = await registerUser(`alice${runId}`, 'Alice');
    const secondUser = await registerUser(`bob${runId}`, 'Bob');
    const thirdUser = await registerUser(`carol${runId}`, 'Carol');

    expect(firstUser.accessToken).toBeTruthy();
    expect(secondUser.accessToken).toBeTruthy();
    expect(firstUser.user.id).not.toBe(secondUser.user.id);

    const createChatRequests = await Promise.all([
      request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${firstUser.accessToken}`)
        .send({ recipientId: secondUser.user.id }),
      request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${secondUser.accessToken}`)
        .send({ recipientId: firstUser.user.id }),
    ]);

    expect(createChatRequests.map((response) => response.status)).toEqual([
      201, 201,
    ]);

    const chat = responseBody<ChatResponse>(createChatRequests[0]);
    const concurrentChat = responseBody<ChatResponse>(createChatRequests[1]);

    expect(chat).toMatchObject({
      recipient: {
        id: secondUser.user.id,
        username: secondUser.user.username,
        displayName: secondUser.user.displayName,
      },
    });
    expect(concurrentChat.id).toBe(chat.id);
    expect(concurrentChat.recipient.id).toBe(firstUser.user.id);

    const savedChat = await prisma.chat.findUniqueOrThrow({
      where: { id: chat.id },
      include: { members: true },
    });
    expect(savedChat.members.map((member) => member.userId).sort()).toEqual(
      [firstUser.user.id, secondUser.user.id].sort(),
    );

    const duplicateChatResponse = await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .send({ recipientId: secondUser.user.id })
      .expect(201);
    expect(responseBody<ChatResponse>(duplicateChatResponse).id).toBe(chat.id);
    expect(await prisma.chat.count()).toBe(1);

    await expect(
      prisma.chat.create({
        data: {
          privateUserAId: savedChat.privateUserAId,
          privateUserBId: savedChat.privateUserBId,
          members: {
            create: [
              { userId: firstUser.user.id },
              { userId: secondUser.user.id },
            ],
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await request(app.getHttpServer())
      .get(`/chats/${chat.id}`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200)
      .expect(chat);
    await request(app.getHttpServer())
      .get(`/chats/${chat.id}`)
      .set('Authorization', `Bearer ${thirdUser.accessToken}`)
      .expect(404);
    await request(app.getHttpServer()).get(`/chats/${chat.id}`).expect(401);
    await request(app.getHttpServer())
      .get('/chats/not-a-uuid/messages')
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200)
      .expect({ items: [], nextCursor: null });

    await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${thirdUser.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${thirdUser.accessToken}`)
      .send({ text: 'Not a member' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/chats/9c858901-8a57-4791-81fe-4c455b099bc9/messages')
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .send({ recipientId: firstUser.user.id })
      .expect(400);
    expect(await prisma.chat.count()).toBe(1);

    const secondChatResponse = await request(app.getHttpServer())
      .post('/chats')
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .send({ recipientId: thirdUser.user.id })
      .expect(201);
    const secondChat = responseBody<ChatResponse>(secondChatResponse);
    expect(await prisma.chat.count()).toBe(2);
    expect(
      (
        await prisma.chatMember.findMany({
          where: { chatId: chat.id },
          select: { userId: true },
        })
      )
        .map((member) => member.userId)
        .sort(),
    ).toEqual([firstUser.user.id, secondUser.user.id].sort());
    await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .send({ text: ' \n\t ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .send({ text: 'Spoofed message', senderId: secondUser.user.id })
      .expect(400);

    const firstMessageResponse = await request(app.getHttpServer())
      .post(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .send({ text: 'First message' });
    expect(firstMessageResponse.body).toMatchObject({ text: 'First message' });
    expect(firstMessageResponse.status).toBe(201);
    const firstMessage = responseBody<MessageResponse>(firstMessageResponse);

    expect(firstMessage).toMatchObject({
      chatId: chat.id,
      text: 'First message',
      senderId: firstUser.user.id,
    });

    const secondMessageResponse = await request(app.getHttpServer())
      .post(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${secondUser.accessToken}`)
      .send({ text: 'Second message' })
      .expect(201);
    const secondMessage = responseBody<MessageResponse>(secondMessageResponse);

    expect(secondMessage).toMatchObject({
      chatId: chat.id,
      text: 'Second message',
      senderId: secondUser.user.id,
    });

    const savedMessages = await prisma.message.findMany({
      where: { chatId: chat.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(savedMessages).toHaveLength(2);
    expect(savedMessages.every((message) => message.chatId === chat.id)).toBe(
      true,
    );
    expect(savedMessages.map((message) => message.senderId).sort()).toEqual(
      [firstUser.user.id, secondUser.user.id].sort(),
    );
    expect(savedMessages.map((message) => message.id).sort()).toEqual(
      [firstMessage.id, secondMessage.id].sort(),
    );
    const oldestMessage = savedMessages[0];
    const newestMessage = savedMessages[1];

    expect(oldestMessage).toBeDefined();
    expect(newestMessage).toBeDefined();

    const firstHistoryResponse = await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .query({ limit: 1 })
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200);
    const firstHistory =
      responseBody<MessageHistoryResponse>(firstHistoryResponse);

    expect(firstHistory.items).toHaveLength(1);
    expect(firstHistory.items[0].id).toBe(newestMessage.id);
    expect(firstHistory.items[0].text).toBe(newestMessage.text);
    expect(firstHistory.nextCursor).toBeTruthy();

    const olderHistoryResponse = await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .query({ limit: 1, cursor: firstHistory.nextCursor })
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200);
    const olderHistory =
      responseBody<MessageHistoryResponse>(olderHistoryResponse);

    expect(olderHistory.items).toHaveLength(1);
    expect(olderHistory.items[0].id).toBe(oldestMessage.id);
    expect(olderHistory.items[0].text).toBe(oldestMessage.text);
    expect(olderHistory.nextCursor).toBeNull();

    await prisma.chat.update({
      where: { id: secondChat.id },
      data: { updatedAt: new Date('2090-01-01T00:00:00.000Z') },
    });

    const chatListResponse = await request(app.getHttpServer())
      .get('/chats')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200);
    const chatList = responseBody<ChatListResponse>(chatListResponse);

    expect(chatList.meta).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(chatList.items).toHaveLength(1);
    expect(chatList.items[0]).toMatchObject({
      id: chat.id,
      recipient: { id: secondUser.user.id },
      lastMessage: {
        id: newestMessage.id,
        text: newestMessage.text,
      },
    });
    expect(chatList.items[0].lastActivityAt).toBe(
      newestMessage.createdAt.toISOString(),
    );

    const secondChatPageResponse = await request(app.getHttpServer())
      .get('/chats')
      .query({ page: 2, limit: 1 })
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200);
    const secondChatPage = responseBody<ChatListResponse>(
      secondChatPageResponse,
    );

    expect(secondChatPage.items).toHaveLength(1);
    expect(secondChatPage.items[0]).toMatchObject({
      id: secondChat.id,
      recipient: { id: thirdUser.user.id },
      lastMessage: null,
      lastActivityAt: secondChat.createdAt,
    });
    expect(secondChatPage.meta).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });

    const emptyChatPageResponse = await request(app.getHttpServer())
      .get('/chats')
      .query({ page: 3, limit: 1 })
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(200);
    expect(responseBody<ChatListResponse>(emptyChatPageResponse).items).toEqual(
      [],
    );

    const tiedTimestamp = new Date(Date.now() + 1_000);
    await prisma.message.updateMany({
      where: { chatId: chat.id },
      data: { createdAt: tiedTimestamp },
    });
    const expectedOrder = [firstMessage.id, secondMessage.id].sort().reverse();

    const tiedPageResponse = await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .query({ limit: 1 })
      .expect(200);
    const tiedPage = responseBody<MessageHistoryResponse>(tiedPageResponse);
    expect(tiedPage.items.map((message) => message.id)).toEqual(
      expectedOrder.slice(0, 1),
    );
    expect(tiedPage.nextCursor).toBeTruthy();

    const unicodeText = `\n${'🙂'.repeat(3999)}`;
    const newMessageResponse = await request(app.getHttpServer())
      .post(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${secondUser.accessToken}`)
      .send({ text: unicodeText })
      .expect(201);
    const newMessage = responseBody<MessageResponse>(newMessageResponse);
    expect(newMessage.text).toBe(unicodeText);
    expect(Date.parse(newMessage.createdAt)).toBeGreaterThan(
      tiedTimestamp.getTime(),
    );

    const olderTiedPageResponse = await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .query({ limit: 1, cursor: tiedPage.nextCursor })
      .expect(200);
    const olderTiedPage = responseBody<MessageHistoryResponse>(
      olderTiedPageResponse,
    );
    expect(olderTiedPage.items.map((message) => message.id)).toEqual(
      expectedOrder.slice(1),
    );
    expect(olderTiedPage.nextCursor).toBeNull();

    await prisma.chatMember.update({
      where: { chatId_userId: { chatId: chat.id, userId: firstUser.user.id } },
      data: { deletedAt: new Date() },
    });
    await request(app.getHttpServer())
      .get(`/chats/${chat.id}`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .expect(404);
  });

  async function register(username: string): Promise<AuthResponse> {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        displayName: username,
        password: 'valid-password123',
      })
      .expect(201);

    return responseBody<AuthResponse>(response);
  }

  it('enforces message authorship, read boundaries, unread counts and private attachment access', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outsider');
    const chat = responseBody<ChatResponse>(
      await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ recipientId: bob.user.id })
        .expect(201),
    );
    const send = async (text: string) =>
      responseBody<MessageResponse>(
        await request(app.getHttpServer())
          .post(`/chats/${chat.id}/messages`)
          .set('Authorization', `Bearer ${alice.accessToken}`)
          .send({ text })
          .expect(201),
      );
    const first = await send('First');
    const second = await send('Second');
    await request(app.getHttpServer())
      .patch(`/chats/${chat.id}/messages/${first.id}`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ text: 'Forged' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/chats/${chat.id}/messages/${first.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    const edited = await request(app.getHttpServer())
      .patch(`/chats/${chat.id}/messages/${first.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ text: 'Updated' })
      .expect(200);
    expect(
      responseBody<{ editedAt: string; text: string }>(edited),
    ).toMatchObject({
      text: 'Updated',
      editedAt: expect.any(String) as unknown,
    });
    await request(app.getHttpServer())
      .post(`/chats/${chat.id}/read`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ throughMessageId: first.id })
      .expect(204);
    expect(
      (await prisma.message.findUniqueOrThrow({ where: { id: first.id } }))
        .readAt,
    ).not.toBeNull();
    expect(
      (await prisma.message.findUniqueOrThrow({ where: { id: second.id } }))
        .readAt,
    ).toBeNull();
    const list = await request(app.getHttpServer())
      .get('/chats')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200);
    expect(
      responseBody<{ items: { unreadCount: number }[] }>(list).items[0]
        .unreadCount,
    ).toBe(1);
    const file = responseBody<MessageResponse>(
      await request(app.getHttpServer())
        .post(`/chats/${chat.id}/attachments`)
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({
          name: 'notes.txt',
          mediaType: 'text/plain',
          content: 'SGVsbG8=',
        })
        .expect(201),
    );
    await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages/${file.id}/attachment`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200)
      .expect({
        name: 'notes.txt',
        mediaType: 'text/plain',
        content: 'SGVsbG8=',
      });
    await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages/${file.id}/attachment`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/chats/${chat.id}/messages/${file.id}`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/chats/${chat.id}/messages/${file.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages/${file.id}/attachment`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/chats/${chat.id}/messages/${first.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(204);
    const history = responseBody<MessageHistoryResponse>(
      await request(app.getHttpServer())
        .get(`/chats/${chat.id}/messages`)
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .expect(200),
    );
    expect(history.items.map((message) => message.id)).toEqual([second.id]);
  });

  it('updates a profile persistently and validates username search exclusions and literal underscores', async () => {
    const alice = await register('al_a');
    const bob = await register('al_b');
    await register('alba');
    const deleted = await register('al_deleted');
    await prisma.user.update({
      where: { id: deleted.user.id },
      data: { deletedAt: new Date() },
    });
    const result = await request(app.getHttpServer())
      .get('/users')
      .query({ search: ' @AL_ ', limit: 1 })
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(
      responseBody<{ items: { id: string }[]; meta: { total: number } }>(
        result,
      ),
    ).toMatchObject({ items: [{ id: bob.user.id }], meta: { total: 1 } });
    await request(app.getHttpServer())
      .get('/users')
      .query({ search: 'al', unexpected: 'x' })
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get('/users')
      .query({ search: 'al' })
      .expect(401);
    const avatarUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ displayName: ' Alice Updated ', avatarUrl })
      .expect(200);
    const me = responseBody<{ displayName: string; avatarUrl: string }>(
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .expect(200),
    );
    expect(me.displayName).toBe('Alice Updated');
    expect(me.avatarUrl).toMatch(/^https:\/\/storage\.example\.com\/avatars\//);
    const saved = await prisma.user.findUniqueOrThrow({
      where: { id: alice.user.id },
    });
    expect(saved.avatarUrl).toBeNull();
    expect(saved.avatarKey).toBeTruthy();
    expect('avatarKey' in me).toBe(false);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ displayName: 'Name only' })
      .expect(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: alice.user.id } }))
        .avatarKey,
    ).toBe(saved.avatarKey);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ displayName: 'Name only', avatarUrl: null })
      .expect(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: alice.user.id } }))
        .avatarKey,
    ).toBeNull();
    await expect(
      app.get<ObjectStorage>(OBJECT_STORAGE).get(saved.avatarKey!),
    ).rejects.toThrow('Missing object');

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({
        displayName: 'Alice',
        avatarUrl: 'data:image/png;base64,SGVsbG8=',
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ displayName: 'Alice', avatarUrl: null, userId: bob.user.id })
      .expect(400);
  });

  it('moves existing binary attachments and data-URL avatars into object storage without losing content', async () => {
    const alice = await register('legacy_alice');
    const bob = await register('legacy_bob');
    const chat = responseBody<ChatResponse>(
      await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ recipientId: bob.user.id })
        .expect(201),
    );
    const file = await prisma.message.create({
      data: {
        chatId: chat.id,
        senderId: alice.user.id,
        text: 'old.txt',
        fileName: 'old.txt',
        fileType: 'text/plain',
        fileSize: 3,
        fileData: new Uint8Array([65, 66, 67]),
      },
    });
    const avatar =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
    await prisma.user.update({
      where: { id: alice.user.id },
      data: { avatarUrl: avatar },
    });
    const storage = app.get<ObjectStorage>(OBJECT_STORAGE);
    const migration = new MediaMigration(
      new PrismaLegacyMediaRepository(prisma),
      storage,
    );
    await expect(migration.run()).resolves.toEqual({
      attachments: 1,
      avatars: 1,
    });
    await expect(migration.run()).resolves.toEqual({
      attachments: 0,
      avatars: 0,
    });
    const moved = await prisma.message.findUniqueOrThrow({
      where: { id: file.id },
    });
    expect(moved.fileData).toBeNull();
    expect(moved.fileKey).toBeTruthy();
    await expect(storage.get(moved.fileKey!)).resolves.toEqual(
      new Uint8Array([65, 66, 67]),
    );
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: alice.user.id },
    });
    expect(user.avatarUrl).toBeNull();
    expect(user.avatarKey).toBeTruthy();
    await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages/${file.id}/attachment`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200)
      .expect({ name: 'old.txt', mediaType: 'text/plain', content: 'QUJD' });
  });

  it('validates voice content and duration, stores it privately and deduplicates concurrent retries', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outsider');
    const chat = responseBody<ChatResponse>(
      await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ recipientId: bob.user.id })
        .expect(201),
    );
    const body = {
      id: randomUUID(),
      mediaType: 'audio/webm;codecs=opus',
      content: sampleVoice(),
    };
    const upload = (token: string, payload = body) =>
      request(app.getHttpServer())
        .post(`/chats/${chat.id}/voice`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

    await upload(outsider.accessToken).expect(404);
    await upload(alice.accessToken, { ...body, content: 'SGVsbG8=' }).expect(
      400,
    );
    await upload(alice.accessToken, { ...body, mediaType: 'audio/mp4' }).expect(
      400,
    );
    await upload(alice.accessToken, {
      ...body,
      content: sampleVoice(301),
    }).expect(400);
    const before = storage.objects.size;

    const uploads = await Promise.all([
      upload(alice.accessToken).expect(201),
      upload(alice.accessToken).expect(201),
    ]);
    const message = responseBody<
      MessageResponse & {
        attachment: {
          name: string;
          voice: { durationMs: number; waveform: number[] };
        };
      }
    >(uploads[0]);
    expect(responseBody<MessageResponse>(uploads[1]).id).toBe(message.id);
    expect(message.attachment.name).toBe('voice.webm');
    expect(message.attachment.voice.durationMs).toBeGreaterThanOrEqual(995);
    expect(message.attachment.voice.waveform).toHaveLength(80);
    expect(Math.max(...message.attachment.voice.waveform)).toBe(100);
    expect(storage.objects.size).toBe(before + 1);
    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: message.id },
    });
    expect(stored.fileData).toBeNull();
    expect(storage.objects.has(stored.fileKey!)).toBe(true);
    expect(await prisma.message.count({ where: { chatId: chat.id } })).toBe(1);
    expect(message).not.toHaveProperty('fileKey');

    const history = await request(app.getHttpServer())
      .get(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200);
    expect(
      responseBody<MessageHistoryResponse>(history).items[0],
    ).toMatchObject(message);
    const url = `/chats/${chat.id}/messages/${message.id}`;
    await request(app.getHttpServer())
      .get(`${url}/attachment`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    const audio = await request(app.getHttpServer())
      .get(`${url}/attachment`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200);
    expect(responseBody<{ content: string }>(audio).content).toBe(
      Buffer.from(storage.objects.get(stored.fileKey!)!).toString('base64'),
    );

    await request(app.getHttpServer())
      .delete(url)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`${url}/attachment`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(404);
    await upload(alice.accessToken).expect(404);
    expect(storage.objects.size).toBe(before + 1);

    const mp4 = await upload(alice.accessToken, {
      id: randomUUID(),
      mediaType: 'audio/mp4',
      content: sampleVoice(1, 'mp4'),
    }).expect(201);
    expect(responseBody<{ attachment: unknown }>(mp4).attachment).toMatchObject(
      { name: 'voice.m4a', mediaType: 'audio/mp4' },
    );
  }, 30_000);

  it('counts and paginates only visible shared attachments for a chat member', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outsider');
    const api = request(app.getHttpServer());
    const chat = responseBody<ChatResponse>(
      await api
        .post('/chats')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ recipientId: bob.user.id })
        .expect(201),
    );
    const send = async (name: string, mediaType: string) =>
      responseBody<MessageResponse>(
        await api
          .post(`/chats/${chat.id}/attachments`)
          .set('Authorization', `Bearer ${alice.accessToken}`)
          .send({ name, mediaType, content: 'SGVsbG8=' })
          .expect(201),
      );
    const first = await send('one.png', 'image/png');
    const second = await send('two.jpg', 'IMAGE/JPEG');
    const deleted = await send('deleted.png', 'image/png');
    await send('clip.mp4', 'video/mp4');
    const music = await send('track.ogg', 'audio/ogg');
    const voice = responseBody<MessageResponse>(
      await api
        .post(`/chats/${chat.id}/voice`)
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({
          id: randomUUID(),
          mediaType: 'audio/webm',
          content: sampleVoice(),
        })
        .expect(201),
    );
    await send('animation.gif', 'image/gif');
    const textFile = await send('notes.txt', 'text/plain');
    const legacy = await send('legacy.dat', 'application/octet-stream');
    await prisma.message.update({
      where: { id: legacy.id },
      data: { fileType: null },
    });
    await api
      .delete(`/chats/${chat.id}/messages/${deleted.id}`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(204);

    const base = `/chats/${chat.id}`;
    await api
      .get(`${base}/media`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200, {
        photos: 2,
        videos: 1,
        audio: 1,
        voice: 1,
        files: 2,
        gifs: 1,
      });
    await api
      .get(`${base}/media`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await api
      .get(`${base}/messages?category=photos`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await api
      .get(`${base}/messages?category=gifts`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(400);

    const page = async (category: string, limit: number, cursor?: string) =>
      responseBody<MessageHistoryResponse>(
        await api
          .get(`${base}/messages`)
          .set('Authorization', `Bearer ${bob.accessToken}`)
          .query({ category, limit, ...(cursor ? { cursor } : {}) })
          .expect(200),
      );
    expect((await page('voice', 10)).items.map(({ id }) => id)).toEqual([
      voice.id,
    ]);
    expect((await page('audio', 10)).items.map(({ id }) => id)).toEqual([
      music.id,
    ]);
    const newest = await page('photos', 1);
    expect(newest.items.map(({ id }) => id)).toEqual([second.id]);
    expect(newest.nextCursor).not.toBeNull();
    expect(
      (await page('photos', 1, newest.nextCursor!)).items.map(({ id }) => id),
    ).toEqual([first.id]);
    expect((await page('files', 10)).items.map(({ id }) => id)).toEqual([
      legacy.id,
      textFile.id,
    ]);
  }, 15_000);

  it('hides a chat only for its requesting member and restores the same history on reopen', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outsider');
    const api = request(app.getHttpServer());
    const open = async (token: string, recipientId: string) =>
      responseBody<ChatResponse>(
        await api
          .post('/chats')
          .set('Authorization', `Bearer ${token}`)
          .send({ recipientId })
          .expect(201),
      );
    const chat = await open(alice.accessToken, bob.user.id);
    const base = `/chats/${chat.id}`;
    await api
      .post(`${base}/messages`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ text: 'Історія залишається' })
      .expect(201);
    await api
      .delete(`${base}/visibility`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await api
      .delete(`${base}/visibility`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(204);
    await api
      .delete(`${base}/visibility`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(204);
    const list = async (token: string) =>
      responseBody<ChatListResponse>(
        await api
          .get('/chats')
          .set('Authorization', `Bearer ${token}`)
          .expect(200),
      );
    expect((await list(alice.accessToken)).items).toEqual([]);
    expect((await list(bob.accessToken)).items.map(({ id }) => id)).toEqual([
      chat.id,
    ]);
    expect((await open(alice.accessToken, bob.user.id)).id).toBe(chat.id);
    expect((await list(alice.accessToken)).items.map(({ id }) => id)).toEqual([
      chat.id,
    ]);
    const history = await api
      .get(`${base}/messages`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(200);
    expect(
      responseBody<MessageHistoryResponse>(history).items.map(
        ({ text }) => text,
      ),
    ).toEqual(['Історія залишається']);
    await api
      .get('/auth/me')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200);
  });

  it('delivers authorized WebSocket changes and typing events and rejects a revoked session', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outsider');
    const chat = responseBody<ChatResponse>(
      await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ recipientId: bob.user.id })
        .expect(201),
    );
    await app.listen(0, '127.0.0.1');
    const url = `${(await app.getUrl()).replace('http:', 'ws:')}/events`;
    const clients: WebSocket[] = [];
    const next = (
      client: WebSocket,
      type: string,
      timeoutMs = 3000,
    ): Promise<Record<string, unknown>> =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.off('message', onMessage);
          reject(new Error(`No ${type} event`));
        }, timeoutMs);
        const onMessage = (bytes: Buffer) => {
          const event = JSON.parse(bytes.toString('utf8')) as Record<
            string,
            unknown
          >;

          if (event.type === type) {
            clearTimeout(timeout);
            client.off('message', onMessage);
            resolve(event);
          }
        };

        client.on('message', onMessage);
      });
    const connect = async (token: string) => {
      const client = new WebSocket(url, { origin: 'http://localhost:4200' });
      clients.push(client);
      await once(client, 'open');
      const ready = next(client, 'ready');
      client.send(JSON.stringify({ type: WebSocketEventType.Auth, token }));
      await ready;

      return client;
    };

    try {
      const author = await connect(alice.accessToken);
      const recipient = await connect(bob.accessToken);
      const other = await connect(outsider.accessToken);
      const otherEvents: string[] = [];
      other.on('message', (data: Buffer) => {
        otherEvents.push(data.toString('utf8'));
      });
      const changed = next(recipient, 'changed');
      await request(app.getHttpServer())
        .post(`/chats/${chat.id}/messages`)
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ text: 'Live' })
        .expect(201);
      expect(await changed).toMatchObject({ chatId: chat.id });
      expect(otherEvents).toEqual([]);
      const voicePayload = {
        id: randomUUID(),
        mediaType: 'audio/webm',
        content: sampleVoice(),
      };
      const [voiceChanged, voice] = await Promise.all([
        next(recipient, 'changed', 15_000),
        request(app.getHttpServer())
          .post(`/chats/${chat.id}/voice`)
          .set('Authorization', `Bearer ${alice.accessToken}`)
          .send(voicePayload)
          .expect(201),
      ]);
      expect(voiceChanged).toMatchObject({ chatId: chat.id });
      expect(
        await prisma.message.findUnique({
          where: { id: responseBody<MessageResponse>(voice).id },
        }),
      ).toMatchObject({ chatId: chat.id });
      expect(otherEvents).toEqual([]);

      const typing = next(author, 'typing');
      recipient.send(
        JSON.stringify({
          type: WebSocketEventType.Typing,
          chatId: chat.id,
          typing: true,
        }),
      );
      expect(await typing).toMatchObject({
        chatId: chat.id,
        userId: bob.user.id,
        typing: true,
      });
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .expect(204);
      const closed = once(author, 'close');
      author.send(
        JSON.stringify({
          type: WebSocketEventType.Typing,
          chatId: chat.id,
          typing: true,
        }),
      );
      expect((await closed)[0]).toBe(4001);
    } finally {
      for (const client of clients) {
        client.terminate();
      }
    }
  }, 25_000);

  it('backfills the canonical pair without changing existing chats or messages', async () => {
    const legacySchema = `${schema}_legacy`;
    const connection = await pool.connect();
    const [firstId, secondId] = [randomUUID(), randomUUID()].sort();
    const chatId = randomUUID();
    const messageId = randomUUID();
    const migrationsPath = join(process.cwd(), 'prisma/migrations');

    try {
      await connection.query(`CREATE SCHEMA "${legacySchema}"`);
      await connection.query(`SET search_path TO "${legacySchema}"`);
      await connection.query(
        await readFile(
          join(migrationsPath, '20261020190100_init_messenger/migration.sql'),
          'utf8',
        ),
      );
      await connection.query(
        `INSERT INTO "User" ("id", "email", "username", "displayName", "passwordHash", "updatedAt")
         VALUES ($1, 'first@example.com', 'first', 'First', 'test', now()),
                ($2, 'second@example.com', 'second', 'Second', 'test', now())`,
        [firstId, secondId],
      );
      await connection.query(
        'INSERT INTO "Chat" ("id", "updatedAt") VALUES ($1, now())',
        [chatId],
      );
      await connection.query(
        'INSERT INTO "ChatMember" ("chatId", "userId") VALUES ($1, $3), ($1, $2)',
        [chatId, firstId, secondId],
      );
      await connection.query(
        `INSERT INTO "Message" ("id", "chatId", "senderId", "text")
         VALUES ($1, $2, $3, 'Existing message')`,
        [messageId, chatId, firstId],
      );

      await connection.query(
        await readFile(
          join(
            migrationsPath,
            '20261105000100_unique_private_chat_pair/migration.sql',
          ),
          'utf8',
        ),
      );

      const chats = await connection.query(
        'SELECT "id", "privateUserAId", "privateUserBId" FROM "Chat"',
      );
      expect(chats.rows).toEqual([
        { id: chatId, privateUserAId: firstId, privateUserBId: secondId },
      ]);
      const messages = await connection.query(
        'SELECT "id", "chatId" FROM "Message"',
      );
      expect(messages.rows).toEqual([{ id: messageId, chatId }]);
    } finally {
      await connection.query('ROLLBACK');
      await connection.query('RESET search_path');
      await connection.query(`DROP SCHEMA IF EXISTS "${legacySchema}" CASCADE`);
      connection.release();
    }
  });
});
