import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

function cookieMethods(
  read: () => { name: string; value: string }[],
  write?: (name: string, value: string, options: CookieOptions) => void,
) {
  return {
    getAll() {
      return read();
    },
    setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
      if (!write) return;
      cookiesToSet.forEach(({ name, value, options }) => write(name, value, options));
    },
  };
}

export function createServerSupabaseClient() {
  const cookieStore = cookies();
  const cookieOptions = getSupabaseAuthCookieOptions();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOptions ? { cookieOptions } : {}),
      cookies: cookieMethods(
        () => cookieStore.getAll(),
        (name, value, options) => {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server component — ignore
          }
        },
      ),
    },
  );
}

/** Prefer this in route handlers — reads all chunked auth cookies from the request. */
export function createRouteHandlerSupabaseClient(request: NextRequest) {
  const cookieOptions = getSupabaseAuthCookieOptions();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOptions ? { cookieOptions } : {}),
      cookies: cookieMethods(() => request.cookies.getAll()),
    },
  );
}
