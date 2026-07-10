import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Upgrade a signed-in customer profile to operative for contractor onboarding. */
export async function upgradeCustomerToOperative(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createServiceRoleClient();
    const { data: prof, error: readErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (readErr) {
      return { ok: false, error: readErr.message };
    }

    if (!prof) {
      return { ok: false, error: "Profile not found" };
    }

    if (prof.role === "operative") {
      return { ok: true };
    }

    if (prof.role !== "customer") {
      return { ok: false, error: "This account cannot be used as a contractor" };
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ role: "operative" })
      .eq("id", userId)
      .eq("role", "customer");

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Role upgrade failed";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return {
        ok: false,
        error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set on the contractor app.",
      };
    }
    return { ok: false, error: message };
  }
}
