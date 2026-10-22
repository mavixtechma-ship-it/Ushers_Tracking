import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Requires a valid, unexpired session. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

/**
 * Real per-route role check (route data `page` is looked up in PAGE_ACCESS).
 * Used as canMatch so blocked pages' lazy chunks are not even loaded, and as canActivate for re-checks.
 */
const checkPage = (page: string | undefined) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (!page || auth.canAccess(page)) return true;
  return router.createUrlTree(['/forbidden']);
};

export const roleMatchGuard: CanMatchFn = (route: Route, _segments: UrlSegment[]) => checkPage(route.data?.['page']);
export const roleGuard: CanActivateFn = (route) => checkPage(route.data?.['page']);
