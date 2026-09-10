"use client";

import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Activity, ShieldAlert, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { UserIdentityCard, type ActivityUser } from "@/components/settings/activity/user-identity-card";
import { ActivityTimeline, type ActivityEntry } from "@/components/settings/activity/activity-timeline";
import { ActivityExportActions } from "@/components/settings/activity/activity-export-actions";

export default function UserActivityPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const tr = useTranslations('roles');
  const params = useParams();
  const router = useRouter();

  const userId = params.id as string;
  const [user, setUser] = useState<ActivityUser | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [userRes, activityRes] = await Promise.all([
          fetch(`/api/v1/users/${userId}`),
          fetch(`/api/v1/users/${userId}/activity`),
        ]);

        if (cancelled) return;

        if (userRes.status === 403 || activityRes.status === 403) {
          setForbidden(true);
          return;
        }

        setUser(userRes.ok ? await userRes.json() : null);
        setActivities(activityRes.ok ? await activityRes.json() : []);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm mt-4">Loading user profile...</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <ShieldAlert className="w-12 h-12 mb-4 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-700">{tc('restricted_access')}</h2>
        <p className="text-sm mt-2">{tc('contact_admin')}</p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/settings')}>{t('back_to_users')}</Button>
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

  return (
    <div className="flex flex-col h-full space-y-6 max-w-7xl mx-auto w-full pb-12 pt-4 px-4 sm:px-6">

      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings')} className="text-slate-500 hover:text-slate-900 -ml-2 print:hidden">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('back_to_users')}
        </Button>
        <ActivityExportActions user={user} activities={activities} t={t} tc={tc} />
      </div>

      <UserIdentityCard user={user} t={t} tc={tc} tr={tr} />

      <div className="flex items-center gap-3 pb-2 border-b border-slate-200 mt-8">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Activity className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{t('audit_history')}</h2>
          <p className="text-xs text-slate-500">{t('audit_history_desc')}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <ActivityTimeline activities={activities} t={t} tc={tc} />
      </div>

    </div>
  );
}
