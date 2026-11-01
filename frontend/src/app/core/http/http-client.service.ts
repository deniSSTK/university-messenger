import { Injectable, inject } from '@angular/core';
import {
  HttpClient as AngularHttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, defer, from, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import type { HttpRequestOptions } from './http.types';
import { SessionService } from './session.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
class HttpClient {
  private angularHttp = inject(AngularHttpClient);
  private session = inject(SessionService);

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
    options: HttpRequestOptions = {},
  ): Observable<T> {
    const { isPrivate = true, ...transportOptions } = options;
    const authenticate = isPrivate && this.isApiUrl(url);
    let retries = 0;

    const send = (): Observable<T> =>
      defer(() => {
        const pending = authenticate ? this.session.getPendingRefresh() : null;
        const ready: Observable<string | null> = pending ? from(pending) : of(null);

        return ready.pipe(
          switchMap(() => {
            const token = authenticate ? this.session.getAccessToken() : null;
            let headers =
              transportOptions.headers instanceof HttpHeaders
                ? transportOptions.headers
                : new HttpHeaders(transportOptions.headers);

            if (token) {
              headers = headers.set('Authorization', `Bearer ${token}`);
            }

            return this.angularHttp
              .request<T>(method, url, { ...transportOptions, headers, body })
              .pipe(
                catchError((error: unknown) => {
                  if (
                    !(error instanceof HttpErrorResponse) ||
                    error.status !== 401 ||
                    !authenticate ||
                    retries >= 3
                  ) {
                    return throwError(() => error);
                  }

                  retries += 1;
                  const currentToken = this.session.getAccessToken();

                  if (currentToken && currentToken !== token) {
                    return send();
                  }

                  return from(this.session.refresh()).pipe(switchMap(() => send()));
                }),
              );
          }),
        );
      });

    return send();
  }

  private isApiUrl(url: string): boolean {
    try {
      const requestUrl = new URL(url, globalThis.location?.href);
      const apiUrl = new URL(environment.apiUrl, globalThis.location?.href);
      const apiPath = apiUrl.pathname.replace(/\/$/, '');

      return (
        requestUrl.origin === apiUrl.origin &&
        (requestUrl.pathname === apiPath || requestUrl.pathname.startsWith(`${apiPath}/`))
      );
    } catch {
      return false;
    }
  }
}

export { HttpClient };
