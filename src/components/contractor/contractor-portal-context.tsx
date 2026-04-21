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
  refresh: () => Promise<void>;
};

export const ContractorPortalContext = createContext<ContractorPortalValue>({
  operativeId: null,
  loading: true,
  isVerified: false,
  rejectedAt: null,
  rejectionMessage: null,
  refresh: async () => {},
});

export function useContractorPortal() {
  return useContext(ContractorPortalContext);
}
