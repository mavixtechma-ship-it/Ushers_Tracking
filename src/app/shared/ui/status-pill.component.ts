import { Component, input } from '@angular/core';
import { Tone } from './kpi-tile.component';

/** Status = dot + text (never colour only). */
@Component({
  selector: 'fp-status',
  standalone: true,
  template: `<span class="pill" [attr.data-tone]="tone()"><span class="dot" aria-hidden="true"></span>{{ text() }}</span>`,
  styles: [`
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; font-size: 12px;
      font-weight: 500; white-space: nowrap; background: var(--fp-surface-2); color: var(--fp-muted); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
    .pill[data-tone='ok'] { background: color-mix(in srgb, var(--fp-ok) 13%, transparent); color: var(--fp-ok); }
    .pill[data-tone='warn'] { background: color-mix(in srgb, var(--fp-warn) 13%, transparent); color: var(--fp-warn); }
    .pill[data-tone='err'] { background: color-mix(in srgb, var(--fp-err) 13%, transparent); color: var(--fp-err); }
    .pill[data-tone='primary'] { background: var(--fp-accent-soft); color: var(--p-primary-color); }
  `],
})
export class StatusPillComponent {
  readonly text = input.required<string>();
  readonly tone = input<Tone>('neutral');
}
