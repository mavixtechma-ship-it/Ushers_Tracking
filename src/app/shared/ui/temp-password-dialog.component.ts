import { Component, model, input, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

/** Shows a generated temporary password exactly once; the value is cleared when the dialog closes. */
@Component({
  selector: 'fp-temp-password-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule],
  template: `
    <p-dialog [visible]="!!password()" (visibleChange)="!$event && close()" [modal]="true" [draggable]="false"
      header="Temporary password" [style]="{ width: '28rem' }">
      <p class="m-0 mb-3">Share this one-time password with <strong>{{ forName() }}</strong>. It will not be shown again.</p>
      <div class="flex items-center gap-2 p-3 rounded-lg bg-surface-100 dark:bg-surface-800">
        <code class="num text-lg flex-1 select-all break-all">{{ password() }}</code>
        <p-button icon="pi pi-copy" [text]="true" ariaLabel="Copy password" (onClick)="copy()" />
      </div>
      <ng-template #footer>
        <p-button label="Done" (onClick)="close()" />
      </ng-template>
    </p-dialog>
  `,
})
export class TempPasswordDialogComponent {
  private readonly toast = inject(MessageService);
  readonly password = model<string | null>(null);
  readonly forName = input('the user');

  async copy() {
    try {
      await navigator.clipboard.writeText(this.password() ?? '');
      this.toast.add({ severity: 'success', summary: 'Copied', detail: 'Password copied to clipboard.' });
    } catch {
      this.toast.add({ severity: 'warn', summary: 'Copy failed', detail: 'Select the text and copy it manually.' });
    }
  }

  close() {
    this.password.set(null);
  }
}
