import { Component, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styleUrl: './spinner.scss',
  host: { 'aria-hidden': 'true' },
})
class Spinner {}
export { Spinner };
