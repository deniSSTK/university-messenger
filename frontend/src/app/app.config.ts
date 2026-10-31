import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { AUTH_REPOSITORY } from './domain/auth/repository/auth.repository';
import { AuthHttpAdapter } from './domain/auth/repository/http/auth-http.adapter';

const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: AUTH_REPOSITORY, useExisting: AuthHttpAdapter },
  ],
};

export { appConfig };
