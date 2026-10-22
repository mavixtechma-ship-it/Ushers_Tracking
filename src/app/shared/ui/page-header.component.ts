import { Component, input } from '@angular/core';

/** Consistent page title row: title + one-line description on the left, actions on the right. */
@Component({
  selector: 'fp-page-header',
  standalone: true,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div class="min-w-0">
        <h1 class="text-2xl font-semibold tracking-tight m-0">{{ title() }}</h1>
        @if (description()) {
          <p class="fp-muted m-0 mt-1">{{ description() }}</p>
        }
      </div>
      <div class="flex flex-wrap items-center gap-2"><ng-content /></div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
