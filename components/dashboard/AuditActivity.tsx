"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Shield, AlertTriangle, Info, CheckCircle } from "lucide-react";

interface AuditItem {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  severity: string;
}

export function AuditActivity() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [activities, setActivities] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/audit');
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || t('failed_fetch_audit_activities'));
        }

        setActivities(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : tc('unknown_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    // Refresh every 5 minutes
    const interval = setInterval(fetchActivities, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return <AlertTriangle className="w-3 h-3 text-red-500" />;
      case 'medium':
        return <Shield className="w-3 h-3 text-yellow-500" />;
      case 'low':
        return <Info className="w-3 h-3 text-blue-500" />;
      default:
        return <CheckCircle className="w-3 h-3 text-green-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) { // 24 hours
      const hours = Math.floor(diffMins / 60);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-800">
          {t('audit_activity')}
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full font-normal italic">
            {t('last_24h')}
          </span>
        </h2>
        <button className="p-1.5 hover:bg-slate-100 rounded border border-slate-200 text-xs">
          {tc('filter')}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse text-slate-500 text-sm">{t('loading_audit_activity')}</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 text-sm">{t('failed_load_audit_activity')}</div>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-slate-500 text-sm">{t('no_audit_activity')}</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getSeverityIcon(activity.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-900 truncate">
                        {activity.user}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mb-1">
                      <span className="font-medium">{activity.action}</span> on {activity.resource}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {activity.details}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 shrink-0">
        <span>{t('showing')} {activities.length} {tc('activities')}</span>
        <div className="flex gap-4">
          <a href="#" className="text-blue-600 font-semibold cursor-pointer hover:underline">
            {t('view_all')}
          </a>
          <a href="#" className="text-blue-600 font-semibold cursor-pointer hover:underline">
            {tc('export')}
          </a>
        </div>
      </div>
    </div>
  );
}
