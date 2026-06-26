import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ensureServiceCatalog } from "@/lib/service-catalog-sync";
import { EXPECTED_CATALOG_SIZE, mergeServiceCatalog } from "@/lib/service-catalog";

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

  let dbRows: { id: string; name: string }[] | null = null;
  let synced = false;
  let syncWarning: string | undefined;

  try {
    const admin = createServiceRoleClient();
    await ensureServiceCatalog(admin);
    const { data, error } = await admin
      .from("services")
      .select("id, name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      syncWarning = error.message;
    } else {
      dbRows = data;
      synced = true;
    }
  } catch (e) {
    syncWarning = e instanceof Error ? e.message : "Catalog sync unavailable";
    const { data, error } = await supabase.from("services").select("id, name").eq("is_active", true).order("name");
    if (!error && data) {
      dbRows = data;
    }
  }

  const services = mergeServiceCatalog(dbRows);
  if (!synced && syncWarning?.includes("SERVICE_ROLE")) {
    syncWarning =
      "Set SUPABASE_SERVICE_ROLE_KEY on the driver Vercel project so new services can be saved to the database.";
  }

  return NextResponse.json({
    services,
    count: services.length,
    expectedCount: EXPECTED_CATALOG_SIZE,
    synced,
    syncWarning,
  });
}
