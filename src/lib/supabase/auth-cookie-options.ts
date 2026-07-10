import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Isolated storage key for contractor-portal auth cookies.
 * Must differ from kleen-app/dashboard (default sb-<project>-auth-token) so PKCE code
 * verifiers are not overwritten when both apps share one Supabase project.
 */
export const CONTRACTOR_AUTH_COOKIE_NAME = "sb-kleen-contractor-auth";

/** Matches contractor auth cookies (current + legacy shared-project names). */
export function isContractorAuthCookieName(name: string): boolean {
  if (name.startsWith(CONTRACTOR_AUTH_COOKIE_NAME)) return true;
  return name.startsWith("sb-") && name.includes("auth-token");
}

/**
 * Contractor portal uses host-only cookies with a unique storage key.
 * Do not set NEXT_PUBLIC_AUTH_COOKIE_DOMAIN on this Vercel project — sharing cookies
 * with kleen-app causes "code challenge does not match code verifier" on Google sign-in.
 */
export function getSupabaseAuthCookieOptions(): CookieOptionsWithName {
  return {
    name: CONTRACTOR_AUTH_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
}
