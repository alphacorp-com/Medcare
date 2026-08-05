/**
 * WHO partograph math: the alert line starts at the first plotted cervical
 * dilation reading of 4cm or more (start of the active phase) and rises at
 * 1cm/hour; the action line is the same slope, shifted 4 hours to the right.
 * Crossing the alert line signals a potential problem, crossing the action
 * line signals labour requires intervention.
 */

export interface PartographDilationPoint {
  hoursSinceActivePhase: number;
  cm: number;
}

export interface PartographReading {
  id: string;
  recordedAt: string;
  cervicalDilationCm: number | null;
  fetalHeartRate: number | null;
}

export interface PartographChartData {
  activePhaseStart: string | null;
  dilationPoints: PartographDilationPoint[];
  fhrPoints: { hoursSinceActivePhase: number; bpm: number }[];
  alertLine: [PartographDilationPoint, PartographDilationPoint] | null;
  actionLine: [PartographDilationPoint, PartographDilationPoint] | null;
  maxHours: number;
}

const ACTIVE_PHASE_DILATION_CM = 4;
const FULL_DILATION_CM = 10;
const ALERT_SLOPE_CM_PER_HOUR = 1;
const ACTION_LINE_OFFSET_HOURS = 4;

export function buildPartographChartData(readings: PartographReading[]): PartographChartData {
  const sorted = [...readings]
    .filter((r) => r.recordedAt)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  const activePhaseEntry = sorted.find((r) => (r.cervicalDilationCm ?? 0) >= ACTIVE_PHASE_DILATION_CM);
  const activePhaseStart = activePhaseEntry ? activePhaseEntry.recordedAt : null;
  const t0 = activePhaseStart ? new Date(activePhaseStart).getTime() : sorted[0] ? new Date(sorted[0].recordedAt).getTime() : 0;

  const hoursSince = (iso: string) => (new Date(iso).getTime() - t0) / (60 * 60 * 1000);

  const dilationPoints: PartographDilationPoint[] = sorted
    .filter((r) => r.cervicalDilationCm != null)
    .map((r) => ({ hoursSinceActivePhase: hoursSince(r.recordedAt), cm: r.cervicalDilationCm! }));

  const fhrPoints = sorted
    .filter((r) => r.fetalHeartRate != null)
    .map((r) => ({ hoursSinceActivePhase: hoursSince(r.recordedAt), bpm: r.fetalHeartRate! }));

  let alertLine: PartographChartData["alertLine"] = null;
  let actionLine: PartographChartData["actionLine"] = null;

  if (activePhaseEntry) {
    const startDilation = Math.max(activePhaseEntry.cervicalDilationCm ?? ACTIVE_PHASE_DILATION_CM, ACTIVE_PHASE_DILATION_CM);
    const hoursToFull = (FULL_DILATION_CM - startDilation) / ALERT_SLOPE_CM_PER_HOUR;

    alertLine = [
      { hoursSinceActivePhase: 0, cm: startDilation },
      { hoursSinceActivePhase: hoursToFull, cm: FULL_DILATION_CM },
    ];
    actionLine = [
      { hoursSinceActivePhase: ACTION_LINE_OFFSET_HOURS, cm: startDilation },
      { hoursSinceActivePhase: ACTION_LINE_OFFSET_HOURS + hoursToFull, cm: FULL_DILATION_CM },
    ];
  }

  const allHours = [
    ...dilationPoints.map((p) => p.hoursSinceActivePhase),
    ...(actionLine ? [actionLine[1].hoursSinceActivePhase] : []),
  ];
  const maxHours = Math.max(4, ...allHours, 0);

  return { activePhaseStart, dilationPoints, fhrPoints, alertLine, actionLine, maxHours };
}

/** Simple textual status: has the latest reading crossed the alert/action line? */
export function partographStatus(data: PartographChartData): "no_data" | "latent" | "normal" | "alert" | "action" {
  if (data.dilationPoints.length === 0) return "no_data";
  if (!data.alertLine || !data.actionLine) return "latent";

  const latest = data.dilationPoints[data.dilationPoints.length - 1];
  const [alertStart, alertEnd] = data.alertLine;
  const [actionStart, actionEnd] = data.actionLine;

  const cmOnLine = (line: [PartographDilationPoint, PartographDilationPoint], hours: number) => {
    const [p1, p2] = line;
    const slope = (p2.cm - p1.cm) / (p2.hoursSinceActivePhase - p1.hoursSinceActivePhase || 1);
    return p1.cm + slope * (hours - p1.hoursSinceActivePhase);
  };

  const expectedByAction = cmOnLine([actionStart, actionEnd], latest.hoursSinceActivePhase);
  const expectedByAlert = cmOnLine([alertStart, alertEnd], latest.hoursSinceActivePhase);

  if (latest.cm < expectedByAction) return "action";
  if (latest.cm < expectedByAlert) return "alert";
  return "normal";
}
