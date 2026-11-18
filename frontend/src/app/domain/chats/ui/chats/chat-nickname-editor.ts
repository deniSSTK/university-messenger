import { NICKNAME_COLORS } from '@university-messenger/events';
import type { NicknameColor } from '@university-messenger/events';
import { Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Users } from '../../../users/service/users';
import type { Nickname, UserNickname } from '../../../users/service/users';
import { Button } from '../../../../shared/ui/button/button';
import { Dialog } from '../../../../shared/ui/dialog/dialog';

@Component({
  selector: 'app-chat-nickname-editor',
  imports: [Button, Dialog],
  templateUrl: './chat-nickname-editor.html',
  styleUrl: './chat-nickname-editor.scss',
})
class ChatNicknameEditor {
  private readonly users = inject(Users);
  readonly targetId = input.required<string>();
  readonly nickname = input<Nickname>();
  readonly aliasChanged = output<UserNickname | null>();
  readonly nicknameColors = NICKNAME_COLORS;
  readonly colorLabels: Record<NicknameColor, string> = {
    BLUE: 'Синій',
    PURPLE: 'Фіолетовий',
    GREEN: 'Зелений',
    ORANGE: 'Помаранчевий',
    PINK: 'Рожевий',
    RED: 'Червоний',
    CYAN: 'Бірюзовий',
  };
  readonly nicknameDraft = linkedSignal(() => this.nickname()?.nickname ?? '');
  readonly nicknameColor = linkedSignal<NicknameColor>(() => this.nickname()?.color ?? 'BLUE');
  readonly nicknameBusy = signal(false);
  readonly nicknameError = signal('');

  readonly closed = output<void>();

  async saveNickname(remove = false): Promise<void> {
    if (this.nicknameBusy()) {
      return;
    }

    const nickname = this.nicknameDraft().trim();
    if (!remove && (!nickname || [...nickname].length > 64)) {
      this.nicknameError.set('Введіть прізвисько довжиною від 1 до 64 символів.');
      return;
    }

    const target = this.targetId();
    this.nicknameBusy.set(true);
    this.nicknameError.set('');
    try {
      if (remove) {
        await firstValueFrom(this.users.deleteAlias(target));
        this.aliasChanged.emit(null);
      } else {
        const alias = await firstValueFrom(
          this.users.saveAlias(target, { nickname, color: this.nicknameColor() }),
        );
        this.aliasChanged.emit(alias);
      }
      this.closed.emit();
    } catch {
      this.nicknameError.set('Не вдалося зберегти прізвисько. Спробуйте ще раз.');
    } finally {
      this.nicknameBusy.set(false);
    }
  }
}

export { ChatNicknameEditor };
