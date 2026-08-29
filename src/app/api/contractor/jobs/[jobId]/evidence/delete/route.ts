import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { randomUUID } from "crypto";

/** Best-effort delete of evidence files from storage (item row already deleted via RLS). */
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

  const { data: operative } = await authClient.from("operatives").select("id").eq("user_id", user.id).maybeSingle();
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

  let body: { paths?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paths = (body.paths || [])
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .filter((p) => p.startsWith(`${jobId}/`) && !p.includes(".."));

  if (paths.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.storage.from("job-evidence").remove(paths);
  if (error) {
    console.error("job-evidence delete:", error);
    // Soft-fail — DB row is already gone
    return NextResponse.json({ ok: true, deleted: 0, warning: error.message });
  }

  return NextResponse.json({ ok: true, deleted: paths.length, requestId: randomUUID() });
}
