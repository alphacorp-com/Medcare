"use client";

import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useUsersStore } from "@/lib/store/useUsersStore";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, Activity, ShieldAlert, User as UserIcon, Calendar, Mail, Building2, ShieldCheck, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export default function UserActivityPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tr = useTranslations('roles');
  const params = useParams();
  const router = useRouter();
  
  const userId = params.id as string;
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const allActivities = useUsersStore(state => state.activities);
  const activities = allActivities.filter(a => a.userId === userId);

  useEffect(() => {
    fetch(`/api/v1/users/${userId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm mt-4">Loading user profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <ShieldAlert className="w-12 h-12 mb-4 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">{t('not_found')}</h2>
        <p className="text-sm mt-2">{t('not_found_desc')}</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/settings')}>{t('back_to_users')}</Button>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const csvContent = [
      ["Organization: MedCore HMS", "123 Health Ave", "+1 234 567 8900", ""],
      [""],
      [tc('date'), tc('time'), t('action'), t('details')],
      ...activities.map(a => {
        const date = new Date(a.timestamp);
        return [
          format(date, "yyyy-MM-dd"),
          format(date, "HH:mm:ss"),
          `"${a.action.replace(/"/g, '""')}"`,
          `"${a.details.replace(/"/g, '""')}"`
        ];
      })
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_log_${user.id}_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full space-y-6 max-w-7xl mx-auto w-full pb-12 pt-4 px-4 sm:px-6">
      
      {/* Header & Navigation */}
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="text-slate-500 hover:text-slate-900 -ml-2 print:hidden">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('back_to_users')}
        </Button>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> {t('print_report')}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload} disabled={activities.length === 0}>
            <Download className="w-4 h-4" /> {t('export_csv')}
          </Button>
          <a href={`mailto:?subject=Audit Log for ${user.fullName}&body=Please find the attached audit logs.%0A%0AOrganization: MedCore HMS%0A123 Health Ave, Medical City`} className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 gap-2">
            <Mail className="w-4 h-4" /> {t('email_report')}
          </a>
        </div>
      </div>

      {/* User Identity Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 md:items-center items-start">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold shrink-0">
          {user.fullName.charAt(0)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{user.fullName}</h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" /> {tr('admin')}</span>
            <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-slate-400" /> {user.email}</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-slate-400" /> {user.modules?.length || 0} {t('authorized')}</span>
          </div>
        </div>
        <div className="shrink-0 right-0 top-0 mt-4 md:mt-0 text-right">
          <span className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
            user.status === 'active' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
          )}>
            {tc(user.status)}
          </span>
          <p className="text-xs text-slate-400 mt-2">
            ID: <span className="font-mono">{user.id}</span>
          </p>
        </div>
      </div>

      {/* Activity Title */}
      <div className="flex items-center gap-3 pb-2 border-b border-slate-200 mt-8">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Activity className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t('audit_history')}</h2>
          <p className="text-xs text-slate-500">{t('audit_history_desc')}</p>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {activities.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
            <Calendar className="w-10 h-10 mb-3 text-slate-200" />
            <p className="text-sm font-medium">{t('no_activity')}</p>
            <p className="text-xs mt-1 text-slate-400">{t('no_activity_desc')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="w-48">{t('timestamp')}</TableHead>
                <TableHead className="w-64">{t('action')}</TableHead>
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
                    {act.details}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

    </div>
  );
}
