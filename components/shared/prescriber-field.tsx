"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Stethoscope } from "lucide-react";
import { Label } from "@/components/ui/label";

// Who prescribes an exam or a drug: always the signed-in user, shown here read-only. The server
// takes the prescriber from the session too (a prescriberId sent by the browser is ignored), so
// nobody can prescribe in someone else's name.
export function PrescriberField() {
  const t = useTranslations("admissions");
  const { data: session } = useSession();

  return (
    <div className="space-y-2.5">
      <Label className="text-xs font-bold uppercase text-slate-400 tracking-wider ml-1">{t("prescriber")}</Label>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 h-11">
        <Stethoscope className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="text-sm font-medium text-slate-800 truncate">{session?.user?.name ?? "—"}</span>
      </div>
      <p className="text-[11px] text-slate-500 ml-1">{t("prescriber_locked")}</p>
    </div>
  );
}
