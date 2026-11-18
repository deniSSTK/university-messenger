import type { ProfileUpdateResult, ProfileUpdate } from './profile.models.js';
import type { UserSearchItem } from './users.models.js';
import type { UserAlias } from './user-alias.js';

type FindUsersInput = {
  usernamePrefix: string;
  excludedUserId: string;
  offset: number;
  take: number;
};

type FindUsersResult = {
  users: UserSearchItem[];
  total: number;
};

interface UsersRepository {
  listAliases(ownerId: string): Promise<UserAlias[]>;
  saveAlias(ownerId: string, alias: UserAlias): Promise<UserAlias | null>;
  deleteAlias(ownerId: string, targetUserId: string): Promise<void>;
  updateProfile(input: ProfileUpdate): Promise<ProfileUpdateResult>;
  findByUsernamePrefix(input: FindUsersInput): Promise<FindUsersResult>;
}

const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export { USERS_REPOSITORY };
export type { UsersRepository, FindUsersInput, FindUsersResult };
