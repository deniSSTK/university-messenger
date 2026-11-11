import { Component, effect, inject, input, output, signal } from '@angular/core';
import { ChatService } from '../../service/chats';
import { IconClose } from '../../../../shared/ui/icons/close';
import { IconDownload } from '../../../../shared/ui/icons/download';
import { Spinner } from '../../../../shared/ui/spinner/spinner';

@Component({
  selector: 'app-chat-image',
  imports: [IconClose, IconDownload, Spinner],
  template: `
    @if (!failed() && url(); as source) {
      <button
        class="thumbnail"
        type="button"
        [attr.aria-label]="'Відкрити ' + name()"
        (click)="lightbox.showModal()"
      >
        <img [src]="source" [alt]="name()" (load)="imageLoaded.emit()" (error)="failed.set(true)" />
      </button>
      <dialog #lightbox (click)="dismiss($event, lightbox)">
        <div class="viewer-toolbar">
          <span>{{ name() }}</span>
          <a [href]="source" [download]="name()" aria-label="Завантажити зображення">
            <app-icon-download />
          </a>
          <button type="button" aria-label="Закрити зображення" (click)="lightbox.close()">
            <app-icon-close />
          </button>
        </div>
        <img [src]="source" [alt]="name()" />
      </dialog>
    } @else if (failed()) {
      <button class="image-status" type="button" (click)="retry.update(increment)">
        Не вдалося завантажити фото. Повторити
      </button>
    } @else {
      <div class="image-status" role="status"><app-spinner />Завантажуємо фото…</div>
    }
  `,
  styleUrl: './chat-image.scss',
})
class ChatImage {
  private readonly service = inject(ChatService);
  readonly chatId = input.required<string>();
  readonly messageId = input.required<string>();
  readonly name = input.required<string>();
  readonly url = signal<string | null>(null);
  readonly failed = signal(false);
  readonly retry = signal(0);
  readonly imageLoaded = output<void>();
  readonly increment = (value: number) => value + 1;

  constructor() {
    effect((onCleanup) => {
      const chatId = this.chatId();
      const messageId = this.messageId();
      this.retry();

      let cancelled = false;
      let objectUrl: string | null = null;
      this.url.set(null);
      this.failed.set(false);

      void this.service
        .download(chatId, messageId)
        .then((file) => {
          if (cancelled) {
            return;
          }

          objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(file.bytes)], { type: file.mediaType }),
          );
          this.url.set(objectUrl);
        })
        .catch(() => {
          if (!cancelled) {
            this.failed.set(true);
          }
        });

      onCleanup(() => {
        cancelled = true;
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      });
    });
  }

  dismiss(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) {
      dialog.close();
    }
  }
}

export { ChatImage };
