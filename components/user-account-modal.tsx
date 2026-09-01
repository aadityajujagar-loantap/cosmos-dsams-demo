"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";

import { authApi } from "@/apis/auth";
import { Badge, Button, Card, CardContent, Field, Input, Label, Modal } from "@/components/ui/primitives";
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

function permissionNames(roles: Role[]) {
  return Array.from(
    new Set(roles.flatMap((role) => role.permissions?.map((permission) => permission.name) ?? [])),
  ).sort();
}

function fieldValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
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
  const storedPermissions = useMemo(() => authService.getPermissions(), [open]);
  const resolvedRoles = backendRoles.length ? roleNames(backendRoles) : storedRoles;
  const resolvedPermissions = backendRoles.length ? permissionNames(backendRoles) : storedPermissions;
  const user = backendUser;

  return (
    <Modal
      description="Backend session profile, role assignments, and effective permissions."
      onClose={onClose}
      open={open}
      title="User account"
      width="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-slate-900 text-white">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-950">
                    {fieldValue(user?.name ?? fallbackUser.name)}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {fieldValue(user?.email ?? fallbackUser.email)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <Label>User ID</Label>
                  <Input readOnly value={fieldValue(user?.id ?? fallbackUser.id)} />
                </Field>
                <Field>
                  <Label>Ticket number</Label>
                  <Input readOnly value={fieldValue(user?.ticket_no)} />
                </Field>
                <Field>
                  <Label>Phone</Label>
                  <Input readOnly value={fieldValue(user?.phone)} />
                </Field>
                <Field>
                  <Label>Branch code</Label>
                  <Input readOnly value={fieldValue(user?.branch_code ?? fallbackUser.code)} />
                </Field>
                <Field>
                  <Label>Branch role</Label>
                  <Input readOnly value={fieldValue(user?.branch_role_id)} />
                </Field>
                <Field>
                  <Label>Zone code</Label>
                  <Input readOnly value={fieldValue(user?.zone_code)} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-slate-950">Access</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(resolvedRoles.length ? resolvedRoles : [fallbackUser.role]).map((role) => (
                  <Badge key={role} tone="blue">
                    {role}
                  </Badge>
                ))}
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Token status</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {authService.getToken() ? "Bearer token active" : "No token found"}
                </p>
              </div>
              {loading ? <p className="text-sm text-slate-500">Loading backend account...</p> : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-slate-950">Effective permissions</p>
              </div>
              <Badge>{resolvedPermissions.length} permissions</Badge>
            </div>
            {resolvedPermissions.length ? (
              <div className="flex max-h-44 flex-wrap gap-2 overflow-auto rounded-md border border-slate-100 p-3">
                {resolvedPermissions.map((permission) => (
                  <Badge key={permission}>{permission}</Badge>
                ))}
              </div>
            ) : (
              <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                No permissions were returned for this account.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button onClick={onSignOut} type="button" variant="danger">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </Modal>
  );
}
