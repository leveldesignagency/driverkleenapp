"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import {
  Loader2,
  MapPin,
  Navigation,
  Search,
  Briefcase,
  Send,
  CheckCircle2,
  ExternalLink,
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

type QrRow = {
  id: string;
  status: string;
  initiated_by?: string;
  deadline: string;
  message: string | null;
  sent_at: string;
  jobs: {
    id: string;
    reference: string;
    postcode: string;
    preferred_date: string;
    services?: { name: string } | { name: string }[] | null;
  } | {
    id: string;
    reference: string;
    postcode: string;
    preferred_date: string;
    services?: { name: string } | { name: string }[] | null;
  }[] | null;
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
  jobs: {
    id: string;
    reference: string;
    postcode: string;
    preferred_date?: string;
    status?: string;
    services?: { name: string } | { name: string }[] | null;
  } | {
    id: string;
    reference: string;
    postcode: string;
    preferred_date?: string;
    status?: string;
    services?: { name: string } | { name: string }[] | null;
  }[] | null;
};

type Tab = "browse" | "quotes" | "assigned";

export default function JobsDashboard() {
  const { operativeId, isVerified, refresh } = useContractorPortal();
  const [tab, setTab] = useState<Tab>("browse");
  const [browseJobs, setBrowseJobs] = useState<BrowseJob[]>([]);
  const [filterInfo, setFilterInfo] = useState<{ base_postcode: string | null; radius_miles: number } | null>(null);
  const [quotes, setQuotes] = useState<QrRow[]>([]);
  const [assigned, setAssigned] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

    // Prefer Assigned / My quotes when the contractor already has work
    setTab((current) => {
      if (current !== "browse") return current;
      if (mergedAssigned.length > 0) return "assigned";
      if (qrData.length > 0) return "quotes";
      return "browse";
    });
  }, [refresh]);

  const loadBrowse = useCallback(async () => {
    const res = await fetch("/api/contractor/jobs/browse", { credentials: "include" });
    const json = (await res.json()) as {
      jobs?: BrowseJob[];
      filter?: { base_postcode: string | null; radius_miles: number };
      error?: string;
    };
    if (res.ok) {
      setBrowseJobs(json.jobs || []);
      setFilterInfo(json.filter || null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const loads: Promise<void>[] = [loadQuotesAndAssigned()];
    if (isVerified && operativeId) loads.push(loadBrowse());
    Promise.all(loads).finally(() => setLoading(false));
  }, [isVerified, operativeId, loadBrowse, loadQuotesAndAssigned]);

  const filteredBrowse = browseJobs.filter((j) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      j.reference.toLowerCase().includes(q) ||
      j.postcode.toLowerCase().includes(q) ||
      j.service_name.toLowerCase().includes(q) ||
      (j.city || "").toLowerCase().includes(q)
    );
  });

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
        title="Jobs & quotes"
        description="Browse open jobs that match your services, track quotes you’ve submitted, and open assigned work."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["browse", "Browse jobs", browseJobs.length],
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

      {tab === "browse" && (
        <BrowseTab
          jobs={filteredBrowse}
          filterInfo={filterInfo}
          search={search}
          onSearch={setSearch}
          onApplied={() => {
            loadBrowse();
            loadQuotesAndAssigned();
            setTab("quotes");
          }}
        />
      )}

      {tab === "quotes" && <QuotesTab rows={quotes} onRefresh={loadQuotesAndAssigned} />}
      {tab === "assigned" && <AssignedTab rows={assigned} />}
    </div>
  );
}

function BrowseTab({
  jobs,
  filterInfo,
  search,
  onSearch,
  onApplied,
}: {
  jobs: BrowseJob[];
  filterInfo: { base_postcode: string | null; radius_miles: number } | null;
  search: string;
  onSearch: (v: string) => void;
  onApplied: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Local job filter</p>
            <p className="text-xs text-slate-500">
              {filterInfo?.base_postcode
                ? `Within ${filterInfo.radius_miles} miles of ${filterInfo.base_postcode}`
                : "Set your base postcode on Profile to filter by travel distance."}
            </p>
          </div>
        </div>
        <Link href="/contractor/profile" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Edit travel settings →
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by reference, postcode, service…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">No open jobs in your area</p>
          <p className="mt-1 text-sm text-slate-500">
            Check your service areas, travel radius, and linked services on your profile.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job) => (
            <BrowseJobCard key={job.id} job={job} onApplied={onApplied} />
          ))}
        </div>
      )}
    </div>
  );
}

