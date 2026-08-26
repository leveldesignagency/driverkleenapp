import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";
import { geocodeUkPostcode } from "@/lib/postcode-distance";
import { timeToMinutes } from "@/lib/schedule-conflicts";

/** Normalise DB date / timestamptz / ISO string to YYYY-MM-DD. */
function toDayKey(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${mo}-${day}`;
    }
    return null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    const mo = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const day = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }
  return null;
}

type JobEmbed = {
  id: string;
  reference?: string | null;
  postcode?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  status?: string | null;
  operative_en_route_at?: string | null;
  operative_arrived_at?: string | null;
  operative_marked_complete_at?: string | null;
  accepted_quote_request_id?: string | null;
  services?: { name?: string } | { name?: string }[] | null;
};

function unwrapJob(jobs: unknown): JobEmbed | null {
  if (!jobs) return null;
  const job = Array.isArray(jobs) ? jobs[0] : jobs;
  if (!job || typeof job !== "object" || !("id" in job)) return null;
  return job as JobEmbed;
}

function serviceName(job: JobEmbed): string {
  const svc = job.services;
  if (Array.isArray(svc)) return svc[0]?.name || "Cleaning";
  return svc?.name || "Cleaning";
}

/**
 * Jobs for one calendar day with coordinates — for journey map plotting.
 * GET ?date=YYYY-MM-DD
 *
 * Matches Schedule: all assignments for that preferred_date (not only open completed_at),
 * plus accepted quotes that never got a job_assignments row.
 */
export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(request.url).searchParams.get("date")?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { operative } = await resolveOperativeIdentity(admin, user.id, user.email);
  if (!operative?.id) {
    return NextResponse.json({ stops: [], date, base: null });
  }

  const operativeId = String(operative.id);
  type StopRow = {
    jobId: string;
    reference: string;
    postcode: string;
    city: string | null;
    address: string;
    preferred_time: string | null;
    preferred_date: string;
    service_name: string;
    status: string;
    kind: "assigned" | "quoted";
    estimated_hours: number | null;
    operative_en_route_at: string | null;
    operative_arrived_at: string | null;
    operative_marked_complete_at: string | null;
  };

  const byJob = new Map<string, StopRow>();

  const jobFields = `
    id, reference, postcode, city, address_line_1, preferred_date, preferred_time, status,
    operative_en_route_at, operative_arrived_at, operative_marked_complete_at,
    accepted_quote_request_id,
    services ( name )
  `;

  // Do NOT filter completed_at — Schedule shows those jobs; journey must match.
  const assignRes = await admin
    .from("job_assignments")
    .select(`id, completed_at, jobs!job_id ( ${jobFields} )`)
    .eq("operative_id", operativeId);

  if (assignRes.error) {
    console.error("day-route assignments:", assignRes.error);
    return NextResponse.json({ error: assignRes.error.message, stops: [], date }, { status: 400 });
  }

  for (const row of assignRes.data || []) {
    const job = unwrapJob(row.jobs);
    if (!job) continue;
    if (toDayKey(job.preferred_date) !== date) continue;
    if (["cancelled"].includes(String(job.status || ""))) continue;
    byJob.set(String(job.id), {
      jobId: String(job.id),
      reference: String(job.reference || job.id),
      postcode: String(job.postcode || ""),
      city: job.city ? String(job.city) : null,
      address: String(job.address_line_1 || ""),
      preferred_time: job.preferred_time ? String(job.preferred_time) : null,
      preferred_date: date,
      service_name: serviceName(job),
      status: String(job.status || ""),
      kind: "assigned",
      estimated_hours: null,
      operative_en_route_at: job.operative_en_route_at ? String(job.operative_en_route_at) : null,
      operative_arrived_at: job.operative_arrived_at ? String(job.operative_arrived_at) : null,
      operative_marked_complete_at: job.operative_marked_complete_at
        ? String(job.operative_marked_complete_at)
        : null,
    });
  }

  // Accepted quote with no assignment row (same synthesis as my-work).
  const acceptedQrRes = await admin
    .from("quote_requests")
    .select(`id, jobs!job_id!inner ( ${jobFields} )`)
    .eq("operative_id", operativeId);

  if (acceptedQrRes.error) {
    console.warn("day-route accepted quotes:", acceptedQrRes.error.message);
  }

  for (const row of acceptedQrRes.data || []) {
    const job = unwrapJob(row.jobs);
    if (!job?.id) continue;
    if (job.accepted_quote_request_id !== row.id) continue;
    if (byJob.has(String(job.id))) continue;
    if (toDayKey(job.preferred_date) !== date) continue;
    if (["cancelled"].includes(String(job.status || ""))) continue;
    byJob.set(String(job.id), {
      jobId: String(job.id),
      reference: String(job.reference || job.id),
      postcode: String(job.postcode || ""),
      city: job.city ? String(job.city) : null,
      address: String(job.address_line_1 || ""),
      preferred_time: job.preferred_time ? String(job.preferred_time) : null,
      preferred_date: date,
      service_name: serviceName(job),
      status: String(job.status || ""),
      kind: "assigned",
      estimated_hours: null,
      operative_en_route_at: job.operative_en_route_at ? String(job.operative_en_route_at) : null,
      operative_arrived_at: job.operative_arrived_at ? String(job.operative_arrived_at) : null,
      operative_marked_complete_at: job.operative_marked_complete_at
        ? String(job.operative_marked_complete_at)
        : null,
    });
  }

  const quotesRes = await admin
    .from("quote_requests")
    .select(
      `id, status,
       quote_responses ( estimated_hours ),
       jobs!job_id ( ${jobFields} )`,
    )
    .eq("operative_id", operativeId);

  if (quotesRes.error) {
    console.warn("day-route quotes:", quotesRes.error.message);
  }

  for (const row of quotesRes.data || []) {
    const job = unwrapJob(row.jobs);
    if (!job) continue;
    if (byJob.has(String(job.id))) continue;
    if (toDayKey(job.preferred_date) !== date) continue;
    if (["cancelled", "declined", "expired"].includes(String(row.status || ""))) continue;
    if (["cancelled"].includes(String(job.status || ""))) continue;
    const resp = Array.isArray(row.quote_responses) ? row.quote_responses[0] : row.quote_responses;
    byJob.set(String(job.id), {
      jobId: String(job.id),
      reference: String(job.reference || job.id),
      postcode: String(job.postcode || ""),
      city: job.city ? String(job.city) : null,
      address: String(job.address_line_1 || ""),
      preferred_time: job.preferred_time ? String(job.preferred_time) : null,
      preferred_date: date,
      service_name: serviceName(job),
      status: String(job.status || ""),
      kind: "quoted",
      estimated_hours:
        resp && typeof resp === "object" && "estimated_hours" in resp && resp.estimated_hours != null
          ? Number(resp.estimated_hours)
          : null,
      operative_en_route_at: job.operative_en_route_at ? String(job.operative_en_route_at) : null,
      operative_arrived_at: job.operative_arrived_at ? String(job.operative_arrived_at) : null,
      operative_marked_complete_at: job.operative_marked_complete_at
        ? String(job.operative_marked_complete_at)
        : null,
    });
  }

  const basePostcode = String(operative.base_postcode || "").trim();
  const baseCoords = basePostcode ? await geocodeUkPostcode(basePostcode) : null;

  const stops = [];
  for (const stop of Array.from(byJob.values())) {
    const coords = stop.postcode ? await geocodeUkPostcode(stop.postcode) : null;
    stops.push({
      ...stop,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      sort_minutes: timeToMinutes(stop.preferred_time) ?? 24 * 60,
    });
  }

  stops.sort((a, b) => a.sort_minutes - b.sort_minutes);

  return NextResponse.json({
    date,
    base: baseCoords
      ? { postcode: basePostcode, lat: baseCoords.lat, lng: baseCoords.lng }
      : basePostcode
        ? { postcode: basePostcode, lat: null, lng: null }
        : null,
    stops,
  });
}
