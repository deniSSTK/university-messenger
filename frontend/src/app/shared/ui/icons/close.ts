import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-close',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconClose {}
export { IconClose };
