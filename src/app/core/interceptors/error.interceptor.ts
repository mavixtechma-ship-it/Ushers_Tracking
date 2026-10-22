import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from '../services/auth.service';

/** Maps API errors to generic, user-safe messages. Never renders raw server bodies. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE_URL)) return next(req);
  const auth = inject(AuthService);
  const toast = inject(MessageService);
  const isLogin = req.url === `${API_BASE_URL}/Auth` && req.method === 'POST';

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !isLogin) {
        if (err.status === 401) {
          auth.logout('Your session has ended. Please sign in again.');
        } else if (err.status === 403) {
          toast.add({ severity: 'warn', summary: 'Read-only access', detail: 'Your account cannot make changes.' });
        } else if (err.status === 404) {
          toast.add({ severity: 'error', summary: 'Not found', detail: 'The requested record no longer exists.' });
        } else if (err.status === 400) {
          toast.add({ severity: 'error', summary: 'Check the form', detail: typeof err.error?.message === 'string' ? err.error.message.slice(0, 200) : 'Some fields are invalid.' });
        } else {
          toast.add({ severity: 'error', summary: 'Something went wrong', detail: 'Please try again.' });
        }
      }
      return throwError(() => err);
    })
  );
};
