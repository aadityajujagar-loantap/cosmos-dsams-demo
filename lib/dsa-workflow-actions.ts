/**
 * Task 20C — CALL_BACK & RE-allocate action gating.
 *
 * Mirrors the authoritative backend matrix enforced in BOTH
 * DsaApprovalEngine::validateAction() and DsaController::processWorkflowAction():
 *
 *   L1 -> RECOMMEND
 *   L2 -> RECOMMEND, REJECT
 *   L3 -> RECOMMEND, REJECT, REVERT, RE_ALLOCATE, FORWARD
 *   L4 -> RECOMMEND, REJECT, REVERT, CALL_BACK, RE_ALLOCATE, FORWARD
 *   L5 -> RECOMMEND, REJECT, REVERT, CALL_BACK, RE_ALLOCATE, FORWARD
 *   L6 -> RECOMMEND, REJECT, REVERT, FORWARD, CALL_BACK
 *   L7 -> APPROVE, REJECT
 *
 * The matrix is evaluated against the CURRENTLY PENDING step, not against the
 * caller's own level. That is why a L3 user can call a case back while it sits
 * at L4 — the case's level is what gates the button.
 */

export type DsaWorkflowAction =
  | "RECOMMEND"
  | "APPROVE"
  | "REJECT"
  | "REVERT"
  | "CALL_BACK"
  | "RE_ALLOCATE"
  | "FORWARD";

/** Actions the backend permits for a step at `level`. */
export function allowedWorkflowActions(
  level: number | null | undefined,
  isFinal = false,
): DsaWorkflowAction[] {
  if (isFinal) return ["APPROVE", "REJECT"];
  switch (Number(level)) {
    case 1:
      return ["RECOMMEND"];
    case 2:
      return ["RECOMMEND", "REJECT"];
    case 3:
      return ["RECOMMEND", "REJECT", "REVERT", "RE_ALLOCATE", "FORWARD"];
    case 4:
    case 5:
      return [
        "RECOMMEND",
        "REJECT",
        "REVERT",
        "CALL_BACK",
        "RE_ALLOCATE",
        "FORWARD",
      ];
    case 6:
      return ["RECOMMEND", "REJECT", "REVERT", "FORWARD", "CALL_BACK"];
    case 7:
      // L7 is the configured final step (is_final = true) in the workflow
      // seeder, so it only ever sanctions or rejects.
      return ["APPROVE", "REJECT"];
    default:
      return [];
  }
}

export function isWorkflowActionAllowed(
  action: DsaWorkflowAction,
  level: number | null | undefined,
  isFinal = false,
): boolean {
  return allowedWorkflowActions(level, isFinal).includes(action);
}

/**
 * CALL_BACK — pull a pending case back to the previous active-stage actor.
 *
 * Offered when the case currently sits at L4, L5 or L6. The backend then
 * verifies that the PREVIOUS active step resolves to L3/L4/L5 and that the
 * caller is exactly that actor, returning the case ASSIGNED + LOCKED to them.
 * Those two checks depend on dynamic step resolution (e.g. L4 skipped when no
 * DGM is posted) and are enforced server-side; we surface its error verbatim
 * rather than re-implementing the resolver here.
 */
export function canCallBack(level: number | null | undefined): boolean {
  return [4, 5, 6].includes(Number(level));
}

/**
 * RE_ALLOCATE — hand a pending case to another authority among L3/L4/L5.
 *
 * Both the engine and GET /eligible-users reject any other current level, so
 * the picker is only offered for L3, L4 and L5.
 */
/**
 * RE_ALLOCATE — hand a pending case to another authority among L3/L4/L5.
 *
 * Both the engine and GET /eligible-users reject any other current level, so
 * the picker is only offered for L3, L4 and L5.
 */
