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

function responseBody<T>(response: Response): T {
  return response.body as T;
}

describeDatabase('Chats API (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let prisma: PrismaClient;
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
        { connectionString: process.env.TEST_DATABASE_URL },
        { schema },
      ),
    });
    await prisma.$connect();

    const module = await Test.createTestingModule({ imports: [AppModule] })
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
        .set('Authorization', `Bearer ${firstUser.accessToken}`)
        .send({ recipientId: secondUser.user.id }),
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

    const firstMessageResponse = await request(app.getHttpServer())
      .post(`/chats/${chat.id}/messages`)
      .set('Authorization', `Bearer ${firstUser.accessToken}`)
      .send({ text: 'First message' });
    expect(firstMessageResponse.body).toMatchObject({ text: 'First message' });
    expect(firstMessageResponse.status).toBe(201);
    const firstMessage = responseBody<MessageResponse>(firstMessageResponse);

    expect(firstMessage).toMatchObject({
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
  });
});
