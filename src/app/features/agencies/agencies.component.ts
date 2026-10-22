import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Agency } from '../../core/models/models';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-agencies',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, InputTextModule, IconFieldModule, InputIconModule, DialogModule, TooltipModule, PageHeaderComponent],
  template: `
    <fp-page-header title="Agencies" description="Staffing partners that employ field staff. Names are kept in English and Arabic.">
      @if (auth.canWrite()) { <p-button icon="pi pi-plus" label="Add agency" (onClick)="openForm()" /> }
    </fp-page-header>

    <div class="fp-panel overflow-hidden max-w-4xl">
      <div class="p-4 border-b border-surface-200 dark:border-surface-700">
        <p-iconfield styleClass="w-full sm:w-72">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText type="search" placeholder="Search agencies" [(ngModel)]="search" (ngModelChange)="searchChanged()" class="w-full" aria-label="Search agencies" maxlength="80" />
        </p-iconfield>
      </div>
      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}" dataKey="id" [rowHover]="true">
        <ng-template #header>
          <tr>
            <th scope="col" class="w-20">ID</th>
            <th scope="col" pSortableColumn="enName">English name <p-sortIcon field="enName" /></th>
            <th scope="col" class="text-right">Arabic name</th>
            @if (auth.canWrite()) { <th scope="col" class="w-28"><span class="sr-only">Actions</span></th> }
          </tr>
        </ng-template>
        <ng-template #body let-a>
          <tr>
            <td class="num fp-muted">{{ a.id }}</td>
            <td class="font-medium">{{ a.enName }}</td>
            <td class="text-right" dir="rtl" lang="ar">{{ a.arName }}</td>
            @if (auth.canWrite()) {
              <td class="text-right whitespace-nowrap">
                <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" severity="secondary" pTooltip="Edit" [ariaLabel]="'Edit ' + a.enName" (onClick)="openForm(a)" />
                <p-button icon="pi pi-trash" [text]="true" [rounded]="true" severity="danger" pTooltip="Delete" [ariaLabel]="'Delete ' + a.enName" (onClick)="remove(a)" />
              </td>
            }
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="4" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load agencies. <p-button label="Retry" [link]="true" (onClick)="load()" /> } @else { No agencies found. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="formOpen" [modal]="true" [draggable]="false" [header]="editingId ? 'Edit agency' : 'Add agency'" [style]="{ width: '28rem' }">
      <form id="agencyForm" class="flex flex-col gap-4" (ngSubmit)="save()" #f="ngForm">
        <div class="flex flex-col gap-2">
          <label for="a-en" class="font-medium">English name</label>
          <input pInputText id="a-en" name="enName" [(ngModel)]="enName" required maxlength="120" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="a-ar" class="font-medium">Arabic name</label>
          <input pInputText id="a-ar" name="arName" [(ngModel)]="arName" required maxlength="120" dir="rtl" lang="ar" autocomplete="off" />
        </div>
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="formOpen = false" />
        <p-button (onClick)="save()" label="Save" icon="pi pi-check" [loading]="saving" [disabled]="!f.valid" />
      </ng-template>
    </p-dialog>
  `,
})
export class AgenciesComponent extends LazyList<Agency> {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly auth = inject(AuthService);

  search = '';
  formOpen = false;
  saving = false;
  editingId: number | null = null;
  enName = '';
  arName = '';

  protected fetch(q: QueryParams) {
    return this.data.getAgencies({ ...q, search: this.search });
  }

  openForm(a?: Agency) {
    this.editingId = a?.id ?? null;
    this.enName = a?.enName ?? '';
    this.arName = a?.arName ?? '';
    this.formOpen = true;
  }

  async save() {
    if (!this.auth.canWrite()) return;
    const enName = this.enName.trim();
    const arName = this.arName.trim();
    this.saving = true;
    try {
      if (this.editingId) await this.data.updateAgency(this.editingId, { id: this.editingId, enName, arName });
      else await this.data.createAgency({ enName, arName });
      this.toast.add({ severity: 'success', summary: this.editingId ? 'Agency updated' : 'Agency added', detail: enName });
      this.formOpen = false;
      void this.load();
    } catch { /* toast shown by interceptor */ } finally {
      this.saving = false;
    }
  }

  remove(a: Agency) {
    this.confirm.confirm({
      header: 'Delete agency?',
      message: `${a.enName} will be removed. Agencies with staff assigned cannot be deleted.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        try {
          await this.data.deleteAgency(a.id);
          this.toast.add({ severity: 'success', summary: 'Agency deleted', detail: a.enName });
          void this.load();
        } catch { /* toast shown by interceptor */ }
      },
    });
  }
}
