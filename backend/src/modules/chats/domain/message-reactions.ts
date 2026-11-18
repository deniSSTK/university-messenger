import type { ReactionCount, ReactionType } from '@university-messenger/events';

type SetReactionInput = {
  chatId: string;
  messageId: string;
  userId: string;
  type: ReactionType | null;
};
type ReactionSnapshot = {
  reactionVersion: number;
  reactions: ReactionCount[];
  selections: { userId: string; type: ReactionType }[];
  recipients: string[];
  changed: boolean;
};

export type { SetReactionInput, ReactionSnapshot };
