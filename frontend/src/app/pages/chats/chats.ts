import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chats',
  standalone: true,
  templateUrl: './chats.html',
  styleUrl: './chats.scss',
})
export class Chats {
  private router = inject(Router);

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.router.navigate(['/login']);
  }
}
