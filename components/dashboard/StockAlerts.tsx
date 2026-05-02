"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Package, Clock } from "lucide-react";

interface StockAlert {
  id: string;
  type: 'low_stock' | 'expiring';
  medication: string;
  currentStock?: number;
  reorderPoint?: number;
  unit?: string;
  expiryDate?: string;
  daysUntilExpiry?: number;
  severity: 'critical' | 'warning';
  message: string;
}

export function StockAlerts() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/stock-alerts');
        const result = await res.json();

        if (!res.ok) {
          throw new Error(result.error || t('failed_fetch_stock_alerts'));
        }

        setAlerts(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : tc('unknown_error'));
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // Refresh every 10 minutes
    const interval = setInterval(fetchAlerts, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getAlertIcon = (type: string, severity: string) => {
    if (type === 'expiring') {
      return <Clock className={`w-3 h-3 ${severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />;
    }
    return <Package className={`w-3 h-3 ${severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />;
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'critical' ? 'text-red-400' : 'text-yellow-400';
  };

  return (
    <div className="bg-slate-900 text-white rounded border border-slate-700 shadow-lg p-4 h-full flex flex-col">
      <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex justify-between items-center">
        {t('stock_alerts')}
        <span className="text-[10px] text-slate-400">
          {alerts.length} {tc('alerts')}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse text-slate-500 text-sm">{t('loading_alerts')}</div>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <div className="text-red-400 text-sm">{t('failed_load_alerts')}</div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-green-400 text-sm">{t('no_stock_alerts')}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="border border-slate-700 rounded p-3 bg-slate-800/50">
                <div className="flex items-start gap-2">
                  {getAlertIcon(alert.type, alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-white mb-1">
                      {alert.medication}
                    </div>
                    <div className="text-[10px] text-slate-400 mb-2">
                      {alert.message}
                    </div>
                    {alert.type === 'low_stock' && alert.currentStock !== undefined && (
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-slate-500">
                          {t('current_stock')}: {alert.currentStock} {alert.unit}
                        </span>
                        <span className={getSeverityColor(alert.severity)}>
                          {alert.currentStock === 0 ? tc('out_of_stock') : tc('low_stock')}
                        </span>
                      </div>
                    )}
                    {alert.type === 'expiring' && alert.daysUntilExpiry !== undefined && (
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-slate-500">
                          {t('expires')}: {new Date(alert.expiryDate!).toLocaleDateString()}
                        </span>
                        <span className={getSeverityColor(alert.severity)}>
                          {t('days_left', { count: alert.daysUntilExpiry })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700">
        <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-widest transition-colors cursor-pointer border-none outline-none">
          {t('manage_inventory')}
        </button>
      </div>
    </div>
  );
}
