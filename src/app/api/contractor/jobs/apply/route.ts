import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";
import { findConflict, jobWindow } from "@/lib/schedule-conflicts";

const CUSTOMER_MARKUP = 1.175;
const OPEN_STATUSES = ["pending", "awaiting_quotes", "quotes_received"];

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { jobId, pricePence, estimatedHours, notes } = body as {
    jobId?: string;
    pricePence?: number;
    estimatedHours?: number;
    notes?: string;
  };

  if (!jobId || !pricePence || pricePence <= 0) {
    return NextResponse.json({ error: "jobId and pricePence required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { operative } = await resolveOperativeIdentity(admin, user.id, user.email);

  if (!operative?.is_verified) {
    return NextResponse.json({ error: "Verified contractor account required" }, { status: 403 });
  }

  const operativeId = String(operative.id);

  const { data: job } = await admin
    .from("jobs")
    .select("id, reference, service_id, status, preferred_date, preferred_time")
    .eq("id", jobId)
    .single();

  if (!job || !OPEN_STATUSES.includes(job.status)) {
    return NextResponse.json({ error: "Job is not open for quotes" }, { status: 400 });
  }

  const { data: os } = await admin
    .from("operative_services")
    .select("id")
    .eq("operative_id", operativeId)
    .eq("service_id", job.service_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!os) {
    return NextResponse.json(
      { error: "Add this service under Services & contracts before bidding." },
      { status: 400 },
    );
  }

  // Schedule conflict: can't be on two jobs at overlapping times the same day.
  const candidate = jobWindow({
    jobId: job.id,
    reference: job.reference || job.id.slice(0, 8),
    preferredDate: job.preferred_date,
    preferredTime: job.preferred_time,
    estimatedHours: estimatedHours ?? null,
  });

  if (candidate) {
    const existingWindows = await loadOperativeDayWindows(admin, operativeId, candidate.date);
    const conflict = findConflict(candidate, existingWindows);
    if (conflict) {
      const fmt = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return NextResponse.json(
        {
          error: `This overlaps ${conflict.reference} on ${conflict.date} (${fmt(conflict.startMin)}–${fmt(conflict.endMin)}). You can’t take two jobs at once.`,
          conflict: conflict,
        },
        { status: 409 },
      );
    }
  }

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const customerPricePence = Math.round(pricePence * CUSTOMER_MARKUP);
  const now = new Date().toISOString();

  let quoteRequestId: string | null = null;
  const { data: existingQr } = await admin
    .from("quote_requests")
    .select("id, status")
    .eq("job_id", jobId)
    .eq("operative_id", operativeId)
    .maybeSingle();

  if (existingQr) {
    const { data: existingResp } = await admin
      .from("quote_responses")
      .select("id")
      .eq("quote_request_id", existingQr.id)
      .maybeSingle();
    if (existingResp) {
      return NextResponse.json({ error: "You have already bid on this job." }, { status: 409 });
    }
    await admin
      .from("quote_requests")
      .update({
        status: "quoted",
        initiated_by: "contractor",
        message: notes?.trim() || "Contractor applied from Find a Job.",
        responded_at: now,
      })
      .eq("id", existingQr.id);
    quoteRequestId = existingQr.id;
  } else {
    const { data: qr, error: qrErr } = await admin
      .from("quote_requests")
      .insert({
        job_id: jobId,
        operative_id: operativeId,
        sent_by: user.id,
        initiated_by: "contractor",
        status: "quoted",
        deadline,
        message: notes?.trim() || "Contractor applied from Find a Job.",
        sent_at: now,
        responded_at: now,
      })
      .select("id")
      .single();

    if (qrErr || !qr) {
      return NextResponse.json({ error: qrErr?.message || "Could not create quote" }, { status: 400 });
    }
    quoteRequestId = qr.id;
  }

  const { error: respErr } = await admin.from("quote_responses").insert({
    quote_request_id: quoteRequestId,
    price_pence: pricePence,
    customer_price_pence: customerPricePence,
    estimated_hours: estimatedHours ?? null,
    available_date: job.preferred_date || null,
    notes: notes?.trim() || null,
    operative_service_id: os.id,
  });

  if (respErr) {
    return NextResponse.json({ error: respErr.message }, { status: 400 });
  }

  if (job.status === "pending") {
    await admin.from("jobs").update({ status: "awaiting_quotes" }).eq("id", jobId);
  } else if (job.status === "awaiting_quotes") {
    await admin.from("jobs").update({ status: "quotes_received" }).eq("id", jobId);
  }

  return NextResponse.json({
    ok: true,
    quoteRequestId,
    customerPricePence,
    message: "Your quote was submitted. Kleen can send it to the customer when ready.",
  });
}

async function loadOperativeDayWindows(
  admin: ReturnType<typeof createServiceRoleClient>,
  operativeId: string,
  date: string,
) {
  const windows = [];

  const { data: assignments } = await admin
    .from("job_assignments")
    .select(
      `id, jobs!job_id ( id, reference, preferred_date, preferred_time, status )`,
    )
    .eq("operative_id", operativeId)
    .is("completed_at", null);

  for (const row of assignments || []) {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    if (!job || String(job.preferred_date || "").slice(0, 10) !== date) continue;
    if (["cancelled", "completed", "funds_released"].includes(String(job.status || ""))) continue;
    const w = jobWindow({
      jobId: String(job.id),
      reference: String(job.reference || job.id),
      preferredDate: job.preferred_date,
      preferredTime: job.preferred_time,
    });
    if (w) windows.push(w);
  }

  const { data: quotes } = await admin
    .from("quote_requests")
    .select(
      `id, status,
       quote_responses ( estimated_hours ),
       jobs!job_id ( id, reference, preferred_date, preferred_time, status, accepted_quote_request_id )`,
    )
    .eq("operative_id", operativeId);

  for (const row of quotes || []) {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    const resp = Array.isArray(row.quote_responses) ? row.quote_responses[0] : row.quote_responses;
    if (!job || !resp) continue;
    if (String(job.preferred_date || "").slice(0, 10) !== date) continue;
    // Count assigned / accepted / still-open quotes on that day as diary holds
    const accepted = job.accepted_quote_request_id === row.id;
    const openQuote = ["quoted", "sent", "viewed"].includes(String(row.status || ""));
    if (!accepted && !openQuote) continue;
    if (["cancelled", "completed", "funds_released"].includes(String(job.status || ""))) continue;
    const w = jobWindow({
      jobId: String(job.id),
      reference: String(job.reference || job.id),
      preferredDate: job.preferred_date,
      preferredTime: job.preferred_time,
      estimatedHours: resp.estimated_hours,
    });
    if (w) windows.push(w);
  }

  return windows;
}
