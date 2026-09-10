import { Printer, Download, Mail } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import type { ActivityEntry } from "./activity-timeline";
import type { ActivityUser } from "./user-identity-card";

interface ActivityExportActionsProps {
  user: ActivityUser;
  activities: ActivityEntry[];
  t: (key: string) => string;
  tc: (key: string) => string;
}

export function ActivityExportActions({ user, activities, t, tc }: ActivityExportActionsProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const csvContent = [
      ["Organization: MedCore HMS", "123 Health Ave", "+1 234 567 8900", ""],
      [""],
      [tc('date'), tc('time'), t('action'), tc('performed_by'), t('details')],
      ...activities.map((a) => {
        const date = new Date(a.timestamp);
        return [
          format(date, "yyyy-MM-dd"),
          format(date, "HH:mm:ss"),
          `"${a.action.replace(/"/g, '""')}"`,
          `"${(a.isSelf ? tc('self') : a.actorName).replace(/"/g, '""')}"`,
          `"${(a.details ?? '').replace(/"/g, '""')}"`,
        ];
      }),
    ].map((e) => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_log_${user.id}_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
        <Printer className="w-4 h-4" /> {t('print_report')}
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload} disabled={activities.length === 0}>
        <Download className="w-4 h-4" /> {t('export_csv')}
      </Button>
      <a
        href={`mailto:?subject=Audit Log for ${user.fullName}&body=Please find the attached audit logs.%0A%0AOrganization: MedCore HMS%0A123 Health Ave, Medical City`}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2"
      >
        <Mail className="w-4 h-4" /> {t('email_report')}
      </a>
    </div>
  );
}
