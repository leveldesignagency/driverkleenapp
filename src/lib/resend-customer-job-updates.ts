import { customerDashboardUrl, emailLayout, escapeHtml } from "@/lib/email/layout";
import { sendKleenEmail, type EmailSendResult } from "@/lib/email/send";
import { adminAppUrl } from "@/lib/email/layout";
import { getAdminNotifyEmail } from "@/lib/admin-notify-email";

type JobMailBase = {
  toEmail: string;
  customerName: string;
  jobReference: string;
  jobId: string;
  serviceName?: string;
};

function jobUrl(jobId: string) {
  return customerDashboardUrl(`/dashboard/jobs/${jobId}`);
}

/** Welcome after customer Google / email signup. */
export async function sendCustomerWelcomeEmail(params: {
  toEmail: string;
  customerName: string;
}): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const html = emailLayout({
    title: "Welcome to Kleen",
    heading: "Welcome to Kleen",
    introHtml: `<p>Hi ${escapeHtml(name)}, your customer account is ready. Book a trusted cleaner in minutes — instant quotes, vetted contractors, and live job tracking.</p>`,
    cta: { href: customerDashboardUrl("/job-flow"), label: "Get a free quote" },
    footerNote: "Questions? Reply to this email or visit kleenapp.co.uk.",
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: "Welcome to Kleen",
    html,
  });
}

/** Customer confirmation when a new job is submitted. */
export async function sendCustomerJobReceivedEmail(
  params: JobMailBase & { preferredDate?: string; postcode?: string },
): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const html = emailLayout({
    title: `Job received — ${params.jobReference}`,
    heading: "We've got your job",
    introHtml: `<p>Hi ${escapeHtml(name)}, your cleaning request <strong>${escapeHtml(params.jobReference)}</strong> is with Kleen. Matching contractors can now quote.</p>`,
    rows: [
      ...(params.serviceName
        ? [{ label: "Service", value: escapeHtml(params.serviceName) }]
        : []),
      ...(params.postcode ? [{ label: "Postcode", value: escapeHtml(params.postcode) }] : []),
      ...(params.preferredDate
        ? [{ label: "Preferred date", value: escapeHtml(params.preferredDate) }]
        : []),
    ],
    cta: { href: jobUrl(params.jobId), label: "Track your job" },
    footerNote: "We'll email you when quotes are ready to review.",
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `Job received — ${params.jobReference}`,
    html,
  });
}

/** Customer: quotes are ready to review (admin “notify customer”). */
export async function sendCustomerQuotesReadyEmail(
  params: JobMailBase & { quoteCount: number },
): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const count = Math.max(1, params.quoteCount);
  const quoteWord = count === 1 ? "quote" : "quotes";
  const intro =
    count === 1
      ? "You have a quote available for your cleaning job."
      : `You have ${count} quotes available for your cleaning job.`;
  const html = emailLayout({
    title: `Quotes ready — ${params.jobReference}`,
    heading: `Your ${quoteWord} ${count === 1 ? "is" : "are"} ready`,
    introHtml: `<p>Hi ${escapeHtml(name)}, ${escapeHtml(intro)}</p>`,
    rows: [
      { label: "Job", value: escapeHtml(params.jobReference) },
      ...(params.serviceName
        ? [{ label: "Service", value: escapeHtml(params.serviceName) }]
        : []),
    ],
    cta: { href: jobUrl(params.jobId), label: `View ${quoteWord} in your dashboard` },
    footerNote: "Log in to choose your preferred quote and confirm the booking.",
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: count === 1 ? `Quote ready for job ${params.jobReference}` : `${count} quotes ready for job ${params.jobReference}`,
    html,
  });
}

/** Customer: booking confirmed after quote accept / payment auth. */
export async function sendCustomerBookingConfirmedEmail(
  params: JobMailBase & { amountLabel?: string; contractorName?: string },
): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const html = emailLayout({
    title: `Booking confirmed — ${params.jobReference}`,
    heading: "You're booked",
    introHtml: `<p>Hi ${escapeHtml(name)}, your booking for <strong>${escapeHtml(params.jobReference)}</strong> is confirmed. Payment is authorised and held securely until the job is complete.</p>`,
    rows: [
      ...(params.serviceName
        ? [{ label: "Service", value: escapeHtml(params.serviceName) }]
        : []),
      ...(params.contractorName
        ? [{ label: "Contractor", value: escapeHtml(params.contractorName) }]
        : []),
      ...(params.amountLabel ? [{ label: "Amount", value: escapeHtml(params.amountLabel) }] : []),
    ],
    cta: { href: jobUrl(params.jobId), label: "View booking" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `Booking confirmed — ${params.jobReference}`,
    html,
  });
}

/** Customer notified when contractor marks on the way. */
export async function sendCustomerContractorEnRouteEmail(params: JobMailBase): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const html = emailLayout({
    title: `On the way — ${params.jobReference}`,
    heading: "Your contractor is on the way",
    introHtml: `<p>Hi ${escapeHtml(name)}, your Kleen contractor has let us know they&apos;re heading to job <strong>${escapeHtml(params.jobReference)}</strong>.</p>`,
    cta: { href: jobUrl(params.jobId), label: "View job" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `On the way — ${params.jobReference}`,
    html,
  });
}

