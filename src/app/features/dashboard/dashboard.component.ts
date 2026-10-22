import { Component, DestroyRef, OnInit, effect, inject, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AvatarModule } from 'primeng/avatar';
import { DataService } from '../../core/services/data.service';
import { DashboardStats } from '../../core/models/models';
import { ThemeService } from '../../core/theme/theme.service';
import { relativeTime } from '../../core/util/dates';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { KpiTileComponent } from '../../shared/ui/kpi-tile.component';
import { InitialsPipe } from '../../shared/ui/initials.pipe';

const REFRESH_MS = 60_000;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink, ChartModule, ButtonModule, SkeletonModule, AvatarModule, PageHeaderComponent, KpiTileComponent, InitialsPipe],
  template: `
    <fp-page-header title="Overview" [description]="'Updated ' + (updatedAt() ? (updatedAt() | date:'shortTime') : '…') + ' · refreshes every minute'">
      <p-button icon="pi pi-refresh" label="Refresh" [outlined]="true" severity="secondary" [loading]="loading()" (onClick)="load()" />
    </fp-page-header>

    @if (error()) {
      <div class="fp-panel p-6 mb-5 flex items-center gap-4">
        <i class="pi pi-exclamation-triangle text-2xl" style="color: var(--fp-warn)"></i>
        <div class="flex-1">Couldn't load the overview.</div>
        <p-button label="Retry" (onClick)="load()" />
      </div>
    }

    <div class="fp-grid mb-5">
      <div class="fp-col-3"><fp-kpi label="Active field staff" icon="pi-users" [loading]="!stats()" [value]="stats()?.totalUshers ?? null"
        [hint]="(stats()?.totalInactiveUshers ?? 0) + ' inactive accounts'" /></div>
      <div class="fp-col-3"><fp-kpi label="On shift now" icon="pi-sign-in" tone="ok" [loading]="!stats()" [value]="stats()?.totalOnlineUshers ?? null"
        [hint]="onShiftRate()" /></div>
      <div class="fp-col-3"><fp-kpi label="Not checked in" icon="pi-user-minus" tone="warn" [loading]="!stats()" [value]="stats()?.totalOfflineUshers ?? null" /></div>
      <div class="fp-col-3"><fp-kpi label="Sales · last 30 days" icon="pi-wallet" tone="neutral" [loading]="!stats()"
        [value]="stats() ? (stats()!.revenueLast30 | number:'1.0-0') : null" hint="Invoice totals, all branches" /></div>
    </div>

    <div class="fp-grid mb-5">
      <section class="fp-col-8 fp-panel p-5">
        <div class="flex items-baseline justify-between mb-4">
          <h2 class="text-base font-semibold m-0">Check-ins per day</h2>
          <span class="fp-muted text-xs">Last 14 days</span>
        </div>
        @if (trendData()) {
          <p-chart type="line" [data]="trendData()" [options]="lineOptions()" height="280px" />
        } @else { <p-skeleton height="280px" /> }
      </section>

      <section class="fp-col-4 fp-panel p-5 flex flex-col">
        <div class="flex items-baseline justify-between mb-3">
          <h2 class="text-base font-semibold m-0">On shift</h2>
          <a routerLink="/sessions" [queryParams]="{ status: 'Active' }" class="text-sm text-primary no-underline">All sessions</a>
        </div>
        @if (!stats()) {
          @for (i of [1,2,3,4,5]; track i) { <p-skeleton height="2.5rem" styleClass="mb-2" /> }
        } @else if (stats()!.onShift.length === 0) {
          <div class="fp-muted text-center py-10">Nobody is checked in right now.</div>
        } @else {
          <ul class="list-none m-0 p-0 overflow-y-auto" style="max-height: 300px">
            @for (s of stats()!.onShift; track s.sessionId) {
              <li class="flex items-center gap-3 py-2 border-b border-surface-200 dark:border-surface-700 last:border-0">
                <p-avatar [label]="s.usherName | initials" shape="circle" styleClass="shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="font-medium truncate">{{ s.usherName }}</div>
                  <div class="fp-muted text-xs truncate">{{ s.branchName }}</div>
                </div>
                <span class="fp-muted text-xs whitespace-nowrap" [title]="s.since | date:'medium'">{{ rel(s.since) }}</span>
              </li>
            }
          </ul>
        }
        <div class="mt-auto pt-4 grid grid-cols-3 gap-2 text-center border-t border-surface-200 dark:border-surface-700">
          <div><div class="num font-semibold">{{ stats()?.totalBranches ?? '–' }}</div><div class="fp-muted text-xs">Branches</div></div>
          <div><div class="num font-semibold">{{ stats()?.totalSupervisor ?? '–' }}</div><div class="fp-muted text-xs">Supervisors</div></div>
          <div><div class="num font-semibold">{{ stats()?.totalCompleatedSession ?? '–' }}</div><div class="fp-muted text-xs">Shifts closed today</div></div>
        </div>
      </section>
    </div>

    <div class="fp-grid">
      <section class="fp-col-7 fp-panel p-5">
        <div class="flex items-baseline justify-between mb-4">
          <h2 class="text-base font-semibold m-0">Top branches by sales</h2>
          <a routerLink="/invoices" class="text-sm text-primary no-underline">Sales report</a>
        </div>
        @if (branchData()) {
          <p-chart type="bar" [data]="branchData()" [options]="barOptions()" height="260px" />
        } @else { <p-skeleton height="260px" /> }
      </section>
      <section class="fp-col-5 fp-panel p-5">
        <h2 class="text-base font-semibold m-0 mb-4">Workforce status</h2>
        @if (statusData()) {
          <p-chart type="doughnut" [data]="statusData()" [options]="donutOptions()" height="260px" />
        } @else { <p-skeleton shape="circle" size="220px" styleClass="mx-auto" /> }
      </section>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly data = inject(DataService);
  private readonly theme = inject(ThemeService);

  readonly stats = signal<DashboardStats | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly updatedAt = signal<Date | null>(null);

  readonly trendData = signal<unknown>(null);
  readonly branchData = signal<unknown>(null);
  readonly statusData = signal<unknown>(null);
  readonly lineOptions = signal<unknown>({});
  readonly barOptions = signal<unknown>({});
  readonly donutOptions = signal<unknown>({});

  readonly rel = relativeTime;

  constructor() {
    const timer = setInterval(() => this.load(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // Re-colour charts when the theme flips.
    effect(() => { this.theme.dark(); if (this.stats()) queueMicrotask(() => this.buildCharts()); });
  }

  ngOnInit() { this.load(); }

  onShiftRate(): string {
    const s = this.stats();
    if (!s || !s.totalUshers) return '';
    return `${Math.round((s.totalOnlineUshers / s.totalUshers) * 100)}% of active staff`;
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.stats.set(await this.data.getDashboardStats());
      this.updatedAt.set(new Date());
      this.buildCharts();
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private buildCharts() {
    const s = this.stats();
    if (!s) return;
    const css = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    const primary = v('--p-primary-color', '#6d4aff');
    const text = v('--fp-muted', '#63627a');
    const grid = v('--fp-border', '#e4e4f0');
    const ok = v('--fp-ok', '#059669');
    const warn = v('--fp-warn', '#d97706');
    const neutral = v('--fp-surface-2', '#f0f0f8');
    const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const axis = { ticks: { color: text }, grid: { color: grid }, border: { display: false } };

    this.trendData.set({
      labels: s.sessionsTrend.map((t) => fmtDay(t.date)),
      datasets: [{ label: 'Check-ins', data: s.sessionsTrend.map((t) => t.count), borderColor: primary, borderWidth: 2.5,
        backgroundColor: /^#[0-9a-f]{6}$/i.test(primary) ? `${primary}24` : 'rgba(109, 74, 255, 0.14)', fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: primary }],
    });
    this.lineOptions.set({ maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ...axis, grid: { display: false } }, y: { ...axis, beginAtZero: true, ticks: { color: text, precision: 0 } } } });

    this.branchData.set({
      labels: s.salesByBranch.map((b) => b.branch),
      datasets: [{ label: 'Sales', data: s.salesByBranch.map((b) => b.total), backgroundColor: primary, borderRadius: 6, barThickness: 18 }],
    });
    this.barOptions.set({ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false },
      tooltip: { callbacks: { label: (c: { parsed: { x: number } }) => ` ${c.parsed.x.toLocaleString(undefined, { minimumFractionDigits: 2 })}` } } },
      scales: { x: { ...axis, beginAtZero: true }, y: { ...axis, grid: { display: false } } } });

    this.statusData.set({
      labels: ['On shift', 'Not checked in', 'Inactive'],
      datasets: [{ data: [s.totalOnlineUshers, s.totalOfflineUshers, s.totalInactiveUshers], backgroundColor: [ok, warn, neutral],
        borderWidth: 0, hoverOffset: 6 }],
    });
    this.donutOptions.set({ maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: text, usePointStyle: true, padding: 16 } } } });
  }
}
