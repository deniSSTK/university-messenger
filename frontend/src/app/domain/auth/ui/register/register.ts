import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Auth } from '../../service/auth';
import type { RegisterInput } from '../../service/auth.types';
import { trimmedValidators, authErrorMessage, passwordMatchValidator } from '../auth-form.utils';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
class Register {
  private authService = inject(Auth);
  private router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal('');

  registerForm = new FormGroup(
    {
      email: new FormControl('', {
        nonNullable: true,
        validators: [
          trimmedValidators([Validators.required, Validators.email, Validators.maxLength(254)]),
        ],
      }),
      username: new FormControl('', {
        nonNullable: true,
        validators: [
          trimmedValidators([
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(32),
            Validators.pattern(/^[a-z0-9_]+$/i),
          ]),
        ],
      }),
      displayName: new FormControl('', {
        nonNullable: true,
        validators: [trimmedValidators([Validators.required, Validators.maxLength(80)])],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordMatchValidator },
  );

  onSubmit(): void {
    if (this.isLoading()) {
      return;
    }

    this.errorMessage.set('');

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);

    const formValue: RegisterFormValue = this.registerForm.getRawValue();
    const registrationInput: RegisterInput = {
      email: formValue.email,
      username: formValue.username,
      displayName: formValue.displayName,
      password: formValue.password,
    };

    this.authService
      .register(registrationInput)
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

interface RegisterFormValue {
  email: string;
  username: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

export { Register };
