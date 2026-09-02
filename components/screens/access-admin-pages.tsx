"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Edit,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";

import { adminApi, type MakerCheckerActionResponse, type UserPayload } from "@/apis/admin";
import { PageHeader } from "@/components/module";
import { Column, DataTable } from "@/components/ui/data-table";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Label,
  Modal,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Permission, Role, User, BranchRole } from "@/types/auth";

interface AdminUserRow {
  branchCode: string;
  branchRoleId: string;
  email: string;
  id: string;
  lastUpdated: string;
  name: string;
  phone: string;
  roles: string[];
  status: "Active" | "Deactivated";
  ticketNo: string;
  userId: number;
  zoneCode: string;
}

interface UserFormState {
  branch_code: string;
  branch_role_id: string;
  email: string;
  name: string;
  password: string;
  phone: string;
  status: "active" | "deactivated";
  ticket_no: string;
  zone_code: string;
}

function emptyUserForm(): UserFormState {
  return {
    branch_code: "",
    branch_role_id: "",
    email: "",
    name: "",
    password: "",
    phone: "",
    status: "active",
    ticket_no: "",
    zone_code: "",
  };
}

function userToRow(user: User): AdminUserRow {
  return {
    branchCode: user.branch_code ?? "",
    branchRoleId: user.branch_role_id ?? "",
    email: user.email,
    id: String(user.id),
    lastUpdated: user.updated_at ?? user.created_at ?? "",
    name: user.name,
    phone: user.phone ?? "",
    roles: user.roles?.map((role) => role.name) ?? [],
    status: user.deactivated_at ? "Deactivated" : "Active",
    ticketNo: user.ticket_no ?? "",
    userId: user.id,
    zoneCode: user.zone_code ?? "",
  };
}

function rowToForm(row: AdminUserRow): UserFormState {
  return {
    branch_code: row.branchCode,
    branch_role_id: row.branchRoleId,
    email: row.email,
    name: row.name,
    password: "",
    phone: row.phone,
    status: row.status === "Active" ? "active" : "deactivated",
    ticket_no: row.ticketNo,
    zone_code: row.zoneCode,
  };
}

function compactUserPayload(form: UserFormState, includePassword: boolean): UserPayload {
  return {
    branch_code: form.branch_code.trim() || undefined,
    branch_role_id: form.branch_role_id.trim() || undefined,
    email: form.email.trim(),
    name: form.name.trim(),
    password: includePassword && form.password ? form.password : undefined,
    phone: form.phone.trim() || undefined,
    ticket_no: form.ticket_no.trim() || undefined,
    zone_code: form.zone_code.trim() || undefined,
  };
}

function isMakerResponse(value: unknown): value is MakerCheckerActionResponse {
  return Boolean(value && typeof value === "object" && (value as { status?: unknown }).status === "pending");
}

function permissionModule(permissionName: string) {
  return permissionName.split(".")[0] || "general";
}

