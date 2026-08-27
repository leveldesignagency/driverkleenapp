import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { runContractorFieldAction, type FieldActionName } from "@/lib/contractor-field-job";
import {
  loadJobFieldEmailSnapshot,
  sendEmailsForFieldAction,
} from "@/lib/field-status-emails";

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

  const { data: operative } = await authClient.from("operatives").select("id, full_name").eq("user_id", user.id).maybeSingle();
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

  if (action === "complete") {
    const { data: reportRows } = await admin
      .from("job_reports")
      .select("stage, checklist")
      .eq("job_id", jobId)
      .eq("operative_id", operative.id);

    const { isChecklistComplete, parseChecklist } = await import(
      "@/lib/job-inspection-checklist"
    );
    const pre = reportRows?.find((r) => r.stage === "pre_job");
    const post = reportRows?.find((r) => r.stage === "post_job");
    if (!pre || !isChecklistComplete(parseChecklist(pre.checklist, "pre_job"), "pre_job")) {
      return NextResponse.json(
        { error: "Complete and save the “Before you start” due-diligence checklist first." },
        { status: 400 },
      );
    }
    if (!post || !isChecklistComplete(parseChecklist(post.checklist, "post_job"), "post_job")) {
      return NextResponse.json(
        { error: "Complete and save the “After the job” due-diligence checklist first." },
        { status: 400 },
      );
    }
  }

  const before = await loadJobFieldEmailSnapshot(admin, jobId);

  const result = await runContractorFieldAction(admin, jobId, action, {
    incompleteReason: body.reason,
    requireArrivedBeforeComplete: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await sendEmailsForFieldAction({
    supabase: admin,
    jobId,
    action,
    before,
    incompleteReason: body.reason,
    contractorName: operative.full_name?.trim() || undefined,
  });

  return NextResponse.json({ ok: true });
}
