import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { SessionService } from '../../../../core/http/session.service';
import { AuthRepositoryError } from '../auth.repository';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '../../../../core/http/http-client.service';
import type {
  AuthRepository,
  AuthRepositoryResult,
  LoginRepositoryInput,
  RegisterRepositoryInput,
} from '../auth.repository';
import { environment } from '../../../../../environments/environment';

@Injectable({ providedIn: 'root' })
class AuthHttpAdapter implements AuthRepository {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private session = inject(SessionService);

  async login(input: LoginRepositoryInput): Promise<AuthRepositoryResult> {
    const requestBody: LoginHttpRequest = {
      email: input.email,
      password: input.password,
    };
    const response = await this.translateErrors(() =>
      firstValueFrom(
        this.http.post<AuthHttpResponse>(`${this.apiUrl}/auth/login`, requestBody, {
          isPrivate: false,
          withCredentials: true,
        }),
      ),
    );

    return { accessToken: response.accessToken };
  }

  async register(input: RegisterRepositoryInput): Promise<AuthRepositoryResult> {
    const requestBody: RegisterHttpRequest = {
      email: input.email,
      password: input.password,
      username: input.username,
      displayName: input.displayName,
    };
    const response = await this.translateErrors(() =>
      firstValueFrom(
        this.http.post<AuthHttpResponse>(`${this.apiUrl}/auth/register`, requestBody, {
          isPrivate: false,
          withCredentials: true,
        }),
      ),
    );

    return { accessToken: response.accessToken };
  }
  async restore(): Promise<AuthRepositoryResult> {
    const accessToken = await this.translateErrors(() => this.session.refresh(false));

    return { accessToken };
  }

  async logout(): Promise<void> {
    await this.translateErrors(() =>
      firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/auth/logout`, null, { withCredentials: true }),
      ),
    );
  }

  private async translateErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!(error instanceof HttpErrorResponse)) {
        throw new AuthRepositoryError('unknown');
      }

      switch (error.status) {
        case 400:
          throw new AuthRepositoryError('validation');
        case 401:
          throw new AuthRepositoryError('credentials');
        case 403:
          throw new AuthRepositoryError('forbidden');
        case 409:
          throw new AuthRepositoryError('conflict');
        case 0:
          throw new AuthRepositoryError('unavailable');
        default:
          throw new AuthRepositoryError(error.status >= 500 ? 'unavailable' : 'unknown');
      }
    }
  }
}

interface LoginHttpRequest {
  email: string;
  password: string;
}

interface RegisterHttpRequest extends LoginHttpRequest {
  username: string;
  displayName: string;
}

interface AuthHttpResponse {
  user: PublicUserHttpResponse;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

interface PublicUserHttpResponse {
  id: string;
  email: string;
  username: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export { AuthHttpAdapter };
