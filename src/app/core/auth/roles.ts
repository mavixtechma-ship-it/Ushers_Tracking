export type AppRole = 'SuperAdmin' | 'Viewer';

/** Pages each role may open. Enforced by roleGuard on routes (not only by hiding links). */
export const PAGE_ACCESS: Record<AppRole, readonly string[]> = {
  SuperAdmin: ['dashboard', 'branches', 'ushers', 'users', 'sessions', 'supervisorlogs', 'invoices', 'feedback', 'sectors', 'agencies'],
  // Read-only account: everything except user-account administration.
  Viewer: ['dashboard', 'branches', 'ushers', 'sessions', 'supervisorlogs', 'invoices', 'feedback', 'sectors', 'agencies'],
};

/** Roles allowed to send create / update / delete requests. */
export const WRITE_ROLES: readonly AppRole[] = ['SuperAdmin'];
