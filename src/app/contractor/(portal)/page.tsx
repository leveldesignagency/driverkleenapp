"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import {
  FileText,
  Landmark,
  Briefcase,
  UserRound,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

function OverviewCard({
  href,
  title,
  description,
  icon: Icon,
  accent = "brand",
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: "brand" | "cyan" | "violet" | "amber" | "emerald";
}) {
  const accentStyles = {
    brand: {
      tile: "from-brand-100/90 via-brand-50 to-white ring-brand-100/60",
      icon: "text-brand-600/75 group-hover:text-brand-600",
    },
    cyan: {
      tile: "from-cyan-100/90 via-cyan-50 to-white ring-cyan-100/60",
      icon: "text-cyan-600/75 group-hover:text-cyan-600",
    },
    violet: {
      tile: "from-violet-100/90 via-violet-50 to-white ring-violet-100/60",
      icon: "text-violet-600/75 group-hover:text-violet-600",
    },
    amber: {
      tile: "from-amber-100/90 via-amber-50 to-white ring-amber-100/60",
      icon: "text-amber-600/75 group-hover:text-amber-600",
    },
    emerald: {
      tile: "from-emerald-100/90 via-emerald-50 to-white ring-emerald-100/60",
      icon: "text-emerald-600/75 group-hover:text-emerald-600",
    },
  }[accent];

  return (
    <Link
      href={href}
      className="group relative flex h-full min-h-[11.5rem] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-brand-200/80 hover:shadow-md"
    >
      {/* Top-right — room for icon / future illustration */}
      <div
        className="pointer-events-none absolute -right-2 -top-2 flex h-[5.5rem] w-[5.5rem] items-center justify-center sm:h-[6.25rem] sm:w-[6.25rem]"
        aria-hidden
      >
        <div
          className={`flex h-full w-full items-center justify-center rounded-[1.75rem] bg-gradient-to-br shadow-inner ring-1 transition-transform duration-300 group-hover:scale-105 ${accentStyles.tile}`}
        >
          <Icon className={`h-9 w-9 transition-colors sm:h-10 sm:w-10 ${accentStyles.icon}`} strokeWidth={1.5} />
        </div>
      </div>

      <div className="relative z-10 mt-auto flex min-h-[5.5rem] max-w-[85%] flex-col justify-end pr-2">
        <h2 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{title}</h2>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{description}</p>
      </div>
    </Link>
  );
}

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
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Contractor portal</h1>
        <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
          Browse local jobs, submit quotes, manage your schedule, and track assigned work.
        </p>
      </div>

      <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard
          href="/contractor/jobs"
          title="Jobs & quotes"
          description="Browse local jobs, submit quotes, and track assigned work."
          icon={Briefcase}
          accent="brand"
        />
        <OverviewCard
          href="/contractor/schedule"
          title="Schedule"
          description="View upcoming assigned jobs on your calendar."
          icon={CalendarDays}
          accent="cyan"
        />
        <OverviewCard
          href="/contractor/profile"
          title="Company & profile"
          description="Business details, areas, and tax references."
          icon={UserRound}
          accent="violet"
        />
        <OverviewCard
          href="/contractor/services"
          title="Services & contracts"
          description={
            serviceCount === null
              ? "Loading linked services…"
              : `${serviceCount} service${serviceCount === 1 ? "" : "s"} linked`
          }
          icon={FileText}
          accent="amber"
        />
        <OverviewCard
          href="/contractor/payouts"
          title="Bank details"
          description="UK account for Kleen payouts."
          icon={Landmark}
          accent="emerald"
        />
      </div>
    </div>
  );
}
