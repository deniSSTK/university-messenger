import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  viewChild,
  ElementRef,
  type AfterViewInit,
  type OnDestroy,
} from '@angular/core';
import { Button } from '../button/button';
import { IconClose } from '../icons/close';
type DialogLayout = 'standard' | 'profile' | 'image';

@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, IconClose],
  template: `<dialog
    #panel
    [attr.data-layout]="layout()"
    [attr.aria-label]="heading()"
    (cancel)="cancel($event)"
    (click)="dismissBackdrop($event)"
  >
    <header>
      @if (layout() === 'standard') {
        <h2>{{ heading() }}</h2>
      }
      <button
        appButton
        variant="icon"
        type="button"
        [disabled]="locked()"
        aria-label="Закрити діалог"
        (click)="closed.emit()"
      >
        <app-icon-close />
      </button>
    </header>
    <ng-content />
  </dialog>`,
  styleUrl: './dialog.scss',
})
class Dialog implements AfterViewInit, OnDestroy {
  readonly heading = input.required<string>();
  readonly layout = input<DialogLayout>('standard');
  readonly locked = input(false);
  readonly closed = output<void>();
  private readonly panel = viewChild.required<ElementRef<HTMLDialogElement>>('panel');
  private activePanel?: HTMLDialogElement;
  private previousFocus: HTMLElement | null = null;
  ngAfterViewInit(): void {
    this.previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = this.panel().nativeElement;
    this.activePanel = panel;
    if (typeof panel.showModal === 'function') {
      panel.showModal();
    } else {
      panel.setAttribute('open', '');
    }
  }
  cancel(event: Event): void {
    event.preventDefault();
    if (!this.locked()) {
      this.closed.emit();
    }
  }
  dismissBackdrop(event: MouseEvent): void {
    const panel = this.activePanel;

    if (!panel || event.target !== panel || this.locked() || this.layout() === 'standard') {
      return;
    }

    const bounds = panel.getBoundingClientRect();
    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (outside) {
      this.closed.emit();
    }
  }

  ngOnDestroy(): void {
    if (this.activePanel?.open && typeof this.activePanel.close === 'function') {
      this.activePanel.close();
    }

    this.previousFocus?.focus({ preventScroll: true });
  }
}
export { Dialog };
