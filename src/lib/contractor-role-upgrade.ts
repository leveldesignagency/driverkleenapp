import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAuthUserEmail(admin: ReturnType<typeof createServiceRoleClient>, userId: string) {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? "";
}

/** Upgrade a signed-in customer profile to operative for contractor onboarding. */
export async function upgradeCustomerToOperative(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  try {
    const admin = createServiceRoleClient();

    let prof: { role: string } | null = null;
    let readErr: { message: string } | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
      readErr = result.error;
      prof = result.data;
      if (prof || (readErr && !readErr.message.toLowerCase().includes("timeout"))) break;
      await sleep(150);
    }

    if (readErr && !prof) {
      return { ok: false, error: readErr.message, code: "profile_read_failed" };
    }

    if (!prof) {
      const email = await fetchAuthUserEmail(admin, userId);
      const { error: insertErr } = await admin.from("profiles").insert({
        id: userId,
        email,
        full_name: email.split("@")[0] || "Contractor",
        role: "operative",
      });
      if (insertErr) {
        return { ok: false, error: insertErr.message, code: "profile_create_failed" };
      }
      return { ok: true };
    }

    if (prof.role === "operative") {
      return { ok: true };
    }

    if (prof.role === "admin") {
      return {
        ok: false,
        error: "This Google account is an admin account. Sign in with a different Google account to apply as a contractor.",
        code: "admin_account",
      };
    }

    if (prof.role !== "customer") {
      return {
        ok: false,
        error: `This account role (${prof.role}) cannot be used for contractor onboarding.`,
        code: "invalid_role",
      };
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({ role: "operative" })
      .eq("id", userId)
      .eq("role", "customer");

    if (updateErr) {
      return { ok: false, error: updateErr.message, code: "profile_update_failed" };
    }

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Role upgrade failed";
    if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return {
        ok: false,
        code: "missing_service_role",
        error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set on the contractor app.",
      };
    }
    return { ok: false, error: message, code: "unexpected" };
  }
}
