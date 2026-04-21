import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_BYTES = 52 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: `Unsupported type: ${mime}` }, { status: 400 });
  }

  const origName = file instanceof File && file.name ? file.name : "upload";
  const ext = (origName.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  const key = `${jobId}/${operative.id}/${randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { error: upErr } = await admin.storage.from("job-evidence").upload(key, buf, {
    contentType: mime,
    upsert: false,
  });

  if (upErr) {
    console.error("job-evidence upload:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: signed } = await authClient.storage.from("job-evidence").createSignedUrl(key, 3600);

  return NextResponse.json({ path: key, signedUrl: signed?.signedUrl ?? null });
}
