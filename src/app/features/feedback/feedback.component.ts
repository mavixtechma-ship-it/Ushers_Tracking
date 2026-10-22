import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MeterGroupModule, MeterItem } from 'primeng/metergroup';
import { MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { Feedback, FeedbackPage, PagedResult } from '../../core/models/models';
import { downloadCsv, fmtDateTime } from '../../core/util/csv';
import { rangeParams } from '../../core/util/dates';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { Tone } from '../../shared/ui/kpi-tile.component';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [DatePipe, FormsModule, TableModule, ButtonModule, DatePickerModule, SelectButtonModule, MeterGroupModule, PageHeaderComponent, StatusPillComponent],
  template: `
    <fp-page-header title="Feedback" description="Notes supervisors leave after visiting staff in store.">
      <p-button icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true" [loading]="exporting" (onClick)="export()" />
    </fp-page-header>

    <section class="fp-panel p-5 mb-5">
      <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 class="text-base font-semibold m-0">Sentiment mix</h2>
        <span class="fp-muted text-xs">{{ sentimentTotal }} notes in range</span>
      </div>
      <p-metergroup [value]="meter" [max]="sentimentTotal || 1" labelPosition="end" />
    </section>

    <div class="fp-panel overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
        <p-selectbutton [options]="typeOptions" [(ngModel)]="type" (ngModelChange)="refilter()" optionLabel="label" optionValue="value" [allowEmpty]="false" />
        <p-datepicker [(ngModel)]="range" selectionMode="range" [readonlyInput]="true" placeholder="Date range" [showIcon]="true"
          [showButtonBar]="true" dateFormat="M d" (ngModelChange)="onRange()" styleClass="w-full sm:w-60" ariaLabel="Date range" />
      </div>

      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [rowsPerPageOptions]="[10, 25, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}"
        dataKey="id" [tableStyle]="{ 'min-width': '56rem' }" sortField="createdAt" [sortOrder]="-1">
        <ng-template #header>
          <tr>
            <th scope="col" class="w-32">Tone</th>
            <th scope="col">Note</th>
            <th scope="col" pSortableColumn="usherName">Staff <p-sortIcon field="usherName" /></th>
            <th scope="col">From</th>
            <th scope="col" pSortableColumn="createdAt">Date <p-sortIcon field="createdAt" /></th>
          </tr>
        </ng-template>
        <ng-template #body let-fb>
          <tr>
            <td><fp-status [text]="fb.feedbackType" [tone]="tone(fb.feedbackType)" /></td>
            <td class="max-w-md">{{ fb.comment }}</td>
            <td><div class="font-medium">{{ fb.usherName }}</div><div class="fp-muted text-xs">{{ fb.branchName }}</div></td>
            <td>{{ fb.supervisorName }}</td>
            <td class="num fp-muted whitespace-nowrap">{{ fb.createdAt | date:'MMM d, HH:mm' }}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="5" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load feedback. <p-button label="Retry" [link]="true" (onClick)="load()" /> } @else { No feedback matches these filters. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class FeedbackComponent extends LazyList<Feedback> {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);

  type = '';
  range: Date[] | null = null;
  meter: MeterItem[] = [];
  sentimentTotal = 0;
  exporting = false;
  readonly typeOptions = [
    { label: 'All', value: '' }, { label: 'Positive', value: 'Positive' }, { label: 'Neutral', value: 'Neutral' }, { label: 'Negative', value: 'Negative' },
  ];

  tone(t?: string): Tone {
    return t === 'Positive' ? 'ok' : t === 'Negative' ? 'err' : 'neutral';
  }

  onRange() {
    if (!this.range || this.range[1] || !this.range[0]) this.refilter();
  }

  protected fetch(q: QueryParams) {
    return this.data.getFeedback({ ...q, feedbackType: this.type, ...rangeParams(this.range) });
  }

  protected override afterLoad(res: PagedResult<Feedback>) {
    const b = (res as FeedbackPage).breakdown;
    const css = getComputedStyle(document.documentElement);
    const c = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
    this.sentimentTotal = b.Positive + b.Neutral + b.Negative;
    this.meter = [
      { label: 'Positive', value: b.Positive, color: c('--fp-ok', '#059669') },
      { label: 'Neutral', value: b.Neutral, color: c('--p-surface-400', '#a3a2bd') },
      { label: 'Negative', value: b.Negative, color: c('--fp-err', '#dc2626') },
    ];
  }

  async export() {
    this.exporting = true;
    try {
      const items = await this.fetchAll();
      if (!items.length) { this.toast.add({ severity: 'info', summary: 'Nothing to export' }); return; }
      downloadCsv('feedback', ['ID', 'Tone', 'Note', 'Staff', 'Branch', 'Supervisor', 'Date'],
        items.map((f) => [f.id, f.feedbackType ?? '', f.comment ?? '', f.usherName ?? '', f.branchName ?? '', f.supervisorName ?? '', fmtDateTime(f.createdAt)]));
      this.toast.add({ severity: 'success', summary: 'Export ready', detail: `${items.length} notes exported.` });
    } catch { /* toast shown by interceptor */ } finally {
      this.exporting = false;
    }
  }
}
