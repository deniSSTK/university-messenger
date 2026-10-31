import { Component, inject } from '@angular/core';
import { Auth } from '../../../auth/service/auth';

@Component({
  selector: 'app-chats',
  standalone: true,
  templateUrl: './chats.html',
  styleUrl: './chats.scss',
})
class Chats {
  private auth = inject(Auth);

  logout(): void {
    this.auth.logout();
  }
}

export { Chats };
