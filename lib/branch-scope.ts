import type { DemoSessionUser } from "@/types/auth";
import type { BranchOption } from "@/types/dsa";
import { authService } from "@/services/authService";
import { adminApi } from "@/apis/admin";

export interface UserBranchScope {
  isBranchRestricted: boolean;
  branchCodes: string[];
  branchIds: number[];
  branchNames: string[];
  primaryBranchCode?: string;
  primaryBranchName?: string;
  selectedBranchCode?: string;
  activeBranchIds: number[];
  assignedBranches: Array<{ branch_code: string; branch_name: string; id?: number }>;
}

const ACTIVE_BRANCH_STORAGE_KEY = "cosmos_active_branch_code";

export function getActiveBranchCode(): string {
  if (typeof window === "undefined") return "ALL";
  return localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY) || "ALL";
}

export function setActiveBranchCode(code: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, code);
  window.dispatchEvent(new CustomEvent("branch:change", { detail: { branchCode: code } }));
}

let cachedBranches: BranchOption[] | null = null;

export async function getCachedBranches(): Promise<BranchOption[]> {
  if (cachedBranches && cachedBranches.length > 0) {
    return cachedBranches;
  }
  try {
    const res = await adminApi.getBranchesDropdown();
    if (res?.data && Array.isArray(res.data)) {
      cachedBranches = res.data;
      return cachedBranches;
    }
  } catch (err) {
    console.warn("Failed to load branches for scoping:", err);
  }
  return cachedBranches ?? [];
}

export function getUserBranchScopeSync(
  currentUser: DemoSessionUser | null,
  branches: BranchOption[] = []
): UserBranchScope {
  const user = authService.getUser();
  const roles = authService.getRoles().map((r) => r.toLowerCase());
  const sessionRole = (currentUser?.role || "").toLowerCase();

  // Super admin / Admin / DSA Manager are NOT branch restricted
  const isSuperAdmin =
    roles.includes("super_admin") ||
    roles.includes("admin") ||
    sessionRole === "dsa manager";

  // Makers and Checkers are strictly restricted to their assigned branch
  const isMaker =
    roles.includes("maker") ||
    roles.includes("assistant_manager") ||
    sessionRole === "branch user" ||
    sessionRole === "maker" ||
    sessionRole === "assistant manager";

  const isChecker =
    roles.includes("checker") ||
    sessionRole === "checker" ||
    (sessionRole === "manager" && !isSuperAdmin);

  const isBranchRestricted = !isSuperAdmin && (isMaker || isChecker);

  const codeSet = new Set<string>();
  const primaryCode = (user?.branch_code || currentUser?.branch_code || currentUser?.code || "").trim().toUpperCase();
  if (primaryCode) {
    codeSet.add(primaryCode);
  }
  if (Array.isArray(user?.branch_codes)) {
    for (const c of user.branch_codes) {
      const normalized = String(c || "").trim().toUpperCase();
      if (normalized) codeSet.add(normalized);
    }
  }
  if (Array.isArray((user as any)?.branch_mappings)) {
    for (const m of (user as any).branch_mappings) {
      const normalized = String(m?.branch_code || "").trim().toUpperCase();
      if (normalized) codeSet.add(normalized);
    }
  }
  if (Array.isArray(currentUser?.branch_codes)) {
    for (const c of currentUser.branch_codes) {
      const normalized = String(c || "").trim().toUpperCase();
      if (normalized) codeSet.add(normalized);
    }
  }
  if (Array.isArray(currentUser?.branch_mappings)) {
    for (const m of currentUser.branch_mappings) {
      const normalized = String(m?.branch_code || "").trim().toUpperCase();
      if (normalized) codeSet.add(normalized);
    }
  }

  const branchCodes = Array.from(codeSet);
  const isRestrictedRole = isBranchRestricted || (!isSuperAdmin && branchCodes.length > 0);

  if (!isRestrictedRole) {
    return {
      isBranchRestricted: false,
      branchCodes: [],
      branchIds: [],
      branchNames: [],
      selectedBranchCode: "ALL",
      activeBranchIds: [],
      assignedBranches: [],
    };
  }

  const branchIds: number[] = [];
  const branchNames: string[] = [];
  let primaryBranchName: string | undefined = undefined;

  for (const b of branches) {
    const bCode = (b.branch_code || "").trim().toUpperCase();
    if (codeSet.has(bCode)) {
      if (b.id != null) branchIds.push(Number(b.id));
      if (b.branch_name) {
        branchNames.push(b.branch_name.trim().toLowerCase());
        if (bCode === primaryCode && !primaryBranchName) {
          primaryBranchName = b.branch_name;
        }
      }
    }
  }

  const assignedBranches: Array<{ branch_code: string; branch_name: string; id?: number }> = [];
  for (const bCode of branchCodes) {
    const matched = branches.find((b) => (b.branch_code || "").trim().toUpperCase() === bCode);
    assignedBranches.push({
      branch_code: bCode,
      branch_name: matched?.branch_name || bCode,
      id: matched?.id != null ? Number(matched.id) : undefined,
    });
  }

  const storedSelected = getActiveBranchCode();
  const selectedBranchCode =
    storedSelected === "ALL" || codeSet.has(storedSelected.toUpperCase())
      ? storedSelected
      : "ALL";

  const activeBranchIds: number[] = [];
  if (selectedBranchCode && selectedBranchCode !== "ALL") {
    const selUpper = selectedBranchCode.toUpperCase();
    const matched = assignedBranches.find((b) => b.branch_code.toUpperCase() === selUpper);
    if (matched?.id != null) {
      activeBranchIds.push(matched.id);
    }
  } else {
    activeBranchIds.push(...branchIds);
  }

  return {
    isBranchRestricted: true,
    branchCodes,
    branchIds,
    branchNames,
    primaryBranchCode: primaryCode || undefined,
    primaryBranchName,
    selectedBranchCode,
    activeBranchIds,
    assignedBranches,
  };
}

