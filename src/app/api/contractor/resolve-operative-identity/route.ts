import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";

/**
 * Merge duplicate operatives (admin-created vs self-signup) and link the canonical
 * row to the signed-in user so quotes and assignments show in the portal.
 */
export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "operative") {
    return NextResponse.json({ error: "Contractor account required" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const result = await resolveOperativeIdentity(admin, user.id, user.email);

  return NextResponse.json({
    ok: true,
    merged: result.merged,
    merged_count: result.mergedCount,
    operative: result.operative,
  });
}
