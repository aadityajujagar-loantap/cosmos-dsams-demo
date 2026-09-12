import type { DemoSessionUser } from "@/lib/demo-identities";
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

  if (!isBranchRestricted) {
    return {
      isBranchRestricted: false,
      branchCodes: [],
      branchIds: [],
      branchNames: [],
    };
  }

  const codeSet = new Set<string>();
  const primaryCode = (user?.branch_code || currentUser?.code || "").trim().toUpperCase();
  if (primaryCode) {
    codeSet.add(primaryCode);
  }

  const branchCodes = Array.from(codeSet);
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

  // Fallback defaults for well-known test branches if dropdown has not loaded yet
  if (!primaryBranchName && primaryCode === "BR001") {
    primaryBranchName = "Main Branch";
    if (!branchIds.includes(1)) branchIds.push(1);
    if (!branchNames.includes("main branch")) branchNames.push("main branch");
  } else if (!primaryBranchName && primaryCode === "BR002") {
    primaryBranchName = "Deccan Branch";
    if (!branchIds.includes(2)) branchIds.push(2);
    if (!branchNames.includes("deccan branch")) branchNames.push("deccan branch");
  } else if (!primaryBranchName && primaryCode === "BR003") {
    primaryBranchName = "Connaught Place Branch";
    if (!branchIds.includes(3)) branchIds.push(3);
    if (!branchNames.includes("connaught place branch")) branchNames.push("connaught place branch");
  }

  return {
    isBranchRestricted: true,
    branchCodes,
    branchIds,
    branchNames,
    primaryBranchCode: primaryCode || undefined,
    primaryBranchName,
  };
}

export async function getUserBranchScope(
  currentUser: DemoSessionUser | null
): Promise<UserBranchScope> {
  const branches = await getCachedBranches();
  return getUserBranchScopeSync(currentUser, branches);
}

export function isDsaInBranchScope(dsa: any, scope: UserBranchScope): boolean {
  if (!scope.isBranchRestricted) return true;
  if (!dsa) return false;

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
