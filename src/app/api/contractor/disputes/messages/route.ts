import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOperativeIdentity } from "@/lib/operative-identity";

/** Contractor-visible dispute thread (messages to operative + own sends). */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const disputeId = request.nextUrl.searchParams.get("disputeId")?.trim() || "";
  if (!disputeId) {
    return NextResponse.json({ error: "Missing disputeId" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const identity = await resolveOperativeIdentity(admin, user.id, user.email);
  const operativeId = identity.operative?.id ? String(identity.operative.id) : null;
  if (!operativeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: dispute } = await admin
    .from("disputes")
    .select("id, job_id, status")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: opMsg } = await admin
    .from("dispute_messages")
    .select("id")
    .eq("dispute_id", disputeId)
    .eq("recipient_role", "operative")
    .limit(1)
    .maybeSingle();

  const allowed =
    dispute.status === "resolved" ||
    dispute.status === "closed" ||
    Boolean(opMsg);

  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: assignment } = await admin
    .from("job_assignments")
    .select("id")
    .eq("job_id", dispute.job_id)
    .eq("operative_id", operativeId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: messages, error } = await admin
    .from("dispute_messages")
    .select("id, sender_id, recipient_role, message, created_at")
    .eq("dispute_id", disputeId)
    .or(`sender_id.eq.${user.id},recipient_role.eq.operative`)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ messages: messages || [] });
}
