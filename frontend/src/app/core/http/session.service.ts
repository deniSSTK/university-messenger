import { Injectable, inject } from '@angular/core';
import { HttpClient as AngularHttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
class SessionService {
  private http = inject(AngularHttpClient);
  private router = inject(Router);
  private accessToken: string | null = null;
  private refreshOperation: Promise<string> | null = null;
  private generation = 0;
  private redirecting = false;

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getPendingRefresh(): Promise<string> | null {
    return this.refreshOperation;
  }

  setAccessToken(accessToken: string): void {
    this.generation += 1;
    this.accessToken = accessToken;
    this.redirecting = false;
  }

  clear(): void {
    this.generation += 1;
    this.accessToken = null;
  }

  refresh(redirectOnUnauthorized = true): Promise<string> {
    if (this.refreshOperation) {
      return this.refreshOperation;
    }

    const generation = this.generation;
    this.refreshOperation = firstValueFrom(
      this.http.post<RefreshHttpResponse>(`${environment.apiUrl}/auth/refresh`, null, {
        withCredentials: true,
      }),
    )
      .then((response) => {
        if (generation !== this.generation) {
          throw new Error('Session changed during refresh');
        }

        this.accessToken = response.accessToken;
        return response.accessToken;
      })
      .catch((error: unknown) => {
        if (
          generation === this.generation &&
          error instanceof HttpErrorResponse &&
          error.status === 401
        ) {
          this.clear();

          if (redirectOnUnauthorized && !this.redirecting) {
            this.redirecting = true;
            void this.router.navigate(['/login']);
          }
        }

        throw error;
      })
      .finally(() => {
        this.refreshOperation = null;
      });

    return this.refreshOperation;
  }
}

interface RefreshHttpResponse {
  user: RefreshUserHttpResponse;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

interface RefreshUserHttpResponse {
  id: string;
  email: string;
  username: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export { SessionService };
