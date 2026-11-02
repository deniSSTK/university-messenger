import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpHeaders } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { HttpClient } from './http-client.service';
import { SessionService } from './session.service';
import { environment } from '../../../environments/environment';

import { refreshResponse } from './session.test-data';

const api = environment.apiUrl;
async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('authenticated HTTP client', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let session: SessionService;
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.setAccessToken('old-token');
  });

  afterEach(() => {
    http.verify();
  });

  it('preserves body, method, credentials, headers and params on retry', async () => {
    const result = vi.fn();
    client
      .patch(
        `${api}/profile`,
        { displayName: 'Alice' },
        {
          headers: new HttpHeaders({ 'X-Test': 'value' }),
          params: { page: 2 },
          withCredentials: true,
        },
      )
      .subscribe(result);
    const first = http.expectOne(`${api}/profile?page=2`);
    expect(first.request.headers.get('Authorization')).toBe('Bearer old-token');
    first.flush(null, { status: 401, statusText: 'Unauthorized' });
    const refresh = http.expectOne(`${api}/auth/refresh`);
    expect(refresh.request.withCredentials).toBe(true);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    expect(refresh.request.body).toBeNull();
    refresh.flush(refreshResponse);
    await settle();
    const retry = http.expectOne(`${api}/profile?page=2`);
    expect(retry.request.method).toBe('PATCH');
    expect(retry.request.body).toEqual({ displayName: 'Alice' });
    expect(retry.request.headers.get('X-Test')).toBe('value');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    expect(retry.request.withCredentials).toBe(true);
    retry.flush({ ok: true });
    expect(result).toHaveBeenCalledWith({ ok: true });
  });

  it.each([`${api}/auth/login`, 'https://third-party.example/data'])(
    'does not authenticate or refresh public/foreign requests: %s',
    (url) => {
      const error = vi.fn();
      client
        .post(url, {}, { isPrivate: url.includes('/auth/login') ? false : true })
        .subscribe({ error });
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush(null, { status: 401, statusText: 'Unauthorized' });
      http.expectNone(`${api}/auth/refresh`);
      expect(error).toHaveBeenCalledOnce();
    },
  );

  it('shares refresh, waits before new requests, and handles a late old-token 401', async () => {
    client.get(`${api}/one`).subscribe();
    client.get(`${api}/two`).subscribe();
    client.get(`${api}/late`).subscribe();
    const first = http.expectOne(`${api}/one`);
    const second = http.expectOne(`${api}/two`);
    const late = http.expectOne(`${api}/late`);
    first.flush(null, { status: 401, statusText: 'Unauthorized' });
    second.flush(null, { status: 401, statusText: 'Unauthorized' });
    client.get(`${api}/new`).subscribe();
    http.expectNone(`${api}/new`);
    http.expectOne(`${api}/auth/refresh`).flush(refreshResponse);
    await settle();
    for (const path of ['one', 'two', 'new']) {
      const retry = http.expectOne(`${api}/${path}`);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
      retry.flush({});
    }
    late.flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectNone(`${api}/auth/refresh`);
    http.expectOne(`${api}/late`).flush({});
  });

  it('continues refresh after its first consumer unsubscribes', async () => {
    const owner = client.get(`${api}/one`).subscribe();
    http.expectOne(`${api}/one`).flush(null, { status: 401, statusText: 'Unauthorized' });
    const refresh = http.expectOne(`${api}/auth/refresh`);
    const result = vi.fn();
    client.get(`${api}/two`).subscribe(result);
    owner.unsubscribe();
    expect(refresh.cancelled).toBe(false);
    refresh.flush(refreshResponse);
    await settle();
    http.expectNone(`${api}/one`);
    http.expectOne(`${api}/two`).flush({ ok: true });
    expect(result).toHaveBeenCalledWith({ ok: true });
  });

  it('limits the original request to three retries', async () => {
    const error = vi.fn();
    client.get(`${api}/private`).subscribe({ error });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      http.expectOne(`${api}/private`).flush(null, { status: 401, statusText: 'Unauthorized' });
      if (attempt < 3) {
        http
          .expectOne(`${api}/auth/refresh`)
          .flush({ ...refreshResponse, accessToken: `token-${attempt}` });
        await settle();
      }
    }
    http.expectNone(`${api}/auth/refresh`);
    expect(error).toHaveBeenCalledOnce();
  });

  it('clears the session and redirects once for a shared refresh 401', async () => {
    const error = vi.fn();
    client.get(`${api}/one`).subscribe({ error });
    http.expectOne(`${api}/one`).flush(null, { status: 401, statusText: 'Unauthorized' });
    client.get(`${api}/two`).subscribe({ error });
    http.expectOne(`${api}/auth/refresh`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();
    expect(session.getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it('keeps the session on temporary refresh failure and permits a later refresh', async () => {
    const error = vi.fn();
    client.get(`${api}/one`).subscribe({ error });
    http.expectOne(`${api}/one`).flush(null, { status: 401, statusText: 'Unauthorized' });
    client.get(`${api}/two`).subscribe({ error });
    http.expectOne(`${api}/auth/refresh`).flush(null, { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(error).toHaveBeenCalledTimes(2);
    expect(session.getAccessToken()).toBe('old-token');
    expect(navigate).not.toHaveBeenCalled();
    client.get(`${api}/next`).subscribe();
    http.expectOne(`${api}/next`).flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${api}/auth/refresh`).flush(refreshResponse);
    await settle();
    http.expectOne(`${api}/next`).flush({});
  });

  it.each([400, 403, 500])('does not retry ordinary HTTP %s failures', (status) => {
    const error = vi.fn();
    client.get(`${api}/one`).subscribe({ error });
    http.expectOne(`${api}/one`).flush(null, { status, statusText: 'Error' });
    expect(error).toHaveBeenCalledOnce();
    http.expectNone(`${api}/auth/refresh`);
  });
});
