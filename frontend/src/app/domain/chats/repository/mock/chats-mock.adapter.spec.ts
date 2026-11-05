import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ChatsMockAdapter, MOCK_STORAGE_KEY } from './chats-mock.adapter';
import { ChatRepositoryError } from '../chats.repository';
import type { ChatPersonRecord } from '../chats.repository';
import { SessionService } from '../../../../core/http/session.service';
import { environment } from '../../../../../environments/environment';

const alice = { id: 'alice-id', username: 'alice', displayName: 'Alice' };
const bob = { id: 'bob-id', username: 'bob', displayName: 'Bob' };
const mallory = { id: 'mallory-id', username: 'mallory', displayName: 'Mallory' };

describe('temporary chat repository', () => {
  let adapter: ChatsMockAdapter;
  let http: HttpTestingController;
  async function acting<T>(viewer: ChatPersonRecord, operation: () => Promise<T>): Promise<T> {
    const promise = operation();
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(viewer);
    return promise;
  }
  beforeEach(() => {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    adapter = TestBed.inject(ChatsMockAdapter);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionService).setAccessToken('not-stored-in-demo-data');
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem(MOCK_STORAGE_KEY);
  });

  it('starts empty and reuses one dialog for the same pair from both accounts', async () => {
    expect((await acting(alice, () => adapter.list(1, 20))).chats).toEqual([]);
    const first = await acting(alice, () => adapter.open(bob));
    const second = await acting(alice, () => adapter.open(bob));
    const reversed = await acting(bob, () => adapter.open(alice));
    expect(first.id).toBe(second.id);
    expect(first.id).toBe(reversed.id);
    expect(reversed.person).toEqual(alice);
    expect((await acting(alice, () => adapter.list(1, 20))).chats).toHaveLength(1);
    expect(localStorage.getItem(MOCK_STORAGE_KEY)).not.toContain('not-stored-in-demo-data');
  });
  it('persists messages across adapter instances, exposes them to the other participant, and denies outsiders', async () => {
    const chat = await acting(alice, () => adapter.open(bob));
    await acting(alice, () => adapter.send(chat.id, 'Hello\n<img src=x onerror=alert(1)>'));
    const replacement = TestBed.runInInjectionContext(() => new ChatsMockAdapter());
    const history = await acting(bob, () => replacement.history(chat.id, null, 30));
    expect(history.messages[0].senderId).toBe(alice.id);
    expect(history.messages[0].text).toContain('<img');
    expect((await acting(mallory, () => adapter.list(1, 20))).chats).toEqual([]);
    await expect(acting(mallory, () => adapter.get(chat.id))).rejects.toEqual(
      new ChatRepositoryError('missing'),
    );
    await expect(acting(mallory, () => adapter.send(chat.id, 'forbidden'))).rejects.toEqual(
      new ChatRepositoryError('missing'),
    );
    await expect(acting(mallory, () => adapter.history(chat.id, null, 30))).rejects.toEqual(
      new ChatRepositoryError('missing'),
    );
  });
  it('paginates equal-timestamp history without duplicates and orders chats by last activity', async () => {
    const chat = await acting(alice, () => adapter.open(bob));
    for (let index = 0; index < 35; index++) {
      await acting(alice, () => adapter.send(chat.id, 'message ' + index));
    }
    const latest = await acting(alice, () => adapter.history(chat.id, null, 30));
    const earlier = await acting(alice, () => adapter.history(chat.id, latest.nextBefore, 30));
    expect(latest.messages).toHaveLength(30);
    expect(earlier.messages).toHaveLength(5);
    expect(
      new Set([...earlier.messages, ...latest.messages].map((message) => message.id)).size,
    ).toBe(35);
    expect(earlier.nextBefore).toBeNull();
    const other = await acting(alice, () => adapter.open(mallory));
    await acting(alice, () => adapter.send(other.id, 'Newest'));
    expect((await acting(alice, () => adapter.list(1, 1))).chats[0].id).toBe(other.id);
    expect((await acting(alice, () => adapter.list(1, 1))).hasMore).toBe(true);
    expect((await acting(alice, () => adapter.list(2, 1))).hasMore).toBe(false);
  });
  it('rejects invalid messages and corrupted demo storage', async () => {
    const chat = await acting(alice, () => adapter.open(bob));
    for (const text of [' ', 'x'.repeat(4001)]) {
      await expect(acting(alice, () => adapter.send(chat.id, text))).rejects.toEqual(
        new ChatRepositoryError('validation'),
      );
    }
    localStorage.setItem(MOCK_STORAGE_KEY, '{}');
    await expect(acting(alice, () => adapter.list(1, 20))).rejects.toEqual(
      new ChatRepositoryError('unavailable'),
    );
  });
});
