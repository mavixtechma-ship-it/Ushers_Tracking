import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DialogModule } from 'primeng/dialog';
import { AvatarModule } from 'primeng/avatar';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { Supervisor, Usher } from '../../core/models/models';
import { relativeTime } from '../../core/util/dates';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { InitialsPipe } from '../../shared/ui/initials.pipe';
import { TempPasswordDialogComponent } from '../../shared/ui/temp-password-dialog.component';

interface UsherForm { name: string; phone: string; email: string; agency: string | null; supervisor_id: number | null; is_active: boolean; }
const emptyForm = (): UsherForm => ({ name: '', phone: '', email: '', agency: null, supervisor_id: null, is_active: true });

@Component({
  selector: 'app-ushers',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, SelectModule, InputTextModule, IconFieldModule, InputIconModule, DialogModule, AvatarModule,
    ToggleSwitchModule, TooltipModule, PageHeaderComponent, StatusPillComponent, InitialsPipe, TempPasswordDialogComponent],
  template: `
    <fp-page-header title="Field staff" description="Promoters who check in at branches through the mobile app.">
      @if (auth.canWrite()) { <p-button icon="pi pi-plus" label="Add staff member" (onClick)="openForm()" /> }
    </fp-page-header>

    <div class="fp-panel overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
        <p-iconfield styleClass="w-full sm:w-72">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText type="search" placeholder="Name, phone, email or agency" [(ngModel)]="search" (ngModelChange)="searchChanged()" class="w-full" aria-label="Search staff" maxlength="80" />
        </p-iconfield>
        <p-select [options]="statusOptions" [(ngModel)]="status" (ngModelChange)="refilter()" placeholder="Any status" [showClear]="true" styleClass="w-full sm:w-48" ariaLabel="Status" />
      </div>

      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [rowsPerPageOptions]="[10, 25, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}"
        dataKey="id" [rowHover]="true" [tableStyle]="{ 'min-width': '60rem' }">
        <ng-template #header>
          <tr>
            <th scope="col" pSortableColumn="name">Name <p-sortIcon field="name" /></th>
            <th scope="col">Contact</th>
            <th scope="col" pSortableColumn="agency">Agency <p-sortIcon field="agency" /></th>
            <th scope="col">Presence</th>
            <th scope="col" pSortableColumn="last_seen">Last seen <p-sortIcon field="last_seen" /></th>
            <th scope="col">Active</th>
            @if (auth.canWrite()) { <th scope="col"><span class="sr-only">Actions</span></th> }
          </tr>
        </ng-template>
        <ng-template #body let-u>
          <tr [class.opacity-60]="!u.is_active">
            <td>
              <div class="flex items-center gap-3">
                <p-avatar [label]="u.name | initials" shape="circle" />
                <div><div class="font-medium">{{ u.name }}</div><div class="fp-muted text-xs num">ID {{ u.id }}</div></div>
              </div>
            </td>
            <td><div class="num">{{ u.phone || '—' }}</div><div class="fp-muted text-xs">{{ u.email || '' }}</div></td>
            <td>{{ u.agency || '—' }}</td>
            <td><fp-status [text]="u.is_online ? 'On shift' : 'Off shift'" [tone]="u.is_online ? 'ok' : 'neutral'" /></td>
            <td class="fp-muted" [title]="u.last_seen || ''">{{ rel(u.last_seen) }}</td>
            <td>
              <p-toggleswitch [ngModel]="u.is_active" (onChange)="toggle(u)" [disabled]="!auth.canWrite()"
                [ariaLabel]="(u.is_active ? 'Deactivate ' : 'Activate ') + u.name" />
            </td>
            @if (auth.canWrite()) {
              <td class="text-right whitespace-nowrap">
                <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" severity="secondary" pTooltip="Edit" [ariaLabel]="'Edit ' + u.name" (onClick)="openForm(u)" />
                <p-button icon="pi pi-key" [text]="true" [rounded]="true" severity="secondary" pTooltip="Reset password" [ariaLabel]="'Reset password for ' + u.name" (onClick)="resetPw(u)" />
              </td>
            }
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="7" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load staff. <p-button label="Retry" [link]="true" (onClick)="load()" /> } @else { No staff match these filters. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="formOpen" [modal]="true" [draggable]="false" [header]="editingId ? 'Edit staff member' : 'Add staff member'" [style]="{ width: '34rem' }">
      <form id="usherForm" class="grid grid-cols-1 sm:grid-cols-2 gap-4" (ngSubmit)="save()" #f="ngForm">
        <div class="sm:col-span-2 flex flex-col gap-2">
          <label for="u-name" class="font-medium">Full name</label>
          <input pInputText id="u-name" name="name" [(ngModel)]="form.name" required maxlength="120" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="u-phone" class="font-medium">Phone</label>
          <input pInputText id="u-phone" name="phone" type="tel" [(ngModel)]="form.phone" required minlength="6" maxlength="30" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="u-email" class="font-medium">Email <span class="fp-muted font-normal">(optional)</span></label>
          <input pInputText id="u-email" name="email" type="email" [(ngModel)]="form.email" maxlength="160" email />
        </div>
        <div class="flex flex-col gap-2">
          <label for="u-agency" class="font-medium">Agency</label>
          <p-select inputId="u-agency" name="agency" [options]="agencies" [(ngModel)]="form.agency" placeholder="Select agency" [showClear]="true" appendTo="body" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="u-sup" class="font-medium">Supervisor</label>
          <p-select inputId="u-sup" name="supervisor" [options]="supervisors" optionLabel="name" optionValue="id" [(ngModel)]="form.supervisor_id"
            placeholder="Select supervisor" [showClear]="true" [filter]="true" appendTo="body" />
        </div>
        <div class="sm:col-span-2 flex items-center gap-3">
          <p-toggleswitch inputId="u-active" name="active" [(ngModel)]="form.is_active" />
          <label for="u-active">Account active</label>
        </div>
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="formOpen = false" />
        <p-button (onClick)="save()" label="Save" icon="pi pi-check" [loading]="saving" [disabled]="!f.valid" />
      </ng-template>
    </p-dialog>

    <fp-temp-password-dialog [(password)]="tempPassword" [forName]="tempFor" />
  `,
})
export class UshersComponent extends LazyList<Usher> implements OnInit {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly auth = inject(AuthService);

