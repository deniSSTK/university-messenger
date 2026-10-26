import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { Response } from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Uses a fresh schema and never truncates application tables.
// Set TEST_DATABASE_URL to a PostgreSQL database where the test user can create schemas.
const describeDatabase = process.env.TEST_DATABASE_URL
  ? describe
  : describe.skip;

interface AuthResponse {
  user: { id: string; email: string; username: string; displayName: string };
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

function body(response: Response): AuthResponse {
  return response.body as AuthResponse;
}

function refreshCookie(response: Response): string {
  const cookies = response.headers['set-cookie'] as unknown as string[];
  return cookies
    .find((value) => value.startsWith('refreshToken='))!
    .split(';')[0];
}

describeDatabase('Auth API (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let pool: Pool;
  let prisma: PrismaClient;
  let jwt: JwtService;
  const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
  const previousSecret = process.env.JWT_SECRET;
  const previousOrigin = process.env.FRONTEND_ORIGIN;
  const origin =
    process.env.NODE_ENV === 'production'
      ? 'https://app.example.com'
      : 'http://localhost:4200';
  const payload = {
    email: 'alice@example.com',
    username: 'alice',
    displayName: 'Alice',
    password: 'valid-password123',
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-only-secret-at-least-32-bytes-long';
    process.env.FRONTEND_ORIGIN = origin;
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const connection = await pool.connect();
    try {
      await connection.query(`CREATE SCHEMA "${schema}"`);
      await connection.query(`SET search_path TO "${schema}"`);
      const migration = await readFile(
        join(
          process.cwd(),
          'prisma/migrations/20261020190100_init_messenger/migration.sql',
        ),
        'utf8',
      );
      await connection.query(migration);
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
    jwt = app.get(JwtService);
  }, 30000);

  beforeEach(async () => {
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
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
    else process.env.FRONTEND_ORIGIN = previousOrigin;
  });

  const register = () =>
    request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

  it('registers, hashes secrets, returns only public fields and sets an HttpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', origin)
      .send({
        ...payload,
        email: ' ALICE@EXAMPLE.COM ',
        username: ' ALICE ',
        displayName: ' Alice ',
      })
      .expect(201);
    expect(body(response)).toMatchObject({
      user: { email: payload.email, username: 'alice', displayName: 'Alice' },
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
    });
    expect(await argon2.verify(user.passwordHash, payload.password)).toBe(true);
    const session = await prisma.userSession.findFirstOrThrow({
      where: { userId: user.id },
    });
    const refreshToken = refreshCookie(response).split('=')[1];
    expect(session.tokenHash).toBe(
      createHash('sha256').update(refreshToken).digest('hex'),
    );
    expect(Object.keys(body(response).user).sort()).toEqual(
      [
        'id',
        'email',
        'username',
        'displayName',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /password|tokenHash|refreshToken/,
    );
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/);
    expect(response.headers['set-cookie'][0]).toMatch(/Path=\/auth/);
    expect(response.headers['set-cookie'][0].includes('; Secure')).toBe(
      process.env.NODE_ENV === 'production',
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body(response).accessToken}`)
      .expect(200)
      .expect(body(response).user);
  });

  it.each([
    { email: 'invalid' },
    { password: 'short' },
    { password: 'a'.repeat(129) },
    { username: 'ab' },
    { username: 'bad name' },
    { displayName: ' ' },
    { email: 123 },
    { username: null },
    { role: 'admin' },
  ])('validates registration fields %p', async (invalid) => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...payload, ...invalid })
      .expect(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rejects missing registration fields', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(400);
  });

  it('rejects duplicate emails/usernames, including normalized case', async () => {
    await register();
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...payload, username: 'another', email: 'ALICE@EXAMPLE.COM' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...payload, email: 'other@example.com', username: 'ALICE' })
      .expect(409);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.userSession.count()).toBe(1);
  });

  it('handles concurrent duplicate registrations without creating orphan sessions', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer()).post('/auth/register').send(payload),
      request(app.getHttpServer()).post('/auth/register').send(payload),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.userSession.count()).toBe(1);
  });

  it('logs in with normalized email and returns the same error for invalid credentials', async () => {
    await register();
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ALICE@EXAMPLE.COM', password: payload.password })
      .expect(200);
    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: payload.email, password: 'wrong-password' })
      .expect(401);
    const missing = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'unknown@example.com', password: payload.password })
      .expect(401);
    expect(missing.body).toEqual(wrong.body);
  });

  it('rotates the refresh token and rejects reuse of the old token', async () => {
    const registered = await register();
    const oldCookie = refreshCookie(registered);
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(200);
    expect(refreshCookie(refreshed)).not.toBe(oldCookie);
    expect(body(refreshed).user.id).toBe(body(registered).user.id);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body(refreshed).accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie(refreshed))
      .expect(200);
  });

  it('allows only one of two simultaneous refreshes', async () => {
    const registered = await register();
    const cookie = refreshCookie(registered);
    const results = await Promise.all([
      request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie),
      request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    const success = results.find((response) => response.status === 200)!;
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie(success))
      .expect(200);
  });

  it('logs out only the current session, clears cookie and blocks its access and refresh tokens', async () => {
    const first = await register();
    const second = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(200);
    const loggedOut = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${body(first).accessToken}`)
      .set('Cookie', refreshCookie(first))
      .expect(204);
    expect(loggedOut.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
    expect(loggedOut.headers['set-cookie'][0]).toMatch(
      /Expires=Thu, 01 Jan 1970/,
    );
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body(first).accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie(first))
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body(second).accessToken}`)
      .expect(200);
    expect(
      await prisma.userSession.count({ where: { revokedAt: { not: null } } }),
    ).toBe(1);
  });

  it('rejects login, refresh and access for a deleted user', async () => {
    const response = await register();
    await prisma.user.update({
      where: { id: body(response).user.id },
      data: { deletedAt: new Date() },
    });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: payload.email, password: payload.password })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie(response))
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body(response).accessToken}`)
      .expect(401);
  });

  it('rejects expired sessions for both access and refresh', async () => {
    const response = await register();
    await prisma.userSession.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie(response))
      .expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${body(response).accessToken}`)
      .expect(401);
  });

  it('can refresh when the access token has expired', async () => {
    const response = await register();
    const claims = jwt.decode<{ sub: string; sid: string }>(
      body(response).accessToken,
    );
    const expired = jwt.sign(
      { sub: claims.sub, sid: claims.sid, type: 'access' },
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie(response))
      .expect(200);
  });

  it.each([undefined, 'Bearer invalid', 'Basic invalid'])(
    'protects me and logout from invalid authorization %p',
    async (authorization) => {
      for (const endpoint of ['/auth/me', '/auth/logout']) {
        const call = endpoint.endsWith('me')
          ? request(app.getHttpServer()).get(endpoint)
          : request(app.getHttpServer()).post(endpoint);
        if (authorization) call.set('Authorization', authorization);
        await call.expect(401);
      }
    },
  );

  it('rejects missing or malformed refresh cookies', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=invalid')
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${'a'.repeat(43)}`)
      .expect(401);
  });

  it('rejects untrusted origins before creating or rotating sessions', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', 'https://attacker.example')
      .send(payload)
      .expect(403);
    expect(await prisma.user.count()).toBe(0);
    const response = await register();
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Cookie', refreshCookie(response))
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('Cookie', refreshCookie(response))
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', origin)
      .set('Cookie', refreshCookie(response))
      .expect(200);
  });
});
