import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

/** Expire Supabase auth cookies without calling the refresh endpoint (stops client refresh loops). */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const shared = getSupabaseAuthCookieOptions();

  for (const cookie of request.cookies.getAll()) {
    const name = cookie.name;
    if (!name.startsWith("sb-") && !name.includes("auth-token")) continue;

    response.cookies.set(name, "", {
      path: shared?.path ?? "/",
      maxAge: 0,
      ...(shared?.domain ? { domain: shared.domain } : {}),
      ...(shared?.sameSite ? { sameSite: shared.sameSite } : {}),
      ...(shared?.secure ? { secure: shared.secure } : {}),
    });
  }

  return response;
}