function BrowseJobCard({ job, onApplied }: { job: BrowseJob; onApplied: () => void }) {
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
          <p className="text-sm text-brand-700">{job.service_name}</p>
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
          {new Date(job.preferred_date).toLocaleDateString("en-GB")} · {job.preferred_time?.slice(0, 5)}
        </span>
        {job.quantity != null && <span>{job.quantity} rooms/units</span>}
      </div>

      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        View on map <ExternalLink className="h-3 w-3" />
      </a>

      {job.notes && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{job.notes}</p>}

      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          Submit a quote
        </button>
      ) : (
        <form onSubmit={apply} className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="text-slate-500">Your price (£ ex VAT)</span>
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
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Submitting…" : "Apply & send quote"}
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

function QuotesTab({ rows, onRefresh }: { rows: QrRow[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      {rows.map((qr) => {
        const job = Array.isArray(qr.jobs) ? qr.jobs[0] : qr.jobs;
        const svc = job?.services;
        const svcName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
        const resp = Array.isArray(qr.quote_responses) ? qr.quote_responses[0] : qr.quote_responses;
        const isSelfApply = qr.initiated_by === "contractor";
        return (
          <div key={qr.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{job?.reference || "Job"}</p>
                <p className="text-sm text-slate-600">
                  {svcName || "Service"} · {job?.postcode}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isSelfApply && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                    You applied
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                  {qr.status.replace(/_/g, " ")}
                </span>
              </div>
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
            {!resp && (
              <InviteQuoteForm quoteRequestId={qr.id} jobServiceId={undefined} onDone={onRefresh} />
            )}
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          No quotes yet — use Browse jobs to find work that matches your services, or wait for Kleen to add you to a job.
        </p>
      )}
    </div>
  );
}

function AssignedTab({ rows }: { rows: AssignmentRow[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map((a) => {
        const job = Array.isArray(a.jobs) ? a.jobs[0] : a.jobs;
        const svc = job?.services;
        const svcName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
        return (
          <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-semibold text-slate-900">{job?.reference || "Assigned job"}</p>
            <p className="text-sm text-slate-600">
              {svcName || "Service"} · {job?.postcode}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Assigned {new Date(a.assigned_at).toLocaleString("en-GB")}
            </p>
            {job?.id && (
              <Link
                href={`/contractor/jobs/${job.id}`}
                className="mt-4 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
              >
                Open job
              </Link>
            )}
          </div>
        );
      })}
      {rows.length === 0 && (
        <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center text-sm text-slate-500">
          No assigned jobs yet. When Kleen assigns you (or a customer accepts your quote), work appears here.
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
      const { data: { user } } = await supabase.auth.getUser();
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
    const { data: qr } = await supabase.from("quote_requests").select("job_id, jobs(service_id)").eq("id", quoteRequestId).single();
    const jobRow = qr?.jobs as { service_id?: string } | { service_id?: string }[] | null;
    const sid = jobServiceId || (Array.isArray(jobRow) ? jobRow[0]?.service_id : jobRow?.service_id);
    if (!operativeServiceId && sid) {
      const { data: { user } } = await supabase.auth.getUser();
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
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
      <p className="text-sm font-medium text-slate-800">Kleen invited you — submit your quote</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Price (£)
          <input type="number" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs">
          Est. hours
          <input type="number" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs sm:col-span-2">
          Earliest date
          <input type="date" value={avail} onChange={(e) => setAvail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs sm:col-span-2">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Submitting…" : "Submit quote"}
      </button>
    </form>
  );
}
