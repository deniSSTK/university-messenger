import { TestBed } from '@angular/core/testing';
import { ChatService } from '../../service/chats';
import { VoicePlayer } from './voice-player';

class AudioStub {
  static readonly instances: AudioStub[] = [];
  currentTime = 0;
  playbackRate = 1;
  readyState = 1;
  onplay?: () => void;
  onpause?: () => void;
  ontimeupdate?: () => void;
  pause = vi.fn(() => this.onpause?.());
  play = vi.fn(async () => this.onplay?.());
  removeAttribute = vi.fn();
  load = vi.fn();

  constructor() {
    AudioStub.instances.push(this);
  }
}

describe('voice player', () => {
  const download = vi.fn();
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    AudioStub.instances.length = 0;
    download.mockReset().mockResolvedValue({ bytes: new Uint8Array([1]), mediaType: 'audio/webm' });
    revokeObjectURL.mockReset();
    vi.stubGlobal('Audio', AudioStub);
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:voice', revokeObjectURL });
    TestBed.configureTestingModule({
      imports: [VoicePlayer],
      providers: [{ provide: ChatService, useValue: { download } }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  function render(id: string) {
    const fixture = TestBed.createComponent(VoicePlayer);
    fixture.componentRef.setInput('chatId', 'chat');
    fixture.componentRef.setInput('messageId', id);
    fixture.componentRef.setInput('durationMs', 8_000);
    fixture.componentRef.setInput('waveform', [20, 100, 50]);
    fixture.detectChanges();
    return fixture;
  }

  it('loads on demand, seeks, updates playback progress and changes speed', async () => {
    const fixture = render('first');
    expect(download).not.toHaveBeenCalled();
    const player = fixture.componentInstance;
    await player.toggle();
    const [audio] = AudioStub.instances;

    expect(download).toHaveBeenCalledWith('chat', 'first');
    expect(player.playing()).toBe(true);

    const slider = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    slider.value = '50';
    slider.dispatchEvent(new Event('input'));
    await vi.waitFor(() => expect(audio.currentTime).toBe(4));
    audio.currentTime = 6;
    audio.ontimeupdate?.();
    expect(player.progress()).toBe(75);

    player.changeSpeed();
    expect(audio.playbackRate).toBe(1.5);
    player.changeSpeed();
    expect(audio.playbackRate).toBe(2);
    await player.toggle();
    expect(player.playing()).toBe(false);
    fixture.destroy();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:voice');
  });

  it('stops the previous player and retries a failed download', async () => {
    const first = render('first').componentInstance;
    const second = render('second').componentInstance;
    await first.toggle();

    download.mockRejectedValueOnce(new Error('offline'));
    await second.toggle();
    expect(first.playing()).toBe(false);
    expect(AudioStub.instances[0].pause).toHaveBeenCalledOnce();
    expect(second.error()).toContain('Спробуйте ще раз');

    await second.toggle();
    expect(second.playing()).toBe(true);
    expect(second.error()).toBe('');
  });
});
