import { Injectable, inject } from '@angular/core';
import { map, of, throwError } from 'rxjs';
import { USERS_REPOSITORY } from '../repository/users.repository';
interface SearchUsersInput {
  search: string;
  page: number;
}
interface SearchUserResult {
  id: string;
  username: string;
  displayName: string;
}
interface SearchUsersResult {
  users: SearchUserResult[];
  page: number;
  totalPages: number;
}
class UserSearchValidationError extends Error {}

@Injectable({ providedIn: 'root' })
class Users {
  private repository = inject(USERS_REPOSITORY);

  search(input: SearchUsersInput) {
    const query = input.search.trim().replace(/^@/, '').toLowerCase();

    if (!input.search.trim()) {
      return of<SearchUsersResult>({ users: [], page: 1, totalPages: 0 });
    }

    if (!/^[a-z0-9_]{1,32}$/.test(query)) {
      return throwError(() => new UserSearchValidationError());
    }

    return this.repository.search({ query, page: input.page, limit: 20 }).pipe(
      map((result): SearchUsersResult => ({
        users: result.users.map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
        })),
        page: result.page,
        totalPages: result.totalPages,
      })),
    );
  }
}
export { Users, UserSearchValidationError };
export type { SearchUsersInput, SearchUsersResult, SearchUserResult };
