import { Component, ChangeDetectionStrategy, input, ViewEncapsulation } from '@angular/core';
@Component({
  selector: 'app-auth-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<section><h1>{{ title() }}</h1><ng-content /></section>',
  styleUrl: './auth-card.scss',
  encapsulation: ViewEncapsulation.None,
})
class AuthCard {
  readonly title = input.required<string>();
}
export { AuthCard };
