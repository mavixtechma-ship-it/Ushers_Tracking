import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, delay, from, mergeMap, of, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { SessionStore } from '../auth/session.store';
import { generateTempPassword, verifyCredentials } from '../auth/password';
import { getMockDb, MockDb } from './mock-db';
import { AppUser, Branch, DashboardStats, Usher } from '../models/models';

/* ------------------------------------------------------------------ */
/* Tiny in-browser REST backend for the demo. Paths mirror the original API. */
/* ------------------------------------------------------------------ */

class ApiError {
  constructor(readonly status: number, readonly message: string) {}
}

interface Ctx {
  db: MockDb;
  match: RegExpMatchArray;
  body: Record<string, unknown>;
  q: (key: string) => string | null;
}

type Handler = (c: Ctx) => unknown | Promise<unknown>;
interface Route { method: string; pattern: RegExp; handler: Handler; public?: boolean; }

const ROLES = ['SuperAdmin', 'Admin', 'SupervisorAdmin', 'Supervisor', 'FI', 'Sales'];
const SAFE_KEY = /^[A-Za-z_]{1,40}$/;

/* ---------- helpers ---------- */
const lc = (v: unknown) => String(v ?? '').toLowerCase();
const has = (hay: unknown, needle: string | null) => !needle || lc(hay).includes(needle.toLowerCase());
const num = (v: unknown, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
const nextId = <T>(arr: T[], key: keyof T) => arr.reduce((m, x) => Math.max(m, Number(x[key]) || 0), 0) + 1;

function str(v: unknown, field: string, { required = false, max = 120 } = {}): string | null {
  const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
  if (required && !s) throw new ApiError(400, `${field} is required.`);
  if (s.length > max) throw new ApiError(400, `${field} is too long.`);
  return s || null;
}
function bool(v: unknown, fallback = true): boolean { return typeof v === 'boolean' ? v : fallback; }

function findOr404<T>(arr: T[], pred: (x: T) => boolean): T {
  const item = arr.find(pred);
  if (!item) throw new ApiError(404, 'Not found');
  return item;
}

function inDateRange(iso: string | null | undefined, c: Ctx): boolean {
  const from = c.q('dateFrom');
  const to = c.q('dateTo');
  if (!from && !to) return true;
  if (!iso) return false;
  const t = Date.parse(iso);
  if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && t > new Date(`${to}T23:59:59.999`).getTime()) return false;
  return true;
}

function sortItems<T>(items: T[], c: Ctx): T[] {
  const field = c.q('sortField');
  if (!field || !SAFE_KEY.test(field)) return items;
  const dir = num(c.q('sortOrder'), 1) < 0 ? -1 : 1;
  return [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field];
    const bv = (b as Record<string, unknown>)[field];
    if (av == null) return 1;
    if (bv == null) return -1;
    return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * dir;
  });
}

function paginate<T>(items: T[], c: Ctx) {
  const page = Math.max(1, Math.trunc(num(c.q('page'), 1)));
  const pageSize = Math.min(1000, Math.max(1, Math.trunc(num(c.q('pageSize'), 10))));
  const sorted = sortItems(items, c);
  return { items: sorted.slice((page - 1) * pageSize, page * pageSize), totalItems: items.length, totalCount: items.length, pageSize };
}

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymd = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/* ---------- login throttling ---------- */
let failedLogins = 0;
let lockedUntil = 0;

/* ---------- write payload pickers (no mass assignment) ---------- */
function branchFrom(body: Record<string, unknown>, db: MockDb): Omit<Branch, 'id'> {
  const sectorId = body['sectorId'] == null ? null : num(body['sectorId'], NaN);
  const sector = db.sectors.find((s) => s.id === sectorId);
  if (!sector) throw new ApiError(400, 'Choose a valid sector.');
  const lat = num(body['latitude'], NaN);
  const lng = num(body['longitude'], NaN);
  if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) throw new ApiError(400, 'Coordinates are invalid.');
  const range = num(body['geofence_range'], NaN);
  if (!(range >= 10 && range <= 5000)) throw new ApiError(400, 'Geofence range must be 10–5000 m.');
  return {
    name: str(body['name'], 'Branch name', { required: true })!,
    address: str(body['address'], 'Address', { required: true, max: 200 })!,
    sectorId: sector.id,
    sectorName: sector.name,
    latitude: lat,
    longitude: lng,
    geofence_range: Math.round(range),
    is_active: bool(body['is_active']),
  };
}

