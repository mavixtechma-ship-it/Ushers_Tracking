import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DrawerModule } from 'primeng/drawer';
import { AvatarModule } from 'primeng/avatar';
import { ImageModule } from 'primeng/image';
import { TimelineModule } from 'primeng/timeline';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { BreakItem, SessionLog } from '../../core/models/models';
import { downloadCsv, fmtDateTime } from '../../core/util/csv';
import { minutesToHours, rangeParams } from '../../core/util/dates';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { InitialsPipe } from '../../shared/ui/initials.pipe';

/** Only local, generated placeholder photos are displayed. */
const safePhoto = (url?: string | null) => (url && /^assets\/mock\/photos\/[\w-]+\.svg$/.test(url) ? url : null);

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, ButtonModule, SelectModule, DatePickerModule, InputTextModule, IconFieldModule, InputIconModule,
    DrawerModule, AvatarModule, ImageModule, TimelineModule, SkeletonModule, PageHeaderComponent, StatusPillComponent, InitialsPipe],
  template: `
    <fp-page-header title="Shift sessions" description="Check-in and check-out records from the field app.">
      <p-button icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true" [loading]="exporting" (onClick)="export()" />
    </fp-page-header>

    <div class="fp-panel overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
        <p-iconfield styleClass="w-full sm:w-64">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText type="search" placeholder="Staff or branch" [(ngModel)]="search" (ngModelChange)="searchChanged()" class="w-full" aria-label="Search sessions" maxlength="80" />
        </p-iconfield>
        <p-datepicker [(ngModel)]="range" selectionMode="range" [readonlyInput]="true" placeholder="Date range" [showIcon]="true"
          [showButtonBar]="true" dateFormat="M d" (ngModelChange)="onRange()" styleClass="w-full sm:w-60" ariaLabel="Date range" />
        <p-select [options]="statusOptions" [(ngModel)]="status" (ngModelChange)="refilter()" placeholder="Any status" [showClear]="true" styleClass="w-full sm:w-44" ariaLabel="Status" />
        <p-select [options]="agencies" [(ngModel)]="agency" (ngModelChange)="refilter()" placeholder="Any agency" [showClear]="true" styleClass="w-full sm:w-56" ariaLabel="Agency" />
      </div>

      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [rowsPerPageOptions]="[10, 25, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}"
        dataKey="id" [rowHover]="true" [tableStyle]="{ 'min-width': '64rem' }" sortField="check_in_time" [sortOrder]="-1">
        <ng-template #header>
          <tr>
            <th scope="col" pSortableColumn="usherName">Staff <p-sortIcon field="usherName" /></th>
            <th scope="col" pSortableColumn="branchName">Branch <p-sortIcon field="branchName" /></th>
            <th scope="col" pSortableColumn="check_in_time">Checked in <p-sortIcon field="check_in_time" /></th>
            <th scope="col">Checked out</th>
            <th scope="col" class="text-right" pSortableColumn="duration">Worked <p-sortIcon field="duration" /></th>
            <th scope="col" class="text-right">Breaks</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </ng-template>
        <ng-template #body let-s>
          <tr>
            <td>
              <div class="flex items-center gap-3">
                <p-avatar [label]="s.usherName | initials" shape="circle" />
                <div><div class="font-medium">{{ s.usherName }}</div><div class="fp-muted text-xs">{{ s.agency || '—' }}</div></div>
              </div>
            </td>
            <td><div>{{ s.branchName }}</div><div class="fp-muted text-xs">{{ s.sectorName || '' }}</div></td>
            <td class="num">{{ s.check_in_time | date:'MMM d, HH:mm' }}</td>
            <td class="num">{{ s.check_out_time ? (s.check_out_time | date:'MMM d, HH:mm') : '—' }}</td>
            <td class="num text-right">{{ hours(s.duration) }}</td>
            <td class="num text-right">{{ s.BreaksDuration ? s.BreaksDuration + ' min' : '—' }}</td>
            <td><fp-status [text]="s.status === 'Active' ? 'On shift' : 'Completed'" [tone]="s.status === 'Active' ? 'ok' : 'neutral'" /></td>
            <td class="text-right"><p-button icon="pi pi-angle-right" [text]="true" [rounded]="true" ariaLabel="View session" (onClick)="open(s)" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="8" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load sessions. <p-button label="Retry" [link]="true" (onClick)="load()" /> }
            @else { No sessions match these filters. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-drawer [(visible)]="drawerOpen" position="right" [header]="'Session #' + (detail?.id ?? '')" [style]="{ width: '34rem', maxWidth: '100vw' }">
      @if (detail; as d) {
        <div class="flex items-center gap-3 mb-5">
          <p-avatar [label]="d.usherName | initials" shape="circle" size="large" />
          <div class="flex-1">
            <div class="text-lg font-semibold">{{ d.usherName }}</div>
            <div class="fp-muted text-sm">{{ d.branchName }} · {{ d.agency || 'No agency' }}</div>
          </div>
          <fp-status [text]="d.status === 'Active' ? 'On shift' : 'Completed'" [tone]="d.status === 'Active' ? 'ok' : 'neutral'" />
        </div>

        <dl class="grid grid-cols-2 gap-4 m-0 mb-6">
          <div><dt class="fp-label">Checked in</dt><dd class="m-0 mt-1 num">{{ d.check_in_time | date:'medium' }}</dd></div>
          <div><dt class="fp-label">Checked out</dt><dd class="m-0 mt-1 num">{{ d.check_out_time ? (d.check_out_time | date:'medium') : 'Still on shift' }}</dd></div>
          <div><dt class="fp-label">Worked</dt><dd class="m-0 mt-1 num">{{ hours(d.duration) }}</dd></div>
          <div><dt class="fp-label">Breaks</dt><dd class="m-0 mt-1 num">{{ d.BreaksDuration ? d.BreaksDuration + ' min' : '—' }}</dd></div>
          @if (d.reason) { <div class="col-span-2"><dt class="fp-label">Note</dt><dd class="m-0 mt-1">{{ d.reason }}</dd></div> }
        </dl>

        <h3 class="text-sm font-semibold mb-3">Photo proof</h3>
        <div class="grid grid-cols-2 gap-3 mb-6">
          @for (p of [{ label: 'Check-in', url: photo(d.check_in_photo_url) }, { label: 'Check-out', url: photo(d.check_out_photo_url) }]; track p.label) {
            <figure class="m-0">
              @if (p.url) {
                <p-image [src]="p.url" [alt]="p.label + ' photo'" [preview]="true" imageClass="w-full rounded-lg aspect-[4/3] object-cover" />
              } @else {
                <div class="rounded-lg aspect-[4/3] grid place-items-center bg-surface-100 dark:bg-surface-800 fp-muted text-sm">No photo</div>
              }
              <figcaption class="fp-muted text-xs mt-1">{{ p.label }}</figcaption>
            </figure>
          }
        </div>

        <h3 class="text-sm font-semibold mb-3">Breaks</h3>
        @if (breaksLoading) { <p-skeleton height="4rem" /> }
        @else if (breaks.length === 0) { <p class="fp-muted m-0">No breaks taken.</p> }
        @else {
          <p-timeline [value]="breaks" styleClass="fp-timeline">
            <ng-template #content let-b>
              <div class="font-medium">{{ b.break_type }} break</div>
              <div class="fp-muted text-xs num">{{ b.start_time | date:'shortTime' }} – {{ b.end_time ? (b.end_time | date:'shortTime') : 'in progress' }}
                {{ b.duration ? '· ' + b.duration + ' min' : '' }}</div>
              @if (b.reason) { <div class="text-xs mt-1">{{ b.reason }}</div> }
            </ng-template>
          </p-timeline>
        }
      }
    </p-drawer>
  `,
  styles: [`:host ::ng-deep .fp-timeline .p-timeline-event-opposite { display: none; }`],
})
export class SessionsComponent extends LazyList<SessionLog> implements OnInit {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);
  private readonly route = inject(ActivatedRoute);

  search = '';
  status: string | null = null;
  agency: string | null = null;
  range: Date[] | null = null;
  agencies: string[] = [];
  readonly statusOptions = [{ label: 'On shift', value: 'Active' }, { label: 'Completed', value: 'COMPLETED' }];

  drawerOpen = false;
  detail: SessionLog | null = null;
  breaks: BreakItem[] = [];
  breaksLoading = false;
  exporting = false;

  readonly hours = minutesToHours;
  readonly photo = safePhoto;

  async ngOnInit() {
    const s = this.route.snapshot.queryParamMap.get('status');
    if (s === 'Active' || s === 'COMPLETED') this.status = s;
    try { this.agencies = (await this.data.getAllAgencies()).items.map((a) => a.enName); } catch { /* filter stays empty */ }
  }

  onRange() {
    if (!this.range || this.range[1] || !this.range[0]) this.refilter();
  }

  private filters(): QueryParams {
    return { search: this.search, status: this.status, agency: this.agency, ...rangeParams(this.range) };
  }

  protected fetch(q: QueryParams) {
    return this.data.getSessions({ ...q, ...this.filters() });
  }

  async open(s: SessionLog) {
    this.detail = s;
    this.drawerOpen = true;
    this.breaks = [];
    this.breaksLoading = true;
    try {
      const [full, breaks] = await Promise.all([this.data.getSessionById(s.id), this.data.getSessionBreaks(s.id)]);
      this.detail = full;
      this.breaks = breaks;
    } catch { /* toast shown by interceptor */ } finally {
      this.breaksLoading = false;
    }
  }

  async export() {
    this.exporting = true;
    try {
      const items = await this.fetchAll();
      if (!items.length) { this.toast.add({ severity: 'info', summary: 'Nothing to export' }); return; }
      downloadCsv('sessions',
        ['Session ID', 'Staff', 'Branch', 'Agency', 'Sector', 'Checked in', 'Checked out', 'Worked (hours)', 'Breaks (min)', 'Status', 'Note'],
        items.map((s) => [s.id, s.usherName, s.branchName, s.agency ?? '', s.sectorName ?? '', fmtDateTime(s.check_in_time), fmtDateTime(s.check_out_time),
          s.duration != null ? (s.duration / 60).toFixed(2) : '', s.BreaksDuration ?? '', s.status, s.reason ?? '']));
      this.toast.add({ severity: 'success', summary: 'Export ready', detail: `${items.length} sessions exported.` });
    } catch { /* toast shown by interceptor */ } finally {
      this.exporting = false;
    }
  }
}
