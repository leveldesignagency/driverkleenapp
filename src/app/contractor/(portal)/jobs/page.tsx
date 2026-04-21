"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { Loader2 } from "lucide-react";

type JobNested = {
  id: string;
  reference: string;
  status: string;
  postcode: string;
  preferred_date: string;
  address_line_1: string;
  city: string | null;
  service_id: string;
  services?: { name: string } | { name: string }[] | null;
};

type QrRow = {
  id: string;
  status: string;
  deadline: string;
  message: string | null;
  sent_at: string;
  jobs: JobNested | JobNested[] | null;
  quote_responses:
    | {
        id: string;
        price_pence: number;
        customer_price_pence: number | null;
        estimated_hours: number | null;
        sent_to_customer_at: string | null;
        available_date: string | null;
        notes: string | null;
      }
    | {
        id: string;
        price_pence: number;
        customer_price_pence: number | null;
        estimated_hours: number | null;
        sent_to_customer_at: string | null;
        available_date: string | null;
        notes: string | null;
      }[]
    | null;
};

type AssignmentRow = {
  id: string;
  assigned_at: string;
  completed_at: string | null;
  jobs: JobNested | JobNested[] | null;
};

export default function ContractorJobsPage() {
  const router = useRouter();
  const { operativeId, isVerified } = useContractorPortal();
  const [rows, setRows] = useState<QrRow[]>([]);
  const [assignedRows, setAssignedRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!operativeId || !isVerified) return;
    const supabase = createClient();
    const [{ data, error }, { data: assignments, error: assignErr }] = await Promise.all([
      supabase
        .from("quote_requests")
        .select(
          `
            id, status, deadline, message, sent_at, viewed_at, responded_at,
            jobs (
              id, reference, status, postcode, preferred_date, address_line_1, city, service_id,
              services ( name )
            ),
            quote_responses (
              id, price_pence, customer_price_pence, estimated_hours, sent_to_customer_at, available_date, notes
            )
          `
        )
        .eq("operative_id", operativeId)
        .order("sent_at", { ascending: false }),
      supabase
        .from("job_assignments")
        .select(
          `
            id, assigned_at, completed_at,
            jobs (
              id, reference, status, postcode, preferred_date, address_line_1, city, service_id,
              services ( name )
            )
          `
        )
        .eq("operative_id", operativeId)
        .order("assigned_at", { ascending: false }),
    ]);

    if (error) console.error(error);
    if (assignErr) console.error(assignErr);
    setRows((data as unknown as QrRow[]) || []);
    setAssignedRows((assignments as unknown as AssignmentRow[]) || []);
    setLoading(false);
  }, [operativeId, isVerified]);

  useEffect(() => {
    if (!isVerified) {
      router.replace("/contractor");
    }
  }, [isVerified, router]);

  useEffect(() => {
    if (!isVerified) return;
    setLoading(true);
    load();
  }, [load, isVerified]);

  if (!isVerified) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Jobs &amp; quotes</h1>
      <p className="mt-1 text-sm text-slate-600">
        Quote invitations from Kleen and the status of each job on the platform.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Assigned jobs</h2>
      <p className="mt-1 text-sm text-slate-600">
        Jobs accepted and assigned to you. Open a job to complete pre-job inspection, evidence, and completion reports.
      </p>
      <ul className="mt-4 space-y-4">
        {assignedRows.map((a) => {
          const job = Array.isArray(a.jobs) ? a.jobs[0] : a.jobs;
          const svcRel = job?.services;
          const svcName = Array.isArray(svcRel) ? svcRel[0]?.name : svcRel?.name;
          return (
            <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{job?.reference || "Assigned job"}</p>
                  <p className="text-sm text-slate-600">
                    {svcName || "Service"} · {job?.postcode || "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Assigned {new Date(a.assigned_at).toLocaleString("en-GB")}
                    {a.completed_at ? ` · Completed ${new Date(a.completed_at).toLocaleString("en-GB")}` : ""}
                  </p>
                </div>
                {job?.id && (
                  <Link
                    href={`/contractor/jobs/${job.id}`}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"
                  >
                    Open job layout
                  </Link>
                )}
              </div>
            </li>
          );
        })}
        {assignedRows.length === 0 && <li className="text-sm text-slate-500">No accepted jobs assigned yet.</li>}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">Quote invitations</h2>
      <ul className="mt-4 space-y-4">
        {rows.map((qr) => {
          const job = Array.isArray(qr.jobs) ? qr.jobs[0] : qr.jobs;
          const svcRel = job?.services;
          const svcName = Array.isArray(svcRel) ? svcRel[0]?.name : svcRel?.name;
          const respRaw = qr.quote_responses;
          const resp = Array.isArray(respRaw) ? respRaw[0] : respRaw;
          return (
            <li key={qr.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{job?.reference || "Job"}</p>
                  <p className="text-sm text-slate-600">
                    {svcName || "Service"} · {job?.postcode}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                  {qr.status.replace(/_/g, " ")}
                </span>
              </div>
              {job && (
                <p className="mt-2 text-xs text-slate-500">
                  {job.address_line_1}
                  {job.city ? `, ${job.city}` : ""} · Preferred {new Date(job.preferred_date).toLocaleDateString("en-GB")}
                </p>
              )}
              {qr.message && <p className="mt-2 text-sm text-slate-700">{qr.message}</p>}
              {resp ? (
                <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <p>
                    <span className="font-medium">Your quote:</span> £{(resp.price_pence / 100).toFixed(2)}
                    {resp.customer_price_pence != null && (
                      <>
                        {" "}
                        → customer £{(resp.customer_price_pence / 100).toFixed(2)}
                      </>
                    )}
                  </p>
                  {resp.estimated_hours != null && <p>Est. hours: {resp.estimated_hours}</p>}
                  {resp.sent_to_customer_at && (
                    <p className="text-xs text-emerald-700">Sent to customer {new Date(resp.sent_to_customer_at).toLocaleString("en-GB")}</p>
                  )}
                </div>
              ) : (
                <SubmitQuoteForm
                  quoteRequestId={qr.id}
                  jobServiceId={job?.service_id}
                  onDone={load}
                />
              )}
            </li>
          );
        })}
        {rows.length === 0 && <li className="text-sm text-slate-500">No job invitations yet.</li>}
      </ul>
    </div>
  );
}

function SubmitQuoteForm({
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
    if (!Number.isFinite(pounds) || pounds <= 0) {
      alert("Enter a valid price (£)");
      return;
    }
    const pence = Math.round(pounds * 100);
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

    if (!operativeServiceId) {
      alert(
        "Link this job’s service under Services & contracts first, then submit your quote (the job’s service must match one of your linked services)."
      );
      setBusy(false);
      return;
    }

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
      <p className="text-sm font-medium text-slate-800">Submit your quote</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="text-slate-500">Your price (£ ex VAT)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
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
          <span className="text-slate-500">Earliest date you can attend</span>
          <input
            type="date"
            value={avail}
            onChange={(e) => setAvail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="text-slate-500">Notes for Kleen / customer</span>
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
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit quote"}
      </button>
    </form>
  );
}
