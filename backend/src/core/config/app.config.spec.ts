import { AppConfig } from './app.config.js';

describe('AppConfig', () => {
  const previous = {
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    S3_SIGNED_URL_TTL_SECONDS: process.env.S3_SIGNED_URL_TTL_SECONDS,
    AUTH_COOKIE_PATH: process.env.AUTH_COOKIE_PATH,
    JWT_ACCESS_TOKEN_TTL: process.env.JWT_ACCESS_TOKEN_TTL,
    JWT_SESSION_TTL: process.env.JWT_SESSION_TTL,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
  };

  beforeEach(() => {
    process.env.S3_BUCKET = 'messenger-test';
    delete process.env.S3_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_FORCE_PATH_STYLE;
    delete process.env.S3_SIGNED_URL_TTL_SECONDS;
    delete process.env.AUTH_COOKIE_PATH;
    process.env.JWT_ACCESS_TOKEN_TTL = '900';
    process.env.JWT_SESSION_TTL = '604800000';
    process.env.JWT_SECRET = 'test-only-secret-at-least-32-bytes-long';
    process.env.NODE_ENV = 'test';
    delete process.env.FRONTEND_ORIGIN;
    delete process.env.PORT;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    process.env.DB_USER = 'test-user';
    process.env.DB_PASSWORD = 'test-password';
    process.env.DB_NAME = 'test-db';
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it.each([undefined, '', 'short'])(
    'rejects insecure JWT secrets %p',
    (secret) => {
      if (secret === undefined) {
        delete process.env.JWT_SECRET;
      } else {
        process.env.JWT_SECRET = secret;
      }

      expect(() => new AppConfig()).toThrow('JWT_SECRET');
    },
  );

  it('allows the default Angular origin during local development', () => {
    const config = new AppConfig();
    expect(config.frontendOrigin).toBe('http://localhost:4200');
    expect(config.secureCookies).toBe(false);
  });

  it('requires HTTPS and enables secure cookies in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new AppConfig()).toThrow('FRONTEND_ORIGIN');
    process.env.FRONTEND_ORIGIN = 'https://app.example.com';
    expect(new AppConfig().secureCookies).toBe(true);
  });

  it('loads typed defaults and database settings', () => {
    const config = new AppConfig();

    expect(config.port).toBe(3000);
    expect(config.database).toEqual({
      user: 'test-user',
      password: 'test-password',
      database: 'test-db',
      host: 'localhost',
      port: 5432,
    });
  });

  it('loads custom server and database ports', () => {
    process.env.PORT = '8080';
    process.env.DB_PORT = '6012';

    const config = new AppConfig();

    expect(config.port).toBe(8080);
    expect(config.database.port).toBe(6012);
  });

  it('loads custom token and session lifetimes', () => {
    process.env.JWT_ACCESS_TOKEN_TTL = '120';
    process.env.JWT_SESSION_TTL = '3600000';

    const config = new AppConfig();

    expect(config.accessTokenTtl).toBe(120);
    expect(config.sessionTtl).toBe(3600000);
  });

  describe.each(['JWT_ACCESS_TOKEN_TTL', 'JWT_SESSION_TTL'])('%s', (name) => {
    it.each([
      undefined,
      '',
      '0',
      '-1',
      '1.5',
      'invalid',
      'Infinity',
      '9007199254740992',
    ])('rejects invalid duration %p', (value) => {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }

      expect(() => new AppConfig()).toThrow(name);
    });
  });

  it.each(['PORT', 'DB_PORT'])('rejects invalid %s', (name) => {
    process.env[name] = 'invalid';

    expect(() => new AppConfig()).toThrow(name);
  });

  it.each(['DB_USER', 'DB_PASSWORD', 'DB_NAME'])('requires %s', (name) => {
    delete process.env[name];

    expect(() => new AppConfig()).toThrow(name);
  });

  it.each([
    'https://app.example.com/path',
    'https://app.example.com?query=1',
    'https://user:pass@app.example.com',
    'ftp://app.example.com',
  ])('rejects invalid frontend origins %s', (origin) => {
    process.env.FRONTEND_ORIGIN = origin;
    expect(() => new AppConfig()).toThrow('FRONTEND_ORIGIN');
  });
  it('supports refresh cookies behind the production API prefix', () => {
    process.env.AUTH_COOKIE_PATH = '/api/auth';
    expect(new AppConfig().authCookiePath).toBe('/api/auth');
  });

  it('rejects unsupported cookie paths', () => {
    process.env.AUTH_COOKIE_PATH = '/';
    expect(() => new AppConfig()).toThrow('AUTH_COOKIE_PATH');
  });
});
