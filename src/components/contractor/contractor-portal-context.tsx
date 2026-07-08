"use client";

import { createContext, useContext } from "react";

export type ContractorPortalValue = {
  operativeId: string | null;
  loading: boolean;
  /** Set by Kleen admin (Contractors → verify). Until true, jobs and payouts stay locked. */
  isVerified: boolean;
  /** Application was declined — message is shown in portal and was emailed. */
  rejectedAt: string | null;
  rejectionMessage: string | null;
  submittedForReviewAt: string | null;
  refresh: () => Promise<void>;
  reopenOnboarding: () => void;
};

export const ContractorPortalContext = createContext<ContractorPortalValue>({
  operativeId: null,
  loading: true,
  isVerified: false,
  rejectedAt: null,
  rejectionMessage: null,
  submittedForReviewAt: null,
  refresh: async () => {},
  reopenOnboarding: () => {},
});

export function useContractorPortal() {
  return useContext(ContractorPortalContext);
}
