// Server-side pagination for list endpoints: ?page=1&pageSize=20. Values outside the
// allowed range are clamped rather than rejected, so a stale or hand-edited URL still
// returns a sensible page; pageSize is capped so a client can't ask for the whole table.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

function positiveInt(value: string | null, fallback: number): number {
  const n = value === null ? Number.NaN : Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function parsePagination(searchParams: URLSearchParams, defaultPageSize = DEFAULT_PAGE_SIZE): Pagination {
  const page = positiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(positiveInt(searchParams.get("pageSize"), defaultPageSize), MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export interface PagedResponse<T, C = undefined> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  // Per-filter totals for tabs/tiles, independent of the current filter and search.
  counts?: C;
}
