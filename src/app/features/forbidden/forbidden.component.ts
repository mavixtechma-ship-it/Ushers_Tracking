import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <div class="fp-panel max-w-lg mx-auto mt-16 p-10 text-center">
      <div class="mx-auto mb-4 w-14 h-14 rounded-2xl grid place-items-center bg-primary-50 dark:bg-surface-800 text-primary text-2xl">
        <i class="pi pi-lock" aria-hidden="true"></i>
      </div>
      <h1 class="text-xl font-semibold m-0 mb-2">You don't have access to that page</h1>
      <p class="fp-muted m-0 mb-6">Your account role doesn't include it. Ask an administrator if you need access.</p>
      <p-button label="Back to overview" icon="pi pi-arrow-left" routerLink="/dashboard" />
    </div>
  `,
})
export class ForbiddenComponent {}