function displayModule(module: string) {
  return module
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function roleDescription(role: Role) {
  return role.description || "No description";
}

export function UsersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branchRoles, setBranchRoles] = useState<BranchRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "deactivated">("");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserFormState>(() => emptyUserForm());
  const [selectedRoleNames, setSelectedRoleNames] = useState<string[]>([]);

  const roleOptions = useMemo(() => roles.map((role) => role.name).sort(), [roles]);

  async function loadUsers() {
    setLoading(true);
    try {
      const [page, roleList, branchRoleRes] = await Promise.all([
        adminApi.getUsersPage({ per_page: 100, status: statusFilter || undefined }),
        adminApi.getRoles(),
        adminApi.getBranchRolesDropdown().catch(() => ({ data: [] })),
      ]);
      setRows(page.data.map(userToRow));
      setRoles(roleList);
      setBranchRoles(branchRoleRes?.data || []);
    } catch (error: any) {
      toast({
        title: "User API failed",
        description: error.message || "Could not fetch backend users.",
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  function openCreate() {
    setForm(emptyUserForm());
    setSelectedRoleNames([]);
    setCreating(true);
  }

  function openEdit(row: AdminUserRow) {
    setEditing(row);
    setForm(rowToForm(row));
    setSelectedRoleNames(row.roles);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setSaving(false);
  }

  function updateForm(name: keyof UserFormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleRole(roleName: string) {
    setSelectedRoleNames((current) =>
      current.includes(roleName) ? current.filter((item) => item !== roleName) : [...current, roleName],
    );
  }

  async function syncRoles(userId: number, previousNames: string[], nextNames: string[]) {
    const roleByName = new Map(roles.map((role) => [role.name, role]));
    const additions = nextNames.filter((name) => !previousNames.includes(name));
    const removals = previousNames.filter((name) => !nextNames.includes(name));

    if (additions.length) {
      await adminApi.assignUserRoles(userId, additions);
    }

    await Promise.all(
      removals.map((name) => {
        const role = roleByName.get(name);
        return role ? adminApi.revokeUserRole(userId, role.id) : Promise.resolve();
      }),
    );
  }

  async function saveUser() {
    setSaving(true);
    try {
      if (editing) {
        const response = await adminApi.updateUser(
          editing.userId,
          compactUserPayload(form, Boolean(form.password)),
        );

        if (isMakerResponse(response)) {
          toast({
            title: "User change submitted",
            description: `Pending checker approval: ${response.reference}`,
            variant: "success",
          });
          closeForm();
          await loadUsers();
          return;
        }

        await syncRoles(editing.userId, editing.roles, selectedRoleNames);

        if (editing.status === "Active" && form.status === "deactivated") {
          await adminApi.deactivateUser(editing.userId);
        } else if (editing.status === "Deactivated" && form.status === "active") {
          await adminApi.reactivateUser(editing.userId);
        }

        toast({ title: "User saved", description: `${form.name} was updated.`, variant: "success" });
      } else {
        const response = await adminApi.createUser(compactUserPayload(form, Boolean(form.password)));

        if (isMakerResponse(response)) {
          toast({
            title: "User creation submitted",
            description: `Pending checker approval: ${response.reference}`,
            variant: "success",
          });
          closeForm();
          await loadUsers();
          return;
        }

        await syncRoles(response.id, [], selectedRoleNames);
        if (form.status === "deactivated") await adminApi.deactivateUser(response.id);
        toast({ title: "User created", description: `${form.name} was added.`, variant: "success" });
      }

      closeForm();
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "User save failed",
        description: error.message || "The user API rejected this change.",
        variant: "warning",
      });
      setSaving(false);
    }
  }

  async function changeUserStatus(row: AdminUserRow) {
    try {
      const response =
        row.status === "Active"
          ? await adminApi.deactivateUser(row.userId)
          : await adminApi.reactivateUser(row.userId);

      if (isMakerResponse(response)) {
        toast({
          title: "Status change submitted",
          description: `Pending checker approval: ${response.reference}`,
          variant: "success",
        });
      } else {
        toast({
          title: row.status === "Active" ? "User deactivated" : "User reactivated",
          description: row.name,
          variant: "success",
        });
      }
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Status change failed",
        description: error.message || "Could not update user status.",
        variant: "warning",
      });
    }
  }

  async function deleteUser(row: AdminUserRow) {
    if (!window.confirm(`Delete ${row.name}?`)) return;

    try {
      const response = await adminApi.deleteUser(row.userId);
      if (isMakerResponse(response)) {
        toast({
          title: "Delete submitted",
          description: `Pending checker approval: ${response.reference}`,
          variant: "success",
        });
      } else {
        toast({ title: "User deleted", description: row.name, variant: "success" });
      }
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete user.",
        variant: "warning",
      });
    }
  }

  const columns: Column<AdminUserRow>[] = [
    {
      cell: (item) => (
        <div>
          <p className="font-semibold text-slate-950">{item.name}</p>
          <p className="text-xs text-slate-500">{item.ticketNo || "-"}</p>
        </div>
      ),
      header: "User",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    { cell: (item) => item.email, header: "Email", key: "email" },
    { cell: (item) => item.phone || "-", header: "Phone", key: "phone" },
    {
      cell: (item) => (
        <div className="flex flex-wrap gap-1">
          {item.roles.length ? item.roles.map((role) => <Badge key={role}>{role}</Badge>) : <span>-</span>}
        </div>
      ),
      exportValue: (item) => item.roles.join("; "),
      header: "Roles",
      key: "roles",
    },
    { cell: (item) => item.branchCode || "-", header: "Branch", key: "branchCode" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
  ];

  const formOpen = creating || Boolean(editing);

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadUsers} type="button" variant="outline">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={openCreate} type="button">
              <UserPlus className="h-4 w-4" />
              New user
            </Button>
          </div>
        }
        description="Manage backend users, role assignments, branch metadata, and active/deactivated access."
        eyebrow="Administration"
        title="User Management"
      />

      <Card>
        <CardContent>
          <div className="mb-3 max-w-xs">
            <Label>Status</Label>
            <Select onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} value={statusFilter}>
              <option value="">All users</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </Select>
          </div>

          {loading ? (
            <EmptyState title="Loading users" description="Fetching users from the Laravel API." />
          ) : (
            <DataTable
              actions={(item) => (
                <div className="flex justify-end gap-1">
                  <Button aria-label="Edit user" onClick={() => openEdit(item)} size="icon" type="button" variant="ghost">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label={item.status === "Active" ? "Deactivate user" : "Reactivate user"}
                    onClick={() => changeUserStatus(item)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    {item.status === "Active" ? <Power className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </Button>
                  <Button aria-label="Delete user" onClick={() => deleteUser(item)} size="icon" type="button" variant="ghost">
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              )}
              columns={columns}
              emptyDescription="Create the first backend user or adjust your filters."
              emptyTitle="No backend users found"
              items={rows}
              searchKeys={["name", "email", "phone", "ticketNo", "branchCode", "status"]}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        description={editing ? "Update backend user fields and role assignments." : "Create a backend user and assign roles."}
        onClose={closeForm}
        open={formOpen}
        title={editing ? "Edit user" : "Create user"}
        width="max-w-lg"
      >
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            saveUser();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field className="sm:col-span-2">
              <Label>Name</Label>
              <Input onChange={(event) => updateForm("name", event.target.value)} required value={form.name} />
            </Field>
            <Field className="sm:col-span-2">
              <Label>Email</Label>
              <Input onChange={(event) => updateForm("email", event.target.value)} required type="email" value={form.email} />
            </Field>
            <Field className="sm:col-span-1">
              <Label>Phone</Label>
              <Input onChange={(event) => updateForm("phone", event.target.value)} value={form.phone} />
            </Field>
            <Field className="sm:col-span-1">
              <Label>Ticket number</Label>
              <Input onChange={(event) => updateForm("ticket_no", event.target.value)} value={form.ticket_no} />
            </Field>
            <Field className="sm:col-span-1">
              <Label>Branch code</Label>
              <Input onChange={(event) => updateForm("branch_code", event.target.value)} value={form.branch_code} />
            </Field>
            <Field className="sm:col-span-1">
              <Label>Zone code</Label>
              <Input onChange={(event) => updateForm("zone_code", event.target.value)} value={form.zone_code} />
            </Field>
            <Field className="sm:col-span-1">
              <Label>Branch role</Label>
              <Select onChange={(event) => updateForm("branch_role_id", event.target.value)} value={form.branch_role_id}>
                <option value="">Select branch role</option>
                {branchRoles.map((br) => (
                  <option key={br.branch_role_id} value={br.branch_role_id}>
                    {br.rolename} ({br.branch_role_id})
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="sm:col-span-1">
              <Label>Status</Label>
              <Select onChange={(event) => updateForm("status", event.target.value)} value={form.status}>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </Select>
            </Field>
            <Field className="sm:col-span-2">
              <Label>{editing ? "New password" : "Password"}</Label>
              <Input
                onChange={(event) => updateForm("password", event.target.value)}
                placeholder={editing ? "Leave blank to keep unchanged" : "Optional if LDAP owns login"}
                type="password"
                value={form.password}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-slate-950">Roles</p>
            </div>
            <div className="grid gap-3 grid-cols-2">
              {roleOptions.map((roleName) => (
                <label
                  className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
                  key={roleName}
                >
                  <input
                    checked={selectedRoleNames.includes(roleName)}
                    className="h-4 w-4 accent-blue-600"
                    onChange={() => toggleRole(roleName)}
                    type="checkbox"
                  />
                  {roleName.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button onClick={closeForm} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Saving..." : "Save user"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function RolesPage() {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDescriptionValue, setRoleDescriptionValue] = useState("");
  const [permissionName, setPermissionName] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");

  async function loadAccessMatrix() {
    setLoading(true);
    try {
      const [roleList, permissionList] = await Promise.all([
        adminApi.getRoles(),
        adminApi.getPermissions(),
      ]);
      setRoles(roleList);
      setPermissions(permissionList);
      setSelectedRoleId((current) => current ?? roleList[0]?.id ?? null);
    } catch (error: any) {
      toast({
        title: "Access API failed",
        description: error.message || "Could not fetch roles and permissions.",
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccessMatrix();
  }, []);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const selectedPermissionNames = useMemo(
    () => new Set(selectedRole?.permissions?.map((permission) => permission.name) ?? []),
    [selectedRole],
  );
  const modules = useMemo(
    () => Array.from(new Set(permissions.map((permission) => permissionModule(permission.name)))).sort(),
    [permissions],
  );

  function openCreateRole() {
    setEditingRole(null);
    setRoleName("");
    setRoleDescriptionValue("");
    setRoleModalOpen(true);
  }

  function openEditRole(role: Role) {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescriptionValue(role.description ?? "");
    setRoleModalOpen(true);
  }

  async function saveRole() {
    try {
      const payload = { description: roleDescriptionValue.trim() || undefined, name: roleName.trim() };
      const saved = editingRole
        ? await adminApi.updateRole(editingRole.id, payload)
        : await adminApi.createRole(payload);
      setRoleModalOpen(false);
      toast({ title: editingRole ? "Role updated" : "Role created", description: saved.name, variant: "success" });
      await loadAccessMatrix();
      setSelectedRoleId(saved.id);
    } catch (error: any) {
      toast({
        title: "Role save failed",
        description: error.message || "The role API rejected this change.",
        variant: "warning",
      });
    }
  }

  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete role ${role.name}?`)) return;
    try {
      await adminApi.deleteRole(role.id);
      toast({ title: "Role deleted", description: role.name, variant: "success" });
      setSelectedRoleId(null);
      await loadAccessMatrix();
    } catch (error: any) {
      toast({
        title: "Role delete failed",
        description: error.message || "Could not delete this role.",
        variant: "warning",
      });
    }
  }

  async function savePermission() {
    try {
      const saved = await adminApi.createPermission({
        description: permissionDescription.trim() || undefined,
        name: permissionName.trim(),
      });
      setPermissionModalOpen(false);
      setPermissionName("");
      setPermissionDescription("");
      toast({ title: "Permission created", description: saved.name, variant: "success" });
      await loadAccessMatrix();
    } catch (error: any) {
      toast({
        title: "Permission save failed",
        description: error.message || "The permission API rejected this change.",
        variant: "warning",
      });
    }
  }

  async function togglePermission(permission: Permission) {
    if (!selectedRole) return;
    const hasPerm = selectedPermissionNames.has(permission.name);

    try {
      if (hasPerm) {
        await adminApi.revokeRolePermission(selectedRole.id, permission.id);
        const updatedPermissions = (selectedRole.permissions || []).filter((p) => p.id !== permission.id);
        const updated = { ...selectedRole, permissions: updatedPermissions };
        setRoles((items) => items.map((role) => (role.id === updated.id ? updated : role)));
        toast({ title: "Permission revoked", description: `${permission.name} removed from ${selectedRole.name}`, variant: "success" });
      } else {
        await adminApi.grantRolePermission(selectedRole.id, permission.id);
        const updatedPermissions = [...(selectedRole.permissions || []), permission];
        const updated = { ...selectedRole, permissions: updatedPermissions };
        setRoles((items) => items.map((role) => (role.id === updated.id ? updated : role)));
        toast({ title: "Permission granted", description: `${permission.name} added to ${selectedRole.name}`, variant: "success" });
      }
    } catch (error: any) {
      toast({
        title: "Permission update failed",
        description: error.message || "Could not update role permission.",
        variant: "warning",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadAccessMatrix} type="button" variant="outline">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setPermissionModalOpen(true)} type="button" variant="outline">
              <Plus className="h-4 w-4" />
              Permission
            </Button>
            <Button onClick={openCreateRole} type="button">
              <Plus className="h-4 w-4" />
              Role
            </Button>
          </div>
        }
        description="Manage backend roles, permissions, and the role-permission assignment matrix."
        eyebrow="Administration"
        title="Role & Permission Management"
      />

      {loading ? (
        <EmptyState title="Loading access matrix" description="Fetching roles and permissions from the Laravel API." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="lg:sticky lg:top-20 self-start">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-950">Roles</p>
                <Badge>{roles.length}</Badge>
              </div>
              <div className="space-y-2">
                {roles.map((role) => (
                  <button
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selectedRole?.id === role.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-100 bg-white hover:bg-slate-50"
                    }`}
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    type="button"
                  >
                    <span className="block text-sm font-semibold text-slate-950">{role.name}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{roleDescription(role)}</span>
                    <span className="mt-2 block text-xs font-medium text-blue-700">
                      {role.permissions?.length ?? 0} permissions
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              {selectedRole ? (
                <>
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{selectedRole.name}</p>
                      <p className="text-sm text-slate-500">{roleDescription(selectedRole)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => openEditRole(selectedRole)} type="button" variant="outline">
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button onClick={() => deleteRole(selectedRole)} type="button" variant="danger">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {modules.map((module) => {
                      const modulePermissions = permissions.filter((permission) => permissionModule(permission.name) === module);
                      return (
                        <div className="rounded-lg border border-slate-100" key={module}>
                          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-950">{displayModule(module)}</p>
                            <Badge>{modulePermissions.length}</Badge>
                          </div>
                          <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
                            {modulePermissions.map((permission) => (
                              <label
                                className="flex min-h-12 items-start gap-2 rounded-md border border-slate-100 bg-white p-2 text-sm"
                                key={permission.id}
                              >
                                <input
                                  checked={selectedPermissionNames.has(permission.name)}
                                  className="mt-0.5 h-4 w-4 accent-blue-600"
                                  onChange={() => togglePermission(permission)}
                                  type="checkbox"
                                />
                                <span className="min-w-0">
                                  <span className="block break-words font-medium text-slate-900">{permission.name}</span>
                                  {permission.description ? (
                                    <span className="block text-xs text-slate-500">{permission.description}</span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EmptyState title="No role selected" description="Select or create a role to manage permissions." />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Modal
        description={editingRole ? "Rename a backend role or update its description." : "Create a backend role."}
        onClose={() => setRoleModalOpen(false)}
        open={roleModalOpen}
        title={editingRole ? "Edit role" : "Create role"}
        width="max-w-md"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveRole();
          }}
        >
          <Field>
            <Label>Role name</Label>
            <Input onChange={(event) => setRoleName(event.target.value)} required value={roleName} />
          </Field>
          <Field>
            <Label>Description</Label>
            <Textarea onChange={(event) => setRoleDescriptionValue(event.target.value)} value={roleDescriptionValue} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button onClick={() => setRoleModalOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">Save role</Button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Create a permission using the module.action convention, such as users.view."
        onClose={() => setPermissionModalOpen(false)}
        open={permissionModalOpen}
        title="Create permission"
        width="max-w-md"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            savePermission();
          }}
        >
          <Field>
            <Label>Permission name</Label>
            <Input onChange={(event) => setPermissionName(event.target.value)} required value={permissionName} />
          </Field>
          <Field>
            <Label>Description</Label>
            <Textarea onChange={(event) => setPermissionDescription(event.target.value)} value={permissionDescription} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button onClick={() => setPermissionModalOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button type="submit">Save permission</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function BranchRolesPage() {
  const { toast } = useToast();
  const [branchRoles, setBranchRoles] = useState<BranchRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BranchRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ branch_role_id: "", rolename: "" });

  async function loadBranchRoles() {
    setLoading(true);
    try {
      const response = await adminApi.getBranchRoles({ per_page: 100 });
      setBranchRoles(response.data || []);
    } catch (error: any) {
      toast({
        title: "API Error",
        description: error.message || "Failed to load branch roles.",
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBranchRoles();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ branch_role_id: "", rolename: "" });
    setCreating(true);
  }

  function openEdit(item: BranchRole) {
    setEditing(item);
    setForm({ branch_role_id: item.branch_role_id, rolename: item.rolename });
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setForm({ branch_role_id: "", rolename: "" });
  }

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveBranchRole() {
    setSaving(true);
    try {
      const payload = {
        branch_role_id: form.branch_role_id.trim(),
        rolename: form.rolename.trim(),
      };
      
      const response = editing
        ? await adminApi.updateBranchRole(editing.branch_role_id, payload)
        : await adminApi.createBranchRole(payload);

      if (isMakerResponse(response)) {
        toast({
          title: "Branch Role change submitted",
          description: `Pending checker approval: ${response.reference}`,
          variant: "success",
        });
      } else {
        toast({
          title: editing ? "Branch Role updated" : "Branch Role created",
          description: `Successfully saved role ${payload.rolename}`,
          variant: "success",
        });
      }
      
      closeForm();
      await loadBranchRoles();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Could not save branch role.",
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: BranchRole) {
    if (!confirm(`Are you sure you want to delete branch role "${item.rolename}"?`)) return;
    try {
      const response = await adminApi.deleteBranchRole(item.branch_role_id);
      if (isMakerResponse(response)) {
        toast({
          title: "Delete request submitted",
          description: `Pending checker approval: ${response.reference}`,
          variant: "success",
        });
      } else {
        toast({
          title: "Branch Role deleted",
          description: `Successfully deleted role ${item.rolename}`,
          variant: "success",
        });
      }
      await loadBranchRoles();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete branch role.",
        variant: "warning",
      });
    }
  }

  const tableData = useMemo(() => {
    return branchRoles.map((item) => ({
      ...item,
      id: String(item.id),
    }));
  }, [branchRoles]);

  const columns: Column<Omit<BranchRole, "id"> & { id: string }>[] = [
    { 
      cell: (item) => <span className="font-mono font-semibold text-slate-800">{item.branch_role_id}</span>, 
      header: "Branch Role ID", 
      key: "branch_role_id", 
      sortable: true, 
      sortValue: (item) => item.branch_role_id 
    },
    { 
      cell: (item) => <span className="font-semibold text-slate-900">{item.rolename}</span>, 
      header: "Role Name", 
      key: "rolename", 
      sortable: true, 
      sortValue: (item) => item.rolename 
    },
    { 
      cell: (item) => item.created_at ? new Date(item.created_at).toLocaleString() : "-", 
      header: "Created At", 
      key: "created_at" 
    },
  ];

  const formOpen = creating || Boolean(editing);

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={loadBranchRoles} variant="secondary">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Branch Role
            </Button>
          </div>
        }
        description="Configure and manage corporate bank branch roles for the Maker-Checker workflow."
        eyebrow="Administration"
        title="Branch Roles"
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <EmptyState title="Loading branch roles" description="Fetching branch roles from the Laravel API." />
          ) : (
            <DataTable
              actions={(item) => (
                <div className="flex justify-end gap-1">
                  <Button aria-label="Edit branch role" onClick={() => openEdit({ ...item, id: Number(item.id) })} size="icon" type="button" variant="ghost">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button aria-label="Delete branch role" onClick={() => handleDelete({ ...item, id: Number(item.id) })} size="icon" type="button" variant="ghost">
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                </div>
              )}
              columns={columns}
              emptyDescription="Create the first branch role to begin assigning users."
              emptyTitle="No branch roles found"
              items={tableData}
              searchKeys={["branch_role_id", "rolename"]}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        description={editing ? "Update the name or configuration of the selected branch role." : "Create a new branch role with a unique string ID."}
        onClose={closeForm}
        open={formOpen}
        title={editing ? "Edit Branch Role" : "Create Branch Role"}
        width="max-w-md"
      >
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            saveBranchRole();
          }}
        >
          <div className="space-y-4">
            <Field>
              <Label>Branch Role ID</Label>
              <Input 
                onChange={(event) => updateForm("branch_role_id", event.target.value)} 
                required 
                disabled={Boolean(editing)}
                placeholder="e.g. BR-MGR"
                maxLength={20}
                value={form.branch_role_id} 
              />
              <p className="text-xs text-slate-500 mt-1">A unique string code (max 20 chars). Cannot be changed after creation.</p>
            </Field>
            <Field>
              <Label>Role Name</Label>
              <Input 
                onChange={(event) => updateForm("rolename", event.target.value)} 
                required 
                placeholder="e.g. Branch Manager"
                maxLength={255}
                value={form.rolename} 
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button onClick={closeForm} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? "Saving..." : editing ? "Update Role" : "Save Role"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// UserBranchMappingsPage
// ─────────────────────────────────────────────────────────────────────────────

import type {
  UserBranchMapping,
  BulkAssignResult,
  CsvUploadResult,
} from "@/types/auth";

type UbmRow = Omit<UserBranchMapping, "id"> & { id: string };

function toUbmRow(m: UserBranchMapping): UbmRow {
  return { ...m, id: String(m.id) };
}

export function UserBranchMappingsPage() {
  const { toast } = useToast();

  // ── data ──────────────────────────────────────────────────────────────────
  const [mappings, setMappings] = useState<UserBranchMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // ── modals ────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  // ── create single form ────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({ user_id: "", branch_code: "" });
  const [creating, setCreating] = useState(false);

  // ── bulk assign form ──────────────────────────────────────────────────────
  const [bulkForm, setBulkForm] = useState({ user_id: "", branch_codes: "" });
  const [bulking, setBulking] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkAssignResult | null>(null);

  // ── csv upload ────────────────────────────────────────────────────────────
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvUploadResult | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);

  // ── user branches side panel ──────────────────────────────────────────────
  const [panelUser, setPanelUser] = useState<{ id: number; name: string } | null>(null);
  const [panelMappings, setPanelMappings] = useState<UserBranchMapping[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);

  // ── load ──────────────────────────────────────────────────────────────────
  const loadMappings = useCallback(
    async (page = 1, search = "") => {
      setLoading(true);
      try {
        const result = await adminApi.getUserBranchMappings({
          page,
          per_page: 20,
          ...(search.trim() ? { search: search.trim() } : {}),
        });
        setMappings(result.data);
        setTotalPages(result.last_page ?? 1);
        setCurrentPage(result.current_page ?? 1);
      } catch (err: any) {
        toast({
          title: "Failed to load mappings",
          description: err.message ?? "Network error",
          variant: "warning",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadMappings(1, searchQuery);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadMappings(1, searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── delete ────────────────────────────────────────────────────────────────
  async function handleDelete(mapping: UbmRow) {
    if (
      !confirm(
        `Remove mapping of user "${mapping.user?.name ?? mapping.user_id}" from branch "${mapping.branch?.branch_name ?? mapping.branch_code}"?`
      )
    )
      return;
    try {
      await adminApi.deleteUserBranchMapping(Number(mapping.id));
      toast({ title: "Mapping deleted", variant: "success" });
      await loadMappings(currentPage, searchQuery);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "warning" });
    }
  }

  // ── create single ─────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.user_id || !createForm.branch_code.trim()) return;
    setCreating(true);
    try {
      await adminApi.createUserBranchMapping({
        user_id: Number(createForm.user_id),
        branch_code: createForm.branch_code.trim(),
      });
      toast({ title: "Mapping created successfully", variant: "success" });
      setCreateOpen(false);
      setCreateForm({ user_id: "", branch_code: "" });
      await loadMappings(1, searchQuery);
    } catch (err: any) {
      toast({ title: "Failed to create mapping", description: err.message, variant: "warning" });
    } finally {
      setCreating(false);
    }
  }

  // ── bulk assign ───────────────────────────────────────────────────────────
  async function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    if (!bulkForm.user_id || !bulkForm.branch_codes.trim()) return;
    setBulking(true);
    setBulkResult(null);
    try {
      const result = await adminApi.bulkAssignBranches({
        user_id: Number(bulkForm.user_id),
        branch_codes: bulkForm.branch_codes.trim(),
      });
      setBulkResult(result);
      toast({
        title: "Bulk assignment completed",
        description: `${result.summary.created_count} created, ${result.summary.skipped_count} skipped, ${result.summary.error_count} errors`,
        variant: "success",
      });
      await loadMappings(1, searchQuery);
    } catch (err: any) {
      toast({ title: "Bulk assignment failed", description: err.message, variant: "warning" });
    } finally {
      setBulking(false);
    }
  }

  // ── csv upload ────────────────────────────────────────────────────────────
  async function handleCsvUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!csvFile) return;
    setCsvUploading(true);
    setCsvResult(null);
    try {
      const result = await adminApi.uploadBranchMappingCsv(csvFile);
      setCsvResult(result);
      toast({
        title: "CSV upload completed",
        description: `${result.summary.created_count} created, ${result.summary.skipped_count} skipped, ${result.summary.error_count} errors`,
        variant: "success",
      });
      await loadMappings(1, searchQuery);
    } catch (err: any) {
      toast({ title: "CSV upload failed", description: err.message, variant: "warning" });
    } finally {
      setCsvUploading(false);
    }
  }

  // ── user branches panel ───────────────────────────────────────────────────
  async function openUserPanel(mapping: UbmRow) {
    const userId = mapping.user_id;
    const userName = mapping.user?.name ?? `User #${userId}`;
    setPanelUser({ id: userId, name: userName });
    setPanelMappings([]);
    setPanelLoading(true);
    try {
      const data = await adminApi.getUserBranches(userId);
      setPanelMappings(data);
    } catch (err: any) {
      toast({ title: "Failed to load user branches", description: err.message, variant: "warning" });
    } finally {
      setPanelLoading(false);
    }
  }

  // ── table columns ─────────────────────────────────────────────────────────
  const tableData: UbmRow[] = useMemo(() => mappings.map(toUbmRow), [mappings]);

  const columns: Column<UbmRow>[] = [
    {
      key: "user",
      header: "User",
      sortable: true,
      sortValue: (r) => r.user?.name ?? String(r.user_id),
      cell: (r) => (
        <div>
          <button
            className="text-sm font-semibold text-blue-700 hover:underline text-left"
            onClick={() => openUserPanel(r)}
            type="button"
          >
            {r.user?.name ?? `User #${r.user_id}`}
          </button>
          <p className="text-xs text-slate-500">{r.user?.email ?? ""}</p>
        </div>
      ),
      exportValue: (r) => r.user?.name ?? String(r.user_id),
    },
    {
      key: "branch_code",
      header: "Branch Code",
      sortable: true,
      sortValue: (r) => r.branch_code,
      cell: (r) => (
        <span className="font-mono font-semibold text-slate-800">{r.branch_code}</span>
      ),
    },
    {
      key: "branch",
      header: "Branch Name",
      sortable: true,
      sortValue: (r) => r.branch?.branch_name ?? "",
      cell: (r) => (
        <span className="text-slate-700">{r.branch?.branch_name ?? "—"}</span>
      ),
      exportValue: (r) => r.branch?.branch_name ?? "",
    },
    {
      key: "created_by",
      header: "Created By",
      cell: (r) => <span className="text-slate-500 text-xs">{r.created_by ?? "—"}</span>,
    },
    {
      key: "created_at",
      header: "Created At",
      cell: (r) =>
        r.created_at ? (
          <span className="text-slate-500 text-xs">
            {new Date(r.created_at).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="User Branch Mappings"
        description="Assign users to branches. A user can be mapped to multiple branches."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setCsvFile(null); setCsvResult(null); setCsvOpen(true); }} variant="outline" type="button">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload CSV
            </Button>
            <Button onClick={() => { setBulkResult(null); setBulkForm({ user_id: "", branch_codes: "" }); setBulkOpen(true); }} variant="outline" type="button">
              <Plus className="h-4 w-4" />
              Bulk Assign
            </Button>
            <Button onClick={() => { setCreateForm({ user_id: "", branch_code: "" }); setCreateOpen(true); }} type="button">
              <Plus className="h-4 w-4" />
              Add Mapping
            </Button>
          </div>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Mappings", value: mappings.length > 0 ? `${mappings.length}+` : "0" },
          { label: "Page", value: `${currentPage} / ${totalPages}` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-3">
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <Input
            className="pl-9"
            placeholder="Search by user name, email or branch code…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button
          onClick={() => loadMappings(currentPage, searchQuery)}
          variant="outline"
          type="button"
          size="sm"
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
              Loading mappings…
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                items={tableData}
                searchKeys={["branch_code"]}
                emptyTitle="No mappings found"
                emptyDescription="Create a mapping to assign a user to a branch."
                emptyAction={
                  <Button onClick={() => setCreateOpen(true)} type="button">
                    <Plus className="h-4 w-4" />
                    Add Mapping
                  </Button>
                }
                actions={(row) => (
                  <Button
                    onClick={() => handleDelete(row)}
                    size="sm"
                    type="button"
                    variant="danger"
                    title="Remove mapping"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              />

              {/* Backend pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-3">
                  <Button
                    disabled={currentPage <= 1}
                    onClick={() => { const p = currentPage - 1; setCurrentPage(p); loadMappings(p, searchQuery); }}
                    size="sm"
                    variant="outline"
                    type="button"
                  >
                    ← Prev
                  </Button>
                  <span className="text-sm text-slate-500 min-w-20 text-center">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    disabled={currentPage >= totalPages}
                    onClick={() => { const p = currentPage + 1; setCurrentPage(p); loadMappings(p, searchQuery); }}
                    size="sm"
                    variant="outline"
                    type="button"
                  >
                    Next →
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Create Single Mapping Modal ────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add User Branch Mapping"
        description="Assign a single user to a single branch."
        width="max-w-md"
      >
        <form className="space-y-5" onSubmit={handleCreate}>
          <Field>
            <Label>User ID</Label>
            <Input
              type="number"
              min={1}
              required
              placeholder="e.g. 5"
              value={createForm.user_id}
              onChange={(e) => setCreateForm((f) => ({ ...f, user_id: e.target.value }))}
            />
            <p className="text-xs text-slate-500 mt-1">Enter the numeric user ID to assign.</p>
          </Field>
          <Field>
            <Label>Branch Code</Label>
            <Input
              required
              placeholder="e.g. BR001"
              maxLength={20}
              value={createForm.branch_code}
              onChange={(e) => setCreateForm((f) => ({ ...f, branch_code: e.target.value }))}
            />
            <p className="text-xs text-slate-500 mt-1">Must match an existing branch code.</p>
          </Field>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button onClick={() => setCreateOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button disabled={creating} type="submit">
              {creating ? "Saving…" : "Save Mapping"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Bulk Assign Modal ──────────────────────────────────────────────── */}
      <Modal
        open={bulkOpen}
        onClose={() => { setBulkOpen(false); setBulkResult(null); }}
        title="Bulk Assign Branches"
        description="Assign multiple branches to a single user at once."
        width="max-w-lg"
      >
        <form className="space-y-5" onSubmit={handleBulk}>
          <Field>
            <Label>User ID</Label>
            <Input
              type="number"
              min={1}
              required
              placeholder="e.g. 5"
              value={bulkForm.user_id}
              onChange={(e) => setBulkForm((f) => ({ ...f, user_id: e.target.value }))}
            />
          </Field>
          <Field>
            <Label>Branch Codes (comma-separated)</Label>
            <Textarea
              required
              placeholder="BR001,BR002,BR003"
              rows={3}
              value={bulkForm.branch_codes}
              onChange={(e) => setBulkForm((f) => ({ ...f, branch_codes: e.target.value }))}
            />
            <p className="text-xs text-slate-500 mt-1">Separate branch codes with commas. Duplicates are automatically skipped.</p>
          </Field>

          {bulkResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-800">Result Summary</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2">
                  <p className="text-xl font-bold text-emerald-700">{bulkResult.summary.created_count}</p>
                  <p className="text-emerald-600">Created</p>
                </div>
                <div className="rounded-md bg-amber-50 border border-amber-100 p-2">
                  <p className="text-xl font-bold text-amber-700">{bulkResult.summary.skipped_count}</p>
                  <p className="text-amber-600">Skipped</p>
                </div>
                <div className="rounded-md bg-rose-50 border border-rose-100 p-2">
                  <p className="text-xl font-bold text-rose-700">{bulkResult.summary.error_count}</p>
                  <p className="text-rose-600">Errors</p>
                </div>
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="rounded border border-rose-200 bg-rose-50 p-2">
                  <p className="text-xs font-semibold text-rose-700 mb-1">Errors:</p>
                  <ul className="text-xs text-rose-600 space-y-0.5 list-disc pl-4">
                    {bulkResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {bulkResult.skipped.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Skipped (already mapped):</p>
                  <p className="text-xs text-amber-600">{bulkResult.skipped.join(", ")}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button onClick={() => { setBulkOpen(false); setBulkResult(null); }} type="button" variant="secondary">
              Close
            </Button>
            <Button disabled={bulking} type="submit">
              {bulking ? "Assigning…" : "Assign Branches"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── CSV Upload Modal ───────────────────────────────────────────────── */}
      <Modal
        open={csvOpen}
        onClose={() => { setCsvOpen(false); setCsvResult(null); setCsvFile(null); }}
        title="Upload CSV Mapping"
        description="Import user-branch mappings in bulk via CSV file."
        width="max-w-lg"
      >
        <form className="space-y-5" onSubmit={handleCsvUpload}>
          {/* Drop zone */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-8 text-center transition ${
              csvDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
            onDragLeave={() => setCsvDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setCsvDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) setCsvFile(f);
            }}
          >
            <svg className="mx-auto h-10 w-10 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {csvFile ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">{csvFile.name}</p>
                <p className="text-xs text-slate-500">{(csvFile.size / 1024).toFixed(1)} KB</p>
                <button
                  type="button"
                  className="text-xs text-rose-500 hover:underline"
                  onClick={() => setCsvFile(null)}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-600 mb-1">Drag & drop your CSV here or</p>
                <label className="cursor-pointer text-sm font-medium text-blue-600 hover:underline">
                  browse to upload
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setCsvFile(f); }}
                  />
                </label>
                <p className="text-xs text-slate-400 mt-2">CSV or TXT • max 2 MB</p>
              </div>
            )}
          </div>

          {/* Format hint */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1">Expected CSV format:</p>
            <pre className="text-xs text-slate-500 font-mono">user_id,branch_code{"\n"}5,BR001{"\n"}5,BR002{"\n"}6,BR001</pre>
          </div>

          {/* Result */}
          {csvResult && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-800">Upload Result</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-emerald-50 border border-emerald-100 p-2">
                  <p className="text-xl font-bold text-emerald-700">{csvResult.summary.created_count}</p>
                  <p className="text-emerald-600">Created</p>
                </div>
                <div className="rounded-md bg-amber-50 border border-amber-100 p-2">
                  <p className="text-xl font-bold text-amber-700">{csvResult.summary.skipped_count}</p>
                  <p className="text-amber-600">Skipped</p>
                </div>
                <div className="rounded-md bg-rose-50 border border-rose-100 p-2">
                  <p className="text-xl font-bold text-rose-700">{csvResult.summary.error_count}</p>
                  <p className="text-rose-600">Errors</p>
                </div>
              </div>
              {csvResult.errors.length > 0 && (
                <div className="rounded border border-rose-200 bg-rose-50 p-2 max-h-32 overflow-y-auto">
                  <p className="text-xs font-semibold text-rose-700 mb-1">Errors:</p>
                  <ul className="text-xs text-rose-600 space-y-0.5 list-disc pl-4">
                    {csvResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {csvResult.skipped.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2 max-h-20 overflow-y-auto">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Skipped:</p>
                  <ul className="text-xs text-amber-600 space-y-0.5 list-disc pl-4">
                    {csvResult.skipped.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button
              onClick={() => { setCsvOpen(false); setCsvResult(null); setCsvFile(null); }}
              type="button"
              variant="secondary"
            >
              Close
            </Button>
            <Button disabled={!csvFile || csvUploading} type="submit">
              {csvUploading ? "Uploading…" : "Upload & Import"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── User Branches Panel ────────────────────────────────────────────── */}
      <Modal
        open={Boolean(panelUser)}
        onClose={() => { setPanelUser(null); setPanelMappings([]); }}
        title={panelUser ? `Branches for: ${panelUser.name}` : "User Branches"}
        description="All branch assignments for this user."
        width="max-w-lg"
      >
        {panelLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
            Loading branches…
          </div>
        ) : panelMappings.length === 0 ? (
          <EmptyState title="No branches assigned" description="This user has no branch mappings." />
        ) : (
          <div className="space-y-2">
            {panelMappings.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900 font-mono">{m.branch_code}</p>
                  <p className="text-xs text-slate-500">{m.branch?.branch_name ?? "—"}</p>
                </div>
                <Button
                  onClick={async () => {
                    await handleDelete(toUbmRow(m));
                    if (panelUser) {
                      const data = await adminApi.getUserBranches(panelUser.id);
                      setPanelMappings(data);
                    }
                  }}
                  size="sm"
                  type="button"
                  variant="danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
          <Button onClick={() => { setPanelUser(null); setPanelMappings([]); }} type="button" variant="secondary">
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
