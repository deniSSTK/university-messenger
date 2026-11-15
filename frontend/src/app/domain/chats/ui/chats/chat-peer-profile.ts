import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  computed,
  ElementRef,
  Injector,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Button } from '../../../../shared/ui/button/button';
import { Dialog } from '../../../../shared/ui/dialog/dialog';
import { ImageViewer } from '../../../../shared/ui/dialog/image-viewer';
import { IconBack } from '../../../../shared/ui/icons/back';
import { IconChat } from '../../../../shared/ui/icons/chat';
import { IconDownload } from '../../../../shared/ui/icons/download';
import { IconTrash } from '../../../../shared/ui/icons/trash';
import { Spinner } from '../../../../shared/ui/spinner/spinner';
import { ChatService } from '../../service/chats';
import type { ChatFile } from '../../service/chats.types';
import type { PersonView } from './chats-view.types';
import { downloadAttachment } from './download-attachment';
import { ChatImage } from './chat-image';
import { VoicePlayer } from './voice-player';

type MediaCategory = 'photos' | 'videos' | 'files' | 'audio' | 'voice' | 'gifs';
type MediaSummary = Record<MediaCategory, number>;
type MediaItem = {
  id: string;
  name: string;
  createdAt: string;
  voice?: { durationMs: number; waveform: number[] };
};
type PhotoMonth = { key: string; label: string; photos: MediaItem[] };
type MediaViewer = { url: string; name: string; kind: 'image' | 'video' | 'audio' };

const CATEGORIES: { id: MediaCategory; label: string }[] = [
  { id: 'photos', label: 'Фото' },
  { id: 'videos', label: 'Відео' },
  { id: 'files', label: 'Файли' },
  { id: 'audio', label: 'Аудіофайли' },
  { id: 'voice', label: 'Голосові' },
  { id: 'gifs', label: 'GIF' },
];

const monthName = new Intl.DateTimeFormat('uk-UA', { month: 'long' });
const monthAndYear = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' });

