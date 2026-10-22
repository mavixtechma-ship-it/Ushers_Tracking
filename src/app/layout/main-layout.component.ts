import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/theme/theme.service';
import { LogoComponent } from '../shared/ui/logo.component';
import { InitialsPipe } from '../shared/ui/initials.pipe';

interface NavItem { page: string; label: string; icon: string; }
interface NavGroup { label: string; items: NavItem[]; }

const COLLAPSE_KEY = 'fp.sidebar.collapsed';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BreadcrumbModule, ButtonModule, MenuModule, AvatarModule, TooltipModule, LogoComponent, InitialsPipe],
  template: `
    <div class="shell" [class.collapsed]="collapsed()" [class.mobile-open]="mobileOpen()">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand">
          <a routerLink="/dashboard" class="no-underline" aria-label="FieldPulse home">
            <fp-logo [wordmark]="!collapsed()" [size]="32" />
          </a>
        </div>

        <nav class="nav">
          @for (group of visibleGroups(); track group.label) {
            <div class="group-label" [class.sr-only]="collapsed()">{{ group.label }}</div>
            @for (item of group.items; track item.page) {
              <a class="nav-link" [routerLink]="'/' + item.page" routerLinkActive="active" (click)="mobileOpen.set(false)"
                [pTooltip]="collapsed() ? item.label : ''" tooltipPosition="right">
                <i [class]="'pi ' + item.icon" aria-hidden="true"></i>
                <span class="nav-text">{{ item.label }}</span>
              </a>
            }
          }
        </nav>

        <button type="button" class="collapse-btn" (click)="toggleCollapse()"
          [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
          <i class="pi" [class.pi-angle-double-left]="!collapsed()" [class.pi-angle-double-right]="collapsed()"></i>
          <span class="nav-text">Collapse</span>
        </button>
      </aside>

      <div class="backdrop" (click)="mobileOpen.set(false)" aria-hidden="true"></div>

      <div class="main">
        <header class="topbar">
          <p-button icon="pi pi-bars" [text]="true" [rounded]="true" severity="secondary" styleClass="menu-btn"
            ariaLabel="Open navigation" (onClick)="mobileOpen.set(true)" />
          <p-breadcrumb [model]="crumbs()" [home]="home" styleClass="crumbs" />
          <div class="flex-1"></div>

          @if (!auth.canWrite()) {
            <span class="ro-chip" title="This account can view data but cannot make changes">
              <i class="pi pi-eye" aria-hidden="true"></i> Read-only
            </span>
          }
          <p-button [icon]="theme.dark() ? 'pi pi-sun' : 'pi pi-moon'" [text]="true" [rounded]="true" severity="secondary"
            [ariaLabel]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'" (onClick)="theme.toggle()" />

          <button type="button" class="user-btn" (click)="userMenu.toggle($event)" aria-haspopup="true" aria-label="Account menu">
            <p-avatar [label]="auth.currentUser()?.displayName | initials" shape="circle" styleClass="avatar" />
            <span class="user-meta">
              <span class="font-medium leading-tight">{{ auth.currentUser()?.displayName }}</span>
              <span class="text-xs fp-muted leading-tight">{{ auth.isAdmin() ? 'Administrator' : 'Viewer' }}</span>
            </span>
            <i class="pi pi-angle-down fp-muted" aria-hidden="true"></i>
          </button>
          <p-menu #userMenu [model]="userItems()" [popup]="true" appendTo="body" />
        </header>

        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .shell { display: flex; min-height: 100vh; }
    .sidebar { position: sticky; top: 0; height: 100vh; width: var(--fp-sidebar-w); flex-shrink: 0; display: flex; flex-direction: column;
      background: var(--fp-surface); border-inline-end: 1px solid var(--fp-border); transition: width .18s ease; z-index: 40; }
    .collapsed .sidebar { width: var(--fp-sidebar-w-collapsed); }
    .brand { height: var(--fp-topbar-h); display: flex; align-items: center; padding-inline: 20px; }
    .nav { flex: 1; overflow-y: auto; padding: 8px 12px; }
    .group-label { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--fp-muted);
      padding: 16px 12px 6px; }
    .nav-link { display: flex; align-items: center; gap: 12px; padding: 9px 12px; margin-block: 2px; border-radius: 10px;
      color: var(--fp-text); text-decoration: none; font-weight: 500; position: relative; transition: background .15s; }
    .nav-link i { font-size: 1rem; width: 20px; text-align: center; color: var(--fp-muted); }
    .nav-link:hover { background: var(--fp-surface-2); }
    .nav-link.active { background: var(--fp-accent-soft); color: var(--p-primary-color); }
    .nav-link.active i { color: var(--p-primary-color); }
    .nav-link.active::before { content: ''; position: absolute; inset-inline-start: -12px; top: 8px; bottom: 8px; width: 3px;
      border-radius: 0 3px 3px 0; background: var(--p-primary-color); }
    .collapsed .nav-text { display: none; }
    .collapsed .nav-link, .collapsed .collapse-btn { justify-content: center; }
    .collapsed .brand { padding-inline: 22px; }
    .collapse-btn { display: flex; align-items: center; gap: 12px; margin: 12px; padding: 9px 12px; border-radius: 10px; border: 1px dashed var(--fp-border);
      background: transparent; color: var(--fp-muted); cursor: pointer; font: inherit; }
    .collapse-btn:hover { color: var(--fp-text); background: var(--fp-surface-2); }
    .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .topbar { position: sticky; top: 0; z-index: 30; height: var(--fp-topbar-h); display: flex; align-items: center; gap: 8px;
      padding-inline: 24px; background: color-mix(in srgb, var(--fp-bg) 82%, transparent); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--fp-border); }
    :host ::ng-deep .crumbs { background: transparent; border: 0; padding: 0; }
    :host ::ng-deep .menu-btn { display: none; }
    .ro-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 999px;
      background: color-mix(in srgb, var(--fp-warn) 14%, transparent); color: var(--fp-warn); }
    .user-btn { display: flex; align-items: center; gap: 10px; padding: 4px 8px 4px 4px; border-radius: 999px; border: 1px solid var(--fp-border);
      background: var(--fp-surface); color: var(--fp-text); cursor: pointer; font: inherit; }
    :host ::ng-deep .avatar { background: var(--p-primary-color); color: var(--p-primary-contrast-color); font-weight: 600; font-size: 13px; }
    .user-meta { display: flex; flex-direction: column; text-align: start; }
    .content { padding: 28px; max-width: 1440px; width: 100%; margin-inline: auto; }
    .backdrop { display: none; }
    @media (max-width: 900px) {
      .sidebar { position: fixed; inset-block: 0; inset-inline-start: 0; transform: translateX(-100%); transition: transform .2s ease;
        width: var(--fp-sidebar-w) !important; }
      :host-context([dir='rtl']) .sidebar { transform: translateX(100%); }
      .mobile-open .sidebar { transform: none; box-shadow: 0 10px 40px rgb(0 0 0 / .25); }
      .mobile-open .backdrop { display: block; position: fixed; inset: 0; background: rgb(10 8 30 / .4); z-index: 35; }
      .collapsed .nav-text { display: inline; }
      .collapse-btn { display: none; }
      :host ::ng-deep .menu-btn { display: inline-flex; }
      .topbar { padding-inline: 12px; }
      .user-meta, :host ::ng-deep .crumbs { display: none; }
      .content { padding: 16px; }
    }
  `],
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly collapsed = signal(this.readCollapsed());
  readonly mobileOpen = signal(false);
  readonly home: MenuItem = { icon: 'pi pi-home', routerLink: '/dashboard', ariaLabel: 'Home' } as MenuItem;

  private readonly groups: NavGroup[] = [
    { label: 'Home', items: [{ page: 'dashboard', label: 'Overview', icon: 'pi-chart-bar' }] },
    { label: 'Attendance', items: [
      { page: 'sessions', label: 'Shift sessions', icon: 'pi-clock' },
      { page: 'supervisorlogs', label: 'Supervisor visits', icon: 'pi-map-marker' },
    ] },
    { label: 'Sales', items: [
      { page: 'invoices', label: 'Sales', icon: 'pi-receipt' },
      { page: 'feedback', label: 'Feedback', icon: 'pi-comments' },
    ] },
    { label: 'People', items: [
      { page: 'ushers', label: 'Field staff', icon: 'pi-users' },
      { page: 'users', label: 'User accounts', icon: 'pi-id-card' },
      { page: 'agencies', label: 'Agencies', icon: 'pi-briefcase' },
    ] },
    { label: 'Network', items: [
      { page: 'branches', label: 'Branches', icon: 'pi-building' },
      { page: 'sectors', label: 'Sectors', icon: 'pi-th-large' },
    ] },
  ];

  readonly visibleGroups = computed(() => {
    this.auth.currentUser();
    return this.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => this.auth.canAccess(i.page)) }))
      .filter((g) => g.items.length > 0);
  });

  private readonly routeData = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let r = this.route;
        while (r.firstChild) r = r.firstChild;
        // Child snapshots are not assigned yet while the shell itself is being activated.
        return (r.snapshot?.data ?? {}) as { title?: string; section?: string };
      })
    ),
    { initialValue: {} as { title?: string; section?: string } }
  );

  readonly crumbs = computed<MenuItem[]>(() => {
    const d = this.routeData();
    const items: MenuItem[] = [];
    if (d.section && d.section !== 'Home') items.push({ label: d.section });
    if (d.title) items.push({ label: d.title });
    return items;
  });

  readonly userItems = computed<MenuItem[]>(() => [
    {
      label: this.auth.currentUser()?.username ?? '',
      items: [
        { label: this.theme.dark() ? 'Light mode' : 'Dark mode', icon: this.theme.dark() ? 'pi pi-sun' : 'pi pi-moon', command: () => this.theme.toggle() },
        { separator: true },
        { label: 'Sign out', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
      ],
    },
  ]);

  toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
  }

  private readCollapsed(): boolean {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  }
}
