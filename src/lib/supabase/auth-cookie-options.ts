import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Optional: set NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.kleenapp.co.uk (leading dot) so auth
 * cookies are shared across www and dashboard on the same registrable domain.
 * Only enable when all subdomains that receive this cookie are trusted.
 */
export function getSupabaseAuthCookieOptions(): CookieOptionsWithName | undefined {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();
  if (!domain) return undefined;
  return {
    domain,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
