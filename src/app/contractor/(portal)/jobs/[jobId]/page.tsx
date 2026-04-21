"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { JobEvidenceMedia } from "@/components/contractor/JobEvidenceMedia";
import { Loader2 } from "lucide-react";

type ReportStage = "pre_job" | "post_job" | "cannot_start";
type Outcome = "in_progress" | "completed" | "not_completed";

type JobRow = {
  id: string;
  reference: string;
  status: string;
  address_line_1: string;
  city: string | null;
  postcode: string;
  preferred_date: string;
  user_id: string;
  operative_en_route_at: string | null;
  operative_arrived_at: string | null;
  operative_marked_complete_at: string | null;
  operative_marked_incomplete_at: string | null;
};

type ReportItem = {
  id: string;
  item_type: string;
  note: string;
  photo_urls: string[];
  created_at: string;
};

type ReportRow = {
  id: string;
  stage: ReportStage;
  job_outcome: Outcome | null;
  summary: string | null;
  submitted_at: string;
  job_report_items: ReportItem[] | null;
};

const STAGE_OPTIONS = [
  { value: "pre_job", label: "Pre-job inspection" },
  { value: "post_job", label: "Post-job report" },
  { value: "cannot_start", label: "Could not start job" },
];

const ITEM_TYPE_OPTIONS = [
  { value: "damage", label: "Damage (pre-existing)" },
  { value: "obstruction", label: "Obstruction / access issue" },
  { value: "note", label: "General note" },
  { value: "completion_note", label: "Completion note" },
];

const OUTCOME_OPTIONS = [
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "not_completed", label: "Not completed" },
];

