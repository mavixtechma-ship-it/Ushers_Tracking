import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { Invoice, InvoicePage, PagedResult } from '../../core/models/models';
import { downloadCsv, fmtDateTime } from '../../core/util/csv';
import { rangeParams } from '../../core/util/dates';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, TableModule, ButtonModule, DatePickerModule, InputTextModule, IconFieldModule, InputIconModule,
    DialogModule, PageHeaderComponent, KpiTileComponent],
  template: `
    <fp-page-header title="Sales" description="In-store invoices recorded by field staff.">
      <p-button icon="pi pi-download" label="Export CSV" severity="secondary" [outlined]="true" [loading]="exporting" (onClick)="export()" />
    </fp-page-header>

    <div class="fp-panel p-4 mb-5 flex flex-wrap items-center gap-3 sticky top-[72px] z-10">
      <p-iconfield styleClass="w-full sm:w-56">
        <p-inputicon styleClass="pi pi-user" />
        <input pInputText type="search" placeholder="Staff name" [(ngModel)]="usher" (ngModelChange)="searchChanged()" class="w-full" aria-label="Filter by staff" maxlength="80" />
      </p-iconfield>
      <p-iconfield styleClass="w-full sm:w-56">
        <p-inputicon styleClass="pi pi-map-marker" />
        <input pInputText type="search" placeholder="Branch" [(ngModel)]="location" (ngModelChange)="searchChanged()" class="w-full" aria-label="Filter by branch" maxlength="80" />
      </p-iconfield>
      <p-datepicker [(ngModel)]="range" selectionMode="range" [readonlyInput]="true" placeholder="Date range" [showIcon]="true"
        [showButtonBar]="true" dateFormat="M d" (ngModelChange)="onRange()" styleClass="w-full sm:w-60" ariaLabel="Date range" />
    </div>

    <div class="fp-grid mb-5">
      <div class="fp-col-4"><fp-kpi label="Revenue" icon="pi-wallet" [loading]="!summary" [value]="summary ? (summary.revenue | number:'1.2-2') : null" hint="Matching invoices" /></div>
      <div class="fp-col-4"><fp-kpi label="Units sold" icon="pi-box" tone="neutral" [loading]="!summary" [value]="summary?.units ?? null" /></div>
      <div class="fp-col-4"><fp-kpi label="Average ticket" icon="pi-receipt" tone="neutral" [loading]="!summary" [value]="summary ? (summary.avgTicket | number:'1.2-2') : null" /></div>
    </div>

    <div class="fp-panel overflow-hidden">
      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [rowsPerPageOptions]="[10, 25, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}"
        dataKey="invoiceId" [rowHover]="true" [tableStyle]="{ 'min-width': '56rem' }" sortField="createdAt" [sortOrder]="-1">
        <ng-template #header>
          <tr>
            <th scope="col" pSortableColumn="invoiceId">Invoice <p-sortIcon field="invoiceId" /></th>
            <th scope="col" pSortableColumn="usherName">Staff <p-sortIcon field="usherName" /></th>
            <th scope="col">Product</th>
            <th scope="col" class="text-right" pSortableColumn="quantity">Qty <p-sortIcon field="quantity" /></th>
            <th scope="col" class="text-right" pSortableColumn="totalPrice">Total <p-sortIcon field="totalPrice" /></th>
            <th scope="col">Branch</th>
            <th scope="col" pSortableColumn="createdAt">Date <p-sortIcon field="createdAt" /></th>
          </tr>
        </ng-template>
        <ng-template #body let-inv>
          <tr class="cursor-pointer" (click)="detail = inv" tabindex="0" (keydown.enter)="detail = inv">
            <td class="num font-medium text-primary">#{{ inv.invoiceId }}</td>
            <td>{{ inv.usherName }}</td>
            <td>{{ inv.productName }}</td>
            <td class="num text-right">{{ inv.quantity }}</td>
            <td class="num text-right font-medium">{{ inv.totalPrice | number:'1.2-2' }}</td>
            <td>{{ inv.location }}</td>
            <td class="num fp-muted">{{ inv.createdAt | date:'MMM d, HH:mm' }}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="7" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load invoices. <p-button label="Retry" [link]="true" (onClick)="load()" /> } @else { No invoices match these filters. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [visible]="!!detail" (visibleChange)="!$event && (detail = null)" [modal]="true" [draggable]="false" [dismissableMask]="true"
      [header]="'Invoice #' + (detail?.invoiceId ?? '')" [style]="{ width: '30rem' }">
      @if (detail; as d) {
        <div class="text-center py-4 mb-4 rounded-xl bg-primary-50 dark:bg-surface-800">
          <div class="fp-label">Total</div>
          <div class="num text-4xl font-semibold text-primary">{{ d.totalPrice | number:'1.2-2' }}</div>
          <div class="fp-muted text-sm">{{ d.quantity }} × {{ d.productName }}</div>
        </div>
        <dl class="grid grid-cols-2 gap-4 m-0">
          <div><dt class="fp-label">Staff</dt><dd class="m-0 mt-1">{{ d.usherName }}</dd></div>
          <div><dt class="fp-label">Branch</dt><dd class="m-0 mt-1">{{ d.location }}</dd></div>
          <div><dt class="fp-label">Recorded</dt><dd class="m-0 mt-1 num">{{ d.createdAt | date:'medium' }}</dd></div>
          <div><dt class="fp-label">Product code</dt><dd class="m-0 mt-1 num">P-{{ d.productId }}</dd></div>
        </dl>
      }
    </p-dialog>
  `,
})
export class InvoicesComponent extends LazyList<Invoice> {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);

  usher = '';
  location = '';
  range: Date[] | null = null;
  summary: InvoicePage['summary'] | null = null;
  detail: Invoice | null = null;
  exporting = false;

  onRange() {
    if (!this.range || this.range[1] || !this.range[0]) this.refilter();
  }

  protected fetch(q: QueryParams) {
    return this.data.getInvoices({ ...q, usherName: this.usher, location: this.location, ...rangeParams(this.range) });
  }

  protected override afterLoad(res: PagedResult<Invoice>) {
    this.summary = (res as InvoicePage).summary;
  }

  async export() {
    this.exporting = true;
    try {
      const items = await this.fetchAll();
      if (!items.length) { this.toast.add({ severity: 'info', summary: 'Nothing to export' }); return; }
      downloadCsv('invoices', ['Invoice ID', 'Staff', 'Product', 'Quantity', 'Total', 'Branch', 'Date'],
        items.map((i) => [i.invoiceId, i.usherName ?? '', i.productName ?? '', i.quantity ?? '', i.totalPrice?.toFixed(2) ?? '', i.location ?? '', fmtDateTime(i.createdAt)]));
      this.toast.add({ severity: 'success', summary: 'Export ready', detail: `${items.length} invoices exported.` });
    } catch { /* toast shown by interceptor */ } finally {
      this.exporting = false;
    }
  }
}
