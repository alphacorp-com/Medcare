"use client";

import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  action: string;
  resourceType?: string | null;
  actorName: string;
  isSelf: boolean;
  details?: string | null;
}

interface ActivityTimelineProps {
  activities: ActivityEntry[];
  t: (key: string) => string;
  tc: (key: string) => string;
}

export function ActivityTimeline({ activities, t, tc }: ActivityTimelineProps) {
  const isMobile = useIsMobile();

  if (activities.length === 0) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
        <Calendar className="w-10 h-10 mb-3 text-slate-200" />
        <p className="text-sm font-medium">{t('no_activity')}</p>
        <p className="text-xs mt-1 text-slate-400">{t('no_activity_desc')}</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ul className="divide-y divide-slate-100">
        {activities.map((act) => (
          <li key={act.id} className="p-3 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words text-sm font-medium text-slate-800">{act.action}</span>
              <span className="shrink-0 text-[11px] text-slate-400">
                {format(new Date(act.timestamp), "MMM d, yyyy · h:mm a")}
              </span>
            </div>
            <div className="text-xs text-slate-500">{act.isSelf ? tc('self') : act.actorName}</div>
            {act.details && <div className="break-words text-xs text-slate-500">{act.details}</div>}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-slate-50">
        <TableRow>
          <TableHead className="w-48">{t('timestamp')}</TableHead>
          <TableHead className="w-64">{t('action')}</TableHead>
          <TableHead className="w-48">{tc('performed_by')}</TableHead>
          <TableHead>{t('details')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.map((act) => (
          <TableRow key={act.id}>
            <TableCell className="text-xs whitespace-nowrap">
              <span className="font-semibold text-slate-700">{format(new Date(act.timestamp), "MMM d, yyyy")}</span>
              <span className="text-slate-400 ml-2">{format(new Date(act.timestamp), "h:mm a")}</span>
            </TableCell>
            <TableCell>
              <span className="inline-flex font-medium text-sm text-slate-800">{act.action}</span>
            </TableCell>
            <TableCell className="text-xs text-slate-500">
              {act.isSelf ? tc('self') : act.actorName}
            </TableCell>
            <TableCell className="text-xs text-slate-500">
              {act.details ?? "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
