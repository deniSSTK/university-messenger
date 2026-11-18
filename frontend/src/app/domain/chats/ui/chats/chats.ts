import type { ReactionState, ReactionType } from '@university-messenger/events';
import { WebSocketEventType } from '@university-messenger/events';
import { FilePicker } from '../../../../shared/ui/file-picker/file-picker';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Spinner } from '../../../../shared/ui/spinner/spinner';
import { Input } from '../../../../shared/ui/input/input';
import { Button } from '../../../../shared/ui/button/button';
import { IconSend } from '../../../../shared/ui/icons/send';
import { IconBack } from '../../../../shared/ui/icons/back';
import { IconSearch } from '../../../../shared/ui/icons/search';
import { IconMenu } from '../../../../shared/ui/icons/menu';
import { IconChat } from '../../../../shared/ui/icons/chat';
import { IconEdit } from '../../../../shared/ui/icons/edit';
import { IconMore } from '../../../../shared/ui/icons/more';
import { IconChevronDown } from '../../../../shared/ui/icons/chevron-down';
import { IconClose } from '../../../../shared/ui/icons/close';
import { ChatNicknameEditor } from './chat-nickname-editor';
import { ChatPeerProfile } from './chat-peer-profile';
import { downloadAttachment } from './download-attachment';
import { ChatProfileEditor } from './chat-profile-editor';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, timer, firstValueFrom } from 'rxjs';
import { countCodePoints } from '../../../../core/text/unicode';
import { Auth } from '../../../auth/service/auth';
import { authErrorMessage } from '../../../auth/ui/auth-form.utils';
import { Users, UserSearchValidationError } from '../../../users/service/users';
import type { Nickname, UserNickname } from '../../../users/service/users';
import { MESSAGE_TEXT_MAX_LENGTH } from '../../chats.constants';
import { ChatService, ChatError } from '../../service/chats';
import type { ChatPerson, ChatMessage, Conversation } from '../../service/chats.types';
import { ChatDrafts } from './chat-drafts';
import { VoiceComposer } from './voice-composer';
import { ChatBubble } from './chat-bubble';
import { ChatAccountMenu } from './chat-account-menu';
import type { PersonView, MessageView, ConversationView } from './chats-view.types';

function personView(person: ChatPerson): PersonView {
  return {
    id: person.id,
    username: person.username,
    displayName: person.displayName,
    avatarUrl: person.avatarUrl ?? null,
    ...(person.defaultReaction ? { defaultReaction: person.defaultReaction } : {}),
  };
}
function messageView(message: ChatMessage): MessageView {
  return {
    id: message.id,
    senderId: message.senderId,
    ...(message.sender ? { sender: personView(message.sender) } : {}),
    ...(message.reply
      ? { reply: { ...message.reply, author: message.reply.author && { ...message.reply.author } } }
      : {}),
    text: message.text,
    createdAt: message.createdAt,
    ...(message.reactionState ? { reactionState: message.reactionState } : {}),
    ...(message.editedAt !== undefined ? { editedAt: message.editedAt } : {}),
    ...(message.readAt !== undefined ? { readAt: message.readAt } : {}),
    ...(message.attachment !== undefined
      ? {
          attachment: message.attachment
            ? {
                name: message.attachment.name,
                mediaType: message.attachment.mediaType,
                size: message.attachment.size,
                ...(message.attachment.voice
                  ? {
                      voice: {
                        durationMs: message.attachment.voice.durationMs,
                        waveform: message.attachment.voice.waveform,
                      },
                    }
                  : {}),
              }
            : null,
        }
      : {}),
  };
}
function conversationView(chat: Conversation): ConversationView {
  return {
    id: chat.id,
    person: personView(chat.person),
    lastMessage: chat.lastMessage ? messageView(chat.lastMessage) : null,
    activityAt: chat.activityAt,
    ...(chat.unreadCount !== undefined ? { unreadCount: chat.unreadCount } : {}),
  };
}
function withLatestReaction(message: MessageView, known: MessageView | undefined): MessageView {
  const state = known?.reactionState;
  return state && state.reactionVersion > (message.reactionState?.reactionVersion ?? -1)
    ? { ...message, reactionState: state }
    : message;
}

