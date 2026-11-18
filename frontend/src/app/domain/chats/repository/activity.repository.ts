import type { ReactionState } from '@university-messenger/events';
import { WebSocketEventType } from '@university-messenger/events';
import { InjectionToken } from '@angular/core';
type ActivityRecord = {
  type:
    | WebSocketEventType.Ready
    | WebSocketEventType.Offline
    | WebSocketEventType.Changed
    | WebSocketEventType.Typing
    | WebSocketEventType.Reaction;
  chatId?: string;
  userId?: string;
  typing?: boolean;
  reaction?: ReactionState & { messageId: string };
};
type FileRecord = { name: string; mediaType: string; bytes: Uint8Array; replyToId?: string };
interface ActivityRepository {
  upload(chatId: string, file: FileRecord): Promise<void>;
  download(chatId: string, messageId: string): Promise<FileRecord>;
  watch(listener: (event: ActivityRecord) => void): () => void;
  typing(chatId: string, typing: boolean): void;
  edit(chatId: string, messageId: string, text: string): Promise<void>;
  remove(chatId: string, messageId: string): Promise<void>;
  read(chatId: string, messageId: string): Promise<void>;
}
const ACTIVITY_REPOSITORY = new InjectionToken<ActivityRepository>('ACTIVITY_REPOSITORY');

export { ACTIVITY_REPOSITORY };
export type { ActivityRepository, ActivityRecord, FileRecord };
