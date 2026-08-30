"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ContractorPageHeader from "@/components/contractor/ContractorPageHeader";
import { getService } from "@/lib/services";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";

type DisputeStatus = "open" | "under_review" | "resolved" | "escalated" | "closed";

type JobNested = {
  reference: string;
  service_id: string;
  postcode: string | null;
};

type DisputeRow = {
  id: string;
  job_id: string;
  user_id: string;
  status: DisputeStatus;
  reason: string;
  resolution: string | null;
  created_at: string;
  jobs: JobNested | JobNested[] | null;
};

type MsgRow = {
  id: string;
  sender_id: string;
  recipient_role: "admin" | "customer" | "operative";
  message: string;
  created_at: string;
};

type FilterTab = "active" | "resolved" | "all";

function isResolved(s: DisputeStatus) {
  return s === "resolved" || s === "closed";
}

function statusBadge(status: DisputeStatus): { label: string; className: string } {
  switch (status) {
    case "resolved":
    case "closed":
      return { label: status === "closed" ? "Closed" : "Resolved", className: "bg-emerald-100 text-emerald-800" };
    case "under_review":
      return { label: "Under review", className: "bg-blue-100 text-blue-800" };
    case "escalated":
      return { label: "Escalated", className: "bg-red-100 text-red-800" };
    default:
      return { label: "Open", className: "bg-amber-100 text-amber-800" };
  }
}

