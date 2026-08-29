"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import {
  assignedTrackingBadge,
  formatJobDateTime,
  getTimingBucket,
  matchesQuoteStatusFilter,
  quoteSourceBadge,
  quoteTrackingBadge,
  timingTrafficLight,
  type QuoteStatusFilter,
  type TimingBucket,
} from "@/lib/my-work-helpers";
import {
  Loader2,
  Search,
  CheckCircle2,
  ChevronRight,
  Calendar,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";

type JobEmbed = {
  id: string;
  reference: string;
  postcode: string;
  city?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  status?: string | null;
  accepted_quote_request_id?: string | null;
  cancelled_at?: string | null;
  services?: { name: string } | { name: string }[] | null;
};

type QrRow = {
  id: string;
  status: string;
  initiated_by?: string | null;
  deadline: string;
  message: string | null;
  sent_at: string;
  customer_declined_at?: string | null;
  jobs: JobEmbed | JobEmbed[] | null;
  quote_responses:
    | {
        price_pence: number;
        estimated_hours: number | null;
        sent_to_customer_at: string | null;
      }
    | {
        price_pence: number;
        estimated_hours: number | null;
        sent_to_customer_at: string | null;
      }[]
    | null;
};

type AssignmentRow = {
  id: string;
  assigned_at: string;
  completed_at: string | null;
  jobs: JobEmbed | JobEmbed[] | null;
};

type Tab = "quotes" | "assigned";
type TimingFilter = "all" | TimingBucket;
type AssignedStatusFilter = "all" | "booked" | "in_progress" | "completed" | "cancelled";
type SortOrder = "date_asc" | "date_desc" | "updated_desc";

function unwrapJob(jobs: JobEmbed | JobEmbed[] | null | undefined): JobEmbed | null {
  if (!jobs) return null;
  return Array.isArray(jobs) ? jobs[0] ?? null : jobs;
}

function serviceName(job: JobEmbed | null): string {
  const svc = job?.services;
  if (!svc) return "Service";
  return Array.isArray(svc) ? svc[0]?.name || "Service" : svc.name || "Service";
}

function locationLine(job: JobEmbed | null): string {
  if (!job) return "";
  const parts = [job.city, job.postcode].filter(Boolean);
  return parts.join(" · ");
}

export default function JobsDashboard() {
  const { refresh } = useContractorPortal();
  const [tab, setTab] = useState<Tab>("quotes");
  const [quotes, setQuotes] = useState<QrRow[]>([]);
  const [assigned, setAssigned] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [timingFilter, setTimingFilter] = useState<TimingFilter>("all");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<QuoteStatusFilter>("all");
  const [assignedStatusFilter, setAssignedStatusFilter] = useState<AssignedStatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date_asc");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadQuotesAndAssigned = useCallback(async () => {
    const res = await fetch("/api/contractor/jobs/my-work", { credentials: "include" });
    const json = (await res.json()) as {
      quotes?: QrRow[];
      assigned?: AssignmentRow[];
      operative_id?: string | null;
      merged?: boolean;
      error?: string;
    };

    if (!res.ok) {
      console.error("contractor my-work load:", json.error || res.status);
      setQuotes([]);
      setAssigned([]);
      return;
    }

    const qrData = json.quotes || [];
    const mergedAssigned = json.assigned || [];
    setQuotes(qrData);
    setAssigned(mergedAssigned);

    if (json.merged) {
      console.info("Contractor records merged on load");
      void refresh();
    }

    setTab((current) => {
      if (current === "assigned" && mergedAssigned.length === 0 && qrData.length > 0) return "quotes";
      if (mergedAssigned.length > 0 && qrData.length === 0) return "assigned";
      return current;
    });
  }, [refresh]);

  useEffect(() => {
    setLoading(true);
    loadQuotesAndAssigned().finally(() => setLoading(false));
  }, [loadQuotesAndAssigned]);

  const resetFilters = () => {
    setSearch("");
    setTimingFilter("all");
    setQuoteStatusFilter("all");
    setAssignedStatusFilter("all");
    setSortOrder("date_asc");
  };

  const activeFilterCount = [
    search.trim(),
    timingFilter !== "all",
    tab === "quotes" ? quoteStatusFilter !== "all" : assignedStatusFilter !== "all",
    sortOrder !== "date_asc",
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-9 w-9 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <ContractorPageHeader
        title="My work"
        description="Quotes you’ve applied to or been added on, and jobs assigned after the customer accepts."
        action={
          <Link
            href="/contractor/find"
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-500"
          >
            <Search className="h-4 w-4" />
            Find a Job
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["quotes", "My quotes", quotes.length],
            ["assigned", "Assigned", assigned.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              tab === key
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs ${tab === key ? "text-brand-100" : "text-slate-400"}`}>{count}</span>
          </button>
        ))}
      </div>

      <WorkFiltersBar
        search={search}
        onSearchChange={setSearch}
        timingFilter={timingFilter}
        onTimingChange={setTimingFilter}
        quoteStatusFilter={quoteStatusFilter}
        onQuoteStatusChange={setQuoteStatusFilter}
        assignedStatusFilter={assignedStatusFilter}
        onAssignedStatusChange={setAssignedStatusFilter}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
        tab={tab}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        activeFilterCount={activeFilterCount}
        onReset={resetFilters}
      />

      {tab === "quotes" && (
        <QuotesTab
          rows={quotes}
          onRefresh={loadQuotesAndAssigned}
          search={search}
          timingFilter={timingFilter}
          statusFilter={quoteStatusFilter}
          sortOrder={sortOrder}
          onClearFilters={resetFilters}
        />
      )}
      {tab === "assigned" && (
        <AssignedTab
          rows={assigned}
          search={search}
          timingFilter={timingFilter}
          statusFilter={assignedStatusFilter}
          sortOrder={sortOrder}
          onClearFilters={resetFilters}
        />
      )}
    </div>
  );
}

function WorkFiltersBar({
  search,
  onSearchChange,
  timingFilter,
  onTimingChange,
  quoteStatusFilter,
  onQuoteStatusChange,
  assignedStatusFilter,
  onAssignedStatusChange,
  sortOrder,
  onSortChange,
  tab,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  onReset,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  timingFilter: TimingFilter;
  onTimingChange: (v: TimingFilter) => void;
  quoteStatusFilter: QuoteStatusFilter;
  onQuoteStatusChange: (v: QuoteStatusFilter) => void;
  assignedStatusFilter: AssignedStatusFilter;
  onAssignedStatusChange: (v: AssignedStatusFilter) => void;
  sortOrder: SortOrder;
  onSortChange: (v: SortOrder) => void;
  tab: Tab;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  onReset: () => void;
}) {
  const timingOptions: { value: TimingFilter; label: string }[] = [
    { value: "all", label: "All dates" },
    { value: "today", label: "Today" },
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past" },
  ];

  const quoteStatusOptions: { value: QuoteStatusFilter; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "needs_quote", label: "Needs quote" },
    { value: "with_customer", label: "With customer" },
    { value: "won", label: "Accepted" },
    { value: "lost", label: "Not selected" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const assignedStatusOptions: { value: AssignedStatusFilter; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: "booked", label: "Booked" },
    { value: "in_progress", label: "In progress" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search reference, postcode, service…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none ring-brand-200 focus:border-brand-300 focus:bg-white focus:ring-2"
          />
        </div>
        <button
          type="button"
          onClick={onToggleFilters}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold ring-1 transition ${
            filtersOpen || activeFilterCount > 0
              ? "bg-brand-50 text-brand-800 ring-brand-200"
              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {(filtersOpen || activeFilterCount > 0) && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <FilterGroup label="When">
            {timingOptions.map((opt) => (
              <FilterChip
                key={opt.value}
                active={timingFilter === opt.value}
                onClick={() => onTimingChange(opt.value)}
                label={opt.label}
                dot={opt.value !== "all" ? opt.value : undefined}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Status">
            {(tab === "quotes" ? quoteStatusOptions : assignedStatusOptions).map((opt) => (
              <FilterChip
                key={opt.value}
                active={tab === "quotes" ? quoteStatusFilter === opt.value : assignedStatusFilter === opt.value}
                onClick={() =>
                  tab === "quotes"
                    ? onQuoteStatusChange(opt.value as QuoteStatusFilter)
                    : onAssignedStatusChange(opt.value as AssignedStatusFilter)
                }
                label={opt.label}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Sort">
            <FilterChip
              active={sortOrder === "date_asc"}
              onClick={() => onSortChange("date_asc")}
              label="Start date (soonest)"
            />
            <FilterChip
              active={sortOrder === "date_desc"}
              onClick={() => onSortChange("date_desc")}
              label="Start date (latest)"
            />
            <FilterChip
              active={sortOrder === "updated_desc"}
              onClick={() => onSortChange("updated_desc")}
              label="Recently updated"
            />
          </FilterGroup>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dot?: TimingBucket;
}) {
  const dotColor =
    dot === "today" ? "bg-emerald-500" : dot === "upcoming" ? "bg-amber-500" : dot === "past" ? "bg-slate-400" : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200/70"
      }`}
    >
      {dotColor && <span className={`h-2 w-2 rounded-full ${dotColor} ${active ? "ring-1 ring-white/50" : ""}`} />}
      {label}
    </button>
  );
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function BadgeRow({
  timingBucket,
  badges,
}: {
  timingBucket: TimingBucket;
  badges: { label: string; className: string }[];
}) {
  const timing = timingTrafficLight(timingBucket);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <StatusBadge label={timing.label} className={timing.className} />
      {badges.map((b) => (
        <StatusBadge key={b.label} label={b.label} className={b.className} />
      ))}
    </div>
  );
}

