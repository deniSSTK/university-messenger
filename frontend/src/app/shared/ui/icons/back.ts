import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-back',
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
    <path d="M19 12H5m7-7-7 7 7 7" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconBack {}
export { IconBack };
