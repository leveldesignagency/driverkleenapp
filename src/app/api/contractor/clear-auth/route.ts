import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAuthCookieOptions,
  isContractorAuthCookieName,
} from "@/lib/supabase/auth-cookie-options";

function expireCookie(
  response: NextResponse,
  name: string,
  opts: { path: string; sameSite?: "lax" | "strict" | "none"; secure?: boolean; domain?: string },
) {
  const base = {
    path: opts.path,
    maxAge: 0,
    ...(opts.sameSite ? { sameSite: opts.sameSite } : {}),
    ...(opts.secure ? { secure: opts.secure } : {}),
  };

  response.cookies.set(name, "", base);

  if (opts.domain) {
    response.cookies.set(name, "", { ...base, domain: opts.domain });
  }
}

/** Expire contractor Supabase auth cookies without calling the refresh endpoint. */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const shared = getSupabaseAuthCookieOptions();
  const legacyDomain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();

  for (const cookie of request.cookies.getAll()) {
    if (!isContractorAuthCookieName(cookie.name)) continue;

    expireCookie(response, cookie.name, {
      path: shared.path ?? "/",
      sameSite: shared.sameSite === true ? "lax" : shared.sameSite || undefined,
      secure: shared.secure === true ? true : undefined,
      ...(legacyDomain ? { domain: legacyDomain } : {}),
    });
  }

  return response;
}
