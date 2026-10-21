"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
// Same default as the server-side pagination (lib/pagination.ts).
export { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

// Page numbers to show around the current page, with null marking a gap ("…"):
// 1 … 4 5 [6] 7 8 … 20
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
}

// Footer for paginated lists: "21–40 sur 135", page size, and page navigation.
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
}) {
  const t = useTranslations("pagination");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const navButton = "inline-flex h-7 min-w-7 items-center justify-center rounded border px-2 text-[11px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className={cn("flex flex-col gap-2 border-t border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-3">
        <span>{t("range", { from, to, total })}</span>
        <label className="flex items-center gap-1">
          <span className="hidden sm:inline">{t("per_page")}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded border border-slate-200 bg-white px-1 text-[11px] text-slate-700 outline-none focus:border-blue-400"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      <nav className="flex items-center gap-1" aria-label={t("navigation")}>
        <button
          type="button"
          className={cn(navButton, "border-slate-200 bg-white hover:bg-slate-100")}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t("previous")}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                navButton,
                p === page ? "border-blue-600 bg-blue-600 font-semibold text-white" : "border-slate-200 bg-white hover:bg-slate-100"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          className={cn(navButton, "border-slate-200 bg-white hover:bg-slate-100")}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label={t("next")}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </nav>
    </div>
  );
}

// For lists already loaded in full and filtered client-side (lab, radiology).
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}
