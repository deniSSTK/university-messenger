import { TestBed } from '@angular/core/testing';
import { ChatService } from '../../service/chats';
import type { ChatFile } from '../../service/chats.types';
import { ChatImage } from './chat-image';

describe('chat image preview', () => {
  const download = vi.fn<() => Promise<ChatFile>>();
  const createUrl = vi.fn(() => 'blob:photo');
  const revokeUrl = vi.fn();
  const file = { name: 'photo.png', mediaType: 'image/png', bytes: new Uint8Array([1, 2]) };

  beforeEach(() => {
    download.mockReset().mockResolvedValue(file);
    createUrl.mockClear();
    revokeUrl.mockClear();
    vi.stubGlobal('URL', { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    TestBed.configureTestingModule({
      imports: [ChatImage],
      providers: [{ provide: ChatService, useValue: { download } }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  function createPreview() {
    const fixture = TestBed.createComponent(ChatImage);
    fixture.componentRef.setInput('chatId', 'chat-1');
    fixture.componentRef.setInput('messageId', 'message-1');
    fixture.componentRef.setInput('name', file.name);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the attachment through the service and releases its object URL', async () => {
    const fixture = createPreview();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(download).toHaveBeenCalledWith('chat-1', 'message-1');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe(
      'blob:photo',
    );

    fixture.destroy();
    expect(revokeUrl).toHaveBeenCalledWith('blob:photo');
  });

  it('ignores a download that finishes after the preview has been destroyed', async () => {
    let finish!: (file: ChatFile) => void;
    download.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const fixture = createPreview();
    fixture.destroy();

    finish(file);
    await Promise.resolve();
    expect(createUrl).not.toHaveBeenCalled();
  });

  it('offers retry after a failed attachment request', async () => {
    download.mockRejectedValueOnce(new Error('Offline'));
    const fixture = createPreview();
    await vi.waitFor(() => expect(fixture.componentInstance.failed()).toBe(true));
    fixture.detectChanges();

    const retry = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.image-status',
    );
    expect(retry?.textContent).toContain('Повторити');
    retry!.click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.url()).toBe('blob:photo'));
    fixture.detectChanges();

    expect(download).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.url()).toBe('blob:photo');
  });
});
