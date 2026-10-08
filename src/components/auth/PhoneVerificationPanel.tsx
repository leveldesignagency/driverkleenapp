"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Phone, Shield } from "lucide-react";
import { maskPhone } from "@/lib/phone";

type PhoneStatus = {
  profile: {
    phone: string | null;
    phoneE164: string | null;
    verifiedAt: string | null;
    verified: boolean;
  };
};

type Props = {
  target?: "profile" | "operative";
  className?: string;
};

export default function PhoneVerificationPanel({ target = "operative", className = "" }: Props) {
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifiedE164, setVerifiedE164] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/phone", { credentials: "include" });
      if (!res.ok) {
        setError("Could not load phone status.");
        return;
      }
      const json = (await res.json()) as PhoneStatus;
      setPhone(json.profile.phone || "");
      setVerified(json.profile.verified);
      setVerifiedE164(json.profile.verified ? json.profile.phoneE164 : null);
      setCodeSent(false);
      setCode("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const sendCode = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, target: target === "operative" ? "operative" : undefined }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not send code.");
        return;
      }
      setCodeSent(true);
      setVerified(false);
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/phone", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          target: target === "operative" ? "operative" : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Invalid code.");
        return;
      }
      await loadStatus();
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-500 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading phone…
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Phone className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-500">Phone</span>
        {verified && verifiedE164 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Verified {maskPhone(verifiedE164)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
            <Shield className="h-3 w-3" />
            Not verified
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">SMS verification required before Kleen can review your application.</p>

      <div className="mt-3 space-y-3">
        <input
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setCodeSent(false);
            setVerified(false);
          }}
          placeholder="07xxx xxxxxx"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          autoComplete="tel"
        />

        {!codeSent ? (
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={sending || !phone.trim()}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send verification code"}
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void verifyCode()}
                disabled={verifying || code.length < 4}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {verifying ? "Verifying…" : "Verify code"}
              </button>
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={sending}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Resend
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
      </div>
    </div>
  );
}
