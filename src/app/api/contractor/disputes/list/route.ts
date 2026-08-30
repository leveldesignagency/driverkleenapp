import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";

/**
 * Contractor disputes list — only cases Kleen has engaged (status != open).
 * Customer PII is never returned.
 */
export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const identity = await resolveOperativeIdentity(admin, user.id, user.email);
  const operativeId = identity.operative?.id ? String(identity.operative.id) : null;
  if (!operativeId) {
    return NextResponse.json({ disputes: [] });
  }

  const { data: assignments } = await admin
    .from("job_assignments")
    .select("job_id")
    .eq("operative_id", operativeId);

  const jobIds = Array.from(new Set((assignments || []).map((a) => a.job_id).filter(Boolean)));
  if (jobIds.length === 0) {
    return NextResponse.json({ disputes: [] });
  }

  const { data: rows, error } = await admin
    .from("disputes")
    .select("id, job_id, status, reason, resolution, created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("contractor disputes list:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const candidateIds = (rows || []).map((r) => r.id);
  const { data: opMsgs } = candidateIds.length
    ? await admin
        .from("dispute_messages")
        .select("dispute_id")
        .in("dispute_id", candidateIds)
        .eq("recipient_role", "operative")
    : { data: [] as { dispute_id: string }[] };

  const messagedIds = new Set((opMsgs || []).map((m) => m.dispute_id));
  const visible = (rows || []).filter(
    (r) => r.status === "resolved" || r.status === "closed" || messagedIds.has(r.id),
  );

  const disputeJobIds = Array.from(new Set(visible.map((r) => r.job_id)));
  const { data: jobs } = disputeJobIds.length
    ? await admin.from("jobs").select("id, reference, service_id, postcode").in("id", disputeJobIds)
    : { data: [] as { id: string; reference: string; service_id: string; postcode: string | null }[] };

  const jobMap = new Map((jobs || []).map((j) => [j.id, j]));

  const disputes = visible.map((r) => {
    const job = jobMap.get(r.job_id);
    return {
      id: r.id,
      job_id: r.job_id,
      status: r.status,
      reason: r.reason,
      resolution: r.resolution,
      created_at: r.created_at,
      jobs: job
        ? {
            reference: job.reference,
            service_id: job.service_id,
            postcode: job.postcode,
          }
        : null,
    };
  });

  return NextResponse.json({ disputes });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { disputeId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const disputeId = typeof body.disputeId === "string" ? body.disputeId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!disputeId || !message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const identity = await resolveOperativeIdentity(admin, user.id, user.email);
  const operativeId = identity.operative?.id ? String(identity.operative.id) : null;
  if (!operativeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: dispute } = await admin
    .from("disputes")
    .select("id, job_id, status")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: opMsg } = await admin
    .from("dispute_messages")
    .select("id")
    .eq("dispute_id", disputeId)
    .eq("recipient_role", "operative")
    .limit(1)
    .maybeSingle();

  const allowed =
    dispute.status === "resolved" ||
    dispute.status === "closed" ||
    Boolean(opMsg);

  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (dispute.status === "resolved" || dispute.status === "closed") {
    return NextResponse.json({ error: "This dispute is closed." }, { status: 400 });
  }

  const { data: assignment } = await admin
    .from("job_assignments")
    .select("id")
    .eq("job_id", dispute.job_id)
    .eq("operative_id", operativeId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("dispute_messages").insert({
    dispute_id: disputeId,
    sender_id: user.id,
    recipient_role: "admin",
    message,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
