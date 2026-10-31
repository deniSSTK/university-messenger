import { Injectable, inject } from '@angular/core';
import {
  HttpClient as AngularHttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take, finalize, tap } from 'rxjs/operators';
import type { HttpRequestOptions } from './http.types';
import { SessionService } from './session.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
class HttpClient {
  private angularHttp = inject(AngularHttpClient);
  private session = inject(SessionService);
  private isRefreshing = false;
  private refreshState = new BehaviorSubject<RefreshState>({ status: 'idle' });

  get<T>(url: string, options?: HttpRequestOptions): Observable<T> {
    return this.request<T>('GET', url, null, options);
  }

  post<T>(url: string, body: unknown, options?: HttpRequestOptions): Observable<T> {
    return this.request<T>('POST', url, body, options);
  }

  put<T>(url: string, body: unknown, options?: HttpRequestOptions): Observable<T> {
    return this.request<T>('PUT', url, body, options);
  }

  patch<T>(url: string, body: unknown, options?: HttpRequestOptions): Observable<T> {
    return this.request<T>('PATCH', url, body, options);
  }

  delete<T>(url: string, options?: HttpRequestOptions): Observable<T> {
    return this.request<T>('DELETE', url, null, options);
  }

  private request<T>(
    method: string,
    url: string,
    body: unknown,
    options?: HttpRequestOptions,
    retryCount: number = 0,
  ): Observable<T> {
    const isPrivate = options?.isPrivate !== false;
    const shouldAuthenticate = isPrivate && this.isApiOrigin(url);
    const angularOptions: HttpRequestOptions = { ...options };
    delete angularOptions.isPrivate;

    if (shouldAuthenticate && this.isRefreshing) {
      return this.waitForRefreshAndRetry<T>(method, url, body, options, retryCount);
    }

    const accessToken = shouldAuthenticate ? this.session.getAccessToken() : null;

    if (accessToken) {
      const headers =
        angularOptions.headers instanceof HttpHeaders
          ? angularOptions.headers
          : new HttpHeaders(angularOptions.headers);
      angularOptions.headers = headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return (
      this.angularHttp.request<T>(method, url, {
        body,
        observe: 'body',
        ...angularOptions,
      }) as Observable<T>
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && shouldAuthenticate && retryCount < 3) {
          return this.handle401Error<T>(method, url, body, options, retryCount, accessToken);
        }
        return throwError(() => error);
      }),
    );
  }

  private isApiOrigin(url: string): boolean {
    try {
      const requestUrl = new URL(url, globalThis.location?.href);
      const apiUrl = new URL(environment.apiUrl);

      return requestUrl.origin === apiUrl.origin;
    } catch {
      return false;
    }
  }

  private handle401Error<T>(
    method: string,
    url: string,
    body: unknown,
    options?: HttpRequestOptions,
    retryCount: number = 0,
    tokenUsed: string | null = null,
  ): Observable<T> {
    const currentToken = this.session.getAccessToken();

    if (currentToken && currentToken !== tokenUsed) {
      return this.request<T>(method, url, body, options, retryCount + 1);
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshState.next({ status: 'pending' });

      const refresh$ = this.angularHttp
        .post<{ accessToken: string }>(
          `${environment.apiUrl}/auth/refresh`,
          {},
          {
            withCredentials: true,
          },
        )
        .pipe(
          tap((response) => {
            this.session.setTokens(response.accessToken);
            this.isRefreshing = false;
            this.refreshState.next({
              status: 'success',
              accessToken: response.accessToken,
            });
          }),
          catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
              this.session.clearAndRedirect();
            }
            this.refreshState.next({ status: 'failure', error });
            return throwError(() => error);
          }),
          finalize(() => {
            this.isRefreshing = false;
          }),
        );

      return refresh$.pipe(
        switchMap(() => this.request<T>(method, url, body, options, retryCount + 1)),
      );
    } else {
      return this.waitForRefreshAndRetry<T>(method, url, body, options, retryCount);
    }
  }

  private waitForRefreshAndRetry<T>(
    method: string,
    url: string,
    body: unknown,
    options?: HttpRequestOptions,
    retryCount: number = 0,
  ): Observable<T> {
    return this.refreshState.pipe(
      filter(isRefreshComplete),
      take(1),
      switchMap((state) => {
        if (state.status === 'failure') {
          return throwError(() => state.error);
        }

        return this.request<T>(method, url, body, options, retryCount + 1);
      }),
    );
  }
}

type RefreshState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; accessToken: string }
  | { status: 'failure'; error: unknown };

type RefreshCompletion = Extract<RefreshState, { status: 'success' | 'failure' }>;

function isRefreshComplete(state: RefreshState): state is RefreshCompletion {
  return state.status === 'success' || state.status === 'failure';
}

export { HttpClient };
