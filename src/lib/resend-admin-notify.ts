import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";
import { getAdminAppUrl, getAdminNotifyEmail } from "@/lib/admin-notify-email";

export type AdminEmailResult = { ok: boolean; error?: string };

export async function sendAdminContractorSignupEmail(params: {
  operativeId: string;
  fullName: string;
  email: string;
}): Promise<AdminEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = "RESEND_API_KEY not set";
    console.warn("sendAdminContractorSignupEmail:", error);
    return { ok: false, error };
  }

  const resend = new Resend(apiKey);
  const adminNotifyEmail = getAdminNotifyEmail();
  const reviewUrl = `${getAdminAppUrl()}/contractors/${params.operativeId}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>New contractor signup</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">New contractor signup</h1>
  <p style="color: #64748b; margin-bottom: 16px;">Someone signed up for the Kleen contractor portal and started their application.</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.fullName}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.email}</td></tr>
  </table>
  <p style="margin-top: 24px;">
    <a href="${reviewUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">View in admin</a>
  </p>
  <p style="margin-top: 16px; font-size: 0.875rem; color: #64748b;">You will get another email when they complete onboarding and tap <strong>Send for review</strong>.</p>
</body>
</html>
`.trim();

  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  try {
    const { error, data } = await resend.emails.send({
      from,
      to: adminNotifyEmail,
      subject: `New contractor signup — ${params.fullName}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendAdminContractorSignupEmail Resend error:", error, { from, to: adminNotifyEmail });
      return { ok: false, error: error.message || JSON.stringify(error) };
    }
    if (data?.id) {
      console.log("sendAdminContractorSignupEmail sent id:", data.id, "to:", adminNotifyEmail);
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    console.error("sendAdminContractorSignupEmail failed:", e);
    return { ok: false, error: message };
  }
}

export async function sendAdminContractorReviewEmail(params: {
  operativeId: string;
  fullName: string;
  email: string;
  companyName?: string;
}): Promise<AdminEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const error = "RESEND_API_KEY not set";
    console.warn("sendAdminContractorReviewEmail:", error);
    return { ok: false, error };
  }

  const resend = new Resend(apiKey);
  const adminNotifyEmail = getAdminNotifyEmail();
  const reviewUrl = `${getAdminAppUrl()}/contractors/${params.operativeId}`;
  const company = params.companyName?.trim() || "—";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Contractor application ready for review</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">Contractor ready for review</h1>
  <p style="color: #64748b; margin-bottom: 16px;">A contractor completed onboarding and submitted their profile for Kleen approval.</p>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.fullName}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${params.email}</td></tr>
    <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Company</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company}</td></tr>
  </table>
  <p style="margin-top: 24px;">
    <a href="${reviewUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">Review in admin</a>
  </p>
</body>
</html>
`.trim();

  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  try {
    const { error, data } = await resend.emails.send({
      from,
      to: adminNotifyEmail,
      subject: `Contractor review — ${params.fullName}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendAdminContractorReviewEmail Resend error:", error, { from, to: adminNotifyEmail });
      return { ok: false, error: error.message || JSON.stringify(error) };
    }
    if (data?.id) {
      console.log("sendAdminContractorReviewEmail sent id:", data.id, "to:", adminNotifyEmail);
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    console.error("sendAdminContractorReviewEmail failed:", e);
    return { ok: false, error: message };
  }
}
