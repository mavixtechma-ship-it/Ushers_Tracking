import { Directive } from '@angular/core';
import { TableLazyLoadEvent } from 'primeng/table';
import { PagedResult } from '../../core/models/models';
import { QueryParams } from '../../core/services/data.service';

/**
 * Shared server-paged list behaviour for p-table [lazy] pages: paging, sorting, filter reset,
 * debounced search and stale-response protection. Pages only implement fetch().
 */
@Directive()
export abstract class LazyList<T> {
  rows: T[] = [];
  total = 0;
  loading = true;
  first = 0;
  pageSize = 10;
  error = false;
  private sortField?: string;
  private sortOrder = 1;
  private seq = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected abstract fetch(q: QueryParams): Promise<PagedResult<T>>;
  protected afterLoad(_res: PagedResult<T>): void {}

  onLazy(e: TableLazyLoadEvent): void {
    this.first = e.first ?? 0;
    this.pageSize = e.rows ?? this.pageSize;
    this.sortField = typeof e.sortField === 'string' ? e.sortField : undefined;
    this.sortOrder = e.sortOrder ?? 1;
    void this.load();
  }

  /** Call when a filter changes. */
  refilter(): void {
    this.first = 0;
    void this.load();
  }

  /** Debounced variant for text inputs. */
  searchChanged(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.refilter(), 300);
  }

  protected baseQuery(page = Math.floor(this.first / this.pageSize) + 1, pageSize = this.pageSize): QueryParams {
    return { page, pageSize, sortField: this.sortField, sortOrder: this.sortField ? this.sortOrder : undefined };
  }

  async load(): Promise<void> {
    const id = ++this.seq;
    this.loading = true;
    this.error = false;
    try {
      const res = await this.fetch(this.baseQuery());
      if (id !== this.seq) return;
      this.rows = res.items;
      this.total = res.totalItems;
      this.afterLoad(res);
    } catch {
      if (id === this.seq) this.error = true;
    } finally {
      if (id === this.seq) this.loading = false;
    }
  }

  /** Fetches every row matching current filters (for CSV export). */
  protected async fetchAll(): Promise<T[]> {
    const res = await this.fetch({ ...this.baseQuery(1, 1000) });
    return res.items;
  }
}
