"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import {
  Loader2,
  Search,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

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

type Tab = "quotes" | "assigned";

export default function JobsDashboard() {
  const { refresh } = useContractorPortal();
  const [tab, setTab] = useState<Tab>("quotes");
  const [quotes, setQuotes] = useState<QrRow[]>([]);
  const [assigned, setAssigned] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

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

      <div className="mb-6 flex flex-wrap gap-2">
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

      {tab === "quotes" && <QuotesTab rows={quotes} onRefresh={loadQuotesAndAssigned} />}
      {tab === "assigned" && <AssignedTab rows={assigned} />}
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

function QuotesTab({ rows, onRefresh }: { rows: QrRow[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      {rows.map((qr) => {
        const job = Array.isArray(qr.jobs) ? qr.jobs[0] : qr.jobs;
        const svc = job?.services;
        const svcName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
        const resp = Array.isArray(qr.quote_responses) ? qr.quote_responses[0] : qr.quote_responses;
        const isSelfApply = qr.initiated_by === "contractor";
        const onThisJob = Boolean(resp) && (isSelfApply || qr.initiated_by === "admin" || !qr.initiated_by);
        return (
          <div key={qr.id} className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
            {job?.id ? (
              <Link
                href={`/contractor/jobs/${job.id}`}
                className="block rounded-t-2xl p-5 transition hover:bg-slate-50/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{job.reference || "Job"}</p>
                    <p className="text-sm text-slate-600">
                      {svcName || "Service"} · {job.postcode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onThisJob && (
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                        {isSelfApply ? "You applied" : "On this job"}
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
                <div className="mt-4 flex justify-end">
                  <ViewJobDetailsLink />
                </div>
              </Link>
            ) : (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{job?.reference || "Job"}</p>
                    <p className="text-sm text-slate-600">
                      {svcName || "Service"} · {job?.postcode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {onThisJob && (
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800">
                        {isSelfApply ? "You applied" : "On this job"}
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
          No quotes yet — use <Link href="/contractor/find" className="font-semibold text-brand-600 hover:underline">Find a Job</Link> to apply, or wait for Kleen to add you to a job.
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
        if (!job?.id) return null;
        return (
          <Link
            key={a.id}
            href={`/contractor/jobs/${job.id}`}
            className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:bg-slate-50/50 hover:shadow-md"
          >
            <p className="font-semibold text-slate-900">{job?.reference || "Assigned job"}</p>
            <p className="text-sm text-slate-600">
              {svcName || "Service"} · {job?.postcode}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Assigned {new Date(a.assigned_at).toLocaleString("en-GB")}
            </p>
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
