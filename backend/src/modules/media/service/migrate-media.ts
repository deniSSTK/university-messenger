import { randomUUID } from 'node:crypto';
import { isAvatarDataUrl } from '../../../common/utils/image-data.js';
import type { ObjectStorage } from '../domain/object-storage.port.js';
import type { LegacyMediaRepository } from '../domain/legacy-media.repository.js';
class MediaMigration {
  constructor(
    private readonly repository: LegacyMediaRepository,
    private readonly storage: ObjectStorage,
  ) {}
  async run(): Promise<{ attachments: number; avatars: number }> {
    let attachments = 0;
    let avatars = 0;
    let afterId: string | undefined;
    while (true) {
      const batch = await this.repository.attachments(afterId);

      if (!batch.length) {
        break;
      }

      for (const file of batch) {
        const key = `attachments/${file.chatId}/${randomUUID()}`;
        await this.storage.put({
          key,
          bytes: file.bytes,
          mediaType: file.mediaType,
        });

        try {
          if (await this.repository.saveAttachmentKey(file.id, key)) {
            attachments++;
          } else {
            await this.storage.remove(key);
          }
        } catch (error: unknown) {
          await this.storage.remove(key).catch(() => undefined);
          throw error;
        }

        afterId = file.id;
      }
    }

    afterId = undefined;
    while (true) {
      const batch = await this.repository.avatars(afterId);

      if (!batch.length) {
        break;
      }

      for (const avatar of batch) {
        if (!isAvatarDataUrl(avatar.dataUrl)) {
          throw new Error(`Invalid legacy avatar for ${avatar.userId}`);
        }

        const key = `avatars/${avatar.userId}/${randomUUID()}`;
        await this.storage.put({
          key,
          bytes: Buffer.from(
            avatar.dataUrl.slice(avatar.dataUrl.indexOf(',') + 1),
            'base64',
          ),
          mediaType: avatar.dataUrl.slice(5, avatar.dataUrl.indexOf(';')),
        });

        try {
          if (
            await this.repository.saveAvatarKey(
              avatar.userId,
              avatar.dataUrl,
              key,
            )
          ) {
            avatars++;
          } else {
            await this.storage.remove(key);
          }
        } catch (error: unknown) {
          await this.storage.remove(key).catch(() => undefined);
          throw error;
        }

        afterId = avatar.userId;
      }
    }

    return { attachments, avatars };
  }
}
export { MediaMigration };