/**
 * True when a workflow step row was closed by a CALL_BACK.
 *
 * IMPORTANT: for such a row, `remarks` holds the CALLER's message, not this
 * step's own remarks. DsaApprovalEngine::handleCallBack() writes the calling
 * authority's reason onto the step being called back from, so rendering that
 * text under the step's own role would put the previous authority's words in
 * the next authority's mouth.
 *
 * The UI therefore treats a CALLED_BACK step as still pending and shows no
 * remark on it. Nothing is lost: the reason is recorded against the caller in
 * dsa_workflow_audit_logs and is visible in the Audit Trails tab.
 */
export function isCalledBackStep(status?: string | null): boolean {
  return String(status || "").toUpperCase() === "CALLED_BACK";
}

export function canReAllocate(level: number | null | undefined): boolean {
  return [3, 4, 5].includes(Number(level));
}

/**
 * Statuses that mean a stage genuinely handed the case forward, so that stage
 * becomes a legitimate previous actor for CALL_BACK.
 *
 * Deliberately excluded:
 *  - PENDING       — nobody has acted yet.
 *  - REVERTED      — that stage's hand-off was undone, so it is not an actor.
 *  - REJECTED      — terminal; no call back exists.
 *  - QUERY         — bounced to the Maker, not a forward to the next level.
 */
const FORWARD_COMPLETED_STATUSES = new Set([
  "RECOMMENDED",
  "FORWARDED",
  "REALLOCATED",
  "APPROVED",
]);

/**
 * Resolve the level of the authority that last handed this case forward, i.e.
 * the "Level N-1" in the N -> N-1 CALL_BACK rule.
 *
 * Derived from the persisted step history rather than a naive `level - 1`,
 * because conditional steps are skipped: when no DGM is posted for a branch the
 * workflow goes L3 -> L5, so the previous actor for a case pending at L5 is
 * genuinely L3, not L4. See walkthrough scenario 4.
 *
 * Falls back to `level - 1` when no completed hand-off is found (e.g. the
 * history is not loaded), which is correct for the common linear case.
 */
export function resolvePreviousActorLevel(
  approvals:
    | { approval_level?: number | null; level?: number | null; status?: string | null }[]
    | null
    | undefined,
  currentLevel: number | null | undefined,
): number | null {
  const current = Number(currentLevel) || 0;
  if (!Array.isArray(approvals) || !approvals.length || !current) return null;

  let best: number | null = null;
  for (const step of approvals) {
    const lvl = Number(step?.approval_level ?? step?.level) || 0;
    if (!lvl || lvl >= current) continue;
    if (
      !FORWARD_COMPLETED_STATUSES.has(String(step?.status || "").toUpperCase())
    )
      continue;
    if (best === null || lvl > best) best = lvl;
  }

  return best ?? current - 1;
}

/**
 * Decide whether the DSA management list should offer a Call Back action.
 *
 * Task 20C rule: a case that moved from Level N to Level N+1 may only be called
 * back by an authority at the previous level (N-1), never by the level the case
 * currently sits at. The button additionally requires that:
 *  - the row is view-only for this user (the case is not on their desk);
 *  - the case is UNCLAIMED — a claimed case is live work already owned by
 *    somebody (after a CALL_BACK the engine returns it ASSIGNED + LOCKED);
 *  - the case is not in a terminal state the backend refuses outright.
 */
export function canShowCallBackAction(params: {
  rowLocked: boolean;
  assignedUserId?: number | null;
  accessReason?: string;
  level?: number | null;
  viewerLevel?: number | null;
  previousActorLevel?: number | null;
}): boolean {
  const {
    rowLocked,
    assignedUserId,
    accessReason,
    level,
    viewerLevel,
    previousActorLevel,
  } = params;

  if (!rowLocked) return false;
  if (assignedUserId !== null && assignedUserId !== undefined) return false;
  if (accessReason === "rejected" || accessReason === "closed") return false;
  if (!viewerLevel) return false;
  // The case itself must sit at a level the backend permits CALL_BACK at.
  if (!canCallBack(level)) return false;
  // Strict N -> N-1: only the previous authority may pull it back.
  const prev = previousActorLevel ?? Number(level) - 1;
  return viewerLevel === prev;
}

