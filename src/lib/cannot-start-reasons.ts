/** Structured reasons a contractor could not start a job. */

export type CannotStartReasonCode =
  | "customer_not_home"
  | "no_access"
  | "access_refused"
  | "unsafe_site"
  | "site_not_ready"
  | "wrong_address"
  | "traffic_delay"
  | "vehicle_breakdown"
  | "health_emergency"
  | "extreme_weather"
  | "natural_disaster"
  | "utility_outage"
  | "police_or_emergency"
  | "customer_cancelled_onsite"
  | "scope_mismatch"
  | "other";

export type CannotStartReason = {
  code: CannotStartReasonCode;
  label: string;
  hint: string;
  category: "customer" | "access" | "contractor" | "external" | "other";
};

export const CANNOT_START_REASONS: CannotStartReason[] = [
  {
    code: "customer_not_home",
    label: "Customer not home",
    hint: "Nobody answered / no one available to provide access.",
    category: "customer",
  },
  {
    code: "no_access",
    label: "No access to property",
    hint: "Keys, codes, gates, or entry details missing or incorrect.",
    category: "access",
  },
  {
    code: "access_refused",
    label: "Access refused",
    hint: "Customer or occupant would not allow work to begin.",
    category: "customer",
  },
  {
    code: "unsafe_site",
    label: "Unsafe to work",
    hint: "Hazards on site that made it unsafe to start.",
    category: "access",
  },
  {
    code: "site_not_ready",
    label: "Site not ready",
    hint: "Property not prepared, blocked, or still occupied unexpectedly.",
    category: "access",
  },
  {
    code: "wrong_address",
    label: "Wrong / unclear address",
    hint: "Could not locate the correct property.",
    category: "access",
  },
  {
    code: "traffic_delay",
    label: "Traffic / travel delay",
    hint: "Severe traffic, road closure, or transport disruption.",
    category: "contractor",
  },
  {
    code: "vehicle_breakdown",
    label: "Vehicle / equipment failure",
    hint: "Breakdown or essential equipment failure prevented start.",
    category: "contractor",
  },
  {
    code: "health_emergency",
    label: "Health emergency",
    hint: "Sudden illness or medical emergency.",
    category: "contractor",
  },
  {
    code: "extreme_weather",
    label: "Extreme weather",
    hint: "Weather made travel or outdoor work unsafe.",
    category: "external",
  },
  {
    code: "natural_disaster",
    label: "Natural disaster / major incident",
    hint: "Flood, fire, storm damage, or similar major event.",
    category: "external",
  },
  {
    code: "utility_outage",
    label: "Utility outage",
    hint: "No water, power, or other utilities needed for the job.",
    category: "external",
  },
  {
    code: "police_or_emergency",
    label: "Emergency services on scene",
    hint: "Police, fire, or ambulance activity blocked the job.",
    category: "external",
  },
  {
    code: "customer_cancelled_onsite",
    label: "Customer cancelled on arrival",
    hint: "Customer asked to cancel or postpone when you arrived.",
    category: "customer",
  },
  {
    code: "scope_mismatch",
    label: "Job not as described",
    hint: "Work required is significantly different from what was booked.",
    category: "access",
  },
  {
    code: "other",
    label: "Other",
    hint: "Explain in the notes below.",
    category: "other",
  },
];

export const CANNOT_START_CATEGORY_LABELS: Record<CannotStartReason["category"], string> = {
  customer: "Customer / occupancy",
  access: "Access & site",
  contractor: "Travel & contractor",
  external: "Weather & external events",
  other: "Other",
};

export function cannotStartReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return CANNOT_START_REASONS.find((r) => r.code === code)?.label ?? null;
}

export function formatCannotStartReason(
  code: string | null | undefined,
  details?: string | null,
): string {
  const label = cannotStartReasonLabel(code) || "Could not start";
  const extra = details?.trim();
  return extra ? `${label} — ${extra}` : label;
}

export function isValidCannotStartReason(code: string | null | undefined): code is CannotStartReasonCode {
  return !!code && CANNOT_START_REASONS.some((r) => r.code === code);
}