function optimisticReaction(
  state: ReactionState | undefined,
  next: ReactionType | null,
): ReactionState {
  const counts = new Map(state?.reactions.map(({ type, count }) => [type, count]));
  const previous = state?.myReaction;

  if (previous) {
    counts.set(previous, (counts.get(previous) ?? 1) - 1);
  }
  if (next) {
    counts.set(next, (counts.get(next) ?? 0) + 1);
  }

  return {
    reactionVersion: state?.reactionVersion ?? 0,
    myReaction: next,
    reactions: [...counts].flatMap(([type, count]) => (count > 0 ? [{ type, count }] : [])),
  };
}

function mergeMessages(current: MessageView[], incoming: MessageView[]) {
  const unique = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    unique.set(message.id, withLatestReaction(message, unique.get(message.id)));
  }

  return [...unique.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
}

@Component({
  selector: 'app-chats',
  standalone: true,
  imports: [
    FilePicker,
    Avatar,
    Button,
    Input,
    Spinner,
    IconClose,
    IconChevronDown,
    IconMore,
    IconEdit,
    IconChat,
    IconMenu,
    IconSearch,
    IconBack,
    IconSend,
    ChatBubble,
    VoiceComposer,
    ChatAccountMenu,
    ChatProfileEditor,
    ChatPeerProfile,
    ChatNicknameEditor,
  ],
  templateUrl: './chats.html',
  styleUrls: ['./chats.scss', './chats-activity.scss', './chats-replies.scss'],
})
class Chats {
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private service = inject(ChatService);
  private users = inject(Users);
  private readonly title = inject(Title);
  private destroy = inject(DestroyRef);
  readonly drafts = inject(ChatDrafts);
  private searchRequests = new Subject<{ search: string; page: number; wait: boolean }>();
  private chatGeneration = 0;
  private listGeneration = 0;
  private navigationGeneration = 0;
  private destroyed = false;
  private listPage = 0;
  @ViewChild('messageViewport') private viewport?: ElementRef<HTMLElement>;
  @ViewChild('composerInput', { read: ElementRef })
  private composerInput?: ElementRef<HTMLTextAreaElement>;
  private historyRetry: 'older' | 'refresh' = 'refresh';
  private latestFetchedMessageId: string | null = null;
  private listRetryMore = false;
  private retryChatAutomatically = false;
  readonly connection = signal<'connecting' | 'ready' | 'offline'>('connecting');
  readonly peerTyping = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editText = signal('');
  readonly actionBusy = signal(false);
  readonly actionError = signal('');
  readonly peerProfileOpen = signal(false);
  readonly nicknameEditorOpen = signal(false);
  readonly aliases = signal(new Map<string, Nickname>());
  readonly replyTarget = signal<MessageView | null>(null);
  readonly highlightedReplyId = signal<string | null>(null);
  private replyNavigation = 0;
  private replyHighlightTimer?: ReturnType<typeof setTimeout>;
  readonly peerMediaRevision = signal(0);
  readonly profileOpen = signal(false);
  readonly profileName = signal('');
  readonly profileReaction = signal<ReactionType>('HEART');
  readonly profileAvatar = signal<string | null>(null);
  readonly avatarModified = signal(false);
  readonly profileSaving = signal(false);
  private liveTimer?: ReturnType<typeof setTimeout>;
  private typingTimer?: ReturnType<typeof setTimeout>;
  private liveBusy = false;
  private liveConnected = false;
  private syncFailures = 0;
  private livePending = false;
  private readBoundary: string | null = null;
  private lastTypingSent = 0;

  readonly accountMenuOpen = signal(false);
  readonly chatMenuOpen = signal(false);
  readonly profileLoading = signal(false);
  readonly profileError = signal('');
  readonly showScrollDown = signal(false);