function usherFrom(body: Record<string, unknown>, db: MockDb): Omit<Usher, 'id'> {
  const agency = str(body['agency'], 'Agency');
  if (agency && !db.agencies.some((a) => a.enName === agency)) throw new ApiError(400, 'Unknown agency.');
  const supervisorId = body['supervisor_id'] == null ? null : num(body['supervisor_id'], NaN);
  if (supervisorId != null && !db.users.some((u) => u.id === supervisorId)) throw new ApiError(400, 'Unknown supervisor.');
  return {
    name: str(body['name'], 'Name', { required: true })!,
    phone: str(body['phone'], 'Phone', { required: true, max: 30 })!,
    email: str(body['email'], 'Email', { max: 160 }),
    profile_photo_url: null,
    agency,
    supervisor_id: supervisorId,
    is_active: bool(body['is_active']),
  };
}

function userFrom(body: Record<string, unknown>): Omit<AppUser, 'id'> {
  const role = str(body['role'], 'Role', { required: true })!;
  if (!ROLES.includes(role)) throw new ApiError(400, 'Unknown role.');
  return {
    name: str(body['name'], 'Name', { required: true })!,
    email: str(body['email'], 'Email', { required: true, max: 160 })!,
    phone: str(body['phone'], 'Phone', { max: 30 }) ?? undefined,
    role,
    title: str(body['title'], 'Title') ?? undefined,
    agency: str(body['agency'], 'Agency'),
    is_active: bool(body['is_active']),
  };
}

