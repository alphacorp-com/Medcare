"use client";

import { Calendar } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { auditActionLabel, auditActorLabel, auditDetailLines } from "@/components/shared/audit-format";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  // Dotted audit code ("user.login"), translated for display.
  action: string;
  resourceType?: string | null;
  actorType?: string | null;
  // Null when there's no name to show (system actor, deleted user).
  actorName: string | null;
  // True when the user whose page this is performed the action (not "the viewer").
  isSelf: boolean;
  payload?: unknown;
  ipAddress?: string | null;
}

interface ActivityTimelineProps {
  activities: ActivityEntry[];
  t: (key: string) => string;
}

export function formatActivityDate(iso: string, locale: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
  };
}

export function ActivityTimeline({ activities, t }: ActivityTimelineProps) {
  const isMobile = useIsMobile();
  const locale = useLocale();
  const ta = useTranslations("audit");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");

  if (activities.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
        <Calendar className="w-10 h-10 mb-3 text-slate-200" />
        <p className="text-sm font-medium">{t("no_activity")}</p>
        <p className="text-xs mt-1 text-slate-400">{t("no_activity_desc")}</p>
      </div>
    );
  }

  const details = (act: ActivityEntry) => {
    const lines = auditDetailLines(act.payload, ta);
    if (act.ipAddress) lines.push(ts("activity_ip", { ip: act.ipAddress }));
    return lines;
  };

  if (isMobile) {
    return (
      <ul className="divide-y divide-slate-100">
        {activities.map((act) => {
          const { day, time } = formatActivityDate(act.timestamp, locale);
          return (
            <li key={act.id} className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-sm font-medium text-slate-800">{auditActionLabel(act.action, ta)}</span>
                <time dateTime={act.timestamp} className="shrink-0 text-[11px] text-slate-400">
                  {day} · {time}
                </time>
              </div>
              <div className="text-xs text-slate-500">{auditActorLabel(act.actorName, act.actorType, ta)}</div>
              {details(act).map((line, i) => (
                <div key={i} className="break-words text-xs text-slate-500">{line}</div>
              ))}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="w-48">{t("timestamp")}</TableHead>
          <TableHead className="w-64">{t("action")}</TableHead>
          <TableHead className="w-48">{tc("performed_by")}</TableHead>
          <TableHead>{t("details")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.map((act) => {
          const { day, time } = formatActivityDate(act.timestamp, locale);
          const lines = details(act);
          return (
            <TableRow key={act.id}>
              <TableCell className="text-xs whitespace-nowrap">
                <time dateTime={act.timestamp}>
                  <span className="font-semibold text-slate-700">{day}</span>
                  <span className="text-slate-400 ml-2">{time}</span>
                </time>
              </TableCell>
              <TableCell>
                <span className="inline-flex font-medium text-sm text-slate-800">{auditActionLabel(act.action, ta)}</span>
              </TableCell>
              <TableCell className="text-xs text-slate-500">{auditActorLabel(act.actorName, act.actorType, ta)}</TableCell>
              <TableCell className="text-xs text-slate-500">
                {lines.length === 0 ? "—" : lines.map((line, i) => <div key={i}>{line}</div>)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
