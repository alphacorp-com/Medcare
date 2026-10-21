"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Shield, AlertTriangle, Info, CheckCircle } from "lucide-react";

interface AuditItem {
  id: string;
  timestamp: string;
  // Null when the actor has no name to show (system actor, deleted user, legacy admin).
  user: string | null;
  actorType: string;
  // Dotted code such as "appointment.created" — translated via audit.actions.*.
  action: string;
  resourceType: string | null;
  severity: string;
}

// Audit codes double as nested translation paths ("user.login" → audit.actions.user.login).
// Anything outside this charset is never used as a key, so a malformed code can't make
// next-intl resolve an unrelated message.
const AUDIT_CODE_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function AuditActivity() {
  const t = useTranslations('dashboard');
  const ta = useTranslations('audit');
  const locale = useLocale();
  const [activities, setActivities] = useState<AuditItem[]>([]);
  // When the list was fetched: relative times ("5 min ago") are computed against it, so
  // rendering stays pure and the labels refresh together with the data.
  const [fetchedAt, setFetchedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/audit');
        const result = await res.json();
        if (!res.ok) throw new Error(result.error ?? `HTTP ${res.status}`);
        setActivities(result.data);
        setFetchedAt(Date.now());
        setFailed(false);
      } catch (err) {
        console.error("[dashboard audit activity]", err);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    // Refresh every 5 minutes
    const interval = setInterval(fetchActivities, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const actionLabel = (code: string) => {
    const key = `actions.${code}`;
    if (AUDIT_CODE_RE.test(code) && ta.has(key)) return ta(key);
    // A code added without a translation yet: show it readably rather than as a raw key.
    return ta('unknown_action', { code: code.replace(/[._]/g, ' ') });
  };

  const actorLabel = (activity: AuditItem) =>
    activity.user ?? (activity.actorType === 'system' ? ta('system_actor') : ta('unknown_actor'));

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const diffMs = Math.max(0, fetchedAt - date.getTime());
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    if (diffMs < HOUR_MS) return relative.format(-Math.floor(diffMs / MINUTE_MS), 'minute');
    if (diffMs < DAY_MS) return relative.format(-Math.floor(diffMs / HOUR_MS), 'hour');
    return date.toLocaleDateString(locale);
  };

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

  return (
    <div className="flex flex-col bg-white rounded border border-slate-200 shadow-sm h-full overflow-hidden">
      <div className="p-3 lg:p-4 border-b border-slate-200 flex justify-between items-center gap-3 shrink-0">
        <h2 className="text-sm font-bold text-slate-800 truncate">{t('audit_activity')}</h2>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full shrink-0">
          {t('last_24h')}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-pulse text-slate-500 text-sm">{t('loading_audit_activity')}</div>
          </div>
        ) : failed ? (
          <div className="p-8 text-center">
            <div className="text-red-600 text-sm">{t('failed_load_audit_activity')}</div>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-slate-500 text-sm">{t('no_audit_activity')}</div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {activities.map((activity) => (
              <li key={activity.id} className="px-4 py-3 hover:bg-slate-50/50">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getSeverityIcon(activity.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs font-medium text-slate-900 truncate">{actorLabel(activity)}</span>
                      <time dateTime={activity.timestamp} className="text-[10px] text-slate-500 shrink-0">
                        {formatTimestamp(activity.timestamp)}
                      </time>
                    </div>
                    <div className="text-xs text-slate-600">{actionLabel(activity.action)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && !failed && activities.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 shrink-0">
          {ta('showing', { count: activities.length })}
        </div>
      )}
    </div>
  );
}