  private readonly reactionIntents = signal(new Map<string, ReactionType | null>());
  private readonly reactionRequests = new Set<string>();
  readonly messageRows = computed(() => {
    const messages = this.messages();
    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const newDay =
        !previous || this.dayKey(previous.createdAt) !== this.dayKey(message.createdAt);
      const intent = this.reactionIntents().get(message.id);

      return {
        message:
          intent === undefined
            ? message
            : {
                ...message,
                reactionState: optimisticReaction(message.reactionState, intent),
              },
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
    effect(() => {
      const chatId = this.selectedId();
      const active = this.active();
      const chat = active?.id === chatId ? active : this.chats().find(({ id }) => id === chatId);
      const name = this.chatError() ? undefined : chat?.person.displayName;
      this.title.setTitle(name || 'Chats');
    });

    this.destroy.onDestroy(() => {
      this.destroyed = true;
      this.chatGeneration++;
      clearTimeout(this.liveTimer);
      clearTimeout(this.typingTimer);
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
    this.users
      .listAliases()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (list) => this.aliases.set(new Map(list.map((alias) => [alias.targetUserId, alias]))),
        error: () => this.actionError.set('Не вдалося завантажити псевдоніми.'),
      });
    this.destroy.onDestroy(() => clearTimeout(this.replyHighlightTimer));
    void this.loadChats();
    const stop = this.service.watch((event) => {
      if (event.type === WebSocketEventType.Offline) {
        this.liveConnected = false;
        this.connection.set('offline');
        this.peerTyping.set(false);
      } else if (event.type === WebSocketEventType.Ready) {
        this.liveConnected = true;
        this.connection.set('ready');
        this.queueLiveSync();
      } else if (event.type === WebSocketEventType.Reaction) {
        if (event.chatId === this.selectedId() && event.reaction) {
          const { messageId, ...state } = event.reaction;
          if (this.messages().some(({ id }) => id === messageId)) {
            this.applyReaction(messageId, state);
          } else if (this.chatLoading() || this.historyLoading() || this.liveBusy) {
            this.queueLiveSync();
          }
        }
      } else if (event.type === WebSocketEventType.Changed) {
        if (event.chatId === this.selectedId() && this.peerProfileOpen()) {
          this.peerMediaRevision.update((value) => value + 1);
        }

        this.queueLiveSync();
      } else if (event.chatId === this.selectedId() && event.userId !== this.viewer()?.id) {
        this.peerTyping.set(event.typing === true);
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => this.peerTyping.set(false), 4000);
      }
    });
    const visible = () => {
      if (document.visibilityState === 'visible') {
        this.queueLiveSync();
        this.markVisibleRead();
      }
    };
    document.addEventListener('visibilitychange', visible);
    this.destroy.onDestroy(() => {
      stop();
      document.removeEventListener('visibilitychange', visible);
    });
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
      this.queueLiveSync();
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
    this.nicknameEditorOpen.set(false);
    this.replyTarget.set(null);
    this.highlightedReplyId.set(null);
    this.replyNavigation++;
    this.peerProfileOpen.set(false);
    const generation = ++this.chatGeneration;
    this.navigationGeneration++;
    const previousId = this.selectedId();
    if (previousId) {
      this.service.typing(previousId, false);
    }
    this.closeMenus();
    this.peerTyping.set(false);
    this.editingId.set(null);
    this.actionError.set('');
    this.readBoundary = null;
    this.selectedId.set(chatId);
    this.showScrollDown.set(false);
    this.active.set(null);
    this.messages.set([]);
    this.nextBefore.set(null);
    this.latestFetchedMessageId = null;
    this.chatError.set('');
    this.retryChatAutomatically = false;
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
        const unavailable =
          error instanceof ChatError && (error.code === 'missing' || error.code === 'validation');
        this.retryChatAutomatically = !unavailable;
        this.chatError.set(
          unavailable
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
  peerChatHidden(chatId: string): void {
    if (this.selectedId() !== chatId) {
      return;
    }

    this.peerProfileOpen.set(false);
    this.chats.update((list) => list.filter((chat) => chat.id !== chatId));
    this.back();
    this.queueLiveSync();
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

      this.queueLiveSync();
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
    if (chatId && Date.now() - this.lastTypingSent > 1000) {
      this.lastTypingSent = Date.now();
      this.service.typing(chatId, !!text.trim());
    }

    if (viewer && chatId) {
      this.drafts.set(viewer.id, chatId, text);
    }
  }
  updateAlias(targetUserId: string, alias: UserNickname | null): void {
    this.aliases.update((current) => {
      const updated = new Map(current);
      if (alias) {
        updated.set(targetUserId, { nickname: alias.nickname, color: alias.color });
      } else {
        updated.delete(targetUserId);
      }
      return updated;
    });
  }

  authorFor(message: MessageView): PersonView | undefined {
    return (
      message.sender ??
      (message.senderId === this.viewer()?.id
        ? (this.viewer() ?? undefined)
        : this.active()?.person)
    );
  }

  beginReply(message: MessageView): void {
    this.editingId.set(null);
    this.replyTarget.set(message);
    const chatId = this.selectedId();
    if (chatId) {
      this.afterRender(chatId, () => this.composerInput?.nativeElement.focus());
    }
  }

  replyText(message: MessageView): string {
    const file = message.attachment;
    if (!file) {
      return [...message.text.trim()].slice(0, 160).join('');
    }
    if (file.voice) {
      return 'Голосове повідомлення';
    }
    if (file.mediaType.startsWith('image/')) {
      return 'Фото';
    }
    if (file.mediaType.startsWith('video/')) {
      return 'Відео';
    }
    return file.name;
  }

  async jumpToReply(id: string): Promise<void> {
    const chatId = this.selectedId();
    if (!chatId) {
      return;
    }

    const navigation = ++this.replyNavigation;
    while (navigation === this.replyNavigation && !this.messages().some((item) => item.id === id)) {
      const cursor = this.nextBefore();
      if (!cursor) {
        break;
      }
      await this.loadOlder();
      if (this.nextBefore() === cursor) {
        break;
      }
    }

    if (navigation !== this.replyNavigation) {
      return;
    }
    if (!this.messages().some((item) => item.id === id)) {
      this.actionError.set('Оригінал повідомлення недоступний.');
      return;
    }

    this.afterRender(chatId, () => {
      if (navigation !== this.replyNavigation) {
        return;
      }
      const row = this.viewport?.nativeElement.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(id)}"]`,
      );
      row?.scrollIntoView?.({ block: 'center' });
      clearTimeout(this.replyHighlightTimer);
      this.highlightedReplyId.set(id);
      this.replyHighlightTimer = setTimeout(() => this.highlightedReplyId.set(null), 1500);
    });
  }

  composerKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.isComposing && this.replyTarget()) {
      event.preventDefault();
      this.replyTarget.set(null);
      return;
    }
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
    const reply = this.replyTarget();
    this.service.typing(chatId, false);
    const key = `${viewer.id}:${chatId}`;
    this.drafts.begin(chatId);
    this.drafts.errors.update((errors) => new Map([...errors].filter(([id]) => id !== key)));

