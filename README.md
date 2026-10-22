# FieldPulse

Field-staff attendance and sales admin — a portfolio demo. Promoters check in and out at
geofenced branches, take breaks and record in-store sales; supervisors visit branches and leave
feedback. Admins manage branches, sectors, agencies, staff and back-office users.

All data is fictional and served in the browser — there is no backend.

## Run

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build in dist/fieldpulse
```

Sign in with `admin` (full access) or `viewer` (read-only). Passwords are in the git-ignored
`CREDENTIALS.md`. To rotate one: `npm run hash-password -- "<new password>"` and paste the output
into `src/app/core/auth/users.config.ts`.

## Stack

- Angular 19 (standalone components, signals, functional guards and interceptors)
- PrimeNG 19 with a custom Aura preset (indigo-violet), PrimeIcons
- Tailwind CSS 3 + `tailwindcss-primeui`
- Chart.js via PrimeNG `p-chart`
- Inter, self-hosted through `@fontsource/inter` (no third-party requests)

## How it works

| Piece | Where |
|---|---|
| Mock REST backend (`/mock-api/*`), paging, search, filters, sorting, in-memory writes | `src/app/core/mock/` |
| Seed data (12 branches, 40 staff, 150 sessions, 100 invoices, …) | `src/assets/mock/*.json` |
| Demo accounts (salted PBKDF2-SHA256 hashes, verified with WebCrypto) | `src/app/core/auth/` |
| Route access per role (`canMatch` + `canActivate`) | `src/app/core/guards/auth.guard.ts`, `core/auth/roles.ts` |
| API client (HttpParams, encoded ids) | `src/app/core/services/data.service.ts` |
| Shared UI (page header, KPI tile, status pill, lazy table base, temp-password dialog) | `src/app/shared/ui/` |

Timestamps in the seed data are shifted on load so the newest records always fall on "today".
Writes (create, edit, toggle, delete) live only for the browser tab. The viewer account gets
`403` from the mock backend on any write, and every write control is hidden or disabled for it.

## Security notes

- Strict CSP in `index.html` (`script-src 'self'`, no remote hosts), `no-referrer`.
- No `innerHTML` or `bypassSecurityTrust*`; all data goes through Angular bindings.
- Query strings built with `HttpParams`; CSV exports escape formula prefixes (`= + - @`).
- Production builds ship without source maps.
- This is a demo access gate: any client-only login can be bypassed by someone with devtools.
  A real deployment needs server-side authentication and authorisation.

See `PROJECT_ANALYSIS.md` for the full before/after analysis.
