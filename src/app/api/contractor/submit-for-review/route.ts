import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateContractorOnboarding } from "@/lib/contractor-onboarding";
import { sendAdminContractorReviewEmail } from "@/lib/resend-admin-notify";

function isMissingSubmittedForReviewColumn(message: string) {
  const m = message.toLowerCase();
  return m.includes("submitted_for_review_at") || m.includes("schema cache");
}

export async function POST() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "operative") {
    return NextResponse.json({ error: "Contractor account required" }, { status: 403 });
  }

  const { data: operative, error: opErr } = await supabase
    .from("operatives")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (opErr || !operative) {
    return NextResponse.json({ error: "Contractor profile not found" }, { status: 404 });
  }

  if (operative.is_verified) {
    return NextResponse.json({ error: "Your account is already verified" }, { status: 400 });
  }

  const { count } = await supabase
    .from("operative_services")
    .select("id", { count: "exact", head: true })
    .eq("operative_id", operative.id);

  const validationError = validateContractorOnboarding(operative, count ?? 0);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: updated, error: updateErr } = await admin
    .from("operatives")
    .update({
      submitted_for_review_at: now,
      rejected_at: null,
      rejection_message: null,
    })
    .eq("id", operative.id)
    .select("*")
    .single();

  if (updateErr && isMissingSubmittedForReviewColumn(updateErr.message)) {
    return NextResponse.json(
      {
        error:
          "Database is missing operatives.submitted_for_review_at. Run migration 036 in Supabase.",
      },
      { status: 503 },
    );
  }

  if (updateErr || !updated) {
    return NextResponse.json({ error: updateErr?.message || "Submit failed" }, { status: 400 });
  }

  await sendAdminContractorReviewEmail({
    operativeId: String(updated.id),
    fullName: String(updated.full_name || "Contractor"),
    email: String(updated.email || user.email || ""),
    companyName: String(updated.company_name || updated.trading_name || ""),
  }).then((result) => {
    if (!result.ok) {
      console.error("submit-for-review admin email:", result.error);
    }
  });

  return NextResponse.json({
    ok: true,
    submitted_for_review_at: updated.submitted_for_review_at,
  });
}
