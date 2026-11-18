import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ChatsHttpAdapter } from './chats-http.adapter';
import { ChatRepositoryError, CHATS_REPOSITORY } from '../chats.repository';
import { SessionService } from '../../../../core/http/session.service';
import { environment } from '../../../../../environments/environment';
import { appConfig } from '../../../../app.config';
import { Auth } from '../../../auth/service/auth';

const api = environment.apiUrl;
const chatId = '8f1c3b3c-5f83-4f47-8c77-f0732a9e4bda';
const owner = {
  id: '15a1a753-e61c-4c4a-9141-9ea2d69c6f81',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
};
const peer = {
  id: '114d92c3-4a55-4090-9606-7888b4c28aab',
  username: 'bob',
  displayName: 'Bob',
  avatarUrl: null,
};
const date = '2026-11-05T12:00:00.000Z';
const message = {
  id: 'ed5d5347-4ab5-44e2-bad7-f994af299f00',
  chatId,
  senderId: owner.id,
  sender: owner,
  text: ' hello\nworld ',
  createdAt: date,
  editedAt: null,
};
const details = { id: chatId, createdAt: date, recipient: peer };
const mappedMessage = {
  id: message.id,
  senderId: owner.id,
  sender: owner,
  text: message.text,
  createdAt: date,
  editedAt: null,
};
const mappedChat = { id: chatId, person: peer, lastMessage: null, activityAt: date };
const emptyPage = { items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };

