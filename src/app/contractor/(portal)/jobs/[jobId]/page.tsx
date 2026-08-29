"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { JobEvidenceMedia } from "@/components/contractor/JobEvidenceMedia";
import {
  checklistForStage,
  checklistProgress,
  emptyChecklist,
  isChecklistComplete,
  parseChecklist,
  type ChecklistState,
  type ReportStage,
} from "@/lib/job-inspection-checklist";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  MapPin,
  Navigation,
  AlertTriangle,
  Truck,
} from "lucide-react";

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
  checklist: ChecklistState | Record<string, unknown> | null;
  submitted_at: string;
  job_report_items: ReportItem[] | null;
};

const STAGE_TABS: { value: ReportStage; label: string; short: string }[] = [
  { value: "pre_job", label: "Before you start", short: "Before" },
  { value: "post_job", label: "After the job", short: "After" },
  { value: "cannot_start", label: "Couldn’t start", short: "Blocked" },
];

const ITEM_TYPE_OPTIONS = [
  { value: "damage", label: "Pre-existing damage" },
  { value: "obstruction", label: "Obstruction / access" },
  { value: "note", label: "General note" },
  { value: "completion_note", label: "Completion note" },
];

const OUTCOME_OPTIONS = [
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "not_completed", label: "Not completed" },
];

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
      {children}
    </h2>
  );
}

function CustomCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
        checked
          ? "border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/25"
          : "border-slate-300 bg-white text-transparent"
      }`}
      aria-hidden
    >
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}

export default function ContractorJobLayoutPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;
  const router = useRouter();
  const { operativeId, isVerified } = useContractorPortal();
  const cancelRef = useRef<HTMLElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobRow | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [savingReport, setSavingReport] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [stage, setStage] = useState<ReportStage>("pre_job");
  const stageRef = useRef<ReportStage>("pre_job");
  stageRef.current = stage;
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("in_progress");
  const [checklist, setChecklist] = useState<ChecklistState>(() => emptyChecklist("pre_job"));
  const [itemType, setItemType] = useState("damage");
  const [note, setNote] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fieldAction, setFieldAction] = useState<string | null>(null);
  const [customerRating, setCustomerRating] = useState(5);
  const [customerComment, setCustomerComment] = useState("");
  const [savingCustomerRating, setSavingCustomerRating] = useState(false);
  const [hasCustomerRating, setHasCustomerRating] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelPreview, setCancelPreview] = useState<{
    penaltyPence: number;
    isLateCancel: boolean;
    hoursUntilStart: number | null;
  } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const reportByStage = useMemo(
    () => ({
      pre_job: reports.find((r) => r.stage === "pre_job"),
      post_job: reports.find((r) => r.stage === "post_job"),
      cannot_start: reports.find((r) => r.stage === "cannot_start"),
    }),
    [reports],
  );

  const liveStatuses = ["customer_accepted", "accepted", "awaiting_completion", "in_progress", "pending_confirmation"];
  const showLive =
    job && liveStatuses.includes(job.status) && !job.operative_marked_complete_at && !job.operative_marked_incomplete_at;
  const showRateCustomer =
    job && ["completed", "funds_released"].includes(job.status) && !hasCustomerRating;

  const preDone = isChecklistComplete(
    parseChecklist(reportByStage.pre_job?.checklist, "pre_job"),
    "pre_job",
  );
  const postDone = isChecklistComplete(
    parseChecklist(reportByStage.post_job?.checklist, "post_job"),
    "post_job",
  );
  const stageProgress = checklistProgress(checklist, stage);
  const stageComplete = isChecklistComplete(checklist, stage);

  const hydrateStage = useCallback(
    (next: ReportStage, list: ReportRow[]) => {
      const existing = list.find((r) => r.stage === next);
      setStage(next);
      setSummary(existing?.summary || "");
      setOutcome((existing?.job_outcome as Outcome) || (next === "pre_job" ? "in_progress" : "completed"));
      setChecklist(parseChecklist(existing?.checklist, next));
      setItemType(next === "post_job" ? "completion_note" : next === "cannot_start" ? "obstruction" : "damage");
    },
    [],
  );

  const load = useCallback(async (): Promise<ReportRow[]> => {
    if (!jobId || !operativeId || !isVerified) return [];
    const supabase = createClient();

    const { data: assignment, error: assignErr } = await supabase
      .from("job_assignments")
      .select("job_id")
      .eq("job_id", jobId)
      .eq("operative_id", operativeId)
      .maybeSingle();

    let hasAccess = !assignErr && !!assignment;
    if (!hasAccess) {
      const { data: jobGate } = await supabase
        .from("jobs")
        .select("accepted_quote_request_id")
        .eq("id", jobId)
        .maybeSingle();
      const acceptedQrId = jobGate?.accepted_quote_request_id as string | null | undefined;
      if (acceptedQrId) {
        const { data: qr } = await supabase
          .from("quote_requests")
          .select("id")
          .eq("id", acceptedQrId)
          .eq("operative_id", operativeId)
          .maybeSingle();
        hasAccess = !!qr;
      }
    }

    if (!hasAccess) {
      const { data: qrAccess } = await supabase
        .from("quote_requests")
        .select("id")
        .eq("job_id", jobId)
        .eq("operative_id", operativeId)
        .maybeSingle();
      hasAccess = !!qrAccess;
    }

    if (!hasAccess) {
      router.replace("/contractor/jobs");
      return [];
    }

    const [{ data: jobData }, { data: reportData }, { data: ratingRow }] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, reference, status, user_id, address_line_1, city, postcode, preferred_date, operative_en_route_at, operative_arrived_at, operative_marked_complete_at, operative_marked_incomplete_at",
        )
        .eq("id", jobId)
        .single(),
      supabase
        .from("job_reports")
        .select(
          "id, stage, job_outcome, summary, checklist, submitted_at, job_report_items(id, item_type, note, photo_urls, created_at)",
        )
        .eq("job_id", jobId)
        .eq("operative_id", operativeId)
        .order("submitted_at", { ascending: false }),
      supabase.from("job_customer_ratings").select("id").eq("job_id", jobId).maybeSingle(),
    ]);

    const nextReports = (reportData as unknown as ReportRow[]) || [];
    setJob((jobData as JobRow) || null);
    setReports(nextReports);
    setHasCustomerRating(!!ratingRow);
    setLoading(false);
    return nextReports;
  }, [jobId, operativeId, isVerified, router]);

  useEffect(() => {
    if (!isVerified) router.replace("/contractor");
  }, [isVerified, router]);

  useEffect(() => {
    if (!isVerified) return;
    setLoading(true);
    load().then((rows) => hydrateStage(stageRef.current, rows));
  }, [load, isVerified, hydrateStage]);

  useEffect(() => {
    if (!jobId || !showLive) return;
    fetch(`/api/contractor/jobs/${jobId}/cancel`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (json.penaltyPence != null) {
          setCancelPreview({
            penaltyPence: json.penaltyPence,
            isLateCancel: json.isLateCancel,
            hoursUntilStart: json.hoursUntilStart,
          });
        }
      })
      .catch(() => {});
  }, [jobId, showLive]);

  const selectStage = (next: ReportStage) => {
    hydrateStage(next, reports);
  };

  const toggleCheck = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveReport = async () => {
    if (!jobId || !operativeId) return;
    if (!stageComplete) {
      alert("Complete every checklist item for this stage before saving.");
      return;
    }
    setSavingReport(true);
    const supabase = createClient();
    const payload = {
      job_id: jobId,
      operative_id: operativeId,
      stage,
      summary: summary.trim() || null,
      job_outcome: stage === "pre_job" ? "in_progress" : outcome,
      checklist,
      submitted_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("job_reports").upsert(payload, { onConflict: "job_id,operative_id,stage" });
    setSavingReport(false);
    if (error) {
      alert(
        error.message.includes("checklist")
          ? "Checklist column not available yet — ask Kleen to apply the latest database migration."
          : error.message,
      );
      return;
    }
    await load().then((rows) => hydrateStage(stage, rows));
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
          checklist,
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
    const photo_urls: string[] = [];
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
    setPendingFiles([]);
    await load().then((rows) => hydrateStage(stage, rows));
  };

  const runField = async (action: "en_route" | "arrived" | "complete") => {
    if (!jobId) return;
    if (action === "complete" && (!preDone || !postDone)) {
      alert(
        !preDone
          ? "Finish and save the “Before you start” checklist before completing."
          : "Finish and save the “After the job” checklist before completing.",
      );
      if (!preDone) selectStage("pre_job");
      else selectStage("post_job");
      return;
    }
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

  const submitCancel = async (confirmLatePenalty = false) => {
    if (!jobId || !cancelReason.trim()) return;
    setCancelLoading(true);
    const res = await fetch(`/api/contractor/jobs/${jobId}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason.trim(), confirmLatePenalty }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      requiresConfirmation?: boolean;
      penaltyPence?: number;
    };
    setCancelLoading(false);

    if (res.status === 409 && json.requiresConfirmation) {
      setShowCancelConfirm(true);
      return;
    }
    if (!res.ok) {
      alert(json.error || "Could not cancel job");
      return;
    }
    router.replace("/contractor/schedule");
  };

  const scrollToCancel = () => {
    cancelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!isVerified || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!job) return null;

  const addressLine = `${job.address_line_1}${job.city ? `, ${job.city}` : ""} · ${job.postcode}`;
  const stageItems = checklistForStage(stage);
  const currentStageEvidence = reportByStage[stage]?.job_report_items || [];

  const progressSteps = [
    {
      key: "booked",
      label: "Booked",
      done: true,
      active: !job.operative_en_route_at,
      icon: "check" as const,
    },
    {
      key: "en_route",
      label: "On the way",
      done: !!job.operative_en_route_at,
      active: !!job.operative_en_route_at && !job.operative_arrived_at,
      icon: "truck" as const,
    },
    {
      key: "arrived",
      label: "Arrived",
      done: !!job.operative_arrived_at,
      active: !!job.operative_arrived_at,
      icon: "pin" as const,
    },
    {
      key: "complete",
      label: "Complete",
      done: false,
      active: false,
      icon: "check" as const,
    },
  ];
  const progressActiveIndex = progressSteps.findIndex((s) => s.active);
  const progressFillIndex = progressActiveIndex >= 0 ? progressActiveIndex : progressSteps.filter((s) => s.done).length - 1;
  const progressFillPct = Math.max(0, Math.min(100, (progressFillIndex / (progressSteps.length - 1)) * 100));
  const statusLabel = !job.operative_en_route_at
    ? "Booked"
    : !job.operative_arrived_at
      ? "On the way"
      : "On site";
  const scheduledLabel = job.preferred_date
    ? new Date(job.preferred_date + (job.preferred_date.length === 10 ? "T12:00:00" : "")).toLocaleDateString(
        "en-GB",
        { weekday: "short", day: "numeric", month: "short", year: "numeric" },
      )
    : "—";

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/contractor/jobs"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to My work
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{job.reference}</h1>
          <p className="mt-1 break-words text-sm text-slate-600">{addressLine}</p>
          <p className="mt-1 text-xs text-slate-500">Scheduled {scheduledLabel}</p>
        </div>
        {showLive && (
          <button
            type="button"
            onClick={scrollToCancel}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Live status — marketing hero window chrome */}
      {showLive && (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <SectionTitle>On-site progress</SectionTitle>
              <p className="mt-1 text-sm text-slate-600">
                Update the customer as you go. Complete both due-diligence checklists before marking the job done.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-white/80 sm:rounded-[1.5rem]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
              <span className="ml-3 truncate text-xs font-medium text-slate-400">
                contractor.kleenapp.co.uk · {job.reference}
              </span>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Live job</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{job.reference}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {job.postcode}
                      {job.preferred_date ? ` · ${scheduledLabel}` : ""}
                    </span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                  {statusLabel}
                </span>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70 sm:p-5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Progress</span>
                  <span className="text-brand-600">
                    Step {Math.min(progressFillIndex + 1, progressSteps.length)} of {progressSteps.length}
                  </span>
                </div>
                <div className="relative mt-5 w-full pt-1">
                  <div
                    className="absolute top-[1.125rem] h-1 rounded-full bg-slate-200"
                    style={{ left: "12.5%", right: "12.5%" }}
                    aria-hidden
                  />
                  <div
                    className="absolute top-[1.125rem] h-1 rounded-full bg-brand-400 transition-all duration-500"
                    style={{ left: "12.5%", width: `${progressFillPct * 0.75}%` }}
                    aria-hidden
                  />
                  <ol className="relative grid w-full grid-cols-4">
                    {progressSteps.map((step, i) => (
                      <li key={step.key} className="flex flex-col items-center gap-2.5">
                        <div
                          className={[
                            "relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                            step.done
                              ? step.active
                                ? "bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-4 ring-brand-600/15"
                                : "bg-brand-100 text-brand-700 ring-4 ring-white"
                              : step.active
                                ? "bg-brand-600 text-white shadow-md shadow-brand-600/30 ring-4 ring-brand-600/15"
                                : "bg-white text-slate-400 ring-4 ring-white",
                          ].join(" ")}
                        >
                          {step.active && step.icon === "truck" ? (
                            <Truck className="h-4 w-4" />
                          ) : step.active && step.icon === "pin" ? (
                            <MapPin className="h-4 w-4" />
                          ) : step.done ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span
                          className={`w-full text-center text-[10px] font-medium leading-tight sm:text-[11px] ${
                            step.active ? "text-brand-700" : step.done ? "text-brand-600" : "text-slate-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!job.operative_en_route_at || fieldAction === "en_route"}
                  onClick={() => runField("en_route")}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {fieldAction === "en_route" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Navigation className="h-4 w-4" />
                  )}
                  I&apos;m on the way
                </button>
                <button
                  type="button"
                  disabled={!job.operative_en_route_at || !!job.operative_arrived_at || fieldAction === "arrived"}
                  onClick={() => runField("arrived")}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {fieldAction === "arrived" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  I&apos;ve arrived
                </button>
                <button
                  type="button"
                  disabled={!job.operative_arrived_at || fieldAction === "complete" || !preDone || !postDone}
                  onClick={() => runField("complete")}
                  title={!preDone || !postDone ? "Save both before & after checklists first" : undefined}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {fieldAction === "complete" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Mark job complete
                </button>
              </div>

              {(!preDone || !postDone) && job.operative_arrived_at && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900 ring-1 ring-amber-200/70">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Due diligence incomplete —{" "}
                  {!preDone ? "finish “Before you start”" : "finish “After the job”"} checklist below before completing.
                </p>
              )}

              {(job.operative_en_route_at || job.operative_arrived_at) && (
                <ul className="space-y-1 text-xs text-slate-500">
                  {job.operative_en_route_at && (
                    <li>On route: {new Date(job.operative_en_route_at).toLocaleString("en-GB")}</li>
                  )}
                  {job.operative_arrived_at && (
                    <li>Arrived: {new Date(job.operative_arrived_at).toLocaleString("en-GB")}</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Due diligence / inspection */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <SectionTitle>Job inspection</SectionTitle>
              <p className="mt-1 text-sm text-slate-600">
                Required checklist and notes for each stage. This is your due diligence record for Kleen and any dispute.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {STAGE_TABS.map((tab) => {
              const saved = reportByStage[tab.value];
              const done =
                saved && isChecklistComplete(parseChecklist(saved.checklist, tab.value), tab.value);
              const active = stage === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => selectStage(tab.value)}
                  className={`relative flex-1 rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition sm:text-sm ${
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  {done && (
                    <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6 sm:py-6">
          {/* Checklist */}
          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Due diligence checklist</h3>
                <p className="mt-0.5 text-sm text-slate-500">All items required before saving this stage.</p>
              </div>
              <p
                className={`text-xs font-semibold ${
                  stageComplete ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {stageProgress.done}/{stageProgress.total} complete
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {stageItems.map((item) => {
                const checked = !!checklist[item.key];
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={item.label}
                      onClick={() => toggleCheck(item.key)}
                      className={`flex w-full cursor-pointer gap-3 rounded-xl border px-3 py-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${
                        checked
                          ? "border-brand-200 bg-brand-50/70"
                          : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <CustomCheck checked={checked} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                        {item.hint && <span className="mt-0.5 block text-xs text-slate-500">{item.hint}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {stage !== "pre_job" && (
            <div>
              <label className="text-sm font-semibold text-slate-800">Outcome</label>
              <CustomDropdown
                className="mt-1.5"
                value={outcome}
                onChange={(v) => setOutcome(v as Outcome)}
                options={OUTCOME_OPTIONS}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-800">
              Stage notes <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="input-field mt-1.5"
              placeholder={
                stage === "pre_job"
                  ? "Anything notable before you start…"
                  : stage === "post_job"
                    ? "How the job went, anything the customer should know…"
                    : "Why the job could not start…"
              }
            />
          </div>

          <button
            type="button"
            disabled={savingReport || !stageComplete}
            onClick={saveReport}
            className="btn-primary w-full sm:w-auto"
          >
            {savingReport ? "Saving…" : stageComplete ? "Save this stage" : "Complete checklist to save"}
          </button>

          {/* Evidence — same stage container */}
          <div className="border-t border-slate-100 pt-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Photo &amp; video evidence</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Upload images or short clips from this visit. Stored securely for Kleen review if needed.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-600">Evidence type</label>
                <CustomDropdown className="mt-1" value={itemType} onChange={setItemType} options={ITEM_TYPE_OPTIONS} />
              </div>
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="input-field mt-1"
                placeholder="Describe what the photo or video shows…"
              />
            </label>
            <div className="mt-3">
              <label className="text-xs font-medium text-slate-600">Upload files</label>
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
                  {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} ready to upload.
                  <button
                    type="button"
                    className="ml-2 font-semibold text-brand-600 hover:underline"
                    onClick={() => setPendingFiles([])}
                  >
                    Clear
                  </button>
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={savingItem || !note.trim()}
              onClick={addItem}
              className="btn-primary mt-4"
            >
              {savingItem ? "Uploading…" : "Add evidence"}
            </button>

            {currentStageEvidence.length > 0 && (
              <ul className="mt-4 space-y-2">
                {currentStageEvidence.map((i) => (
                  <li key={i.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold capitalize text-slate-800">{i.item_type.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-slate-700">{i.note}</p>
                    {i.photo_urls?.length > 0 && (
                      <div className="mt-2 flex flex-col gap-2">
                        {i.photo_urls.map((u) => (
                          <div key={u} className="rounded-lg border border-slate-100 bg-white p-2">
                            <JobEvidenceMedia pathOrUrl={u} />
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionTitle>Saved reports</SectionTitle>
        <p className="mt-1 text-sm text-slate-500">History of stages you’ve submitted for this job.</p>
        <ul className="mt-4 space-y-3">
          {reports.map((r) => {
            const tab = STAGE_TABS.find((t) => t.value === r.stage);
            const progress = checklistProgress(parseChecklist(r.checklist, r.stage), r.stage);
            return (
              <li key={r.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-bold text-slate-900">{tab?.label || r.stage}</p>
                  <p className="text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString("en-GB")}</p>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  Checklist {progress.done}/{progress.total}
                  {r.job_outcome ? ` · ${r.job_outcome.replace(/_/g, " ")}` : ""}
                </p>
                {r.summary && <p className="mt-2 text-sm text-slate-700">{r.summary}</p>}
                {(r.job_report_items || []).length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    {(r.job_report_items || []).length} evidence item
                    {(r.job_report_items || []).length === 1 ? "" : "s"}
                  </p>
                )}
              </li>
            );
          })}
          {reports.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No stages saved yet — complete a checklist above and save.
            </li>
          )}
        </ul>
      </section>

      {showRateCustomer && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionTitle>Rate this customer</SectionTitle>
          <p className="mt-1 text-sm text-slate-500">Helps Kleen spot unfair behaviour. One rating per job.</p>
          <label className="mt-4 block text-sm font-semibold text-slate-800">
            Score (1–5)
            <select
              value={customerRating}
              onChange={(e) => setCustomerRating(Number(e.target.value))}
              className="input-field mt-1.5"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-800">
            Comment <span className="font-normal text-slate-400">(optional)</span>
            <textarea
              value={customerComment}
              onChange={(e) => setCustomerComment(e.target.value)}
              rows={2}
              className="input-field mt-1.5"
            />
          </label>
          <button
            type="button"
            disabled={savingCustomerRating}
            onClick={submitCustomerRating}
            className="btn-primary mt-4"
          >
            {savingCustomerRating ? "Saving…" : "Submit rating"}
          </button>
        </section>
      )}

      {/* Cancel — bottom */}
      {showLive && (
        <section
          ref={cancelRef}
          id="cancel-job"
          className="scroll-mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-5 shadow-sm sm:p-6"
        >
          <SectionTitle>Cancel this job</SectionTitle>
          <p className="mt-1 text-sm text-red-900/80">
            Only cancel if you cannot attend. Cancelling within 24 hours of the scheduled start incurs a £50 penalty on
            your account.
            {cancelPreview?.isLateCancel && (
              <span className="mt-1 block font-semibold">
                Late cancel — £{(cancelPreview.penaltyPence / 100).toFixed(2)} will be added to your penalty balance.
              </span>
            )}
          </p>
          <label className="mt-4 block text-sm font-semibold text-red-900">
            Reason (required)
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="input-field mt-1.5 border-red-200 bg-white"
              placeholder="Explain why you need to cancel…"
            />
          </label>
          {showCancelConfirm && cancelPreview?.isLateCancel && (
            <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900">
              Confirm you accept the £{(cancelPreview.penaltyPence / 100).toFixed(2)} late-cancel penalty.
            </p>
          )}
          <button
            type="button"
            disabled={cancelLoading || cancelReason.trim().length < 10}
            onClick={() => submitCancel(showCancelConfirm)}
            className="mt-4 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLoading ? "Cancelling…" : showCancelConfirm ? "Confirm cancellation" : "Cancel job"}
          </button>
        </section>
      )}
    </div>
  );
}
