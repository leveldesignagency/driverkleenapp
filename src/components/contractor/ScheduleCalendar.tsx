"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import DayJourneyMap from "@/components/contractor/DayJourneyMap";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  X,
} from "lucide-react";

type ViewMode = "week" | "month" | "journey";

type ScheduleJob = {
  assignmentId: string;
  jobId: string;
  reference: string;
  postcode: string;
  city: string | null;
  addressLine1: string;
  preferredDate: string;
  preferredTime: string;
  status: string;
  serviceName: string;
  assignedAt: string;
  completedAt: string | null;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(d: Date, mode: ViewMode): string {
  if (mode === "week") {
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  }
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(t: string): string {
  const part = t.slice(0, 5);
  return part || t;
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "awaiting_completion":
    case "in_progress":
      return { label: "Scheduled", cls: "bg-cyan-100 text-cyan-800" };
    case "customer_accepted":
    case "accepted":
      return { label: "Booked", cls: "bg-violet-100 text-violet-800" };
    case "completed":
    case "funds_released":
      return { label: "Done", cls: "bg-emerald-100 text-emerald-800" };
    case "cancelled":
      return { label: "Cancelled", cls: "bg-slate-100 text-slate-600" };
    default:
      return { label: status.replace(/_/g, " "), cls: "bg-slate-100 text-slate-700" };
  }
}

export default function ScheduleCalendar() {
  const { operativeId, isVerified } = useContractorPortal();
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [jobs, setJobs] = useState<ScheduleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [modalJob, setModalJob] = useState<ScheduleJob | null>(null);

  const load = useCallback(async () => {
    if (!operativeId) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("job_assignments")
      .select(
        `id, assigned_at, completed_at,
         jobs!job_id (
           id, reference, postcode, city, address_line_1, preferred_date, preferred_time, status,
           services ( name )
         )`,
      )
      .eq("operative_id", operativeId)
      .order("assigned_at", { ascending: false });

    const rows: ScheduleJob[] = [];
    for (const row of data || []) {
      const j = row.jobs as
        | {
            id: string;
            reference: string;
            postcode: string;
            city: string | null;
            address_line_1: string;
            preferred_date: string;
            preferred_time: string;
            status: string;
            services?: { name: string } | { name: string }[] | null;
          }
        | {
            id: string;
            reference: string;
            postcode: string;
            city: string | null;
            address_line_1: string;
            preferred_date: string;
            preferred_time: string;
            status: string;
            services?: { name: string } | { name: string }[] | null;
          }[]
        | null;
      const job = Array.isArray(j) ? j[0] : j;
      if (!job?.preferred_date) continue;
      const svc = job.services;
      const serviceName = Array.isArray(svc) ? svc[0]?.name : svc?.name;
      rows.push({
        assignmentId: row.id as string,
        jobId: job.id,
        reference: job.reference,
        postcode: job.postcode,
        city: job.city,
        addressLine1: job.address_line_1,
        preferredDate: job.preferred_date,
        preferredTime: job.preferred_time,
        status: job.status,
        serviceName: serviceName || "Cleaning",
        assignedAt: row.assigned_at as string,
        completedAt: (row.completed_at as string | null) ?? null,
      });
    }
    setJobs(rows);
    setLoading(false);
  }, [operativeId]);

  useEffect(() => {
    if (isVerified) load();
  }, [isVerified, load]);

  const days = useMemo(() => {
    const count = view === "week" ? 7 : 28;
    const start =
      view === "week"
        ? anchor
        : (() => {
            const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
            return startOfDay(first);
          })();
    return Array.from({ length: count }, (_, i) => addDays(start, i));
  }, [anchor, view]);

  const jobsByDay = useMemo(() => {
    const map = new Map<string, ScheduleJob[]>();
    for (const job of jobs) {
      const key = job.preferredDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(job);
    }
    for (const list of Array.from(map.values())) {
      list.sort((a, b) => a.preferredTime.localeCompare(b.preferredTime));
    }
    return map;
  }, [jobs]);

  const periodLabel = useMemo(() => {
    if (view === "week") {
      const end = addDays(anchor, 6);
      return `${anchor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, [anchor, view]);

  const shiftPeriod = (dir: -1 | 1) => {
    setExpandedDay(null);
    if (view === "week") {
      setAnchor((a) => addDays(a, dir * 7));
    } else {
      setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
    }
  };

  if (!isVerified) return null;

  return (
    <div className="space-y-6">
      <ContractorPageHeader
        title="Schedule"
        description="Assigned jobs by week or month, plus a day journey map ordered by job times."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {(["week", "month", "journey"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setExpandedDay(null);
                if (v !== "journey") setAnchor(startOfDay(new Date()));
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                view === v ? "bg-brand-600 text-white shadow" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {v === "journey" ? "Journey map" : v}
            </button>
          ))}
        </div>

        {view !== "journey" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-semibold text-slate-800">{periodLabel}</span>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Next period"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setAnchor(startOfDay(new Date()));
                setExpandedDay(formatDayKey(new Date()));
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {view === "journey" ? (
        <DayJourneyMap />
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => {
            const key = formatDayKey(day);
            const dayJobs = jobsByDay.get(key) || [];
            const isExpanded = expandedDay === key;
            const isToday = key === formatDayKey(new Date());

            return (
              <div
                key={key}
                className={`overflow-hidden rounded-2xl border transition ${
                  isToday ? "border-brand-300 bg-brand-50/30" : "border-slate-200 bg-white"
                } shadow-sm`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedDay(isExpanded ? null : key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className={`h-4 w-4 ${isToday ? "text-brand-600" : "text-slate-400"}`} />
                    <span className="text-sm font-semibold text-slate-900">{formatDayLabel(day, view)}</span>
                    {isToday && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-800">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {dayJobs.length === 0 ? "No jobs" : `${dayJobs.length} job${dayJobs.length === 1 ? "" : "s"}`}
                  </span>
                </button>

                {dayJobs.length > 0 && (
                  <div
                    className={`grid gap-2 border-t border-slate-100 px-4 py-3 transition-all ${
                      isExpanded ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    }`}
                  >
                    {dayJobs.map((job) => {
                      const badge = statusBadge(job.status);
                      return (
                        <button
                          key={job.assignmentId}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalJob(job);
                          }}
                          className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-3 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900">{job.reference}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-brand-800">{job.serviceName}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {formatTime(job.preferredTime)} · {job.postcode}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalJob && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{modalJob.reference}</h2>
                <p className="text-sm text-slate-600">{modalJob.serviceName}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalJob(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">When</dt>
                <dd className="font-medium text-slate-900">
                  {new Date(modalJob.preferredDate).toLocaleDateString("en-GB")} at{" "}
                  {formatTime(modalJob.preferredTime)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Address</dt>
                <dd className="text-right font-medium text-slate-900">
                  {modalJob.addressLine1}
                  {modalJob.city ? `, ${modalJob.city}` : ""} · {modalJob.postcode}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(modalJob.status).cls}`}>
                    {statusBadge(modalJob.status).label}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href={`/contractor/jobs/${modalJob.jobId}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Open job
                <ExternalLink className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setModalJob(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
