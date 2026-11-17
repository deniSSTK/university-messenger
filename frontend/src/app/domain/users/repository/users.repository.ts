import type { ReactionType } from '@university-messenger/events';
import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

interface SearchUsersRepositoryInput {
  query: string;
  page: number;
  limit: number;
}
interface UserRepositoryResult {
  id: string;
  username: string;
  displayName: string;
}
interface SearchUsersRepositoryResult {
  users: UserRepositoryResult[];
  page: number;
  limit: number;
  totalPages: number;
}
class UsersRepositoryError extends Error {}
interface UpdateProfileRepositoryInput {
  displayName: string;
  avatarUrl?: string | null;
  defaultReaction?: ReactionType;
}
interface UsersRepository {
  updateProfile(input: UpdateProfileRepositoryInput): Observable<void>;
  search(input: SearchUsersRepositoryInput): Observable<SearchUsersRepositoryResult>;
}
const USERS_REPOSITORY = new InjectionToken<UsersRepository>('USERS_REPOSITORY');
export { USERS_REPOSITORY, UsersRepositoryError };
export type {
  UsersRepository,
  SearchUsersRepositoryInput,
  SearchUsersRepositoryResult,
  UpdateProfileRepositoryInput,
};
