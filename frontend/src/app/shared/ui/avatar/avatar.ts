import { Component, ChangeDetectionStrategy, input, computed, signal } from '@angular/core';
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (src() && failedSrc() !== src()) {
      <img [src]="src()" alt="" (error)="failedSrc.set(src())" />
    } @else {
      {{ initials() }}
    }`,
  styleUrl: './avatar.scss',
  host: { 'aria-hidden': 'true', '[style.--avatar-size.px]': 'size()' },
})
class Avatar {
  readonly name = input('');
  readonly src = input<string | null | undefined>(null);
  readonly size = input(44);
  readonly failedSrc = signal<string | null | undefined>(undefined);
  readonly initials = computed(() =>
    this.name()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => Array.from(word)[0] ?? '')
      .join('')
      .toLocaleUpperCase('uk-UA'),
  );
}
export { Avatar };
