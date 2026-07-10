import {
  contractorOAuthCallbackOrigin,
  isContractorPortalHost,
} from "@/lib/contractor-portal-origin";

/**
 * OAuth redirect for contractor join / sign-in (Google).
 * `intent=contractor` lets /auth/callback upgrade customer → operative.
 *
 * Uses the browser host when already on contractor/driver (then canonicalizes to contractor.kleenapp.co.uk).
 * Falls back to NEXT_PUBLIC_SITE_URL only when window is unavailable.
 */
export function getContractorGoogleRedirectTo(): string {
  let origin = "";

  if (typeof window !== "undefined" && window.location.origin) {
    const host = window.location.hostname.toLowerCase();
    if (host.includes("localhost") || isContractorPortalHost(host)) {
      origin = contractorOAuthCallbackOrigin(host);
    }
  }

  if (!origin) {
    origin = contractorOAuthCallbackOrigin();
  }

  if (!origin) return "";

  const next = encodeURIComponent("/contractor");
  const intent = encodeURIComponent("contractor");
  return `${origin}/auth/callback?next=${next}&intent=${intent}`;
}
