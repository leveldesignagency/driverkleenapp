"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useContractorPortal } from "@/components/contractor/contractor-portal-context";
import ScheduleCalendar from "@/components/contractor/ScheduleCalendar";
import { Loader2 } from "lucide-react";

export default function ContractorSchedulePage() {
  const router = useRouter();
  const { isVerified } = useContractorPortal();

  useEffect(() => {
    if (!isVerified) router.replace("/contractor");
  }, [isVerified, router]);

  if (!isVerified) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-9 w-9 animate-spin text-brand-600" />
      </div>
    );
  }

  return <ScheduleCalendar />;
}
