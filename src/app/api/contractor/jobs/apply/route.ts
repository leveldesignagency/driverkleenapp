import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CUSTOMER_MARKUP = 1.175;

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const { data: operative } = await supabase
    .from("operatives")
    .select("id, is_verified, max_travel_radius_miles")
    .eq("user_id", user.id)
    .single();

  if (!operative?.is_verified) {
    return NextResponse.json({ error: "Verified contractor account required" }, { status: 403 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("id, service_id, status")
    .eq("id", jobId)
    .single();

  if (!job || !["pending", "awaiting_quotes"].includes(job.status)) {
    return NextResponse.json({ error: "Job is not open for quotes" }, { status: 400 });
  }

  const { data: os } = await supabase
    .from("operative_services")
    .select("id")
    .eq("operative_id", operative.id)
    .eq("service_id", job.service_id)
    .maybeSingle();

  if (!os) {
    return NextResponse.json(
      { error: "Add this service under Services & contracts before bidding." },
      { status: 400 },
    );
  }

  if (travelDistanceMiles != null && operative.max_travel_radius_miles != null) {
    if (travelDistanceMiles > operative.max_travel_radius_miles) {
      return NextResponse.json({ error: "Job is outside your travel radius." }, { status: 400 });
    }
  }

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const customerPricePence = Math.round(pricePence * CUSTOMER_MARKUP);
  const now = new Date().toISOString();

  const { data: qr, error: qrErr } = await supabase
    .from("quote_requests")
    .insert({
      job_id: jobId,
      operative_id: operative.id,
      sent_by: user.id,
      initiated_by: "contractor",
      status: "quoted",
      deadline,
      message: notes?.trim() || "Contractor applied from the job board.",
      sent_at: now,
      responded_at: now,
    })
    .select("id")
    .single();

  if (qrErr) {
    if (qrErr.code === "23505") {
      return NextResponse.json({ error: "You have already bid on this job." }, { status: 409 });
    }
    return NextResponse.json({ error: qrErr.message }, { status: 400 });
  }

  const { error: respErr } = await supabase.from("quote_responses").insert({
    quote_request_id: qr.id,
    price_pence: pricePence,
    customer_price_pence: customerPricePence,
    estimated_hours: estimatedHours ?? null,
    available_date: availableDate || null,
    notes: notes?.trim() || null,
    operative_service_id: os.id,
    sent_to_customer_at: now,
  });

  if (respErr) {
    return NextResponse.json({ error: respErr.message }, { status: 400 });
  }

  if (job.status === "pending") {
    await supabase.from("jobs").update({ status: "awaiting_quotes" }).eq("id", jobId);
  }

  return NextResponse.json({
    ok: true,
    quoteRequestId: qr.id,
    customerPricePence,
    message: "Your quote was submitted. The customer and Kleen admin can review it.",
  });
}
