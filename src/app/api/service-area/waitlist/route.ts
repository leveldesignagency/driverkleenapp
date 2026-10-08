import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeUkPostcode } from "@/lib/format-uk-address";
import { checkPostcodeIsKent, postcodeAreaFromPostcode } from "@/lib/service-area-kent";

export async function GET(request: NextRequest) {
  const email = String(request.nextUrl.searchParams.get("email") || "")
    .trim()
    .toLowerCase();
  const audience =
    request.nextUrl.searchParams.get("audience") === "contractor" ? "contractor" : "customer";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ joined: false });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data } = await admin
    .from("service_area_waitlist")
    .select("id")
    .eq("email", email)
    .eq("audience", audience)
    .maybeSingle();

  return NextResponse.json({ joined: Boolean(data?.id) });
}

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

  let area_label: string | null = null;
  let admin_county: string | null = null;
  let admin_district: string | null = null;
  let region: string | null = null;
  let postcode_area: string | null = postcodeAreaFromPostcode(postcode);

  if (postcode) {
    const geo = await checkPostcodeIsKent(postcode);
    if (geo.ok) {
      area_label = geo.areaLabel;
      admin_county = geo.adminCounty;
      admin_district = geo.adminDistrict;
      region = geo.region;
      postcode_area = geo.postcodeArea || postcode_area;
    }
  }

  const { error } = await admin.from("service_area_waitlist").upsert(
    {
      email,
      postcode,
      audience,
      source,
      user_id: user?.id ?? null,
      area_label,
      admin_county,
      admin_district,
      region,
      postcode_area,
    },
    { onConflict: "email,audience" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
