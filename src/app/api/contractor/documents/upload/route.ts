import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: NextRequest) {
  const authClient = createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: operative } = await authClient
    .from("operatives")
    .select("id, is_verified")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!operative?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (operative.is_verified) {
    return NextResponse.json({ error: "Verified contractors cannot change application documents here" }, { status: 400 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "operative_id");
  const personnelId = String(form.get("personnelId") || "").trim();

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: `Unsupported type: ${mime}` }, { status: 400 });
  }

  const origName = file instanceof File && file.name ? file.name : "upload";
  const ext = (origName.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  const fileId = randomUUID();

  let key: string;
  if (kind === "personnel_id") {
    if (!personnelId) {
      return NextResponse.json({ error: "Missing personnelId" }, { status: 400 });
    }
    const { data: person } = await authClient
      .from("operative_personnel")
      .select("id")
      .eq("id", personnelId)
      .eq("operative_id", operative.id)
      .maybeSingle();
    if (!person) {
      return NextResponse.json({ error: "Personnel not found" }, { status: 404 });
    }
    key = `${operative.id}/personnel/${personnelId}/${fileId}.${ext}`;
  } else {
    key = `${operative.id}/id/${fileId}.${ext}`;
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { error: upErr } = await admin.storage.from("contractor-documents").upload(key, buf, {
    contentType: mime,
    upsert: true,
  });

  if (upErr) {
    console.error("contractor-documents upload:", upErr);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  if (kind === "personnel_id") {
    await admin
      .from("operative_personnel")
      .update({ id_document_storage_path: key, id_document_uploaded_at: now })
      .eq("id", personnelId)
      .eq("operative_id", operative.id);
  } else {
    await admin
      .from("operatives")
      .update({ id_document_storage_path: key, id_document_uploaded_at: now })
      .eq("id", operative.id);
  }

  return NextResponse.json({ path: key });
}
