import type { UserSearchItem } from './users.models.js';

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
  findByUsernamePrefix(input: FindUsersInput): Promise<FindUsersResult>;
}

const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

export { USERS_REPOSITORY };
export type { UsersRepository, FindUsersInput, FindUsersResult };
