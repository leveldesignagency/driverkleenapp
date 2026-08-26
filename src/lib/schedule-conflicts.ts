/** Parse HH:MM or HH:MM:SS into minutes from midnight. */
export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

export function dayKey(date: string | null | undefined): string | null {
  if (!date) return null;
  return String(date).slice(0, 10);
}

/** Default job window when hours unknown: 3 hours. Buffer between jobs: 30 mins travel. */
const DEFAULT_HOURS = 3;
const TRAVEL_BUFFER_MIN = 30;

export type TimeWindow = {
  jobId: string;
  reference: string;
  date: string;
  startMin: number;
  endMin: number;
};

export function jobWindow(params: {
  jobId: string;
  reference: string;
  preferredDate: string | null | undefined;
  preferredTime: string | null | undefined;
  estimatedHours?: number | null;
}): TimeWindow | null {
  const date = dayKey(params.preferredDate);
  const startMin = timeToMinutes(params.preferredTime);
  if (!date || startMin == null) return null;
  const hours =
    params.estimatedHours != null && Number.isFinite(params.estimatedHours) && params.estimatedHours > 0
      ? Number(params.estimatedHours)
      : DEFAULT_HOURS;
  const duration = Math.round(hours * 60) + TRAVEL_BUFFER_MIN;
  return {
    jobId: params.jobId,
    reference: params.reference,
    date,
    startMin,
    endMin: startMin + duration,
  };
}

export function windowsConflict(a: TimeWindow, b: TimeWindow): boolean {
  if (a.date !== b.date) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function findConflict(candidate: TimeWindow, existing: TimeWindow[]): TimeWindow | null {
  for (const e of existing) {
    if (e.jobId === candidate.jobId) continue;
    if (windowsConflict(candidate, e)) return e;
  }
  return null;
}
