import { Component, inject, model } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ThemeService } from '../../core/theme/theme.service';
import { OWNER } from '../../core/owner';
import { LogoComponent } from './logo.component';

/** About this system and its developer (Mavix Tech). Mavix colours stay inside the .mx-block. */
@Component({
  selector: 'fp-about-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, LogoComponent],
  template: `
    <p-dialog [visible]="visible()" (visibleChange)="visible.set($event)" [modal]="true" [draggable]="false"
      [dismissableMask]="true" header="About" [style]="{ width: '30rem' }" [breakpoints]="{ '575px': '94vw' }">
      <div class="flex items-center gap-3 mb-1">
        <fp-logo [size]="32" />
      </div>
      <p class="fp-muted text-sm m-0 mb-5">Demo system · fictional data, no real backend.</p>

      <div class="mx-block">
        <span class="text-xs fp-muted uppercase tracking-wider font-semibold">Developed by</span>
        <img [src]="theme.dark() ? owner.logoDark : owner.logo" [alt]="owner.name" width="168" height="55" class="mx-logo" />
        <p class="mx-tagline">{{ owner.tagline }}</p>
        <p class="m-0 text-sm leading-relaxed">{{ owner.description }}</p>
        <p class="mx-cta">{{ owner.cta }}</p>
        <a class="mx-btn" [href]="owner.url" target="_blank" rel="noopener noreferrer">
          Visit website <i class="pi pi-external-link" aria-hidden="true"></i>
        </a>
      </div>

      <ng-template #footer>
        <p-button label="Close" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .mx-block { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 18px; border-radius: 14px;
      border: 1px solid color-mix(in srgb, #1E5EFF 22%, transparent);
      background: linear-gradient(135deg, color-mix(in srgb, #1E5EFF 8%, transparent), color-mix(in srgb, #38BDF8 8%, transparent)); }
    .mx-logo { height: 44px; width: auto; margin-block: 2px; }
    .mx-tagline { margin: 0; font-size: 13px; font-weight: 600; color: #1E5EFF; }
    :host-context(.app-dark) .mx-tagline { color: #38BDF8; }
    .mx-cta { margin: 4px 0 0; font-weight: 600; }
    .mx-btn { display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; padding: 8px 16px; border-radius: 10px;
      color: #fff; font-weight: 600; text-decoration: none; background: linear-gradient(135deg, #1E5EFF, #38BDF8); }
    .mx-btn:hover { filter: brightness(1.06); }
    .mx-btn:focus-visible { outline: 2px solid #38BDF8; outline-offset: 2px; }
  `],
})
export class AboutDialogComponent {
  readonly theme = inject(ThemeService);
  readonly owner = OWNER;
  readonly visible = model(false);
}
