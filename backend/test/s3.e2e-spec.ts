import { createServer, type Server } from 'node:http';
import { S3ObjectStorage } from '../src/modules/media/repository/s3-object-storage.js';
import { MediaUnavailableError } from '../src/modules/media/domain/object-storage.port.js';

describe('S3 SDK transport (local HTTP fixture, no AWS account)', () => {
  let server: Server;
  let endpoint: string;
  let storage: S3ObjectStorage;
  const objects = new Map<string, Buffer>();
  const authorization: string[] = [];
  const previous = {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
  };

  beforeAll(async () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
    delete process.env.AWS_SESSION_TOKEN;
    server = createServer((request, response) => {
      void (async () => {
        const key = new URL(request.url ?? '/', 'http://localhost').pathname;
        authorization.push(request.headers.authorization ?? '');

        if (request.method === 'PUT') {
          const chunks: Buffer[] = [];
          for await (const chunk of request) {
            if (!Buffer.isBuffer(chunk)) {
              throw new Error('Unexpected fixture body');
            }

            chunks.push(chunk);
          }

          objects.set(key, Buffer.concat(chunks));
          response.writeHead(200, { ETag: '"test-etag"' });
          response.end();
        } else if (request.method === 'GET' && objects.has(key)) {
          response.writeHead(200, {
            'Content-Type': 'application/octet-stream',
          });
          response.end(objects.get(key));
        } else if (request.method === 'DELETE') {
          objects.delete(key);
          response.writeHead(204);
          response.end();
        } else {
          response.writeHead(404, { 'Content-Type': 'application/xml' });
          response.end(
            '<Error><Code>NoSuchKey</Code><Message>Missing object</Message></Error>',
          );
        }
      })().catch(() => {
        response.writeHead(500);
        response.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('No fixture address');
    }

    endpoint = `http://127.0.0.1:${address.port}`;
    storage = new S3ObjectStorage({
      bucket: 'messenger-test',
      region: 'us-east-1',
      endpoint,
      forcePathStyle: true,
      signedUrlTtl: 120,
    });
  });

  afterAll(async () => {
    storage?.onModuleDestroy();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('uploads and reads exact bytes over signed SDK requests, presigns an avatar and deletes an object', async () => {
    const bytes = new Uint8Array([0, 1, 10, 128, 255]);
    await storage.put({
      key: 'attachments/chat/file',
      bytes,
      mediaType: 'application/octet-stream',
    });
    await expect(storage.get('attachments/chat/file')).resolves.toEqual(bytes);
    expect(
      authorization.every((value) => value.startsWith('AWS4-HMAC-SHA256 ')),
    ).toBe(true);
    const signed = new URL(await storage.url('avatars/user/image'));
    expect(signed.origin).toBe(endpoint);
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('120');
    expect(signed.searchParams.get('X-Amz-Signature')).toBeTruthy();
    await storage.remove('attachments/chat/file');
    await expect(storage.get('attachments/chat/file')).rejects.toEqual(
      new MediaUnavailableError(),
    );
    expect(objects.size).toBe(0);
  });
});
