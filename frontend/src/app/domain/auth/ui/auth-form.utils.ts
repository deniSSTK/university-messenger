import { FormControl } from '@angular/forms';
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { AuthError } from '../service/auth';

function trimmedValidators(validators: ValidatorFn[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    const normalized = new FormControl(typeof value === 'string' ? value.trim() : value);
    const errors: ValidationErrors = {};

    for (const validator of validators) {
      const result = validator(normalized);

      if (result) {
        Object.assign(errors, result);
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  };
}

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password: unknown = control.get('password')?.value;
  const confirmation: unknown = control.get('confirmPassword')?.value;

  return password === confirmation ? null : { mismatch: true };
}

function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthError)) {
    return 'Something went wrong. Please try again.';
  }

  switch (error.code) {
    case 'credentials':
      return 'Incorrect email or password. Please try again.';
    case 'conflict':
      return 'This email or username is already in use.';
    case 'validation':
      return 'Some fields are invalid. Check the values and their length.';
    case 'unavailable':
      return 'Cannot reach the server. Check your connection and try again.';
    case 'forbidden':
      return 'The server denied this request. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export { trimmedValidators, passwordMatchValidator, authErrorMessage };
