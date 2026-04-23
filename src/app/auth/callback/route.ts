import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

  /** Keep post-login redirect on the same host that received the OAuth callback (session cookies are host-scoped). */
  const sameOrigin = url.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/contractor/sign-in", sameOrigin));
  }

  const nextPath = next.startsWith("/") ? next : `/${next}`;
  const redirectTarget = new URL(nextPath, sameOrigin);

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
    return NextResponse.redirect(new URL("/contractor/sign-in?error=auth", sameOrigin));
  }

  const userId = exchanged?.session?.user?.id;
  /** Google OAuth from this app always sends `intent=contractor`. Upgrade customer → operative so
   * existing customer accounts (not just brand-new signups) can use the driver portal onboarding. */
  if (intent === "contractor" && userId) {
    try {
      const admin = createServiceRoleClient();
      const { data: prof } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (prof?.role === "customer") {
        await admin.from("profiles").update({ role: "operative" }).eq("id", userId).eq("role", "customer");
      }
    } catch (e) {
      console.error("auth callback intent=contractor:", e);
    }
  }

  return response;
}