@Component({
  selector: 'app-chat-peer-profile',
  imports: [
    Avatar,
    Button,
    Dialog,
    ImageViewer,
    ChatImage,
    VoicePlayer,
    IconBack,
    IconChat,
    IconDownload,
    IconTrash,
    Spinner,
    DatePipe,
  ],
  template: `
    <app-dialog layout="profile" heading="Профіль користувача" (closed)="closed.emit()">
      @if (category(); as selected) {
        <section class="media-panel" [class.photo-panel]="selected === 'photos'">
          <div class="media-header">
            <button
              appButton
              variant="icon"
              type="button"
              aria-label="Назад до профілю"
              (click)="backToProfile()"
            >
              <app-icon-back />
            </button>
            <h2 tabindex="-1" class="category-title">{{ categoryLabel(selected) }}</h2>
          </div>
          @if (selected === 'photos') {
            @for (month of photoMonths(); track month.key) {
              <section class="photo-month">
                <h3>{{ month.label }}</h3>
                <ul class="photo-grid">
                  @for (photo of month.photos; track photo.id) {
                    <li>
                      <app-chat-image
                        [chatId]="chatId()"
                        [messageId]="photo.id"
                        [name]="photo.name"
                        [gallery]="true"
                      />
                    </li>
                  }
                </ul>
              </section>
            }
          } @else if (selected === 'voice') {
            <ul class="media-list">
              @for (item of items(); track item.id) {
                @if (item.voice; as voice) {
                  <li class="voice-row">
                    <app-voice-player
                      [chatId]="chatId()"
                      [messageId]="item.id"
                      [durationMs]="voice.durationMs"
                      [waveform]="voice.waveform"
                    />
                    <time [attr.datetime]="item.createdAt">{{
                      item.createdAt | date: 'dd.MM.yy'
                    }}</time>
                  </li>
                }
              }
            </ul>
          } @else if (items().length) {
            <ul class="media-list">
              @for (item of items(); track item.id) {
                <li>
                  <button
                    type="button"
                    class="profile-row file-row"
                    (click)="openMedia(item)"
                    [attr.aria-disabled]="!!openingMedia()"
                  >
                    @if (openingMedia() === item.id) {
                      <app-spinner />
                    } @else {
                      <app-icon-download />
                    }
                    <span>{{ item.name }}</span>
                    <time [attr.datetime]="item.createdAt">{{
                      item.createdAt | date: 'dd.MM.yy'
                    }}</time>
                  </button>
                </li>
              }
            </ul>
          }
          @if (mediaError()) {
            <div class="state" role="alert">
              {{ mediaError() }}
              @if (pageError()) {
                <button appButton variant="ghost" type="button" (click)="loadPage()">
                  Повторити
                </button>
              }
            </div>
          } @else if (!pageLoading() && items().length === 0) {
            <p class="state">У цій категорії поки немає файлів.</p>
          }
          @if (pageLoading()) {
            <p class="state loading" role="status"><app-spinner /> Завантажуємо файли…</p>
          } @else if (cursor() && !pageError()) {
            <button class="more" appButton variant="ghost" type="button" (click)="loadPage()">
              Показати ще
            </button>
          }
        </section>
      } @else {
        <section class="profile-header">
          @if (avatarSrc(); as source) {
            <button
              type="button"
              class="avatar-button"
              aria-label="Відкрити аватар"
              (click)="avatarOpen.set(true)"
            >
              <app-avatar [size]="100" [name]="person().displayName" [src]="source" />
            </button>
          } @else {
            <app-avatar [size]="100" [name]="person().displayName" />
          }
          <h2>{{ person().displayName }}</h2>
          <button class="message-button" type="button" (click)="closed.emit()">
            <app-icon-chat />
            Написати
          </button>
        </section>
        @if (person().username; as username) {
          <section class="username">
            <span>{{ username.startsWith('@') ? username : '@' + username }}</span>
            <small>Ім’я користувача</small>
          </section>
        }
        @if (hasMedia() || countsLoading() || countsError()) {
          <section class="shared-media" aria-label="Спільні медіа">
            @for (entry of categories; track entry.id) {
              @if (counts()?.[entry.id]; as count) {
                <button
                  type="button"
                  class="profile-row"
                  [attr.data-category]="entry.id"
                  (click)="selectCategory(entry.id)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    @switch (entry.id) {
                      @case ('photos') {
                        <rect x="3" y="3" width="18" height="18" rx="4" />
                        <path d="m4 16 5-4 4 3 4-5 4 4" />
                        <circle cx="8" cy="8" r="1" />
                      }
                      @case ('videos') {
                        <rect x="3" y="5" width="13" height="14" rx="3" />
                        <path d="m16 9 4-2h1v10h-1l-4-2" />
                      }
                      @case ('audio') {
                        <path d="M4 16V12a8 8 0 0 1 16 0v4" />
                        <rect x="4" y="13" width="4" height="7" rx="1.5" />
                        <rect x="16" y="13" width="4" height="7" rx="1.5" />
                      }
                      @case ('voice') {
                        <rect x="9" y="2" width="6" height="13" rx="3" />
                        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6" />
                      }
                      @case ('gifs') {
                        <rect x="2" y="5" width="20" height="14" rx="3" />
                        <path d="M9 10H6v4h3v-2H8m4-2v4m3 0v-4h3m-3 2h2" />
                      }
                      @default {
                        <path d="M13 3H7a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V10z" />
                        <path d="M13 3v7h7" />
                      }
                    }
                  </svg>
                  <span>{{ entry.label }}</span>
                  <span class="count">{{ count }}</span>
                </button>
              }
            }
            @if (countsLoading() && !counts()) {
              <p class="state loading" role="status"><app-spinner /> Завантажуємо спільні медіа…</p>
            } @else if (countsError()) {
              <div class="state" role="alert">
                Не вдалося завантажити спільні медіа.
                <button appButton variant="ghost" type="button" (click)="loadCounts()">
                  Повторити
                </button>
              </div>
            }
          </section>
        }
        <section class="profile-footer">
          <button type="button" class="profile-row destructive" (click)="confirmOpen.set(true)">
            <app-icon-trash /> Видалити користувача
          </button>
        </section>
      }
    </app-dialog>

    @if (avatarOpen() && avatarSrc(); as source) {
      <app-image-viewer
        [src]="source"
        [name]="person().displayName"
        [canRetry]="true"
        (retry)="refreshAvatar()"
        (closed)="avatarOpen.set(false)"
      />
    }
    @if (viewer(); as file) {
      @if (file.kind === 'image') {
        <app-image-viewer
          [src]="file.url"
          [name]="file.name"
          [downloadable]="true"
          (closed)="closeMedia()"
        />
      } @else {
        <app-dialog [heading]="file.name" (closed)="closeMedia()">
          @if (file.kind === 'video') {
            <video controls playsinline [src]="file.url" (error)="playbackError.set(true)"></video>
          } @else {
            <audio controls [src]="file.url" (error)="playbackError.set(true)"></audio>
          }
          @if (playbackError()) {
            <p class="state" role="alert">Браузер не може відтворити цей файл.</p>
          }
          <a class="media-download" [href]="file.url" [download]="file.name">Завантажити файл</a>
        </app-dialog>
      }
    }
    @if (confirmOpen()) {
      <app-dialog
        heading="Видалити користувача?"
        [locked]="hiding()"
        (closed)="confirmOpen.set(false)"
      >
        <p>
          Діалог зникне з вашого списку. Щоб знову відкрити історію, знайдіть користувача через
          пошук.
        </p>
        @if (hideError()) {
          <p class="hide-error" role="alert">Не вдалося приховати діалог. Спробуйте ще раз.</p>
        }
        <div class="confirm-actions">
          <button
            appButton
            variant="secondary"
            type="button"
            [disabled]="hiding()"
            (click)="confirmOpen.set(false)"
          >
            Скасувати
          </button>
          <button appButton variant="danger" type="button" [busy]="hiding()" (click)="hide()">
            Видалити
          </button>
        </div>
      </app-dialog>
    }
  `,
  styleUrl: './chat-peer-profile.scss',
})
class ChatPeerProfile {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly service = inject(ChatService);
  private readonly destroy = inject(DestroyRef);
  private destroyed = false;
  private pageGeneration = 0;
  private countsGeneration = 0;
  private avatarRefreshing = false;

