"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Ban, Loader2, Mail } from "lucide-react";

export default function ContractorSuspendedPage() {
  const [loading, setLoading] = useState(true);
  const [ban, setBan] = useState<{
    reason: string;
    ban_type: string;
    expires_at: string | null;
    appeal_allowed: boolean;
  } | null>(null);
  const [pendingAppeal, setPendingAppeal] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    void fetch("/api/account/restriction", { credentials: "include" })
      .then(async (res) => {
        const json = await res.json();
        if (!json.restricted) {
          window.location.href = "/contractor";
          return;
        }
        setBan(json.ban);
        setPendingAppeal(json.pendingAppeal);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const submitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/account/restriction", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Could not submit appeal");
      return;
    }
    setSubmitted(true);
    setPendingAppeal(true);
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    window.location.href = "/contractor/sign-in";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
          <Ban className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Contractor account restricted</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your contractor portal access has been suspended. You cannot browse jobs, quote, or message Kleen until
          this is resolved.
        </p>
        {ban?.reason && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Reason</p>
            <p className="mt-1">{ban.reason}</p>
          </div>
        )}

        {ban?.appeal_allowed && !submitted && !pendingAppeal && (
          <form onSubmit={submitAppeal} className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-slate-700">Submit an appeal</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="input-field w-full resize-y"
              placeholder="Explain why your account should be reinstated…"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Submitting…" : "Submit appeal"}
            </button>
          </form>
        )}

        {(submitted || pendingAppeal) && (
          <p className="mt-6 rounded-xl bg-brand-50 p-4 text-sm text-brand-800">
            Your appeal is with Kleen. We will email you when it has been reviewed.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-6">
          <a href="mailto:support@kleenapp.co.uk" className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline">
            <Mail className="h-4 w-4" />
            support@kleenapp.co.uk
          </a>
          <button type="button" onClick={signOut} className="text-left text-sm text-slate-500 hover:text-slate-700">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
