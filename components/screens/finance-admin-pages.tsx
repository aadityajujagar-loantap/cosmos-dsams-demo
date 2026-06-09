"use client";

import {
  BadgeIndianRupee,
  CheckSquare,
  FileText,
  Plus,
  Settings,
} from "lucide-react";
import { useState } from "react";

import { BarChartCard, KpiCard, PieChartCard, TrendCard } from "@/components/charts";
import { ActionPair, PageHeader } from "@/components/module";
import { Column, DataTable } from "@/components/ui/data-table";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Label,
  Modal,
  Select,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { useMockStore } from "@/lib/store";
import {
  AuditLog,
  Commission,
  Notification,
  NotificationStatus,
  PermissionAction,
  Priority,
  Product,
  SettingItem,
  User,
  UserRole,
} from "@/lib/types";
import { compactNumber, formatCurrency, formatDate, makeId } from "@/lib/utils";

const products: Product[] = [
  "Personal Loan",
  "Home Loan",
  "Loan Against Property",
  "Business Loan",
  "Auto Loan",
];

const userRoles: UserRole[] = [
  "Admin",
  "Operations",
  "Credit Analyst",
  "Risk Manager",
  "DSA Manager",
];

const permissionActions: PermissionAction[] = ["View", "Create", "Edit", "Delete", "Approve"];

const commissionFields: FieldConfig<Commission>[] = [
  { label: "DSA name", name: "dsaName", required: true },
  { label: "Month", name: "month", required: true },
  { label: "Product", name: "product", options: products, required: true, type: "select" },
  { label: "Applications", name: "applications", required: true, type: "number" },
  { label: "Disbursed amount", name: "disbursedAmount", required: true, type: "number" },
  { label: "Rate", name: "rate", required: true, type: "number" },
  { label: "Payout", name: "payout", required: true, type: "number" },
  { label: "Status", name: "status", options: ["Pending", "Processed", "Hold"], required: true, type: "select" },
];

const userFields: FieldConfig<User>[] = [
  { label: "Name", name: "name", required: true },
  { label: "Email", name: "email", required: true, type: "email" },
  { label: "Role", name: "role", options: userRoles, required: true, type: "select" },
  { label: "Region", name: "region", required: true },
  { label: "Status", name: "status", options: ["Active", "Invited", "Disabled"], required: true, type: "select" },
];

const notificationFields: FieldConfig<Notification>[] = [
  { label: "Title", name: "title", required: true },
  { label: "Body", name: "body", required: true, type: "textarea" },
  { label: "Priority", name: "priority", options: ["Low", "Medium", "High", "Critical"], required: true, type: "select" },
  { label: "Status", name: "status", options: ["Unread", "Read", "Archived"], required: true, type: "select" },
  { label: "Category", name: "category", options: ["Workflow", "Risk", "Payout", "System", "Lead"], required: true, type: "select" },
];

const settingFields: FieldConfig<SettingItem>[] = [
  { label: "Section", name: "section", options: ["General", "Workflow", "Notifications", "Security", "Branding"], required: true, type: "select" },
  { label: "Label", name: "label", required: true },
  { label: "Value", name: "value", required: true },
];

function newCommission(value: Partial<Commission>, dsaId: string): Commission {
  return {
    applications: Number(value.applications ?? 1),
    disbursedAmount: Number(value.disbursedAmount ?? 500000),
    dsaId,
    dsaName: String(value.dsaName ?? "New DSA"),
    id: makeId("com"),
    month: String(value.month ?? "Jun 2026"),
    payout: Number(value.payout ?? 5000),
    payoutId: `PAY-${Date.now().toString().slice(-5)}`,
    product: (value.product as Product) || "Personal Loan",
    rate: Number(value.rate ?? 1),
    status: (value.status as Commission["status"]) || "Pending",
  };
}

