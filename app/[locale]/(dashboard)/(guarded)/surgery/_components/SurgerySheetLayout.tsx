"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Siren } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Surgery } from "../types";

// Shared frame of the surgery sheets: a header that always says which patient and which
// intervention the sheet is about, a scrolling body of sections, and a footer whose actions
// stay visible however long the form is.

export const surgeryInputClass =
  "flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:bg-slate-50 disabled:text-slate-500";
export const surgerySelectClass = cn(surgeryInputClass, "h-9 py-1");

export function SurgerySheet({
  open,
  onOpenChange,
  title,
  description,
  surgery,
  footer,
  width = "sm:max-w-xl",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  surgery?: Surgery | null;
  footer?: ReactNode;
  width?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("w-full p-0 flex flex-col gap-0 bg-slate-50", width)}>
        <SheetHeader className="px-5 py-4 border-b border-slate-200 bg-white shrink-0 space-y-1 text-left">
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description && <SheetDescription className="text-xs">{description}</SheetDescription>}
          {surgery && <SurgeryContext surgery={surgery} />}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 flex flex-wrap justify-end gap-2">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

function SurgeryContext({ surgery }: { surgery: Surgery }) {
  const t = useTranslations("surgery");
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-slate-900">
          {surgery.patient.firstName} {surgery.patient.lastName}
        </span>
        <span className="font-mono text-slate-500">IPP {surgery.patient.ipp}</span>
        {surgery.isEmergency && (
          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
            <Siren className="h-3 w-3" /> {t("emergency")}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-slate-700">{surgery.procedureLabel}</div>
      <div className="mt-0.5 text-slate-500">
        {surgery.scheduledAt ? format(new Date(surgery.scheduledAt), "dd/MM/yyyy HH:mm") : "—"}
        {surgery.roomLabel ? ` · ${surgery.roomLabel}` : ""}
        {surgery.expectedDurationMinutes ? ` · ${t("duration_minutes", { minutes: surgery.expectedDurationMinutes })}` : ""}
      </div>
    </div>
  );
}

export function SheetSection({
  icon: Icon,
  title,
  hint,
  aside,
  children,
  tone = "default",
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
  tone?: "default" | "done" | "warning";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-white p-4 space-y-3 shadow-sm",
        tone === "done" ? "border-green-200" : tone === "warning" ? "border-amber-200" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {Icon && (
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                tone === "done" ? "bg-green-50 text-green-600" : tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

export function SheetError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
