import { Injectable, computed, signal } from '@angular/core';
import { AppRole, PAGE_ACCESS, WRITE_ROLES } from './roles';

export interface SessionUser {
  username: string;
  displayName: string;
  role: AppRole;
}

export interface StoredSession {
  user: SessionUser;
  expiresAt: number;
}

const STORAGE_KEY = 'fp.session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function isValidSession(v: unknown): v is StoredSession {
  const s = v as StoredSession;
  return !!s && typeof s.expiresAt === 'number' && !!s.user && typeof s.user.username === 'string'
    && (s.user.role === 'SuperAdmin' || s.user.role === 'Viewer');
}

/** Dependency-free session holder shared by AuthService, guards and the mock backend. */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly state = signal<StoredSession | null>(this.read());

  readonly session = this.state.asReadonly();
  readonly user = computed(() => this.state()?.user ?? null);
  readonly role = computed<AppRole | null>(() => this.state()?.user.role ?? null);
  readonly canWrite = computed(() => {
    const r = this.role();
    return !!r && WRITE_ROLES.includes(r);
  });

  isActive(): boolean {
    const s = this.state();
    if (!s) return false;
    if (Date.now() >= s.expiresAt) {
      this.clear();
      return false;
    }
    return true;
  }

  canAccess(page: string): boolean {
    const r = this.role();
    return !!r && PAGE_ACCESS[r].includes(page);
  }

  set(user: SessionUser): StoredSession {
    const s: StoredSession = { user, expiresAt: Date.now() + SESSION_TTL_MS };
    this.state.set(s);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
    return s;
  }

  clear(): void {
    this.state.set(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  }

  private read(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isValidSession(parsed) || Date.now() >= parsed.expiresAt) return null;
      return { user: { username: parsed.user.username, displayName: String(parsed.user.displayName), role: parsed.user.role }, expiresAt: parsed.expiresAt };
    } catch {
      return null;
    }
  }
}