/* ---------- dashboard ---------- */
function stats(db: MockDb): DashboardStats {
  const today = startOfDay(Date.now());
  const active = db.ushers.filter((u) => u.is_active);
  const online = active.filter((u) => u.is_online).length;
  const trend: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d0 = today - i * 86_400_000;
    const count = db.sessions.filter((s) => { const t = Date.parse(s.check_in_time); return t >= d0 && t < d0 + 86_400_000; }).length;
    trend.push({ date: ymd(d0), count });
  }
  const since30 = today - 29 * 86_400_000;
  const byBranch = new Map<string, number>();
  let revenue = 0;
  for (const inv of db.invoices) {
    if (!inv.createdAt || Date.parse(inv.createdAt) < since30) continue;
    revenue += inv.totalPrice ?? 0;
    byBranch.set(inv.location ?? 'Unknown', (byBranch.get(inv.location ?? 'Unknown') ?? 0) + (inv.totalPrice ?? 0));
  }
  return {
    totalUshers: active.length,
    totalOnlineUshers: online,
    totalOfflineUshers: active.length - online,
    totalInactiveUshers: db.ushers.length - active.length,
    totalCompleatedSession: db.sessions.filter((s) => s.status === 'COMPLETED' && s.check_out_time && Date.parse(s.check_out_time) >= today).length,
    totalBranches: db.branches.filter((b) => b.is_active).length,
    totalUsers: db.users.length,
    totalSupervisor: db.users.filter((u) => u.role === 'Supervisor' || u.role === 'SupervisorAdmin').length,
    revenueLast30: Math.round(revenue * 100) / 100,
    sessionsTrend: trend,
    salesByBranch: [...byBranch.entries()].map(([branch, total]) => ({ branch, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total).slice(0, 6),
    onShift: db.sessions.filter((s) => s.status === 'Active')
      .map((s) => ({ sessionId: s.id, usherName: s.usherName, branchName: s.branchName, since: s.check_in_time }))
      .sort((a, b) => a.since.localeCompare(b.since)),
  };
}

/* ---------- routes ---------- */
const id = (c: Ctx, i = 1) => Math.trunc(num(c.match[i], NaN));

const routes: Route[] = [
  // AUTH
  {
    method: 'POST', pattern: /^Auth$/, public: true, handler: async (c) => {
      if (Date.now() < lockedUntil) throw new ApiError(429, 'Too many attempts');
      const username = typeof c.body['username'] === 'string' ? c.body['username'].slice(0, 64) : '';
      const password = typeof c.body['password'] === 'string' ? c.body['password'].slice(0, 256) : '';
      const account = await verifyCredentials(username, password);
      if (!account) {
        failedLogins++;
        if (failedLogins >= 5) { lockedUntil = Date.now() + 30_000; failedLogins = 0; }
        throw new ApiError(401, 'Invalid credentials');
      }
      failedLogins = 0;
      return { user: { username: account.username, displayName: account.displayName, role: account.role } };
    },
  },
  {
    method: 'PUT', pattern: /^Auth\/ResetPassword$/, handler: (c) => {
      const targetId = Math.trunc(num(c.q('id'), NaN));
      const list: { id: number }[] = c.body['type'] === 'Usher' ? c.db.ushers : c.db.users;
      findOr404(list, (x) => x.id === targetId);
      return { id: targetId, temporaryPassword: generateTempPassword() };
    },
  },

  // DASHBOARD
  { method: 'GET', pattern: /^DashBoard\/Stats$/, handler: (c) => stats(c.db) },

  // BRANCHES & SECTORS
  {
    method: 'GET', pattern: /^Branch\/AllBranches$/, handler: (c) => {
      const s = c.q('search');
      return paginate(c.db.branches.filter((b) => has(b.name, s) || has(b.address, s) || has(b.sectorName, s)), c);
    },
  },
  { method: 'GET', pattern: /^Branch\/GetBranchById\/(\d+)$/, handler: (c) => findOr404(c.db.branches, (b) => b.id === id(c)) },
  {
    method: 'GET', pattern: /^Branch\/GetBranchesBySupervisor\/(\d+)$/, handler: (c) => {
      const ids = c.db.supervisorBranches[String(id(c))] ?? [];
      return c.db.branches.filter((b) => ids.includes(b.id));
    },
  },
  { method: 'GET', pattern: /^Branch\/GetAllSector$/, handler: (c) => c.db.sectors },
  {
    method: 'POST', pattern: /^Branch\/AddSector$/, handler: (c) => {
      const name = str(c.q('sectorname'), 'Sector name', { required: true, max: 60 })!;
      if (c.db.sectors.some((s) => lc(s.name) === lc(name))) throw new ApiError(400, 'A sector with this name already exists.');
      const sector = { id: nextId(c.db.sectors, 'id'), name };
      c.db.sectors.push(sector);
      return sector;
    },
  },
  {
    method: 'POST', pattern: /^Branch\/CreateBranch$/, handler: (c) => {
      const branch: Branch = { id: nextId(c.db.branches, 'id'), ...branchFrom(c.body, c.db) };
      c.db.branches.push(branch);
      return branch;
    },
  },
  {
    method: 'PUT', pattern: /^Branch\/(\d+)$/, handler: (c) => {
      const b = findOr404(c.db.branches, (x) => x.id === id(c));
      Object.assign(b, branchFrom(c.body, c.db));
      return b;
    },
  },
  {
    method: 'DELETE', pattern: /^Branch\/(\d+)$/, handler: (c) => {
      const b = findOr404(c.db.branches, (x) => x.id === id(c));
      b.is_active = !b.is_active;
      return b;
    },
  },

  // AGENCIES
  {
    method: 'GET', pattern: /^Agency$/, handler: (c) => {
      const s = c.q('search');
      return paginate(c.db.agencies.filter((a) => has(a.enName, s) || has(a.arName, s)), c);
    },
  },
  { method: 'GET', pattern: /^Agency\/(\d+)$/, handler: (c) => findOr404(c.db.agencies, (a) => a.id === id(c)) },
  {
    method: 'POST', pattern: /^Agency$/, handler: (c) => {
      const a = { id: nextId(c.db.agencies, 'id'), enName: str(c.body['enName'], 'English name', { required: true })!, arName: str(c.body['arName'], 'Arabic name', { required: true })! };
      c.db.agencies.push(a);
      return a;
    },
  },
  {
    method: 'PUT', pattern: /^Agency\/(\d+)$/, handler: (c) => {
      const a = findOr404(c.db.agencies, (x) => x.id === id(c));
      const oldName = a.enName;
      a.enName = str(c.body['enName'], 'English name', { required: true })!;
      a.arName = str(c.body['arName'], 'Arabic name', { required: true })!;
      c.db.ushers.forEach((u) => { if (u.agency === oldName) u.agency = a.enName; });
      return a;
    },
  },
  {
    method: 'DELETE', pattern: /^Agency\/(\d+)$/, handler: (c) => {
      const a = findOr404(c.db.agencies, (x) => x.id === id(c));
      if (c.db.ushers.some((u) => u.agency === a.enName)) throw new ApiError(400, 'This agency still has ushers assigned.');
      c.db.agencies.splice(c.db.agencies.indexOf(a), 1);
      return null;
    },
  },

  // USHERS
  {
    method: 'GET', pattern: /^Usher$/, handler: (c) => {
      const s = c.q('search');
      const status = c.q('status');
      const list = c.db.ushers.filter((u) =>
        (has(u.name, s) || has(u.phone, s) || has(u.email, s) || has(u.agency, s)) &&
        (!status || (status === 'online' && u.is_online) || (status === 'offline' && !u.is_online) ||
          (status === 'active' && u.is_active) || (status === 'inactive' && !u.is_active)) &&
        (!c.q('agency') || u.agency === c.q('agency')));
      return paginate(list, c);
    },
  },
  { method: 'GET', pattern: /^Usher\/(\d+)$/, handler: (c) => findOr404(c.db.ushers, (u) => u.id === id(c)) },
  {
    method: 'POST', pattern: /^Usher\/Create$/, handler: (c) => {
      const u: Usher = { id: nextId(c.db.ushers, 'id'), ...usherFrom(c.body, c.db), is_online: false, last_seen: null };
      c.db.ushers.push(u);
      return { ...u, temporaryPassword: generateTempPassword() };
    },
  },
  {
    method: 'PUT', pattern: /^Usher\/(\d+)$/, handler: (c) => {
      const u = findOr404(c.db.ushers, (x) => x.id === id(c));
      Object.assign(u, usherFrom(c.body, c.db));
      return u;
    },
  },
  {
    method: 'DELETE', pattern: /^Usher\/(\d+)$/, handler: (c) => {
      const u = findOr404(c.db.ushers, (x) => x.id === id(c));
      u.is_active = !u.is_active;
      if (!u.is_active) u.is_online = false;
      return u;
    },
  },

  // USERS & SUPERVISORS
  {
    method: 'GET', pattern: /^User\/AllUsers$/, handler: (c) => {
      const s = c.q('search');
      const role = c.q('role');
      return paginate(c.db.users.filter((u) => (has(u.name, s) || has(u.email, s) || has(u.phone, s)) && (!role || u.role === role)), c);
    },
  },
  {
    method: 'GET', pattern: /^User\/Supervisors$/, handler: (c) =>
      c.db.users.filter((u) => u.role === 'Supervisor' || u.role === 'SupervisorAdmin').map(({ id: i, name, email }) => ({ id: i, name, email })),
  },
  { method: 'GET', pattern: /^User\/(\d+)$/, handler: (c) => findOr404(c.db.users, (u) => u.id === id(c)) },
  {
    method: 'POST', pattern: /^User$/, handler: (c) => {
      const data = userFrom(c.body);
      if (c.db.users.some((u) => lc(u.email) === lc(data.email))) throw new ApiError(400, 'Email is already in use.');
      const u: AppUser = { id: nextId(c.db.users, 'id'), ...data };
      c.db.users.push(u);
      return { ...u, temporaryPassword: generateTempPassword() };
    },
  },
  {
    method: 'PUT', pattern: /^User\/(\d+)$/, handler: (c) => {
      const u = findOr404(c.db.users, (x) => x.id === id(c));
      Object.assign(u, userFrom(c.body));
      return u;
    },
  },
  {
    method: 'DELETE', pattern: /^User$/, handler: (c) => {
      const u = findOr404(c.db.users, (x) => x.id === Math.trunc(num(c.q('id'), NaN)));
      u.is_active = !u.is_active;
      return u;
    },
  },
  {
    method: 'POST', pattern: /^Supervisors\/AssignBranches$/, handler: (c) => {
      const sid = Math.trunc(num(c.body['SupervisorId'], NaN));
      findOr404(c.db.users, (u) => u.id === sid);
      const ids = Array.isArray(c.body['BranchIds']) ? (c.body['BranchIds'] as unknown[]).map((x) => Math.trunc(num(x, NaN))) : [];
      const valid = ids.filter((bid) => c.db.branches.some((b) => b.id === bid));
      const current = new Set(c.db.supervisorBranches[String(sid)] ?? []);
      valid.forEach((bid) => current.add(bid));
      c.db.supervisorBranches[String(sid)] = [...current];
      return null;
    },
  },
  {
    method: 'DELETE', pattern: /^Supervisors\/RemoveBranchAssignment$/, handler: (c) => {
      const sid = String(Math.trunc(num(c.q('supervisorId'), NaN)));
      const bid = Math.trunc(num(c.q('branchId'), NaN));
      c.db.supervisorBranches[sid] = (c.db.supervisorBranches[sid] ?? []).filter((x) => x !== bid);
      return null;
    },
  },

  // SESSIONS, SUPERVISOR LOGS, FEEDBACK
  {
    method: 'GET', pattern: /^Sessions\/LogsList$/, handler: (c) => {
      const status = c.q('status');
      const agency = c.q('agency');
      const s = c.q('search');
      return paginate(c.db.sessions.filter((x) =>
        (!status || lc(x.status) === lc(status)) && (!agency || x.agency === agency) &&
        (has(x.usherName, s) || has(x.branchName, s)) && inDateRange(x.check_in_time, c)), c);
    },
  },
  {
    method: 'GET', pattern: /^Sessions\/SupervisorsLogsList$/, handler: (c) => {
      const status = c.q('status');
      const s = c.q('search');
      return paginate(c.db.supervisorLogs.filter((x) =>
        (!status || lc(x.status) === lc(status)) && (has(x.supervisorName, s) || has(x.branchName, s)) && inDateRange(x.startTime, c)), c);
    },
  },
  { method: 'GET', pattern: /^Sessions\/SupervisorLog\/(\d+)$/, handler: (c) => findOr404(c.db.supervisorLogs, (x) => x.id === id(c)) },
  {
    method: 'GET', pattern: /^Sessions\/GetFeedBack$/, handler: (c) => {
      const type = c.q('feedbackType');
      const s = c.q('search');
      const inRange = c.db.feedback.filter((f) => inDateRange(f.createdAt, c) && (has(f.usherName, s) || has(f.supervisorName, s) || has(f.branchName, s)));
      const breakdown = { Positive: 0, Neutral: 0, Negative: 0 };
      inRange.forEach((f) => { if (f.feedbackType === 'Positive' || f.feedbackType === 'Neutral' || f.feedbackType === 'Negative') breakdown[f.feedbackType]++; });
      return { ...paginate(inRange.filter((f) => !type || f.feedbackType === type), c), breakdown };
    },
  },
  { method: 'GET', pattern: /^Sessions\/(\d+)$/, handler: (c) => findOr404(c.db.sessions, (x) => x.id === id(c)) },
  {
    method: 'GET', pattern: /^Break\/GetSessionBreaks$/, handler: (c) => {
      const sid = Math.trunc(num(c.q('sessionId'), NaN));
      return c.db.breaks.filter((b) => b.sessionId === sid).sort((a, b) => a.start_time.localeCompare(b.start_time));
    },
  },

  // INVOICES
  {
    method: 'GET', pattern: /^Invoice\/GetInvoices$/, handler: (c) => {
      const usher = c.q('usherName');
      const loc = c.q('location');
      const list = c.db.invoices.filter((i) => has(i.usherName, usher) && has(i.location, loc) && inDateRange(i.createdAt, c));
      const revenue = list.reduce((t, i) => t + (i.totalPrice ?? 0), 0);
      const units = list.reduce((t, i) => t + (i.quantity ?? 0), 0);
      return { ...paginate(list, c), summary: { revenue: Math.round(revenue * 100) / 100, units, avgTicket: list.length ? Math.round((revenue / list.length) * 100) / 100 : 0 } };
    },
  },
  {
    method: 'GET', pattern: /^Invoice\/GetInvoiceById$/, handler: (c) =>
      findOr404(c.db.invoices, (i) => i.invoiceId === Math.trunc(num(c.q('id'), NaN))),
  },
];

function lowerParams(req: HttpRequest<unknown>): (key: string) => string | null {
  const map = new Map<string, string>();
  for (const k of req.params.keys()) {
    const v = req.params.get(k);
    if (v != null) map.set(k.toLowerCase(), v);
  }
  return (key: string) => map.get(key.toLowerCase()) ?? null;
}

function errorResponse(req: HttpRequest<unknown>, status: number, message: string): Observable<never> {
  return throwError(() => new HttpErrorResponse({ status, statusText: message, url: req.url, error: { message } }));
}

/**
 * Serves `/mock-api/*` from in-memory data. Viewer sessions get 403 on any write;
 * requests without a session get 401 (except POST /Auth).
 */
export const mockBackendInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${API_BASE_URL}/`)) return next(req);

  const session = inject(SessionStore);
  const path = req.url.slice(API_BASE_URL.length + 1).split('?')[0];
  let route: Route | undefined;
  let match: RegExpMatchArray | null = null;
  for (const r of routes) {
    if (r.method !== req.method) continue;
    match = path.match(r.pattern);
    if (match) { route = r; break; }
  }
  const latency = 120 + Math.floor(Math.random() * 180);

  if (!route || !match) return errorResponse(req, 404, 'Unknown endpoint');
  if (!route.public) {
    if (!session.isActive()) return errorResponse(req, 401, 'Not signed in');
    if (req.method !== 'GET' && !session.canWrite()) return errorResponse(req, 403, 'Read-only account');
  }

  const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as Record<string, unknown>;
  const q = lowerParams(req);
  const m = match;
  const handler = route.handler;

  return from(getMockDb()).pipe(
    mergeMap(async (db) => handler({ db, match: m, body, q })),
    mergeMap((result) => of(new HttpResponse({ status: 200, url: req.url, body: result == null ? null : structuredClone(result) }))),
    delay(latency),
    catchError((e: unknown) => e instanceof ApiError
      ? errorResponse(req, e.status, e.message)
      : errorResponse(req, 500, 'Unexpected error')),
  );
};
