import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { SessionStore, SessionUser } from '../auth/session.store';

interface LoginResponse {
  user: SessionUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(SessionStore);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly currentUser = this.store.user;
  readonly canWrite = this.store.canWrite;
  readonly isAdmin = computed(() => this.store.role() === 'SuperAdmin');
  readonly loginMessage = signal<string | null>(null);

  constructor() {
    if (this.store.isActive()) this.scheduleExpiry();
  }

  isLoggedIn(): boolean {
    return this.store.isActive();
  }

  canAccess(page: string): boolean {
    return this.store.canAccess(page);
  }

  async login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await firstValueFrom(this.http.post<LoginResponse>(`${API_BASE_URL}/Auth`, { username, password }));
      this.store.set(res.user);
      this.loginMessage.set(null);
      this.scheduleExpiry();
      return { ok: true };
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : 0;
      if (status === 429) return { ok: false, error: 'Too many failed attempts. Please wait 30 seconds and try again.' };
      if (status === 401) return { ok: false, error: 'Invalid username or password.' };
      return { ok: false, error: 'Sign-in is unavailable right now. Please try again.' };
    }
  }

  logout(message: string | null = null): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.store.clear();
    this.loginMessage.set(message);
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  private scheduleExpiry(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const s = this.store.session();
    if (!s) return;
    const ms = Math.max(0, s.expiresAt - Date.now());
    this.expiryTimer = setTimeout(() => this.logout('Your session expired. Please sign in again.'), ms);
  }
}
