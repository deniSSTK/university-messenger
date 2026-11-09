import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-chevron-down',
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
    <path d="M12 4v16m-6-6 6 6 6-6" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconChevronDown {}
export { IconChevronDown };