export async function getUserBranchScope(
  currentUser: DemoSessionUser | null
): Promise<UserBranchScope> {
  const branches = await getCachedBranches();
  return getUserBranchScopeSync(currentUser, branches);
}

export function isDsaInBranchScope(
  dsa: any,
  scope: UserBranchScope,
  checkAssignedOnly = false
): boolean {
  if (!scope.isBranchRestricted) return true;
  if (!dsa) return false;

  // If a specific branch is selected (not "ALL") and we are filtering for views:
  if (!checkAssignedOnly && scope.selectedBranchCode && scope.selectedBranchCode !== "ALL") {
    const targetCode = scope.selectedBranchCode.trim().toUpperCase();
    const dsaBranchCode = (dsa.branch?.branch_code || dsa.branch_code || "").trim().toUpperCase();
    if (dsaBranchCode && dsaBranchCode === targetCode) {
      return true;
    }
    const targetBranch = scope.assignedBranches?.find(
      (b) => b.branch_code.toUpperCase() === targetCode
    );
    const dsaBranchId = dsa.branch_id ?? dsa.branchId ?? dsa.branch?.id;
    if (targetBranch?.id != null && dsaBranchId != null && Number(dsaBranchId) === Number(targetBranch.id)) {
      return true;
    }
    return false;
  }

  // 1. Match by branch_id
  const dsaBranchId = dsa.branch_id ?? dsa.branchId ?? dsa.branch?.id;
  if (dsaBranchId != null && scope.branchIds.includes(Number(dsaBranchId))) {
    return true;
  }

  // 2. Match by branch_code
  const dsaBranchCode = (dsa.branch?.branch_code || dsa.branch_code || "").trim().toUpperCase();
  if (dsaBranchCode && scope.branchCodes.includes(dsaBranchCode)) {
    return true;
  }

  // 3. Match by branch_name
  const dsaBranchName = (dsa.branch_name || dsa.branch?.branch_name || "").trim().toLowerCase();
  if (dsaBranchName && scope.branchNames.some((n) => n.trim().toLowerCase() === dsaBranchName)) {
    return true;
  }

  return false;
}
