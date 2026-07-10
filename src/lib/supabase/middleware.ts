import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const response = NextResponse.next({ request: { headers: request.headers } });

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

  const isPublicContractorPath =
    pathname === "/contractor" ||
    pathname === "/contractor/sign-in" ||
    pathname === "/contractor/join" ||
    pathname.startsWith("/auth/callback");

  const isContractorPortalPath = pathname === "/contractor" || pathname.startsWith("/contractor/");

  if (isContractorPortalPath && !isPublicContractorPath && !user) {
    const signIn = new URL("/contractor/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${request.nextUrl.search || ""}`);
    return NextResponse.redirect(signIn);
  }

  return response;
}
