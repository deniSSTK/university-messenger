# Shared UI

Native element components preserve normal browser semantics, accessibility, Angular Reactive Forms and direct element references:

```html
<button appButton type="submit" [busy]="saving()">Зберегти</button>
<button appButton variant="icon" aria-label="Редагувати"><app-icon-edit /></button>
<app-form-field>
  <label for="name">Ім’я</label>
  <input appInput id="name" formControlName="name" />
</app-form-field>
<textarea appInput appearance="plain"></textarea>
<app-file-picker label="Прикріпити файл" hint="до 5 МіБ" (fileSelected)="upload($event)" />
<app-avatar [name]="name" [src]="avatarUrl" />
<app-dialog heading="Ваш профіль" (closed)="close()">...</app-dialog>
```

`Button` has primary, secondary, ghost, danger, icon and bare variants. Busy buttons disable submission and expose `aria-busy`. `Input` styles text inputs and textareas; `plain` is for search and message composition. `FormField` provides labels/errors layout. `FilePicker` owns its native file input and resets the selection for retries. `Avatar` falls back to initials when an image fails. `Dialog` uses the browser modal dialog, focus handling and Escape. `AuthCard` shares auth page layout. `Spinner` supports reduced motion.

Every SVG is a separate component and file under `icons/`. There is no name-to-path map or runtime SVG HTML injection. Replace the temporary SVG markup in the corresponding component when final artwork is supplied. Preserve the selector, `viewBox`, `currentColor`, and decorative `aria-hidden`; the surrounding button carries its accessible label.

Requested SVG assets, preferably 24×24 in one style:

- menu, back, close, search, refresh
- send, chevron-down, more, chat
- user, logout
- edit, trash, paperclip, download
- check (sent), check-double (read)

Size and color belong in component styles; avoid fixed pixel dimensions, embedded backgrounds, scripts and external resources in the SVG artwork.
