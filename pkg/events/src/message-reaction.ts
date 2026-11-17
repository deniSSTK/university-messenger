const REACTION_TYPES = [
  'HEART',
  'CLOWN',
  'THUMBS_UP',
  'THUMBS_DOWN',
  'FIRE',
  'SMILING_FACE_WITH_HEARTS',
  'CLAP',
] as const;

type ReactionType = (typeof REACTION_TYPES)[number];
type ReactionCount = { type: ReactionType; count: number };
type ReactionState = {
  reactionVersion: number;
  reactions: ReactionCount[];
  myReaction: ReactionType | null;
};

function isReactionType(value: unknown): value is ReactionType {
  return REACTION_TYPES.some((type) => type === value);
}

export { REACTION_TYPES, isReactionType };
export type { ReactionType, ReactionCount, ReactionState };
