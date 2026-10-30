"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Loading state of a whole screen (route transitions, the app shell before it knows whether it
// is on a phone): a modest spinner centred in the available space — never a 128px ring stuck
// to the top on a phone — announced to screen readers.
export function PageLoader({ fullScreen = false, className }: { fullScreen?: boolean; className?: string }) {
  const t = useTranslations("common");
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex w-full flex-1 flex-col items-center justify-center gap-3", fullScreen ? "min-h-dvh" : "min-h-[50vh]", className)}
    >
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" aria-hidden="true" />
      <span className="text-xs font-medium text-slate-500">{t("loading")}</span>
    </div>
  );
}
