/** Inbox for Kleen admin alerts (contractor applications). */
export function getAdminNotifyEmail(): string {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || "info@kleenapp.co.uk";
}

export function getAdminAppUrl(): string {
  return (process.env.ADMIN_APP_URL || "https://admin.kleenapp.co.uk").replace(/\/$/, "");
}
