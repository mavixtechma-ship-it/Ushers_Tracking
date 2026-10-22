# FieldPulse — Project Analysis

## 1. Purpose

Admin portal for a field workforce: promoters ("ushers") who check in and out at retail
branches, take breaks, record sales invoices, and are visited by supervisors who leave feedback.
Admins manage branches (geofenced locations), sectors, agencies (staffing partners), ushers,
system users and supervisor-to-branch assignments, and export reports as CSV.

## 2. Stack

| Area | Before | After |
|---|---|---|
| Framework | Angular 19 standalone, inline templates | Angular 19 standalone, inline templates |
| UI | A v5 CSS/JS component framework (global JS bundle), Font Awesome 6 from CDN | PrimeNG 19 + `@primeng/themes` (custom Aura preset, indigo/violet), PrimeIcons, Tailwind CSS 3 + `tailwindcss-primeui` |
| Charts | Chart.js used directly | Chart.js through PrimeNG `p-chart` |
| Fonts | browser defaults | Inter, self-hosted via `@fontsource/inter` |
| Backend | Real REST API at a hard-coded `https://localhost:…/api` host | None. Mock `HttpInterceptorFn` answers `/mock-api/*` from `src/assets/mock/*.json` |
| Auth | `fetch` POST `/Auth`, bearer token, first-login SetPassword flow | Two local demo accounts, PBKDF2-SHA256 hashes verified with WebCrypto |

## 3. Structure and routes (before)

```
src/app/
  core/        guards/auth.guard.ts, interceptors/auth.interceptor.ts,
               models/models.ts, services/auth.service.ts, services/data.service.ts
  layout/      main-layout.component.ts  (sidebar + navbar)
  shared/      pagination/, photo-viewer/
  features/    login, dashboard, branches, ushers, users, sessions,
               supervisor-logs, invoices, feedback, sectors, agencies
```

Routes: `/login`, then under the authenticated shell: `dashboard`, `branches`, `ushers`, `users`,
`sessions`, `supervisorlogs`, `invoices`, `feedback`, `sectors`, `agencies`, with `**` redirecting to `dashboard`.

## 4. Data models

`PagedResult<T>{items,totalItems}`, `Branch{id,name,address,sectorId,sectorName,latitude,longitude,geofence_range,is_active}`,
`Sector{id,name}`, `Agency{id,enName,arName}`, `Usher{id,name,phone,email,profile_photo_url,agency,supervisor_id,is_active,is_online,last_seen}`,
`AppUser{id,name,email,phone,role,title,agency,is_active}`, `Supervisor{id,name,email}`,
`SessionLog{id,usherName,branchName,agency,check_in_time,check_out_time,duration,BreaksDuration,status,reason,photos,sectorName}`,
`SupervisorLog`, `BreakItem`, `Invoice`, `Feedback`, `DashboardStats`.

## 5. Endpoints (before; all relative to the API base)

- Auth: `POST Auth`, `PUT Auth/SetPassword`, `PUT Auth/ResetPassword?id=`
- Dashboard: `GET DashBoard/Stats`
- Branches: `GET Branch/AllBranches`, `GET Branch/GetBranchById/{id}`, `POST Branch/CreateBranch`, `PUT Branch/{id}`,
  `DELETE Branch/{id}` (toggle), `GET Branch/GetBranchesBySupervisor/{id}`, `GET Branch/GetAllSector`, `POST Branch/AddSector`
- Agencies: `GET/POST Agency`, `GET/PUT/DELETE Agency/{id}`
- Ushers: `GET Usher`, `GET Usher/{id}`, `POST Usher/Create`, `PUT Usher/{id}`, `DELETE Usher/{id}` (toggle)
- Users: `GET User/AllUsers`, `GET/PUT User/{id}`, `POST User`, `DELETE User?id=` (toggle), `GET User/Supervisors`
- Supervisors: `POST Supervisors/AssignBranches`, `DELETE Supervisors/RemoveBranchAssignment`
- Sessions: `GET Sessions/LogsList`, `GET Sessions/{id}`, `GET Sessions/SupervisorsLogsList`, `GET Sessions/SupervisorLog/{id}`, `GET Sessions/GetFeedBack`
- Breaks: `GET Break/GetSessionBreaks`, `POST Break/StartBreak`
- Invoices: `GET Invoice/GetInvoices`, `GET Invoice/GetInvoiceById`

## 6. Sensitive and risky findings (before)

| Severity | Location | Finding |
|---|---|---|
| High | `user creation` and both reset-password confirms | Hard-coded shared default password for every new or reset account, shown in UI text |
| High | `ROLE_ACCESS` in auth.service | Role checks only hid sidebar links. Any logged-in user could open every route by URL |
| Medium | `API_BASE_URL` | Real development host and port hard-coded; photo URLs built from it |
| Medium | layout | User avatar loaded from a third-party avatar service (leaks user name, external request) |
| Medium | angular.json | Font Awesome from a CDN without SRI; UI framework JS bundle loaded globally |
| Medium | data.service | Unencoded `search`, `status`, `role` interpolated into query strings |
| Medium | all CSV exports | No formula-injection escaping (`=`, `+`, `-`, `@` prefixes) |
| Low | auth.service | Bearer token in `sessionStorage`; first-time SetPassword flow sent IDs from storage |
| Low | build | No CSP; source maps not explicitly disabled for production; `alert()` used to show raw server errors |
| Low | repo | Stray `src/package.json`, puppeteer script, a summary PDF and a docs HTML export with internal project information |
| Info | index.html | Referenced a `favicon.ico` that did not exist |

## 7. Transformation

