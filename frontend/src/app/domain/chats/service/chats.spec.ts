import { TestBed } from '@angular/core/testing';
import { ChatService, ChatError } from './chats';
import { CHATS_REPOSITORY, ChatRepositoryError } from '../repository/chats.repository';

describe('chat use cases', () => {
  it('rejects empty and overlong messages before accessing a repository', async () => {
    const send = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: CHATS_REPOSITORY, useValue: { send } }],
    });
    const service = TestBed.inject(ChatService);
    for (const text of ['', ' \n ', 'x'.repeat(4001)]) {
      await expect(service.send('chat', text)).rejects.toEqual(new ChatError('validation'));
    }
    expect(send).not.toHaveBeenCalled();
  });
  it('preserves message whitespace and converts repository errors to service errors', async () => {
    const message = {
      id: 'm1',
      senderId: 'me',
      text: ' hello\nworld ',
      createdAt: '2026-11-03T00:00:00Z',
    };
    const send = vi.fn().mockResolvedValue(message);
    TestBed.configureTestingModule({
      providers: [{ provide: CHATS_REPOSITORY, useValue: { send } }],
    });
    const service = TestBed.inject(ChatService);
    expect(await service.send('chat', message.text)).toEqual(message);
    expect(send).toHaveBeenCalledWith('chat', message.text);
    send.mockRejectedValueOnce(new ChatRepositoryError('missing'));
    await expect(service.send('chat', 'hello')).rejects.toEqual(new ChatError('missing'));
  });
  it('fetches intermediate pages when more than one page arrived since the last refresh', async () => {
    const entry = (id: string) => ({
      id,
      senderId: 'peer',
      text: id,
      createdAt: '2026-11-04T00:00:00Z',
    });
    const history = vi
      .fn()
      .mockResolvedValueOnce({ messages: [entry('newest')], nextBefore: 'newest' })
      .mockResolvedValueOnce({ messages: [entry('middle')], nextBefore: 'middle' })
      .mockResolvedValueOnce({ messages: [entry('known')], nextBefore: 'known' });
    TestBed.configureTestingModule({
      providers: [{ provide: CHATS_REPOSITORY, useValue: { history } }],
    });
    const result = await TestBed.inject(ChatService).refreshHistory('a', 'known');
    expect(result.messages.map((message) => message.id)).toEqual(['known', 'middle', 'newest']);
    expect(history.mock.calls).toEqual([
      ['a', null, 30],
      ['a', 'newest', 30],
      ['a', 'middle', 30],
    ]);
    expect(result.nextBefore).toBe('known');
  });
  it('does not load all history for an empty dialog and rejects a repeating cursor', async () => {
    const history = vi.fn().mockResolvedValue({ messages: [], nextBefore: 'same' });
    TestBed.configureTestingModule({
      providers: [{ provide: CHATS_REPOSITORY, useValue: { history } }],
    });
    const service = TestBed.inject(ChatService);
    await service.refreshHistory('a', null);
    expect(history).toHaveBeenCalledTimes(1);
    await expect(service.refreshHistory('a', 'missing')).rejects.toEqual(
      new ChatError('unavailable'),
    );
  });
});
