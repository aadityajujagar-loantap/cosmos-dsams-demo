import { useEffect, useState } from "react";
import { authService } from "@/services/authService";
import type { User } from "@/types/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(authService.getUser());
    setRoles(authService.getRoles());
    setPermissions(authService.getPermissions());
    setLoading(false);
  }, []);

  const hasPermission = (permission: string): boolean => {
    return authService.hasPermission(permission);
  };

  const hasRole = (role: string | string[]): boolean => {
    return authService.hasRole(role);
  };

  return {
    user,
    roles,
    permissions,
    hasPermission,
    hasRole,
    loading,
    isLoggedIn: authService.isLoggedIn(),
  };
}
