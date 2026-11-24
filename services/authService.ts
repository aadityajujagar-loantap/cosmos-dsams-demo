import type { AuthSession, User } from "@/types/auth";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const ROLES_KEY = "auth_roles";
const PERMISSIONS_KEY = "auth_permissions";
const DSA_KEY = "auth_dsa";

export const authService = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): User | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  },

  getDsa(): any | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(DSA_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  getRoles(): string[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(ROLES_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  },

  getPermissions(): string[] {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(PERMISSIONS_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  },

  startSession(session: AuthSession): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));

    if (session.dsa) {
      localStorage.setItem(DSA_KEY, JSON.stringify(session.dsa));
    }

    const roleNames = session.roles.map((r) => r.name);
    localStorage.setItem(ROLES_KEY, JSON.stringify(roleNames));

    const permissionNames = Array.from(
      new Set(session.roles.flatMap((r) => r.permissions.map((p) => p.name)))
    );
    localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissionNames));
  },

  endSession(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLES_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
    localStorage.removeItem(DSA_KEY);
    localStorage.removeItem("cosmos_dsa_user");

    // Purge cached store, drafts, and customer journey keys to prevent SPII leakage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith("cosmos_") ||
            k.startsWith("auth_") ||
            k.startsWith("email_verified_") ||
            k.startsWith("checker_kyc_") ||
            k.startsWith("sell_now_") ||
            k.startsWith("borrower_draft_") ||
            k === "active_locked_dsa_case_id" ||
            k === "last_submitted_dsa_code")
        ) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (
          k &&
          (k.startsWith("cosmos_dsa_onboarding_") ||
            k.startsWith("email_verified_") ||
            k.startsWith("checker_kyc_"))
        ) {
          sessionKeysToRemove.push(k);
        }
      }
      sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // Ignore storage errors in restricted contexts
    }
  },

  isLoggedIn(): boolean {
    return !!this.getToken();
  },

  hasPermission(permission: string): boolean {
    const roles = this.getRoles();
    if (roles.includes("super_admin") || roles.includes("admin")) {
      return true; // Administrators bypass all permission checks
    }
    const permissions = this.getPermissions();
    return permissions.includes(permission);
  },

  hasRole(role: string | string[]): boolean {
    const roles = this.getRoles();
    if (Array.isArray(role)) {
      return role.some((r) => roles.includes(r));
    }
    return roles.includes(role);
  },
};
