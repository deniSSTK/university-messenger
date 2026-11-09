type LegacyAttachment = {
  id: string;
  chatId: string;
  bytes: Uint8Array;
  mediaType: string;
};
type LegacyAvatar = { userId: string; dataUrl: string };
interface LegacyMediaRepository {
  attachments(afterId?: string): Promise<LegacyAttachment[]>;
  avatars(afterId?: string): Promise<LegacyAvatar[]>;
  saveAttachmentKey(id: string, key: string): Promise<boolean>;
  saveAvatarKey(
    userId: string,
    expectedDataUrl: string,
    key: string,
  ): Promise<boolean>;
}
export type { LegacyAttachment, LegacyAvatar, LegacyMediaRepository };
