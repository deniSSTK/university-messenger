import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { Chats } from './chats';
import { ChatService, ChatError } from '../../service/chats';
import type {
  Conversation,
  ChatMessage,
  HistoryPage,
  ChatPage,
  ChatPerson,
} from '../../service/chats.types';
import { Users } from '../../../users/service/users';
import type { SearchUsersInput, SearchUsersResult } from '../../../users/service/users';
import { Auth } from '../../../auth/service/auth';

const viewer = { id: 'me', username: 'me', displayName: 'Me' };
const peer = { id: 'peer', username: 'alex', displayName: 'Alex' };
function chat(id = 'a'): Conversation {
  return { id, person: { ...peer }, lastMessage: null, activityAt: '2026-11-03T00:00:00Z' };
}
function message(id = 'm1', text = 'hello', createdAt = '2026-11-03T00:00:00Z'): ChatMessage {
  return { id, text, senderId: viewer.id, createdAt };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function settle() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('chat screen', () => {
  let fixture: ComponentFixture<Chats>;
  let component: Chats;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  const api = {
    viewer: vi.fn<() => Promise<ChatPerson>>(),
    list: vi.fn<(page: number) => Promise<ChatPage>>(),
    get: vi.fn<(id: string) => Promise<Conversation>>(),
    history: vi.fn<(id: string, before?: string | null) => Promise<HistoryPage>>(),
    refreshHistory: vi.fn<(id: string, latestKnownId: string | null) => Promise<HistoryPage>>(),
    open: vi.fn<(person: ChatPerson) => Promise<Conversation>>(),
    send: vi.fn<(id: string, text: string) => Promise<ChatMessage>>(),
  };
  const search = vi.fn<(input: SearchUsersInput) => Observable<SearchUsersResult>>();
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(async () => {
    for (const method of Object.values(api)) {
      method.mockReset();
    }
    search.mockReset().mockReturnValue(of({ users: [], page: 1, totalPages: 0 }));
    navigate.mockClear();
    api.viewer.mockResolvedValue(viewer);
    api.list.mockResolvedValue({ chats: [], hasMore: false });
    api.get.mockImplementation(async (id) => chat(id));
    api.history.mockResolvedValue({ messages: [], nextBefore: null });
    api.refreshHistory.mockImplementation(async (id) => api.history(id));
    api.open.mockResolvedValue(chat());
    api.send.mockResolvedValue(message());
    params = new BehaviorSubject(convertToParamMap({}));
    await TestBed.configureTestingModule({
      imports: [Chats],
      providers: [
        { provide: ChatService, useValue: api },
        { provide: Users, useValue: { search } },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: Router, useValue: { navigate } },
        { provide: Auth, useValue: { logout: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Chats);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  });
  afterEach(() => fixture.destroy());
  async function select(id = 'a') {
    params.next(convertToParamMap({ chatId: id }));
    await settle();
    fixture.detectChanges();
    await settle();
  }

  it('debounces search, cancels old results and restores chats for whitespace', async () => {
    const old = new Subject<SearchUsersResult>();
    const next = new Subject<SearchUsersResult>();
    search.mockReturnValueOnce(old).mockReturnValueOnce(next);
    component.searchChanged('al');
    expect(search).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    component.searchChanged('alex');
    expect(old.observed).toBe(false);
    old.next({ users: [{ ...peer, displayName: 'Stale' }], page: 1, totalPages: 1 });
    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    next.next({ users: [peer], page: 1, totalPages: 2 });
    expect(component.searchResults()[0].displayName).toBe('Alex');
    component.searchChanged('   ');
    expect(component.searching()).toBe(false);
    expect(component.searchResults()).toEqual([]);
    expect(search).toHaveBeenCalledTimes(2);
  });
  it('supports search pages, resets on a new query and allows retry after an error', async () => {
    component.searchChanged('alex');
    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    component.searchAt(2);
    await vi.waitFor(() => expect(search).toHaveBeenCalledWith({ search: 'alex', page: 2 }));
    search.mockReturnValueOnce(throwError(() => new Error('offline')));
    component.searchChanged('bob');
    expect(component.searchPage()).toBe(1);
    await vi.waitFor(() => expect(component.searchError()).not.toBe(''));
    search.mockReturnValueOnce(of({ users: [peer], page: 1, totalPages: 1 }));
    component.retrySearch();
    await vi.waitFor(() => expect(component.searchResults()).toHaveLength(1));
    expect(component.searchError()).toBe('');
  });
  it('opens a user once while pending and navigates using the returned chat id', async () => {
    const pending = deferred<Conversation>();
    api.open.mockReturnValueOnce(pending.promise);
    const first = component.openUser(peer);
    await component.openUser(peer);
    expect(api.open).toHaveBeenCalledTimes(1);
    pending.resolve(chat('saved-chat'));
    await first;
    expect(navigate).toHaveBeenCalledWith(['/chats', 'saved-chat']);
  });
  it('loads a chat from its route and ignores the previous chat history arriving late', async () => {
    const old = deferred<HistoryPage>();
    api.history
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ messages: [message('b-message')], nextBefore: null });
    params.next(convertToParamMap({ chatId: 'a' }));
    await select('b');
    old.resolve({ messages: [message('a-message')], nextBefore: 'old' });
    await settle();
    expect(component.active()?.id).toBe('b');
    expect(component.messages().map((item) => item.id)).toEqual(['b-message']);
    expect(component.nextBefore()).toBeNull();
  });
  it('prepends history without duplicates and preserves the scroll position', async () => {
    const recent = message('recent');
    const older = message('older', 'older', '2026-11-02T00:00:00Z');
    api.history.mockResolvedValueOnce({ messages: [recent], nextBefore: 'recent' });
    await select();
    const element: HTMLElement = fixture.nativeElement;
    const viewport = element.querySelector<HTMLElement>('.messages')!;
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get: () => component.messages().length * 100,
    });
    viewport.scrollTop = 10;
    api.history.mockResolvedValueOnce({ messages: [older, recent], nextBefore: null });
    await component.loadOlder();
    fixture.detectChanges();
    await settle();
    expect(component.messages().map((item) => item.id)).toEqual(['older', 'recent']);
    expect(viewport.scrollTop).toBe(110);
  });
  it('retains text after send failure, blocks duplicates and clears only after success', async () => {
    await select();
    component.draftChanged('hello');
    const pending = deferred<ChatMessage>();
    api.send.mockReturnValueOnce(pending.promise);
    const sending = component.send();
    await component.send();
    expect(api.send).toHaveBeenCalledTimes(1);
    pending.reject(new Error('offline'));
    await sending;
    expect(component.draft()).toBe('hello');
    expect(component.sendError()).not.toBe('');
    await component.send();
    expect(component.draft()).toBe('');
    expect(component.messages()).toHaveLength(1);
    expect(component.sendError()).toBe('');
  });
  it('keeps drafts and delayed send results attached to their original chat', async () => {
    await select('a');
    component.draftChanged('draft A');
    await select('b');
    component.draftChanged('draft B');
    await select('a');
    expect(component.draft()).toBe('draft A');
    const pending = deferred<ChatMessage>();
    api.send.mockReturnValueOnce(pending.promise);
    const sending = component.send();
    await select('b');
    pending.resolve(message('from-a', 'draft A'));
    await sending;
    expect(component.draft()).toBe('draft B');
    expect(component.messages()).toEqual([]);
    await select('a');
    expect(component.draft()).toBe('');
  });
  it('does not submit whitespace or overlong text and handles Enter, Shift+Enter and composition', async () => {
    await select();
    for (const text of ['   ', 'x'.repeat(4001)]) {
      component.draftChanged(text);
      await component.send();
    }
    expect(api.send).not.toHaveBeenCalled();
    component.draftChanged('hello');
    component.composerKey(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    component.composerKey(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    expect(api.send).not.toHaveBeenCalled();
    component.composerKey(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(api.send).toHaveBeenCalledTimes(1);
  });

  it('uses Unicode code points for the composer limit and counter', async () => {
    await select();
    const element: HTMLElement = fixture.nativeElement;
    const text = '😀'.repeat(4000);

    component.draftChanged(text + 'a');
    fixture.detectChanges();
    expect(element.querySelector('.character-count')?.textContent).toContain('4001 / 4000');
    expect(element.querySelector('textarea')?.getAttribute('aria-invalid')).toBe('true');
    await component.send();
    expect(api.send).not.toHaveBeenCalled();

    component.draftChanged(text);
    fixture.detectChanges();
    expect(element.querySelector('.character-count')?.textContent).toContain('4000 / 4000');
    expect(element.querySelector('textarea')?.getAttribute('aria-invalid')).toBe('false');
    await component.send();
    expect(api.send).toHaveBeenCalledWith('a', text);
  });

  it('renders text safely and distinguishes own messages', async () => {
    api.history.mockResolvedValueOnce({
      messages: [message('unsafe', '<img src=x onerror=alert(1)>\nnext line')],
      nextBefore: null,
    });
    await select();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.message p')?.textContent).toContain('<img');
    expect(element.querySelector('.message img')).toBeNull();
    expect(element.querySelector('.message-row.own')).not.toBeNull();
  });
  it('shows unavailable chats with a back action and retries them', async () => {
    api.get.mockRejectedValueOnce(new ChatError('missing'));
    await select('foreign');
    expect(component.chatError()).toContain('недоступний');
    expect(component.active()).toBeNull();
    component.back();
    expect(navigate).toHaveBeenCalledWith(['/chats']);
    component.retryChat();
    await settle();
    expect(component.active()?.id).toBe('foreign');
  });
  it('loads chat pages without duplicate entries and exposes list failures separately', async () => {
    api.list.mockResolvedValueOnce({ chats: [chat('a')], hasMore: true });
    await component.loadChats();
    api.list.mockResolvedValueOnce({ chats: [chat('a'), chat('b')], hasMore: false });
    await component.loadChats(true);
    expect(component.chats().map((item) => item.id)).toEqual(['a', 'b']);
    api.list.mockRejectedValueOnce(new Error('offline'));
    await component.loadChats();
    expect(component.listError()).not.toBe('');
    expect(component.chats()).toHaveLength(2);
  });
  it('refreshes messages without scrolling a reader away from older history', async () => {
    api.history.mockResolvedValueOnce({ messages: [message()], nextBefore: null });
    await select();
    const element: HTMLElement = fixture.nativeElement;
    const viewport = element.querySelector<HTMLElement>('.messages')!;
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 200 });
    viewport.scrollTop = 100;
    api.history.mockResolvedValueOnce({ messages: [message(), message('new')], nextBefore: null });
    await component.refreshMessages();
    fixture.detectChanges();
    await settle();
    expect(component.messages()).toHaveLength(2);
    expect(viewport.scrollTop).toBe(100);
  });
  it('keeps an existing history when refresh fails and permits retry', async () => {
    api.history.mockResolvedValueOnce({ messages: [message()], nextBefore: null });
    await select();
    api.history.mockRejectedValueOnce(new Error('offline'));
    await component.refreshMessages();
    expect(component.messages()).toHaveLength(1);
    expect(component.historyError()).not.toBe('');
    api.history.mockResolvedValueOnce({ messages: [message(), message('new')], nextBefore: null });
    await component.refreshMessages();
    expect(component.historyError()).toBe('');
    expect(component.messages()).toHaveLength(2);
  });
  it('preserves a scroll position changed while older history is loading', async () => {
    api.history.mockResolvedValueOnce({ messages: [message()], nextBefore: 'm1' });
    await select();
    const viewport = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.messages',
    )!;
    Object.defineProperty(viewport, 'scrollHeight', {
      configurable: true,
      get: () => component.messages().length * 100,
    });
    viewport.scrollTop = 10;
    const pending = deferred<HistoryPage>();
    api.history.mockReturnValueOnce(pending.promise);
    const loading = component.loadOlder();
    viewport.scrollTop = 40;
    pending.resolve({
      messages: [message('older', 'earlier', '2026-11-02T00:00:00Z')],
      nextBefore: null,
    });
    await loading;
    fixture.detectChanges();
    await settle();
    expect(viewport.scrollTop).toBe(140);
  });
  it('retries an older-history failure using its original cursor', async () => {
    api.history.mockResolvedValueOnce({ messages: [message()], nextBefore: 'm1' });
    await select();
    api.history.mockRejectedValueOnce(new Error('offline'));
    await component.loadOlder();
    expect(component.historyError()).not.toBe('');
    api.history.mockResolvedValueOnce({
      messages: [message('older', 'earlier', '2026-11-02T00:00:00Z')],
      nextBefore: null,
    });
    component.retryHistory();
    await settle();
    expect(api.history).toHaveBeenLastCalledWith('a', 'm1');
    expect(api.refreshHistory).not.toHaveBeenCalled();
    expect(component.messages()).toHaveLength(2);
  });
  it('keeps the oldest loaded cursor when refreshing overlapping history', async () => {
    api.history.mockResolvedValueOnce({ messages: [message()], nextBefore: 'oldest-loaded' });
    await select();
    api.refreshHistory.mockResolvedValueOnce({
      messages: [message(), message('new')],
      nextBefore: 'recent-page',
    });
    await component.refreshMessages();
    expect(api.refreshHistory).toHaveBeenCalledWith('a', 'm1');
    expect(component.nextBefore()).toBe('oldest-loaded');
    expect(component.messages()).toHaveLength(2);
  });

  it('refreshes back to the latest fetched message even after sending', async () => {
    const known = message('00');
    const incoming = Array.from({ length: 40 }, (_, index) => ({
      ...message(String(index + 1).padStart(2, '0')),
      senderId: peer.id,
    }));
    const sent = message('41', 'my reply');
    api.history.mockResolvedValueOnce({ messages: [known], nextBefore: 'oldest-loaded' });
    await select();

    component.draftChanged(sent.text);
    api.send.mockResolvedValueOnce(sent);
    await component.send();

    api.refreshHistory.mockResolvedValueOnce({
      messages: [known, ...incoming, sent],
      nextBefore: 'intermediate-page',
    });
    await component.refreshMessages();

    expect(api.refreshHistory).toHaveBeenLastCalledWith('a', known.id);
    expect(component.messages()).toEqual([known, ...incoming, sent]);
    expect(component.nextBefore()).toBe('oldest-loaded');

    api.refreshHistory.mockResolvedValueOnce({ messages: [sent], nextBefore: 'latest-page' });
    await component.refreshMessages();
    expect(api.refreshHistory).toHaveBeenLastCalledWith('a', sent.id);
  });

  it('keeps a saved send when a concurrent refresh started from an empty dialog', async () => {
    await select();
    const refresh = deferred<HistoryPage>();
    api.refreshHistory.mockReturnValueOnce(refresh.promise);
    const refreshing = component.refreshMessages();

    const sent = message('first', 'my first message');
    component.draftChanged(sent.text);
    api.send.mockResolvedValueOnce(sent);
    await component.send();

    refresh.resolve({ messages: [], nextBefore: null });
    await refreshing;
    expect(component.messages()).toEqual([sent]);
    expect(component.draft()).toBe('');

    api.refreshHistory.mockResolvedValueOnce({ messages: [sent], nextBefore: 'older-page' });
    await component.refreshMessages();
    expect(api.refreshHistory).toHaveBeenLastCalledWith('a', null);
    expect(component.messages()).toEqual([sent]);
    expect(component.nextBefore()).toBe('older-page');
  });

  it('groups consecutive messages by sender and shows dates at day boundaries', async () => {
    api.history.mockResolvedValueOnce({
      messages: [
        message('one'),
        message('two'),
        message('three', 'next day', '2026-11-04T00:00:00Z'),
      ],
      nextBefore: null,
    });
    await select();
    expect(component.messageRows()[0].dateLabel).not.toBeNull();
    expect(component.messageRows()[1].dateLabel).toBeNull();
    expect(component.messageRows()[1].grouped).toBe(true);
    expect(component.messageRows()[2].dateLabel).not.toBeNull();
  });
  it('exposes logout through a closable account menu', async () => {
    await component.toggleAccountMenu();
    fixture.detectChanges();
    expect(component.accountMenuOpen()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.logout-btn')).not.toBeNull();
    component.closeMenus();
    expect(component.accountMenuOpen()).toBe(false);
  });
  it('shows an obsolete mock URL as an unavailable chat', async () => {
    api.get.mockRejectedValueOnce(new ChatError('validation'));
    await select('demo-old-chat');
    expect(component.chatError()).toContain('недоступний');
    expect(component.active()).toBeNull();
  });
});
