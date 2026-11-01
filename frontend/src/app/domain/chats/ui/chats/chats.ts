import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { authErrorMessage } from '../../../auth/ui/auth-form.utils';
import { Auth } from '../../../auth/service/auth';

@Component({
  selector: 'app-chats',
  standalone: true,
  templateUrl: './chats.html',
  styleUrl: './chats.scss',
})
class Chats {
  private auth = inject(Auth);

  private router = inject(Router);
  isLoggingOut = signal(false);
  errorMessage = signal('');

  async logout(): Promise<void> {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } catch (error: unknown) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.isLoggingOut.set(false);
    }
  }
}

export { Chats };
