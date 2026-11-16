import { TestBed } from '@angular/core/testing';
import { ChatService } from '../../service/chats';
import { VoiceComposer, supportedRecordingType } from './voice-composer';

class RecorderStub {
  static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';
  mimeType = 'audio/webm;codecs=opus';
  state = 'inactive';
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['test audio']) });
    this.onstop?.();
  }
}

describe('voice composer', () => {
  const stop = vi.fn();
  const getUserMedia = vi.fn();
  const sendVoice = vi.fn();
  let mediaDevices: PropertyDescriptor | undefined;

  beforeEach(() => {
    stop.mockReset();
    getUserMedia.mockReset().mockResolvedValue({ getTracks: () => [{ stop }] });
    sendVoice.mockReset();
    mediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal('MediaRecorder', RecorderStub);
    TestBed.configureTestingModule({
      imports: [VoiceComposer],
      providers: [{ provide: ChatService, useValue: { sendVoice } }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    if (mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', mediaDevices);
    } else {
      Reflect.deleteProperty(navigator, 'mediaDevices');
    }
  });

  function render() {
    const fixture = TestBed.createComponent(VoiceComposer);
    fixture.componentRef.setInput('chatId', 'existing-chat');
    fixture.detectChanges();
    const mic = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.mic')!;
    mic.setPointerCapture = vi.fn();
    return { fixture, mic, composer: fixture.componentInstance };
  }

  function pointer(button: HTMLButtonElement, type: string): void {
    const event = new MouseEvent(type, { bubbles: true, button: 0 });
    Object.assign(event, { isPrimary: true, pointerId: 42 });
    button.dispatchEvent(event);
  }

  it('selects supported compressed MIME types and skips unsupported ones', () => {
    expect(supportedRecordingType(() => true)).toBe('audio/webm;codecs=opus');
    expect(supportedRecordingType((type) => type === 'audio/mp4')).toBe('audio/mp4');
    expect(supportedRecordingType(() => false)).toBeUndefined();
  });

  it('keeps pointer capture during recording and opens a preview on release', async () => {
    const { fixture, mic, composer } = render();
    expect(getUserMedia).not.toHaveBeenCalled();
    pointer(mic, 'pointerdown');
    await vi.waitFor(() => expect(composer.phase()).toBe('recording'));
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.mic')).toBe(mic);
    expect(mic.setPointerCapture).toHaveBeenCalledWith(42);

    pointer(mic, 'pointerup');
    expect(composer.phase()).toBe('preview');
    expect(composer.draft()?.blob.type).toBe('audio/webm;codecs=opus');
    expect(stop).toHaveBeenCalledOnce();
    expect(sendVoice).not.toHaveBeenCalled();
  });

  it('releases the microphone on pointer cancellation and does not create a draft', async () => {
    const { mic, composer } = render();
    pointer(mic, 'pointerdown');
    await vi.waitFor(() => expect(composer.phase()).toBe('recording'));

    pointer(mic, 'pointercancel');
    expect(composer.phase()).toBe('idle');
    expect(composer.draft()).toBeNull();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('shows a permission error and handles release before access is granted', async () => {
    const { mic, composer } = render();
    getUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    pointer(mic, 'pointerdown');
    await vi.waitFor(() => expect(composer.error()).toContain('Дозвольте'));
    expect(composer.phase()).toBe('idle');

    pointer(mic, 'pointerdown');
    pointer(mic, 'pointerup');
    await vi.waitFor(() => expect(composer.phase()).toBe('idle'));
    expect(stop).toHaveBeenCalledOnce();
    expect(composer.draft()).toBeNull();
  });

  it('keeps the same request ID for a retry and suppresses concurrent sends', async () => {
    const { mic, composer } = render();
    sendVoice.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ id: 'message' });
    pointer(mic, 'pointerdown');
    await vi.waitFor(() => expect(composer.phase()).toBe('recording'));
    pointer(mic, 'pointerup');

    const id = composer.draft()?.id;
    await Promise.all([composer.submit(), composer.submit()]);
    expect(composer.phase()).toBe('preview');
    expect(sendVoice).toHaveBeenCalledTimes(1);

    await composer.submit();
    expect(composer.phase()).toBe('idle');
    expect(sendVoice).toHaveBeenNthCalledWith(1, 'existing-chat', expect.objectContaining({ id }));
    expect(sendVoice).toHaveBeenNthCalledWith(2, 'existing-chat', expect.objectContaining({ id }));
  });
});
