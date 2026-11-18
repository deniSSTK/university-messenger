import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { VOICE_MAX_BYTES, VOICE_MAX_MS } from '../../chats.constants';
import { ChatError, ChatService } from '../../service/chats';
import type { ChatMessage } from '../../service/chats.types';
import { Spinner } from '../../../../shared/ui/spinner/spinner';
import { IconSend } from '../../../../shared/ui/icons/send';
import { IconTrash } from '../../../../shared/ui/icons/trash';
import { VoicePlayer, voiceTime } from './voice-player';

type RecordingPhase = 'idle' | 'permission' | 'recording' | 'finishing' | 'preview' | 'sending';
type VoiceDraft = { id: string; blob: Blob; durationMs: number };

function supportedRecordingType(supports: (type: string) => boolean): string | undefined {
  return [
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ].find(supports);
}

@Component({
  selector: 'app-voice-composer',
  imports: [VoicePlayer, IconSend, IconTrash, Spinner],
  host: {
    '(window:blur)': 'interruptRecording()',
    '(document:keydown.escape)': 'discard()',
  },
  template: `
    <button
      type="button"
      class="mic"
      [class.holding]="phase() === 'permission' || phase() === 'recording'"
      [class.inactive]="phase() === 'finishing' || phase() === 'preview' || phase() === 'sending'"
      aria-label="Утримуйте, щоб записати голосове"
      title="Утримуйте, щоб записати голосове"
      [disabled]="blocked()"
      (pointerdown)="holdPointer($event)"
      (pointermove)="movePointer($event)"
      (pointerup)="releasePointer($event)"
      (contextmenu)="$event.preventDefault()"
      (pointercancel)="cancelPointer($event)"
      (lostpointercapture)="cancelPointer($event)"
      (keydown)="holdKey($event)"
      (keyup)="releaseKey($event)"
      (click)="accessibleClick($event)"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="9" y="2" width="6" height="13" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-3 0h6" />
      </svg>
    </button>
    @if (phase() !== 'idle') {
      <div class="record-controls">
        <button
          type="button"
          class="discard"
          aria-label="Видалити запис"
          (click)="discard()"
          [disabled]="phase() === 'sending'"
        >
          <app-icon-trash />
        </button>
        @if (draft(); as recording) {
          <app-voice-player [preview]="recording.blob" [durationMs]="recording.durationMs" />
          <button
            type="button"
            class="send-voice"
            (click)="submit()"
            [disabled]="phase() === 'sending'"
            aria-label="Надіслати голосове"
          >
            @if (phase() === 'sending') {
              <app-spinner />
            } @else {
              <app-icon-send />
            }
          </button>
          @if (phase() === 'sending') {
            <span class="sr-only" role="status">Завантаження голосового…</span>
          }
        } @else {
          <span class="recording-status" role="status">
            @if (phase() === 'recording') {
              <span class="record-dot"></span><span class="sr-only">Триває запис</span>
            } @else if (phase() === 'permission') {
              Доступ до мікрофона…
            } @else {
              Підготовка запису…
            }
          </span>
          @if (phase() === 'recording') {
            <span class="record-time">{{ time(elapsed() / 1000) }}</span>
            <span class="hold-hint" [class.cancel-armed]="cancelArmed()">
              @if (cancelArmed()) {
                Відпустіть, щоб скасувати
              } @else if (pointerId !== null) {
                ← Посуньте для скасування
              } @else {
                Відпустіть для прослуховування
              }
            </span>
            <button
              type="button"
              class="stop-recording"
              (click)="release()"
              aria-label="Зупинити запис"
            >
              <span></span>
            </button>
          }
        }
      </div>
    }
  `,
  styleUrl: './voice-composer.scss',
})
class VoiceComposer {
  private readonly chat = inject(ChatService);
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private request = 0;
  private held = false;
  protected pointerId: number | null = null;
  private pointerStartX = 0;
  private timer?: ReturnType<typeof setInterval>;
  private limit?: ReturnType<typeof setTimeout>;
  private startedAt = 0;
  private chunks: Blob[] = [];
  private bytes = 0;