### Rebrand and cleanup
- Renamed to **FieldPulse** everywhere: npm package `fieldpulse`, Angular project/output `dist/fieldpulse`, `<title>`, README, login and shell.
- Deleted stray files: `src/package.json` + lockfile, `src/scripts/` (puppeteer PDF script), `src/docs/summary.html`, the summary PDF and `src/node_modules`.
- Removed the hard-coded default password. Creating a user/staff member or resetting a password now makes the backend
  generate a 14-character `crypto.getRandomValues` password that the admin sees exactly once (`fp-temp-password-dialog`).
- Removed the third-party avatar service (local initials via `InitialsPipe` + `p-avatar`) and the API host; photos are local generated SVGs in `src/assets/mock/photos/`.
- Added an SVG logo (`fp-logo`, `src/assets/logo.svg`) and `src/favicon.svg`.

### Mock backend
- `src/assets/mock/*.json`: 5 sectors, 6 fictional agencies (English + Arabic names), 12 branches around a fictional city ("Riverton"),
  15 users, 40 staff, 150 sessions over 30 days, 159 breaks, 60 supervisor visits, 100 invoices, 50 feedback notes, supervisor→branch map.
  Names are invented, phones use the reserved `555-01xx` range, emails use `example.com`. Timestamps are shifted on load so data always ends today.
- `core/mock/mock-backend.interceptor.ts` (`HttpInterceptorFn`) answers every original endpoint path under `/mock-api`, with paging,
  search, filters, date ranges, sorting, field whitelisting on writes, validation errors, and in-memory persistence.
  No session → `401`; any non-GET from the viewer → `403`. Dashboard stats (KPIs, 14-day trend, top branches, on-shift list) are computed live.
- `auth.service` now uses `HttpClient` (`POST /mock-api/Auth`); the first-login SetPassword flow was removed.

### Auth and access control
- Two accounts only: `admin` (SuperAdmin) and `viewer` (read-only). `core/auth/users.config.ts` stores salted PBKDF2-SHA256
  (310,000 iterations) hashes; `core/auth/password.ts` verifies them with WebCrypto and a constant-time compare. Plaintext passwords exist only in git-ignored `CREDENTIALS.md`.
- Login throttling: 5 failures → 30-second lockout (`429`).
- Session `{user, expiresAt}` in `sessionStorage`, 8-hour expiry, validated on read, auto-logout timer.
- Route access is enforced by `roleMatchGuard` (`canMatch`, so blocked chunks aren't loaded) and `roleGuard` (`canActivate`) using `PAGE_ACCESS`;
  the viewer gets a `/forbidden` page for User accounts. Every create/edit/delete/reset/toggle control is hidden or disabled for the viewer.

### New UI
- Removed the old CSS/JS framework and Font Awesome CDN. Added PrimeNG 19 with a custom Aura preset (indigo-violet primary, violet-tinted neutrals),
  PrimeIcons, Tailwind 3 + `tailwindcss-primeui` (CSS layers ordered so utilities win), Inter via `@fontsource`.
- Shell: collapsible sidebar with grouped navigation (Home / Attendance / Sales / People / Network), off-canvas drawer on mobile,
  sticky top bar with breadcrumbs, read-only badge, dark/light toggle and user menu. Dark mode persists per browser.
- Pages: bento Overview (KPI strip, check-in trend line, live on-shift list, top-branches bar, workforce donut, 60-second auto-refresh);
  table-first pages built on a shared `LazyList` base (server paging, sorting, debounced search, filters, empty/error states);
  session details in a side drawer with photo preview and break timeline; invoices with summary KPIs and a detail dialog;
  feedback with a sentiment meter; supervisor branch coverage with a pick list; sectors as tiles; new split-screen login.
- Shared components in `src/app/shared/ui/`: page header, KPI tile, status pill (dot + text), initials pipe, temp-password dialog, logo.
- Toasts and confirm dialogs replace every `alert()`/`confirm()`.

### Security
- Query params built with `HttpParams`; numeric path ids passed through `encodeURIComponent`.
- CSV export (`core/util/csv.ts`) escapes cells starting with `= + - @ TAB CR` and quotes per RFC 4180; object URLs are revoked.
- CSP `<meta>`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (PrimeNG injects theme styles),
  `img-src 'self' data: blob:`, `connect-src 'self'` (+ `ws://localhost` for the dev server), `object-src 'none'`, `base-uri 'self'`,
  `form-action 'self'`; plus `referrer: no-referrer`. Critical-CSS inlining is off so no inline event handlers are emitted.
- No third-party requests at runtime (verified in a headless browser run). No `innerHTML` or `bypassSecurityTrust*`.
- Error interceptor shows generic messages; raw server bodies are never rendered. Session photo URLs are allow-listed to local mock assets.
- Production builds: `sourceMap: false`, optimisation on, output hashing on.

### Verification
- `npm run build`: succeeds with zero errors and zero warnings.
- Headless Chrome run against the production build: wrong password rejected; admin sees data on all 10 pages and can create, reset passwords and toggle;
  viewer is redirected from `/users` to `/forbidden`, sees no write controls, and a direct write through the data service returns `403`;
  no console errors; no external requests; no horizontal scroll at 390 px.
- Forbidden-string grep (excluding `node_modules`): no matches except Angular's own app-start function in `src/main.ts` (its name contains the old UI library's name; it is framework API, not the removed library). Build output (`dist`) was removed after verification.

### Known limits
- Client-only login is a demo gate: anyone with devtools can edit `sessionStorage` or the bundle. Real use needs server-side auth.
- `frame-ancestors` and HSTS can't be set via `<meta>`; set them as response headers on the host.
- `@primeng/themes` is deprecated upstream in favour of `@primeuix/themes`; it's still the package PrimeNG 19 documents.
