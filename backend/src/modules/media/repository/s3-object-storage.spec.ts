import { Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3ObjectStorage } from './s3-object-storage.js';
import { MediaUnavailableError } from '../domain/object-storage.port.js';
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
describe('S3ObjectStorage', () => {
  const config = {
    bucket: 'messenger-test',
    region: 'us-east-1',
    forcePathStyle: false,
    signedUrlTtl: 900,
  };
  afterEach(() => jest.restoreAllMocks());
  it('writes bytes with the configured bucket/key and content type without public ACLs', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({ $metadata: {} });
    const storage = new S3ObjectStorage(config);
    const bytes = new Uint8Array([72, 105]);
    await storage.put({
      key: 'attachments/chat/object',
      bytes,
      mediaType: 'text/plain',
    });
    const command = send.mock.calls[0][0];

    if (!(command instanceof PutObjectCommand)) {
      throw new Error('Expected PutObjectCommand');
    }

    expect(command.input).toEqual({
      Bucket: config.bucket,
      Key: 'attachments/chat/object',
      Body: bytes,
      ContentType: 'text/plain',
    });
    storage.onModuleDestroy();
  });
  it('consumes download streams and signs short-lived avatar links', async () => {
    const body = Object.assign(Readable.from([]), {
      transformToByteArray: async () => {
        await Promise.resolve();

        return new Uint8Array([72, 105]);
      },
      transformToString: async () => {
        await Promise.resolve();

        return 'Hi';
      },
      transformToWebStream: () => new ReadableStream<Uint8Array>(),
    });
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({ $metadata: {}, Body: body });
    jest
      .mocked(getSignedUrl)
      .mockResolvedValue('https://storage.example/avatar?signed=true');
    const storage = new S3ObjectStorage(config);
    await expect(storage.get('attachments/chat/object')).resolves.toEqual(
      new Uint8Array([72, 105]),
    );
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    await expect(storage.url('avatars/user/object')).resolves.toContain(
      'signed=true',
    );
    expect(jest.mocked(getSignedUrl).mock.calls[0][2]).toEqual({
      expiresIn: 900,
    });
    storage.onModuleDestroy();
  });
  it('deletes failed uploads and translates provider errors without leaking credentials', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({ $metadata: {} })
      .mockRejectedValueOnce(
        new Error('Provider credentials and internal details'),
      );
    const storage = new S3ObjectStorage(config);
    await storage.remove('attachments/chat/object');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    await expect(storage.get('missing')).rejects.toEqual(
      new MediaUnavailableError(),
    );
    storage.onModuleDestroy();
  });
});
