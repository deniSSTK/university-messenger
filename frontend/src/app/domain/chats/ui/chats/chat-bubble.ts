import { IconEdit } from '../../../../shared/ui/icons/edit';
import { IconTrash } from '../../../../shared/ui/icons/trash';
import { IconDownload } from '../../../../shared/ui/icons/download';
import { IconCheck } from '../../../../shared/ui/icons/check';
import { IconCheckDouble } from '../../../../shared/ui/icons/check-double';
import { Button } from '../../../../shared/ui/button/button';
import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import type { MessageView } from './chats-view.types';
@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [Button, DatePipe, IconEdit, IconTrash, IconDownload, IconCheck, IconCheckDouble],
  template: `<article class="message" [class.own]="own()">
    @if (message().attachment; as file) {
      <button appButton variant="ghost" type="button" (click)="download.emit()">
        <app-icon-download />{{ file.name }} ({{ file.size }} Б)
      </button>
    } @else {
      <p>{{ message().text }}</p>
    }
    <div class="message-meta">
      @if (message().editedAt) {
        <small>змінено</small>
      }
      @if (own()) {
        <span
          class="receipt"
          [attr.aria-label]="message().readAt ? 'Прочитано' : 'Надіслано'"
          [attr.title]="message().readAt ? 'Прочитано' : 'Надіслано'"
        >
          @if (message().readAt) {
            <app-icon-check-double />
          } @else {
            <app-icon-check />
          }
        </span>
      }
      <time
        [attr.datetime]="message().createdAt"
        [attr.title]="message().createdAt | date: 'dd.MM.yyyy HH:mm'"
        >{{ message().createdAt | date: 'HH:mm' }}</time
      >
    </div>
    @if (own()) {
      <div class="message-actions">
        @if (!message().attachment) {
          <button
            appButton
            variant="icon"
            type="button"
            title="Редагувати"
            (click)="edit.emit()"
            aria-label="Редагувати повідомлення"
          >
            <app-icon-edit />
          </button>
        }
        <button
          appButton
          variant="icon"
          type="button"
          title="Видалити"
          (click)="remove.emit()"
          aria-label="Видалити повідомлення"
        >
          <app-icon-trash />
        </button>
      </div>
    }
  </article>`,
  styleUrl: './chat-bubble.scss',
})
class ChatBubble {
  readonly message = input.required<MessageView>();
  readonly own = input(false);
  readonly edit = output<void>();
  readonly download = output<void>();
  readonly remove = output<void>();
}

export { ChatBubble };