/**
 * Decide whether a workflow stage was BYPASSED, and return the wording to show.
 *
 * Returns `null` when the stage was genuinely actioned (or is still ahead /
 * is the live stage) — the caller then resolves the real message.
 *
 * This is data-driven and level-agnostic, so it covers every role and any
 * conditional step, not just the DGM:
 *   1. A row explicitly marked SKIPPED (conditional step not applicable) is a
 *      recorded outcome.
 *   2. A stage with NO actioned row of its own, while the case has already
 *      moved past it, was routed around — e.g. an L3 -> L5 re-allocation skips
 *      L4, leaving L4's row PENDING. Reading `currentLevel > level` as
 *      "that level recommended" is what rendered "Recommended by DGM".
 *
 * The DGM wording is only used when the row is genuinely SKIPPED by the
 * DGM_POSTING condition; a jump over L4 gets the generic wording instead,
 * because claiming "no DGM posted" there would be false.
 */
export function resolveStageBypass(params: {
  approvals: unknown;
  level: number;
  stageCode: string;
  currentLevel: number | null;
}): string | null {
  const { approvals, level, stageCode, currentLevel } = params;

  const rows: any[] = Array.isArray(approvals)
    ? (approvals as any[]).filter(
        (a) =>
          Number(a?.approval_level) === level || a?.stage_code === stageCode,
      )
    : [];

  const DGM_BYPASS =
    "Bypassed per workflow rule (No DGM posted for branch)";
  const GENERIC_BYPASS =
    "Skipped — case routed past this level without review";

  const explicitlySkipped = rows.some(
    (a) => String(a?.status ?? "").toUpperCase() === "SKIPPED",
  );
  if (explicitlySkipped) {
    return level === 4 ? DGM_BYPASS : "Skipped per workflow rule";
  }

  // Any row this stage actually actioned? Then it was reviewed.
  const actioned = rows.filter(
    (a) =>
      Boolean(a?.actioned_at) ||
      (a?.status && String(a.status).toUpperCase() !== "PENDING"),
  );
  if (actioned.length > 0) return null;

  // Nothing pending here and the case is already further along => routed past.
  const cur = Number(currentLevel);
  if (Number.isFinite(cur) && cur > level) return GENERIC_BYPASS;

  return null;
}

/**
 * Has this stage genuinely taken an action of its own?
 *
 * A stage only "acted" if it has an actioned, non-SKIPPED row. Levels the case
 * has not reached yet (or is currently sitting at) have only a PENDING row, so
 * they return false and must never be given a "<Role> recommended" default.
 */
export function stageActed(params: {
  approvals: unknown;
  level: number;
  stageCode: string;
}): boolean {
  const { approvals, level, stageCode } = params;
  const rows: any[] = Array.isArray(approvals)
    ? (approvals as any[]).filter(
        (a) =>
          Number(a?.approval_level) === level || a?.stage_code === stageCode,
      )
    : [];

  return rows.some(
    (a) =>
      (Boolean(a?.actioned_at) ||
        (a?.status && String(a.status).toUpperCase() !== "PENDING")) &&
      String(a?.status ?? "").toUpperCase() !== "SKIPPED",
  );
}

/**
 * Full display text for one stage, for the Decisions panel.
 *
 *   1. Bypassed (routed past)        -> bypass wording
 *   2. Real recorded remarks        -> as entered by the authority
 *   3. `defaultText`                -> ONLY when the stage actually acted
 *   4. ""                           -> level not reached / currently live
 *
 * Step 3 is gated on an actioned row precisely so an upcoming stage cannot
 * claim to have reviewed the case.
 */
export function resolveStageRemarksForDisplay(params: {
  approvals: unknown;
  level: number;
  stageCode: string;
  currentLevel: number | null;
  statusReason?: string | null;
  statusReasonAction?: string | null;
  defaultText?: string;
}): string {
  const {
    approvals,
    level,
    stageCode,
    currentLevel,
    statusReason = null,
    statusReasonAction = null,
    defaultText = "",
  } = params;

  const bypass = resolveStageBypass({
    approvals,
    level,
    stageCode,
    currentLevel,
  });
  if (bypass) return bypass;

  return resolveStageRemarks({
    approvals,
    level,
    stageCode,
    statusReason,
    statusReasonAction,
    fallback: stageActed({ approvals, level, stageCode }) ? defaultText : "",
  });
}

