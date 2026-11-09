import { readStorageConfig } from './storage.config.js';
describe('storage config', () => {
  const keys = [
    'S3_BUCKET',
    'S3_REGION',
    'S3_ENDPOINT',
    'S3_FORCE_PATH_STYLE',
    'S3_SIGNED_URL_TTL_SECONDS',
    'NODE_ENV',
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  beforeEach(() => {
    for (const key of keys) {
      delete process.env[key];
    }

    process.env.NODE_ENV = 'test';
  });
  afterAll(() => {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
  it('requires an explicit production bucket', () => {
    process.env.NODE_ENV = 'production';
    expect(() => readStorageConfig()).toThrow('S3_BUCKET');
  });
  it.each(['0', '-1', '3601', 'NaN'])(
    'rejects invalid signed URL lifetime %s',
    (value) => {
      process.env.S3_SIGNED_URL_TTL_SECONDS = value;
      expect(() => readStorageConfig()).toThrow();
    },
  );
  it('validates endpoint credentials and TLS', () => {
    process.env.S3_ENDPOINT = 'https://user:password@example.com';
    expect(() => readStorageConfig()).toThrow('S3_ENDPOINT');
    process.env.S3_BUCKET = 'messenger-test';
    process.env.NODE_ENV = 'production';
    process.env.S3_ENDPOINT = 'http://storage.example.com';
    expect(() => readStorageConfig()).toThrow('S3_ENDPOINT');
  });
});
