import { FormField } from '../../../../shared/ui/form-field/form-field';
import { AuthCard } from '../../../../shared/ui/auth-card/auth-card';
import { Input } from '../../../../shared/ui/input/input';
import { Button } from '../../../../shared/ui/button/button';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Auth } from '../../service/auth';
import type { LoginInput } from '../../service/auth.types';
import { trimmedValidators, authErrorMessage } from '../auth-form.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [Button, Input, AuthCard, FormField, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
class Login {
  private authService = inject(Auth);
  private router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal('');

  loginForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        trimmedValidators([Validators.required, Validators.email, Validators.maxLength(254)]),
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });

  onSubmit(): void {
    if (this.isLoading()) {
      return;
    }

    this.errorMessage.set('');

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const formValue: LoginFormValue = this.loginForm.getRawValue();
    const input: LoginInput = { email: formValue.email, password: formValue.password };

    this.authService
      .login(input)
      .then(() => {
        this.router.navigate(['/chats']);
      })
      .catch((err: unknown) => {
        this.errorMessage.set(authErrorMessage(err));
      })
      .finally(() => {
        this.isLoading.set(false);
      });
  }
}

interface LoginFormValue {
  email: string;
  password: string;
}

export { Login };
