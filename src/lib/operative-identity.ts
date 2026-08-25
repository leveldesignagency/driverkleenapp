import type { SupabaseClient } from "@supabase/supabase-js";

type OperativeRow = Record<string, unknown> & {
  id: string;
  user_id?: string | null;
  email?: string | null;
  onboarding_source?: string | null;
  admin_invited_at?: string | null;
  is_verified?: boolean | null;
  created_at?: string | null;
};

async function countForOperative(
  admin: SupabaseClient,
  table: "quote_requests" | "job_assignments",
  operativeId: string,
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("operative_id", operativeId);
  if (error) {
    console.warn(`operative-identity count ${table}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

async function countSelfBookedQuotes(
  admin: SupabaseClient,
  operativeId: string,
  userId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("quote_requests")
    .select("id, jobs!inner(user_id)", { count: "exact", head: true })
    .eq("operative_id", operativeId)
    .eq("jobs.user_id", userId);
  if (error) {
    console.warn("operative-identity self-booked count:", error.message);
    return 0;
  }
  return count ?? 0;
}

async function scoreOperative(admin: SupabaseClient, op: OperativeRow, userId: string): Promise<number> {
  const [qrCount, jaCount, selfBooked] = await Promise.all([
    countForOperative(admin, "quote_requests", op.id),
    countForOperative(admin, "job_assignments", op.id),
    countSelfBookedQuotes(admin, op.id, userId),
  ]);
  let score = qrCount * 20 + jaCount * 20 + selfBooked * 100;
  if (op.user_id === userId) score += 1000;
  if (String(op.onboarding_source || "") === "admin_invite") score += 80;
  if (op.admin_invited_at) score += 40;
  if (op.is_verified) score += 25;
  return score;
}

async function reassignOperativeFk(
  admin: SupabaseClient,
  table: "quote_requests" | "job_assignments" | "operative_services" | "availability_slots" | "operative_personnel",
  fromId: string,
  toId: string,
  jobScoped = false,
): Promise<void> {
  const { data: rows, error: loadErr } = await admin.from(table).select("id, job_id").eq("operative_id", fromId);
  if (loadErr) {
    console.warn(`operative-identity load ${table}:`, loadErr.message);
    return;
  }
  if (!rows?.length) return;

  for (const row of rows as { id: string; job_id?: string }[]) {
    if (jobScoped && row.job_id) {
      const { data: conflict } = await admin
        .from(table)
        .select("id")
        .eq("operative_id", toId)
        .eq("job_id", row.job_id)
        .maybeSingle();
      if (conflict) {
        await admin.from(table).delete().eq("id", row.id);
        continue;
      }
    }

    const { error: updErr } = await admin.from(table).update({ operative_id: toId }).eq("id", row.id);
    if (updErr) {
      // Unique constraint — drop duplicate row on secondary operative
      if (updErr.code === "23505") {
        await admin.from(table).delete().eq("id", row.id);
      } else {
        console.warn(`operative-identity reassign ${table}:`, updErr.message);
      }
    }
  }
}

/**
 * When staff create a contractor in admin and the same person later signs in,
 * two operatives rows can exist (admin row + self_apply). Merge onto one row
 * linked to auth.users so quotes and assignments appear in the portal.
 */
export async function resolveOperativeIdentity(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<{ operative: OperativeRow | null; merged: boolean; mergedCount: number }> {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) {
    return { operative: null, merged: false, mergedCount: 0 };
  }

  const [{ data: byUser }, { data: byEmail }] = await Promise.all([
    admin.from("operatives").select("*").eq("user_id", userId),
    admin.from("operatives").select("*").ilike("email", emailNorm),
  ]);

  const byId = new Map<string, OperativeRow>();
  for (const row of [...(byUser || []), ...(byEmail || [])]) {
    byId.set(String(row.id), row as OperativeRow);
  }
  const candidates = [...byId.values()];

  if (candidates.length === 0) {
    return { operative: null, merged: false, mergedCount: 0 };
  }

  if (candidates.length === 1) {
    const op = candidates[0];
    if (!op.user_id) {
      const { data: linked, error } = await admin
        .from("operatives")
        .update({ user_id: userId, email: emailNorm })
        .eq("id", op.id)
        .is("user_id", null)
        .select("*")
        .maybeSingle();
      if (error) console.warn("operative-identity link user:", error.message);
      return { operative: (linked as OperativeRow) || op, merged: false, mergedCount: 0 };
    }
    return { operative: op, merged: false, mergedCount: 0 };
  }

  const scored = await Promise.all(
    candidates.map(async (op) => ({ op, score: await scoreOperative(admin, op, userId) })),
  );
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aCreated = a.op.created_at ? new Date(String(a.op.created_at)).getTime() : 0;
    const bCreated = b.op.created_at ? new Date(String(b.op.created_at)).getTime() : 0;
    return aCreated - bCreated;
  });

  const primary = scored[0].op;
  const secondaries = scored.slice(1).map((s) => s.op);

  for (const secondary of secondaries) {
    await reassignOperativeFk(admin, "quote_requests", secondary.id, primary.id, true);
    await reassignOperativeFk(admin, "job_assignments", secondary.id, primary.id, true);
    await reassignOperativeFk(admin, "operative_services", secondary.id, primary.id, true);
    await reassignOperativeFk(admin, "availability_slots", secondary.id, primary.id);
    await reassignOperativeFk(admin, "operative_personnel", secondary.id, primary.id);

    await admin
      .from("operatives")
      .update({ is_active: false, user_id: null })
      .eq("id", secondary.id)
      .neq("id", primary.id);
  }

  const { data: linkedPrimary, error: linkErr } = await admin
    .from("operatives")
    .update({
      user_id: userId,
      email: emailNorm,
      is_active: true,
    })
    .eq("id", primary.id)
    .select("*")
    .single();

  if (linkErr) {
    console.error("operative-identity link primary:", linkErr.message);
    return { operative: primary, merged: true, mergedCount: secondaries.length };
  }

  return {
    operative: linkedPrimary as OperativeRow,
    merged: true,
    mergedCount: secondaries.length,
  };
}
