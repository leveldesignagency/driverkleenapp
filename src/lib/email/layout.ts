/** Shared HTML email layout for Kleen transactional mail. */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailLayout(params: {
  title: string;
  heading: string;
  introHtml: string;
  rows?: { label: string; value: string }[];
  cta?: { href: string; label: string };
  footerNote?: string;
}): string {
  const rowsHtml =
    params.rows && params.rows.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${params.rows
          .map(
            (r) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-weight:600;width:38%;vertical-align:top;">${escapeHtml(r.label)}</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">${r.value}</td></tr>`,
          )
          .join("")}</table>`
      : "";

  const ctaHtml = params.cta
    ? `<p style="margin-top:24px;"><a href="${params.cta.href}" style="display:inline-block;background:#0891b2;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">${escapeHtml(params.cta.label)}</a></p>`
    : "";

  const footer = params.footerNote
    ? `<p style="margin-top:28px;font-size:12px;color:#94a3b8;">${params.footerNote}</p>`
    : `<p style="margin-top:28px;font-size:12px;color:#94a3b8;">Kleen · kleenapp.co.uk</p>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(params.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0891b2;">Kleen</p>
      <h1 style="font-size:1.25rem;margin:0 0 8px;color:#0f172a;">${escapeHtml(params.heading)}</h1>
      <div style="color:#64748b;margin-bottom:8px;">${params.introHtml}</div>
      ${rowsHtml}
      ${ctaHtml}
      ${footer}
    </div>
  </div>
</body>
</html>`.trim();
}

export function customerDashboardUrl(path = "/dashboard"): string {
  const base =
    process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.replace(/\/$/, "") ||
    process.env.CUSTOMER_DASHBOARD_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://dashboard.kleenapp.co.uk";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function contractorPortalUrl(path = "/contractor"): string {
  const base =
    process.env.NEXT_PUBLIC_CONTRACTOR_PORTAL_URL?.replace(/\/$/, "") ||
    process.env.CONTRACTOR_PORTAL_BASE_URL?.replace(/\/$/, "") ||
    "https://contractor.kleenapp.co.uk";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function adminAppUrl(path = "/"): string {
  const base = (process.env.ADMIN_APP_URL || "https://admin.kleenapp.co.uk").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
