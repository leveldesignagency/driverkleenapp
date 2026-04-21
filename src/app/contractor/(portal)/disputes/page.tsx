"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { getService } from "@/lib/services";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, MessageSquare, Send } from "lucide-react";

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

  const load = useCallback(async () => {
    if (!isVerified) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMyUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from("disputes")
      .select(
        `
          id,
          job_id,
          user_id,
          status,
          reason,
          resolution,
          created_at,
          jobs ( reference, service_id, postcode )
        `
      )
      .order("created_at", { ascending: false });

    if (error) console.error(error);
    setRows((data as unknown as DisputeRow[]) || []);
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
    load();
  }, [load, isVerified]);

  const loadMessages = async (disputeId: string) => {
    setLoadingMessages(disputeId);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("dispute_messages")
      .select("id, sender_id, recipient_role, message, created_at")
      .eq("dispute_id", disputeId)
      .order("created_at", { ascending: true });
    if (error) console.error(error);
    setMessagesByDispute((prev) => ({ ...prev, [disputeId]: (data as MsgRow[]) || [] }));
    setLoadingMessages(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!messagesByDispute[id]) void loadMessages(id);
  };

  const sendReply = async (dispute: DisputeRow) => {
    const text = (replyText[dispute.id] || "").trim();
    if (!text) return;
    setSendingId(dispute.id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSendingId(null);
      return;
    }
    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: dispute.id,
      sender_id: user.id,
      recipient_role: "admin",
      message: text,
    });
    setSendingId(null);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    setReplyText((prev) => ({ ...prev, [dispute.id]: "" }));
    await loadMessages(dispute.id);
  };

  const isResolved = (s: DisputeStatus) => s === "resolved" || s === "closed";

  const senderLabel = (senderId: string, uid: string | null) => {
    if (uid && senderId === uid) return "You";
    return "Kleen";
  };

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
      <h1 className="text-2xl font-bold text-slate-900">Disputes</h1>
      <p className="mt-1 text-sm text-slate-600">
        Disputes raised by customers on jobs you are assigned to. This thread is mediated by Kleen (no direct customer chat).
      </p>

      <ul className="mt-8 space-y-4">
        {rows.map((d) => {
          const job = Array.isArray(d.jobs) ? d.jobs[0] : d.jobs;
          const svc = job ? getService(job.service_id) : undefined;
          const open = expandedId === d.id;
          const msgs = messagesByDispute[d.id];
          return (
            <li key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggleExpand(d.id)}
                className="flex w-full items-start justify-between gap-3 p-5 text-left transition-colors hover:bg-slate-50/80"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-0.5 text-slate-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isResolved(d.status) ? "bg-accent-50" : "bg-amber-50"}`}>
                    {isResolved(d.status) ? (
                      <CheckCircle2 className="h-4 w-4 text-accent-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-600" />
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
                    <p className="mt-1">
                      <Link href={`/contractor/jobs/${d.job_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                        Open job layout / evidence
                      </Link>
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                    isResolved(d.status) ? "bg-accent-100 text-accent-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {d.status === "resolved" || d.status === "closed" ? "Resolved" : d.status.replace(/_/g, " ")}
                </span>
              </button>

              {d.resolution && (
                <div className="border-t border-slate-100 px-5 pb-4 pt-0">
                  <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="flex items-start gap-2 text-xs text-slate-600">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>
                        <span className="font-medium text-slate-800">Resolution: </span>
                        {d.resolution}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {open && (
                <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-4">
                  {loadingMessages === d.id ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thread</p>
                      <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto">
                        {(msgs || []).length === 0 ? (
                          <li className="text-sm text-slate-500">No messages yet.</li>
                        ) : (
                          (msgs || []).map((m) => (
                            <li key={m.id} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
                              <p className="text-xs font-medium text-slate-500">
                                {senderLabel(m.sender_id, myUserId)} · {new Date(m.created_at).toLocaleString("en-GB")}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.message}</p>
                            </li>
                          ))
                        )}
                      </ul>
                      <div className="mt-4 flex gap-2">
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
                          className="btn-primary h-fit shrink-0 gap-2 self-end px-4 py-2"
                        >
                          {sendingId === d.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Send
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-600">No disputes on your assigned jobs.</p>
            <p className="mt-1 text-xs text-slate-400">If a customer opens a dispute, it will appear here.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
