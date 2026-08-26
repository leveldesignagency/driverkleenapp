"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import {
  Loader2,
  MapPin,
  Navigation,
  Search,
  Briefcase,
  Send,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

type BrowseJob = {
  id: string;
  reference: string;
  service_name: string;
  postcode: string;
  city: string | null;
  preferred_date: string;
  preferred_time: string;
  cleaning_type: string;
  distance_miles: number | null;
  quantity: number | null;
  complexity: string | null;
  notes: string | null;
};

type FilterInfo = {
  base_postcode: string | null;
  radius_miles: number;
  service_areas?: string[];
  linked_services?: number;
};

type BrowseMeta = {
  open_jobs_scanned?: number;
  skipped_service?: number;
  skipped_area?: number;
  skipped_distance?: number;
  skipped_already_applied?: number;
};

export default function FindJobsDashboard() {
  const router = useRouter();
  const { isVerified } = useContractorPortal();
  const [jobs, setJobs] = useState<BrowseJob[]>([]);
  const [filterInfo, setFilterInfo] = useState<FilterInfo | null>(null);
  const [meta, setMeta] = useState<BrowseMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/contractor/jobs/browse", { credentials: "include" });
    const json = (await res.json()) as {
      jobs?: BrowseJob[];
      filter?: FilterInfo;
      meta?: BrowseMeta;
      error?: string;
    };
    if (!res.ok) {
      setError(json.error || "Could not load open jobs");
      setJobs([]);
      return;
    }
    setJobs(json.jobs || []);
    setFilterInfo(json.filter || null);
    setMeta(json.meta || null);
  }, []);

  useEffect(() => {
    if (!isVerified) {
      router.replace("/contractor");
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isVerified, load, router]);

  const filtered = jobs.filter((j) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      j.reference.toLowerCase().includes(q) ||
      j.postcode.toLowerCase().includes(q) ||
      j.service_name.toLowerCase().includes(q) ||
      (j.city || "").toLowerCase().includes(q)
    );
  });

  if (!isVerified || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-9 w-9 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <ContractorPageHeader
        title="Find a Job"
        description="Open cleaning jobs near you. Submit a quote to apply — Kleen or the customer takes it from there."
        action={
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Filters</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {filterInfo?.base_postcode
                ? `Within ${filterInfo.radius_miles} miles of ${filterInfo.base_postcode}`
                : "No base postcode — showing open jobs without distance filter."}
              {filterInfo?.service_areas && filterInfo.service_areas.length > 0
                ? ` · Areas: ${filterInfo.service_areas.join(", ")}`
                : " · All areas"}
              {typeof filterInfo?.linked_services === "number"
                ? ` · ${filterInfo.linked_services} linked service${filterInfo.linked_services === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        </div>
        <Link
          href="/contractor/profile"
          className="shrink-0 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
        >
          Edit travel &amp; areas →
        </Link>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by reference, postcode, service…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-14 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-800">No open jobs to show</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {(meta?.open_jobs_scanned ?? 0) === 0
              ? "There are no open jobs in the marketplace right now. Check back after customers submit new bookings."
              : meta && (meta.skipped_service || 0) > 0 && (filterInfo?.linked_services ?? 0) > 0
                ? `Found ${meta.open_jobs_scanned} open job(s), but none match your linked services. Add the right services under Services & contracts.`
                : meta && (meta.skipped_distance || 0) + (meta.skipped_area || 0) > 0
                  ? `Found ${meta.open_jobs_scanned} open job(s), but they are outside your travel radius or service areas. Widen your settings on Profile.`
                  : meta && (meta.skipped_already_applied || 0) > 0
                    ? "You've already quoted on the open jobs that match. Check My work for those quotes."
                    : "Nothing matches your current filters. Adjust travel settings or services, then refresh."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/contractor/services"
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Services &amp; contracts
            </Link>
            <Link
              href="/contractor/jobs"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              My work
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onApplied={() => {
                load();
                router.push("/contractor/jobs");
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobCard({ job, onApplied }: { job: BrowseJob; onApplied: () => void }) {
  const [price, setPrice] = useState("");
  const [hours, setHours] = useState("");
  const [avail, setAvail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    const pounds = Number(price);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      alert("Enter a valid price (£)");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/contractor/jobs/apply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        pricePence: Math.round(pounds * 100),
        estimatedHours: hours ? Number(hours) : undefined,
        availableDate: avail || undefined,
        notes: notes.trim() || undefined,
        travelDistanceMiles: job.distance_miles ?? undefined,
      }),
    });
    const json = (await res.json()) as { error?: string; message?: string };
    setBusy(false);
    if (!res.ok) {
      alert(json.error || "Could not submit quote");
      return;
    }
    alert(json.message || "Quote submitted");
    onApplied();
  };

  const mapUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(job.postcode)}`;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-900">{job.reference}</p>
          <p className="text-sm text-emerald-800">{job.service_name}</p>
        </div>
        {job.distance_miles != null && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            {job.distance_miles} mi
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {job.postcode}
          {job.city ? ` · ${job.city}` : ""}
        </span>
        <span>
          {job.preferred_date
            ? `${new Date(job.preferred_date).toLocaleDateString("en-GB")} · ${job.preferred_time?.slice(0, 5) || "Flexible"}`
            : "Date flexible"}
        </span>
        {job.quantity != null && <span>{job.quantity} rooms/units</span>}
      </div>

      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
      >
        View on map <ExternalLink className="h-3 w-3" />
      </a>

      {job.notes && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{job.notes}</p>}

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Submit a quote
        </button>
      ) : (
        <form onSubmit={apply} className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="text-slate-500">Your price (£)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Est. hours</span>
              <input
                type="number"
                step="0.25"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs sm:col-span-2">
              <span className="text-slate-500">Earliest date</span>
              <input
                type="date"
                value={avail}
                onChange={(e) => setAvail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs sm:col-span-2">
              <span className="text-slate-500">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Submitting…" : "Apply & quote"}
            </button>
            <button type="button" onClick={() => setExpanded(false)} className="rounded-xl px-4 text-sm text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
