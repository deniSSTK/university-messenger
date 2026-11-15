import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ChatService } from '../../service/chats';
import { ImageViewer } from '../../../../shared/ui/dialog/image-viewer';
import { Spinner } from '../../../../shared/ui/spinner/spinner';

@Component({
  selector: 'app-chat-image',
  imports: [ImageViewer, Spinner],
  host: { '[class.gallery-tile]': 'gallery()' },
  template: `
    @if (!failed() && url(); as source) {
      <button
        class="thumbnail"
        type="button"
        [attr.aria-label]="'Відкрити ' + name()"
        (click)="viewerOpen.set(true)"
      >
        <img [src]="source" [alt]="name()" (load)="imageLoaded.emit()" (error)="failed.set(true)" />
      </button>
      @if (viewerOpen()) {
        <app-image-viewer
          [src]="source"
          [name]="name()"
          [downloadable]="true"
          (closed)="viewerOpen.set(false)"
        />
      }
    } @else if (failed()) {
      <button
        class="image-status"
        type="button"
        [attr.aria-label]="'Повторити завантаження ' + name()"
        (click)="retry.update(increment)"
      >
        {{ gallery() ? 'Повторити' : 'Не вдалося завантажити фото. Повторити' }}
      </button>
    } @else {
      <div class="image-status" role="status">
        @if (!gallery() || visible()) {
          <app-spinner />
        }
        <span [class.sr-only]="gallery()">Завантажуємо фото…</span>
      </div>
    }
  `,
  styleUrl: './chat-image.scss',
})
class ChatImage {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(ChatService);
  readonly chatId = input.required<string>();
  readonly messageId = input.required<string>();
  readonly name = input.required<string>();
  readonly gallery = input(false);
  readonly visible = signal(false);
  readonly viewerOpen = signal(false);
  readonly url = signal<string | null>(null);
  readonly failed = signal(false);
  readonly retry = signal(0);
  readonly imageLoaded = output<void>();
  readonly increment = (value: number) => value + 1;

  constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.gallery()) {
        return;
      }

      if (typeof IntersectionObserver === 'undefined') {
        this.visible.set(true);
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.visible.set(true);
          observer.disconnect();
        }
      });
      observer.observe(this.host.nativeElement);
      destroy.onDestroy(() => observer.disconnect());
    });

    effect((onCleanup) => {
      if (this.gallery() && !this.visible()) {
        return;
      }

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
}

export { ChatImage };
