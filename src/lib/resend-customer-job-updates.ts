import { Resend } from "resend";
import { resolveResendFrom, resolveResendReplyTo } from "@/lib/resend-config";

function dashboardBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://dashboard.kleenapp.co.uk";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Customer notified when contractor marks on the way. */
export async function sendCustomerContractorEnRouteEmail(params: {
  toEmail: string;
  customerName: string;
  jobReference: string;
  jobId: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("sendCustomerContractorEnRouteEmail: RESEND_API_KEY not set, skipping");
    return;
  }

  const jobUrl = `${dashboardBaseUrl()}/dashboard/jobs/${params.jobId}`;
  const resend = new Resend(apiKey);
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Contractor on the way — ${params.jobReference}</title></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.25rem; margin-bottom: 8px;">Your contractor is on the way</h1>
  <p style="color: #64748b; margin-bottom: 16px;">Hi ${escapeHtml(params.customerName)}, your Kleen contractor has let us know they&apos;re heading to job <strong>${escapeHtml(params.jobReference)}</strong>.</p>
  <p style="margin-top: 24px;">
    <a href="${jobUrl}" style="display: inline-block; background: #0891b2; color: white; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">View job</a>
  </p>
</body>
</html>
`.trim();

  const from = resolveResendFrom();
  const replyTo = resolveResendReplyTo();
  try {
    await resend.emails.send({
      from,
      to: params.toEmail.trim(),
      subject: `On the way — ${params.jobReference}`,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (e) {
    console.error("sendCustomerContractorEnRouteEmail:", e);
  }
}