/**
 * Resolve the real, recorded message for one workflow stage.
 *
 * The per-level UI must never invent a generic "Recommended by <role>" when
 * the case was actually re-allocated, forwarded or called back — that generic
 * text is what mislabelled a level-jumping hand-off (e.g. L3 -> L5 with no DGM
 * posted).
 *
 * Resolution order:
 *   1. Remarks on the stage's own newest actioned row.
 *   2. Remarks on any earlier actioned row of that stage — a prior RE_ALLOCATE
 *      reason is the meaningful text when the newest row is a bare placeholder.
 *   3. `statusReason`, but ONLY when it describes THIS stage's own last action
 *      (row status === statusReasonAction). This surfaces the real
 *      "Re-allocated from X to Y (...)" / "Called back ..." message on the
 *      correct stage, and prevents it leaking onto other stages.
 *   4. `fallback` (the stage-specific generic default).
 *
 * A skipped stage keeps its own explicit "bypassed" wording — that is a real
 * recorded outcome, so callers should short-circuit on SKIPPED before this.
 */
export function resolveStageRemarks(params: {
  approvals: unknown;
  level: number;
  stageCode: string;
  statusReason?: string | null;
  statusReasonAction?: string | null;
  fallback?: string;
}): string {
  const {
    approvals,
    level,
    stageCode,
    statusReason = null,
    statusReasonAction = null,
    fallback = "",
  } = params;

  const rows: any[] = Array.isArray(approvals)
    ? (approvals as any[]).filter(
        (a) =>
          Number(a?.approval_level) === level || a?.stage_code === stageCode,
      )
    : [];

  // Actioned rows only: a re-armed PENDING placeholder has no message.
  const actioned = rows
    .filter(
      (a) =>
        Boolean(a?.actioned_at) ||
        (a?.status && String(a.status).toUpperCase() !== "PENDING"),
    )
    .sort((a, b) => {
      const aT = a?.actioned_at ? new Date(a.actioned_at).getTime() : 0;
      const bT = b?.actioned_at ? new Date(b.actioned_at).getTime() : 0;
      if (aT !== bT) return bT - aT;
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    });

  const withRemarks = actioned.find(
    (a) => String(a?.remarks ?? "").trim() !== "",
  );
  if (withRemarks) return String(withRemarks.remarks).trim();

  const latest = actioned[0];
  const reason = String(statusReason ?? "").trim();
  if (
    latest &&
    reason &&
    String(latest?.status ?? "").toUpperCase() ===
      String(statusReasonAction ?? "").toUpperCase()
  ) {
    return reason;
  }

  return fallback;
}

