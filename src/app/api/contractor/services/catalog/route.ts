import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ensureServiceCatalog } from "@/lib/service-catalog-sync";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "operative") {
    return NextResponse.json({ error: "Contractor account required" }, { status: 403 });
  }

  const { data: operative } = await supabase.from("operatives").select("id").eq("user_id", user.id).single();
  if (!operative) {
    return NextResponse.json({ error: "Contractor profile not found" }, { status: 404 });
  }

  try {
    const admin = createServiceRoleClient();
    await ensureServiceCatalog(admin);

    const { data, error } = await admin
      .from("services")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load service catalogue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
