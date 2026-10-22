import {
  Agency, AppUser, Branch, BreakItem, Feedback, Invoice, Sector, SessionLog, SupervisorLog, Usher,
} from '../models/models';

/** In-memory "database" seeded from src/assets/mock/*.json. Writes live only for the browser tab. */
export interface MockDb {
  sectors: Sector[];
  agencies: Agency[];
  branches: Branch[];
  users: AppUser[];
  supervisorBranches: Record<string, number[]>;
  ushers: Usher[];
  sessions: (SessionLog & { branchId?: number })[];
  breaks: (BreakItem & { sessionId: number })[];
  supervisorLogs: SupervisorLog[];
  invoices: Invoice[];
  feedback: Feedback[];
}

const FILES = {
  meta: 'meta',
  sectors: 'sectors',
  agencies: 'agencies',
  branches: 'branches',
  users: 'users',
  supervisorBranches: 'supervisor-branches',
  ushers: 'ushers',
  sessions: 'sessions',
  breaks: 'breaks',
  supervisorLogs: 'supervisor-logs',
  invoices: 'invoices',
  feedback: 'feedback',
} as const;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DAY = 86_400_000;

/** Moves every ISO timestamp forward by whole days so the demo data always ends "today". */
function shiftDates(value: unknown, ms: number): unknown {
  if (typeof value === 'string' && ISO_RE.test(value)) {
    const t = Math.min(Date.parse(value) + ms, Date.now());
    return new Date(t).toISOString();
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, ms));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = shiftDates(v, ms);
    }
    return out;
  }
  return value;
}

async function loadJson(name: string): Promise<unknown> {
  const url = new URL(`assets/mock/${name}.json`, document.baseURI);
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Mock data missing: ${name}`);
  return res.json();
}

let dbPromise: Promise<MockDb> | null = null;

export function getMockDb(): Promise<MockDb> {
  dbPromise ??= (async () => {
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, file]) => [key, await loadJson(file)] as const)
    );
    const raw = Object.fromEntries(entries) as Record<string, unknown>;
    const meta = raw['meta'] as { generatedAt: string };
    const startOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const shiftDays = Math.max(0, Math.round((startOf(Date.now()) - startOf(Date.parse(meta.generatedAt))) / DAY));
    const shifted = shiftDates(raw, shiftDays * DAY) as Record<string, unknown>;
    delete shifted['meta'];
    return shifted as unknown as MockDb;
  })();
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}