export function CommissionsPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Commission | null>(null);
  const defaultDsa = store.dsas[0];
  const totalPayout = store.commissions.reduce((sum, item) => sum + item.payout, 0);
  const processed = store.commissions.filter((item) => item.status === "Processed").reduce((sum, item) => sum + item.payout, 0);

  const columns: Column<Commission>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.payoutId}</span>, header: "Payout", key: "payoutId" },
    { cell: (item) => item.dsaName, header: "DSA", key: "dsaName", sortable: true, sortValue: (item) => item.dsaName },
    { cell: (item) => item.month, header: "Month", key: "month" },
    { cell: (item) => item.product, header: "Product", key: "product" },
    { cell: (item) => formatCurrency(item.disbursedAmount), header: "Disbursed", key: "disbursedAmount", sortable: true, sortValue: (item) => item.disbursedAmount },
    { cell: (item) => `${item.rate}%`, header: "Rate", key: "rate" },
    { cell: (item) => formatCurrency(item.payout), header: "Payout", key: "payout", sortable: true, sortValue: (item) => item.payout },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
  ];

  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New Payout</Button>}
        description="Track DSA earnings, monthly payout status, disbursal-linked commissions, and exception holds."
        eyebrow="Finance"
        title="Commission Management"
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <KpiCard change="+18.2%" icon={BadgeIndianRupee} label="Total payout" value={compactNumber(totalPayout)} />
        <KpiCard change="+9.6%" icon={CheckSquare} label="Processed" tone="green" value={formatCurrency(processed)} />
        <KpiCard change="-2.4%" icon={FileText} label="On hold" tone="amber" value={String(store.commissions.filter((item) => item.status === "Hold").length)} />
      </div>
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <TrendCard
          data={["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((name, index) => ({
            name,
            value: Math.round(store.commissions.slice(index * 6, index * 6 + 6).reduce((sum, item) => sum + item.payout, 0) / 1000),
          }))}
          dataKey="value"
          subtitle="Payouts in thousands by batch month"
          title="Monthly payouts"
          type="area"
        />
        <PieChartCard
          data={["Pending", "Processed", "Hold"].map((name) => ({
            name,
            value: store.commissions.filter((item) => item.status === name).length,
          }))}
          dataKey="value"
          subtitle="Finance queue status distribution"
          title="Payout status"
        />
      </div>
      <DataTable
        actions={(item) => <ActionPair onDelete={() => deleteItem("commissions", item.id)} onEdit={() => setEditing(item)} />}
        columns={columns}
        items={store.commissions}
        searchKeys={["payoutId", "dsaName", "month", "product", "status"]}
      />
      <Modal onClose={() => setCreating(false)} open={creating} title="Create payout">
        <RecordForm<Commission>
          fields={commissionFields}
          initialValue={{ dsaName: defaultDsa.name, month: "Jun 2026", product: "Personal Loan", status: "Pending" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("commissions", newCommission(value, defaultDsa.id));
            setCreating(false);
          }}
          submitLabel="Create payout"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit payout">
        {editing ? (
          <RecordForm<Commission>
            fields={commissionFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("commissions", editing.id, {
                ...value,
                applications: Number(value.applications ?? editing.applications),
                disbursedAmount: Number(value.disbursedAmount ?? editing.disbursedAmount),
                payout: Number(value.payout ?? editing.payout),
                rate: Number(value.rate ?? editing.rate),
              });
              setEditing(null);
            }}
            submitLabel="Save payout"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function ReportsPage() {
  const { store } = useMockStore();
  const [tab, setTab] = useState("performance");
  const performance = store.dsas.slice(0, 8).map((dsa) => ({
    name: dsa.code,
    value: dsa.approvalRate,
  }));
  const volume = ["Personal Loan", "Home Loan", "Loan Against Property", "Business Loan", "Auto Loan"].map((product) => ({
    name: product.replace(" Loan", ""),
    value: store.applications.filter((item) => item.product === product).length,
  }));
  const rejection = ["Low salary", "Bureau risk", "KYC mismatch", "Duplicate", "Policy"].map((name, index) => ({
    name,
    value: [19, 14, 8, 6, 11][index],
  }));

  return (
    <div>
      <PageHeader
        description="Analytics views for DSA performance, application volume, approval rate, rejection analysis, and lead conversion."
        eyebrow="Analytics"
        title="Reports & Analytics"
      />
      <Tabs
        onChange={setTab}
        tabs={[
          { label: "DSA Performance", value: "performance" },
          { label: "Application Volume", value: "volume" },
          { label: "Approval Rate", value: "approval" },
          { label: "Rejection Analysis", value: "rejection" },
          { label: "Lead Conversion", value: "conversion" },
        ]}
        value={tab}
      />
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {tab === "performance" ? (
          <>
            <BarChartCard data={performance} dataKey="value" subtitle="Approval percentage for top sourced DSAs" title="DSA Performance" />
            <Card><CardContent><ReportList rows={store.dsas.slice(0, 8).map((item) => [item.name, `${item.approvalRate}%`, item.tier])} /></CardContent></Card>
          </>
        ) : null}
        {tab === "volume" ? (
          <>
            <BarChartCard data={volume} dataKey="value" subtitle="Applications grouped by product" title="Application Volume" />
            <PieChartCard data={volume} dataKey="value" subtitle="Product contribution mix" title="Volume Mix" />
          </>
        ) : null}
        {tab === "approval" ? (
          <>
            <TrendCard data={[42, 49, 55, 58, 61, 64].map((value, index) => ({ name: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][index], value }))} dataKey="value" subtitle="Portfolio approval movement" title="Approval Rate" type="area" />
            <Card><CardContent><ReportList rows={[["Auto approved", "31%", "Low risk"], ["Manual approval", "33%", "Credit desk"], ["Rejected", "19%", "Policy"], ["On hold", "17%", "Evidence"]]}/></CardContent></Card>
          </>
        ) : null}
        {tab === "rejection" ? (
          <>
            <BarChartCard data={rejection} dataKey="value" subtitle="Top rejection drivers" title="Rejection Analysis" />
            <Card><CardContent><ReportList rows={rejection.map((item) => [item.name, String(item.value), "Cases"])} /></CardContent></Card>
          </>
        ) : null}
        {tab === "conversion" ? (
          <>
            <TrendCard data={[28, 32, 35, 39, 37, 42].map((value, index) => ({ name: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][index], value }))} dataKey="value" subtitle="Lead to application conversion rate" title="Lead Conversion" />
            <PieChartCard data={["New", "Contacted", "Qualified", "Converted", "Lost"].map((status) => ({ name: status, value: store.leads.filter((item) => item.status === status).length }))} dataKey="value" subtitle="Lead status mix" title="Lead Funnel Mix" />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ReportList({ rows }: { rows: string[][] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div className="flex items-center justify-between rounded-md bg-slate-50 p-3" key={row.join("-")}>
          <span className="text-sm font-medium text-slate-950">{row[0]}</span>
          <span className="text-sm text-slate-500">{row[1]} · {row[2]}</span>
        </div>
      ))}
    </div>
  );
}