  search = '';
  status: string | null = null;
  readonly statusOptions = [
    { label: 'On shift', value: 'online' }, { label: 'Off shift', value: 'offline' },
    { label: 'Active accounts', value: 'active' }, { label: 'Inactive accounts', value: 'inactive' },
  ];
  agencies: string[] = [];
  supervisors: Supervisor[] = [];

  formOpen = false;
  saving = false;
  editingId: number | null = null;
  form: UsherForm = emptyForm();
  tempPassword: string | null = null;
  tempFor = '';

  readonly rel = relativeTime;

  async ngOnInit() {
    if (!this.auth.canWrite()) return;
    try {
      const [a, s] = await Promise.all([this.data.getAllAgencies(), this.data.getSupervisors()]);
      this.agencies = a.items.map((x) => x.enName);
      this.supervisors = s;
    } catch { /* dropdowns stay empty */ }
  }

  protected fetch(q: QueryParams) {
    return this.data.getUshers({ ...q, search: this.search, status: this.status });
  }

  openForm(u?: Usher) {
    this.editingId = u?.id ?? null;
    this.form = u
      ? { name: u.name, phone: u.phone ?? '', email: u.email ?? '', agency: u.agency ?? null, supervisor_id: u.supervisor_id ?? null, is_active: u.is_active }
      : emptyForm();
    this.formOpen = true;
  }

  async save() {
    if (!this.auth.canWrite()) return;
    this.saving = true;
    const payload: Partial<Usher> = { ...this.form, email: this.form.email || null };
    try {
      if (this.editingId) {
        await this.data.updateUsher(this.editingId, payload);
        this.toast.add({ severity: 'success', summary: 'Saved', detail: `${this.form.name} was updated.` });
      } else {
        const created = await this.data.createUsher(payload);
        this.tempFor = created.name;
        this.tempPassword = created.temporaryPassword;
        this.toast.add({ severity: 'success', summary: 'Staff member added', detail: `${created.name} can now sign in to the field app.` });
      }
      this.formOpen = false;
      void this.load();
    } catch { /* toast shown by interceptor */ } finally {
      this.saving = false;
    }
  }

  async toggle(u: Usher) {
    try {
      const updated = await this.data.toggleUsherStatus(u.id);
      this.toast.add({ severity: 'success', summary: updated.is_active ? 'Activated' : 'Deactivated', detail: u.name });
    } catch { /* toast shown by interceptor */ }
    void this.load();
  }

  resetPw(u: Usher) {
    this.confirm.confirm({
      header: 'Reset password?',
      message: `A new random temporary password will be generated for ${u.name}. Their current password stops working immediately.`,
      icon: 'pi pi-key',
      acceptLabel: 'Generate password',
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        try {
          const res = await this.data.resetPassword(u.id, 'Usher');
          this.tempFor = u.name;
          this.tempPassword = res.temporaryPassword;
        } catch { /* toast shown by interceptor */ }
      },
    });
  }
}
