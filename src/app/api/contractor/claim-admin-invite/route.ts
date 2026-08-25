import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

  const { data: alreadyLinked } = await admin
    .from("operatives")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (alreadyLinked) {
    return NextResponse.json({
      ok: true,
      claimed: false,
      already_linked: true,
      operative: alreadyLinked,
      admin_invite: String(alreadyLinked.onboarding_source || "") === "admin_invite",
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
    // Race: another request linked first, or unique user_id conflict
    const { data: retry } = await admin.from("operatives").select("*").eq("user_id", user.id).maybeSingle();
    if (retry) {
      return NextResponse.json({
        ok: true,
        claimed: true,
        operative: retry,
        admin_invite: String(retry.onboarding_source || "") === "admin_invite",
      });
    }
    console.error("claim-admin-invite update:", claimErr);
    return NextResponse.json({ error: claimErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    claimed: true,
    operative: claimed,
    admin_invite: String(claimed?.onboarding_source || "") === "admin_invite" || Boolean(candidate.admin_invited_at),
  });
}
