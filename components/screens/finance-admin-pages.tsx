"use client";

import {
  BadgeIndianRupee,
  CheckSquare,
  FileText,
  Plus,
  Settings,
  Building2,
  Info,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useState, useMemo } from "react";

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
  "DSA Credit",
  "Branch User",
  "DSA Partner",
  "Customer",
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
  const defaultDsa = store.dsas.find((d) => d.status === "Active") || store.dsas[0];
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

  // DSA Recovery analysis state and memoized variables
  const dsasWithRecovery = useMemo(() => {
    const ids = Array.from(new Set(store.dsaRecovery.map((r) => r.dsaId)));
    return store.dsas.filter((d) => ids.includes(d.id));
  }, [store.dsas, store.dsaRecovery]);

  const [selectedDsaId, setSelectedDsaId] = useState<string>(() => dsasWithRecovery[0]?.id || "");

  const recoveryRows = useMemo(() => {
    return store.dsaRecovery
      .filter((r) => r.dsaId === selectedDsaId)
      .sort((a, b) => {
        const order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const [aM, aY] = a.month.split(" ");
        const [bM, bY] = b.month.split(" ");
        return Number(aY) - Number(bY) || order.indexOf(aM) - order.indexOf(bM);
      });
  }, [store.dsaRecovery, selectedDsaId]);

  const totalRecovered = useMemo(() => recoveryRows.reduce((s, r) => s + r.recoveredAmount, 0), [recoveryRows]);
  const totalInvoice = useMemo(() => recoveryRows.reduce((s, r) => s + r.invoiceAmount, 0), [recoveryRows]);
  const totalNpa = useMemo(() => recoveryRows.reduce((s, r) => s + r.npaCases, 0), [recoveryRows]);
  const totalPending = useMemo(() => recoveryRows.reduce((s, r) => s + r.pendingAmount, 0), [recoveryRows]);

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
          { label: "DSA Recovery", value: "recovery" },
          { label: "Application Volume", value: "volume" },
          { label: "Approval Rate", value: "approval" },
          { label: "Rejection Analysis", value: "rejection" },
          { label: "Lead Conversion", value: "conversion" },
        ]}
        value={tab}
      />

      {tab === "recovery" ? (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                Select Partner for Recovery Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Analyze carry-forward invoices, targets, shortfalls, and NPA cases per month.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-500">DSA Partner:</span>
              <Select
                aria-label="selected-dsa-recovery"
                className="w-64"
                onChange={(e) => setSelectedDsaId(e.target.value)}
                value={selectedDsaId}
              >
                {dsasWithRecovery.map((dsa) => (
                  <option key={dsa.id} value={dsa.id}>{dsa.name} ({dsa.code})</option>
                ))}
              </Select>
            </div>
          </div>
          
          {recoveryRows.length > 0 ? (
            <div className="space-y-6">
              {/* Carry-forward info banner */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 shadow-sm">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Carry-Forward Invoice Logic:</strong> If a DSA recovers less than their target in month N, the shortfall is deducted from their next month&apos;s invoice.
                  E.g. Target ₹10,00,000, recovered ₹8,00,000 → ₹2,00,000 shortfall carried forward. If they recover ₹20,00,000 next month, net invoice is ₹18,00,000.
                </span>
              </div>

              {/* KPI summary */}
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Total Recovered", value: formatCurrency(totalRecovered), color: "text-emerald-700" },
                  { label: "Total Invoice Generated", value: formatCurrency(totalInvoice), color: "text-blue-700" },
                  { label: "Total Pending", value: formatCurrency(totalPending), color: "text-rose-600" },
                  { label: "Total NPA Cases", value: String(totalNpa), color: totalNpa > 0 ? "text-rose-600" : "text-slate-600" },
                ].map((kpi) => (
                  <div key={kpi.label} className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                    <p className={`mt-1 text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Charts side-by-side */}
              <div className="grid gap-4 xl:grid-cols-2">
                <TrendCard
                  data={recoveryRows.map((r) => ({
                    name: r.month.split(" ")[0],
                    value: Math.round(r.recoveredAmount / 1000),
                  }))}
                  dataKey="value"
                  subtitle="Monthly recovery amount (₹K) vs target"
                  title="Recovery Trend (₹K)"
                  type="area"
                />
                <BarChartCard
                  data={recoveryRows.map((r) => ({
                    name: r.month.split(" ")[0],
                    value: Math.round(r.invoiceAmount / 1000),
                  }))}
                  dataKey="value"
                  subtitle="Net invoice raised after carry-forward shortfall adjustment"
                  title="Invoice Generated After Carry-Forward (₹K)"
                />
              </div>

              {/* Detailed table */}
              <Card className="shadow-sm">
                <CardContent className="p-0">
                  <div className="p-5 border-b border-slate-100">
                    <h4 className="text-sm font-bold text-slate-900">Month-wise Recovery &amp; Billing Report</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Granular view of recovery target achievement and billing metrics.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="p-4 pl-6">Month</th>
                          <th className="p-4 text-right">Target</th>
                          <th className="p-4 text-right">Recovered</th>
                          <th className="p-4 text-right">Carry-In</th>
                          <th className="p-4 text-right">Carry-Out</th>
                          <th className="p-4 text-right">Invoice</th>
                          <th className="p-4 text-right">Cases</th>
                          <th className="p-4 text-right">Billing</th>
                          <th className="p-4 text-right">Pending</th>
                          <th className="p-4 pr-6 text-right">NPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recoveryRows.map((row) => {
                          const achievedPct = row.targetAmount > 0 ? Math.round((row.recoveredAmount / row.targetAmount) * 100) : 0;
                          const isUnder = row.recoveredAmount < row.targetAmount;
                          return (
                            <tr key={row.id} className="hover:bg-slate-50/50 transition">
                              <td className="p-4 pl-6 font-semibold text-slate-800">{row.month}</td>
                              <td className="p-4 text-right text-slate-600 text-xs">{formatCurrency(row.targetAmount)}</td>
                              <td className="p-4 text-right text-xs">
                                <span className={`font-bold ${isUnder ? "text-rose-600" : "text-emerald-700"}`}>
                                  {formatCurrency(row.recoveredAmount)}
                                </span>
                                <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isUnder ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}>
                                  {achievedPct}%
                                </span>
                              </td>
                              <td className="p-4 text-right text-amber-600 text-xs">{row.carryForwardIn > 0 ? formatCurrency(row.carryForwardIn) : "—"}</td>
                              <td className="p-4 text-right text-orange-600 text-xs font-medium">{row.carryForwardOut > 0 ? formatCurrency(row.carryForwardOut) : "—"}</td>
                              <td className="p-4 text-right font-bold text-blue-700 text-xs">{formatCurrency(row.invoiceAmount)}</td>
                              <td className="p-4 text-right text-slate-600 text-xs">{row.totalCases}</td>
                              <td className="p-4 text-right text-slate-600 text-xs">{formatCurrency(row.totalBilling)}</td>
                              <td className="p-4 text-right text-rose-500 text-xs">{formatCurrency(row.pendingAmount)}</td>
                              <td className="p-4 pr-6 text-right text-xs">
                                <span className={`font-bold ${row.npaCases > 0 ? "text-rose-600" : "text-slate-400"}`}>{row.npaCases}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                          <td className="p-4 pl-6">TOTAL</td>
                          <td className="p-4 text-right">{formatCurrency(recoveryRows.reduce((s, r) => s + r.targetAmount, 0))}</td>
                          <td className="p-4 text-right text-emerald-700">{formatCurrency(totalRecovered)}</td>
                          <td className="p-4 text-right text-amber-600">{formatCurrency(recoveryRows.reduce((s, r) => s + r.carryForwardIn, 0))}</td>
                          <td className="p-4 text-right text-orange-600">{formatCurrency(recoveryRows.reduce((s, r) => s + r.carryForwardOut, 0))}</td>
                          <td className="p-4 text-right text-blue-700">{formatCurrency(totalInvoice)}</td>
                          <td className="p-4 text-right">{recoveryRows.reduce((s, r) => s + r.totalCases, 0)}</td>
                          <td className="p-4 text-right">{formatCurrency(recoveryRows.reduce((s, r) => s + r.totalBilling, 0))}</td>
                          <td className="p-4 text-right text-rose-500">{formatCurrency(totalPending)}</td>
                          <td className="p-4 pr-6 text-right text-rose-600">{totalNpa}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-sm">No recovery records for this partner.</div>
          )}
        </div>
      ) : (
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
      )}
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
  const { store, updateItem } = useMockStore();
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
        description="Maintain the fixed demo accounts, their roles, access status, and regional ownership."
        eyebrow="Administration"
        title="User Management"
      />
      <DataTable
        actions={(item) => <ActionPair onEdit={() => setEditing(item)} />}
        columns={columns}
        items={store.users}
        searchKeys={["name", "email", "role", "region", "status"]}
      />
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit user">
        {editing ? (
          <RecordForm<User>
            fields={userFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("users", editing.id, {
                ...value,
                email: editing.email,
                name: editing.name,
              });
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