export function UsersPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const columns: Column<User>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.name}</span>, header: "User", key: "name", sortable: true, sortValue: (item) => item.name },
    { cell: (item) => item.email, header: "Email", key: "email" },
    { cell: (item) => <Badge tone="blue">{item.role}</Badge>, header: "Role", key: "role" },
    { cell: (item) => item.region, header: "Region", key: "region" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => formatDate(item.lastLogin), header: "Last login", key: "lastLogin" },
  ];

  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New User</Button>}
        description="Create users, assign operational roles, control access status, and maintain regional ownership."
        eyebrow="Administration"
        title="User Management"
      />
      <DataTable
        actions={(item) => <ActionPair onDelete={() => deleteItem("users", item.id)} onEdit={() => setEditing(item)} />}
        columns={columns}
        items={store.users}
        searchKeys={["name", "email", "role", "region", "status"]}
      />
      <Modal onClose={() => setCreating(false)} open={creating} title="Create user">
        <RecordForm<User>
          fields={userFields}
          initialValue={{ role: "Operations", status: "Invited" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("users", {
              email: String(value.email ?? ""),
              id: makeId("usr"),
              lastLogin: new Date().toISOString(),
              name: String(value.name ?? "New User"),
              region: String(value.region ?? "West"),
              role: (value.role as UserRole) || "Operations",
              status: (value.status as User["status"]) || "Invited",
            });
            setCreating(false);
          }}
          submitLabel="Create user"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit user">
        {editing ? (
          <RecordForm<User>
            fields={userFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("users", editing.id, value);
              setEditing(null);
            }}
            submitLabel="Save user"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function RolesPage() {
  const { store, updateItem } = useMockStore();
  const [role, setRole] = useState<UserRole>("Admin");
  const visible = store.roles.filter((item) => item.role === role);

  return (
    <div>
      <PageHeader
        description="Permission matrix for View, Create, Edit, Delete, and Approve across core workflow modules."
        eyebrow="Administration"
        title="Role & Permission Management"
      />
      <Card>
        <CardContent>
          <Field className="max-w-xs">
            <Label>Role</Label>
            <Select onChange={(event) => setRole(event.target.value as UserRole)} value={role}>
              {userRoles.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Module</th>
                  {permissionActions.map((item) => (
                    <th className="px-4 py-3 text-center" key={item}>{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">{row.module}</td>
                    {permissionActions.map((action) => (
                      <td className="px-4 py-3 text-center" key={action}>
                        <input
                          checked={row.permissions[action]}
                          className="h-4 w-4 accent-blue-600"
                          onChange={(event) =>
                            updateItem("roles", row.id, {
                              permissions: { ...row.permissions, [action]: event.target.checked },
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AuditLogsPage() {
  const { deleteItem, store } = useMockStore();
  const columns: Column<AuditLog>[] = [
    { cell: (item) => formatDate(item.at), header: "Time", key: "at", sortable: true, sortValue: (item) => item.at },
    { cell: (item) => item.actor, header: "Actor", key: "actor" },
    { cell: (item) => item.action, header: "Action", key: "action" },
    { cell: (item) => item.entity, header: "Entity", key: "entity" },
    { cell: (item) => <StatusBadge status={item.severity} />, header: "Severity", key: "severity" },
    { cell: (item) => item.ipAddress, header: "IP", key: "ipAddress" },
  ];
  return (
    <div>
      <PageHeader
        description="Searchable enterprise audit trail for changes to partners, workflows, rules, payouts, and access."
        eyebrow="Administration"
        title="Audit Logs"
      />
      <DataTable
        actions={(item) => <ActionPair onDelete={() => deleteItem("auditLogs", item.id)} />}
        columns={columns}
        items={store.auditLogs}
        searchKeys={["actor", "action", "entity", "severity", "ipAddress"]}
      />
    </div>
  );
}

export function NotificationsPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Notification | null>(null);
  const columns: Column<Notification>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.title}</span>, header: "Title", key: "title", sortable: true, sortValue: (item) => item.title },
    { cell: (item) => item.category, header: "Category", key: "category" },
    { cell: (item) => <Badge tone={item.priority === "Critical" ? "rose" : item.priority === "High" ? "amber" : "blue"}>{item.priority}</Badge>, header: "Priority", key: "priority" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => formatDate(item.createdAt), header: "Created", key: "createdAt" },
  ];
  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New Notification</Button>}
        description="Enterprise inbox for workflow alerts, risk warnings, payout exceptions, system broadcasts, and lead updates."
        eyebrow="Administration"
        title="Notification Center"
      />
      <DataTable
        actions={(item) => (
          <ActionPair
            onDelete={() => deleteItem("notifications", item.id)}
            onEdit={() => setEditing(item)}
            onView={() => updateItem("notifications", item.id, { status: "Read" })}
          />
        )}
        columns={columns}
        items={store.notifications}
        searchKeys={["title", "body", "priority", "status", "category"]}
      />
      <Modal onClose={() => setCreating(false)} open={creating} title="Create notification">
        <RecordForm<Notification>
          fields={notificationFields}
          initialValue={{ category: "Workflow", priority: "Medium", status: "Unread" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("notifications", {
              body: String(value.body ?? ""),
              category: (value.category as Notification["category"]) || "Workflow",
              createdAt: new Date().toISOString(),
              id: makeId("note"),
              priority: (value.priority as Priority) || "Medium",
              status: (value.status as NotificationStatus) || "Unread",
              title: String(value.title ?? "Notification"),
            });
            setCreating(false);
          }}
          submitLabel="Create notification"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit notification">
        {editing ? (
          <RecordForm<Notification>
            fields={notificationFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("notifications", editing.id, value);
              setEditing(null);
            }}
            submitLabel="Save notification"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function SettingsPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [section, setSection] = useState<SettingItem["section"]>("General");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SettingItem | null>(null);
  const sections: SettingItem["section"][] = ["General", "Workflow", "Notifications", "Security", "Branding"];
  const visible = store.settings.filter((item) => item.section === section);

  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New Setting</Button>}
        description="Configure general workspace defaults, workflow controls, notification routing, security posture, and branding."
        eyebrow="Administration"
        title="Settings"
      />
      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <Card>
          <CardContent className="space-y-2">
            {sections.map((item) => (
              <button
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${
                  section === item ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                }`}
                key={item}
                onClick={() => setSection(item)}
                type="button"
              >
                <Settings className="h-4 w-4" />
                {item}
              </button>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            {visible.map((item) => (
              <div className="flex flex-col gap-3 rounded-md border border-slate-100 p-4 md:flex-row md:items-center md:justify-between" key={item.id}>
                <div>
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="text-sm text-slate-500">{item.value}</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <input
                      checked={item.enabled}
                      className="h-4 w-4 accent-blue-600"
                      onChange={(event) => updateItem("settings", item.id, { enabled: event.target.checked })}
                      type="checkbox"
                    />
                    Enabled
                  </label>
                  <ActionPair onDelete={() => deleteItem("settings", item.id)} onEdit={() => setEditing(item)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Modal onClose={() => setCreating(false)} open={creating} title="Create setting">
        <RecordForm<SettingItem>
          fields={settingFields}
          initialValue={{ section, enabled: true }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("settings", {
              enabled: true,
              id: makeId("setting"),
              label: String(value.label ?? "Setting"),
              section: (value.section as SettingItem["section"]) || section,
              value: String(value.value ?? ""),
            });
            setCreating(false);
          }}
          submitLabel="Create setting"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit setting">
        {editing ? (
          <RecordForm<SettingItem>
            fields={settingFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("settings", editing.id, value);
              setEditing(null);
            }}
            submitLabel="Save setting"
          />
        ) : null}
      </Modal>
    </div>
  );
}
