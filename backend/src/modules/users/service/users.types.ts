import type { ReactionType } from '@university-messenger/events';

type SearchUsersInput = {
  currentUserId: string;
  search: string;
  page: number;
  limit: number;
};

type SearchUserResult = {
  id: string;
  username: string;
  displayName: string;
};

type SearchUsersResult = {
  items: SearchUserResult[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type UpdateProfileInput = {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  defaultReaction?: ReactionType;
};
type ProfileResult = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  defaultReaction?: ReactionType;
};

export type {
  SearchUsersInput,
  SearchUserResult,
  SearchUsersResult,
  UpdateProfileInput,
  ProfileResult,
};
