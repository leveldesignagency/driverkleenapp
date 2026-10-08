import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeUkPhoneToE164 } from "@/lib/phone";

async function phoneStatusHandler() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("phone, phone_e164, phone_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    profile: {
      phone: prof?.phone || null,
      phoneE164: prof?.phone_e164 || null,
      verifiedAt: prof?.phone_verified_at || null,
      verified: Boolean(prof?.phone_verified_at),
    },
    authPhone: user.phone || null,
  });
}

async function sendOtpHandler(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { phone?: string; target?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const e164 = normalizeUkPhoneToE164(phoneRaw);
  if (!e164) {
    return NextResponse.json({ error: "Enter a valid UK phone number." }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("phone") && (msg.includes("provider") || msg.includes("sms") || msg.includes("twilio"))) {
      return NextResponse.json(
        {
          error:
            "SMS verification is not configured yet. Ask Kleen to enable the Phone provider in Supabase (Twilio).",
          code: "sms_not_configured",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const display = phoneRaw;
  await admin
    .from("profiles")
    .update({ phone: display, phone_e164: e164, phone_verified_at: null })
    .eq("id", user.id);

  if (body.target === "operative") {
    await admin
      .from("operatives")
      .update({ phone: display, phone_e164: e164, phone_verified_at: null })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, phoneE164: e164 });
}

async function verifyOtpHandler(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { phone?: string; code?: string; target?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const e164 = normalizeUkPhoneToE164(body.phone || "");
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!e164 || code.length < 4) {
    return NextResponse.json({ error: "Phone and verification code required." }, { status: 400 });
  }

  const { error } = await supabase.auth.verifyOtp({
    phone: e164,
    token: code,
    type: "phone_change",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createServiceRoleClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("phone, phone_e164")
    .eq("id", user.id)
    .maybeSingle();

  const phone = prof?.phone || e164;
  await admin
    .from("profiles")
    .update({
      phone,
      phone_e164: e164,
      phone_verified_at: now,
    })
    .eq("id", user.id);

  await admin
    .from("operatives")
    .update({
      phone,
      phone_e164: e164,
      phone_verified_at: now,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true, verifiedAt: now });
}

export async function GET() {
  return phoneStatusHandler();
}

export async function POST(request: NextRequest) {
  return sendOtpHandler(request);
}

export async function PUT(request: NextRequest) {
  return verifyOtpHandler(request);
}
