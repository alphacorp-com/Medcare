"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { DatabaseBackup, Download, Loader2, AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

type BackupCheck = { available: boolean; reason: "database_not_configured" | "pg_dump_missing" | null; pgDumpVersion: string | null };

// Settings > Backup: downloads a full pg_dump of this install's database
// (GET /api/v1/settings/database, administrators only, audited). The browser downloads the
// stream directly, so a large database is never held in memory by the page.
export function DatabaseBackupSettings() {
  const t = useTranslations("settings.backup");
  const check = useQuery({
    queryKey: ["settings", "backup-check"],
    queryFn: () => apiFetch<BackupCheck>("/api/v1/settings/database?check=1"),
  });

  return (
    <div className="bg-white rounded-2xl md:rounded border border-slate-200 shadow-sm p-4 md:p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <DatabaseBackup className="h-5 w-5 text-blue-600" /> {t("title")}
        </h2>
        <p className="text-xs text-slate-500 mt-1">{t("description")}</p>
      </div>

      <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
        <li>{t("point_content")}</li>
        <li>{t("point_restore")}</li>
        <li>{t("point_storage")}</li>
        <li>{t("point_limit")}</li>
      </ul>

      {check.isPending ? (
        <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t("checking")}</div>
      ) : check.isError || !check.data?.available ? (
        <div className="flex gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t(check.data?.reason === "database_not_configured" ? "unavailable_database" : "unavailable_pg_dump")}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {/* A plain link: the browser streams the file to disk with the session cookie. */}
          <a href="/api/v1/settings/database" download className={buttonVariants({ className: "text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white" })}>
            <Download className="mr-2 h-4 w-4" /> {t("download")}
          </a>
          <span className="text-[10px] text-slate-400 font-mono">{check.data.pgDumpVersion}</span>
        </div>
      )}
    </div>
  );
}
