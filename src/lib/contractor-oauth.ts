/**
 * OAuth redirect for contractor join / sign-in (Google).
 * `intent=contractor` lets /auth/callback upgrade brand-new profiles from customer → operative.
 */
export function getContractorGoogleRedirectTo(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (!origin) return "";
  const next = encodeURIComponent("/contractor");
  const intent = encodeURIComponent("contractor");
  return `${origin}/auth/callback?next=${next}&intent=${intent}`;
}
