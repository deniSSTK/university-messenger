import { Component, DestroyRef, Injectable, inject, input, signal } from '@angular/core';
import { ChatService } from '../../service/chats';

function voiceTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return [Math.floor(whole / 60), whole % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

@Injectable({ providedIn: 'root' })
class VoicePlayback {
  private active?: () => void;

  claim(stop: () => void): void {
    if (this.active !== stop) {
      this.active?.();
      this.active = stop;
    }
  }

  release(stop: () => void): void {
    if (this.active === stop) {
      this.active = undefined;
    }
  }
}

@Component({
  selector: 'app-voice-player',
  template: `
    <div class="voice-player">
      <button
        type="button"
        class="play"
        [disabled]="loading()"
        (click)="toggle()"
        [attr.aria-label]="playing() ? 'Призупинити' : 'Відтворити голосове'"
      >
        @if (loading()) {
          <span class="loading"></span>
        } @else if (playing()) {
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
        } @else {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 4.8a1 1 0 0 1 1.5-.9l12 7.2a1 1 0 0 1 0 1.8l-12 7.2a1 1 0 0 1-1.5-.9z" />
          </svg>
        }
      </button>
      <div class="voice-track">
        <div
          class="wave"
          [class.plain]="!waveform().length"
          [style.--progress.%]="progress()"
          [class.preview]="preview()"
        >
          <div class="bars" aria-hidden="true">
            @for (sample of waveform(); track $index) {
              <i
                [class.played]="progress() >= (($index + 1) * 100) / waveform().length"
                [style.height.%]="3 + sample * 0.97"
              ></i>
            }
          </div>
          @if (!preview()) {
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              aria-label="Позиція відтворення"
              [value]="progress()"
              [attr.aria-valuetext]="time(position()) + ' із ' + time(durationMs() / 1000)"
              (input)="seek($event)"
            />
          }
        </div>
        <div class="voice-meta">
          <span>{{ time(position()) }} / {{ time(durationMs() / 1000) }}</span>
          @if (!preview()) {
            <button
              type="button"
              class="speed"
              (click)="changeSpeed()"
              [attr.aria-label]="'Швидкість відтворення ' + speed() + '×'"
            >
              {{ speed() }}×
            </button>
          }
        </div>
        @if (error()) {
          <span class="play-error" role="alert">{{ error() }}</span>
        }
      </div>
    </div>
  `,
  styleUrl: './voice-player.scss',
})
class VoicePlayer {
  private readonly chats = inject(ChatService);
  private readonly playback = inject(VoicePlayback);
  private audio?: HTMLAudioElement;
  private url?: string;
  private generation = 0;
  private target: number | null = null;
  private readonly stop = () => this.clear();

  readonly chatId = input('');
  readonly messageId = input('');
  readonly durationMs = input.required<number>();
  readonly waveform = input<readonly number[]>([]);
  readonly preview = input<Blob>();
  readonly loading = signal(false);
  readonly playing = signal(false);
  readonly position = signal(0);
  readonly speed = signal(1);
  readonly error = signal('');
  readonly time = voiceTime;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  progress(): number {
    return this.durationMs() > 0
      ? Math.min(100, (this.position() * 100_000) / this.durationMs())
      : 0;
  }

  async toggle(): Promise<void> {
    if (this.playing()) {
      this.audio?.pause();
      return;
    }

    if (this.loading()) {
      return;
    }

    const audio = await this.load();
    if (audio && audio === this.audio) {
      try {
        await audio.play();
        if (audio === this.audio) {
          this.error.set('');
        }
      } catch {
        if (audio === this.audio) {
          this.error.set('Натисніть відтворити ще раз.');
        }
      }
    }
  }

  async seek(event: Event): Promise<void> {
    const slider = event.target;
    if (!(slider instanceof HTMLInputElement)) {
      return;
    }

    this.target = (Math.min(100, Math.max(0, slider.valueAsNumber)) * this.durationMs()) / 100_000;
    this.position.set(this.target);
    const audio = await this.load();

    if (audio && audio === this.audio) {
      this.applySeek(audio);
    }
  }

  changeSpeed(): void {
    const next = this.speed() === 1 ? 1.5 : this.speed() === 1.5 ? 2 : 1;
    this.speed.set(next);
    if (this.audio) {
      this.audio.playbackRate = next;
    }
  }

  private async load(): Promise<HTMLAudioElement | undefined> {
    if (this.audio || this.loading()) {
      return this.audio;
    }

    this.error.set('');
    this.playback.claim(this.stop);
    this.loading.set(true);
    const generation = ++this.generation;

    try {
      let blob = this.preview();
      if (!blob) {
        const file = await this.chats.download(this.chatId(), this.messageId());
        blob = new Blob([new Uint8Array(file.bytes)], { type: file.mediaType });
      }
      if (generation !== this.generation) {
        return undefined;
      }

      const audio = new Audio();
      this.audio = audio;
      this.url = URL.createObjectURL(blob);
      audio.onplay = () => this.playing.set(true);
      audio.onpause = () => this.playing.set(false);
      audio.onended = () => this.playing.set(false);
      audio.ontimeupdate = () => {
        if (this.target === null) {
          this.position.set(audio.currentTime);
        }
      };
      audio.onloadedmetadata = () => this.applySeek(audio);
      audio.onerror = () => {
        this.clear();
        this.error.set('Аудіо недоступне або браузер не підтримує цей формат.');
      };
      audio.playbackRate = this.speed();
      audio.src = this.url;
      return audio;
    } catch {
      if (generation === this.generation) {
        this.clear();
        this.error.set('Не вдалося завантажити аудіо. Спробуйте ще раз.');
      }
      return undefined;
    } finally {
      if (generation === this.generation) {
        this.loading.set(false);
      }
    }
  }

  private applySeek(audio: HTMLAudioElement): void {
    if (this.target !== null && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      audio.currentTime = this.target;
      this.target = null;
    }
  }

  private clear(): void {
    this.generation++;
    this.playback.release(this.stop);
    if (this.audio) {
      const audio = this.audio;
      this.audio = undefined;
      audio.onplay = null;
      audio.onpause = null;
      audio.onended = null;
      audio.ontimeupdate = null;
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = undefined;
    }
    this.loading.set(false);
    this.playing.set(false);
    this.position.set(0);
    this.target = null;
  }
}

export { VoicePlayer, voiceTime };
