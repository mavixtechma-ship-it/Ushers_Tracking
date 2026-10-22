/** Local YYYY-MM-DD for API date filters. */
export function toYmd(d: Date | null | undefined): string | undefined {
  if (!d) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Converts a p-datepicker range value to dateFrom / dateTo params. */
export function rangeParams(range: (Date | null)[] | null | undefined): { dateFrom?: string; dateTo?: string } {
  if (!range || !range[0]) return {};
  return { dateFrom: toYmd(range[0]), dateTo: toYmd(range[1] ?? range[0]) };
}

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

/** "5 minutes ago" style label. */
export function relativeTime(iso?: string | null): string {
  if (!iso) return 'Never';
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (!rtf) return new Date(iso).toLocaleString();
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function minutesToHours(min?: number | null): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