  readonly chatId = input.required<string>();
  readonly person = input.required<PersonView>();
  readonly mediaRevision = input(0);
  readonly closed = output<void>();
  readonly hidden = output<void>();
  readonly categories = CATEGORIES;
  readonly counts = signal<MediaSummary | null>(null);
  readonly hasMedia = computed(() =>
    this.categories.some(({ id }) => (this.counts()?.[id] ?? 0) > 0),
  );
  readonly countsLoading = signal(false);
  readonly countsError = signal(false);
  readonly category = signal<MediaCategory | null>(null);
  readonly items = signal<MediaItem[]>([]);
  readonly photoMonths = computed(() => {
    const months = new Map<string, PhotoMonth>();
    const currentYear = new Date().getFullYear();

    for (const photo of this.items()) {
      const date = new Date(photo.createdAt);
      const year = date.getFullYear();
      const key = `${year}-${date.getMonth()}`;
      const existing = months.get(key);

      if (existing) {
        existing.photos.push(photo);
      } else {
        const label = (year === currentYear ? monthName : monthAndYear).format(date);
        months.set(key, { key, label, photos: [photo] });
      }
    }

    return [...months.values()];
  });
  readonly cursor = signal<string | null>(null);
  readonly pageLoading = signal(false);
  readonly pageError = signal(false);
  readonly mediaError = signal('');
  readonly openingMedia = signal<string | null>(null);
  readonly viewer = signal<MediaViewer | null>(null);
  readonly playbackError = signal(false);
  readonly avatarOpen = signal(false);
  readonly avatarRefresh = signal<string | null>(null);
  readonly confirmOpen = signal(false);
  readonly hiding = signal(false);
  readonly hideError = signal(false);

  constructor() {
    effect((cleanup) => {
      this.mediaRevision();
      const delay = untracked(() => (this.counts() ? 200 : 0));
      const timer = setTimeout(() => void this.loadCounts(), delay);
      cleanup(() => clearTimeout(timer));
    });

    this.destroy.onDestroy(() => {
      this.destroyed = true;
      this.closeMedia();
    });
  }

  avatarSrc(): string | null {
    return this.avatarRefresh() ?? this.person().avatarUrl ?? null;
  }

  async refreshAvatar(): Promise<void> {
    if (this.avatarRefreshing) {
      return;
    }

    this.avatarRefreshing = true;
    try {
      const chat = await this.service.get(this.chatId());
      if (!this.destroyed) {
        this.avatarRefresh.set(chat.person.avatarUrl ?? null);
      }
    } catch {
      // The viewer retains the retry action.
    } finally {
      this.avatarRefreshing = false;
    }
  }

