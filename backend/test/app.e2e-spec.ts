import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureApp } from '../src/configure-app.js';
import { AUTH_EXAMPLES } from '../src/modules/auth/delivery/http/dto/auth.examples.js';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AuthService } from '../src/modules/auth/service/auth.service.js';
import {
  DuplicateUserError,
  InvalidCredentialsError,
} from '../src/modules/auth/domain/auth.errors.js';
import { AUTH_USER_EXAMPLE } from '../src/modules/auth/delivery/http/dto/auth.examples.js';

describe('API documentation (e2e)', () => {
  let app: INestApplication<App>;
  const previousDatabase = {
    JWT_ACCESS_TOKEN_TTL: process.env.JWT_ACCESS_TOKEN_TTL,
    JWT_SESSION_TTL: process.env.JWT_SESSION_TTL,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
  };
  const previousSecret = process.env.JWT_SECRET;
  const previousOrigin = process.env.FRONTEND_ORIGIN;

  beforeAll(() => {
    process.env.JWT_ACCESS_TOKEN_TTL = '900';
    process.env.JWT_SESSION_TTL = '604800000';
    process.env.DB_USER = 'test-user';
    process.env.DB_PASSWORD = 'test-password';
    process.env.DB_NAME = 'test-db';
    process.env.JWT_SECRET = 'test-only-secret-at-least-32-bytes-long';
    process.env.FRONTEND_ORIGIN = 'https://app.example.com';
  });

  afterAll(() => {
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

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('allows same-origin Swagger requests to reach input validation', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({})
      .expect(400);
  });

  it('rejects requests from an untrusted website', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'https://attacker.example')
      .set('Sec-Fetch-Site', 'cross-site')
      .send({})
      .expect(403);
  });

  it('serves Swagger UI', async () => {
    await request(app.getHttpServer())
      .get('/docs/')
      .expect(200)
      .expect('Content-Type', /html/);
  });

  it('maps duplicate-user domain errors to HTTP 409', async () => {
    jest
      .spyOn(app.get(AuthService), 'register')
      .mockRejectedValueOnce(new DuplicateUserError());

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: AUTH_EXAMPLES.email,
        password: AUTH_EXAMPLES.password,
        username: AUTH_EXAMPLES.username,
        displayName: AUTH_EXAMPLES.displayName,
      })
      .expect(409)
      .expect({
        statusCode: 409,
        message: 'Email or username already in use',
        error: 'Conflict',
      });
  });

  it('maps invalid-credentials domain errors to HTTP 401', async () => {
    jest
      .spyOn(app.get(AuthService), 'login')
      .mockRejectedValueOnce(new InvalidCredentialsError());

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AUTH_EXAMPLES.email, password: AUTH_EXAMPLES.password })
      .expect(401)
      .expect({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
  });

  it('maps service results to a public response and an HttpOnly cookie', async () => {
    jest.spyOn(app.get(AuthService), 'login').mockResolvedValueOnce({
      user: {
        ...AUTH_USER_EXAMPLE,
        createdAt: new Date(AUTH_USER_EXAMPLE.createdAt),
        updatedAt: new Date(AUTH_USER_EXAMPLE.updatedAt),
      },
      accessToken: AUTH_EXAMPLES.accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: AUTH_EXAMPLES.email, password: AUTH_EXAMPLES.password })
      .expect(200);

    expect(response.body).toEqual({
      user: AUTH_USER_EXAMPLE,
      accessToken: AUTH_EXAMPLES.accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(JSON.stringify(response.body)).not.toContain('test-refresh-token');
  });

  it('documents auth schemas, examples and security without exposing secrets', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as OpenAPIObject;
    const schemas = document.components?.schemas;

    expect(document.paths).not.toHaveProperty('/');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/auth/register',
        '/auth/login',
        '/auth/refresh',
        '/auth/logout',
        '/auth/me',
      ]),
    );
    expect(schemas?.LoginDto).toMatchObject({
      properties: { email: { example: AUTH_EXAMPLES.email } },
      required: ['email', 'password'],
    });
    expect(schemas?.RegisterDto).toMatchObject({
      properties: { username: { example: AUTH_EXAMPLES.username } },
    });
    expect(schemas?.AuthResponseDto).toMatchObject({
      properties: {
        user: {
          allOf: [{ $ref: '#/components/schemas/PublicUserDto' }],
          example: { email: AUTH_EXAMPLES.email },
        },
      },
    });
    expect(document.paths['/auth/me'].get?.security).toEqual([{ bearer: [] }]);
    expect(document.paths['/auth/refresh'].post?.security).toEqual([
      { cookie: [] },
    ]);
    expect(document.paths['/auth/logout'].post?.responses).toHaveProperty(
      '204',
    );
    expect(document.components?.securitySchemes).toMatchObject({
      cookie: { in: 'cookie', name: 'refreshToken' },
      bearer: { type: 'http', scheme: 'bearer' },
    });
    expect(JSON.stringify(schemas?.PublicUserDto)).not.toMatch(
      /passwordHash|tokenHash/,
    );
    expect(JSON.stringify(document)).not.toContain(process.env.JWT_SECRET);
  });

  afterEach(async () => {
    await app?.close();
  });
});
