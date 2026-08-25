"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ContractorSidebar from "@/components/contractor/ContractorSidebar";
import ContractorApplication from "@/components/contractor/ContractorApplication";
import ApplicationPendingScreen from "@/components/contractor/ApplicationPendingScreen";
import { ContractorPortalContext } from "@/components/contractor/contractor-portal-context";
import ToastContainer from "@/components/ui/Toast";
import { Loader2 } from "lucide-react";

export default function ContractorPortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [operativeId, setOperativeId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [rejectedAt, setRejectedAt] = useState<string | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [submittedForReviewAt, setSubmittedForReviewAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivated, setDeactivated] = useState(false);
  const [adminInvite, setAdminInvite] = useState(false);

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

    setUserEmail(user.email || null);

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
      if (profile.role === "customer") {
        const res = await fetch("/api/contractor/ensure-operative-role", {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const { data: upgraded } = await supabase
            .from("profiles")
            .select("role, full_name, email")
            .eq("id", user.id)
            .single();
          if (upgraded?.role === "operative") {
            Object.assign(profile, upgraded);
          } else {
            router.replace("/contractor/join?need_operative=1&error=role_upgrade");
            setLoading(false);
            return;
          }
        } else {
          router.replace("/contractor/join?need_operative=1&error=role_upgrade");
          setLoading(false);
          return;
        }
      } else {
        router.replace("/contractor/sign-in?error=not_contractor");
        setLoading(false);
        return;
      }
    }

    let { data: op } = await supabase.from("operatives").select("*").eq("user_id", user.id).maybeSingle();
    let isAdminInvite = false;

    if (op && op.is_active === false) {
      setDeactivated(true);
      setLoading(false);
      return;
    }

    if (!op) {
      const claimRes = await fetch("/api/contractor/claim-admin-invite", {
        method: "POST",
        credentials: "include",
      });
      const claimJson = (await claimRes.json().catch(() => ({}))) as {
        ok?: boolean;
        claimed?: boolean;
        operative?: Record<string, unknown>;
        admin_invite?: boolean;
        error?: string;
      };

      if (claimRes.ok && claimJson.operative) {
        op = claimJson.operative as typeof op;
        isAdminInvite = Boolean(claimJson.admin_invite) || Boolean(claimJson.claimed);
      } else if (!claimRes.ok && claimJson.error) {
        console.warn("claim-admin-invite:", claimJson.error);
      }
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
          onboarding_source: "self_apply",
        })
        .select("*")
        .single();

      if (insErr) {
        console.error(insErr);
        // Duplicate email / race: try claim once more before failing
        const retryClaim = await fetch("/api/contractor/claim-admin-invite", {
          method: "POST",
          credentials: "include",
        });
        const retryJson = (await retryClaim.json().catch(() => ({}))) as {
          operative?: Record<string, unknown>;
          admin_invite?: boolean;
          claimed?: boolean;
        };
        if (retryClaim.ok && retryJson.operative) {
          op = retryJson.operative as typeof op;
          isAdminInvite = Boolean(retryJson.admin_invite) || Boolean(retryJson.claimed);
        } else {
          setError(
            insErr.message.includes("duplicate") || insErr.code === "23505"
              ? "A contractor record may already exist for another account. Contact Kleen support."
              : insErr.message,
          );
          setLoading(false);
          return;
        }
      } else {
        op = inserted;

        void fetch("/api/contractor/notify-admin-signup", {
          method: "POST",
          credentials: "include",
        }).catch((e) => console.warn("notify-admin-signup failed:", e));
      }
    }

    // Merge admin-created + self-signup duplicate rows (same email) onto one operative.
    const resolveRes = await fetch("/api/contractor/resolve-operative-identity", {
      method: "POST",
      credentials: "include",
    });
    const resolveJson = (await resolveRes.json().catch(() => ({}))) as {
      operative?: Record<string, unknown>;
      merged?: boolean;
      merged_count?: number;
    };
    if (resolveRes.ok && resolveJson.operative) {
      op = resolveJson.operative as typeof op;
      if (resolveJson.merged) {
        console.info(
          "Merged duplicate contractor records:",
          resolveJson.merged_count ?? 0,
        );
      }
    }

    if (!op) {
      setError("Could not load your contractor profile.");
      setLoading(false);
      return;
    }

    const row = op as Record<string, unknown>;
    if (!isAdminInvite) {
      isAdminInvite =
        String(row.onboarding_source || "") === "admin_invite" || Boolean(row.admin_invited_at);
    }
    setAdminInvite(isAdminInvite);
    setOperativeId(String(row.id));
    setIsVerified(!!row.is_verified);
    setRejectedAt(row.rejected_at ? String(row.rejected_at) : null);
    setRejectionMessage(row.rejection_message ? String(row.rejection_message) : null);
    setSubmittedForReviewAt(row.submitted_for_review_at ? String(row.submitted_for_review_at) : null);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

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
            This profile has been turned off by Kleen. Contact support if you need help.
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

  const pendingReview = !isVerified && submittedForReviewAt && !rejectedAt;
  const needsApplication = !isVerified && !pendingReview;

  if (pendingReview) {
    return (
      <ApplicationPendingScreen
        submittedAt={submittedForReviewAt}
        email={userEmail}
        adminInvite={adminInvite}
      />
    );
  }

  if (needsApplication) {
    return (
      <ContractorApplication
        operativeId={operativeId}
        rejectionMessage={rejectionMessage}
        onSubmitted={bootstrap}
        adminInvite={adminInvite}
      />
    );
  }

  return (
    <ContractorPortalContext.Provider
      value={{
        operativeId,
        loading: false,
        isVerified,
        rejectedAt,
        rejectionMessage,
        submittedForReviewAt,
        refresh: bootstrap,
        reopenOnboarding: () => {},
      }}
    >
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-brand-50/30 lg:flex-row">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/contractor" className="flex min-w-0 flex-1 items-center gap-2">
            <Image src="/images/kleen-logo.svg" alt="KLEEN" width={96} height={40} className="h-8 w-auto" />
          </Link>
          <span className="sr-only">Contractor portal</span>
        </header>

        <ContractorSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-10">
            {children}
          </div>
        </main>
        <ToastContainer />
      </div>
    </ContractorPortalContext.Provider>
  );
}
