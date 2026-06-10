import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";

const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || "info@kleenapp.co.uk";
const ADMIN_APP_URL = process.env.ADMIN_APP_URL || "https://admin.kleenapp.co.uk";

export async function sendAdminContractorReviewEmail(params: {
  operativeId: string;
  fullName: string;
  email: string;
  companyName?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("sendAdminContractorReviewEmail: RESEND_API_KEY not set, skipping");
    return;
  }

  const resend = new Resend(apiKey);
  const reviewUrl = `${ADMIN_APP_URL.replace(/\/$/, "")}/contractors/${params.operativeId}`;
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
    const { error } = await resend.emails.send({
      from,
      to: ADMIN_NOTIFY_EMAIL,
      subject: `Contractor review — ${params.fullName}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("sendAdminContractorReviewEmail Resend error:", error);
    }
  } catch (e) {
    console.error("sendAdminContractorReviewEmail failed:", e);
  }
}
