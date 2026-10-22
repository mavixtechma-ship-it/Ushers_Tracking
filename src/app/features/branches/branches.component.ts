import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DrawerModule } from 'primeng/drawer';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Branch, Sector } from '../../core/models/models';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

interface BranchForm { name: string; address: string; sectorId: number | null; latitude: number | null; longitude: number | null; geofence_range: number; is_active: boolean; }
const emptyForm = (): BranchForm => ({ name: '', address: '', sectorId: null, latitude: null, longitude: null, geofence_range: 100, is_active: true });

/** Extracts "lat,lng" from a pasted map link or a raw "lat, lng" pair. Pure parsing, nothing is fetched. */
function parseCoords(text: string): { lat: number; lng: number } | null {
  const patterns = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/];
  for (const p of patterns) {
    const m = text.slice(0, 2000).match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [DecimalPipe, FormsModule, TableModule, ButtonModule, SelectModule, InputTextModule, InputNumberModule, IconFieldModule, InputIconModule,
    DrawerModule, ToggleSwitchModule, TooltipModule, PageHeaderComponent],
  template: `
    <fp-page-header title="Branches" description="Store locations and the geofence staff must be inside to check in.">
      @if (auth.canWrite()) { <p-button icon="pi pi-plus" label="Add branch" (onClick)="openForm()" /> }
    </fp-page-header>

    <div class="fp-panel overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
        <p-iconfield styleClass="w-full sm:w-72">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText type="search" placeholder="Name, address or sector" [(ngModel)]="search" (ngModelChange)="searchChanged()" class="w-full" aria-label="Search branches" maxlength="80" />
        </p-iconfield>
      </div>

      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [rowsPerPageOptions]="[10, 25, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}"
        dataKey="id" [rowHover]="true" [tableStyle]="{ 'min-width': '56rem' }">
        <ng-template #header>
          <tr>
            <th scope="col" pSortableColumn="name">Branch <p-sortIcon field="name" /></th>
            <th scope="col" pSortableColumn="sectorName">Sector <p-sortIcon field="sectorName" /></th>
            <th scope="col">Coordinates</th>
            <th scope="col" class="text-right" pSortableColumn="geofence_range">Geofence <p-sortIcon field="geofence_range" /></th>
            <th scope="col">Open</th>
            @if (auth.canWrite()) { <th scope="col"><span class="sr-only">Actions</span></th> }
          </tr>
        </ng-template>
        <ng-template #body let-b>
          <tr [class.opacity-60]="!b.is_active">
            <td><div class="font-medium">{{ b.name }}</div><div class="fp-muted text-xs">{{ b.address }}</div></td>
            <td>{{ b.sectorName || '—' }}</td>
            <td class="num fp-muted text-xs">{{ b.latitude | number:'1.4-4' }}, {{ b.longitude | number:'1.4-4' }}</td>
            <td class="num text-right">{{ b.geofence_range }} m</td>
            <td><p-toggleswitch [ngModel]="b.is_active" (onChange)="toggle(b)" [disabled]="!auth.canWrite()" [ariaLabel]="(b.is_active ? 'Close ' : 'Open ') + b.name" /></td>
            @if (auth.canWrite()) {
              <td class="text-right"><p-button icon="pi pi-pencil" [text]="true" [rounded]="true" severity="secondary" pTooltip="Edit" [ariaLabel]="'Edit ' + b.name" (onClick)="openForm(b)" /></td>
            }
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="6" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load branches. <p-button label="Retry" [link]="true" (onClick)="load()" /> } @else { No branches match your search. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-drawer [(visible)]="formOpen" position="right" [header]="editingId ? 'Edit branch' : 'New branch'" [style]="{ width: '30rem', maxWidth: '100vw' }">
      <form id="branchForm" class="flex flex-col gap-4" (ngSubmit)="save()" #f="ngForm">
        <div class="flex flex-col gap-2">
          <label for="b-name" class="font-medium">Branch name</label>
          <input pInputText id="b-name" name="name" [(ngModel)]="form.name" required maxlength="120" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="b-address" class="font-medium">Address</label>
          <input pInputText id="b-address" name="address" [(ngModel)]="form.address" required maxlength="200" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="b-sector" class="font-medium">Sector</label>
          <p-select inputId="b-sector" name="sector" [options]="sectors" optionLabel="name" optionValue="id" [(ngModel)]="form.sectorId" placeholder="Select sector" required appendTo="body" />
        </div>

        <fieldset class="border border-surface-200 dark:border-surface-700 rounded-xl p-4 m-0 flex flex-col gap-3">
          <legend class="px-1 font-medium">Location</legend>
          <div class="flex flex-col gap-2">
            <label for="b-link" class="text-sm">Paste a map link or "lat, lng"</label>
            <input pInputText id="b-link" name="link" [(ngModel)]="mapsLink" (ngModelChange)="onLink()" maxlength="2000" autocomplete="off" placeholder="e.g. 39.5012, -98.3504" />
            @if (linkHint) { <small [class.text-red-500]="linkHint.startsWith('Could')" class="fp-muted">{{ linkHint }}</small> }
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-2">
              <label for="b-lat" class="text-sm">Latitude</label>
              <p-inputnumber inputId="b-lat" name="lat" [(ngModel)]="form.latitude" mode="decimal" [minFractionDigits]="4" [maxFractionDigits]="6" [min]="-90" [max]="90" [required]="true" [fluid]="true" />
            </div>
            <div class="flex flex-col gap-2">
              <label for="b-lng" class="text-sm">Longitude</label>
              <p-inputnumber inputId="b-lng" name="lng" [(ngModel)]="form.longitude" mode="decimal" [minFractionDigits]="4" [maxFractionDigits]="6" [min]="-180" [max]="180" [required]="true" [fluid]="true" />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <label for="b-range" class="text-sm">Geofence radius</label>
            <p-inputnumber inputId="b-range" name="range" [(ngModel)]="form.geofence_range" [min]="10" [max]="5000" suffix=" m" [showButtons]="true" [step]="10" [fluid]="true" />
          </div>
        </fieldset>

        <div class="flex items-center gap-3">
          <p-toggleswitch inputId="b-active" name="active" [(ngModel)]="form.is_active" />
          <label for="b-active">Branch open for check-ins</label>
        </div>
      </form>
      <ng-template #footer>
        <div class="flex justify-end gap-2">
          <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="formOpen = false" />
          <p-button (onClick)="save()" label="Save branch" icon="pi pi-check" [loading]="saving"
            [disabled]="!f.valid || form.latitude == null || form.longitude == null || !form.sectorId" />
        </div>
      </ng-template>
    </p-drawer>
  `,
})
export class BranchesComponent extends LazyList<Branch> implements OnInit {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);
  readonly auth = inject(AuthService);

  search = '';
  sectors: Sector[] = [];
  formOpen = false;
  saving = false;
  editingId: number | null = null;
  form: BranchForm = emptyForm();
  mapsLink = '';
  linkHint = '';

  async ngOnInit() {
    if (!this.auth.canWrite()) return;
    try { this.sectors = await this.data.getSectors(); } catch { /* dropdown stays empty */ }
  }

  protected fetch(q: QueryParams) {
    return this.data.getBranches({ ...q, search: this.search });
  }

  openForm(b?: Branch) {
    this.editingId = b?.id ?? null;
    this.mapsLink = '';
    this.linkHint = '';
    this.form = b
      ? { name: b.name, address: b.address ?? '', sectorId: b.sectorId ?? null, latitude: b.latitude ?? null, longitude: b.longitude ?? null,
          geofence_range: b.geofence_range ?? 100, is_active: b.is_active }
      : emptyForm();
    this.formOpen = true;
  }

  onLink() {
    if (!this.mapsLink.trim()) { this.linkHint = ''; return; }
    const c = parseCoords(this.mapsLink);
    if (c) {
      this.form.latitude = c.lat;
      this.form.longitude = c.lng;
      this.linkHint = 'Coordinates filled in from the link.';
    } else {
      this.linkHint = 'Could not find coordinates in that text.';
    }
  }

  async save() {
    if (!this.auth.canWrite()) return;
    this.saving = true;
    try {
      const payload = { ...this.form } as Partial<Branch>;
      if (this.editingId) await this.data.updateBranch(this.editingId, payload);
      else await this.data.createBranch(payload);
      this.toast.add({ severity: 'success', summary: this.editingId ? 'Branch updated' : 'Branch added', detail: this.form.name });
      this.formOpen = false;
      void this.load();
    } catch { /* toast shown by interceptor */ } finally {
      this.saving = false;
    }
  }

  async toggle(b: Branch) {
    try {
      const updated = await this.data.toggleBranchStatus(b.id);
      this.toast.add({ severity: 'success', summary: updated.is_active ? 'Branch opened' : 'Branch closed', detail: b.name });
    } catch { /* toast shown by interceptor */ }
    void this.load();
  }
}
