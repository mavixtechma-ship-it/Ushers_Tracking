import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { SupervisorLog } from '../../core/models/models';
import { downloadCsv, fmtDateTime } from '../../core/util/csv';
import { minutesToHours, rangeParams } from '../../core/util/dates';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';

@Component({
  selector: 'app-supervisor-logs',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, ButtonModule, SelectModule, DatePickerModule, InputTextModule, IconFieldModule, InputIconModule,
    PageHeaderComponent, StatusPillComponent],
  template: `
    <fp-page-header title="Supervisor visits" description="Branch visits logged by area supervisors.">
      <p-button icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true" [loading]="exporting" (onClick)="export()" />
    </fp-page-header>

    <div class="fp-panel overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
        <p-iconfield styleClass="w-full sm:w-64">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText type="search" placeholder="Supervisor or branch" [(ngModel)]="search" (ngModelChange)="searchChanged()" class="w-full" aria-label="Search visits" maxlength="80" />
        </p-iconfield>
        <p-datepicker [(ngModel)]="range" selectionMode="range" [readonlyInput]="true" placeholder="Date range" [showIcon]="true"
          [showButtonBar]="true" dateFormat="M d" (ngModelChange)="onRange()" styleClass="w-full sm:w-60" ariaLabel="Date range" />
        <p-select [options]="statusOptions" [(ngModel)]="status" (ngModelChange)="refilter()" placeholder="Any status" [showClear]="true" styleClass="w-full sm:w-44" ariaLabel="Status" />
      </div>

      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [rowsPerPageOptions]="[10, 25, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}"
        dataKey="id" [rowHover]="true" [tableStyle]="{ 'min-width': '52rem' }" sortField="startTime" [sortOrder]="-1">
        <ng-template #header>
          <tr>
            <th scope="col" class="w-24">Visit</th>
            <th scope="col" pSortableColumn="supervisorName">Supervisor <p-sortIcon field="supervisorName" /></th>
            <th scope="col" pSortableColumn="branchName">Branch <p-sortIcon field="branchName" /></th>
            <th scope="col" pSortableColumn="startTime">Arrived <p-sortIcon field="startTime" /></th>
            <th scope="col">Left</th>
            <th scope="col" class="text-right">Time on site</th>
            <th scope="col">Status</th>
          </tr>
        </ng-template>
        <ng-template #body let-log>
          <tr>
            <td class="num fp-muted">#{{ log.id }}</td>
            <td class="font-medium">{{ log.supervisorName }}</td>
            <td>{{ log.branchName }}</td>
            <td class="num">{{ log.startTime | date:'MMM d, HH:mm' }}</td>
            <td class="num">{{ log.endTime ? (log.endTime | date:'HH:mm') : '—' }}</td>
            <td class="num text-right">{{ hours(log.duration) }}</td>
            <td><fp-status [text]="log.status === 'Active' ? 'On site' : 'Completed'" [tone]="log.status === 'Active' ? 'primary' : 'neutral'" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="7" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load visits. <p-button label="Retry" [link]="true" (onClick)="load()" /> } @else { No visits match these filters. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class SupervisorLogsComponent extends LazyList<SupervisorLog> {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);

  search = '';
  status: string | null = null;
  range: Date[] | null = null;
  exporting = false;
  readonly statusOptions = [{ label: 'On site', value: 'Active' }, { label: 'Completed', value: 'COMPLETED' }];
  readonly hours = minutesToHours;

  onRange() {
    if (!this.range || this.range[1] || !this.range[0]) this.refilter();
  }

  protected fetch(q: QueryParams) {
    return this.data.getSupervisorLogs({ ...q, search: this.search, status: this.status, ...rangeParams(this.range) });
  }

  async export() {
    this.exporting = true;
    try {
      const items = await this.fetchAll();
      if (!items.length) { this.toast.add({ severity: 'info', summary: 'Nothing to export' }); return; }
      downloadCsv('supervisor_visits', ['Visit ID', 'Supervisor', 'Branch', 'Arrived', 'Left', 'Time on site (hours)', 'Status'],
        items.map((l) => [l.id, l.supervisorName, l.branchName, fmtDateTime(l.startTime), fmtDateTime(l.endTime),
          l.duration != null ? (l.duration / 60).toFixed(2) : '', l.status ?? '']));
      this.toast.add({ severity: 'success', summary: 'Export ready', detail: `${items.length} visits exported.` });
    } catch { /* toast shown by interceptor */ } finally {
      this.exporting = false;
    }
  }
}
