import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-check-double',
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
    <path d="m2 12 4 4L16 6m-5 10 3 3L24 9" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconCheckDouble {}
export { IconCheckDouble };
