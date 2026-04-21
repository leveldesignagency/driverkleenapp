import type { SupabaseClient } from "@supabase/supabase-js";

export const FIELD_ALLOWED_STATUSES = [
  "customer_accepted",
  "accepted",
  "awaiting_completion",
  "in_progress",
  "pending_confirmation",
];

const DISPUTE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Earliest time admin can release funds — 3 days after both parties confirmed (dispute window). */
export function escrowReleaseFromNow() {
  return new Date(Date.now() + DISPUTE_DAYS_MS).toISOString();
}

export type FieldActionName = "en_route" | "arrived" | "complete" | "incomplete";

export async function runContractorFieldAction(
  supabase: SupabaseClient,
  jobId: string,
  action: FieldActionName,
  opts?: { incompleteReason?: string; requireArrivedBeforeComplete?: boolean }
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const requireArrived = opts?.requireArrivedBeforeComplete !== false;
  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select(
      "id, status, user_id, operative_en_route_at, operative_arrived_at, operative_marked_complete_at, operative_marked_incomplete_at, customer_confirmed_complete_at"
    )
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) {
    return { ok: false, error: "Job not found", status: 404 };
  }

  const j = job as {
    id: string;
    status: string;
    user_id: string;
    operative_en_route_at: string | null;
    operative_arrived_at: string | null;
    operative_marked_complete_at: string | null;
    operative_marked_incomplete_at: string | null;
    customer_confirmed_complete_at: string | null;
  };

  if (!FIELD_ALLOWED_STATUSES.includes(j.status)) {
    return { ok: false, error: "This job cannot be updated right now.", status: 400 };
  }

  if (j.operative_marked_complete_at || j.operative_marked_incomplete_at) {
    return { ok: false, error: "This job is already marked finished.", status: 400 };
  }

  const now = new Date().toISOString();

  if (action === "en_route") {
    if (j.operative_en_route_at) {
      return { ok: true };
    }
    await supabase
      .from("jobs")
      .update({
        operative_en_route_at: now,
        status:
          j.status === "customer_accepted" || j.status === "accepted" ? "awaiting_completion" : j.status,
      })
      .eq("id", j.id);
    return { ok: true };
  }

  if (action === "arrived") {
    if (!j.operative_en_route_at) {
      return { ok: false, error: "Mark “On my way” first.", status: 400 };
    }
    if (j.operative_arrived_at) {
      return { ok: true };
    }
    await supabase.from("jobs").update({ operative_arrived_at: now, status: "in_progress" }).eq("id", j.id);
    return { ok: true };
  }

  if (action === "complete") {
    if (requireArrived && !j.operative_arrived_at) {
      return { ok: false, error: "Mark “Arrived” before completing.", status: 400 };
    }
    const escrowRelease = escrowReleaseFromNow();
    const bothDone = !!j.customer_confirmed_complete_at;
    await supabase
      .from("jobs")
      .update({
        operative_marked_complete_at: now,
        contractor_confirmed_complete_at: now,
        status: bothDone ? "completed" : "pending_confirmation",
        escrow_release_date: bothDone ? escrowRelease : null,
      })
      .eq("id", j.id);
    return { ok: true };
  }

  if (action === "incomplete") {
    const reason = (opts?.incompleteReason || "").trim();
    if (reason.length < 3) {
      return { ok: false, error: "Please give a short reason (at least 3 characters).", status: 400 };
    }
    if (j.operative_marked_incomplete_at) {
      return { ok: true };
    }
    await supabase
      .from("jobs")
      .update({
        operative_marked_incomplete_at: now,
        operative_incomplete_reason: reason,
        status: "disputed",
      })
      .eq("id", j.id);
    return { ok: true };
  }

  return { ok: false, error: "Unsupported action", status: 400 };
}
