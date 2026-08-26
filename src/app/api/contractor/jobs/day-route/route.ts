import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";
import { geocodeUkPostcode } from "@/lib/postcode-distance";
import { timeToMinutes } from "@/lib/schedule-conflicts";

/**
 * Jobs for one calendar day with coordinates — for journey map plotting.
 * GET ?date=YYYY-MM-DD
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
  const byJob = new Map<
    string,
    {
      jobId: string;
      reference: string;
      postcode: string;
      city: string | null;
      address: string;
      preferred_time: string | null;
      service_name: string;
      kind: "assigned" | "quoted";
      estimated_hours: number | null;
    }
  >();

  const { data: assignments } = await admin
    .from("job_assignments")
    .select(
      `id,
       jobs!job_id (
         id, reference, postcode, city, address_line_1, preferred_date, preferred_time, status,
         services ( name )
       )`,
    )
    .eq("operative_id", operativeId)
    .is("completed_at", null);

  for (const row of assignments || []) {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    if (!job || String(job.preferred_date || "").slice(0, 10) !== date) continue;
    if (["cancelled"].includes(String(job.status || ""))) continue;
    const svc = job.services as { name?: string } | { name?: string }[] | null;
    const svcName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
    byJob.set(String(job.id), {
      jobId: String(job.id),
      reference: String(job.reference || job.id),
      postcode: String(job.postcode || ""),
      city: job.city ? String(job.city) : null,
      address: String(job.address_line_1 || ""),
      preferred_time: job.preferred_time ? String(job.preferred_time) : null,
      service_name: svcName || "Cleaning",
      kind: "assigned",
      estimated_hours: null,
    });
  }

  const { data: quotes } = await admin
    .from("quote_requests")
    .select(
      `id, status,
       quote_responses ( estimated_hours ),
       jobs!job_id (
         id, reference, postcode, city, address_line_1, preferred_date, preferred_time, status,
         services ( name )
       )`,
    )
    .eq("operative_id", operativeId);

  for (const row of quotes || []) {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    const resp = Array.isArray(row.quote_responses) ? row.quote_responses[0] : row.quote_responses;
    if (!job || !resp) continue;
    if (String(job.preferred_date || "").slice(0, 10) !== date) continue;
    if (byJob.has(String(job.id))) continue;
    if (["cancelled", "declined", "expired"].includes(String(row.status || ""))) continue;
    const svc = job.services as { name?: string } | { name?: string }[] | null;
    const svcName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
    byJob.set(String(job.id), {
      jobId: String(job.id),
      reference: String(job.reference || job.id),
      postcode: String(job.postcode || ""),
      city: job.city ? String(job.city) : null,
      address: String(job.address_line_1 || ""),
      preferred_time: job.preferred_time ? String(job.preferred_time) : null,
      service_name: svcName || "Cleaning",
      kind: "quoted",
      estimated_hours: resp.estimated_hours != null ? Number(resp.estimated_hours) : null,
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
