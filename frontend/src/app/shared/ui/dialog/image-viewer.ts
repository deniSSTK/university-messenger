import { Component, input, output, signal } from '@angular/core';
import { Dialog } from './dialog';

@Component({
  selector: 'app-image-viewer',
  imports: [Dialog],
  template: `
    <app-dialog layout="image" [heading]="name()" (closed)="closed.emit()">
      @if (failedSrc() === src()) {
        <div class="load-error" role="alert">
          <p>Не вдалося відкрити зображення.</p>
          @if (canRetry()) {
            <button type="button" (click)="retry.emit()">Повторити</button>
          }
        </div>
      } @else {
        <img [src]="src()" [alt]="name()" (error)="failedSrc.set(src())" />
      }
      @if (downloadable() && failedSrc() !== src()) {
        <a class="download" [href]="src()" [download]="name()">Завантажити</a>
      }
    </app-dialog>
  `,
  styles: `
    img {
      display: block;
      max-width: min(calc(100vw - 24px), 1000px);
      max-height: calc(100dvh - 24px);
      object-fit: contain;
      animation: appear 140ms ease-out;
    }
    .download {
      position: absolute;
      bottom: 12px;
      inset-inline-start: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      color: white;
      background: #141c25cc;
    }
    .load-error {
      padding: 56px 32px 32px;
      border-radius: 12px;
      background: #17212b;
      color: white;
    }
    .load-error button {
      color: inherit;
      background: transparent;
      margin-top: 12px;
    }
    @keyframes appear {
      from {
        opacity: 0;
        transform: scale(0.985);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      img {
        animation: none;
      }
    }
  `,
})
class ImageViewer {
  readonly src = input.required<string>();
  readonly name = input.required<string>();
  readonly downloadable = input(false);
  readonly canRetry = input(false);
  readonly closed = output<void>();
  readonly retry = output<void>();
  readonly failedSrc = signal<string | null>(null);
}

export { ImageViewer };
