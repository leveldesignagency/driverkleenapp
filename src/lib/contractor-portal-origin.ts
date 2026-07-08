/** Canonical production host for the Kleen contractor portal. */
export const CANONICAL_CONTRACTOR_HOST = "contractor.kleenapp.co.uk";

/** Old subdomain — redirect to canonical (see middleware). */
export const LEGACY_CONTRACTOR_HOSTS = ["driver.kleenapp.co.uk"] as const;

export function contractorPortalOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "development"
    ? "http://localhost:3101"
    : `https://${CANONICAL_CONTRACTOR_HOST}`;
}
