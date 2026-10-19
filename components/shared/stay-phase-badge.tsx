"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Where the patient currently is in their journey, derived from the three statuses a stay
// carries (stay, consultation, hospitalisation). The stay status alone says "in progress"
// for a patient waiting at the cashier, in the doctor's office or in a hospital bed alike.
export type StayPhase =
  | "pre_admission"
  | "awaiting_payment"
  | "admitted"
  | "in_consultation"
  | "consulted"
  | "awaiting_hospitalization"
  | "hospitalized"
  | "discharged"
  | "transferred"
  | "deceased";

export type StayPhaseInput = {
  status: string;
  consultationStatus?: string | null;
  hospitalizationStatus?: string | null;
};

// Most advanced event first: an ended stay, then hospitalisation, then the consultation.
export function deriveStayPhase(stay: StayPhaseInput): StayPhase {
  if (stay.status === "discharged" || stay.status === "transferred" || stay.status === "deceased") return stay.status;
  if (stay.status === "pre_admission") return "pre_admission";
  if (stay.hospitalizationStatus === "admitted") return "hospitalized";
  if (stay.hospitalizationStatus === "awaiting_payment") return "awaiting_hospitalization";
  switch (stay.consultationStatus) {
    case "claimed":
      return "in_consultation";
    case "awaiting_payment":
      return "awaiting_payment";
    case "completed":
      return "consulted";
    default:
      // "waiting" (paid, in the doctor's queue) — or no consultation tracked at all.
      return "admitted";
  }
}

const PHASE_CLASS: Record<StayPhase, string> = {
  pre_admission: "bg-slate-100 text-slate-600 ring-slate-200",
  awaiting_payment: "bg-amber-100 text-amber-800 ring-amber-200",
  admitted: "bg-sky-100 text-sky-700 ring-sky-200",
  in_consultation: "bg-violet-100 text-violet-700 ring-violet-200",
  consulted: "bg-teal-100 text-teal-700 ring-teal-200",
  awaiting_hospitalization: "bg-amber-100 text-amber-800 ring-amber-200",
  hospitalized: "bg-blue-100 text-blue-800 ring-blue-200",
  discharged: "bg-green-100 text-green-700 ring-green-200",
  transferred: "bg-slate-100 text-slate-600 ring-slate-200",
  deceased: "bg-slate-800 text-white ring-slate-800",
};

export function StayPhaseBadge({ stay, className }: { stay: StayPhaseInput; className?: string }) {
  const tc = useTranslations("common");
  const phase = deriveStayPhase(stay);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ring-1 whitespace-nowrap", PHASE_CLASS[phase], className)}>
      {tc(`phase_${phase}`)}
    </span>
  );
}