    try {
      const message = await (reply
        ? this.service.send(chatId, text, reply.id)
        : this.service.send(chatId, text));

      if (this.drafts.get(viewer.id, chatId) === text) {
        this.drafts.set(viewer.id, chatId, '');
      }

      if (!this.destroyed && this.selectedId() === chatId) {
        if (this.replyTarget() === reply) {
          this.replyTarget.set(null);
        }
        this.messages.update((current) => mergeMessages(current, [messageView(message)]));
        this.draft.set(this.drafts.get(viewer.id, chatId));
        this.afterRender(chatId, () => this.resizeComposer());
        this.afterRender(chatId, () => this.scrollToBottom());
      }

      if (!this.destroyed) {
        this.queueLiveSync();
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
  private async syncVisibleChats(): Promise<boolean> {
    const generation = ++this.listGeneration;
    const pendingPage = this.listLoading() && this.listRetryMore ? 1 : 0;
    const pagesToLoad = Math.max(1, this.listPage + pendingPage);
    const incoming: ConversationView[] = [];
    let page = 0;
    let hasMore = true;
    this.listError.set('');
    this.listLoading.set(this.chats().length === 0);

    try {
      while (page < pagesToLoad && hasMore) {
        const result = await this.service.list(++page);
        if (this.destroyed || generation !== this.listGeneration) {
          return false;
        }
        incoming.push(...result.chats.map(conversationView));
        hasMore = result.hasMore;
      }

      this.chats.set([...new Map(incoming.map((chat) => [chat.id, chat])).values()]);
      this.hasMoreChats.set(hasMore);
      this.listPage = page;
      return true;
    } catch (error: unknown) {
      if (!this.destroyed && generation === this.listGeneration) {
        this.listError.set('Не вдалося оновити чати. Повторюємо автоматично…');
      }
      throw error;
    } finally {
      if (!this.destroyed && generation === this.listGeneration) {
        this.listLoading.set(false);
      }
    }
  }

  private queueLiveSync() {
    this.livePending = true;
    if (this.liveBusy || this.destroyed) {
      return;
    }
    clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(() => {
      void this.syncLive();
    }, 100);
  }

  private async syncLive() {
    if (this.destroyed || this.liveBusy) {
      return;
    }
    if (this.historyLoading() || this.chatLoading()) {
      this.queueLiveSync();
      return;
    }
    this.livePending = false;
    this.liveBusy = true;
    const chatId = this.selectedId();
    const generation = this.chatGeneration;
    try {
      const loaded = await this.syncVisibleChats();
      if (!loaded) {
        this.livePending = !this.destroyed;
        return;
      }
      if (chatId && this.retryChatAutomatically) {
        await this.selectChat(chatId);
        if (this.retryChatAutomatically) {
          throw new ChatError('unavailable');
        }
        this.syncFailures = 0;
        if (this.liveConnected) {
          this.connection.set('ready');
        }
        return;
      }
      if (chatId && this.active()) {
        const existingIds = new Set(this.messages().map((message) => message.id));
        const history = await this.service.syncHistory(
          chatId,
          this.messages()[0]?.createdAt ?? null,
        );
        if (!this.current(generation, chatId)) {
          return;
        }
        const atBottom = !this.showScrollDown();
        const anchor = this.captureAnchor();
        const savedDuringSync = this.messages().filter((message) => !existingIds.has(message.id));
        const known = new Map(this.messages().map((message) => [message.id, message]));
        const incoming = history.messages.map((message) =>
          withLatestReaction(messageView(message), known.get(message.id)),
        );
        this.messages.set(mergeMessages(incoming, savedDuringSync));
        this.nextBefore.set(history.nextBefore);
        this.latestFetchedMessageId = history.messages.at(-1)?.id ?? null;
        this.afterRender(chatId, () => {
          if (atBottom) {
            this.scrollToBottom();
          } else {
            this.restoreAnchor(anchor);
          }
          this.markVisibleRead();
        });
      }
      this.syncFailures = 0;
      if (this.liveConnected) {
        this.connection.set('ready');
      }
    } catch {
      this.connection.set('offline');
      if (this.liveConnected && !this.destroyed) {
        clearTimeout(this.liveTimer);
        const delay = Math.min(30000, 2000 * 2 ** Math.min(this.syncFailures++, 4));
        this.liveTimer = setTimeout(() => this.queueLiveSync(), delay);
      }
    } finally {
      this.liveBusy = false;
      if (this.livePending) {
        this.queueLiveSync();
      }
    }
  }

  private markVisibleRead() {
    const chatId = this.selectedId();
    const last = this.messages().at(-1);
    if (
      !chatId ||
      !last ||
      this.showScrollDown() ||
      document.visibilityState === 'hidden' ||
      this.readBoundary === last.id
    ) {
      return;
    }
    this.readBoundary = last.id;
    void this.service.read(chatId, last.id).catch(() => {
      if (this.readBoundary === last.id) {
        this.readBoundary = null;
      }
    });
  }

  beginEdit(message: MessageView) {
    this.editingId.set(message.id);
    this.editText.set(message.text);
    this.actionError.set('');
  }

  async saveEdit() {
    const chatId = this.selectedId();
    const messageId = this.editingId();
    if (!chatId || !messageId || this.actionBusy()) {
      return;
    }
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      await this.service.edit(chatId, messageId, this.editText());
      this.editingId.set(null);
      this.queueLiveSync();
    } catch {
      this.actionError.set('Не вдалося змінити повідомлення. Перевірте текст і спробуйте ще раз.');
    } finally {
      this.actionBusy.set(false);
    }
  }

  voiceSent(chatId: string, message: ChatMessage): void {
    if (this.selectedId() === chatId && message.reply?.id === this.replyTarget()?.id) {
      this.replyTarget.set(null);
    }
    if (this.selectedId() === chatId) {
      this.messages.update((current) => mergeMessages(current, [messageView(message)]));
      this.afterRender(chatId, () => this.scrollToBottom());
    }

    this.queueLiveSync();
  }

  async uploadFile(event: Event) {
    const input = event.target;
    const file = input instanceof HTMLInputElement ? input.files?.[0] : null;
    const chatId = this.selectedId();
    if (!file || !chatId || this.actionBusy()) {
      return;
    }
    if (file.size < 1 || file.size > 5242880) {
      this.actionError.set('Розмір файлу має бути від 1 Б до 5 МіБ.');
      return;
    }
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      const reply = this.replyTarget();
      const bytes = new Uint8Array(await file.arrayBuffer());
      await this.service.upload(chatId, {
        name: file.name,
        mediaType: file.type || 'application/octet-stream',
        bytes,
        ...(reply ? { replyToId: reply.id } : {}),
      });
      if (this.selectedId() === chatId && this.replyTarget() === reply) {
        this.replyTarget.set(null);
      }
      this.queueLiveSync();
    } catch {
      this.actionError.set('Не вдалося надіслати файл. Спробуйте ще раз.');
    } finally {
      this.actionBusy.set(false);
      if (input instanceof HTMLInputElement) {
        input.value = '';
      }
    }
  }

