"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import {
  Loader2,
  MapPin,
  Search,
  Briefcase,
  Send,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  Check,
} from "lucide-react";

type BrowseJob = {
  id: string;
  reference: string;
  service_name: string;
  service_id?: string;
  postcode: string;
  city: string | null;
  preferred_date: string;
  preferred_time: string;
  cleaning_type: string;
  distance_miles: number | null;
  quantity: number | null;
  complexity: string | null;
  notes: string | null;
  matches_your_services?: boolean;
};

type ProfileDefaults = {
  base_postcode: string | null;
  radius_miles: number;
  service_areas: string[];
};

type FilterInfo = {
  base_postcode: string | null;
  radius_miles: number;
  service_areas?: string[];
  linked_services?: number;
  only_my_services?: boolean;
  profile_defaults?: ProfileDefaults;
};

type BrowseMeta = {
  open_jobs_scanned?: number;
  skipped_service?: number;
  skipped_area?: number;
  skipped_distance?: number;
  skipped_already_applied?: number;
  outside_linked_services?: number;
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

  // Interactive search filters (defaults filled from profile on first load)
  const [radius, setRadius] = useState(25);
  const [basePostcode, setBasePostcode] = useState("");
  const [ignoreAreas, setIgnoreAreas] = useState(false);
  const [onlyMyServices, setOnlyMyServices] = useState(false);
  const [defaultsReady, setDefaultsReady] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (basePostcode.trim()) params.set("base", basePostcode.trim());
    params.set("radius", String(radius));
    if (ignoreAreas) params.set("ignoreAreas", "1");
    if (onlyMyServices) params.set("onlyMyServices", "1");

    const res = await fetch(`/api/contractor/jobs/browse?${params}`, { credentials: "include" });
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

    if (!defaultsReady && json.filter?.profile_defaults) {
      const d = json.filter.profile_defaults;
      setRadius(d.radius_miles || 25);
      setBasePostcode(d.base_postcode || "");
      setDefaultsReady(true);
    }
  }, [basePostcode, radius, ignoreAreas, onlyMyServices, defaultsReady]);

  useEffect(() => {
    if (!isVerified) {
      router.replace("/contractor");
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isVerified, router]); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  const applyFilters = async () => {
    setLoading(true);
    await load();
    setLoading(false);
  };

  const resetFilters = async () => {
    const d = filterInfo?.profile_defaults;
    setRadius(d?.radius_miles || 25);
    setBasePostcode(d?.base_postcode || "");
    setIgnoreAreas(false);
    setOnlyMyServices(false);
    setLoading(true);
    // load uses state — set then fetch with explicit params
    const params = new URLSearchParams();
    if (d?.base_postcode) params.set("base", d.base_postcode);
    params.set("radius", String(d?.radius_miles || 25));
    const res = await fetch(`/api/contractor/jobs/browse?${params}`, { credentials: "include" });
    const json = (await res.json()) as {
      jobs?: BrowseJob[];
      filter?: FilterInfo;
      meta?: BrowseMeta;
      error?: string;
    };
    if (res.ok) {
      setJobs(json.jobs || []);
      setFilterInfo(json.filter || null);
      setMeta(json.meta || null);
    }
    setLoading(false);
  };

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

  if (!isVerified || (loading && !filterInfo && jobs.length === 0)) {
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
        description="Search open jobs near you, adjust your range for this search, then submit a quote to apply."
        action={
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Interactive filters */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-brand-600" />
          <p className="text-sm font-semibold text-slate-900">Search filters</p>
          <span className="text-xs text-slate-400">
            Defaults from your profile — change them for this search only
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-xs font-medium text-slate-600">
            Search from postcode
            <input
              value={basePostcode}
              onChange={(e) => setBasePostcode(e.target.value.toUpperCase())}
              placeholder="e.g. SW1A 1AA"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="block text-xs font-medium text-slate-600 sm:col-span-1">
            Distance: <span className="font-semibold text-slate-900">{radius} miles</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="mt-3 w-full accent-brand-600"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>5 mi</span>
              <span>Profile default: {filterInfo?.profile_defaults?.radius_miles ?? "—"} mi</span>
              <span>100 mi</span>
            </div>
          </label>

          <div className="flex flex-col justify-end gap-2 min-h-[4.5rem]">
            <FilterCheck
              checked={ignoreAreas}
              onChange={setIgnoreAreas}
              label="Ignore saved service areas for this search"
            />
            <FilterCheck
              checked={onlyMyServices}
              onChange={setOnlyMyServices}
              label="Only jobs matching my linked services"
            />
            <p
              className={`min-h-[1rem] text-[11px] text-slate-400 ${
                !ignoreAreas && (filterInfo?.profile_defaults?.service_areas?.length ?? 0) > 0
                  ? "visible"
                  : "invisible"
              }`}
            >
              Areas: {filterInfo?.profile_defaults?.service_areas?.join(", ") || "—"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Apply filters"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Reset to profile defaults
          </button>
          <Link href="/contractor/profile" className="px-2 py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700">
            Edit profile defaults →
          </Link>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter results by reference, postcode, service…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <p className="mb-3 text-xs text-slate-500">
        Showing {filtered.length} job{filtered.length === 1 ? "" : "s"}
        {filterInfo?.base_postcode ? ` within ${filterInfo.radius_miles} mi of ${filterInfo.base_postcode}` : ""}
        {typeof filterInfo?.linked_services === "number"
          ? ` · ${filterInfo.linked_services} linked service${filterInfo.linked_services === 1 ? "" : "s"}`
          : ""}
        {(meta?.outside_linked_services ?? 0) > 0 && !onlyMyServices
          ? ` · ${meta?.outside_linked_services} need a service you haven't linked yet`
          : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-14 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-800">No open jobs to show</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {(meta?.open_jobs_scanned ?? 0) === 0
              ? "There are no open jobs in the marketplace right now."
              : meta && (meta.skipped_service || 0) > 0 && onlyMyServices
                ? `Found ${meta.open_jobs_scanned} open job(s), but none match your linked services. Turn off “Only my linked services” to see them, or add services under Services & contracts.`
                : meta && (meta.skipped_distance || 0) + (meta.skipped_area || 0) > 0
                  ? `Found ${meta.open_jobs_scanned} open job(s) outside your current filters. Increase distance or ignore service areas, then Apply filters.`
                  : meta && (meta.skipped_already_applied || 0) > 0
                    ? "You've already quoted on matching open jobs. Check My work."
                    : "Nothing matches — widen filters and try again."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/contractor/services"
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="hidden border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_8.5rem] sm:gap-3 lg:px-5">
            <span>Job</span>
            <span>Location</span>
            <span>When</span>
            <span className="text-right">Distance</span>
            <span className="text-right">Action</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {filtered.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onApplied={() => {
                  load();
                  router.push("/contractor/jobs");
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-2.5 rounded-lg px-0.5 py-0.5 text-left text-xs text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="min-w-0 leading-snug">{label}</span>
    </button>
  );
}

function JobRow({ job, onApplied }: { job: BrowseJob; onApplied: () => void }) {
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

  const whenLabel = job.preferred_date
    ? `${new Date(job.preferred_date).toLocaleDateString("en-GB")} · ${job.preferred_time?.slice(0, 5) || "Flexible"}`
    : "Date flexible";

  const needsService = job.matches_your_services === false;

  return (
    <li className="bg-white">
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_8.5rem] sm:items-center sm:gap-3 lg:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{job.reference}</p>
            {needsService && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Service not linked
              </span>
            )}
          </div>
          <p className="truncate text-xs text-brand-700">{job.service_name}</p>
          {job.quantity != null && (
            <p className="mt-0.5 text-[11px] text-slate-400">{job.quantity} rooms/units</p>
          )}
        </div>

        <div className="min-w-0 text-xs text-slate-600">
          <p className="inline-flex items-center gap-1 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {job.postcode}
            {job.city ? ` · ${job.city}` : ""}
          </p>
          <a
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(job.postcode)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
          >
            Map <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="min-w-0 text-xs text-slate-600">
          <p>{whenLabel}</p>
          {job.notes && <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{job.notes}</p>}
        </div>

        <div className="text-left text-xs font-semibold text-slate-700 sm:text-right">
          {job.distance_miles != null ? `${job.distance_miles} mi` : "—"}
        </div>

        <div className="flex sm:justify-end">
          {needsService ? (
            <Link
              href="/contractor/services"
              className="inline-flex w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 sm:w-auto"
            >
              Add service
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500 sm:w-auto"
            >
              {expanded ? "Close" : "Quote"}
            </button>
          )}
        </div>
      </div>

      {needsService && (
        <p className="border-t border-slate-50 px-4 pb-3 text-[11px] text-amber-800 lg:px-5">
          Link <strong>{job.service_name}</strong> under Services &amp; contracts before you can bid.
        </p>
      )}

      {expanded && !needsService && (
        <form
          onSubmit={apply}
          className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 lg:px-5"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs">
              <span className="text-slate-500">Your price (£)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Earliest date</span>
              <input
                type="date"
                value={avail}
                onChange={(e) => setAvail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs">
              <span className="text-slate-500">Notes</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {busy ? "Submitting…" : "Apply & quote"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
