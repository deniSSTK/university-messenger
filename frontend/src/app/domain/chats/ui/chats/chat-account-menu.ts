import { IconUser } from '../../../../shared/ui/icons/user';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Button } from '../../../../shared/ui/button/button';
import { IconLogout } from '../../../../shared/ui/icons/logout';
import { Component, input, output } from '@angular/core';
import type { PersonView } from './chats-view.types';
@Component({
  selector: 'app-chat-account-menu',
  standalone: true,
  imports: [Avatar, Button, IconLogout, IconUser],
  template: ` <nav aria-label="Меню акаунта">
    <div class="account-summary">
      <app-avatar [name]="person()?.displayName ?? initial()" [src]="person()?.avatarUrl" />
      <div>
        <strong>{{ person()?.displayName ?? 'Ваш акаунт' }}</strong
        ><span>{{
          person() ? '@' + person()!.username : loading() ? 'Завантажуємо…' : 'University Messenger'
        }}</span>
      </div>
    </div>
    @if (profileError()) {
      <p class="menu-note" role="alert">{{ profileError() }}</p>
    }
    @if (logoutError()) {
      <p class="menu-note error" role="alert">{{ logoutError() }}</p>
    }
    <button appButton variant="bare" type="button" class="logout-btn" (click)="profile.emit()">
      <app-icon-user />Редагувати профіль
    </button>
    <button
      appButton
      variant="bare"
      type="button"
      class="logout-btn"
      [disabled]="loggingOut()"
      (click)="logout.emit()"
    >
      <app-icon-logout />{{ loggingOut() ? 'Виходимо…' : 'Вийти з акаунта' }}
    </button>
  </nav>`,
  styleUrl: './chat-account-menu.scss',
})
class ChatAccountMenu {
  readonly person = input<PersonView | null>(null);
  readonly initial = input('M');
  readonly loading = input(false);
  readonly profileError = input('');
  readonly logoutError = input('');
  readonly loggingOut = input(false);
  readonly logout = output<void>();
  readonly profile = output<void>();
}

export { ChatAccountMenu };
