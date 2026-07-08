/**
 * OAuth redirect for contractor join / sign-in (Google).
 * `intent=contractor` lets /auth/callback upgrade customer → operative.
 * Uses NEXT_PUBLIC_SITE_URL when set (Vercel: https://contractor.kleenapp.co.uk) so Supabase
 * always receives an allow-listed callback even if the browser host differs.
 */
export function getContractorGoogleRedirectTo(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  const origin =
    fromEnv ||
    (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) return "";
  const next = encodeURIComponent("/contractor");
  const intent = encodeURIComponent("contractor");
  return `${origin}/auth/callback?next=${next}&intent=${intent}`;
}
