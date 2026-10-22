import { Component, input } from '@angular/core';

/** FieldPulse mark (pulse line in a rounded square) + optional wordmark. Static SVG, no external assets. */
@Component({
  selector: 'fp-logo',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-3">
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="fpLogoGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#6366f1" />
            <stop offset="1" stop-color="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#fpLogoGrad)" />
        <path d="M10 34h11l5-12 8 22 6-15 3 5h11" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      @if (wordmark()) {
        <span class="font-semibold tracking-tight text-lg leading-none" [class.text-white]="light()">Field<span [class.text-primary]="!light()">Pulse</span></span>
      }
    </span>
  `,
})
export class LogoComponent {
  readonly size = input(34);
  readonly wordmark = input(true);
  readonly light = input(false);
}
