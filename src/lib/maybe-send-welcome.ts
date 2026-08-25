import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendCustomerWelcomeEmail } from "@/lib/resend-customer-job-updates";
import { sendContractorWelcomeEmail } from "@/lib/resend-contractor-lifecycle";

const WELCOME_WINDOW_MS = 15 * 60 * 1000;

function isRecentSignup(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < WELCOME_WINDOW_MS;
}

/**
 * Send a one-time welcome email for recent signups.
 * Idempotent via auth user_metadata.welcome_email_sent_at.
 */
export async function maybeSendWelcomeEmail(params: {
  user: User;
  audience: "customer" | "contractor";
}): Promise<{ sent: boolean; reason?: string }> {
  const { user, audience } = params;
  if (!isRecentSignup(user.created_at)) {
    return { sent: false, reason: "not_recent" };
  }
  if (user.user_metadata?.welcome_email_sent_at) {
    return { sent: false, reason: "already_sent" };
  }

  const toEmail = (user.email || "").trim();
  if (!toEmail) return { sent: false, reason: "no_email" };

  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    toEmail.split("@")[0] ||
    "there";

  // Admin-invited contractors already got a confirm-details email — skip "start application" welcome.
  if (audience === "contractor") {
    try {
      const admin = createServiceRoleClient();
      const { data: matches } = await admin
        .from("operatives")
        .select("id, onboarding_source, admin_invited_at")
        .ilike("email", toEmail.toLowerCase())
        .limit(10);
      const adminInvite = (matches || []).some(
        (r) =>
          String(r.onboarding_source || "") === "admin_invite" || Boolean(r.admin_invited_at),
      );
      if (adminInvite) {
        try {
          await admin.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...user.user_metadata,
              welcome_email_sent_at: new Date().toISOString(),
            },
          });
        } catch (e) {
          console.error("maybeSendWelcomeEmail skip-invite metadata:", e);
        }
        return { sent: false, reason: "admin_invite" };
      }
    } catch (e) {
      console.error("maybeSendWelcomeEmail admin-invite check:", e);
    }
  }

  const result =
    audience === "contractor"
      ? await sendContractorWelcomeEmail({ toEmail, fullName: name })
      : await sendCustomerWelcomeEmail({ toEmail, customerName: name });

  if (!result.ok) {
    return { sent: false, reason: result.error || "send_failed" };
  }

  try {
    const admin = createServiceRoleClient();
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        welcome_email_sent_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("maybeSendWelcomeEmail metadata update:", e);
  }

  return { sent: true };
}
