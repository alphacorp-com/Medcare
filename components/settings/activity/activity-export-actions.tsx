"use client";

import { Printer, Download, Mail } from "lucide-react";
import { format } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePdfBranding } from "@/components/templates/usePdfBranding";
import { auditActionLabel, auditActorLabel, auditDetailLines } from "@/components/shared/audit-format";
import { downloadCsv } from "@/lib/csv";
import { printRegion } from "@/lib/print-region";
import { formatActivityDate, type ActivityEntry } from "./activity-timeline";
import type { ActivityUser } from "./user-identity-card";

interface ActivityExportActionsProps {
  user: ActivityUser;
  activities: ActivityEntry[];
  // The report (identity card + history) — printing is limited to it.
  printTarget: React.RefObject<HTMLElement | null>;
}

// mailto: bodies are limited by mail clients (~2 000 characters in practice), so the email
// carries a summary of the most recent entries; the CSV export holds the full history.
const EMAIL_ENTRY_LIMIT = 15;

export function ActivityExportActions({ user, activities, printTarget }: ActivityExportActionsProps) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const ta = useTranslations("audit");
  const locale = useLocale();
  // The organization configured in Settings — not a hardcoded placeholder.
  const { facility } = usePdfBranding();

  const organizationLine = [facility.name, facility.address, facility.phone].filter(Boolean).join(" — ");

  const handleDownload = () => {
    downloadCsv(`audit_log_${user.id}_${format(new Date(), "yyyyMMdd")}.csv`, [
      ...(organizationLine ? [[organizationLine], []] : []),
      [t("audit_history"), user.fullName, user.email],
      [],
      [tc("date"), tc("time"), t("action"), tc("performed_by"), t("details"), t("activity_csv_ip")],
      ...activities.map((a) => {
        const { day, time } = formatActivityDate(a.timestamp, locale);
        return [
          day,
          time,
          auditActionLabel(a.action, ta),
          auditActorLabel(a.actorName, a.actorType, ta),
          auditDetailLines(a.payload, ta).join(" · "),
          a.ipAddress ?? "",
        ];
      }),
    ]);
  };

  const emailHref = () => {
    const recent = activities.slice(0, EMAIL_ENTRY_LIMIT).map((a) => {
      const { day, time } = formatActivityDate(a.timestamp, locale);
      return `- ${day} ${time} — ${auditActionLabel(a.action, ta)} (${auditActorLabel(a.actorName, a.actorType, ta)})`;
    });
    const body = [
      t("activity_email_intro", { name: user.fullName, count: recent.length }),
      "",
      ...recent,
      ...(activities.length > EMAIL_ENTRY_LIMIT ? ["", t("activity_email_more", { count: activities.length - EMAIL_ENTRY_LIMIT })] : []),
      ...(facility.name ? ["", facility.name] : []),
    ].join("\n");
    const subject = t("activity_email_subject", { name: user.fullName });
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" className="gap-2" onClick={() => printRegion(printTarget.current)}>
        <Printer className="w-4 h-4" /> {t("print_report")}
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload} disabled={activities.length === 0}>
        <Download className="w-4 h-4" /> {t("export_csv")}
      </Button>
      {activities.length > 0 ? (
        <a href={emailHref()} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}>
          <Mail className="w-4 h-4" /> {t("email_report")}
        </a>
      ) : (
        <Button variant="outline" size="sm" className="gap-2" disabled>
          <Mail className="w-4 h-4" /> {t("email_report")}
        </Button>
      )}
    </div>
  );
}
