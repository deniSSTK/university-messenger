import type { ReactionType } from '@university-messenger/events';
import { REACTION_TYPES } from '@university-messenger/events';
import { ChatReactionPicker, REACTION_LABELS } from './chat-reaction-picker';
import {
  Component,
  ElementRef,
  DestroyRef,
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
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { ChatImage } from './chat-image';
import type { MessageView, PersonView } from './chats-view.types';

@Component({
  selector: 'app-chat-bubble',
  host: { '(document:keydown.escape)': 'closeMenu()' },
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
    ChatReactionPicker,
    Avatar,
  ],
  template: `
    <article
      class="message"
      [class.own]="own()"
      [class.has-photo]="isImage()"
      [class.has-reactions]="pills().length > 0"
      [class.has-voice]="!!message().attachment?.voice"
      (pointerdown)="startPress($event)"
      (pointermove)="movePress($event)"
      (pointerup)="cancelPress()"
      (pointercancel)="cancelPress()"
      (pointerleave)="cancelPress()"
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
      <footer class="message-footer">
        @if (pills().length) {
          <div class="reaction-pills" role="group" aria-label="Реакції на повідомлення">
            @for (item of pills(); track item.type) {
              <button
                type="button"
                [attr.aria-pressed]="message().reactionState?.myReaction === item.type"
                [attr.aria-label]="labels[item.type].name + ' · ' + item.count"
                (click)="react.emit(item.type)"
              >
                <span class="emoji" aria-hidden="true">{{ labels[item.type].emoji }}</span>
                @if (item.count === 1 && singleReactor(item.type); as reactor) {
                  <app-avatar [size]="17" [name]="reactor.displayName" [src]="reactor.avatarUrl" />
                } @else {
                  <span class="reaction-count" aria-hidden="true">{{ item.count }}</span>
                }
              </button>
            }
          </div>
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
      </footer>
      <button
        #menuTrigger
        class="message-options"
        type="button"
        aria-label="Дії повідомлення"
        aria-haspopup="menu"
        [attr.aria-expanded]="!!menu()"
        (click)="openMenu($event)"
      >
        <app-icon-more />
      </button>
    </article>
    @if (menu(); as position) {
      <button
        type="button"
        class="context-backdrop"
        aria-label="Закрити дії повідомлення"
        (pointerdown)="armMenu()"
        (keydown)="armMenu()"
        (click)="dismissMenu()"
      ></button>
      <nav
        #messageMenu
        class="message-menu"
        aria-label="Дії повідомлення"
        [style.left.px]="position.x"
        [style.top.px]="position.y"
        (pointerdown)="armMenu()"
        (keydown)="armMenu()"
        (keydown.escape)="closeMenu()"
      >
        <app-chat-reaction-picker
          [selected]="message().reactionState?.myReaction ?? null"
          (picked)="pickReaction($event)"
        />
        @if (message().attachment) {
          <button type="button" (click)="selectMenuAction('download')">
            <app-icon-download />Завантажити
          </button>
        }
        @if (own()) {
          @if (!message().attachment) {
            <button
              type="button"
              aria-label="Редагувати повідомлення"
              (click)="selectMenuAction('edit')"
            >
              <app-icon-edit />Редагувати
            </button>
          }
          <button
            type="button"
            class="delete-action"
            aria-label="Видалити повідомлення"
            (click)="selectMenuAction('remove')"
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
  private readonly menuTrigger = viewChild<ElementRef<HTMLButtonElement>>('menuTrigger');
  private touchMenu = false;
  private press?: { x: number; y: number; timer: ReturnType<typeof setTimeout> };
  readonly labels = REACTION_LABELS;
  readonly reactionViewer = input<PersonView | null>(null);
  readonly reactionPeer = input<PersonView | null>(null);
  readonly defaultReaction = input<ReactionType>('HEART');
  readonly react = output<ReactionType>();
  readonly pills = computed(() => {
    const reactions = this.message().reactionState?.reactions ?? [];
    return REACTION_TYPES.flatMap((type) => {
      const reaction = reactions.find((item) => item.type === type);
      return reaction ? [reaction] : [];
    });
  });
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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelPress());
  }

  singleReactor(type: ReactionType): PersonView | null {
    return this.message().reactionState?.myReaction === type
      ? this.reactionViewer()
      : this.reactionPeer();
  }

  private isInteractive(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest('button, a, audio, video, input, textarea, [contenteditable="true"]')
    );
  }

  quickReact(event: MouseEvent): void {
    if (!this.menu() && !this.isInteractive(event.target)) {
      this.react.emit(this.defaultReaction());
    }
  }

  startPress(event: PointerEvent): void {
    if (event.pointerType !== 'touch' || !event.isPrimary || this.isInteractive(event.target)) {
      return;
    }

    this.cancelPress();
    const { clientX: x, clientY: y } = event;
    this.press = {
      x,
      y,
      timer: setTimeout(() => {
        this.press = undefined;
        this.showMenu(x, y, true);
      }, 500),
    };
  }

  movePress(event: PointerEvent): void {
    if (this.press && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > 10) {
      this.cancelPress();
    }
  }

  cancelPress(): void {
    if (this.press) {
      clearTimeout(this.press.timer);
      this.press = undefined;
    }
  }

  openMenu(event: MouseEvent): void {
    if (
      event.type === 'contextmenu' &&
      event.target instanceof Element &&
      event.target.closest('a, input, audio, video, .context-backdrop, .message-menu')
    ) {
      return;
    }

    event.preventDefault();
    this.cancelPress();

    if (this.menu()) {
      return;
    }

    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const pointer = event.clientX !== 0 || event.clientY !== 0;

    this.showMenu(pointer ? event.clientX : bounds.left, pointer ? event.clientY : bounds.bottom);
  }

  armMenu(): void {
    this.touchMenu = false;
  }

  dismissMenu(): void {
    if (!this.touchMenu) {
      this.closeMenu();
    }
  }

  selectMenuAction(action: 'download' | 'edit' | 'remove'): void {
    if (!this.touchMenu) {
      this.closeMenu();
      this[action].emit();
    }
  }

  closeMenu(): void {
    if (this.menu()) {
      this.menu.set(null);
      this.menuTrigger()?.nativeElement.focus({ preventScroll: true });
    }
  }

  pickReaction(type: ReactionType): void {
    if (!this.touchMenu) {
      this.closeMenu();
      this.react.emit(type);
    }
  }

  private showMenu(x: number, y: number, touch = false): void {
    this.touchMenu = touch;
    const width = Math.min(326, window.innerWidth - 16);
    const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
    this.menu.set({ x: left, y: Math.max(8, Math.min(y, window.innerHeight - 64)) });
    afterNextRender(
      () => {
        const menu = this.messageMenu()?.nativeElement;

        if (menu && this.menu()) {
          const top = Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8));
          this.menu.set({ x: left, y: top });
          menu.querySelector('button')?.focus({ preventScroll: true });
        }
      },
      { injector: this.injector },
    );
  }
}

export { ChatBubble };
