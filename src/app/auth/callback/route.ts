import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { contractorOAuthCallbackOrigin } from "@/lib/contractor-portal-origin";
import { upgradeCustomerToOperative } from "@/lib/contractor-role-upgrade";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

/**
 * OAuth PKCE exchange — must use getAll/setAll so cookies attach to the redirect response.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 *
 * Query `intent=contractor`: after Google sign-up, upgrade profile customer → operative for accounts
 * created in the last few minutes (same behaviour as email contractor sign-up metadata).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/contractor";
  const intent = url.searchParams.get("intent");

  const requestHost = url.hostname.toLowerCase();
  const portalOrigin = contractorOAuthCallbackOrigin(requestHost);

  if (!code) {
    return NextResponse.redirect(new URL("/contractor/sign-in", portalOrigin));
  }

  const nextPath = next.startsWith("/") ? next : `/${next}`;
  const redirectTarget = new URL(nextPath, portalOrigin);

  const response = NextResponse.redirect(redirectTarget);

  const cookieOpts = getSupabaseAuthCookieOptions();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOpts ? { cookieOptions: cookieOpts } : {}),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth callback exchangeCodeForSession:", error.message);
    return NextResponse.redirect(new URL("/contractor/sign-in?error=auth", portalOrigin));
  }

  const userId = exchanged?.session?.user?.id;
  if (intent === "contractor" && userId) {
    const upgraded = await upgradeCustomerToOperative(userId);
    if (!upgraded.ok) {
      console.error("auth callback intent=contractor:", upgraded.error);
      const fail = new URL("/contractor/join", portalOrigin);
      fail.searchParams.set("need_operative", "1");
      fail.searchParams.set("error", "role_upgrade");
      return NextResponse.redirect(fail);
    }
  }

  return response;
}
