import type { AuthSession, User } from "@/types/auth";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const ROLES_KEY = "auth_roles";
const PERMISSIONS_KEY = "auth_permissions";

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
