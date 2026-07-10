import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseAuthCookieOptions,
  isContractorAuthCookieName,
} from "@/lib/supabase/auth-cookie-options";

/**
 * Start Google OAuth from the server so the PKCE code verifier is written via Set-Cookie
 * on the redirect response (reliable in SSR; browser document.cookie is flaky cross-app).
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const redirectTo = `${origin}/auth/callback`;
  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  const cookieOpts = getSupabaseAuthCookieOptions();
  const legacyDomain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieOpts,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    const fail = new URL("/contractor/join", origin);
    fail.searchParams.set("error", "auth");
    fail.searchParams.set("msg", error?.message ?? "Could not start Google sign-in");
    return NextResponse.redirect(fail);
  }

  const response = NextResponse.redirect(data.url);

  // Drop legacy shared-project auth cookies before attaching the new PKCE verifier.
  for (const cookie of request.cookies.getAll()) {
    if (!isContractorAuthCookieName(cookie.name)) continue;
    const base = {
      path: cookieOpts.path ?? "/",
      maxAge: 0,
      sameSite: cookieOpts.sameSite,
      secure: cookieOpts.secure,
    };
    response.cookies.set(cookie.name, "", base);
    if (legacyDomain) {
      response.cookies.set(cookie.name, "", { ...base, domain: legacyDomain });
    }
  }

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}
