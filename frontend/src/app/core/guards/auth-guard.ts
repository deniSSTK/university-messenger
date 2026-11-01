import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { Auth } from '../../domain/auth/service/auth';

const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const authenticated = await auth.restoreSession();

  return authenticated || router.createUrlTree(['/login']);
};

export { authGuard };