  mediaLoaded(): void {
    if (!this.showScrollDown()) {
      this.scrollToBottom();
    }
  }

  async downloadFile(message: MessageView) {
    const chatId = this.selectedId();
    if (!chatId) {
      return;
    }
    try {
      const file = await this.service.download(chatId, message.id);
      downloadAttachment(file);
    } catch {
      this.actionError.set('Не вдалося завантажити файл.');
    }
  }

  async deleteMessage(message: MessageView) {
    const chatId = this.selectedId();
    if (!chatId || this.actionBusy()) {
      return;
    }
    this.actionBusy.set(true);
    this.actionError.set('');
    try {
      await this.service.remove(chatId, message.id);
      if (this.selectedId() === chatId) {
        this.messages.update((messages) =>
          messages
            .filter((item) => item.id !== message.id)
            .map((item) =>
              item.reply?.id === message.id
                ? { ...item, reply: { id: message.id, author: null, preview: '' } }
                : item,
            ),
        );
        if (this.replyTarget()?.id === message.id) {
          this.replyTarget.set(null);
        }
      }
      this.queueLiveSync();
    } catch {
      this.actionError.set('Не вдалося видалити повідомлення. Спробуйте ще раз.');
    } finally {
      this.actionBusy.set(false);
    }
  }

  private applyReaction(messageId: string, state: ReactionState): void {
    this.messages.update((messages) =>
      messages.map((message) =>
        message.id === messageId &&
        state.reactionVersion > (message.reactionState?.reactionVersion ?? -1)
          ? { ...message, reactionState: state }
          : message,
      ),
    );
  }

