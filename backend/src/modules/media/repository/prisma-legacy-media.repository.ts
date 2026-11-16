import type { PrismaClient } from '../../../generated/prisma/client.js';
import type {
  LegacyMediaRepository,
  LegacyAttachment,
  LegacyAvatar,
} from '../domain/legacy-media.repository.js';
class PrismaLegacyMediaRepository implements LegacyMediaRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async attachments(afterId?: string): Promise<LegacyAttachment[]> {
    const rows = await this.prisma.attachment.findMany({
      where: {
        fileData: { not: null },
        fileKey: null,
        message: { isNot: null },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 25,
      select: {
        id: true,
        message: { select: { chatId: true } },
        fileData: true,
        fileType: true,
      },
    });

    return rows.flatMap((row) =>
      row.fileData && row.message
        ? [
            {
              id: row.id,
              chatId: row.message.chatId,
              bytes: row.fileData,
              mediaType: row.fileType ?? 'application/octet-stream',
            },
          ]
        : [],
    );
  }
  async avatars(afterId?: string): Promise<LegacyAvatar[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        avatarKey: null,
        avatarUrl: { startsWith: 'data:image/' },
        ...(afterId ? { id: { gt: afterId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 25,
      select: { id: true, avatarUrl: true },
    });

    return rows.flatMap((row) =>
      row.avatarUrl ? [{ userId: row.id, dataUrl: row.avatarUrl }] : [],
    );
  }
  async saveAttachmentKey(id: string, key: string): Promise<boolean> {
    const result = await this.prisma.attachment.updateMany({
      where: { id, fileKey: null, fileData: { not: null } },
      data: { fileKey: key, fileData: null },
    });

    return result.count === 1;
  }
  async saveAvatarKey(
    userId: string,
    expectedDataUrl: string,
    key: string,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, avatarKey: null, avatarUrl: expectedDataUrl },
      data: { avatarKey: key, avatarUrl: null },
    });

    return result.count === 1;
  }
}
export { PrismaLegacyMediaRepository };