  async loadCounts(): Promise<void> {
    const generation = ++this.countsGeneration;
    this.countsLoading.set(true);
    this.countsError.set(false);

    try {
      const counts = await this.service.mediaCounts(this.chatId());
      if (!this.destroyed && generation === this.countsGeneration) {
        const previous = this.counts();
        const category = this.category();
        this.counts.set(counts);
        if (previous && category && previous[category] !== counts[category] && !this.viewer()) {
          this.openingMedia.set(null);
          this.selectCategory(category, false);
        }
      }
    } catch {
      if (!this.destroyed && generation === this.countsGeneration) {
        this.countsError.set(true);
      }
    } finally {
      if (!this.destroyed && generation === this.countsGeneration) {
        this.countsLoading.set(false);
      }
    }
  }

  categoryLabel(category: MediaCategory): string {
    return CATEGORIES.find((entry) => entry.id === category)?.label ?? '';
  }

  selectCategory(category: MediaCategory, moveFocus = true): void {
    this.pageGeneration++;
    this.category.set(category);
    this.items.set([]);
    this.cursor.set(null);
    this.pageLoading.set(false);
    this.pageError.set(false);
    this.mediaError.set('');
    void this.loadPage();
    if (moveFocus) {
      this.focusAfterRender('.category-title');
    }
  }

  backToProfile(): void {
    const previous = this.category();
    this.pageGeneration++;
    this.openingMedia.set(null);
    this.category.set(null);
    const selector =
      previous && this.counts()?.[previous] ? `[data-category="${previous}"]` : '.message-button';
    this.focusAfterRender(selector);
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        host.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  async loadPage(): Promise<void> {
    const category = this.category();

    if (!category || this.pageLoading()) {
      return;
    }

    const generation = this.pageGeneration;
    this.pageLoading.set(true);
    this.pageError.set(false);
    this.mediaError.set('');

    try {
      const page = await this.service.media(this.chatId(), category, this.cursor());

      if (!this.destroyed && generation === this.pageGeneration) {
        const next = page.messages.flatMap((message) =>
          message.attachment
            ? [
                {
                  id: message.id,
                  name: message.attachment.name,
                  createdAt: message.createdAt,
                  ...(message.attachment.voice ? { voice: message.attachment.voice } : {}),
                },
              ]
            : [],
        );
        this.items.update((current) => [
          ...new Map([...current, ...next].map((item) => [item.id, item])).values(),
        ]);
        this.cursor.set(page.nextBefore);
      }
    } catch {
      if (!this.destroyed && generation === this.pageGeneration) {
        this.pageError.set(true);
        this.mediaError.set('Не вдалося завантажити файли.');
      }
    } finally {
      if (!this.destroyed && generation === this.pageGeneration) {
        this.pageLoading.set(false);
      }
    }
  }

  async openMedia(item: MediaItem): Promise<void> {
    const category = this.category();

    if (!category || this.openingMedia()) {
      return;
    }

    const generation = this.pageGeneration;
    this.openingMedia.set(item.id);
    this.mediaError.set('');

    try {
      const file = await this.service.download(this.chatId(), item.id);

      if (!this.destroyed && generation === this.pageGeneration) {
        this.presentMedia(category, file);
      }
    } catch {
      if (!this.destroyed && generation === this.pageGeneration) {
        this.mediaError.set('Не вдалося відкрити файл. Натисніть на нього ще раз.');
      }
    } finally {
      if (!this.destroyed && generation === this.pageGeneration) {
        this.openingMedia.set(null);
      }
    }
  }

  private presentMedia(category: MediaCategory, file: ChatFile): void {
    if (category === 'files') {
      downloadAttachment(file);
      return;
    }

    const kind = category === 'audio' ? 'audio' : category === 'videos' ? 'video' : 'image';
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(file.bytes)], { type: file.mediaType }),
    );
    this.playbackError.set(false);
    this.viewer.set({ url, name: file.name, kind });
  }

  closeMedia(): void {
    const file = this.viewer();
    if (file) {
      this.viewer.set(null);
      URL.revokeObjectURL(file.url);
    }
  }

  async hide(): Promise<void> {
    if (this.hiding()) {
      return;
    }

    this.hiding.set(true);
    this.hideError.set(false);

    try {
      await this.service.hide(this.chatId());
      if (!this.destroyed) {
        this.hidden.emit();
      }
    } catch {
      if (!this.destroyed) {
        this.hideError.set(true);
      }
    } finally {
      if (!this.destroyed) {
        this.hiding.set(false);
      }
    }
  }
}

export { ChatPeerProfile };
