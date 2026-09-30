import type { Dsa } from "@/types/dsa";

/**
 * Task 22 — Case access control (frontend mirror of backend rules).
 *
 * The backend is the source of truth and enforces these on
 * `POST /dsa/{id}/acquire-case` via
 * DsaCaseAssignmentService::validateUserEligibilityForDsa(). This module
 * exists so the UI can withhold the detail view entirely instead of showing a
 * page the API would refuse to act on, and so a user cannot lock a case that
 * has moved past their stage.
 */

/** Normalises a role string the same way the rest of the DSA module does. */
export function normalizeRole(role?: string | null): string {
  return String(role || "")
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
}

/**
 * Maps a user to the workflow level (1-7) they are authoritative for.
 * Returns null for roles outside the chain (Admin / Super Admin), who keep
 * blanket visibility. Mirrors DsaCaseAssignmentService::resolveUserLevel().
 *
 * IMPORTANT: branches are evaluated HIGHEST level first. Real users hold
 * several roles at once (e.g. a DGM also carries a legacy "Sub-Region
 * Checker" grant), so matching L1-first would let that generic L2 role shadow
 * their actual posting and put them at the wrong desk.
 */
export function resolveUserLevel(role?: string | null): number | null {
  const n = normalizeRole(role);
  if (!n) return null;
  if (n === "ADMIN" || n === "SUPERADMIN") return null;

  if (
    ["HOCREDITHEAD", "CREDITHEAD", "HEADOFFICECREDITHEAD", "LEVEL7HOCREDITHEAD", "APPROVINGAUTHORITY"].includes(n)
  )
    return 7;
  if (
    ["HOCREDITOFFICER", "CREDITOFFICER", "HOCREDIT", "DSACREDIT", "LEVEL6HOCREDITOFFICER", "4THRECOMMENDINGAUTHORITY"].includes(n)
  )
    return 6;
  if (
    ["REGIONHEAD", "REGIONALHEAD", "BRANCHREGIONALHEAD", "LEVEL5REGIONHEAD", "3RDRECOMMENDINGAUTHORITY"].includes(n)
  )
    return 5;
  if (["DGM", "DEPUTYGENERALMANAGER", "LEVEL4DGM", "2NDRECOMMENDINGAUTHORITY"].includes(n))
    return 4;
  if (
    ["AGM", "SUBREGIONHEAD", "LEVEL3SUBREGIONHEAD", "1STRECOMMENDINGAUTHORITY"].includes(n)
  )
    return 3;
  if (
    ["CHECKER", "BRANCHCHECKER", "SUBREGIONSTAFF", "SUBREGIONCHECKER", "DSACHECKER", "LEVEL2CHECKER"].includes(n)
  )
    return 2;
  if (
    ["MAKER", "BRANCHMAKER", "BRANCHUSER", "SUBREGIONMAKER", "DSAMAKER", "STAFF", "LEVEL1MAKER"].includes(n)
  )
    return 1;

  return null;
}

export type CaseAccessReason =
  | "allowed"
  | "not_my_stage"
  | "rejected"
  | "closed";

/**
 * Human-readable reason a row is read-only in the management list.
 * Kept next to the resolver so the list and the detail view can never
 * disagree about why a case is not actionable.
 */
export function describeCaseLock(
  reason: CaseAccessReason,
  caseLevel?: number | null,
): string {
  switch (reason) {
    case "rejected":
      return "Rejected — this case is closed to everyone. Visible in All and Rejected only.";
    case "closed":
      return "Approved — post-sanction work sits with Maker/Checker.";
    case "not_my_stage":
      return caseLevel
        ? `At Level ${caseLevel} — awaiting that authority. Read-only.`
        : "Assigned to another authority. Read-only.";
    default:
      return "";
  }
}

/**
 * Decides whether `role` may open and act on this DSA.
 *
 * - Admin / Super Admin: always allowed.
 * - Rejected cases: blocked for every role, including Admin. They remain
 *   listed in the All and Rejected buckets as a record but cannot be opened.
 * - Approved / closed cases: only the chain role that owns the terminal state
 *   may still open it, so post-approval agreement work stays with
 *   Maker/Checker; everyone else is blocked.
 * - Otherwise: only the authority whose level matches the case's current
 *   level. Once a case advances, previous levels are locked out until a
 *   query/revert sends it back to their stage.
 */
