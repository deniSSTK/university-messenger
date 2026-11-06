import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, timer } from 'rxjs';
import { countCodePoints } from '../../../../core/text/unicode';
import { Auth } from '../../../auth/service/auth';
import { authErrorMessage } from '../../../auth/ui/auth-form.utils';
import { Users, UserSearchValidationError } from '../../../users/service/users';
import { MESSAGE_TEXT_MAX_LENGTH } from '../../chats.constants';
import { ChatService, ChatError } from '../../service/chats';
import type { ChatPerson, ChatMessage, Conversation } from '../../service/chats.types';
import { ChatDrafts } from './chat-drafts';
import { ChatIcon } from './chat-icon';
import { ChatBubble } from './chat-bubble';
import { ChatAccountMenu } from './chat-account-menu';
import type { PersonView, MessageView, ConversationView } from './chats-view.types';

function personView(person: ChatPerson): PersonView {
  return { id: person.id, username: person.username, displayName: person.displayName };
}
function messageView(message: ChatMessage): MessageView {
  return {
    id: message.id,
    senderId: message.senderId,
    text: message.text,
    createdAt: message.createdAt,
  };
}
function conversationView(chat: Conversation): ConversationView {
  return {
    id: chat.id,
    person: personView(chat.person),
    lastMessage: chat.lastMessage ? messageView(chat.lastMessage) : null,
    activityAt: chat.activityAt,
  };
}
function mergeMessages(current: MessageView[], incoming: MessageView[]) {
  const unique = new Map([...current, ...incoming].map((message) => [message.id, message]));
  return [...unique.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
}

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [ChatIcon, ChatBubble, ChatAccountMenu],
  templateUrl: './chats.html',
  styleUrl: './chats.scss',
})
class Chats {
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private service = inject(ChatService);
  private users = inject(Users);
  private destroy = inject(DestroyRef);
  readonly drafts = inject(ChatDrafts);
  private searchRequests = new Subject<{ search: string; page: number; wait: boolean }>();
  private chatGeneration = 0;
  private listGeneration = 0;
  private navigationGeneration = 0;
  private destroyed = false;
  private listPage = 0;
  @ViewChild('messageViewport') private viewport?: ElementRef<HTMLElement>;
  @ViewChild('composerInput') private composerInput?: ElementRef<HTMLTextAreaElement>;
  private historyRetry: 'older' | 'refresh' = 'refresh';
  private latestFetchedMessageId: string | null = null;
  private listRetryMore = false;
  readonly accountMenuOpen = signal(false);
  readonly chatMenuOpen = signal(false);
  readonly profileLoading = signal(false);
  readonly profileError = signal('');
  readonly showScrollDown = signal(false);

