import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { computeContractorCancelPenalty } from "@/lib/contractor-cancel-job";

const CANCELLABLE_STATUSES = [
  "customer_accepted",
  "accepted",
  "awaiting_completion",
  "in_progress",
  "pending_confirmation",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
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

  const { data: operative } = await authClient
    .from("operatives")
    .select("id, penalty_balance_pence")
    .eq("user_id", user.id)
    .maybeSingle();

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

  let body: { reason?: string; confirmLatePenalty?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  if (!reason || reason.length < 10) {
    return NextResponse.json(
      { error: "Please provide a reason (at least 10 characters)." },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id, reference, status, preferred_date, preferred_time, contractor_cancelled_at, operative_marked_complete_at")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.contractor_cancelled_at || job.operative_marked_complete_at) {
    return NextResponse.json({ error: "This job can no longer be cancelled." }, { status: 400 });
  }

  if (!CANCELLABLE_STATUSES.includes(job.status)) {
    return NextResponse.json({ error: "Job is not in a cancellable state." }, { status: 400 });
  }

  const penalty = computeContractorCancelPenalty(job.preferred_date, job.preferred_time);
  if (penalty.isLateCancel && !body.confirmLatePenalty) {
    return NextResponse.json(
      {
        error: "Late cancellation requires confirmation",
        requiresConfirmation: true,
        penaltyPence: penalty.penaltyPence,
        hoursUntilStart: penalty.hoursUntilStart,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { error: jobUpdateErr } = await admin
    .from("jobs")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancelled_by: user.id,
      contractor_cancelled_at: now,
      contractor_cancel_reason: reason,
      contractor_cancel_penalty_pence: penalty.penaltyPence,
    })
    .eq("id", jobId);

  if (jobUpdateErr) {
    return NextResponse.json({ error: jobUpdateErr.message }, { status: 400 });
  }

  if (penalty.penaltyPence > 0) {
    const currentBalance = operative.penalty_balance_pence ?? 0;
    await admin
      .from("operatives")
      .update({ penalty_balance_pence: currentBalance + penalty.penaltyPence })
      .eq("id", operative.id);
  }

  return NextResponse.json({
    ok: true,
    penaltyPence: penalty.penaltyPence,
    reference: job.reference,
  });
}

/** Preview penalty without cancelling. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const authClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: operative } = await authClient
    .from("operatives")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: job } = await authClient
    .from("jobs")
    .select("preferred_date, preferred_time, status")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const penalty = computeContractorCancelPenalty(job.preferred_date, job.preferred_time);
  return NextResponse.json({
    cancellable: CANCELLABLE_STATUSES.includes(job.status),
    ...penalty,
  });
}