  async react(message: MessageView, picked: ReactionType): Promise<void> {
    const chatId = this.selectedId();
    const current = this.messages().find(({ id }) => id === message.id);

    if (!chatId || !current) {
      return;
    }

    const previous = this.reactionIntents().has(message.id)
      ? this.reactionIntents().get(message.id)
      : current.reactionState?.myReaction;
    const requested = previous === picked ? null : picked;
    this.reactionIntents.update((intents) => new Map(intents).set(message.id, requested));

    if (this.reactionRequests.has(message.id)) {
      return;
    }

    this.reactionRequests.add(message.id);
    try {
      while (!this.destroyed) {
        const intent = this.reactionIntents().get(message.id);

        if (intent === undefined) {
          break;
        }

        let failed = false;

        try {
          const state = await this.service.setReaction(chatId, message.id, intent);
          if (this.selectedId() === chatId) {
            this.applyReaction(message.id, state);
          }
        } catch {
          failed = true;
        }

        if (this.reactionIntents().get(message.id) === intent) {
          this.reactionIntents.update((intents) => {
            const remaining = new Map(intents);
            remaining.delete(message.id);
            return remaining;
          });

          if (failed && !this.destroyed && this.selectedId() === chatId) {
            this.actionError.set('Не вдалося змінити реакцію. Спробуйте ще раз.');
            this.queueLiveSync();
          }
        }
      }
    } finally {
      this.reactionRequests.delete(message.id);
    }
  }

