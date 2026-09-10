"use client";

import { useTranslations } from "next-intl";
import { buildPartographChartData, partographStatus } from "@/lib/maternity/partograph";
import { PartographEntry } from "../../types";

const WIDTH = 720;
const DILATION_HEIGHT = 260;
const FHR_HEIGHT = 120;
const MARGIN = { top: 16, right: 24, bottom: 24, left: 40 };

export function PartographChart({ entries }: { entries: PartographEntry[] }) {
  const t = useTranslations("maternity");

  const data = buildPartographChartData(entries);
  const status = partographStatus(data);

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const hoursDomain = Math.ceil(data.maxHours) + 1;

  const xForHours = (h: number) => MARGIN.left + (h / hoursDomain) * plotWidth;
  const yForCm = (cm: number) => MARGIN.top + DILATION_HEIGHT - (cm / 10) * DILATION_HEIGHT;
  const yForBpm = (bpm: number) => {
    const clamped = Math.min(200, Math.max(60, bpm));
    return MARGIN.top + FHR_HEIGHT - ((clamped - 60) / (200 - 60)) * FHR_HEIGHT;
  };

  const dilationPath = data.dilationPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xForHours(p.hoursSinceActivePhase)} ${yForCm(p.cm)}`)
    .join(" ");

  const fhrPath = data.fhrPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xForHours(p.hoursSinceActivePhase)} ${yForBpm(p.bpm)}`)
    .join(" ");

  const statusColor: Record<typeof status, string> = {
    no_data: "bg-slate-100 text-slate-600",
    latent: "bg-blue-100 text-blue-700",
    normal: "bg-green-100 text-green-700",
    alert: "bg-orange-100 text-orange-700",
    action: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{t("partograph")}</h3>
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${statusColor[status]}`}>
          {t(`partograph_status_${status}`)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg width={WIDTH} height={MARGIN.top + DILATION_HEIGHT + MARGIN.bottom} className="mx-auto">
          {/* Dilation grid */}
          {Array.from({ length: 11 }).map((_, cm) => (
            <g key={cm}>
              <line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={yForCm(cm)}
                y2={yForCm(cm)}
                stroke={cm === 4 || cm === 10 ? "#94a3b8" : "#e2e8f0"}
                strokeWidth={cm === 4 || cm === 10 ? 1.5 : 1}
              />
              <text x={MARGIN.left - 8} y={yForCm(cm) + 3} textAnchor="end" fontSize="9" fill="#64748b">{cm}</text>
            </g>
          ))}
          {Array.from({ length: hoursDomain + 1 }).map((_, h) => (
            <line key={h} x1={xForHours(h)} x2={xForHours(h)} y1={MARGIN.top} y2={MARGIN.top + DILATION_HEIGHT} stroke="#f1f5f9" strokeWidth={1} />
          ))}

          {/* Alert / action lines */}
          {data.alertLine && (
            <line
              x1={xForHours(data.alertLine[0].hoursSinceActivePhase)}
              y1={yForCm(data.alertLine[0].cm)}
              x2={xForHours(data.alertLine[1].hoursSinceActivePhase)}
              y2={yForCm(data.alertLine[1].cm)}
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
          {data.actionLine && (
            <line
              x1={xForHours(data.actionLine[0].hoursSinceActivePhase)}
              y1={yForCm(data.actionLine[0].cm)}
              x2={xForHours(data.actionLine[1].hoursSinceActivePhase)}
              y2={yForCm(data.actionLine[1].cm)}
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}

          {/* Dilation curve */}
          {dilationPath && <path d={dilationPath} fill="none" stroke="#db2777" strokeWidth={2} />}
          {data.dilationPoints.map((p, i) => (
            <g key={i} transform={`translate(${xForHours(p.hoursSinceActivePhase)}, ${yForCm(p.cm)})`}>
              <line x1={-4} y1={-4} x2={4} y2={4} stroke="#db2777" strokeWidth={1.5} />
              <line x1={-4} y1={4} x2={4} y2={-4} stroke="#db2777" strokeWidth={1.5} />
            </g>
          ))}

          <text x={MARGIN.left} y={12} fontSize="9" fill="#94a3b8">{t("cervical_dilation_cm")}</text>
        </svg>

        <svg width={WIDTH} height={MARGIN.top + FHR_HEIGHT + MARGIN.bottom} className="mx-auto -mt-2">
          <rect
            x={MARGIN.left}
            y={yForBpm(160)}
            width={plotWidth}
            height={yForBpm(120) - yForBpm(160)}
            fill="#dcfce7"
            opacity={0.5}
          />
          {[60, 100, 120, 160, 200].map((bpm) => (
            <g key={bpm}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yForBpm(bpm)} y2={yForBpm(bpm)} stroke="#f1f5f9" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={yForBpm(bpm) + 3} textAnchor="end" fontSize="9" fill="#64748b">{bpm}</text>
            </g>
          ))}
          {fhrPath && <path d={fhrPath} fill="none" stroke="#2563eb" strokeWidth={2} />}
          <text x={MARGIN.left} y={12} fontSize="9" fill="#94a3b8">{t("fetal_heart_rate")} (bpm)</text>
          <text x={WIDTH - MARGIN.right} y={MARGIN.top + FHR_HEIGHT + 18} textAnchor="end" fontSize="9" fill="#94a3b8">
            {t("hours_since_active_phase")}
          </text>
        </svg>
      </div>

      {data.dilationPoints.length === 0 && (
        <p className="text-xs text-slate-400 italic text-center">{t("no_partograph_entries")}</p>
      )}
    </div>
  );
}
