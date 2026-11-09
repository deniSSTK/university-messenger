import { Component, input, output } from '@angular/core';
import { Dialog } from '../../../../shared/ui/dialog/dialog';
import { Button } from '../../../../shared/ui/button/button';
import { Input } from '../../../../shared/ui/input/input';
import { FormField } from '../../../../shared/ui/form-field/form-field';
import { FilePicker } from '../../../../shared/ui/file-picker/file-picker';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
@Component({
  selector: 'app-chat-profile-editor',
  imports: [Dialog, Button, Input, FormField, FilePicker, Avatar],
  template: `<app-dialog heading="Ваш профіль" [locked]="saving()" (closed)="close.emit()">
    <form (submit)="$event.preventDefault(); save.emit()">
      <app-form-field
        ><label for="profile-name">Ім’я</label
        ><input
          appInput
          id="profile-name"
          autocomplete="name"
          maxlength="64"
          [value]="name()"
          (input)="nameChanged.emit(inputValue($event))"
      /></app-form-field>
      <app-file-picker
        label="Оберіть аватар"
        hint="PNG, JPEG, WebP до 256 КіБ"
        accept="image/png,image/jpeg,image/webp"
        [disabled]="saving()"
        (fileSelected)="fileChanged.emit($event)"
      />
      @if (avatar(); as avatar) {
        <div class="avatar-preview">
          <app-avatar [src]="avatar" [size]="80" /><button
            appButton
            variant="danger"
            (click)="avatarRemoved.emit()"
          >
            Прибрати аватар
          </button>
        </div>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <button appButton variant="secondary" [disabled]="saving()" (click)="close.emit()">
          Скасувати</button
        ><button appButton type="submit" [busy]="saving()">Зберегти</button>
      </div>
    </form>
  </app-dialog>`,
  styleUrl: './chat-profile-editor.scss',
})
class ChatProfileEditor {
  readonly name = input('');
  readonly avatar = input<string | null>(null);
  readonly saving = input(false);
  readonly error = input('');
  readonly nameChanged = output<string>();
  readonly fileChanged = output<Event>();
  readonly avatarRemoved = output<void>();
  readonly save = output<void>();
  readonly close = output<void>();
  inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }
}
export { ChatProfileEditor };
