import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";
import {
  distanceMiles,
  geocodeUkPostcode,
  postcodeMatchesServiceAreas,
} from "@/lib/postcode-distance";

/** Statuses where contractors can still discover and bid. */
const OPEN_STATUSES = ["pending", "awaiting_quotes", "quotes_received"] as const;

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
  const radius = Number(operative.max_travel_radius_miles) || 25;
  const areas = Array.isArray(operative.service_areas)
    ? operative.service_areas.filter((a): a is string => typeof a === "string")
    : [];

  const baseCoords = basePostcode ? await geocodeUkPostcode(basePostcode) : null;

  // Service role — bypasses RLS that hides jobs once a marketplace invite exists.
  const { data: jobs, error } = await admin
    .from("jobs")
    .select(
      `
        id, reference, status, postcode, city, preferred_date, preferred_time, cleaning_type, notes,
        service_id, services ( name ),
        job_details ( quantity, complexity, size )
      `,
    )
    .in("status", [...OPEN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: myServices } = await admin
    .from("operative_services")
    .select("service_id")
    .eq("operative_id", operativeId)
    .eq("is_active", true);

  const serviceIds = new Set((myServices || []).map((s) => s.service_id as string));

  // Already bid (has a quote_response) — hide from Find a Job. Marketplace invites
  // without a response still appear so the contractor can apply from Find a Job.
  const { data: myQuoted } = await admin
    .from("quote_requests")
    .select("job_id, quote_responses ( id )")
    .eq("operative_id", operativeId);

  const alreadyAppliedJobIds = new Set<string>();
  for (const row of myQuoted || []) {
    const resps = row.quote_responses;
    const hasResponse = Array.isArray(resps) ? resps.length > 0 : Boolean(resps);
    if (hasResponse && row.job_id) alreadyAppliedJobIds.add(String(row.job_id));
  }

  type JobRow = NonNullable<typeof jobs>[number];
  const results: Array<Record<string, unknown>> = [];
  let skippedService = 0;
  let skippedArea = 0;
  let skippedDistance = 0;
  let skippedApplied = 0;

  for (const job of (jobs || []) as JobRow[]) {
    if (alreadyAppliedJobIds.has(String(job.id))) {
      skippedApplied += 1;
      continue;
    }

    // If contractor has linked services, require a match. If none linked, show all open jobs
    // so Find a Job is not empty — apply will still require the service link.
    if (serviceIds.size > 0 && !serviceIds.has(job.service_id as string)) {
      skippedService += 1;
      continue;
    }

    if (areas.length && !postcodeMatchesServiceAreas(String(job.postcode || ""), areas)) {
      skippedArea += 1;
      continue;
    }

    let distanceMilesVal: number | null = null;
    if (baseCoords) {
      const jobCoords = await geocodeUkPostcode(String(job.postcode || ""));
      if (jobCoords) {
        distanceMilesVal = Math.round(distanceMiles(baseCoords, jobCoords) * 10) / 10;
        if (distanceMilesVal > radius) {
          skippedDistance += 1;
          continue;
        }
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
    filter: {
      base_postcode: basePostcode || null,
      radius_miles: radius,
      service_areas: areas,
      linked_services: serviceIds.size,
    },
    meta: {
      open_jobs_scanned: (jobs || []).length,
      skipped_service: skippedService,
      skipped_area: skippedArea,
      skipped_distance: skippedDistance,
      skipped_already_applied: skippedApplied,
    },
  });
}
