import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError } from 'rxjs';
import { HttpClient } from '../../../../core/http/http-client.service';
import { environment } from '../../../../../environments/environment';
import { UsersRepositoryError } from '../users.repository';
import type { UsersRepository, SearchUsersRepositoryInput } from '../users.repository';

interface SearchUsersHttpResponse {
  items: { id: string; username: string; displayName: string }[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
class UsersHttpAdapter implements UsersRepository {
  private http = inject(HttpClient);

  search(input: SearchUsersRepositoryInput) {
    return this.http
      .get<SearchUsersHttpResponse>(`${environment.apiUrl}/users`, {
        params: { search: input.query, page: input.page, limit: input.limit },
      })
      .pipe(
        map((response) => ({
          users: response.items.map((user) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
          })),
          page: response.meta.page,
          limit: response.meta.limit,
          totalPages: response.meta.totalPages,
        })),
        catchError(() => throwError(() => new UsersRepositoryError())),
      );
  }
}
export { UsersHttpAdapter };
