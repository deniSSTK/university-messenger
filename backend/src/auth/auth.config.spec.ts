import { AuthConfig } from './auth.config.js';

describe('AuthConfig', () => {
  const previous = {
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-only-secret-at-least-32-bytes-long';
    process.env.NODE_ENV = 'test';
    delete process.env.FRONTEND_ORIGIN;
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it.each([undefined, '', 'short'])(
    'rejects insecure JWT secrets %p',
    (secret) => {
      if (secret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = secret;
      expect(() => new AuthConfig()).toThrow('JWT_SECRET');
    },
  );

  it('allows the default Angular origin during local development', () => {
    const config = new AuthConfig();
    expect(config.frontendOrigin).toBe('http://localhost:4200');
    expect(config.secureCookies).toBe(false);
  });

  it('requires HTTPS and enables secure cookies in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new AuthConfig()).toThrow('FRONTEND_ORIGIN');
    process.env.FRONTEND_ORIGIN = 'https://app.example.com';
    expect(new AuthConfig().secureCookies).toBe(true);
  });

  it.each([
    'https://app.example.com/path',
    'https://app.example.com?query=1',
    'https://user:pass@app.example.com',
    'ftp://app.example.com',
  ])('rejects invalid frontend origins %s', (origin) => {
    process.env.FRONTEND_ORIGIN = origin;
    expect(() => new AuthConfig()).toThrow('FRONTEND_ORIGIN');
  });
});
