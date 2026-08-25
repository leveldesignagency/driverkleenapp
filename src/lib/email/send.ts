import { createResendClient } from "@/lib/resend-client";
import { resolveResendFrom, resolveResendReplyTo, sanitizeEmailAddress } from "@/lib/resend-config";

export type EmailSendResult = { ok: boolean; error?: string; id?: string };

/** Unified Resend send — logs and never throws. */
export async function sendKleenEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<EmailSendResult> {
  const resend = createResendClient();
  if (!resend) {
    const error = "RESEND_API_KEY not set";
    console.warn("sendKleenEmail:", error, params.subject);
    return { ok: false, error };
  }

  const to = (Array.isArray(params.to) ? params.to : [params.to])
    .map((e) => sanitizeEmailAddress(e.trim()))
    .filter((e) => e.includes("@"));

  if (to.length === 0) {
    return { ok: false, error: "No valid recipient" };
  }

  const from = resolveResendFrom();
  const replyTo = params.replyTo || resolveResendReplyTo();

  try {
    const { error, data } = await resend.emails.send({
      from,
      to,
      subject: params.subject,
      html: params.html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      const msg = error.message || JSON.stringify(error);
      console.error("sendKleenEmail Resend error:", msg, { from, to, subject: params.subject });
      return { ok: false, error: msg };
    }
    if (data?.id) {
      console.log("sendKleenEmail sent:", data.id, params.subject, "→", to.join(", "));
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    console.error("sendKleenEmail failed:", e);
    return { ok: false, error: message };
  }
}
