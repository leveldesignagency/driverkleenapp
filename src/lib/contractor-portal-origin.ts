import { normalizeSiteOrigin } from "@/lib/customer-app-url";

/** Canonical production host for the Kleen contractor portal. */
export const CANONICAL_CONTRACTOR_HOST = "contractor.kleenapp.co.uk";

/** Old subdomain — redirect to canonical (see middleware). */
export const LEGACY_CONTRACTOR_HOSTS = ["driver.kleenapp.co.uk"] as const;

const CANONICAL_CONTRACTOR_ORIGIN = `https://${CANONICAL_CONTRACTOR_HOST}`;

export function isContractorPortalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === CANONICAL_CONTRACTOR_HOST ||
    (LEGACY_CONTRACTOR_HOSTS as readonly string[]).includes(host)
  );
}

/** Public origin for this deployment (Stripe, links). Prefer env; fall back to canonical. */
export function contractorPortalOrigin(): string {
  const fromEnv = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || "");
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === "development"
    ? "http://localhost:3101"
    : CANONICAL_CONTRACTOR_ORIGIN;
}

/**
 * OAuth callback must always use the canonical contractor host in production so Supabase redirect
 * URLs, session cookies, and post-login redirects stay on contractor.kleenapp.co.uk (not driver/www/dashboard).
 */
export function contractorOAuthCallbackOrigin(requestHost?: string): string {
  if (process.env.NODE_ENV === "development") {
    if (requestHost?.includes("localhost")) {
      return `http://${requestHost}`;
    }
    return contractorPortalOrigin();
  }

  if (requestHost && isContractorPortalHost(requestHost)) {
    return CANONICAL_CONTRACTOR_ORIGIN;
  }

  const fromEnv = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || "");
  if (fromEnv && isContractorPortalHost(new URL(fromEnv).hostname)) {
    return CANONICAL_CONTRACTOR_ORIGIN;
  }

  return CANONICAL_CONTRACTOR_ORIGIN;
}
