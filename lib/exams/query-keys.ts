import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

// TanStack Query keys of the exam worklists. In a plain module (no "use client") so the
// server pages can prefetch under exactly the keys the client hooks read.

export type ExamDomain = "laboratory" | "radiology";

export interface ExamListParams {
  filter: string;
  search: string;
  page: number;
  pageSize: number;
}

// The worklist's state on first load (no filter, no search, first page). Must match the
// initial state of the laboratory/radiology pages for the server prefetch to be used.
export const INITIAL_EXAM_LIST_PARAMS: ExamListParams = { filter: "All", search: "", page: 1, pageSize: DEFAULT_PAGE_SIZE };

export const examQueryKeys = {
  all: (domain: ExamDomain) => ["exams", domain] as const,
  list: (domain: ExamDomain, params: ExamListParams) => ["exams", domain, "list", params] as const,
  detail: (domain: ExamDomain, id: string | null) => ["exams", domain, "detail", id] as const,
};
