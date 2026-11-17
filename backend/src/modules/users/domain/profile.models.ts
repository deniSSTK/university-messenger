import type { ReactionType } from '@university-messenger/events';

type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  defaultReaction?: ReactionType;
  avatarKey?: string | null;
};
type ProfileUpdate = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  defaultReaction?: ReactionType;
  avatarKey?: string | null;
};
type ProfileUpdateResult = {
  profile: UserProfile;
  previousAvatarKey: string | null;
};
class InvalidProfileError extends Error {}

export { InvalidProfileError };
export type { UserProfile, ProfileUpdate, ProfileUpdateResult };
