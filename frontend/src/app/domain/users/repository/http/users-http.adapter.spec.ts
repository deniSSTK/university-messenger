import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UsersHttpAdapter } from './users-http.adapter';
import { USERS_REPOSITORY, UsersRepositoryError } from '../users.repository';
import { Users, UserSearchValidationError } from '../../service/users';
import { SessionService } from '../../../../core/http/session.service';
import { environment } from '../../../../../environments/environment';

describe('user search HTTP adapter', () => {
  let users: Users;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: USERS_REPOSITORY, useExisting: UsersHttpAdapter },
      ],
    });
    users = TestBed.inject(Users);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionService).setAccessToken('search-token');
  });
  afterEach(() => http.verify());

  it('normalizes @ and whitespace, sends paging and bearer, and maps public users', async () => {
    const result = firstValueFrom(users.search({ search: '  @ALEX  ', page: 2 }));
    const request = http.expectOne((request) => request.url === `${environment.apiUrl}/users`);
    expect(request.request.params.get('search')).toBe('alex');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    expect(request.request.headers.get('Authorization')).toBe('Bearer search-token');
    request.flush({
      items: [{ id: 'alex-id', username: 'alex', displayName: 'Alex' }],
      meta: { page: 2, limit: 20, total: 23, totalPages: 2 },
    });
    expect(await result).toEqual({
      users: [{ id: 'alex-id', username: 'alex', displayName: 'Alex' }],
      page: 2,
      totalPages: 2,
    });
  });
  it('does not issue a request for whitespace-only input', async () => {
    expect(await firstValueFrom(users.search({ search: '   ', page: 1 }))).toEqual({
      users: [],
      page: 1,
      totalPages: 0,
    });
    http.expectNone(() => true);
  });
  it.each(['@', '@@alex', 'a b', 'a'.repeat(33)])(
    'rejects invalid input %s without HTTP',
    async (search) => {
      await expect(firstValueFrom(users.search({ search, page: 1 }))).rejects.toBeInstanceOf(
        UserSearchValidationError,
      );
      http.expectNone(() => true);
    },
  );
  it('allows cancellation of obsolete requests', () => {
    const subscription = users.search({ search: 'alex', page: 1 }).subscribe();
    const request = http.expectOne((request) => request.url.endsWith('/users'));
    subscription.unsubscribe();
    expect(request.cancelled).toBe(true);
  });
  it('maps transport errors without clearing the session', async () => {
    const result = firstValueFrom(users.search({ search: 'alex', page: 1 }));
    const assertion = expect(result).rejects.toBeInstanceOf(UsersRepositoryError);
    http
      .expectOne((request) => request.url.endsWith('/users'))
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await assertion;
    expect(TestBed.inject(SessionService).getAccessToken()).toBe('search-token');
  });
});
