import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { IconEdit } from '../../../../shared/ui/icons/edit';
import { IconTrash } from '../../../../shared/ui/icons/trash';
import { IconDownload } from '../../../../shared/ui/icons/download';
import { IconCheck } from '../../../../shared/ui/icons/check';
import { IconCheckDouble } from '../../../../shared/ui/icons/check-double';
import { IconMore } from '../../../../shared/ui/icons/more';
import { VoicePlayer } from './voice-player';
import { ChatImage } from './chat-image';
import type { MessageView } from './chats-view.types';

@Component({
  selector: 'app-chat-bubble',
  host: { '(document:keydown.escape)': 'menu.set(null)' },
  imports: [
    DatePipe,
    IconEdit,
    IconTrash,
    IconDownload,
    IconCheck,
    IconCheckDouble,
    IconMore,
    ChatImage,
    VoicePlayer,
  ],
  template: `
    <article
      class="message"
      [class.own]="own()"
      [class.has-photo]="isImage()"
      [class.has-voice]="!!message().attachment?.voice"
      (contextmenu)="openMenu($event)"
      (keydown.escape)="menu.set(null)"
    >
      @if (message().attachment; as file) {
        @if (file.voice; as voice) {
          <app-voice-player
            [chatId]="chatId()"
            [messageId]="message().id"
            [durationMs]="voice.durationMs"
            [waveform]="voice.waveform"
          />
        } @else if (isImage()) {
          <app-chat-image
            [chatId]="chatId()"
            [messageId]="message().id"
            [name]="file.name"
            (imageLoaded)="mediaLoaded.emit()"
          />
        } @else {
          <button
            class="attachment"
            type="button"
            (click)="download.emit()"
            [attr.aria-label]="'Завантажити ' + file.name"
          >
            <span class="file-icon"><app-icon-download /></span>
            <span class="file-details"
              ><strong>{{ file.name }}</strong
              ><small>{{ fileSize() }}</small></span
            >
          </button>
        }
      } @else {
        <p>{{ message().text }}</p>
      }
      <div class="message-meta">
        @if (message().editedAt) {
          <small>змінено</small>
        }
        <time
          [attr.datetime]="message().createdAt"
          [attr.title]="message().createdAt | date: 'dd.MM.yyyy HH:mm'"
        >
          {{ message().createdAt | date: 'HH:mm' }}
        </time>
        @if (own()) {
          <span class="receipt" [attr.aria-label]="message().readAt ? 'Прочитано' : 'Надіслано'">
            @if (message().readAt) {
              <app-icon-check-double />
            } @else {
              <app-icon-check />
            }
          </span>
        }
      </div>
      @if (own() || message().attachment) {
        <button
          class="message-options"
          type="button"
          aria-label="Дії повідомлення"
          aria-haspopup="menu"
          [attr.aria-expanded]="!!menu()"
          (click)="openMenu($event)"
        >
          <app-icon-more />
        </button>
      }
    </article>
    @if (menu(); as position) {
      <button
        type="button"
        class="context-backdrop"
        aria-label="Закрити дії повідомлення"
        (click)="menu.set(null)"
      ></button>
      <nav
        #messageMenu
        class="message-menu"
        aria-label="Дії повідомлення"
        [style.left.px]="position.x"
        [style.top.px]="position.y"
        (keydown.escape)="menu.set(null)"
      >
        @if (message().attachment) {
          <button type="button" (click)="menu.set(null); download.emit()">
            <app-icon-download />Завантажити
          </button>
        }
        @if (own()) {
          @if (!message().attachment) {
            <button
              type="button"
              aria-label="Редагувати повідомлення"
              (click)="menu.set(null); edit.emit()"
            >
              <app-icon-edit />Редагувати
            </button>
          }
          <button
            type="button"
            class="delete-action"
            aria-label="Видалити повідомлення"
            (click)="menu.set(null); remove.emit()"
          >
            <app-icon-trash />Видалити
          </button>
        }
      </nav>
    }
  `,
  styleUrl: './chat-bubble.scss',
})
class ChatBubble {
  private readonly injector = inject(Injector);
  private readonly messageMenu = viewChild<ElementRef<HTMLElement>>('messageMenu');
  readonly chatId = input.required<string>();
  readonly message = input.required<MessageView>();
  readonly own = input(false);
  readonly edit = output<void>();
  readonly download = output<void>();
  readonly remove = output<void>();
  readonly mediaLoaded = output<void>();
  readonly menu = signal<{ x: number; y: number } | null>(null);
  readonly isImage = computed(() =>
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
      this.message().attachment?.mediaType ?? '',
    ),
  );
  readonly fileSize = computed(() => {
    const bytes = this.message().attachment?.size ?? 0;
    if (bytes < 1024) {
      return `${bytes} Б`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} КБ`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  });

  openMenu(event: MouseEvent): void {
    if (!this.own() && !this.message().attachment) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const bounds = target.getBoundingClientRect();
    const x = event.detail === 0 ? bounds.left : event.clientX;
    const y = event.detail === 0 ? bounds.bottom : event.clientY;
    this.menu.set({
      x: Math.max(8, Math.min(x, window.innerWidth - 228)),
      y: Math.max(8, Math.min(y, window.innerHeight - 152)),
    });
    afterNextRender(
      () => {
        this.messageMenu()?.nativeElement.querySelector('button')?.focus();
      },
      { injector: this.injector },
    );
  }
}

export { ChatBubble };