async function settle() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('chat HTTP adapter', () => {
  let adapter: ChatsHttpAdapter;
  let http: HttpTestingController;
  let session: SessionService;
  const navigate = vi.fn().mockResolvedValue(true);
  beforeEach(() => {
    navigate.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    adapter = TestBed.inject(ChatsHttpAdapter);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    session.setAccessToken('chat-token');
  });
  afterEach(() => http.verify());

  it('loads the real current user and maps only repository fields', async () => {
    const result = adapter.viewer();
    const request = http.expectOne(`${api}/auth/me`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer chat-token');
    request.flush({ ...owner, email: 'alice@example.com', createdAt: date, updatedAt: date });
    expect(await result).toEqual(owner);
  });

  it('opens the server dialog using only recipientId and trusts the returned recipient', async () => {
    const result = adapter.open({ ...peer, displayName: 'Outdated name' });
    const request = http.expectOne(`${api}/chats`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ recipientId: peer.id });
    expect(request.request.headers.get('Authorization')).toBe('Bearer chat-token');
    request.flush(details);
    expect(await result).toEqual(mappedChat);
  });

  it('preserves server list ordering, latest message, activity and pagination', async () => {
    const result = adapter.list(2, 20);
    const request = http.expectOne((request) => request.url === `${api}/chats`);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('20');
    const secondId = 'c8b16c4f-0e89-4e4c-b9ec-0fa190fc2b78';
    request.flush({
      items: [
        {
          id: secondId,
          recipient: peer,
          lastMessage: message,
          lastActivityAt: '2026-11-05T13:00:00.000Z',
        },
        { id: chatId, recipient: peer, lastMessage: null, lastActivityAt: date },
      ],
      meta: { page: 2, limit: 20, total: 45, totalPages: 3 },
    });
    const page = await result;
    expect(page.chats.map((chat) => chat.id)).toEqual([secondId, chatId]);
    expect(page.chats[0].lastMessage).toEqual(mappedMessage);
    expect(page.chats[0].activityAt).toBe('2026-11-05T13:00:00.000Z');
    expect(page.hasMore).toBe(true);
    const empty = adapter.list(4, 20);
    http
      .expectOne((request) => request.url === `${api}/chats`)
      .flush({ items: [], meta: { page: 4, limit: 20, total: 45, totalPages: 3 } });
    expect(await empty).toEqual({ chats: [], hasMore: false });
  });

  it('loads details using the chatId in the URL', async () => {
    const result = adapter.get(chatId);
    http.expectOne(`${api}/chats/${chatId}`).flush(details);
    expect(await result).toEqual(mappedChat);
  });

  it('reverses newest-first history and passes opaque cursors unchanged', async () => {
    const result = adapter.history(chatId, null, 30);
    const request = http.expectOne((request) => request.url === `${api}/chats/${chatId}/messages`);
    expect(request.request.params.has('cursor')).toBe(false);
    expect(request.request.params.get('limit')).toBe('30');
    const earlier = {
      ...message,
      id: '8e8cbd27-adf6-4d41-a196-4b097e4b1b76',
      createdAt: '2026-11-05T11:00:00.000Z',
    };
    const cursor = 'eyJvcGFxdWUiOiJjdXJzb3IifQ';
    request.flush({ items: [message, earlier], nextCursor: cursor });
    const history = await result;
    expect(history.messages.map((item) => item.id)).toEqual([earlier.id, message.id]);
    expect(history.nextBefore).toBe(cursor);
    const next = adapter.history(chatId, history.nextBefore, 30);
    const nextRequest = http.expectOne(
      (request) => request.url === `${api}/chats/${chatId}/messages`,
    );
    expect(nextRequest.request.params.get('cursor')).toBe(cursor);
    nextRequest.flush({ items: [], nextCursor: null });
    expect(await next).toEqual({ messages: [], nextBefore: null });
  });

  it('shows the saved server message and preserves whitespace in send requests', async () => {
    const result = adapter.send(chatId, message.text);
    const request = http.expectOne(`${api}/chats/${chatId}/messages`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ text: message.text });
    request.flush(message);
    expect(await result).toEqual(mappedMessage);
  });

  it.each([
    [400, 'validation'],
    [403, 'missing'],
    [404, 'missing'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ])('maps HTTP %s into a repository error without clearing the session', async (status, code) => {
    const result = adapter.get(chatId);
    const assertion = expect(result).rejects.toEqual(
      new ChatRepositoryError(String(code) as 'validation' | 'missing' | 'unavailable'),
    );
    http
      .expectOne(`${api}/chats/${chatId}`)
      .flush(null, { status: Number(status), statusText: 'Error' });
    await assertion;
    expect(session.getAccessToken()).toBe('chat-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps transport failures out of service contracts', async () => {
    const result = adapter.send(chatId, 'retry me');
    const assertion = expect(result).rejects.toEqual(new ChatRepositoryError('unavailable'));
    http.expectOne(`${api}/chats/${chatId}/messages`).error(new ProgressEvent('error'));
    await assertion;
    expect(session.getAccessToken()).toBe('chat-token');
  });

  it('uses the existing shared refresh flow for chat requests', async () => {
    const result = adapter.list(1, 20);
    http
      .expectOne((request) => request.url === `${api}/chats`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    const refresh = http.expectOne(`${api}/auth/refresh`);
    expect(refresh.request.withCredentials).toBe(true);
    refresh.flush({
      user: owner,
      accessToken: 'refreshed-chat-token',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
    await settle();
    const retry = http.expectOne((request) => request.url === `${api}/chats`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer refreshed-chat-token');
    retry.flush(emptyPage);
    expect(await result).toEqual({ chats: [], hasMore: false });
  });
});

describe('application chat data source', () => {
  it('binds the application to real HTTP instead of browser mock storage', async () => {
    TestBed.configureTestingModule({
      providers: [
        appConfig.providers,
        provideZonelessChangeDetection(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { restoreSession: () => Promise.resolve(true) } },
      ],
    });
    const repository = TestBed.inject(CHATS_REPOSITORY);
    expect(repository).toBeInstanceOf(ChatsHttpAdapter);
    const result = repository.list(1, 20);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((request) => request.url === `${api}/chats`).flush(emptyPage);
    expect(await result).toEqual({ chats: [], hasMore: false });
    http.verify();
  });
});
