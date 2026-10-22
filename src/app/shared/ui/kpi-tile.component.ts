import { Component, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';

export type Tone = 'primary' | 'ok' | 'warn' | 'err' | 'neutral';

/** KPI tile: muted label, large tabular value, optional hint line. */
@Component({
  selector: 'fp-kpi',
  standalone: true,
  imports: [SkeletonModule],
  template: `
    <div class="fp-panel h-full p-5 flex gap-4 items-start">
      @if (icon()) {
        <span class="kpi-icon shrink-0" [attr.data-tone]="tone()" aria-hidden="true"><i [class]="'pi ' + icon()"></i></span>
      }
      <div class="min-w-0">
        <div class="fp-label">{{ label() }}</div>
        @if (loading()) {
          <p-skeleton width="5rem" height="2rem" styleClass="mt-2" />
        } @else {
          <div class="num text-3xl font-semibold mt-1 leading-tight" [title]="value()">{{ value() }}</div>
        }
        @if (hint()) { <div class="fp-muted text-xs mt-1">{{ hint() }}</div> }
      </div>
    </div>
  `,
  styles: [`
    .kpi-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-size: 1.05rem;
      background: var(--fp-accent-soft); color: var(--p-primary-color); }
    .kpi-icon[data-tone='ok'] { background: color-mix(in srgb, var(--fp-ok) 14%, transparent); color: var(--fp-ok); }
    .kpi-icon[data-tone='warn'] { background: color-mix(in srgb, var(--fp-warn) 14%, transparent); color: var(--fp-warn); }
    .kpi-icon[data-tone='err'] { background: color-mix(in srgb, var(--fp-err) 14%, transparent); color: var(--fp-err); }
    .kpi-icon[data-tone='neutral'] { background: var(--fp-surface-2); color: var(--fp-muted); }
  `],
})
export class KpiTileComponent {
  readonly label = input.required<string>();
  readonly value = input<string | number | null>(null);
  readonly hint = input<string>('');
  readonly icon = input<string>('');
  readonly tone = input<Tone>('primary');
  readonly loading = input(false);
}
