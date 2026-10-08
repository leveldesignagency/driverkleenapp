"use client";

import { useEffect, useState } from "react";
import { MapPinOff, Loader2, Mail, CheckCircle2, X } from "lucide-react";

type Props = {
  open: boolean;
  audience: "customer" | "contractor";
  source: string;
  postcode?: string | null;
  areaLabel?: string | null;
  defaultEmail?: string | null;
  onDismiss: () => void;
  onJoined?: () => void;
};

export default function OutOfAreaGate({
  open,
  audience,
  source,
  postcode,
  areaLabel,
  defaultEmail,
  onDismiss,
  onJoined,
}: Props) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail || "");
      setError(null);
      setJoined(false);
      setBusy(false);
    }
  }, [open, defaultEmail]);

  if (!open) return null;

  const joinWaitlist = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/service-area/waitlist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          postcode: postcode || null,
          audience,
          source,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not save your email.");
        return;
      }
      setJoined(true);
      onJoined?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="out-of-area-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="relative bg-gradient-to-br from-slate-50 to-cyan-50 px-6 pb-5 pt-6">
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-white/80 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
            <MapPinOff className="h-6 w-6 text-brand-600" />
          </div>
          <h2 id="out-of-area-title" className="mt-4 text-xl font-bold text-slate-900">
            Not in our area yet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Kleen is launching in <strong className="font-semibold text-slate-800">Kent, England</strong> only
            for now
            {areaLabel ? (
              <>
                {" "}
                — <span className="text-slate-700">{areaLabel}</span> is outside our current coverage
              </>
            ) : postcode ? (
              <>
                {" "}
                — <span className="font-mono text-slate-700">{postcode}</span> is outside Kent
              </>
            ) : null}
            .
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {joined ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                You&apos;re on the list
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                We&apos;ll email you when Kleen opens in your area.
              </p>
              <button
                type="button"
                onClick={onDismiss}
                className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
              >
                Got it
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Want us to email you when your area becomes available?
              </p>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Email</span>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    autoComplete="email"
                  />
                </div>
              </label>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void joinWaitlist()}
                  disabled={busy || !email.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Yes, email me
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  disabled={busy}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  No thanks
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
