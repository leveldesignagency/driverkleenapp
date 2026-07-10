import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";

let browserClient: SupabaseClient | undefined;

/** Single browser client — avoids multiple Realtime auth listeners amplifying refresh loops. */
export function getBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const cookieOptions = getSupabaseAuthCookieOptions();
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieOptions ? { cookieOptions } : {}),
      auth: {
        // Server routes + middleware refresh cookies; client refresh loops cause 429 storms on stale tokens.
        autoRefreshToken: false,
      },
    },
  );

  return browserClient;
}