// ---------------------------------------------------------------------------
// Self-check mirroring the backend matrix. Run with:
//   DSA_WORKFLOW_ACTIONS_CHECK=1 node <compiled>
// ---------------------------------------------------------------------------
if (
  typeof process !== "undefined" &&
  process.env?.DSA_WORKFLOW_ACTIONS_CHECK
) {
  const expected: Record<number, string[]> = {
    1: ["RECOMMEND"],
    2: ["RECOMMEND", "REJECT"],
    3: ["RECOMMEND", "REJECT", "REVERT", "RE_ALLOCATE", "FORWARD"],
    4: ["RECOMMEND", "REJECT", "REVERT", "CALL_BACK", "RE_ALLOCATE", "FORWARD"],
    5: ["RECOMMEND", "REJECT", "REVERT", "CALL_BACK", "RE_ALLOCATE", "FORWARD"],
    6: ["RECOMMEND", "REJECT", "REVERT", "FORWARD", "CALL_BACK"],
    7: ["APPROVE", "REJECT"],
  };

  let failed = 0;
  for (const [level, want] of Object.entries(expected)) {
    const got = allowedWorkflowActions(Number(level));
    const ok =
      got.length === want.length && got.every((a, i) => a === want[i]);
    if (!ok) failed++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  L${level} -> [${got.join(", ")}]`,
    );
  }

  // CALL_BACK shown at the levels the backend allows on the pending step.
  const cb = [1, 2, 3, 4, 5, 6, 7].map((l) => canCallBack(l));
  const cbOk = JSON.stringify(cb) === JSON.stringify([false, false, false, true, true, true, false]);
  if (!cbOk) failed++;
  console.log(`${cbOk ? "PASS" : "FAIL"}  CALL_BACK levels -> [${cb.join(", ")}]`);

  // RE_ALLOCATE restricted to L3/L4/L5.
  const ra = [1, 2, 3, 4, 5, 6, 7].map((l) => canReAllocate(l));
  const raOk = JSON.stringify(ra) === JSON.stringify([false, false, true, true, true, false, false]);
  if (!raOk) failed++;
  console.log(`${raOk ? "PASS" : "FAIL"}  RE_ALLOCATE levels -> [${ra.join(", ")}]`);

  // ---- resolveStageRemarks: real message must beat the generic default ----
  const stageCases: [string, string][] = [
    [
      "L3 RE_ALLOCATE keeps the re-allocation reason",
      resolveStageRemarks({
        approvals: [{ id: 1, approval_level: 3, status: "REALLOCATED", remarks: "Re-allocating to Region Head for expedited approval." }],
        level: 3,
        stageCode: "LEVEL_3_SUB_REGION_HEAD",
        fallback: "Recommended by Sub-Region Head",
      }),
    ],
    [
      "L4 CALL_BACK (remarks null) falls back to status_reason",
      resolveStageRemarks({
        approvals: [{ id: 2, approval_level: 4, status: "CALLED_BACK", remarks: null }],
        level: 4,
        stageCode: "LEVEL_4_DGM",
        statusReason: "Called back to DGM for clarification.",
        statusReasonAction: "CALLED_BACK",
        fallback: "Recommended by DGM",
      }),
    ],
    [
      "L4 RE_ALLOCATED with null remarks falls back to status_reason",
      resolveStageRemarks({
        approvals: [{ id: 3, approval_level: 4, status: "REALLOCATED", remarks: null }],
        level: 4,
        stageCode: "LEVEL_4_DGM",
        statusReason: "Re-allocated from [DGM] to [Region Head] (Anil)",
        statusReasonAction: "REALLOCATED",
        fallback: "Recommended by DGM",
      }),
    ],
    [
      "PENDING placeholder never wins over an earlier RE_ALLOCATE reason",
      resolveStageRemarks({
        approvals: [
          { id: 4, approval_level: 5, status: "REALLOCATED", remarks: "Re-allocating onward.", actioned_at: "2026-01-01T10:00:00Z" },
          { id: 9, approval_level: 5, status: "PENDING", remarks: null, actioned_at: null },
        ],
        level: 5,
        stageCode: "LEVEL_5_REGION_HEAD",
        fallback: "Recommended by Region Head",
      }),
    ],
    [
      "status_reason must NOT leak onto a stage that did not cause it",
      resolveStageRemarks({
        approvals: [{ id: 5, approval_level: 3, status: "RECOMMENDED", remarks: null }],
        level: 3,
        stageCode: "LEVEL_3_SUB_REGION_HEAD",
        statusReason: "Re-allocated from [DGM] to [Region Head] (Anil)",
        statusReasonAction: "REALLOCATED",
        fallback: "Recommended by Sub-Region Head",
      }),
    ],
    [
      "plain RECOMMEND with no remarks still uses the generic default",
      resolveStageRemarks({
        approvals: [{ id: 6, approval_level: 6, status: "RECOMMENDED", remarks: null }],
        level: 6,
        stageCode: "LEVEL_6_HO_CREDIT_OFFICER",
        fallback: "Credit appraisal recommended for sanction",
      }),
    ],
    [
      "L7 APPROVED remark wins over the sanction default",
      resolveStageRemarks({
        approvals: [{ id: 7, approval_level: 7, status: "APPROVED", remarks: "Sanctioned as per terms discussed." }],
        level: 7,
        stageCode: "LEVEL_7_HO_CREDIT_HEAD",
        fallback: "Final Sanction & Approval granted by HO Credit Head",
      }),
    ],
  ];

  const expectedByCase: Record<string, string> = {
    "L3 RE_ALLOCATE keeps the re-allocation reason":
      "Re-allocating to Region Head for expedited approval.",
    "L4 CALL_BACK (remarks null) falls back to status_reason":
      "Called back to DGM for clarification.",
    "L4 RE_ALLOCATED with null remarks falls back to status_reason":
      "Re-allocated from [DGM] to [Region Head] (Anil)",
    "PENDING placeholder never wins over an earlier RE_ALLOCATE reason":
      "Re-allocating onward.",
    "status_reason must NOT leak onto a stage that did not cause it":
      "Recommended by Sub-Region Head",
    "plain RECOMMEND with no remarks still uses the generic default":
      "Credit appraisal recommended for sanction",
    "L7 APPROVED remark wins over the sanction default":
      "Sanctioned as per terms discussed.",
  };

  for (const [name, got] of stageCases) {
    const want = expectedByCase[name];
    const ok = got === want && String(got).trim() !== "";
    if (!ok) failed++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name} -> "${got}"${ok ? "" : ` (expected "${want}")`}`,
    );
  }

  // ---- resolveStageBypass: a routed-past stage must never read as reviewed ----
  const L3_5_JUMP = [
    { id: 1, approval_level: 1, status: "RECOMMENDED", remarks: "L1 done" },
    { id: 2, approval_level: 2, status: "RECOMMENDED", remarks: "L2 done" },
    { id: 3, approval_level: 3, status: "REALLOCATED", remarks: "Jumping L3 -> L5." },
    // L4 was NEVER actioned and stays PENDING after the jump — this is the row
    // that used to render "Recommended by DGM".
    { id: 4, approval_level: 4, status: "PENDING", remarks: null },
    { id: 5, approval_level: 5, status: "PENDING", remarks: null },
  ];

  const bypassCases: [string, string | null][] = [
    [
      "L3->L5 jump: L4 reads as routed past, not recommended",
      resolveStageBypass({
        approvals: L3_5_JUMP,
        level: 4,
        stageCode: "LEVEL_4_DGM",
        currentLevel: 5,
      }),
    ],
    [
      "L3->L5 jump: the level that acted (L3) is NOT bypassed",
      resolveStageBypass({
        approvals: L3_5_JUMP,
        level: 3,
        stageCode: "LEVEL_3_SUB_REGION_HEAD",
        currentLevel: 5,
      }),
    ],
    [
      "L3->L5 jump: the live level (L5) is NOT bypassed",
      resolveStageBypass({
        approvals: L3_5_JUMP,
        level: 5,
        stageCode: "LEVEL_5_REGION_HEAD",
        currentLevel: 5,
      }),
    ],
    [
      "genuinely SKIPPED L4 keeps the DGM wording",
      resolveStageBypass({
        approvals: [{ id: 9, approval_level: 4, status: "SKIPPED", remarks: null }],
        level: 4,
        stageCode: "LEVEL_4_DGM",
        currentLevel: 5,
      }),
    ],
    [
      "a stage that DID act is never bypassed, even when passed",
      resolveStageBypass({
        approvals: [{ id: 8, approval_level: 4, status: "RECOMMENDED", remarks: "DGM approved" }],
        level: 4,
        stageCode: "LEVEL_4_DGM",
        currentLevel: 6,
      }),
    ],
    [
      "a REJECTED stage is never bypassed",
      resolveStageBypass({
        approvals: [{ id: 7, approval_level: 4, status: "REJECTED", remarks: "no" }],
        level: 4,
        stageCode: "LEVEL_4_DGM",
        currentLevel: 4,
      }),
    ],
    [
      "levels still ahead of the case are never bypassed",
      resolveStageBypass({
        approvals: [{ id: 6, approval_level: 6, status: "PENDING", remarks: null }],
        level: 6,
        stageCode: "LEVEL_6_HO_CREDIT_OFFICER",
        currentLevel: 3,
      }),
    ],
  ];

  const bypassExpected: (string | null)[] = [
    "Skipped — case routed past this level without review",
    null,
    null,
    "Bypassed per workflow rule (No DGM posted for branch)",
    null,
    null,
    null,
  ];

  bypassCases.forEach(([name, got], i) => {
    const want = bypassExpected[i];
    const ok = got === want;
    if (!ok) failed++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name} -> ${got === null ? "null" : `"${got}"`}${ok ? "" : ` (expected ${want === null ? "null" : `"${want}"`})`}`,
    );
  });

  // ---- resolveStageRemarksForDisplay: defaults only for stages that ACTED ----
  // Mirrors the reported bug: case at L5 after an L3 -> L5 re-allocation.
  // L4 routed past (skipped), L5 live, L6/L7 not reached. Only L3 acted.
  const PANEL_ROWS = [
    { id: 1, approval_level: 1, status: "RECOMMENDED", remarks: "L1 done" },
    { id: 2, approval_level: 2, status: "RECOMMENDED", remarks: "L2 done" },
    { id: 3, approval_level: 3, status: "REALLOCATED", remarks: "Jumping L3 -> L5." },
    { id: 4, approval_level: 4, status: "PENDING", remarks: null },
    { id: 5, approval_level: 5, status: "PENDING", remarks: null },
    { id: 6, approval_level: 6, status: "PENDING", remarks: null },
    { id: 7, approval_level: 7, status: "PENDING", remarks: null },
  ];

  const panel = (level: number, code: string, def: string) =>
    resolveStageRemarksForDisplay({
      approvals: PANEL_ROWS,
      level,
      stageCode: code,
      currentLevel: 5,
      statusReason: "Re-allocated from [Sub-Region Head] to [Region Head] (Anil)",
      statusReasonAction: "REALLOCATED",
      defaultText: def,
    });

  const panelCases: [string, string][] = [
    ["L4 routed past shows the skipped wording", panel(4, "LEVEL_4_DGM", "Recommended by DGM")],
    ["L5 live level shows NO default", panel(5, "LEVEL_5_REGION_HEAD", "Recommended by Region Head")],
    ["L6 not reached shows NO default", panel(6, "LEVEL_6_HO_CREDIT_OFFICER", "Credit appraisal recommended for sanction")],
    ["L7 not reached shows NO default", panel(7, "LEVEL_7_HO_CREDIT_HEAD", "Final Sanction & Approval granted by HO Credit Head")],
    ["L3 keeps the real re-allocation reason", panel(3, "LEVEL_3_SUB_REGION_HEAD", "Recommended by Sub-Region Head")],
  ];

  const panelExpected = [
    "Skipped — case routed past this level without review",
    "",
    "",
    "",
    "Jumping L3 -> L5.",
  ];

  panelCases.forEach(([name, got], i) => {
    const want = panelExpected[i];
    const ok = got === want;
    if (!ok) failed++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name} -> ${got === "" ? "(empty)" : `"${got}"`}${ok ? "" : ` (expected ${want === "" ? "(empty)" : `"${want}"`})`}`,
    );
  });

  // A stage that DID act but recorded no remarks still gets its default.
  const actedNoRemarks = resolveStageRemarksForDisplay({
    approvals: [{ id: 20, approval_level: 6, status: "RECOMMENDED", remarks: null }],
    level: 6,
    stageCode: "LEVEL_6_HO_CREDIT_OFFICER",
    currentLevel: 7,
    defaultText: "Credit appraisal recommended for sanction",
  });
  const actedOk = actedNoRemarks === "Credit appraisal recommended for sanction";
  if (!actedOk) failed++;
  console.log(`${actedOk ? "PASS" : "FAIL"}  acted stage with no remarks keeps its default -> "${actedNoRemarks}"`);

  // N -> N-1 rule, walked through the walkthrough's own scenarios.
  // `prev` is resolvePreviousActorLevel(approvals, level) for each case.
  const nMinus1: [string, boolean, boolean][] = [
    [
      "S1 L3<-L4: only L3 sees it (case at L4)",
      true,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "not_my_stage", level: 4, viewerLevel: 3, previousActorLevel: 3 }),
    ],
    [
      "S1 L4 (current owner) must NOT see it",
      false,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "not_my_stage", level: 4, viewerLevel: 4, previousActorLevel: 3 }),
    ],
    [
      "S2 L4<-L5: only L4 sees it (case at L5)",
      true,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "not_my_stage", level: 5, viewerLevel: 4, previousActorLevel: 4 }),
    ],
    [
      "S2 L5 (current owner) must NOT see it",
      false,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "not_my_stage", level: 5, viewerLevel: 5, previousActorLevel: 4 }),
    ],
    [
      "S3 L5<-L6: only L5 sees it (case at L6)",
      true,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "not_my_stage", level: 6, viewerLevel: 5, previousActorLevel: 5 }),
    ],
    [
      "called back => claimed => nobody sees it",
      false,
      canShowCallBackAction({ rowLocked: true, assignedUserId: 8, accessReason: "not_my_stage", level: 4, viewerLevel: 3, previousActorLevel: 3 }),
    ],
    [
      "case on my own desk => hidden",
      false,
      canShowCallBackAction({ rowLocked: false, assignedUserId: null, accessReason: "allowed", level: 4, viewerLevel: 3, previousActorLevel: 3 }),
    ],
    [
      "rejected => hidden",
      false,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "rejected", level: 4, viewerLevel: 3, previousActorLevel: 3 }),
    ],
    [
      "L3 pending => backend has no CALL_BACK here",
      false,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "not_my_stage", level: 3, viewerLevel: 2, previousActorLevel: 2 }),
    ],
    [
      "admin (no level) => hidden",
      false,
      canShowCallBackAction({ rowLocked: true, assignedUserId: null, accessReason: "not_my_stage", level: 4, viewerLevel: null, previousActorLevel: 3 }),
    ],
  ];
  for (const [name, want, got] of nMinus1) {
    const ok = got === want;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} -> ${got} (expected ${want})`);
  }

  // Scenario 4: DGM not posted, so the workflow goes L3 -> L5 and the
  // previous actor for a case pending at L5 is genuinely L3, not L4.
  const skippedDgm = resolvePreviousActorLevel(
    [
      { approval_level: 1, status: "RECOMMENDED" },
      { approval_level: 2, status: "RECOMMENDED" },
      { approval_level: 3, status: "RECOMMENDED" },
      { approval_level: 5, status: "PENDING" },
    ],
    5,
  );
  const s4Ok = skippedDgm === 3;
  if (!s4Ok) failed++;
  console.log(`${s4Ok ? "PASS" : "FAIL"}  S4 skipped-DGM previous actor -> ${skippedDgm} (expected 3)`);

  // A REVERTED hand-off must not count as a previous actor.
  const afterRevert = resolvePreviousActorLevel(
    [
      { approval_level: 3, status: "RECOMMENDED" },
      { approval_level: 4, status: "REVERTED" },
      { approval_level: 3, status: "PENDING" },
    ],
    3,
  );
  const revertOk = afterRevert === 2;
  if (!revertOk) failed++;
  console.log(`${revertOk ? "PASS" : "FAIL"}  REVERTED ignored as actor -> ${afterRevert} (expected 2)`);

  console.log(failed === 0 ? "\nAll matrix checks passed." : `\n${failed} check(s) FAILED.`);
  if (failed > 0) process.exitCode = 1;
}
