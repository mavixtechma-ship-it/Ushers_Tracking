import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard, roleMatchGuard } from './core/guards/auth.guard';

/** `data.page` is checked against PAGE_ACCESS by roleMatchGuard / roleGuard. */
const page = (path: string, title: string, section: string, load: Routes[number]['loadComponent']) => ({
  path,
  title: `${title} · FieldPulse`,
  data: { page: path, title, section },
  canMatch: [roleMatchGuard],
  canActivate: [roleGuard],
  loadComponent: load,
});

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · FieldPulse',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout.component').then((m) => m.MainLayoutComponent),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      page('dashboard', 'Overview', 'Home', () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)),
      page('sessions', 'Shift sessions', 'Attendance', () => import('./features/sessions/sessions.component').then((m) => m.SessionsComponent)),
      page('supervisorlogs', 'Supervisor visits', 'Attendance', () => import('./features/supervisor-logs/supervisor-logs.component').then((m) => m.SupervisorLogsComponent)),
      page('invoices', 'Sales', 'Sales', () => import('./features/invoices/invoices.component').then((m) => m.InvoicesComponent)),
      page('feedback', 'Feedback', 'Sales', () => import('./features/feedback/feedback.component').then((m) => m.FeedbackComponent)),
      page('ushers', 'Field staff', 'People', () => import('./features/ushers/ushers.component').then((m) => m.UshersComponent)),
      page('users', 'User accounts', 'People', () => import('./features/users/users.component').then((m) => m.UsersComponent)),
      page('agencies', 'Agencies', 'People', () => import('./features/agencies/agencies.component').then((m) => m.AgenciesComponent)),
      page('branches', 'Branches', 'Network', () => import('./features/branches/branches.component').then((m) => m.BranchesComponent)),
      page('sectors', 'Sectors', 'Network', () => import('./features/sectors/sectors.component').then((m) => m.SectorsComponent)),
      {
        path: 'forbidden',
        title: 'No access · FieldPulse',
        data: { title: 'No access', section: 'Home' },
        loadComponent: () => import('./features/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
