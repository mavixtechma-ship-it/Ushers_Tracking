import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

interface SectorTile { id: number; name: string; branches: number; open: number; }

@Component({
  selector: 'app-sectors',
  standalone: true,
  imports: [FormsModule, ButtonModule, InputTextModule, SkeletonModule, ProgressBarModule, PageHeaderComponent],
  template: `
    <fp-page-header title="Sectors" description="Regions used to group branches for reporting and supervision." />

    @if (auth.canWrite()) {
      <form class="fp-panel p-4 mb-5 flex flex-wrap items-end gap-3" (ngSubmit)="add()" #f="ngForm">
        <div class="flex flex-col gap-2 flex-1 min-w-[14rem]">
          <label for="s-name" class="font-medium">New sector</label>
          <input pInputText id="s-name" name="name" [(ngModel)]="name" required maxlength="60" placeholder="e.g. Riverside Sector" autocomplete="off" />
        </div>
        <p-button type="submit" label="Add sector" icon="pi pi-plus" [loading]="saving" [disabled]="!f.valid" />
      </form>
    }

    @if (loading) {
      <div class="fp-grid">@for (i of [1,2,3,4]; track i) { <div class="fp-col-3"><p-skeleton height="8rem" borderRadius="14px" /></div> }</div>
    } @else if (error) {
      <div class="fp-panel p-10 text-center fp-muted">Couldn't load sectors. <p-button label="Retry" [link]="true" (onClick)="load()" /></div>
    } @else if (tiles.length === 0) {
      <div class="fp-panel p-10 text-center fp-muted">No sectors yet.</div>
    } @else {
      <div class="fp-grid">
        @for (t of tiles; track t.id) {
          <article class="fp-col-3 fp-panel p-5">
            <div class="flex items-start justify-between gap-2">
              <h2 class="text-base font-semibold m-0">{{ t.name }}</h2>
              <span class="num fp-muted text-xs">#{{ t.id }}</span>
            </div>
            <div class="num text-3xl font-semibold mt-3">{{ t.branches }}</div>
            <div class="fp-muted text-xs mb-3">{{ t.branches === 1 ? 'branch' : 'branches' }} · {{ t.open }} open</div>
            <p-progressbar [value]="t.branches ? Math.round((t.open / t.branches) * 100) : 0" [showValue]="false" styleClass="h-1.5"
              [attr.aria-label]="t.open + ' of ' + t.branches + ' branches open'" />
          </article>
        }
      </div>
    }
  `,
})
export class SectorsComponent implements OnInit {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);
  readonly auth = inject(AuthService);
  readonly Math = Math;

  tiles: SectorTile[] = [];
  loading = true;
  error = false;
  name = '';
  saving = false;

  ngOnInit() { this.load(); }

  async load() {
    this.loading = true;
    this.error = false;
    try {
      const [sectors, branches] = await Promise.all([this.data.getSectors(), this.data.getAllBranches()]);
      this.tiles = sectors.map((s) => {
        const mine = branches.items.filter((b) => b.sectorId === s.id);
        return { id: s.id, name: s.name, branches: mine.length, open: mine.filter((b) => b.is_active).length };
      });
    } catch {
      this.error = true;
    } finally {
      this.loading = false;
    }
  }

  async add() {
    if (!this.auth.canWrite()) return;
    const name = this.name.trim();
    if (!name) return;
    this.saving = true;
    try {
      await this.data.addSector(name);
      this.toast.add({ severity: 'success', summary: 'Sector added', detail: name });
      this.name = '';
      await this.load();
    } catch { /* toast shown by interceptor */ } finally {
      this.saving = false;
    }
  }
}
