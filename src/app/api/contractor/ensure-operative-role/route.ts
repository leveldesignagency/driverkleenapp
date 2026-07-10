import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upgradeCustomerToOperative } from "@/lib/contractor-role-upgrade";

/** After Google sign-in, promote customer → operative so onboarding can start. */
export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const result = await upgradeCustomerToOperative(user.id);
  if (!result.ok) {
    const status = result.error.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
