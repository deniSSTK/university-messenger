import type { ObjectStorage } from '../domain/object-storage.port.js';
import type { LegacyMediaRepository } from '../domain/legacy-media.repository.js';
import { MediaMigration } from './migrate-media.js';
describe('MediaMigration', () => {
  const repository: jest.Mocked<LegacyMediaRepository> = {
    attachments: jest.fn(),
    avatars: jest.fn(),
    saveAttachmentKey: jest.fn(),
    saveAvatarKey: jest.fn(),
  };
  const storage: jest.Mocked<ObjectStorage> = {
    put: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
    url: jest.fn(),
  };
  beforeEach(() => {
    jest.resetAllMocks();
    repository.attachments.mockResolvedValue([]);
    repository.avatars.mockResolvedValue([]);
    storage.put.mockResolvedValue(undefined);
    storage.remove.mockResolvedValue(undefined);
  });
  it('uploads before committing the key and skips already migrated rows on another run', async () => {
    const order: string[] = [];
    repository.attachments.mockResolvedValueOnce([
      {
        id: 'message',
        chatId: 'chat',
        bytes: new Uint8Array([1]),
        mediaType: 'text/plain',
      },
    ]);
    storage.put.mockImplementation(async () => {
      await Promise.resolve();
      order.push('put');
    });
    repository.saveAttachmentKey.mockImplementation(async () => {
      await Promise.resolve();
      order.push('commit');

      return true;
    });
    const migration = new MediaMigration(repository, storage);
    await expect(migration.run()).resolves.toEqual({
      attachments: 1,
      avatars: 0,
    });
    expect(order).toEqual(['put', 'commit']);
    await expect(migration.run()).resolves.toEqual({
      attachments: 0,
      avatars: 0,
    });
    expect(storage.put.mock.calls).toHaveLength(1);
  });
  it('does not clear legacy data after an S3 error and removes an object after database failure', async () => {
    const row = {
      id: 'message',
      chatId: 'chat',
      bytes: new Uint8Array([1]),
      mediaType: 'text/plain',
    };
    repository.attachments.mockResolvedValueOnce([row]);
    storage.put.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(new MediaMigration(repository, storage).run()).rejects.toThrow(
      'storage unavailable',
    );
    expect(repository.saveAttachmentKey.mock.calls).toHaveLength(0);
    repository.attachments.mockResolvedValueOnce([row]);
    repository.saveAttachmentKey.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(new MediaMigration(repository, storage).run()).rejects.toThrow(
      'database unavailable',
    );
    expect(storage.remove.mock.calls).toHaveLength(1);
  });
});