function ViewJobDetailsLink() {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 group-hover:text-brand-700">
      View job details
      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </span>
  );
}

function sortByDate<T extends { preferredDate: string | null; updatedAt: string }>(
  items: T[],
  sortOrder: SortOrder,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sortOrder === "updated_desc") {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    const da = a.preferredDate || "9999-12-31";
    const db = b.preferredDate || "9999-12-31";
    return sortOrder === "date_desc" ? db.localeCompare(da) : da.localeCompare(db);
  });
  return copy;
}

function matchesSearch(search: string, job: JobEmbed | null, extra?: string): boolean {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  const hay = [
    job?.reference,
    job?.postcode,
    job?.city,
    serviceName(job),
    extra,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function matchesTimingFilter(filter: TimingFilter, preferredDate?: string | null): boolean {
  if (filter === "all") return true;
  return getTimingBucket(preferredDate) === filter;
}

function QuotesTab({
  rows,
  onRefresh,
  search,
  timingFilter,
  statusFilter,
  sortOrder,
  onClearFilters,
}: {
  rows: QrRow[];
  onRefresh: () => void;
  search: string;
  timingFilter: TimingFilter;
  statusFilter: QuoteStatusFilter;
  sortOrder: SortOrder;
  onClearFilters: () => void;
}) {
  const filtered = useMemo(() => {
    const mapped = rows
      .map((qr) => {
        const job = unwrapJob(qr.jobs);
        const resp = Array.isArray(qr.quote_responses) ? qr.quote_responses[0] : qr.quote_responses;
        const trackingInput = {
          quoteRequestId: qr.id,
          quoteStatus: qr.status,
          initiatedBy: qr.initiated_by,
          customerDeclinedAt: qr.customer_declined_at,
          sentToCustomerAt: resp?.sent_to_customer_at,
          hasResponse: Boolean(resp),
          job,
        };
        return {
          qr,
          job,
          resp,
          trackingInput,
          preferredDate: job?.preferred_date?.slice(0, 10) ?? null,
          updatedAt: resp?.sent_to_customer_at || qr.sent_at,
        };
      })
      .filter(({ job, trackingInput, preferredDate }) => {
        if (!matchesSearch(search, job)) return false;
        if (!matchesTimingFilter(timingFilter, preferredDate)) return false;
        if (!matchesQuoteStatusFilter(statusFilter, trackingInput)) return false;
        return true;
      });

    return sortByDate(mapped, sortOrder);
  }, [rows, search, timingFilter, statusFilter, sortOrder]);

  return (
    <div className="space-y-4">
      {filtered.length > 0 && rows.length > filtered.length && (
        <p className="text-xs text-slate-500">
          Showing {filtered.length} of {rows.length} quotes
        </p>
      )}
      {filtered.map(({ qr, job, resp, trackingInput }) => {
        const timingBucket = getTimingBucket(job?.preferred_date);
        const sourceBadge = quoteSourceBadge(qr.initiated_by, Boolean(resp));
        const trackingBadge = quoteTrackingBadge(trackingInput);
        const badges = [sourceBadge, trackingBadge].filter(Boolean) as { label: string; className: string }[];

        const cardBody = (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{job?.reference || "Job"}</p>
                <p className="text-sm text-slate-600">{serviceName(job)}</p>
                {locationLine(job) && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {locationLine(job)}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-700">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  {formatJobDateTime(job?.preferred_date, job?.preferred_time)}
                </p>
              </div>
              <BadgeRow timingBucket={timingBucket} badges={badges} />
            </div>

            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                <span className="font-medium text-slate-600">Invited:</span>{" "}
                {new Date(qr.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              {qr.deadline && (
                <p>
                  <span className="font-medium text-slate-600">Quote by:</span>{" "}
                  {new Date(qr.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>

            {resp && (
              <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <p>
                  <span className="font-medium">Your payout:</span> £{(resp.price_pence / 100).toFixed(2)}
                  {resp.estimated_hours != null && <> · est. {resp.estimated_hours}h</>}
                </p>
                {resp.sent_to_customer_at && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Sent to customer {new Date(resp.sent_to_customer_at).toLocaleString("en-GB")}
                  </p>
                )}
              </div>
            )}

            {job?.id && (
              <div className="mt-4 flex justify-end">
                <ViewJobDetailsLink />
              </div>
            )}
          </>
        );

        return (
          <div key={qr.id} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
            {job?.id ? (
              <Link
                href={`/contractor/jobs/${job.id}`}
                className="block rounded-t-2xl p-5 transition hover:bg-slate-50/80"
              >
                {cardBody}
              </Link>
            ) : (
              <div className="p-5">{cardBody}</div>
            )}
            {!resp && <InviteQuoteForm quoteRequestId={qr.id} jobServiceId={undefined} onDone={onRefresh} />}
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          No quotes yet — use{" "}
          <Link href="/contractor/find" className="font-semibold text-brand-600 hover:underline">
            Find a Job
          </Link>{" "}
          to apply, or wait for Kleen to add you to a job.
        </p>
      )}
      {rows.length > 0 && filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          No quotes match your filters.{" "}
          <button type="button" onClick={onClearFilters} className="font-semibold text-brand-600 hover:underline">
            Clear filters
          </button>
        </p>
      )}
    </div>
  );
}

function matchesAssignedStatus(filter: AssignedStatusFilter, job: JobEmbed | null, completedAt: string | null): boolean {
  if (filter === "all") return true;
  const badge = assignedTrackingBadge(job || {}, completedAt).label;
  if (filter === "booked") return badge === "Booked" || badge === "Assigned";
  if (filter === "in_progress") return badge === "In progress";
  if (filter === "completed") return badge === "Completed";
  if (filter === "cancelled") return badge === "Cancelled";
  return true;
}

function AssignedTab({
  rows,
  search,
  timingFilter,
  statusFilter,
  sortOrder,
  onClearFilters,
}: {
  rows: AssignmentRow[];
  search: string;
  timingFilter: TimingFilter;
  statusFilter: AssignedStatusFilter;
  sortOrder: SortOrder;
  onClearFilters: () => void;
}) {
  const filtered = useMemo(() => {
    const mapped = rows
      .map((a) => {
        const job = unwrapJob(a.jobs);
        return {
          a,
          job,
          preferredDate: job?.preferred_date?.slice(0, 10) ?? null,
          updatedAt: a.completed_at || a.assigned_at,
        };
      })
      .filter(({ job, a, preferredDate }) => {
        if (!job?.id) return false;
        if (!matchesSearch(search, job)) return false;
        if (!matchesTimingFilter(timingFilter, preferredDate)) return false;
        if (!matchesAssignedStatus(statusFilter, job, a.completed_at)) return false;
        return true;
      });

    return sortByDate(mapped, sortOrder);
  }, [rows, search, timingFilter, statusFilter, sortOrder]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {filtered.length > 0 && rows.length > filtered.length && (
        <p className="col-span-full text-xs text-slate-500">
          Showing {filtered.length} of {rows.length} assigned jobs
        </p>
      )}
      {filtered.map(({ a, job }) => {
        const timingBucket = getTimingBucket(job?.preferred_date);
        const trackingBadge = assignedTrackingBadge(job || {}, a.completed_at);
        const badges = [trackingBadge];

        return (
          <Link
            key={a.id}
            href={`/contractor/jobs/${job!.id}`}
            className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-slate-50/50 hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{job?.reference || "Assigned job"}</p>
                <p className="text-sm text-slate-600">{serviceName(job)}</p>
                {locationLine(job) && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {locationLine(job)}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-700">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  {formatJobDateTime(job?.preferred_date, job?.preferred_time)}
                </p>
              </div>
              <BadgeRow timingBucket={timingBucket} badges={badges} />
            </div>

            <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                <span className="font-medium text-slate-600">Assigned:</span>{" "}
                {new Date(a.assigned_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              {a.completed_at && (
                <p>
                  <span className="font-medium text-slate-600">Completed:</span>{" "}
                  {new Date(a.completed_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <ViewJobDetailsLink />
            </div>
          </Link>
        );
      })}
      {rows.length === 0 && (
        <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          No assigned jobs yet. When Kleen assigns you (or a customer accepts your quote), work appears here.
        </p>
      )}
      {rows.length > 0 && filtered.length === 0 && (
        <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          No assigned jobs match your filters.{" "}
          <button type="button" onClick={onClearFilters} className="font-semibold text-brand-600 hover:underline">
            Clear filters
          </button>
        </p>
      )}
    </div>
  );
}

function InviteQuoteForm({
  quoteRequestId,
  jobServiceId,
  onDone,
}: {
  quoteRequestId: string;
  jobServiceId: string | undefined;
  onDone: () => void;
}) {
  const [price, setPrice] = useState("");
  const [hours, setHours] = useState("");
  const [avail, setAvail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pounds = Number(price);
    if (!Number.isFinite(pounds) || pounds <= 0) return;
    setBusy(true);
    const supabase = createClient();
    let operativeServiceId: string | null = null;
    if (jobServiceId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: op } = await supabase.from("operatives").select("id").eq("user_id", user.id).single();
        if (op) {
          const { data: os } = await supabase
            .from("operative_services")
            .select("id")
            .eq("operative_id", op.id)
            .eq("service_id", jobServiceId)
            .maybeSingle();
          operativeServiceId = os?.id ?? null;
        }
      }
    }
    const { data: qr } = await supabase
      .from("quote_requests")
      .select("job_id, jobs(service_id)")
      .eq("id", quoteRequestId)
      .single();
    const jobRow = qr?.jobs as { service_id?: string } | { service_id?: string }[] | null;
    const sid = jobServiceId || (Array.isArray(jobRow) ? jobRow[0]?.service_id : jobRow?.service_id);
    if (!operativeServiceId && sid) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: op } = await supabase.from("operatives").select("id").eq("user_id", user!.id).single();
      const { data: os } = await supabase
        .from("operative_services")
        .select("id")
        .eq("operative_id", op!.id)
        .eq("service_id", sid)
        .maybeSingle();
      operativeServiceId = os?.id ?? null;
    }
    if (!operativeServiceId) {
      alert("Link this service under Services & contracts first.");
      setBusy(false);
      return;
    }
    const pence = Math.round(pounds * 100);
    const { error: insErr } = await supabase.from("quote_responses").insert({
      quote_request_id: quoteRequestId,
      price_pence: pence,
      estimated_hours: hours ? Number(hours) : null,
      available_date: avail || null,
      notes: notes.trim() || null,
      operative_service_id: operativeServiceId,
    });
    if (insErr) {
      alert(insErr.message);
      setBusy(false);
      return;
    }
    await supabase
      .from("quote_requests")
      .update({ status: "quoted", responded_at: new Date().toISOString() })
      .eq("id", quoteRequestId);
    setBusy(false);
    onDone();
  };

  return (
    <form
      onSubmit={submit}
      className="mx-5 mb-5 mt-0 space-y-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4"
    >
      <p className="text-sm font-medium text-slate-800">Kleen invited you — submit your quote</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Price (£)
          <input
            type="number"
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs">
          Est. hours
          <input
            type="number"
            step="0.25"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          Earliest date
          <input
            type="date"
            value={avail}
            onChange={(e) => setAvail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit quote"}
      </button>
    </form>
  );
}