  readonly chatId = input.required<string>();
  readonly blocked = input(false);
  readonly replyToId = input<string>();
  readonly sent = output<{ chatId: string; message: ChatMessage }>();
  readonly phase = signal<RecordingPhase>('idle');
  readonly elapsed = signal(0);
  readonly cancelArmed = signal(false);
  readonly draft = signal<VoiceDraft | null>(null);
  readonly error = signal('');
  readonly time = voiceTime;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reset());
  }

  holdPointer(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || this.phase() !== 'idle' || this.blocked()) {
      return;
    }

    event.preventDefault();
    this.pointerId = event.pointerId;
    this.pointerStartX = event.clientX;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    void this.start();
  }

  movePointer(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) {
      this.cancelArmed.set(this.pointerStartX - event.clientX >= 80);
    }
  }

  releasePointer(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) {
      this.pointerId = null;
      if (this.cancelArmed()) {
        this.discard();
      } else {
        this.release();
      }
    }
  }

  cancelPointer(event: PointerEvent): void {
    if (event.pointerId === this.pointerId) {
      this.interrupt();
    }
  }

  holdKey(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) {
        void this.start();
      }
    }
  }

  releaseKey(event: KeyboardEvent): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.release();
    }
  }

  accessibleClick(event: MouseEvent): void {
    if (event.detail === 0 && !this.held) {
      void this.start();
    }
  }

  private async start(): Promise<void> {
    if (this.phase() !== 'idle' || this.blocked()) {
      return;
    }

    this.error.set('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.error.set(
        'Запис недоступний у цьому браузері. Відкрийте сайт через HTTPS або localhost.',
      );
      return;
    }

    const mediaType = supportedRecordingType((type) => MediaRecorder.isTypeSupported(type));

    if (!mediaType) {
      this.error.set('Браузер не підтримує сумісний формат запису.');
      return;
    }

    this.held = true;
    const request = ++this.request;
    this.phase.set('permission');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (request !== this.request || !this.held) {
        stream.getTracks().forEach((track) => track.stop());
        if (request === this.request) {
          this.phase.set('idle');
        }
        return;
      }

      this.stream = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: mediaType,
        audioBitsPerSecond: 64_000,
      });
      this.recorder = recorder;
      recorder.ondataavailable = ({ data }) => {
        if (data.size && this.recorder === recorder) {
          this.bytes += data.size;
          if (this.bytes > VOICE_MAX_BYTES) {
            this.fail('Запис перевищив 5 МіБ.');
          } else {
            this.chunks.push(data);
          }
        }
      };
      recorder.onerror = () => this.fail('Запис перервався. Спробуйте ще раз.');
      recorder.onstop = () => this.finish(recorder);
      for (const track of stream.getTracks()) {
        track.onended = () => this.fail('Мікрофон відключився під час запису.');
      }

      recorder.start(250);
      this.startedAt = performance.now();
      this.elapsed.set(0);
      this.timer = setInterval(() => this.elapsed.set(performance.now() - this.startedAt), 100);
      this.limit = setTimeout(() => this.release(), VOICE_MAX_MS - 250);
      this.phase.set('recording');
    } catch (error: unknown) {
      if (request === this.request) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError';
        this.fail(
          denied
            ? 'Дозвольте доступ до мікрофона в налаштуваннях браузера.'
            : 'Мікрофон недоступний. Перевірте підключення та спробуйте ще раз.',
        );
      }
    }
  }

  release(): void {
    this.held = false;
    const recorder = this.recorder;

    if (recorder?.state === 'recording') {
      this.elapsed.set(performance.now() - this.startedAt);
      clearInterval(this.timer);
      clearTimeout(this.limit);
      this.phase.set('finishing');
      recorder.stop();
      this.stopTracks();
    }
  }

  interruptRecording(): void {
    if (this.phase() === 'recording') {
      this.fail('Запис перервано. Спробуйте ще раз.');
    }
  }

  interrupt(): void {
    if (this.phase() === 'permission' || this.phase() === 'recording') {
      this.discard();
    }
  }

  discard(): void {
    if (this.phase() !== 'sending') {
      this.reset();
      this.error.set('');
    }
  }

  async submit(): Promise<void> {
    const draft = this.draft();

    if (!draft || this.phase() !== 'preview') {
      return;
    }

    const chatId = this.chatId();
    const request = this.request;
    this.phase.set('sending');
    this.error.set('');

    try {
      const replyToId = this.replyToId();
      const message = await this.chat.sendVoice(chatId, {
        ...(replyToId ? { replyToId } : {}),
        id: draft.id,
        bytes: new Uint8Array(await draft.blob.arrayBuffer()),
        mediaType: draft.blob.type,
      });
      if (request === this.request) {
        this.reset();
        this.sent.emit({ chatId, message });
      }
    } catch (error: unknown) {
      if (request === this.request) {
        this.phase.set('preview');
        this.error.set(
          error instanceof ChatError && error.code === 'validation'
            ? 'Сервер не зміг прийняти цей запис. Запишіть його ще раз.'
            : 'Не вдалося надіслати голосове. Спробуйте ще раз.',
        );
      }
    }
  }

  private finish(recorder: MediaRecorder): void {
    if (this.recorder !== recorder) {
      return;
    }

    this.stopTracks();
    if (this.phase() !== 'finishing' || !this.bytes) {
      this.fail('Запис порожній або перерваний. Утримуйте мікрофон, щоб записати голосове.');
      return;
    }

    const blob = new Blob(this.chunks, { type: recorder.mimeType || this.chunks[0].type });
    const durationMs = Math.min(VOICE_MAX_MS, Math.ceil(this.elapsed()));
    this.reset();
    this.draft.set({ id: crypto.randomUUID(), blob, durationMs });
    this.phase.set('preview');
  }

  private stopTracks(): void {
    for (const track of this.stream?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    this.stream = undefined;
  }

  private fail(message: string): void {
    this.reset();
    this.error.set(message);
  }

  private reset(): void {
    this.request++;
    this.held = false;
    this.pointerId = null;
    this.cancelArmed.set(false);
    clearInterval(this.timer);
    clearTimeout(this.limit);
    const recorder = this.recorder;
    this.recorder = undefined;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }
    this.stopTracks();
    this.chunks = [];
    this.bytes = 0;
    this.draft.set(null);
    this.phase.set('idle');
  }
}

export { VoiceComposer, supportedRecordingType };
