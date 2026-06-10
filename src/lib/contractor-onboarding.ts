type OperativeRow = {
  phone?: string | null;
  company_name?: string | null;
  trading_name?: string | null;
  registered_address?: string | null;
  service_areas?: string[] | null;
  bank_account_name?: string | null;
  bank_sort_code?: string | null;
  bank_account_number?: string | null;
  stripe_account_id?: string | null;
};

export function validateContractorOnboarding(
  operative: OperativeRow,
  serviceCount: number,
): string | null {
  const phoneOk = !!(operative.phone && String(operative.phone).trim());
  const ukOk = !!(
    (operative.company_name && String(operative.company_name).trim()) ||
    (operative.trading_name && String(operative.trading_name).trim()) ||
    (operative.registered_address && String(operative.registered_address).trim())
  );
  const areas = Array.isArray(operative.service_areas) ? operative.service_areas.length : 0;
  const sortDigits = String(operative.bank_sort_code ?? "").replace(/\D/g, "");
  const acctDigits = String(operative.bank_account_number ?? "").replace(/\D/g, "");
  const bankDetailsOk =
    !!(operative.bank_account_name && String(operative.bank_account_name).trim()) &&
    sortDigits.length >= 6 &&
    acctDigits.length >= 8;

  if (!phoneOk) return "Add a UK phone number on your profile.";
  if (!ukOk) return "Add company / trading name and registered address.";
  if (areas < 1) return "Add at least one service area.";
  if (serviceCount < 1) return "Add at least one service with contract text.";
  if (!bankDetailsOk) {
    return "Add UK bank details on Bank details.";
  }
  return null;
}