  readonly messageRows = computed(() => {
    const messages = this.messages();
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const newDay =
        !previous || this.dayKey(previous.createdAt) !== this.dayKey(message.createdAt);
      return {
        message,
        dateLabel: newDay ? this.dayLabel(message.createdAt) : null,
        grouped: !newDay && previous.senderId === message.senderId,
      };
    });
  });
  readonly search = signal('');
  readonly searchPage = signal(1);
  readonly searchPages = signal(0);
  readonly searchResults = signal<PersonView[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal('');
  readonly searching = computed(() => this.search().trim().length > 0);
  readonly chats = signal<ConversationView[]>([]);
  readonly listLoading = signal(false);
  readonly listError = signal('');
  readonly hasMoreChats = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly active = signal<ConversationView | null>(null);
  readonly viewer = signal<PersonView | null>(null);
  readonly messages = signal<MessageView[]>([]);
  readonly chatLoading = signal(false);
  readonly chatError = signal('');
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly nextBefore = signal<string | null>(null);
  readonly openingUserId = signal<string | null>(null);
  readonly openError = signal('');
  readonly draft = signal('');
  readonly isLoggingOut = signal(false);
  readonly errorMessage = signal('');
  readonly sending = computed(() => this.drafts.pending().has(this.selectedId() ?? ''));
  readonly sendError = computed(() => this.drafts.errors().get(this.draftKey()) ?? '');
  readonly messageTextMaxLength = MESSAGE_TEXT_MAX_LENGTH;
  readonly draftLength = computed(() => countCodePoints(this.draft()));
  readonly draftTooLong = computed(() => this.draftLength() > this.messageTextMaxLength);
  readonly canSend = computed(
    () => !!this.active() && !!this.draft().trim() && !this.draftTooLong() && !this.sending(),
  );

  constructor() {
    this.destroy.onDestroy(() => {
      this.destroyed = true;
      this.chatGeneration++;
    });
    this.searchRequests
      .pipe(
        switchMap((request) => {
          if (!request.search.trim()) {
            return of({ result: null, error: '' });
          }

          return timer(request.wait ? 300 : 0).pipe(
            switchMap(() => this.users.search({ search: request.search, page: request.page })),
            map((result) => ({ result, error: '' })),
            catchError((error: unknown) =>
              of({
                result: null,
                error:
                  error instanceof UserSearchValidationError
                    ? 'Введіть 1–32 літери латиницею, цифри або _. На початку можна @.'
                    : 'Не вдалося знайти користувачів. Спробуйте ще раз.',
              }),
            ),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe(({ result, error }) => {
        this.searchLoading.set(false);
        this.searchError.set(error);
        this.searchResults.set(
          result?.users.map((user) => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
          })) ?? [],
        );
        this.searchPages.set(result?.totalPages ?? 0);
      });
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      void this.selectChat(params.get('chatId'));
    });
    void this.loadChats();
  }

  inputValue(event: Event): string {
    const target = event.target;
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.value
      : '';
  }
  searchChanged(value: string) {
    this.openError.set('');
    this.search.set(value);
    this.searchPage.set(1);
    this.requestSearch(true);
  }
  searchAt(page: number) {
    this.searchPage.set(page);
    this.requestSearch(false);
  }
  retrySearch() {
    this.requestSearch(false);
  }
  private requestSearch(wait: boolean) {
    this.searchResults.set([]);
    this.searchPages.set(0);
    this.searchError.set('');
    this.searchLoading.set(this.searching());
    this.searchRequests.next({ search: this.search(), page: this.searchPage(), wait });
  }

  async loadChats(more = false) {
    if (more && (this.listLoading() || !this.hasMoreChats())) {
      return;
    }

    const generation = ++this.listGeneration;
    this.listRetryMore = more;
    const page = more ? this.listPage + 1 : 1;
    this.listLoading.set(true);
    this.listError.set('');

    try {
      const result = await this.service.list(page);

      if (this.destroyed || generation !== this.listGeneration) {
        return;
      }

      const incoming = result.chats.map(conversationView);
      const unique = new Map(
        [...(more ? this.chats() : []), ...incoming].map((chat) => [chat.id, chat]),
      );
      this.chats.set([...unique.values()]);
      this.hasMoreChats.set(result.hasMore);
      this.listPage = page;
    } catch {
      if (!this.destroyed && generation === this.listGeneration) {
        this.listError.set('Не вдалося завантажити чати. Спробуйте ще раз.');
      }
    } finally {
      if (!this.destroyed && generation === this.listGeneration) {
        this.listLoading.set(false);
      }
    }
  }

  async openUser(user: PersonView) {
    if (this.openingUserId()) {
      return;
    }

    const generation = ++this.navigationGeneration;
    this.openingUserId.set(user.id);
    this.openError.set('');

    try {
      const chat = await this.service.open({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      });

      if (this.destroyed || generation !== this.navigationGeneration) {
        return;
      }

      this.searchChanged('');
      await this.router.navigate(['/chats', chat.id]);
      await this.loadChats();
    } catch {
      if (!this.destroyed && generation === this.navigationGeneration) {
        this.openError.set('Не вдалося відкрити діалог. Натисніть на користувача, щоб повторити.');
      }
    } finally {
      this.openingUserId.set(null);
    }
  }
  openChat(chatId: string) {
    this.navigationGeneration++;
    void this.router.navigate(['/chats', chatId]);
  }
  back() {
    this.navigationGeneration++;
    void this.router.navigate(['/chats']);
  }
  async selectChat(chatId: string | null) {
    const generation = ++this.chatGeneration;
    this.navigationGeneration++;
    this.closeMenus();
    this.selectedId.set(chatId);
    this.showScrollDown.set(false);
    this.active.set(null);
    this.messages.set([]);
    this.nextBefore.set(null);
    this.latestFetchedMessageId = null;
    this.chatError.set('');
    this.historyError.set('');
    this.historyLoading.set(false);
    this.chatLoading.set(!!chatId);
    this.draft.set('');

    if (!chatId) {
      return;
    }

    try {
      const [viewer, chat, history] = await Promise.all([
        this.service.viewer(),
        this.service.get(chatId),
        this.service.history(chatId),
      ]);

      if (!this.current(generation, chatId)) {
        return;
      }

      this.viewer.set(personView(viewer));
      this.active.set(conversationView(chat));
      this.messages.update((current) => mergeMessages(current, history.messages.map(messageView)));
      this.nextBefore.set(history.nextBefore);
      this.latestFetchedMessageId = history.messages.at(-1)?.id ?? null;
      this.draft.set(this.drafts.get(viewer.id, chatId));
      this.afterRender(chatId, () => {
        this.scrollToBottom();
        this.resizeComposer();
      });
    } catch (error: unknown) {
      if (this.current(generation, chatId)) {
        this.chatError.set(
          error instanceof ChatError && (error.code === 'missing' || error.code === 'validation')
            ? 'Цей чат недоступний або його не існує.'
            : 'Не вдалося завантажити діалог. Спробуйте ще раз.',
        );
      }
    } finally {
      if (this.current(generation, chatId)) {
        this.chatLoading.set(false);
      }
    }
  }
  retryChat() {
    void this.selectChat(this.selectedId());
  }

  async loadOlder() {
    const chatId = this.selectedId();
    const before = this.nextBefore();

    if (!chatId || !before || this.historyLoading()) {
      return;
    }

    const generation = this.chatGeneration;
    const viewport = this.viewport?.nativeElement;
    this.historyRetry = 'older';
    this.historyLoading.set(true);
    this.historyError.set('');

    try {
      const history = await this.service.history(chatId, before);

      if (!this.current(generation, chatId)) {
        return;
      }

      const height = viewport?.scrollHeight ?? 0;
      const top = viewport?.scrollTop ?? 0;
      const anchor = this.captureAnchor();
      this.messages.update((current) => mergeMessages(current, history.messages.map(messageView)));
      this.nextBefore.set(history.nextBefore);
      this.afterRender(chatId, () => {
        if (!this.restoreAnchor(anchor) && viewport) {
          viewport.scrollTop = top + viewport.scrollHeight - height;
        }
        this.viewportScrolled();
      });
    } catch {
      if (this.current(generation, chatId)) {
        this.historyError.set('Не вдалося завантажити старіші повідомлення. Спробуйте ще раз.');
      }
    } finally {
      if (this.current(generation, chatId)) {
        this.historyLoading.set(false);
      }
    }
  }
  async refreshMessages() {
    const chatId = this.selectedId();

    if (!chatId || this.historyLoading() || this.chatLoading()) {
      return;
    }

    const generation = this.chatGeneration;
    const viewport = this.viewport?.nativeElement;
    const latestFetchedMessageId = this.latestFetchedMessageId;
    this.historyRetry = 'refresh';
    this.historyLoading.set(true);
    this.historyError.set('');

    try {
      const result = await this.service.refreshHistory(chatId, latestFetchedMessageId);

      if (!this.current(generation, chatId)) {
        return;
      }

      const atBottom =
        !!viewport && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 40;
      const anchor = this.captureAnchor();
      const overlaps = result.messages.some((message) => message.id === latestFetchedMessageId);

      this.messages.update((current) => mergeMessages(current, result.messages.map(messageView)));
      this.latestFetchedMessageId = result.messages.at(-1)?.id ?? latestFetchedMessageId;

      if (!overlaps) {
        this.nextBefore.set(result.nextBefore);
      }

      this.afterRender(chatId, () => {
        if (atBottom) {
          this.scrollToBottom();
        } else {
          this.restoreAnchor(anchor);
          this.viewportScrolled();
        }
      });

      await this.loadChats();
    } catch {
      if (this.current(generation, chatId)) {
        this.historyError.set('Не вдалося оновити повідомлення. Спробуйте ще раз.');
      }
    } finally {
      if (this.current(generation, chatId)) {
        this.historyLoading.set(false);
      }
    }
  }
  draftChanged(text: string) {
    const viewer = this.viewer();
    const chatId = this.selectedId();
    this.draft.set(text);
    this.resizeComposer();

    if (viewer && chatId) {
      this.drafts.set(viewer.id, chatId, text);
    }
  }
  composerKey(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.send();
    }
  }
  async send() {
    const chatId = this.selectedId();
    const viewer = this.viewer();

    if (!chatId || !viewer || !this.canSend()) {
      return;
    }

    const text = this.draft();
    const key = `${viewer.id}:${chatId}`;
    this.drafts.begin(chatId);
    this.drafts.errors.update((errors) => new Map([...errors].filter(([id]) => id !== key)));

    try {
      const message = await this.service.send(chatId, text);

      if (this.drafts.get(viewer.id, chatId) === text) {
        this.drafts.set(viewer.id, chatId, '');
      }

      if (!this.destroyed && this.selectedId() === chatId) {
        this.messages.update((current) => mergeMessages(current, [messageView(message)]));
        this.draft.set(this.drafts.get(viewer.id, chatId));
        this.afterRender(chatId, () => this.resizeComposer());
        this.afterRender(chatId, () => this.scrollToBottom());
      }

      if (!this.destroyed) {
        await this.loadChats();
      }
    } catch {
      this.drafts.errors.update(
        (errors) =>
          new Map([
            ...errors,
            [key, 'Повідомлення не надіслано. Текст збережено, спробуйте ще раз.'],
          ]),
      );
    } finally {
      this.drafts.end(chatId);
    }
  }
  async logout() {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.logout();
      this.drafts.clear();
      await this.router.navigate(['/login']);
    } catch (error: unknown) {
      this.errorMessage.set(authErrorMessage(error));
    } finally {
      this.isLoggingOut.set(false);
    }
  }
  async toggleAccountMenu() {
    this.accountMenuOpen.update((open) => !open);
    this.chatMenuOpen.set(false);

    if (!this.accountMenuOpen() || this.viewer() || this.profileLoading()) {
      return;
    }

    this.profileLoading.set(true);
    this.profileError.set('');
    try {
      const viewer = await this.service.viewer();
      if (!this.destroyed) {
        this.viewer.set(personView(viewer));
      }
    } catch {
      this.profileError.set('Не вдалося завантажити акаунт.');
    } finally {
      this.profileLoading.set(false);
    }
  }
  closeMenus() {
    this.accountMenuOpen.set(false);
    this.chatMenuOpen.set(false);
  }
  retryList() {
    void this.loadChats(this.listRetryMore);
  }
  retryHistory() {
    if (this.historyRetry === 'older') {
      void this.loadOlder();
    } else {
      void this.refreshMessages();
    }
  }
  viewportScrolled() {
    const viewport = this.viewport?.nativeElement;
    this.showScrollDown.set(
      !!viewport && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > 120,
    );
  }
  jumpToLatest() {
    this.scrollToBottom();
  }
  chatTime(value: string): string {
    const date = new Date(value);
    return new Intl.DateTimeFormat(
      'uk-UA',
      this.dayKey(value) === this.dayKey(new Date().toISOString())
        ? { hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: '2-digit' },
    ).format(date);
  }
  initials(name: string) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] ?? '')
      .join('')
      .toLocaleUpperCase('uk-UA');
  }
  private dayKey(value: string) {
    return new Date(value).toDateString();
  }
  private dayLabel(value: string) {
    const now = new Date();
    if (this.dayKey(value) === now.toDateString()) {
      return 'Сьогодні';
    }
    now.setDate(now.getDate() - 1);
    if (this.dayKey(value) === now.toDateString()) {
      return 'Учора';
    }
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: new Date(value).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    }).format(new Date(value));
  }
  private resizeComposer() {
    const input = this.composerInput?.nativeElement;
    if (input) {
      input.style.height = '0px';
      input.style.height = `${Math.max(24, Math.min(input.scrollHeight, 144))}px`;
    }
  }
  private captureAnchor(): { id: string; offset: number } | null {
    const viewport = this.viewport?.nativeElement;
    if (!viewport) {
      return null;
    }
    const top = viewport.getBoundingClientRect().top;
    const row = Array.from(viewport.querySelectorAll<HTMLElement>('[data-message-id]')).find(
      (element) => element.getBoundingClientRect().bottom > top,
    );
    return row
      ? { id: row.dataset['messageId'] ?? '', offset: row.getBoundingClientRect().top - top }
      : null;
  }
  private restoreAnchor(anchor: { id: string; offset: number } | null): boolean {
    const viewport = this.viewport?.nativeElement;
    if (!viewport || !anchor) {
      return false;
    }
    const row = Array.from(viewport.querySelectorAll<HTMLElement>('[data-message-id]')).find(
      (element) => element.dataset['messageId'] === anchor.id,
    );
    if (!row) {
      return false;
    }
    viewport.scrollTop +=
      row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - anchor.offset;
    return true;
  }
  private draftKey() {
    return `${this.viewer()?.id}:${this.selectedId()}`;
  }
  private current(generation: number, chatId: string) {
    return !this.destroyed && generation === this.chatGeneration && chatId === this.selectedId();
  }
  private afterRender(chatId: string, operation: () => void) {
    setTimeout(() => {
      if (!this.destroyed && this.selectedId() === chatId) {
        operation();
      }
    });
  }
  private scrollToBottom() {
    const element = this.viewport?.nativeElement;

    if (element) {
      element.scrollTop = element.scrollHeight;
      this.showScrollDown.set(false);
    }
  }
}
export { Chats };
