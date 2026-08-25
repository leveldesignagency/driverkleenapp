import { contractorPortalUrl, emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendKleenEmail, type EmailSendResult } from "@/lib/email/send";

/** Contractor welcome / application started. */
export async function sendContractorWelcomeEmail(params: {
  toEmail: string;
  fullName: string;
}): Promise<EmailSendResult> {
  const name = params.fullName.trim() || "there";
  const html = emailLayout({
    title: "Welcome to Kleen contractors",
    heading: "Welcome to the Kleen contractor portal",
    introHtml: `<p>Hi ${escapeHtml(name)}, thanks for starting your contractor application. Complete every step in the portal, then submit for Kleen to review.</p>`,
    cta: { href: contractorPortalUrl("/contractor"), label: "Continue application" },
    footerNote: "You'll get another email when your application is approved or if we need changes.",
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: "Welcome — Kleen contractor application",
    html,
  });
}


/** Staff added this contractor — ask them to confirm prefilled details (not a new application). */
export async function sendContractorAdminInviteEmail(params: {
  toEmail: string;
  fullName: string;
}): Promise<EmailSendResult> {
  const name = params.fullName.trim() || "there";
  const email = params.toEmail.trim();
  const html = emailLayout({
    title: "Confirm your Kleen contractor details",
    heading: "Kleen has set up your contractor profile",
    introHtml: `<p>Hi ${escapeHtml(name)}, the Kleen team has added you as a contractor and filled in your details.</p><p>Please sign in with <strong>Google using ${escapeHtml(email)}</strong>, review everything we prepared, complete any missing steps (such as photo ID), then confirm. Kleen still needs to approve you before you can take jobs.</p>`,
    cta: {
      href: contractorPortalUrl("/contractor/join?invite=1"),
      label: "Confirm your details",
    },
    footerNote: "This is not a new application — you are confirming the profile staff already created for you.",
  });
  return sendKleenEmail({
    to: email,
    subject: "Confirm your Kleen contractor details",
    html,
  });
}

/** Contractor: application submitted for review. */
export async function sendContractorApplicationSubmittedEmail(params: {
  toEmail: string;
  fullName: string;
  adminInvite?: boolean;
}): Promise<EmailSendResult> {
  const name = params.fullName.trim() || "there";
  const adminInvite = Boolean(params.adminInvite);
  const html = emailLayout({
    title: adminInvite ? "Details confirmed" : "Application submitted",
    heading: adminInvite ? "We've received your confirmed details" : "We've received your application",
    introHtml: adminInvite
      ? `<p>Hi ${escapeHtml(name)}, thanks for confirming your contractor details. Kleen is reviewing your profile and will email you when a decision is made.</p>`
      : `<p>Hi ${escapeHtml(name)}, your contractor application is with Kleen for review. We'll email you when a decision is made.</p>`,
    cta: { href: contractorPortalUrl("/contractor"), label: "Open portal" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: adminInvite ? "Details confirmed — Kleen contractors" : "Application submitted — Kleen contractors",
    html,
  });
}

/** Contractor: quote was declined / not selected. */
export async function sendContractorQuoteDeclinedEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
}): Promise<EmailSendResult> {
  const name = params.contractorName.trim() || "there";
  const html = emailLayout({
    title: `Update — ${params.jobReference}`,
    heading: "Quote not selected",
    introHtml: `<p>Hi ${escapeHtml(name)}, thanks for quoting on job <strong>${escapeHtml(params.jobReference)}</strong>. The customer chose another quote this time.</p>`,
    cta: { href: contractorPortalUrl("/contractor/jobs"), label: "Browse jobs" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `Quote update — ${params.jobReference}`,
    html,
  });
}

/** Contractor: application approved. */
export async function sendContractorApprovedEmail(params: {
  toEmail: string;
  fullName: string;
}): Promise<EmailSendResult> {
  const name = params.fullName.trim() || "there";
  const html = emailLayout({
    title: "Contractor account approved",
    heading: "You're approved",
    introHtml: `<p>Hi ${escapeHtml(name)}, good news — your Kleen contractor application has been <strong>approved</strong>. You can now receive quote invitations, connect Stripe for payouts, and manage jobs from your portal.</p>`,
    cta: { href: contractorPortalUrl("/contractor"), label: "Open contractor portal" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: "Your Kleen contractor account is approved",
    html,
  });
}

/** Contractor: application needs changes / declined. */
export async function sendContractorRejectedEmail(params: {
  toEmail: string;
  fullName: string;
  message: string;
}): Promise<EmailSendResult> {
  const name = params.fullName.trim() || "there";
  const html = emailLayout({
    title: "Update to your contractor application",
    heading: "We need a few updates",
    introHtml: `<p>Hi ${escapeHtml(name)}, thanks for applying to work with Kleen. After reviewing your application, we need you to address the following before we can approve your profile:</p><p style="white-space:pre-wrap;border-left:3px solid #0d9488;padding-left:12px;margin:16px 0;color:#334155;">${escapeHtml(params.message)}</p><p>Please update your details in the contractor portal and reply to this email if you have questions.</p>`,
    cta: { href: contractorPortalUrl("/contractor"), label: "Open your profile" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: "Update to your Kleen contractor application",
    html,
  });
}

/** Contractor: customer confirmed the job is complete. */
export async function sendContractorCustomerConfirmedEmail(params: {
  toEmail: string;
  contractorName: string;
  jobReference: string;
  jobId: string;
  bothConfirmed: boolean;
}): Promise<EmailSendResult> {
  const name = params.contractorName.trim() || "there";
  const html = emailLayout({
    title: `Customer confirmed — ${params.jobReference}`,
    heading: "Customer confirmed completion",
    introHtml: params.bothConfirmed
      ? `<p>Hi ${escapeHtml(name)}, the customer confirmed job <strong>${escapeHtml(params.jobReference)}</strong> is complete. Both parties have confirmed — funds enter the dispute-window countdown before release.</p>`
      : `<p>Hi ${escapeHtml(name)}, the customer confirmed job <strong>${escapeHtml(params.jobReference)}</strong> is complete. Please mark completion from your side if you haven&apos;t already.</p>`,
    cta: {
      href: contractorPortalUrl(`/contractor/jobs/${params.jobId}`),
      label: "Open job",
    },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `Customer confirmed — ${params.jobReference}`,
    html,
  });
}
