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