export function resolveCaseAccess(
  dsa: Pick<
    Dsa,
    "onboarding_status" | "current_approval_level" | "agreement_status" | "operational_status"
  > | null,
  role?: string | null,
): { allowed: boolean; reason: CaseAccessReason; level: number | null } {
  if (!dsa) return { allowed: false, reason: "not_my_stage", level: null };

  const status = String(dsa.onboarding_status || "").toUpperCase();

  // Rejected is a hard dead-end: nobody can open the case, regardless of
  // role, level, or who currently holds the lock. It remains listed in the
  // All and Rejected buckets as a record only. Evaluated before the
  // privileged bypass below so Admin/Super Admin are blocked as well.
  if (status === "REJECTED") {
    return { allowed: false, reason: "rejected", level: null };
  }

  // Fail closed: without a *recognised* role we cannot prove the case is
  // yours, so withhold the detail view rather than guessing. Admin /
  // Super Admin are explicitly recognised and keep blanket visibility.
  const normalizedRole = normalizeRole(role);
  const isPrivileged = normalizedRole === "ADMIN" || normalizedRole === "SUPERADMIN";
  const level = resolveUserLevel(role);
  if (level === null && !isPrivileged) {
    return { allowed: false, reason: "not_my_stage", level: null };
  }
  const caseLevel = Number(dsa.current_approval_level) || 1;
  const agreementStatus = String(dsa.agreement_status || "").toUpperCase();
  const operationalStatus = String(dsa.operational_status || "").toUpperCase();

  // Non-chain roles (Admin/Super Admin) retain blanket visibility.
  if (level === null) return { allowed: true, reason: "allowed", level: null };

  // Closed cases stay with the post-sanction Maker/Checker only.
  const isClosed =
    status === "APPROVED" ||
    status === "AGREEMENT_PENDING" ||
    status === "AGREEMENT_COMPLETED" ||
    agreementStatus === "SIGNED_VERIFIED" ||
    operationalStatus === "ACTIVE";

  if (isClosed) {
    return level === 1 || level === 2
      ? { allowed: true, reason: "allowed", level }
      : { allowed: false, reason: "closed", level };
  }

  if (level !== caseLevel) {
    return { allowed: false, reason: "not_my_stage", level };
  }

  return { allowed: true, reason: "allowed", level };
}

/**
 * Small badge shown on a row that exists in a list but cannot be opened by
 * the current role. Shared by the DSA management table and every dashboard
 * tracker so the wording and styling cannot drift apart.
 */
export const CASE_VIEW_ONLY_BADGE_CLASS =
  "inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500";

export const CASE_VIEW_ONLY_ROW_CLASS = "bg-slate-50/60 opacity-70";

// ---------------------------------------------------------------------------
// Self-check for the access matrix. Run with:
//   npx tsx scratch/dsa-case-access.check.ts
// (or paste into a scratch file and run with ts-node / any TS runner)
// ---------------------------------------------------------------------------
if (process.env.DSA_CASE_ACCESS_CHECK) {
  const mk = (over: Record<string, unknown>) =>
    ({
      onboarding_status: "SUBMITTED",
      current_approval_level: 1,
      agreement_status: null,
      operational_status: "NOT_ACTIVE",
      ...over,
    }) as never;

  const cases: [string, boolean, ReturnType<typeof resolveCaseAccess>][] = [
    ["Maker at L1", true, resolveCaseAccess(mk({ current_approval_level: 1 }), "Maker")],
    ["L2 at L2", true, resolveCaseAccess(mk({ current_approval_level: 2 }), "Checker")],
    ["L2 blocked at L3", false, resolveCaseAccess(mk({ current_approval_level: 3 }), "Checker")],
    ["L3 allowed at L3", true, resolveCaseAccess(mk({ current_approval_level: 3 }), "AGM")],
    ["L7 allowed at L7", true, resolveCaseAccess(mk({ current_approval_level: 7 }), "HO Credit Head")],
    ["Rejected -> Maker blocked", false, resolveCaseAccess(mk({ onboarding_status: "REJECTED" }), "Maker")],
    ["Rejected -> Checker blocked", false, resolveCaseAccess(mk({ onboarding_status: "REJECTED" }), "Checker")],
    ["Rejected -> L7 blocked", false, resolveCaseAccess(mk({ onboarding_status: "REJECTED" }), "HO Credit Head")],
    ["Rejected -> Admin blocked", false, resolveCaseAccess(mk({ onboarding_status: "REJECTED" }), "Super Admin")],
    ["Rejected+locked -> Maker blocked", false, resolveCaseAccess(mk({ onboarding_status: "REJECTED", operational_status: "ACTIVE" }), "Maker")],
    ["Approved -> Checker", true, resolveCaseAccess(mk({ onboarding_status: "APPROVED" }), "Checker")],
    ["Approved -> AGM", false, resolveCaseAccess(mk({ onboarding_status: "APPROVED" }), "AGM")],
    ["Active -> Maker", true, resolveCaseAccess(mk({ operational_status: "ACTIVE" }), "Maker")],
    ["Admin anywhere", true, resolveCaseAccess(mk({ current_approval_level: 5 }), "Super Admin")],
    ["Blank role fails closed", false, resolveCaseAccess(mk({ current_approval_level: 1 }), "")],
    ["Unknown role fails closed", false, resolveCaseAccess(mk({ current_approval_level: 1 }), "Intern")],
    ["Reverted to L2 (Checker)", true, resolveCaseAccess(mk({ current_approval_level: 2 }), "Checker")],
  ];

  let failed = 0;
  for (const [name, expected, actual] of cases) {
    const ok = actual.allowed === expected;
    if (!ok) failed++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name} -> allowed=${actual.allowed} (expected ${expected}), reason=${actual.reason}`,
    );
  }
  console.log(failed === 0 ? "\nAll access-matrix checks passed." : `\n${failed} check(s) FAILED.`);
  if (failed > 0) process.exitCode = 1;
}
