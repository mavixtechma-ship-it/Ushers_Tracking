import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import { LogoComponent } from '../../shared/ui/logo.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, InputTextModule, PasswordModule, ButtonModule, MessageModule, IconFieldModule, InputIconModule, LogoComponent],
  template: `
    <div class="login">
      <section class="hero" aria-hidden="true">
        <fp-logo [light]="true" [size]="40" />
        <div class="hero-copy">
          <h2>Know who is on the floor, right now.</h2>
          <p>Shift check-ins, supervisor visits and in-store sales from every branch, in one calm workspace.</p>
          <ul>
            <li><i class="pi pi-map-marker"></i> Geofenced check-in and check-out with photo proof</li>
            <li><i class="pi pi-chart-line"></i> Live attendance and 14-day trends</li>
            <li><i class="pi pi-receipt"></i> Sales and supervisor feedback in one place</li>
          </ul>
        </div>
        <svg class="pulse" viewBox="0 0 600 120" preserveAspectRatio="none">
          <path d="M0 70 H140 L170 30 L210 105 L245 45 L270 80 L300 70 H600" />
        </svg>
        <small class="hero-foot">Demo build · fictional data</small>
      </section>

      <section class="panel">
        <div class="panel-top">
          <span class="mobile-logo"><fp-logo [size]="32" /></span>
          <span class="flex-1"></span>
          <p-button [icon]="theme.dark() ? 'pi pi-sun' : 'pi pi-moon'" [text]="true" [rounded]="true" severity="secondary"
            [ariaLabel]="theme.dark() ? 'Switch to light mode' : 'Switch to dark mode'" (onClick)="theme.toggle()" />
        </div>

        <form class="form" (ngSubmit)="submit()" #f="ngForm" autocomplete="on" novalidate>
          <h1 class="text-3xl font-semibold tracking-tight m-0">Sign in</h1>
          <p class="fp-muted mt-2 mb-6">Use your FieldPulse workspace account.</p>

          @if (auth.loginMessage(); as msg) {
            <p-message severity="info" [text]="msg" styleClass="mb-4 w-full" />
          }
          @if (error()) {
            <p-message severity="error" [text]="error()!" styleClass="mb-4 w-full" />
          }

          <label for="username" class="block font-medium mb-2">Username</label>
          <p-iconfield styleClass="w-full mb-4">
            <p-inputicon styleClass="pi pi-user" />
            <input pInputText id="username" name="username" [(ngModel)]="username" required maxlength="64"
              autocomplete="username" autocapitalize="none" spellcheck="false" class="w-full" />
          </p-iconfield>

          <label for="password" class="block font-medium mb-2">Password</label>
          <p-password inputId="password" name="password" [(ngModel)]="password" [feedback]="false" [toggleMask]="true"
            [maxLength]="256" autocomplete="current-password" [fluid]="true" styleClass="mb-6" />

          <p-button type="submit" label="Sign in" icon="pi pi-arrow-right" iconPos="right" [loading]="busy()"
            [disabled]="!username || !password" styleClass="w-full" />

          <p class="fp-muted text-xs mt-6 mb-0">Demo accounts: <strong>admin</strong> (full access) and
            <strong>viewer</strong> (read-only). Passwords are in the project's <code>CREDENTIALS.md</code>.</p>
        </form>
      </section>
    </div>
  `,
  styles: [`
    .login { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); background: var(--fp-surface); }
    .hero { position: relative; overflow: hidden; display: flex; flex-direction: column; padding: 40px 48px; color: #fff;
      background: radial-gradient(120% 90% at 0% 0%, #7c5cff 0%, #4c27cc 45%, #1f114f 100%); }
    .hero-copy { margin-top: auto; max-width: 30rem; position: relative; z-index: 1; }
    .hero h2 { font-size: 2.25rem; line-height: 1.15; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 12px; }
    .hero p { opacity: .85; margin: 0 0 24px; font-size: 1rem; }
    .hero ul { list-style: none; padding: 0; margin: 0 0 40px; display: grid; gap: 12px; }
    .hero li { display: flex; gap: 12px; align-items: center; opacity: .92; }
    .hero li i { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px; background: rgb(255 255 255 / .14); }
    .pulse { position: absolute; inset-inline: 0; top: 34%; width: 100%; height: 120px; opacity: .22; }
    .pulse path { fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .hero-foot { opacity: .6; }
    .panel { display: flex; flex-direction: column; padding: 24px 32px; background: var(--fp-bg); }
    .panel-top { display: flex; align-items: center; }
    .mobile-logo { display: none; }
    .form { margin: auto; width: 100%; max-width: 380px; padding-block: 32px; }
    @media (max-width: 900px) {
      .login { grid-template-columns: 1fr; }
      .hero { display: none; }
      .mobile-logo { display: inline-flex; }
      .panel { padding: 16px; }
    }
  `],
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  async submit() {
    if (!this.username || !this.password || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const res = await this.auth.login(this.username, this.password);
    this.password = '';
    this.busy.set(false);
    if (res.ok) this.router.navigate(['/dashboard'], { replaceUrl: true });
    else this.error.set(res.error ?? 'Sign-in failed.');
  }
}
