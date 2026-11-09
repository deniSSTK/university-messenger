import { WebSocketEventType } from '@university-messenger/events';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivityHttpAdapter } from './activity-http.adapter';
import { SessionService } from '../../../../core/http/session.service';
import { environment } from '../../../../../environments/environment';
import { ChatRepositoryError } from '../chats.repository';

class FakeSocket {
  static readonly OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 1;
  sent: string[] = [];
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  constructor(readonly url: URL) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

describe('chat activity transport', () => {
  let adapter: ActivityHttpAdapter;
  let http: HttpTestingController;
  const session = {
    getAccessToken: vi.fn(),
    getPendingRefresh: () => null,
    refresh: vi.fn(),
  };

  beforeEach(() => {
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    session.getAccessToken.mockReturnValue('initial-token');
    session.refresh.mockImplementation(async () => {
      session.getAccessToken.mockReturnValue('renewed-token');
      return 'renewed-token';
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: session },
      ],
    });
    adapter = TestBed.inject(ActivityHttpAdapter);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('authenticates in the first frame, refreshes an expired token and stops reconnecting on destruction', async () => {
    vi.useFakeTimers();
    const events = vi.fn();
    const stop = adapter.watch(events);
    const socket = FakeSocket.instances[0];
    expect(socket.url.search).toBe('');
    socket.onopen?.();
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: WebSocketEventType.Auth,
      token: 'initial-token',
    });
    socket.onmessage?.({ data: '{"type":"ready"}' });
    expect(events).toHaveBeenCalledWith({ type: WebSocketEventType.Ready });
    socket.onclose?.({ code: 4001 });
    expect(events).toHaveBeenCalledWith({ type: WebSocketEventType.Offline });
    await vi.advanceTimersByTimeAsync(1000);
    expect(session.refresh).toHaveBeenCalled();
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].onopen?.();
    expect(JSON.parse(FakeSocket.instances[1].sent[0])).toEqual({
      type: WebSocketEventType.Auth,
      token: 'renewed-token',
    });
    stop();
    FakeSocket.instances[1].onclose?.({ code: 1000 });
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('keeps file bytes behind authenticated APIs and maps access errors into repository errors', async () => {
    const upload = adapter.upload('chat', {
      name: 'notes.txt',
      mediaType: 'text/plain',
      bytes: new Uint8Array([72, 105]),
    });
    const request = http.expectOne(`${environment.apiUrl}/chats/chat/attachments`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer initial-token');
    expect(request.request.body).toEqual({
      name: 'notes.txt',
      mediaType: 'text/plain',
      content: 'SGk=',
    });
    request.flush({});
    await upload;
    const download = adapter.download('chat', 'message');
    http
      .expectOne(`${environment.apiUrl}/chats/chat/messages/message/attachment`)
      .flush({ name: 'notes.txt', mediaType: 'text/plain', content: 'SGk=' });
    expect((await download).bytes).toEqual(new Uint8Array([72, 105]));
    const denied = adapter.remove('chat', 'message');
    const assertion = expect(denied).rejects.toEqual(new ChatRepositoryError('missing'));
    http
      .expectOne(`${environment.apiUrl}/chats/chat/messages/message`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    await assertion;
  });
});
