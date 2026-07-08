/** Hours before job start below which a contractor late-cancel incurs a penalty. */
export const LATE_CANCEL_HOURS = 24;

/** Default late-cancel penalty in pence (£50). */
export const LATE_CANCEL_PENALTY_PENCE = 5000;

export type CancelPenaltyPreview = {
  jobStartAt: Date | null;
  hoursUntilStart: number | null;
  penaltyPence: number;
  isLateCancel: boolean;
};

/** Parse job preferred_date + preferred_time into a local Date (best effort). */
export function jobScheduledStart(preferredDate: string, preferredTime: string | null): Date | null {
  if (!preferredDate) return null;
  const timePart = (preferredTime || "09:00:00").slice(0, 8);
  const iso = `${preferredDate}T${timePart}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeContractorCancelPenalty(
  preferredDate: string,
  preferredTime: string | null,
  now = new Date(),
): CancelPenaltyPreview {
  const jobStartAt = jobScheduledStart(preferredDate, preferredTime);
  if (!jobStartAt) {
    return { jobStartAt: null, hoursUntilStart: null, penaltyPence: 0, isLateCancel: false };
  }

  const msUntil = jobStartAt.getTime() - now.getTime();
  const hoursUntilStart = msUntil / (1000 * 60 * 60);
  const isLateCancel = hoursUntilStart < LATE_CANCEL_HOURS;
  const penaltyPence = isLateCancel ? LATE_CANCEL_PENALTY_PENCE : 0;

  return { jobStartAt, hoursUntilStart, penaltyPence, isLateCancel };
}
