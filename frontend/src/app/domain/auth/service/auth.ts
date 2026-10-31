import { Injectable, inject } from '@angular/core';
import { SessionService } from '../../../core/http/session.service';
import { AUTH_REPOSITORY } from '../repository/auth.repository';
import type {
  AuthRepositoryResult,
  LoginRepositoryInput,
  RegisterRepositoryInput,
} from '../repository/auth.repository';
import type { AuthResult, LoginInput, RegisterInput } from './auth.types';

@Injectable({
  providedIn: 'root',
})
class Auth {
  private repository = inject(AUTH_REPOSITORY);
  private session = inject(SessionService);

  async register(input: RegisterInput): Promise<AuthResult> {
    const repositoryInput: RegisterRepositoryInput = {
      email: input.email,
      password: input.password,
      username: input.username,
      displayName: input.displayName,
    };
    const repositoryResult: AuthRepositoryResult = await this.repository.register(repositoryInput);
    this.session.setTokens(repositoryResult.accessToken);

    return { accessToken: repositoryResult.accessToken };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const repositoryInput: LoginRepositoryInput = {
      email: input.email,
      password: input.password,
    };
    const repositoryResult: AuthRepositoryResult = await this.repository.login(repositoryInput);
    this.session.setTokens(repositoryResult.accessToken);

    return { accessToken: repositoryResult.accessToken };
  }

  getAccessToken(): string | null {
    return this.session.getAccessToken();
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  }

  logout(): void {
    this.session.clearAndRedirect();
  }
}

export { Auth };
