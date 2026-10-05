"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";

import { authApi } from "@/apis/auth";
import { Badge, Button, Modal } from "@/components/ui/primitives";
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
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function initials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function UserAccountModal({ fallbackUser, onClose, onSignOut, open }: UserAccountModalProps) {
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
  const displayRole = resolvedRoles[0] || fallbackUser.role;

  return (
    <Modal
      description="Active session and account details."
      onClose={onClose}
      open={open}
      title="User Profile"
      width="max-w-md"
    >
      <div className="space-y-4">
        {/* Profile Card Header */}
        <div className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white shadow-xs">
            {initials(displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="truncate text-sm font-bold text-slate-900 leading-tight">
                {displayName}
              </h3>
              <Badge tone="blue" className="text-[10px] h-5 font-bold uppercase shrink-0">
                {displayRole}
              </Badge>
            </div>
            <p className="truncate text-xs font-medium text-slate-500 mt-0.5">
              {displayEmail}
            </p>
          </div>
        </div>

        {/* Account Details Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
            <span>Assignment &amp; Scope</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 normal-case">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {authService.getToken() ? "Session Active" : "No Token"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">User ID</span>
              <p className="font-mono font-bold text-slate-900">{fieldValue(user?.id ?? fallbackUser.id)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ticket Number</span>
              <p className="font-mono font-bold text-slate-900">{fieldValue(user?.ticket_no)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</span>
              <p className="font-medium text-slate-800">{fieldValue(user?.phone)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch Code</span>
              <p className="font-mono font-bold text-slate-900">{fieldValue(user?.branch_code ?? fallbackUser.code)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch Role</span>
              <p className="font-medium text-slate-800">{fieldValue(user?.branch_role_id)}</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Zone Code</span>
              <p className="font-medium text-slate-800">{fieldValue(user?.zone_code)}</p>
            </div>
          </div>
          {loading && (
            <p className="mt-2 text-[11px] text-slate-400 italic">Syncing latest account data...</p>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={onSignOut}
            variant="danger"
            className="gap-2 text-xs font-bold px-4 py-2 shadow-xs"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </Modal>
  );
}
