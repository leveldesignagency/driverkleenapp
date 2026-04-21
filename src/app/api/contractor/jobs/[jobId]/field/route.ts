import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runContractorFieldAction, type FieldActionName } from "@/lib/contractor-field-job";
import { sendCustomerContractorEnRouteEmail } from "@/lib/resend-customer-job-updates";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const authClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: operative } = await authClient.from("operatives").select("id").eq("user_id", user.id).maybeSingle();
  if (!operative?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: assignment } = await authClient
    .from("job_assignments")
    .select("id")
    .eq("job_id", jobId)
    .eq("operative_id", operative.id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "You are not assigned to this job" }, { status: 403 });
  }

  let body: { action?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as FieldActionName | undefined;
  if (!action || !["en_route", "arrived", "complete", "incomplete"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: before } = await admin
    .from("jobs")
    .select("operative_en_route_at, user_id, reference")
    .eq("id", jobId)
    .maybeSingle();

  const result = await runContractorFieldAction(admin, jobId, action, {
    incompleteReason: body.reason,
    requireArrivedBeforeComplete: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (action === "en_route" && before && !before.operative_en_route_at) {
    const uid = (before as { user_id?: string }).user_id;
    const ref = (before as { reference?: string }).reference || jobId.slice(0, 8).toUpperCase();
    if (uid) {
      const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
      const toEmail = prof?.email?.trim();
      if (toEmail) {
        await sendCustomerContractorEnRouteEmail({
          toEmail,
          customerName: prof?.full_name?.trim() || "there",
          jobReference: ref,
          jobId,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
