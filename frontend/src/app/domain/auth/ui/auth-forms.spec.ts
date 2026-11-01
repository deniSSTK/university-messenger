import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth, AuthError } from '../service/auth';
import { Login } from './login/login';
import { Register } from './register/register';
import type { AuthResult } from '../service/auth.types';

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('auth forms', () => {
  const auth = {
    login: vi.fn<() => Promise<AuthResult>>(),
    register: vi.fn<() => Promise<AuthResult>>(),
  };
  const validRegistration = {
    email: ' Alice@Example.com ',
    username: ' Alice_1 ',
    displayName: ' Alice ',
    password: 'password123',
    confirmPassword: 'password123',
  };

  beforeEach(async () => {
    auth.login.mockReset();
    auth.register.mockReset();
    await TestBed.configureTestingModule({
      imports: [Login, Register],
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it.each([
    ['password', '1234567'],
    ['password', 'a'.repeat(129)],
    ['username', '!!!'],
    ['username', 'a'.repeat(33)],
    ['displayName', '   '],
    ['displayName', 'a'.repeat(81)],
    ['email', 'a'.repeat(250) + '@example.com'],
    ['confirmPassword', 'different'],
  ])('rejects invalid registration field %s', (field, value) => {
    const component = TestBed.createComponent(Register).componentInstance;
    component.registerForm.setValue(validRegistration);
    component.registerForm.patchValue({ [field]: value });
    component.onSubmit();
    expect(component.registerForm.invalid).toBe(true);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('submits registration once, excludes confirmation and navigates after success', async () => {
    let finish: (value: AuthResult) => void = () => {};
    auth.register.mockReturnValue(
      new Promise<AuthResult>((resolve) => {
        finish = resolve;
      }),
    );
    const fixture = TestBed.createComponent(Register);
    const component = fixture.componentInstance;
    component.registerForm.setValue(validRegistration);
    component.onSubmit();
    component.onSubmit();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('button')?.disabled).toBe(true);
    expect(auth.register).toHaveBeenCalledExactlyOnceWith({
      email: validRegistration.email,
      username: validRegistration.username,
      displayName: validRegistration.displayName,
      password: validRegistration.password,
    });
    finish({ accessToken: 'token' });
    await settle();
    expect(component.isLoading()).toBe(false);
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/chats']);
  });

  it('renders a conflict error and enables registration again', async () => {
    auth.register.mockRejectedValue(new AuthError('conflict'));
    const fixture = TestBed.createComponent(Register);
    fixture.componentInstance.registerForm.setValue(validRegistration);
    fixture.componentInstance.onSubmit();
    await settle();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('already in use');
    expect(element.querySelector('button')?.disabled).toBe(false);
  });

  it('blocks duplicate login and shows incorrect-credentials errors inside the form', async () => {
    auth.login.mockRejectedValue(new AuthError('credentials'));
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.loginForm.setValue({
      email: 'user@example.com',
      password: 'password123',
    });
    fixture.componentInstance.onSubmit();
    fixture.componentInstance.onSubmit();
    expect(auth.login).toHaveBeenCalledOnce();
    await settle();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Incorrect email or password',
    );
    expect(fixture.componentInstance.isLoading()).toBe(false);
  });

  it('shows a connection error when the server is unavailable', async () => {
    auth.login.mockRejectedValue(new AuthError('unavailable'));
    const component = TestBed.createComponent(Login).componentInstance;
    component.loginForm.setValue({ email: 'user@example.com', password: 'password123' });
    component.onSubmit();
    await settle();
    expect(component.errorMessage()).toContain('Cannot reach the server');
  });
});
