import { USERS_REPOSITORY } from './domain/users/repository/users.repository';
import { UsersHttpAdapter } from './domain/users/repository/http/users-http.adapter';
import { CHATS_REPOSITORY } from './domain/chats/repository/chats.repository';
import { ChatsMockAdapter } from './domain/chats/repository/mock/chats-mock.adapter';
import { Auth } from './domain/auth/service/auth';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { AUTH_REPOSITORY } from './domain/auth/repository/auth.repository';
import { AuthHttpAdapter } from './domain/auth/repository/http/auth-http.adapter';

const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAppInitializer(() => inject(Auth).restoreSession()),
    provideHttpClient(),
    { provide: USERS_REPOSITORY, useExisting: UsersHttpAdapter },
    { provide: CHATS_REPOSITORY, useExisting: ChatsMockAdapter },
    { provide: AUTH_REPOSITORY, useExisting: AuthHttpAdapter },
  ],
};

export { appConfig };
