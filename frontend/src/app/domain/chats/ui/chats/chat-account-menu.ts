import { Component, input, output } from '@angular/core';
import { ChatIcon } from './chat-icon';
import type { PersonView } from './chats-view.types';
@Component({
  selector: 'app-chat-account-menu',
  standalone: true,
  imports: [ChatIcon],
  template: ` <nav aria-label="Меню акаунта">
    <div class="account-summary">
      <span class="avatar" aria-hidden="true">{{ initial() }}</span>
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
    <button type="button" class="logout-btn" [disabled]="loggingOut()" (click)="logout.emit()">
      <app-chat-icon name="logout" />{{ loggingOut() ? 'Виходимо…' : 'Вийти з акаунта' }}
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
}
export { ChatAccountMenu };