/** Customer notified when contractor arrives. */
export async function sendCustomerContractorArrivedEmail(params: JobMailBase): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const html = emailLayout({
    title: `Arrived — ${params.jobReference}`,
    heading: "Your contractor has arrived",
    introHtml: `<p>Hi ${escapeHtml(name)}, your contractor has marked that they&apos;ve arrived for job <strong>${escapeHtml(params.jobReference)}</strong>.</p>`,
    cta: { href: jobUrl(params.jobId), label: "View job" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `Arrived — ${params.jobReference}`,
    html,
  });
}

/** Customer: contractor marked the job complete — please confirm. */
export async function sendCustomerJobCompleteRequestEmail(params: JobMailBase): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const html = emailLayout({
    title: `Confirm completion — ${params.jobReference}`,
    heading: "Please confirm the job is complete",
    introHtml: `<p>Hi ${escapeHtml(name)}, your contractor has marked job <strong>${escapeHtml(params.jobReference)}</strong> as complete. Please confirm in your dashboard so payment can be released after the review window.</p>`,
    cta: { href: jobUrl(params.jobId), label: "Confirm completion" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `Confirm completion — ${params.jobReference}`,
    html,
  });
}

/** Customer: contractor flagged the job incomplete / issue. */
export async function sendCustomerJobIncompleteEmail(
  params: JobMailBase & { reason?: string },
): Promise<EmailSendResult> {
  const name = params.customerName.trim() || "there";
  const html = emailLayout({
    title: `Update needed — ${params.jobReference}`,
    heading: "There's an update on your job",
    introHtml: `<p>Hi ${escapeHtml(name)}, your contractor reported an issue completing job <strong>${escapeHtml(params.jobReference)}</strong>. Kleen has been notified and will help resolve it.</p>`,
    rows: params.reason
      ? [{ label: "Note", value: escapeHtml(params.reason) }]
      : undefined,
    cta: { href: jobUrl(params.jobId), label: "View job" },
  });
  return sendKleenEmail({
    to: params.toEmail,
    subject: `Update needed — ${params.jobReference}`,
    html,
  });
}

/** Admin: new dispute opened by customer. */
export async function sendAdminDisputeOpenedEmail(params: {
  disputeId: string;
  jobReference: string;
  jobId: string;
  customerName: string;
  customerEmail: string;
  reason: string;
}): Promise<EmailSendResult> {
  const html = emailLayout({
    title: `Dispute — ${params.jobReference}`,
    heading: "New customer dispute",
    introHtml: `<p>A customer opened a dispute on Kleen.</p>`,
    rows: [
      { label: "Job", value: escapeHtml(params.jobReference) },
      {
        label: "Customer",
        value: `${escapeHtml(params.customerName)} (${escapeHtml(params.customerEmail)})`,
      },
      { label: "Reason", value: escapeHtml(params.reason) },
    ],
    cta: {
      href: adminAppUrl(`/jobs/${params.jobId}`),
      label: "Open job in admin",
    },
  });
  return sendKleenEmail({
    to: getAdminNotifyEmail(),
    subject: `Dispute — ${params.jobReference}`,
    html,
  });
}

/** Admin: contractor marked job incomplete. */
export async function sendAdminJobIncompleteEmail(params: {
  jobReference: string;
  jobId: string;
  reason?: string;
  contractorName?: string;
}): Promise<EmailSendResult> {
  const html = emailLayout({
    title: `Incomplete — ${params.jobReference}`,
    heading: "Contractor flagged job incomplete",
    introHtml: `<p>A contractor reported they could not complete a job.</p>`,
    rows: [
      { label: "Job", value: escapeHtml(params.jobReference) },
      ...(params.contractorName
        ? [{ label: "Contractor", value: escapeHtml(params.contractorName) }]
        : []),
      ...(params.reason ? [{ label: "Reason", value: escapeHtml(params.reason) }] : []),
    ],
    cta: { href: adminAppUrl(`/jobs/${params.jobId}`), label: "Open in admin" },
  });
  return sendKleenEmail({
    to: getAdminNotifyEmail(),
    subject: `Incomplete — ${params.jobReference}`,
    html,
  });
}

/**
 * After a successful field action, notify customer (and admin for incomplete).
 * Idempotent for first-transition only — callers should pass `wasFirstTransition`.
 */
export async function notifyCustomerFieldStatusEmail(params: {
  action: "en_route" | "arrived" | "complete" | "incomplete";
  wasFirstTransition: boolean;
  toEmail: string | null | undefined;
  customerName: string;
  jobReference: string;
  jobId: string;
  incompleteReason?: string;
  contractorName?: string;
}): Promise<void> {
  if (!params.wasFirstTransition || !params.toEmail?.trim()) return;

  const base = {
    toEmail: params.toEmail.trim(),
    customerName: params.customerName,
    jobReference: params.jobReference,
    jobId: params.jobId,
  };

  if (params.action === "en_route") {
    await sendCustomerContractorEnRouteEmail(base);
    return;
  }
  if (params.action === "arrived") {
    await sendCustomerContractorArrivedEmail(base);
    return;
  }
  if (params.action === "complete") {
    await sendCustomerJobCompleteRequestEmail(base);
    return;
  }
  if (params.action === "incomplete") {
    await sendCustomerJobIncompleteEmail({ ...base, reason: params.incompleteReason });
    await sendAdminJobIncompleteEmail({
      jobReference: params.jobReference,
      jobId: params.jobId,
      reason: params.incompleteReason,
      contractorName: params.contractorName,
    });
  }
}
