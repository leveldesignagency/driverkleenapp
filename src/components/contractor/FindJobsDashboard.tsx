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
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Filters — stacked full width, Upwork-style */}
      <div className="mb-6 space-y-4 border-b border-slate-200 pb-6">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Search from postcode</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={basePostcode}
              onChange={(e) => setBasePostcode(e.target.value.toUpperCase())}
              placeholder="e.g. SW1A 1AA"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            Distance: <span className="font-semibold text-slate-900">{radius} miles</span>
            <span className="ml-2 font-normal text-slate-400">
              (profile default: {filterInfo?.profile_defaults?.radius_miles ?? "—"} mi)
            </span>
          </span>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>5 mi</span>
            <span>100 mi</span>
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
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
        </div>

        {!ignoreAreas && (filterInfo?.profile_defaults?.service_areas?.length ?? 0) > 0 && (
          <p className="text-[11px] text-slate-400">
            Saved areas: {filterInfo?.profile_defaults?.service_areas?.join(", ")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Apply filters"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            disabled={loading}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Reset to profile defaults
          </button>
          <Link href="/contractor/profile" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Edit profile defaults →
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter results by reference, postcode, service…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <p className="mb-4 text-xs text-slate-500">
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
        <div className="border-t border-slate-200 py-14 text-center">
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
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              Services &amp; contracts
            </Link>
            <Link
              href="/contractor/jobs"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              My work
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 border-t border-slate-200">
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
      className="inline-flex shrink-0 items-center gap-2 text-left text-xs text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-slate-300 bg-white text-transparent"
        }`}
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="whitespace-nowrap">{label}</span>
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
  const locationLabel = [job.postcode, job.city].filter(Boolean).join(" · ");
  const detailParts = [
    whenLabel,
    job.distance_miles != null ? `${job.distance_miles} mi away` : null,
    job.quantity != null ? `${job.quantity} rooms/units` : null,
    job.cleaning_type ? job.cleaning_type.replace(/_/g, " ") : null,
  ].filter(Boolean);

  return (
    <li className="py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">
            {job.reference}
            {job.distance_miles != null && ` · ${job.distance_miles} mi`}
          </p>

          <h3 className="mt-1 text-base font-semibold text-slate-900 hover:text-brand-700">
            {job.service_name}
          </h3>

          <p className="mt-1 text-xs text-slate-500">{detailParts.join(" · ")}</p>

          {job.notes && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{job.notes}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <MapPin className="h-3 w-3" />
              {locationLabel}
            </span>
            {needsService && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Service not linked
              </span>
            )}
            <a
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(job.postcode)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
            >
              Map <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {needsService && (
            <p className="mt-2 text-xs text-amber-800">
              Link <strong>{job.service_name}</strong> under Services &amp; contracts before you can bid.
            </p>
          )}
        </div>

        <div className="shrink-0 pt-1">
          {needsService ? (
            <Link
              href="/contractor/services"
              className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
            >
              Add service
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
            >
              {expanded ? "Close" : "Quote"}
            </button>
          )}
        </div>
      </div>

      {expanded && !needsService && (
        <form onSubmit={apply} className="mt-4 border-t border-slate-100 pt-4">
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
