"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import { FileText, Landmark, Briefcase, UserRound, CalendarDays } from "lucide-react";

export default function ContractorHomePage() {
  const { operativeId, isVerified } = useContractorPortal();
  const [serviceCount, setServiceCount] = useState<number | null>(null);

  useEffect(() => {
    if (!operativeId) return;
    const supabase = createClient();
    (async () => {
      const { count } = await supabase
        .from("operative_services")
        .select("id", { count: "exact", head: true })
        .eq("operative_id", operativeId);
      setServiceCount(count ?? 0);
    })();
  }, [operativeId]);

  if (!isVerified) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Contractor portal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Browse local jobs, submit quotes, manage your schedule, and track assigned work.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/contractor/jobs"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Briefcase className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Jobs &amp; quotes</p>
            <p className="mt-1 text-sm text-slate-600">Browse local jobs, submit quotes, and track assigned work.</p>
          </div>
        </Link>
        <Link
          href="/contractor/schedule"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <CalendarDays className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Schedule</p>
            <p className="mt-1 text-sm text-slate-600">View upcoming assigned jobs on your calendar.</p>
          </div>
        </Link>
        <Link
          href="/contractor/profile"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <UserRound className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Company &amp; profile</p>
            <p className="mt-1 text-sm text-slate-600">Business details, areas, and tax references.</p>
          </div>
        </Link>
        <Link
          href="/contractor/services"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <FileText className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Services &amp; contracts</p>
            <p className="mt-1 text-sm text-slate-600">
              {serviceCount === null ? "Loading…" : `${serviceCount} service${serviceCount === 1 ? "" : "s"} linked`}
            </p>
          </div>
        </Link>
        <Link
          href="/contractor/payouts"
          className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Landmark className="h-8 w-8 text-brand-600" />
          <div>
            <p className="font-semibold text-slate-900">Bank details</p>
            <p className="mt-1 text-sm text-slate-600">UK account for Kleen payouts.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
