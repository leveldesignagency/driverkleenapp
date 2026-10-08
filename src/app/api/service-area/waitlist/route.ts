import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeUkPostcode } from "@/lib/format-uk-address";

export async function POST(request: NextRequest) {
  let body: { email?: string; postcode?: string; audience?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const audience = body.audience === "contractor" ? "contractor" : "customer";
  const postcode = body.postcode ? normalizeUkPostcode(body.postcode) : null;
  const source = typeof body.source === "string" ? body.source.slice(0, 80) : null;

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { error } = await admin.from("service_area_waitlist").upsert(
    {
      email,
      postcode,
      audience,
      source,
      user_id: user?.id ?? null,
    },
    { onConflict: "email,audience" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
