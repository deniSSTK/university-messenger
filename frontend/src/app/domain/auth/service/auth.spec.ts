import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Auth, AuthError } from './auth';
import { AUTH_REPOSITORY } from '../repository/auth.repository';
import { AuthHttpAdapter } from '../repository/http/auth-http.adapter';
import { SessionService } from '../../../core/http/session.service';
import { environment } from '../../../../environments/environment';
import { refreshResponse } from '../../../core/http/session.test-data';

const api = environment.apiUrl;

describe('auth API integration', () => {
  let auth: Auth;
  let http: HttpTestingController;
  let session: SessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: AUTH_REPOSITORY, useExisting: AuthHttpAdapter },
      ],
    });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
  });

  afterEach(() => {
    http.verify();
  });

  it('normalizes registration fields, preserves email casing and sends only API fields', async () => {
    const result = auth.register({
      email: ' User@Example.com ',
      username: ' Alice ',
      displayName: ' Alice Smith ',
      password: ' password ',
    });
    const request = http.expectOne(`${api}/auth/register`);
    expect(request.request.body).toEqual({
      email: 'User@Example.com',
      username: 'alice',
      displayName: 'Alice Smith',
      password: ' password ',
    });
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(refreshResponse);
    await result;
    expect(session.getAccessToken()).toBe('new-token');
  });

  it('restores from a cookie even without a stored access token', async () => {
    const result = auth.restoreSession();
    const other = auth.restoreSession();
    const request = http.expectOne(`${api}/auth/refresh`);
    expect(request.request.withCredentials).toBe(true);
    request.flush(refreshResponse);
    expect(await result).toBe(true);
    expect(await other).toBe(true);
    expect(session.getAccessToken()).toBe('new-token');
  });

  it('rejects a missing session instead of trusting legacy localStorage', async () => {
    localStorage.setItem('access_token', 'arbitrary-string');
    const result = auth.restoreSession();
    http.expectOne(`${api}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await result).toBe(false);
    expect(session.getAccessToken()).toBeNull();
    expect(await auth.restoreSession()).toBe(false);
    localStorage.removeItem('access_token');
  });

  it('logs out on the server with bearer and cookie before clearing local state', async () => {
    session.setAccessToken('access');
    const result = auth.logout();
    const request = http.expectOne(`${api}/auth/logout`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access');
    expect(request.request.withCredentials).toBe(true);
    expect(session.getAccessToken()).toBe('access');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await result;
    expect(session.getAccessToken()).toBeNull();
  });

  it('maps API failures to business errors', async () => {
    const result = auth.login({ email: 'User@example.com', password: 'password123' });
    const assertion = expect(result).rejects.toEqual(new AuthError('credentials'));
    http.expectOne(`${api}/auth/login`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await assertion;
    http.expectNone(`${api}/auth/refresh`);
  });

  it('keeps the session when server logout is temporarily unavailable', async () => {
    session.setAccessToken('access');
    const result = auth.logout();
    const assertion = expect(result).rejects.toEqual(new AuthError('unavailable'));
    http.expectOne(`${api}/auth/logout`).flush(null, { status: 503, statusText: 'Unavailable' });
    await assertion;
    expect(session.getAccessToken()).toBe('access');
  });
});
