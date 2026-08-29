export type TimingBucket = "today" | "upcoming" | "past" | "unknown";

export type Badge = { label: string; className: string };

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getTimingBucket(preferredDate: string | null | undefined): TimingBucket {
  if (!preferredDate) return "unknown";
  const key = preferredDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "unknown";
  const today = localDayKey();
  if (key === today) return "today";
  if (key < today) return "past";
  return "upcoming";
}

export function timingTrafficLight(bucket: TimingBucket): Badge {
  switch (bucket) {
    case "today":
      return { label: "Today", className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200" };
    case "upcoming":
      return { label: "Upcoming", className: "bg-amber-100 text-amber-900 ring-1 ring-amber-200" };
    case "past":
      return { label: "Past", className: "bg-slate-200 text-slate-700 ring-1 ring-slate-300" };
    default:
      return { label: "Date TBC", className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200" };
  }
}

export function formatJobDateTime(preferredDate?: string | null, preferredTime?: string | null): string {
  if (!preferredDate) return "Date TBC";
  const d = new Date(preferredDate.length === 10 ? `${preferredDate}T12:00:00` : preferredDate);
  const datePart = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = preferredTime?.slice(0, 5);
  return time ? `${datePart} · ${time}` : datePart;
}

type JobStatusInput = {
  status?: string | null;
  accepted_quote_request_id?: string | null;
  cancelled_at?: string | null;
};

type QuoteTrackingInput = {
  quoteRequestId: string;
  quoteStatus: string;
  initiatedBy?: string | null;
  customerDeclinedAt?: string | null;
  sentToCustomerAt?: string | null;
  hasResponse: boolean;
  job: JobStatusInput | null | undefined;
};

export function quoteSourceBadge(initiatedBy?: string | null, hasResponse?: boolean): Badge | null {
  if (initiatedBy === "contractor") {
    return { label: "You applied", className: "bg-brand-50 text-brand-800 ring-1 ring-brand-100" };
  }
  if (initiatedBy === "marketplace") {
    return { label: "Job invite", className: "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-100" };
  }
  if (initiatedBy === "admin") {
    return { label: "Kleen invited", className: "bg-violet-50 text-violet-800 ring-1 ring-violet-100" };
  }
  if (hasResponse) {
    return { label: "On this job", className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200" };
  }
  return null;
}

export function quoteTrackingBadge(input: QuoteTrackingInput): Badge {
  const job = input.job;
  const jobStatus = job?.status || "";

  if (jobStatus === "cancelled" || job?.cancelled_at) {
    return { label: "Job cancelled", className: "bg-red-100 text-red-800 ring-1 ring-red-200" };
  }

  if (job?.accepted_quote_request_id === input.quoteRequestId) {
    return { label: "Quote accepted", className: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200" };
  }

  if (job?.accepted_quote_request_id && job.accepted_quote_request_id !== input.quoteRequestId) {
    return { label: "Not selected", className: "bg-slate-200 text-slate-700 ring-1 ring-slate-300" };
  }

  if (input.customerDeclinedAt || input.quoteStatus === "declined") {
    return { label: "Customer declined", className: "bg-red-50 text-red-700 ring-1 ring-red-100" };
  }

  if (input.quoteStatus === "expired") {
    return { label: "Expired", className: "bg-slate-200 text-slate-600 ring-1 ring-slate-300" };
  }

  if (!input.hasResponse) {
    return { label: "Awaiting your quote", className: "bg-amber-100 text-amber-900 ring-1 ring-amber-200" };
  }

  if (input.sentToCustomerAt) {
    return { label: "With customer", className: "bg-violet-100 text-violet-900 ring-1 ring-violet-200" };
  }

  if (input.quoteStatus === "quoted") {
    return { label: "Quoted", className: "bg-blue-100 text-blue-800 ring-1 ring-blue-200" };
  }

  return {
    label: input.quoteStatus.replace(/_/g, " "),
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200 capitalize",
  };
}

export function assignedTrackingBadge(
  job: JobStatusInput & { completed_at?: string | null },
  assignmentCompletedAt?: string | null,
): Badge {
  const status = job.status || "";
  if (status === "cancelled" || job.cancelled_at) {
    return { label: "Cancelled", className: "bg-red-100 text-red-800 ring-1 ring-red-200" };
  }
  if (assignmentCompletedAt || ["completed", "funds_released"].includes(status)) {
    return { label: "Completed", className: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200" };
  }
  if (["in_progress", "pending_confirmation"].includes(status)) {
    return { label: "In progress", className: "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200" };
  }
  if (["awaiting_completion", "customer_accepted", "accepted"].includes(status)) {
    return { label: "Booked", className: "bg-violet-100 text-violet-900 ring-1 ring-violet-200" };
  }
  return { label: "Assigned", className: "bg-brand-100 text-brand-900 ring-1 ring-brand-200" };
}

export type QuoteStatusFilter =
  | "all"
  | "active"
  | "with_customer"
  | "won"
  | "lost"
  | "cancelled"
  | "needs_quote";

export function matchesQuoteStatusFilter(filter: QuoteStatusFilter, input: QuoteTrackingInput): boolean {
  if (filter === "all") return true;
  const tracking = quoteTrackingBadge(input).label;
  if (filter === "needs_quote") return tracking === "Awaiting your quote";
  if (filter === "with_customer") return tracking === "With customer" || tracking === "Quoted";
  if (filter === "won") return tracking === "Quote accepted";
  if (filter === "lost") return tracking === "Not selected" || tracking === "Customer declined";
  if (filter === "cancelled") return tracking === "Job cancelled" || tracking === "Expired";
  if (filter === "active") {
    return !["Not selected", "Customer declined", "Job cancelled", "Expired", "Quote accepted"].includes(tracking);
  }
  return true;
}
