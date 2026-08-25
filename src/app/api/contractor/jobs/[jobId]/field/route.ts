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