export default function ContractorJobLayoutPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;
  const router = useRouter();
  const { operativeId, isVerified } = useContractorPortal();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobRow | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [stage, setStage] = useState<ReportStage>("pre_job");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("in_progress");
  const [itemType, setItemType] = useState("damage");
  const [note, setNote] = useState("");
  const [photoUrlsRaw, setPhotoUrlsRaw] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fieldAction, setFieldAction] = useState<string | null>(null);
  const [customerRating, setCustomerRating] = useState(5);
  const [customerComment, setCustomerComment] = useState("");
  const [savingCustomerRating, setSavingCustomerRating] = useState(false);
  const [hasCustomerRating, setHasCustomerRating] = useState(false);

  const reportByStage = useMemo(
    () => ({
      pre_job: reports.find((r) => r.stage === "pre_job"),
      post_job: reports.find((r) => r.stage === "post_job"),
      cannot_start: reports.find((r) => r.stage === "cannot_start"),
    }),
    [reports]
  );

  const load = useCallback(async () => {
    if (!jobId || !operativeId || !isVerified) return;
    const supabase = createClient();

    const { data: assignment, error: assignErr } = await supabase
      .from("job_assignments")
      .select("job_id")
      .eq("job_id", jobId)
      .eq("operative_id", operativeId)
      .maybeSingle();
    if (assignErr || !assignment) {
      router.replace("/contractor/jobs");
      return;
    }

    const [{ data: jobData }, { data: reportData }, { data: ratingRow }] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, reference, status, user_id, address_line_1, city, postcode, preferred_date, operative_en_route_at, operative_arrived_at, operative_marked_complete_at, operative_marked_incomplete_at"
        )
        .eq("id", jobId)
        .single(),
      supabase
        .from("job_reports")
        .select("id, stage, job_outcome, summary, submitted_at, job_report_items(id, item_type, note, photo_urls, created_at)")
        .eq("job_id", jobId)
        .eq("operative_id", operativeId)
        .order("submitted_at", { ascending: false }),
      supabase.from("job_customer_ratings").select("id").eq("job_id", jobId).maybeSingle(),
    ]);

    setJob((jobData as JobRow) || null);
    setReports((reportData as unknown as ReportRow[]) || []);
    setHasCustomerRating(!!ratingRow);
    setLoading(false);
  }, [jobId, operativeId, isVerified, router]);

  useEffect(() => {
    if (!isVerified) router.replace("/contractor");
  }, [isVerified, router]);

  useEffect(() => {
    if (!isVerified) return;
    setLoading(true);
    load();
  }, [load, isVerified]);

  const saveReport = async () => {
    if (!jobId || !operativeId) return;
    setSavingReport(true);
    const supabase = createClient();
    const payload = {
      job_id: jobId,
      operative_id: operativeId,
      stage,
      summary: summary.trim() || null,
      job_outcome: stage === "pre_job" ? "in_progress" : outcome,
      submitted_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("job_reports")
      .upsert(payload, { onConflict: "job_id,operative_id,stage" });
    setSavingReport(false);
    if (error) {
      alert(error.message);
      return;
    }
    await load();
  };

  const addItem = async () => {
    if (!note.trim() || !jobId || !operativeId) return;
    setSavingItem(true);
    const supabase = createClient();
    const existing = reportByStage[stage];
    let reportId = existing?.id || null;
    if (!reportId) {
      const { data: created, error: createErr } = await supabase
        .from("job_reports")
        .insert({
          job_id: jobId,
          operative_id: operativeId,
          stage,
          job_outcome: stage === "pre_job" ? "in_progress" : outcome,
          summary: summary.trim() || null,
        })
        .select("id")
        .single();
      if (createErr || !created) {
        setSavingItem(false);
        alert(createErr?.message || "Could not create report");
        return;
      }
      reportId = created.id;
    }
    const photo_urls: string[] = photoUrlsRaw
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const file of pendingFiles) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/contractor/jobs/${jobId}/evidence/upload`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; path?: string };
      if (!res.ok) {
        setSavingItem(false);
        alert(json.error || "Upload failed");
        return;
      }
      if (json.path) photo_urls.push(json.path);
    }
    const { error } = await supabase.from("job_report_items").insert({
      report_id: reportId,
      item_type: itemType,
      note: note.trim(),
      photo_urls,
    });
    setSavingItem(false);
    if (error) {
      alert(error.message);
      return;
    }
    setNote("");
    setPhotoUrlsRaw("");
    setPendingFiles([]);
    await load();
  };

  const runField = async (action: "en_route" | "arrived" | "complete") => {
    if (!jobId) return;
    setFieldAction(action);
    const res = await fetch(`/api/contractor/jobs/${jobId}/field`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setFieldAction(null);
    if (!res.ok) {
      alert(json.error || "Could not update job");
      return;
    }
    await load();
  };

  const submitCustomerRating = async () => {
    if (!jobId || !operativeId || !job?.user_id) return;
    setSavingCustomerRating(true);
    const supabase = createClient();
    const { error } = await supabase.from("job_customer_ratings").insert({
      job_id: jobId,
      operative_id: operativeId,
      customer_user_id: job.user_id,
      rating: customerRating,
      comment: customerComment.trim() || null,
    });
    setSavingCustomerRating(false);
    if (error) {
      alert(error.message);
      return;
    }
    setHasCustomerRating(true);
  };

  const liveStatuses = ["customer_accepted", "accepted", "awaiting_completion", "in_progress", "pending_confirmation"];
  const showLive =
    job && liveStatuses.includes(job.status) && !job.operative_marked_complete_at && !job.operative_marked_incomplete_at;
  const showRateCustomer =
    job && ["completed", "funds_released"].includes(job.status) && !hasCustomerRating;

  if (!isVerified || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contractor/jobs" className="text-xs font-medium text-brand-600 hover:underline">
          Back to jobs
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Job layout</h1>
        <p className="mt-1 text-sm text-slate-600">
          {job.reference} · {job.address_line_1}
          {job.city ? `, ${job.city}` : ""} · {job.postcode}
        </p>
      </div>

      {showLive && (
        <section className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-cyan-900">Live job</h2>
          <p className="mt-1 text-xs text-cyan-800/90">
            The customer is notified when you&apos;re on the way. Mark arrived before completing the job.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!job.operative_en_route_at || fieldAction === "en_route"}
              onClick={() => runField("en_route")}
              className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fieldAction === "en_route" ? "Updating…" : "On my way"}
            </button>
            <button
              type="button"
              disabled={!job.operative_en_route_at || !!job.operative_arrived_at || fieldAction === "arrived"}
              onClick={() => runField("arrived")}
              className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fieldAction === "arrived" ? "Updating…" : "Arrived"}
            </button>
            <button
              type="button"
              disabled={!job.operative_arrived_at || fieldAction === "complete"}
              onClick={() => runField("complete")}
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fieldAction === "complete" ? "Updating…" : "Mark job complete"}
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-cyan-900/80">
            {job.operative_en_route_at && (
              <li>On route: {new Date(job.operative_en_route_at).toLocaleString("en-GB")}</li>
            )}
            {job.operative_arrived_at && (
              <li>Arrived: {new Date(job.operative_arrived_at).toLocaleString("en-GB")}</li>
            )}
          </ul>
        </section>
      )}

      {/* Could not complete — keep simple; use portal token flow or admin for disputed */}
      {showRateCustomer && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Rate this customer</h2>
          <p className="mt-1 text-xs text-slate-500">
            Helps Kleen spot unfair behaviour. One rating per job.
          </p>
          <label className="mt-3 block text-xs text-slate-500">
            Score (1–5)
            <select
              value={customerRating}
              onChange={(e) => setCustomerRating(Number(e.target.value))}
              className="input-field mt-1"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs text-slate-500">
            Comment (optional)
            <textarea
              value={customerComment}
              onChange={(e) => setCustomerComment(e.target.value)}
              rows={2}
              className="input-field mt-1"
            />
          </label>
          <button
            type="button"
            disabled={savingCustomerRating}
            onClick={submitCustomerRating}
            className="btn-primary mt-3"
          >
            {savingCustomerRating ? "Saving…" : "Submit rating"}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Create / update report</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Report stage</label>
            <CustomDropdown
              className="mt-1"
              value={stage}
              onChange={(v) => setStage(v as ReportStage)}
              options={STAGE_OPTIONS}
            />
          </div>
          {stage !== "pre_job" && (
            <div>
              <label className="text-xs text-slate-500">Job outcome</label>
              <CustomDropdown
                className="mt-1"
                value={outcome}
                onChange={(v) => setOutcome(v as Outcome)}
                options={OUTCOME_OPTIONS}
              />
            </div>
          )}
        </div>
        <label className="mt-3 block text-xs text-slate-500">
          Summary for this stage
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="input-field mt-1"
            placeholder="Short summary of findings / work outcome"
          />
        </label>
        <button
          type="button"
          disabled={savingReport}
          onClick={saveReport}
          className="btn-primary mt-3"
        >
          {savingReport ? "Saving…" : "Save report stage"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add evidence note</h2>
        <p className="mt-1 text-xs text-slate-500">
          Upload photos or short videos (stored securely in Kleen), or paste external URLs. Evidence supports dispute review.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-slate-500">Evidence type</label>
            <CustomDropdown className="mt-1" value={itemType} onChange={setItemType} options={ITEM_TYPE_OPTIONS} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Linked stage</label>
            <CustomDropdown className="mt-1" value={stage} onChange={(v) => setStage(v as ReportStage)} options={STAGE_OPTIONS} />
          </div>
        </div>
        <label className="mt-3 block text-xs text-slate-500">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="input-field mt-1"
            placeholder="What did you find before starting, or what prevented completion?"
          />
        </label>
        <div className="mt-3">
          <label className="text-xs text-slate-500">Upload images or video (max ~50MB each)</label>
          <input
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            multiple
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-700"
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length) return;
              setPendingFiles((prev) => [...prev, ...Array.from(list)]);
              e.target.value = "";
            }}
          />
          {pendingFiles.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {pendingFiles.length} file(s) will upload when you add evidence.
            </p>
          )}
        </div>
        <label className="mt-3 block text-xs text-slate-500">
          Extra URLs (one per line, optional)
          <textarea
            value={photoUrlsRaw}
            onChange={(e) => setPhotoUrlsRaw(e.target.value)}
            rows={2}
            className="input-field mt-1"
            placeholder="https://..."
          />
        </label>
        <button type="button" disabled={savingItem || !note.trim()} onClick={addItem} className="btn-primary mt-3">
          {savingItem ? "Uploading…" : "Add evidence"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Report timeline</h2>
        <ul className="mt-3 space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-900">
                {STAGE_OPTIONS.find((o) => o.value === r.stage)?.label || r.stage}
                {r.job_outcome ? ` · ${r.job_outcome.replace("_", " ")}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString("en-GB")}</p>
              {r.summary && <p className="mt-2 text-sm text-slate-700">{r.summary}</p>}
              <ul className="mt-2 space-y-2">
                {(r.job_report_items || []).map((i) => (
                  <li key={i.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                    <p className="font-medium text-slate-800">{i.item_type.replace("_", " ")}</p>
                    <p className="mt-1 text-slate-700">{i.note}</p>
                    {i.photo_urls?.length > 0 && (
                      <div className="mt-2 flex flex-col gap-2">
                        {i.photo_urls.map((u) => (
                          <div key={u} className="rounded-lg border border-slate-100 bg-white p-2">
                            {u.startsWith("http") ? (
                              <a href={u} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline break-all">
                                {u}
                              </a>
                            ) : (
                              <JobEvidenceMedia pathOrUrl={u} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {reports.length === 0 && <li className="text-sm text-slate-500">No reports yet.</li>}
        </ul>
      </section>
    </div>
  );
}
