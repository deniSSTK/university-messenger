import type { NicknameColor, ReactionType } from '@university-messenger/events';
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
type AliasRecord = { targetUserId: string; nickname: string; color: NicknameColor };

interface UsersRepository {
  listAliases(): Observable<AliasRecord[]>;
  saveAlias(
    targetUserId: string,
    input: Omit<AliasRecord, 'targetUserId'>,
  ): Observable<AliasRecord>;
  deleteAlias(targetUserId: string): Observable<void>;
  updateProfile(input: UpdateProfileRepositoryInput): Observable<void>;
  search(input: SearchUsersRepositoryInput): Observable<SearchUsersRepositoryResult>;
}
const USERS_REPOSITORY = new InjectionToken<UsersRepository>('USERS_REPOSITORY');
export { USERS_REPOSITORY, UsersRepositoryError };
export type {
  AliasRecord,
  UsersRepository,
  SearchUsersRepositoryInput,
  SearchUsersRepositoryResult,
  UpdateProfileRepositoryInput,
};
