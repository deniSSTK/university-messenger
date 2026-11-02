import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('renders the route outlet', async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('router-outlet')).not.toBeNull();
  });
});
