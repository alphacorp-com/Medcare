"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PagedResponse } from "@/lib/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { examQueryKeys, type ExamDomain } from "@/lib/exams/query-keys";

// Client side of the paged exam worklists (GET /api/v1/laboratory|radiology, see
// lib/exams/exam-list.ts) shared by the laboratory and radiology pages.

export type { ExamDomain };
export { examQueryKeys };
export type ExamWorklistResponse<T> = PagedResponse<T & { prescriberName: string | null }, Record<string, number>>;

export function useExamWorklist<T extends { id: string }>({
  domain,
  enabled,
  filter,
  search,
  page,
  pageSize,
}: {
  domain: ExamDomain;
  enabled: boolean;
  filter: string;
  search: string;
  page: number;
  pageSize: number;
}) {
  const queryClient = useQueryClient();
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const params = { filter, search: debouncedSearch, page, pageSize };

  const query = useQuery({
    queryKey: examQueryKeys.list(domain, params),
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter !== "All") qs.set("filter", filter);
      if (debouncedSearch) qs.set("search", debouncedSearch);
      return apiFetch<ExamWorklistResponse<T>>(`/api/v1/${domain}?${qs}`);
    },
    enabled,
    // Keep the current page on screen while the next one (or a new filter) loads.
    placeholderData: keepPreviousData,
  });

  return {
    exams: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    counts: query.data?.counts ?? {},
    isLoading: query.isPending,
    isError: query.isError,
    // After a prescription or a status change: refresh lists, counters and open details.
    refresh: () => queryClient.invalidateQueries({ queryKey: examQueryKeys.all(domain) }),
  };
}

// The exam shown in the detail sheet, loaded by id so it stays open and up to date even
// when it isn't (or no longer) on the current page — e.g. opened from a dashboard link,
// or moved to another state tab by the action just taken. The list row, when present,
// is shown immediately while the full record loads.
export function useExamDetail<T extends { id: string }>(domain: ExamDomain, id: string | null, listRow?: T) {
  const query = useQuery({
    queryKey: examQueryKeys.detail(domain, id),
    queryFn: () => apiFetch<T>(`/api/v1/${domain}/${encodeURIComponent(id ?? "")}`),
    enabled: Boolean(id),
  });
  return id ? (query.data ?? listRow ?? null) : null;
}
