import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ng-content />',
  styleUrl: './form-field.scss',
  encapsulation: ViewEncapsulation.None,
})
class FormField {}
export { FormField };
