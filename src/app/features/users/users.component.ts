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
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { PickListModule } from 'primeng/picklist';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DataService, QueryParams } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { AppUser, Branch } from '../../core/models/models';
import { LazyList } from '../../shared/ui/lazy-list';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { InitialsPipe } from '../../shared/ui/initials.pipe';
import { TempPasswordDialogComponent } from '../../shared/ui/temp-password-dialog.component';

interface UserForm { name: string; email: string; phone: string; role: string | null; title: string; agency: string | null; is_active: boolean; }
const emptyForm = (): UserForm => ({ name: '', email: '', phone: '', role: null, title: '', agency: null, is_active: true });

const ROLE_LABELS: Record<string, string> = {
  SuperAdmin: 'Super admin', Admin: 'Admin', SupervisorAdmin: 'Supervisor lead', Supervisor: 'Supervisor', FI: 'Field inspector', Sales: 'Sales',
};

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, TableModule, ButtonModule, SelectModule, InputTextModule, IconFieldModule, InputIconModule, DialogModule, AvatarModule, TagModule,
    ToggleSwitchModule, TooltipModule, PickListModule, PageHeaderComponent, InitialsPipe, TempPasswordDialogComponent],
  template: `
    <fp-page-header title="User accounts" description="Back-office users, their roles and supervisor branch coverage.">
      @if (auth.canWrite()) { <p-button icon="pi pi-user-plus" label="Invite user" (onClick)="openForm()" /> }
    </fp-page-header>

    <div class="fp-panel overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
        <p-iconfield styleClass="w-full sm:w-72">
          <p-inputicon styleClass="pi pi-search" />
          <input pInputText type="search" placeholder="Name, email or phone" [(ngModel)]="search" (ngModelChange)="searchChanged()" class="w-full" aria-label="Search users" maxlength="80" />
        </p-iconfield>
        <p-select [options]="roleOptions" [(ngModel)]="role" (ngModelChange)="refilter()" placeholder="Any role" [showClear]="true" styleClass="w-full sm:w-52" ariaLabel="Role" />
      </div>

      <p-table [value]="rows" [lazy]="true" (onLazyLoad)="onLazy($event)" [loading]="loading" [paginator]="true" [rows]="pageSize" [first]="first"
        [totalRecords]="total" [rowsPerPageOptions]="[10, 25, 50]" [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} of {totalRecords}"
        dataKey="id" [rowHover]="true" [tableStyle]="{ 'min-width': '60rem' }">
        <ng-template #header>
          <tr>
            <th scope="col" pSortableColumn="name">User <p-sortIcon field="name" /></th>
            <th scope="col" pSortableColumn="role">Role <p-sortIcon field="role" /></th>
            <th scope="col">Title</th>
            <th scope="col">Agency</th>
            <th scope="col">Active</th>
            @if (auth.canWrite()) { <th scope="col"><span class="sr-only">Actions</span></th> }
          </tr>
        </ng-template>
        <ng-template #body let-u>
          <tr [class.opacity-60]="!u.is_active">
            <td>
              <div class="flex items-center gap-3">
                <p-avatar [label]="u.name | initials" shape="circle" />
                <div><div class="font-medium">{{ u.name }}</div><div class="fp-muted text-xs">{{ u.email }}</div></div>
              </div>
            </td>
            <td><p-tag [value]="roleLabel(u.role)" [severity]="u.role === 'SuperAdmin' || u.role === 'Admin' ? undefined : 'secondary'" [rounded]="true" /></td>
            <td>{{ u.title || '—' }}</td>
            <td>{{ u.agency || '—' }}</td>
            <td><p-toggleswitch [ngModel]="u.is_active" (onChange)="toggle(u)" [disabled]="!auth.canWrite()" [ariaLabel]="(u.is_active ? 'Deactivate ' : 'Activate ') + u.name" /></td>
            @if (auth.canWrite()) {
              <td class="text-right whitespace-nowrap">
                @if (u.role === 'Supervisor' || u.role === 'SupervisorAdmin') {
                  <p-button icon="pi pi-building" [text]="true" [rounded]="true" severity="secondary" pTooltip="Branch coverage" [ariaLabel]="'Branch coverage for ' + u.name" (onClick)="openCoverage(u)" />
                }
                <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" severity="secondary" pTooltip="Edit" [ariaLabel]="'Edit ' + u.name" (onClick)="openForm(u)" />
                <p-button icon="pi pi-key" [text]="true" [rounded]="true" severity="secondary" pTooltip="Reset password" [ariaLabel]="'Reset password for ' + u.name" (onClick)="resetPw(u)" />
              </td>
            }
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="6" class="text-center py-12 fp-muted">
            @if (error) { Couldn't load users. <p-button label="Retry" [link]="true" (onClick)="load()" /> } @else { No users match these filters. }
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog [(visible)]="formOpen" [modal]="true" [draggable]="false" [header]="editingId ? 'Edit user' : 'Invite user'" [style]="{ width: '34rem' }">
      <form id="userForm" class="grid grid-cols-1 sm:grid-cols-2 gap-4" (ngSubmit)="save()" #f="ngForm">
        <div class="sm:col-span-2 flex flex-col gap-2">
          <label for="usr-name" class="font-medium">Full name</label>
          <input pInputText id="usr-name" name="name" [(ngModel)]="form.name" required maxlength="120" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="usr-email" class="font-medium">Email</label>
          <input pInputText id="usr-email" name="email" type="email" [(ngModel)]="form.email" required email maxlength="160" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="usr-phone" class="font-medium">Phone <span class="fp-muted font-normal">(optional)</span></label>
          <input pInputText id="usr-phone" name="phone" type="tel" [(ngModel)]="form.phone" maxlength="30" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="usr-role" class="font-medium">Role</label>
          <p-select inputId="usr-role" name="role" [options]="roleOptions" [(ngModel)]="form.role" placeholder="Select role" required appendTo="body" />
        </div>
        <div class="flex flex-col gap-2">
          <label for="usr-title" class="font-medium">Job title</label>
          <input pInputText id="usr-title" name="title" [(ngModel)]="form.title" maxlength="120" />
        </div>
        <div class="sm:col-span-2 flex flex-col gap-2">
          <label for="usr-agency" class="font-medium">Agency <span class="fp-muted font-normal">(optional)</span></label>
          <p-select inputId="usr-agency" name="agency" [options]="agencies" [(ngModel)]="form.agency" placeholder="No agency" [showClear]="true" appendTo="body" />
        </div>
        <div class="sm:col-span-2 flex items-center gap-3">
          <p-toggleswitch inputId="usr-active" name="active" [(ngModel)]="form.is_active" />
          <label for="usr-active">Account active</label>
        </div>
        @if (!editingId) {
          <p class="sm:col-span-2 fp-muted text-sm m-0"><i class="pi pi-info-circle"></i> A random temporary password is generated and shown once after saving.</p>
        }
      </form>
      <ng-template #footer>
        <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="formOpen = false" />
        <p-button (onClick)="save()" label="Save" icon="pi pi-check" [loading]="saving" [disabled]="!f.valid || !form.role" />
      </ng-template>
    </p-dialog>

    <p-dialog [(visible)]="coverageOpen" [modal]="true" [draggable]="false" [header]="'Branch coverage · ' + (coverageUser?.name ?? '')" [style]="{ width: '56rem' }"
      [breakpoints]="{ '960px': '95vw' }">
      <p class="fp-muted mt-0">Move branches to the right to assign them to this supervisor. Changes save immediately.</p>
      <p-picklist [source]="available" [target]="assigned" sourceHeader="Available" targetHeader="Assigned" [dragdrop]="true" [responsive]="true"
        [showSourceControls]="false" [showTargetControls]="false" filterBy="name,address" sourceFilterPlaceholder="Search" targetFilterPlaceholder="Search"
        breakpoint="900px" (onMoveToTarget)="assign($event.items)" (onMoveAllToTarget)="assign($event.items)"
        (onMoveToSource)="unassign($event.items)" (onMoveAllToSource)="unassign($event.items)" [sourceStyle]="{ height: '22rem' }" [targetStyle]="{ height: '22rem' }">
        <ng-template let-b #item>
          <div><div class="font-medium">{{ b.name }}</div><div class="fp-muted text-xs">{{ b.address }}</div></div>
        </ng-template>
      </p-picklist>
    </p-dialog>

    <fp-temp-password-dialog [(password)]="tempPassword" [forName]="tempFor" />
  `,
})
export class UsersComponent extends LazyList<AppUser> implements OnInit {
  private readonly data = inject(DataService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  readonly auth = inject(AuthService);

  search = '';
  role: string | null = null;
  readonly roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
  agencies: string[] = [];

  formOpen = false;
  saving = false;
  editingId: number | null = null;
  form: UserForm = emptyForm();
  tempPassword: string | null = null;
  tempFor = '';

  coverageOpen = false;
  coverageUser: AppUser | null = null;
  available: Branch[] = [];
  assigned: Branch[] = [];

  roleLabel(r: string) { return ROLE_LABELS[r] ?? r; }

  async ngOnInit() {
    if (!this.auth.canWrite()) return;
    try { this.agencies = (await this.data.getAllAgencies()).items.map((a) => a.enName); } catch { /* dropdown stays empty */ }
  }

  protected fetch(q: QueryParams) {
    return this.data.getUsers({ ...q, search: this.search, role: this.role });
  }

  openForm(u?: AppUser) {
    this.editingId = u?.id ?? null;
    this.form = u
      ? { name: u.name, email: u.email, phone: u.phone ?? '', role: u.role, title: u.title ?? '', agency: u.agency ?? null, is_active: u.is_active }
      : emptyForm();
    this.formOpen = true;
  }

  async save() {
    if (!this.auth.canWrite() || !this.form.role) return;
    this.saving = true;
    const payload: Partial<AppUser> = { ...this.form, role: this.form.role };
    try {
      if (this.editingId) {
        await this.data.updateUser(this.editingId, payload);
        this.toast.add({ severity: 'success', summary: 'Saved', detail: `${this.form.name} was updated.` });
      } else {
        const created = await this.data.createUser(payload);
        this.tempFor = created.name;
        this.tempPassword = created.temporaryPassword;
      }
      this.formOpen = false;
      void this.load();
    } catch { /* toast shown by interceptor */ } finally {
      this.saving = false;
    }
  }

  async toggle(u: AppUser) {
    try {
      const updated = await this.data.toggleUserStatus(u.id);
      this.toast.add({ severity: 'success', summary: updated.is_active ? 'Activated' : 'Deactivated', detail: u.name });
    } catch { /* toast shown by interceptor */ }
    void this.load();
  }

  resetPw(u: AppUser) {
    this.confirm.confirm({
      header: 'Reset password?',
      message: `A new random temporary password will be generated for ${u.name}. Their current password stops working immediately.`,
      icon: 'pi pi-key',
      acceptLabel: 'Generate password',
      rejectLabel: 'Cancel',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: async () => {
        try {
          const res = await this.data.resetPassword(u.id, 'User');
          this.tempFor = u.name;
          this.tempPassword = res.temporaryPassword;
        } catch { /* toast shown by interceptor */ }
      },
    });
  }

  async openCoverage(u: AppUser) {
    this.coverageUser = u;
    this.available = [];
    this.assigned = [];
    this.coverageOpen = true;
    try {
      const [all, mine] = await Promise.all([this.data.getAllBranches(), this.data.getBranchesBySupervisor(u.id)]);
      const mineIds = new Set(mine.map((b) => b.id));
      this.assigned = mine;
      this.available = all.items.filter((b) => !mineIds.has(b.id));
    } catch { /* toast shown by interceptor */ }
  }

  async assign(items: Branch[]) {
    if (!this.coverageUser || !items.length) return;
    try {
      await this.data.assignBranchesToSupervisor(this.coverageUser.id, items.map((b) => b.id));
      this.toast.add({ severity: 'success', summary: 'Coverage updated', detail: `${items.length} branch(es) assigned.` });
    } catch { void this.openCoverage(this.coverageUser); }
  }

  async unassign(items: Branch[]) {
    if (!this.coverageUser || !items.length) return;
    try {
      await Promise.all(items.map((b) => this.data.removeBranchAssignment(this.coverageUser!.id, b.id)));
      this.toast.add({ severity: 'success', summary: 'Coverage updated', detail: `${items.length} branch(es) removed.` });
    } catch { void this.openCoverage(this.coverageUser); }
  }
}
