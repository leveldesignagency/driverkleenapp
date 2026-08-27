export type ReportStage = "pre_job" | "post_job" | "cannot_start";

export type ChecklistItemDef = {
  key: string;
  label: string;
  hint?: string;
};

/** Required due-diligence checks before starting work. */
export const PRE_JOB_CHECKLIST: ChecklistItemDef[] = [
  {
    key: "access_confirmed",
    label: "Safe access confirmed",
    hint: "Parking, entry, and site access are clear and agreed.",
  },
  {
    key: "pre_existing_checked",
    label: "Pre-existing condition checked",
    hint: "Look for damage, stains, or wear before you start — photograph anything notable.",
  },
  {
    key: "before_photos",
    label: "Before photos taken",
    hint: "Clear photos of the work area before cleaning.",
  },
  {
    key: "scope_confirmed",
    label: "Scope confirmed",
    hint: "You understand what the customer expects for this visit.",
  },
  {
    key: "safe_to_work",
    label: "Safe to work",
    hint: "No hazards that would stop you working safely.",
  },
];

/** Required checks before marking the job complete. */
export const POST_JOB_CHECKLIST: ChecklistItemDef[] = [
  {
    key: "scope_completed",
    label: "Agreed scope completed",
    hint: "Work matches what was booked / quoted.",
  },
  {
    key: "after_photos",
    label: "After photos taken",
    hint: "Clear photos of the finished area for the record.",
  },
  {
    key: "site_tidy",
    label: "Site left tidy",
    hint: "Tools, waste, and materials removed; area left presentable.",
  },
  {
    key: "secure_left",
    label: "Property left secure",
    hint: "Doors / gates / alarms as instructed (where applicable).",
  },
  {
    key: "handover_done",
    label: "Customer handover attempted",
    hint: "Customer informed, or note left if they were unavailable.",
  },
];

/** If the job cannot start — document the issue properly. */
export const CANNOT_START_CHECKLIST: ChecklistItemDef[] = [
  {
    key: "issue_documented",
    label: "Issue documented in writing",
    hint: "Clear reason why work could not begin.",
  },
  {
    key: "issue_photos",
    label: "Photos of the blocking issue",
    hint: "Evidence of access problem, obstruction, or unsafe condition.",
  },
  {
    key: "customer_notified",
    label: "Customer notified",
    hint: "You have told the customer (or attempted to) via the app / phone.",
  },
];

export function checklistForStage(stage: ReportStage): ChecklistItemDef[] {
  if (stage === "pre_job") return PRE_JOB_CHECKLIST;
  if (stage === "post_job") return POST_JOB_CHECKLIST;
  return CANNOT_START_CHECKLIST;
}

export type ChecklistState = Record<string, boolean>;

export function emptyChecklist(stage: ReportStage): ChecklistState {
  return Object.fromEntries(checklistForStage(stage).map((i) => [i.key, false]));
}

export function parseChecklist(raw: unknown, stage: ReportStage): ChecklistState {
  const base = emptyChecklist(stage);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const item of checklistForStage(stage)) {
    const v = obj[item.key];
    if (typeof v === "boolean") base[item.key] = v;
    else if (v && typeof v === "object" && "checked" in v) {
      base[item.key] = Boolean((v as { checked: unknown }).checked);
    }
  }
  return base;
}

export function isChecklistComplete(state: ChecklistState, stage: ReportStage): boolean {
  return checklistForStage(stage).every((i) => state[i.key] === true);
}

export function checklistProgress(state: ChecklistState, stage: ReportStage): {
  done: number;
  total: number;
} {
  const items = checklistForStage(stage);
  const done = items.filter((i) => state[i.key]).length;
  return { done, total: items.length };
}
