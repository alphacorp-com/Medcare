"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";

interface SubscriptionStatus {
  isActive: boolean;
  source: "onprem_license" | "none";
  reason: string;
  validUntil: string | null;
  activeModules: Array<{
    moduleId: string;
    actions: string[];
  }>;
}

export function SubscriptionStatus() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/v1/licensing/status');
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || t('failed_fetch_subscription_status'));
        }

        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('unknown_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  const getTimeRemaining = () => {
    if (!status?.validUntil) return null;

    const now = new Date();
    const expiry = new Date(status.validUntil);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return { days: 0, hours: 0, expired: true };

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return { days, hours, expired: false };
  };

  const timeRemaining = getTimeRemaining();

  if (loading) {
    return (
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-slate-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-red-600 text-xs">
          <AlertTriangle className="h-4 w-4" />
          <span>{error || t('failed_load_subscription_status')}</span>
        </div>
      </div>
    );
  }

  // "Active" here means the on-prem guard hasn't blocked access yet — which
  // includes the grace period after validUntil has already passed. Treating
  // that as a plain green "Active" would contradict the fact that the raw
  // license period is over, so it gets its own amber, clearly-labeled state
  // instead of being silently folded into either "Active" or "Expired".
  const isInGracePeriod = status.isActive && Boolean(timeRemaining?.expired);

  const getStatusIcon = () => {
    if (!status.isActive) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (isInGracePeriod) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (timeRemaining && timeRemaining.days <= 7) return <Clock className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusColor = () => {
    if (!status.isActive) return 'text-red-600 bg-red-50 border-red-200';
    if (isInGracePeriod) return 'text-amber-700 bg-amber-50 border-amber-200';
    if (timeRemaining && timeRemaining.days <= 7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  return (
    <div className={`p-4 rounded border shadow-sm ${getStatusColor()}`}>
      <div className="flex items-center gap-2 mb-3">
        {getStatusIcon()}
        <h3 className="text-xs font-bold uppercase tracking-wider">
          {t('subscription_status')}
        </h3>
      </div>

      <div className="space-y-2">
        <div className="text-xs">
          <span className="font-medium">{t('status')}:</span>{' '}
          <span className={`font-semibold ${!status.isActive ? 'text-red-600' : isInGracePeriod ? 'text-amber-700' : 'text-green-600'}`}>
            {!status.isActive ? tc('inactive') : isInGracePeriod ? t('grace_period') : tc('active')}
          </span>
        </div>

        {status.source !== 'none' && (
          <div className="text-xs">
            <span className="font-medium">{t('type')}:</span>{' '}
            <span className="capitalize">{t('license_key')}</span>
          </div>
        )}

        {timeRemaining && !timeRemaining.expired && (
          <div className="text-xs">
            <span className="font-medium">{t('expires_in')}:</span>{' '}
            <span className="font-semibold">
              {timeRemaining.days > 0 ? `${timeRemaining.days}${t('days_short')} ${timeRemaining.hours}${t('hours_short')}` : `${timeRemaining.hours}${t('hours_short')}`}
            </span>
          </div>
        )}

        {isInGracePeriod && (
          <div className="text-xs text-amber-700">{t('grace_period_warning')}</div>
        )}

        {!status.isActive && timeRemaining?.expired && (
          <div className="text-xs">
            <span className="font-medium text-red-600">{t('expired')}</span>
          </div>
        )}

        {status.activeModules && status.activeModules.length > 0 && (
          <div className="text-xs mt-3 pt-2 border-t border-current border-opacity-20">
            <span className="font-medium">{t('active_modules')}:</span>{' '}
            <span className="text-[10px]">
              {status.activeModules.length} {tc('modules')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}