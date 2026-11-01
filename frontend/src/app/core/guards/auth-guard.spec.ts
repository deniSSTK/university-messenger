import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from '../../domain/auth/service/auth';
import { authGuard } from './auth-guard';

describe('authGuard', () => {
  const auth = { restoreSession: vi.fn<() => Promise<boolean>>() };

  beforeEach(() => {
    auth.restoreSession.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });
  });

  function runGuard() {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('waits for session restoration before allowing access', async () => {
    let finish: (value: boolean) => void = () => {};
    auth.restoreSession.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    );
    const result = runGuard();
    finish(true);

    expect(await result).toBe(true);
  });

  it('returns a login redirect when the session is absent', async () => {
    auth.restoreSession.mockResolvedValue(false);
    const result = await runGuard();

    expect(TestBed.inject(Router).serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe(
      '/login',
    );
  });
});
