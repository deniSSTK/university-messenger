import { TestBed } from '@angular/core/testing';
import { ChatService } from '../../service/chats';
import { ChatPeerProfile } from './chat-peer-profile';

describe('chat peer profile', () => {
  const mediaCounts = vi.fn();
  const media = vi.fn();
  const hide = vi.fn();
  const download = vi.fn();
  const person = {
    id: 'peer-id',
    username: 'classmate',
    displayName: 'Олена',
    avatarUrl: 'https://avatars.example.test/peer',
  };
  const item = {
    id: 'photo-id',
    text: 'photo.png',
    senderId: person.id,
    createdAt: '2026-11-15T10:00:00Z',
    attachment: { name: 'photo.png', mediaType: 'image/png', size: 12 },
  };

  beforeEach(() => {
    mediaCounts
      .mockReset()
      .mockResolvedValue({ photos: 2, videos: 0, files: 3, audio: 0, gifs: 0 });
    media.mockReset().mockResolvedValue({ messages: [item], nextBefore: 'photo-cursor' });
    hide.mockReset().mockResolvedValue(undefined);
    download.mockReset().mockRejectedValue(new Error('No fixtures'));
    TestBed.configureTestingModule({
      imports: [ChatPeerProfile],
      providers: [{ provide: ChatService, useValue: { mediaCounts, media, hide, download } }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  function render() {
    const fixture = TestBed.createComponent(ChatPeerProfile);
    fixture.componentRef.setInput('person', person);
    fixture.componentRef.setInput('chatId', 'private-chat');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    function button(selector: string): HTMLButtonElement {
      return host.querySelector<HTMLButtonElement>(selector)!;
    }

    return { fixture, host, button, profile: fixture.componentInstance };
  }

  it('shows the actual peer, only the message action, and categories with content', async () => {
    const { fixture, host, button, profile } = render();
    await vi.waitFor(() => expect(profile.counts()).not.toBeNull());
    fixture.detectChanges();

    expect(host.querySelector('.profile-header h2')?.textContent).toContain('Олена');
    expect(host.querySelector('.username')?.textContent).toContain('@classmate');
    expect([...host.querySelectorAll('.profile-header button:not(.avatar-button)')]).toEqual([
      button('.message-button'),
    ]);
    expect(
      [...host.querySelectorAll('[data-category]')].map((row) => row.getAttribute('data-category')),
    ).toEqual(['photos', 'files']);
    expect(button('[data-category="photos"]').textContent).toContain('2');
    expect(mediaCounts).toHaveBeenCalledWith('private-chat');

    const close = vi.fn();
    profile.closed.subscribe(close);
    button('.message-button').click();
    expect(close).toHaveBeenCalledOnce();
  });

  it('opens filtered content and paginates within the same chat', async () => {
    const { fixture, host, button, profile } = render();
    await vi.waitFor(() => expect(profile.counts()).not.toBeNull());
    fixture.detectChanges();

    button('[data-category="photos"]').click();
    await vi.waitFor(() => expect(profile.items()).toHaveLength(1));
    fixture.detectChanges();
    expect(host.querySelectorAll('.photo-grid app-chat-image')).toHaveLength(1);
    expect(host.querySelector('.photo-month h3')?.textContent?.toLowerCase()).toContain('листопад');
    expect(host.querySelector('.file-row')).toBeNull();
    expect(media).toHaveBeenCalledWith('private-chat', 'photos', null);

    media.mockResolvedValueOnce({
      messages: [{ ...item, id: 'older', createdAt: '2026-10-15T10:00:00Z' }],
      nextBefore: null,
    });
    button('.more').click();
    await vi.waitFor(() => expect(profile.items()).toHaveLength(2));
    fixture.detectChanges();
    expect(host.querySelectorAll('.photo-month')).toHaveLength(2);
    expect(media).toHaveBeenLastCalledWith('private-chat', 'photos', 'photo-cursor');
  });

  it('closes the avatar overlay on Escape while leaving the profile open', () => {
    const { fixture, host, button, profile } = render();
    const close = vi.fn();
    profile.closed.subscribe(close);
    button('.avatar-button').click();
    fixture.detectChanges();
    expect(host.querySelector('app-image-viewer img')?.getAttribute('src')).toBe(person.avatarUrl);
    host
      .querySelector('app-image-viewer dialog')!
      .dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(host.querySelector('app-image-viewer')).toBeNull();
    expect(host.querySelector('.profile-header')).not.toBeNull();
    expect(close).not.toHaveBeenCalled();
  });

  it('requires confirmation and emits removal only after a successful request', async () => {
    const { fixture, button, profile } = render();
    const hidden = vi.fn();
    profile.hidden.subscribe(hidden);
    button('.destructive').click();
    fixture.detectChanges();
    button('.confirm-actions button:first-child').click();
    expect(hide).not.toHaveBeenCalled();

    button('.destructive').click();
    hide.mockRejectedValueOnce(new Error('offline'));
    await profile.hide();
    expect(profile.hideError()).toBe(true);
    expect(hidden).not.toHaveBeenCalled();
    await Promise.all([profile.hide(), profile.hide()]);
    expect(hide).toHaveBeenCalledTimes(2);
    expect(hide).toHaveBeenLastCalledWith('private-chat');
    expect(hidden).toHaveBeenCalledOnce();
  });
});
