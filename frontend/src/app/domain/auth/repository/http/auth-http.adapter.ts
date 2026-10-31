import { Injectable, inject } from '@angular/core';
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

  async login(input: LoginRepositoryInput): Promise<AuthRepositoryResult> {
    const requestBody: LoginHttpRequest = {
      email: input.email,
      password: input.password,
    };
    const response = await firstValueFrom(
      this.http.post<AuthHttpResponse>(`${this.apiUrl}/auth/login`, requestBody, {
        isPrivate: false,
        withCredentials: true,
      }),
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
    const response = await firstValueFrom(
      this.http.post<AuthHttpResponse>(`${this.apiUrl}/auth/register`, requestBody, {
        isPrivate: false,
        withCredentials: true,
      }),
    );

    return { accessToken: response.accessToken };
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
  accessToken: string;
}

export { AuthHttpAdapter };
