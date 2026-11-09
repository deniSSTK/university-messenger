import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-icon-download',
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
    <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
  </svg>`,
  styleUrl: './icon.scss',
})
class IconDownload {}
export { IconDownload };
