import { NextResponse, type NextRequest } from "next/server";
import { isBenignAuthError, isStaleRefreshTokenError } from "@/lib/auth-errors";
import { upgradeCustomerToOperative } from "@/lib/contractor-role-upgrade";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server";

/** After Google sign-in, promote customer → operative so onboarding can start. */
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerSupabaseClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && !isBenignAuthError(authError.message)) {
    return NextResponse.json(
      { error: authError.message, code: "auth_error" },
      { status: 401 },
    );
  }

  if (!user) {
    return NextResponse.json({ error: "Not signed in", code: "not_signed_in" }, { status: 401 });
  }

  const result = await upgradeCustomerToOperative(user.id);
  if (!result.ok) {
    const status =
      result.code === "missing_service_role"
        ? 503
        : result.code === "admin_account" || result.code === "invalid_role"
          ? 409
          : 403;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true });
}

/** Safe diagnostics for contractor sign-in issues (no secrets returned). */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerSupabaseClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  let profileRole: string | null = null;
  let profileError: string | null = null;

  if (user) {
    const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    profileRole = data?.role ?? null;
    profileError = error?.message ?? null;
  }

  return NextResponse.json({
    env: {
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      authCookieDomain: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN ?? null,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    },
    session: {
      signedIn: Boolean(user),
      userId: user?.id ?? null,
      email: user?.email ?? null,
      authError:
        authError?.message &&
        (!isBenignAuthError(authError.message) || isStaleRefreshTokenError(authError.message))
          ? authError.message
          : null,
    },
    profile: {
      role: profileRole,
      error: profileError,
    },
  });
}
