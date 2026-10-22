import { Injectable, signal } from '@angular/core';

const KEY = 'fp.theme';

/** Light/dark theme. Preference kept in localStorage (per-viewer convenience only). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(this.initial());

  constructor() {
    this.apply(this.dark());
  }

  toggle(): void {
    const next = !this.dark();
    this.dark.set(next);
    this.apply(next);
    try { localStorage.setItem(KEY, next ? 'dark' : 'light'); } catch { /* storage unavailable */ }
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('app-dark', dark);
  }

  private initial(): boolean {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'dark' || saved === 'light') return saved === 'dark';
    } catch { /* storage unavailable */ }
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
