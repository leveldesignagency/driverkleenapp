import type { SupabaseClient } from "@supabase/supabase-js";
import type { FieldActionName } from "@/lib/contractor-field-job";
import { notifyCustomerFieldStatusEmail } from "@/lib/resend-customer-job-updates";

type BeforeSnapshot = {
  operative_en_route_at: string | null;
  operative_arrived_at: string | null;
  operative_marked_complete_at: string | null;
  operative_marked_incomplete_at: string | null;
  user_id: string | null;
  reference: string | null;
};

/** Load job fields needed for field-status emails. */
export async function loadJobFieldEmailSnapshot(
  supabase: SupabaseClient,
  jobId: string,
): Promise<BeforeSnapshot | null> {
  const { data } = await supabase
    .from("jobs")
    .select(
      "operative_en_route_at, operative_arrived_at, operative_marked_complete_at, operative_marked_incomplete_at, user_id, reference",
    )
    .eq("id", jobId)
    .maybeSingle();
  return (data as BeforeSnapshot | null) ?? null;
}

function wasFirstTransition(action: FieldActionName, before: BeforeSnapshot): boolean {
  if (action === "en_route") return !before.operative_en_route_at;
  if (action === "arrived") return !before.operative_arrived_at;
  if (action === "complete") return !before.operative_marked_complete_at;
  if (action === "incomplete") return !before.operative_marked_incomplete_at;
  return false;
}

/** After a successful field action, email customer (+ admin for incomplete). */
export async function sendEmailsForFieldAction(params: {
  supabase: SupabaseClient;
  jobId: string;
  action: FieldActionName;
  before: BeforeSnapshot | null;
  incompleteReason?: string;
  contractorName?: string;
}): Promise<void> {
  const { before, action, jobId, incompleteReason, contractorName, supabase } = params;
  if (!before || !wasFirstTransition(action, before)) return;

  const uid = before.user_id;
  const ref = before.reference || jobId.slice(0, 8).toUpperCase();
  if (!uid) return;

  const { data: prof } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", uid)
    .maybeSingle();

  await notifyCustomerFieldStatusEmail({
    action,
    wasFirstTransition: true,
    toEmail: prof?.email,
    customerName: prof?.full_name?.trim() || "there",
    jobReference: ref,
    jobId,
    incompleteReason,
    contractorName,
  });
}
