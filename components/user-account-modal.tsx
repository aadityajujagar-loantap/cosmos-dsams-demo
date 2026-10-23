"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { authApi } from "@/apis/auth";
import { Button, Modal } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { authService } from "@/services/authService";
import type { Role, User } from "@/types/auth";

interface UserAccountModalProps {
  fallbackUser: {
    code?: string;
    email?: string;
    id: string;
    name: string;
    role: string;
  };
  onClose: () => void;
  onSignOut: () => void;
  open: boolean;
}

function roleNames(roles: Role[]) {
  return roles.map((role) => role.name).filter(Boolean);
}

function fieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function UserAccountModal({
  fallbackUser,
  onClose,
  onSignOut,
  open,
}: UserAccountModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [backendUser, setBackendUser] = useState<User | null>(null);
  const [backendRoles, setBackendRoles] = useState<Role[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function loadAccount() {
      setLoading(true);
      try {
        const [user, rolesResponse] = await Promise.all([
          authApi.getCurrentUser(),
          authApi.getRolesPermissions(),
        ]);

        if (cancelled) return;
        setBackendUser(user);
        setBackendRoles(rolesResponse.status === "0" ? rolesResponse.respData.roles : []);
      } catch (error: any) {
        if (cancelled) return;
        setBackendUser(null);
        setBackendRoles([]);
        toast({
          title: "Profile fetch failed",
          description: error.message || "Could not load backend user details.",
          variant: "warning",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAccount();

    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  const storedRoles = useMemo(() => authService.getRoles(), [open]);
  const resolvedRoles = backendRoles.length ? roleNames(backendRoles) : storedRoles;
  const user = backendUser;

  const displayName = fieldValue(user?.name ?? fallbackUser.name);
  const displayEmail = fieldValue(user?.email ?? fallbackUser.email);
  const displayRole = resolvedRoles.length ? resolvedRoles.join(", ") : fallbackUser.role || "User";

  return (
    <Modal
      onClose={onClose}
      open={open}
      title="User Profile"
      width="max-w-md"
    >
      {loading ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50/60 p-10 text-center min-h-[260px]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800 mb-3" />
            <h4 className="text-xs font-semibold text-slate-800">Loading user profile...</h4>
            <p className="mt-1 text-[11px] text-slate-400">
              Fetching session details and account info
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              Close
            </Button>
            <Button
              type="button"
              disabled
              variant="danger"
              className="h-9 gap-2 px-4 text-xs font-medium rounded-lg opacity-50 cursor-not-allowed"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Profile Header Card */}
          <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{displayRole}</span>
              </p>
            </div>
          </div>

          {/* Assignment & Scope Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  <ShieldCheck className="h-3 w-3 text-slate-400" />
                  <span>Role</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-800 truncate" title={displayRole}>
                  {displayRole}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  <Mail className="h-3 w-3 text-slate-400" />
                  <span>Email</span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-800 truncate" title={displayEmail}>
                  {displayEmail}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  <Phone className="h-3 w-3 text-slate-400" />
                  <span>Phone</span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-800 truncate">
                  {fieldValue(user?.phone)}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  <Building2 className="h-3 w-3 text-slate-400" />
                  <span>Branch Code</span>
                </div>
                <p className="mt-1 font-mono text-xs font-semibold text-slate-900 truncate">
                  {fieldValue(user?.branch_code ?? fallbackUser.code)}
                </p>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={onSignOut}
              variant="danger"
              className="h-9 gap-2 px-4 text-xs font-semibold rounded-lg shadow-2xs hover:shadow-xs transition"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