  async openProfile() {
    this.closeMenus();
    this.profileError.set('');
    try {
      const person = await this.service.viewer();
      this.viewer.set(personView(person));
      this.profileName.set(person.displayName);
      this.profileReaction.set(person.defaultReaction ?? 'HEART');
      this.profileAvatar.set(person.avatarUrl ?? null);
      this.avatarModified.set(false);
      this.profileOpen.set(true);
    } catch {
      this.profileError.set('Не вдалося завантажити профіль.');
    }
  }

  async avatarChanged(event: Event) {
    const input = event.target;
    const file = input instanceof HTMLInputElement ? input.files?.[0] : null;
    if (!file) {
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 262144) {
      this.profileError.set('Оберіть PNG, JPEG або WebP до 256 КіБ.');
      return;
    }
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read avatar'));
        reader.onload = () =>
          typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Invalid avatar'));
        reader.readAsDataURL(file);
      });
      this.profileAvatar.set(url);
      this.avatarModified.set(true);
      this.profileError.set('');
    } catch {
      this.profileError.set('Не вдалося прочитати файл.');
    }
  }

  async saveProfile() {
    if (this.profileSaving()) {
      return;
    }
    this.profileSaving.set(true);
    this.profileError.set('');
    try {
      await firstValueFrom(
        this.users.updateProfile({
          displayName: this.profileName(),
          ...(this.profileReaction() !== (this.viewer()?.defaultReaction ?? 'HEART')
            ? { defaultReaction: this.profileReaction() }
            : {}),
          ...(this.avatarModified() ? { avatarUrl: this.profileAvatar() } : {}),
        }),
      );
      this.viewer.set(personView(await this.service.viewer()));
      this.profileOpen.set(false);
    } catch {
      this.profileError.set(
        'Не вдалося зберегти профіль. Ім’я: 1–64 символи; аватар: PNG/JPEG/WebP до 256 КіБ.',
      );
    } finally {
      this.profileSaving.set(false);
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
    this.markVisibleRead();
    if (viewport && viewport.scrollTop < 60 && this.nextBefore() && !this.historyLoading()) {
      void this.loadOlder();
    }
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
      this.markVisibleRead();
    }
  }
}

export { Chats };
