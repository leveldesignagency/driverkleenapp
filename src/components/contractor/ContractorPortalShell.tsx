"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { customerAppHref } from "@/lib/customer-app-url";
import ContractorSidebar from "@/components/contractor/ContractorSidebar";
import { ContractorPortalContext } from "@/components/contractor/contractor-portal-context";
import ToastContainer from "@/components/ui/Toast";
import { Loader2 } from "lucide-react";

export default function ContractorPortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [operativeId, setOperativeId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [rejectedAt, setRejectedAt] = useState<string | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivated, setDeactivated] = useState(false);

  const bootstrap = useCallback(async () => {
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/contractor/sign-in");
      setLoading(false);
      return;
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", user.id)
      .single();

    if (pErr || !profile) {
      setError("Could not load your profile.");
      setLoading(false);
      return;
    }

    if (profile.role !== "operative") {
      const dest = customerAppHref("/dashboard");
      if (dest.startsWith("http")) {
        window.location.assign(dest);
      } else {
        router.replace(dest);
      }
      setLoading(false);
      return;
    }

    // Use * so the app works before migration 034 adds rejected_* / verification columns.
    let { data: op } = await supabase.from("operatives").select("*").eq("user_id", user.id).maybeSingle();

    if (op && op.is_active === false) {
      setDeactivated(true);
      setLoading(false);
      return;
    }

    if (!op) {
      const { data: inserted, error: insErr } = await supabase
        .from("operatives")
        .insert({
          user_id: user.id,
          email: user.email || profile.email || "",
          full_name: profile.full_name?.trim() || user.email?.split("@")[0] || "Contractor",
          phone: null,
          contractor_type: "sole_trader",
          specialisations: [],
          service_areas: [],
          is_active: true,
          is_verified: false,
        })
        .select("*")
        .single();

      if (insErr) {
        console.error(insErr);
        setError(
          insErr.message.includes("duplicate") || insErr.code === "23505"
            ? "A contractor record may already exist for another account. Contact Kleen support."
            : insErr.message
        );
        setLoading(false);
        return;
      }
      op = inserted;
    }

    const row = op as Record<string, unknown>;
    setOperativeId(String(row.id));
    setIsVerified(!!row.is_verified);
    setRejectedAt(row.rejected_at ? String(row.rejected_at) : null);
    setRejectionMessage(row.rejection_message ? String(row.rejection_message) : null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
      </div>
    );
  }

  if (deactivated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-900">Contractor account deactivated</p>
          <p className="mt-2 text-sm text-slate-600">
            This profile has been turned off by Kleen. You cannot access the portal until it is reactivated. Contact
            Kleen if you need help.
          </p>
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut({ scope: "global" });
              router.replace("/contractor/sign-in");
            }}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-slate-900">Could not open contractor portal</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => bootstrap()}
            className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!operativeId) {
    return null;
  }

  return (
    <ContractorPortalContext.Provider
      value={{
        operativeId,
        loading: false,
        isVerified,
        rejectedAt,
        rejectionMessage,
        refresh: bootstrap,
      }}
    >
      <div className="flex h-screen bg-slate-50">
        <ContractorSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:max-w-4xl lg:py-8">{children}</div>
        </main>
        <ToastContainer />
      </div>
    </ContractorPortalContext.Provider>
  );
}
