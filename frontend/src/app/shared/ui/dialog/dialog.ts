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
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, IconClose],
  template: `<dialog #panel [attr.aria-label]="heading()" (cancel)="cancel($event)">
    <header>
      <h2>{{ heading() }}</h2>
      <button
        appButton
        variant="icon"
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
  readonly locked = input(false);
  readonly closed = output<void>();
  private readonly panel = viewChild.required<ElementRef<HTMLDialogElement>>('panel');
  private previousFocus: HTMLElement | null = null;
  ngAfterViewInit(): void {
    this.previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = this.panel().nativeElement;
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
  ngOnDestroy(): void {
    this.previousFocus?.focus();
  }
}
export { Dialog };
