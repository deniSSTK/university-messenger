import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from './button/button';
import { Input } from './input/input';
import { FormField } from './form-field/form-field';

@Component({
  imports: [Button, Input, FormField, ReactiveFormsModule],
  template: `<form (submit)="$event.preventDefault(); submissions.set(submissions() + 1)">
    <app-form-field
      ><label for="test-name">Name</label><input appInput id="test-name" [formControl]="name"
    /></app-form-field>
    <button appButton type="submit" [busy]="saving()" [disabled]="name.invalid">Save</button>
    <button appButton variant="secondary" (click)="cancelled.set(true)">Cancel</button>
  </form>`,
})
class ControlExample {
  readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly saving = signal(false);
  readonly submissions = signal(0);
  readonly cancelled = signal(false);
}

describe('shared native controls', () => {
  it('preserves Reactive Forms input, native submit semantics and disabled/busy behavior', () => {
    const fixture = TestBed.createComponent(ControlExample);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector('input')!;
    const submit = root.querySelector('button')!;
    expect(submit.disabled).toBe(true);
    input.value = 'Alice';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.name.value).toBe('Alice');
    expect(submit.disabled).toBe(false);
    submit.click();
    expect(fixture.componentInstance.submissions()).toBe(1);
    fixture.componentInstance.saving.set(true);
    fixture.detectChanges();
    expect(submit.getAttribute('aria-busy')).toBe('true');
    submit.click();
    expect(fixture.componentInstance.submissions()).toBe(1);
  });

  it('defaults action buttons to button and keeps their label association', () => {
    const fixture = TestBed.createComponent(ControlExample);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const cancel = root.querySelectorAll('button')[1];
    expect(root.querySelector('label')?.htmlFor).toBe(root.querySelector('input')?.id);
    cancel.click();
    expect(fixture.componentInstance.cancelled()).toBe(true);
    expect(fixture.componentInstance.submissions()).toBe(0);
  });
});
