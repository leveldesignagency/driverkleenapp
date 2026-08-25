import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";
import {
  distanceMiles,
  geocodeUkPostcode,
  postcodeMatchesServiceAreas,
} from "@/lib/postcode-distance";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { operative } = await resolveOperativeIdentity(admin, user.id, user.email);

  if (!operative?.is_verified) {
    return NextResponse.json({ error: "Verified contractor account required" }, { status: 403 });
  }

  const operativeId = String(operative.id);

  const basePostcode = String(operative.base_postcode || "").trim();
  const radius = operative.max_travel_radius_miles ?? 25;
  const areas = Array.isArray(operative.service_areas) ? operative.service_areas : [];

  const baseCoords = basePostcode ? await geocodeUkPostcode(basePostcode) : null;

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select(
      `
        id, reference, status, postcode, city, preferred_date, preferred_time, cleaning_type, notes,
        service_id, services ( name ),
        job_details ( quantity, complexity, size )
      `
    )
    .in("status", ["pending", "awaiting_quotes"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: myServices } = await supabase
    .from("operative_services")
    .select("service_id")
    .eq("operative_id", operativeId);

  const serviceIds = new Set((myServices || []).map((s) => s.service_id));

  type JobRow = NonNullable<typeof jobs>[number];
  const results: Array<Record<string, unknown>> = [];

  for (const job of (jobs || []) as JobRow[]) {
    if (!serviceIds.has(job.service_id)) continue;
    if (areas.length && !postcodeMatchesServiceAreas(job.postcode, areas)) continue;

    let distanceMilesVal: number | null = null;
    if (baseCoords) {
      const jobCoords = await geocodeUkPostcode(job.postcode);
      if (jobCoords) {
        distanceMilesVal = Math.round(distanceMiles(baseCoords, jobCoords) * 10) / 10;
        if (distanceMilesVal > radius) continue;
      }
    }

    const svc = job.services as { name?: string } | { name?: string }[] | null;
    const svcName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
    const details = job.job_details as
      | { quantity?: number; complexity?: string; size?: string }
      | { quantity?: number; complexity?: string; size?: string }[]
      | null;
    const det = Array.isArray(details) ? details[0] : details;

    results.push({
      id: job.id,
      reference: job.reference,
      status: job.status,
      postcode: job.postcode,
      city: job.city,
      preferred_date: job.preferred_date,
      preferred_time: job.preferred_time,
      cleaning_type: job.cleaning_type,
      notes: job.notes,
      service_id: job.service_id,
      service_name: svcName || "Cleaning",
      distance_miles: distanceMilesVal,
      quantity: det?.quantity ?? null,
      complexity: det?.complexity ?? null,
    });
  }

  results.sort((a, b) => {
    const da = (a.distance_miles as number | null) ?? 9999;
    const db = (b.distance_miles as number | null) ?? 9999;
    return da - db;
  });

  return NextResponse.json({
    jobs: results,
    filter: { base_postcode: basePostcode || null, radius_miles: radius },
  });
}
