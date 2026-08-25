import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";

type JobEmbed = {
  id: string;
  reference: string;
  postcode: string;
  preferred_date: string;
  status?: string;
  accepted_quote_request_id?: string | null;
  services?: { name: string } | { name: string }[] | null;
};

/** Load quotes + assigned jobs for the signed-in contractor (service role, after identity merge). */
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
  const operative = identity.operative;

  if (!operative?.id) {
    return NextResponse.json({
      operative_id: null,
      merged: identity.merged,
      quotes: [],
      assigned: [],
    });
  }

  const operativeId = String(operative.id);

  const jobEmbed = `jobs!job_id (
           id, reference, postcode, preferred_date, status, services ( name )
         )`;

  const [qrRes, assignRes, acceptedQrRes] = await Promise.all([
    admin
      .from("quote_requests")
      .select(
        `id, status, initiated_by, deadline, message, sent_at, operative_id,
         ${jobEmbed},
         quote_responses ( price_pence, estimated_hours, sent_to_customer_at )`,
      )
      .eq("operative_id", operativeId)
      .order("sent_at", { ascending: false }),
    admin
      .from("job_assignments")
      .select(
        `id, assigned_at, completed_at,
         jobs!job_id ( id, reference, postcode, preferred_date, status, services ( name ) )`,
      )
      .eq("operative_id", operativeId)
      .order("assigned_at", { ascending: false }),
    admin
      .from("quote_requests")
      .select(
        `id, operative_id,
         jobs!job_id!inner ( id, reference, postcode, preferred_date, status, accepted_quote_request_id, services ( name ) )`,
      )
      .eq("operative_id", operativeId),
  ]);

  if (qrRes.error) {
    console.error("my-work quotes:", qrRes.error);
    return NextResponse.json({ error: qrRes.error.message }, { status: 400 });
  }
  if (assignRes.error) {
    console.error("my-work assignments:", assignRes.error);
    return NextResponse.json({ error: assignRes.error.message }, { status: 400 });
  }
  if (acceptedQrRes.error) {
    console.error("my-work accepted quotes:", acceptedQrRes.error);
  }

  const fromAssignments = assignRes.data || [];
  const assignedJobIds = new Set<string>();
  for (const row of fromAssignments) {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    if (job && typeof job === "object" && "id" in job) assignedJobIds.add(String(job.id));
  }

  const synthesized: typeof fromAssignments = [];
  for (const row of acceptedQrRes.data || []) {
    const job = (Array.isArray(row.jobs) ? row.jobs[0] : row.jobs) as JobEmbed | null;
    if (!job?.id) continue;
    if (job.accepted_quote_request_id !== row.id) continue;
    if (assignedJobIds.has(job.id)) continue;
    synthesized.push({
      id: `accepted-${job.id}`,
      assigned_at: job.preferred_date || new Date().toISOString(),
      completed_at: null,
      jobs: job,
    } as unknown as (typeof fromAssignments)[number]);
    assignedJobIds.add(job.id);
  }

  return NextResponse.json({
    operative_id: operativeId,
    merged: identity.merged,
    merged_count: identity.mergedCount,
    quotes: qrRes.data || [],
    assigned: [...fromAssignments, ...synthesized],
  });
}
