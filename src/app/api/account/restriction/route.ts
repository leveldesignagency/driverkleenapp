import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

async function getActiveBanForUser(userId: string) {
  const admin = createServiceRoleClient();
  const { data: custBan } = await admin
    .from("account_bans")
    .select("id, ban_type, reason, reason_code, expires_at, appeal_allowed, placed_at")
    .eq("subject_type", "customer")
    .eq("subject_id", userId)
    .is("lifted_at", null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("placed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (custBan) return { ban: custBan, subjectType: "customer" as const };

  const { data: op } = await admin.from("operatives").select("id").eq("user_id", userId).maybeSingle();
  if (op?.id) {
    const { data: opBan } = await admin
      .from("account_bans")
      .select("id, ban_type, reason, reason_code, expires_at, appeal_allowed, placed_at")
      .eq("subject_type", "contractor")
      .eq("subject_id", op.id)
      .is("lifted_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("placed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (opBan) return { ban: opBan, subjectType: "contractor" as const };
  }

  const { data: prof } = await admin.from("profiles").select("is_blocked").eq("id", userId).maybeSingle();
  if (prof?.is_blocked) {
    return {
      ban: {
        id: "legacy",
        ban_type: "permanent",
        reason: "Your account has been restricted by Kleen.",
        reason_code: "policy_violation",
        expires_at: null,
        appeal_allowed: true,
        placed_at: new Date().toISOString(),
      },
      subjectType: "customer" as const,
    };
  }
  return null;
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await getActiveBanForUser(user.id);
  if (!active) return NextResponse.json({ restricted: false });

  const admin = createServiceRoleClient();
  let pendingAppeal = false;
  if (active.ban.id !== "legacy") {
    const { data: appeal } = await admin
      .from("ban_appeals")
      .select("id")
      .eq("ban_id", active.ban.id)
      .eq("status", "pending")
      .maybeSingle();
    pendingAppeal = Boolean(appeal);
  }

  return NextResponse.json({ restricted: true, ban: active.ban, pendingAppeal });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 20) {
    return NextResponse.json({ error: "Please explain your appeal in at least 20 characters." }, { status: 400 });
  }

  const active = await getActiveBanForUser(user.id);
  if (!active || active.ban.id === "legacy" || !active.ban.appeal_allowed) {
    return NextResponse.json({ error: "Cannot submit appeal for this restriction." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("ban_appeals").insert({
    ban_id: active.ban.id,
    appellant_user_id: user.id,
    message,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
