import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageConfig } from '../../../core/config/storage.config.js';
import { MediaUnavailableError } from '../domain/object-storage.port.js';
import type {
  ObjectStorage,
  StoredObjectInput,
} from '../domain/object-storage.port.js';
class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  constructor(private readonly config: StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    });
  }
  async put(input: StoredObjectInput): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: input.key,
          Body: input.bytes,
          ContentType: input.mediaType,
        }),
      );
    } catch {
      throw new MediaUnavailableError();
    }
  }
  async get(key: string): Promise<Uint8Array> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );

      if (!result.Body) {
        throw new MediaUnavailableError();
      }

      return await result.Body.transformToByteArray();
    } catch {
      throw new MediaUnavailableError();
    }
  }
  async remove(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
    } catch {
      throw new MediaUnavailableError();
    }
  }
  async url(key: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
        { expiresIn: this.config.signedUrlTtl },
      );
    } catch {
      throw new MediaUnavailableError();
    }
  }
  onModuleDestroy(): void {
    this.client.destroy();
  }
}
export { S3ObjectStorage };
