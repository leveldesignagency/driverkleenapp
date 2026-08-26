import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";

const CUSTOMER_MARKUP = 1.175;
const OPEN_STATUSES = ["pending", "awaiting_quotes", "quotes_received"];

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { jobId, pricePence, estimatedHours, availableDate, notes, travelDistanceMiles } = body as {
    jobId?: string;
    pricePence?: number;
    estimatedHours?: number;
    availableDate?: string;
    notes?: string;
    travelDistanceMiles?: number;
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
  const maxRadius = Number(operative.max_travel_radius_miles);

  const { data: job } = await admin
    .from("jobs")
    .select("id, service_id, status")
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

  if (travelDistanceMiles != null && Number.isFinite(maxRadius) && maxRadius > 0) {
    if (travelDistanceMiles > maxRadius) {
      return NextResponse.json({ error: "Job is outside your travel radius." }, { status: 400 });
    }
  }

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const customerPricePence = Math.round(pricePence * CUSTOMER_MARKUP);
  const now = new Date().toISOString();

  // Reuse marketplace invite row if present; otherwise create a contractor apply row.
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
    available_date: availableDate || null,
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
