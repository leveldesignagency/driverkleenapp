import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";

/**
 * Link the signed-in Google user to an existing admin-created operative
 * (same email, user_id still null) instead of inserting a duplicate application row.
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

  const merged = await resolveOperativeIdentity(admin, user.id, user.email);
  if (merged.operative) {
    const op = merged.operative;
    return NextResponse.json({
      ok: true,
      claimed: merged.merged || !op.user_id,
      already_linked: Boolean(op.user_id) && !merged.merged,
      merged: merged.merged,
      merged_count: merged.mergedCount,
      operative: op,
      admin_invite:
        String(op.onboarding_source || "") === "admin_invite" || Boolean(op.admin_invited_at),
    });
  }

  const emailNorm = user.email.trim().toLowerCase();

  const { data: matches, error: matchErr } = await admin
    .from("operatives")
    .select("*")
    .is("user_id", null)
    .ilike("email", emailNorm);

  if (matchErr) {
    console.error("claim-admin-invite lookup:", matchErr);
    return NextResponse.json({ error: matchErr.message }, { status: 400 });
  }

  const ranked = [...(matches || [])].sort((a, b) => {
    const aInvite = a.admin_invited_at ? new Date(String(a.admin_invited_at)).getTime() : 0;
    const bInvite = b.admin_invited_at ? new Date(String(b.admin_invited_at)).getTime() : 0;
    if (bInvite !== aInvite) return bInvite - aInvite;
    const aCreated = a.created_at ? new Date(String(a.created_at)).getTime() : 0;
    const bCreated = b.created_at ? new Date(String(b.created_at)).getTime() : 0;
    return bCreated - aCreated;
  });

  const candidate =
    ranked.find((r) => String(r.onboarding_source || "") === "admin_invite") || ranked[0];

  if (!candidate) {
    return NextResponse.json({ ok: true, claimed: false, operative: null });
  }

  const { data: claimed, error: claimErr } = await admin
    .from("operatives")
    .update({
      user_id: user.id,
      email: emailNorm,
      onboarding_source: candidate.onboarding_source || "admin_invite",
    })
    .eq("id", candidate.id)
    .is("user_id", null)
    .select("*")
    .single();

  if (claimErr) {
    const retry = await resolveOperativeIdentity(admin, user.id, user.email);
    if (retry.operative) {
      const op = retry.operative;
      return NextResponse.json({
        ok: true,
        claimed: true,
        operative: op,
        admin_invite: String(op.onboarding_source || "") === "admin_invite",
      });
    }
    console.error("claim-admin-invite update:", claimErr);
    return NextResponse.json({ error: claimErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    claimed: true,
    operative: claimed,
    admin_invite:
      String(claimed?.onboarding_source || "") === "admin_invite" || Boolean(candidate.admin_invited_at),
  });
}