export default function ContractorDisputesPage() {
  const router = useRouter();
  const { isVerified } = useContractorPortal();
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messagesByDispute, setMessagesByDispute] = useState<Record<string, MsgRow[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isVerified) return;
    const res = await fetch("/api/contractor/disputes/list", { credentials: "include" });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      disputes?: DisputeRow[];
    };
    if (!res.ok) {
      console.error(json.error || "disputes list failed");
      setRows([]);
    } else {
      setRows(json.disputes || []);
    }
    setLoading(false);
  }, [isVerified]);

  useEffect(() => {
    if (!isVerified) {
      router.replace("/contractor");
    }
  }, [isVerified, router]);

  useEffect(() => {
    if (!isVerified) return;
    setLoading(true);
    void load();
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setMyUserId(user?.id ?? null));
  }, [load, isVerified]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "resolved") return rows.filter((d) => isResolved(d.status));
    return rows.filter((d) => !isResolved(d.status));
  }, [rows, filter]);

  const loadMessages = async (disputeId: string) => {
    setLoadingMessages(disputeId);
    const res = await fetch(
      `/api/contractor/disputes/messages?disputeId=${encodeURIComponent(disputeId)}`,
      { credentials: "include" },
    );
    const json = (await res.json().catch(() => ({}))) as { error?: string; messages?: MsgRow[] };
    if (!res.ok) console.error(json.error || "messages failed");
    setMessagesByDispute((prev) => ({ ...prev, [disputeId]: json.messages || [] }));
    setLoadingMessages(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setSendError(null);
    if (!messagesByDispute[id]) void loadMessages(id);
  };

  const sendReply = async (dispute: DisputeRow) => {
    const text = (replyText[dispute.id] || "").trim();
    if (!text) return;
    setSendingId(dispute.id);
    setSendError(null);
    const res = await fetch("/api/contractor/disputes/list", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId: dispute.id, message: text }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSendingId(null);
    if (!res.ok) {
      setSendError(json.error || "Could not send");
      return;
    }
    setReplyText((prev) => ({ ...prev, [dispute.id]: "" }));
    await loadMessages(dispute.id);
  };

  const senderLabel = (senderId: string, uid: string | null) => {
    if (uid && senderId === uid) return "You";
    return "Kleen";
  };

  if (!isVerified || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <ContractorPageHeader
        title="Disputes"
        description="When Kleen needs your input on a customer case, it appears here. You only message Kleen — never the customer."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["active", "Active"],
            ["resolved", "Resolved"],
            ["all", "All"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === key
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
            <span className={`ml-1.5 ${filter === key ? "text-brand-100" : "text-slate-400"}`}>
              {key === "all"
                ? rows.length
                : key === "resolved"
                  ? rows.filter((d) => isResolved(d.status)).length
                  : rows.filter((d) => !isResolved(d.status)).length}
            </span>
          </button>
        ))}
      </div>

      <ul className="space-y-4">
        {filtered.map((d) => {
          const job = Array.isArray(d.jobs) ? d.jobs[0] : d.jobs;
          const svc = job ? getService(job.service_id) : undefined;
          const open = expandedId === d.id;
          const msgs = messagesByDispute[d.id];
          const badge = statusBadge(d.status);
          const resolved = isResolved(d.status);
          return (
            <li key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleExpand(d.id)}
                className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-start sm:justify-between sm:p-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 text-slate-400">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      resolved ? "bg-emerald-50" : "bg-amber-50"
                    }`}
                  >
                    {resolved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{job?.reference ?? "Job"}</p>
                    <p className="text-sm text-slate-600">
                      {svc?.name ?? job?.service_id}
                      {job?.postcode ? ` · ${job.postcode}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700">{d.reason}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(d.created_at).toLocaleString("en-GB")}</p>
                  </div>
                </div>
                <span className={`self-start rounded-full px-2.5 py-1 text-xs font-medium sm:shrink-0 ${badge.className}`}>
                  {badge.label}
                </span>
              </button>

              {d.resolution && (
                <div className="border-t border-slate-100 px-5 pb-4">
                  <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-100">
                    <p className="flex items-start gap-2 text-xs">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>
                        <span className="font-semibold">Resolution: </span>
                        {d.resolution}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {open && (
                <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-4">
                  <Link
                    href={`/contractor/jobs/${d.job_id}`}
                    className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open job / evidence <ExternalLink className="h-3 w-3" />
                  </Link>
                  {loadingMessages === d.id ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thread with Kleen</p>
                      <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto">
                        {(msgs || []).length === 0 ? (
                          <li className="text-sm text-slate-500">No messages yet.</li>
                        ) : (
                          (msgs || []).map((m) => (
                            <li
                              key={m.id}
                              className={`rounded-xl px-3 py-2 text-sm shadow-sm ring-1 ${
                                myUserId && m.sender_id === myUserId
                                  ? "bg-brand-50 ring-brand-100"
                                  : "bg-white ring-slate-100"
                              }`}
                            >
                              <p className="text-xs font-medium text-slate-500">
                                {senderLabel(m.sender_id, myUserId)} ·{" "}
                                {new Date(m.created_at).toLocaleString("en-GB")}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.message}</p>
                            </li>
                          ))
                        )}
                      </ul>
                      {sendError && expandedId === d.id && (
                        <p className="mt-2 text-xs text-red-600">{sendError}</p>
                      )}
                      {!resolved ? (
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                          <textarea
                            value={replyText[d.id] || ""}
                            onChange={(e) => setReplyText((prev) => ({ ...prev, [d.id]: e.target.value }))}
                            placeholder="Send message to Kleen…"
                            rows={2}
                            className="input-field min-h-[72px] flex-1 resize-y"
                          />
                          <button
                            type="button"
                            disabled={sendingId === d.id || !(replyText[d.id] || "").trim()}
                            onClick={() => sendReply(d)}
                            className="btn-primary h-fit w-full shrink-0 gap-2 px-4 py-2.5 sm:w-auto sm:self-end"
                          >
                            {sendingId === d.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Send
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">This dispute is closed — messaging is disabled.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-600">
              {filter === "active"
                ? "No active disputes"
                : filter === "resolved"
                  ? "No resolved disputes yet"
                  : "No disputes on your assigned jobs"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Cases appear after Kleen contacts you about a job.
            </p>
          </li>
        )}
      </ul>
    </div>
  );
}
