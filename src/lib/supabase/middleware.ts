import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

function isPublicContractorPath(pathname: string): boolean {
  return (
    pathname === "/contractor" ||
    pathname === "/contractor/sign-in" ||
    pathname === "/contractor/join" ||
    pathname.startsWith("/auth/callback")
  );
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const response = NextResponse.next({ request: { headers: request.headers } });

  // Public auth pages + API routes: never call getUser here (stale cookies → refresh storms).
  if (isPublicContractorPath(pathname) || pathname.startsWith("/api/")) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const cookieOptions = getSupabaseAuthCookieOptions();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    ...(cookieOptions ? { cookieOptions } : {}),
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isContractorPortalPath = pathname === "/contractor" || pathname.startsWith("/contractor/");

  if (isContractorPortalPath && !user) {
    const signIn = new URL("/contractor/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    return NextResponse.redirect(signIn);
  }

  const isSuspendedPath =
    pathname === "/contractor/suspended" ||
    pathname.startsWith("/api/account/restriction") ||
    pathname.startsWith("/auth/");

  if (user && !pathname.startsWith("/api/") && !isPublicContractorPath(pathname) && !isSuspendedPath) {
    const { data: banned } = await supabase.rpc("is_auth_user_banned", { p_user_id: user.id });
    if (banned === true) {
      return NextResponse.redirect(new URL("/contractor/suspended", request.url));
    }
  }

  return response;
}
