"use client";

import Link from "next/link";
import {
  BadgeIndianRupee,
  CheckSquare,
  FileText,
  Plus,
  Building2,
  Info,
  FileSpreadsheet,
  GitBranch,
  UploadCloud,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BarChartCard, KpiCard, PieChartCard, TrendCard } from "@/components/charts";
import { ActionPair, DetailGrid, DetailItem, PageHeader } from "@/components/module";
import { Column, DataTable } from "@/components/ui/data-table";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Label,
  Modal,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
} from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { useMockStore } from "@/lib/store";
import {
  AuditLog,
  Commission,
  Dsa,
  DsaInvoice,
  DsaInvoiceEvent,
  DsaInvoiceStatus,
  Notification,
  NotificationStatus,
  PermissionAction,
  Priority,
  Product,
  User,
  UserRole,
} from "@/lib/types";
import { compactNumber, formatCurrency, formatDate, makeId, titleCase } from "@/lib/utils";

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
  "Branch Regional Head",
  "Branch User",
  "DSA Partner",
  "DSA Agent",
  "Customer",
];

const managedUserRoles = userRoles.filter((role) => role !== "DSA Partner" && role !== "DSA Agent");

const permissionActions: PermissionAction[] = ["View", "Create", "Edit", "Delete", "Approve"];
const iracClasses = ["SMA-0", "SMA-1", "SMA-2", "NPA"] as const;
const IRAC_BASE_DATE = new Date("2026-07-30T14:30:00+05:30");

type IracClass = (typeof iracClasses)[number];
type IracDpdBucket = "1-30" | "31-60" | "61-90" | "90+";

interface IracLoanAccountRow {
  accountStatus: string;
  applicationId: string;
  applicationRecordId: string;
  customer: string;
  daysPastDue: number;
  dpdBucket: IracDpdBucket;
  dsaId: string;
  dsaName: string;
  dueDate: string;
  id: string;
  iracClass: IracClass;
  loanAccountNumber: string;
  overdueAmount: number;
  outstandingAmount: number;
  product: Product;
  riskScore: number;
  statusNote: string;
}

function iracClassForDpd(daysPastDue: number): IracClass {
  if (daysPastDue > 90) return "NPA";
  if (daysPastDue > 60) return "SMA-2";
  if (daysPastDue > 30) return "SMA-1";
  return "SMA-0";
}

function iracBucketForDpd(daysPastDue: number): IracDpdBucket {
  if (daysPastDue > 90) return "90+";
  if (daysPastDue > 60) return "61-90";
  if (daysPastDue > 30) return "31-60";
  return "1-30";
}

function iracDateOffset(days: number) {
  const date = new Date(IRAC_BASE_DATE);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function iracClassRank(value: IracClass) {
  return iracClasses.indexOf(value);
}

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
  { label: "Role", name: "role", options: managedUserRoles, required: true, type: "select" },
  { label: "Region", name: "region", required: true },
  { label: "Status", name: "status", options: ["Active", "Invited", "Disabled"], required: true, type: "select" },
];

const notificationFields: FieldConfig<Notification>[] = [
  { label: "Title", name: "title", required: true },
  { label: "Body", name: "body", required: true, type: "textarea" },
  { label: "Priority", name: "priority", options: ["Low", "Medium", "High", "Critical"], required: true, type: "select" },
  { label: "Status", name: "status", options: ["Unread", "Read", "Archived"], required: true, type: "select" },
  { label: "Category", name: "category", options: ["Workflow", "Risk", "Payout", "System", "Lead"], required: true, type: "select" },
  { label: "Target page path", name: "href" },
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

const invoiceStatuses: DsaInvoiceStatus[] = [
  "Raised by DSA",
  "Countered by Bank",
  "Countered by DSA",
  "Pending Approval",
  "Approved",
  "Rejected",
];

type FinanceTab = "raise" | "invoices" | "commissions";

function moneyFromInput(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function makeInvoiceEvent(
  action: DsaInvoiceEvent["action"],
  actor: string,
  party: DsaInvoiceEvent["party"],
  amount: number,
  note: string,
): DsaInvoiceEvent {
  return {
    action,
    actor,
    amount,
    at: new Date().toISOString(),
    id: makeId("inv-event"),
    note,
    party,
  };
}

function invoiceTotal(grossAmount: number, adjustmentAmount: number, taxAmount: number) {
  return Math.max(0, grossAmount + taxAmount - adjustmentAmount);
}

function newDsaInvoice({
  actor,
  dsa,
  grossAmount,
  adjustmentAmount,
  month,
  note,
  source = "Manual",
  status = "Raised by DSA",
  taxAmount,
  party = "DSA",
  csvBatchId,
}: {
  actor: string;
  dsa: Dsa;
  grossAmount: number;
  adjustmentAmount: number;
  month: string;
  note: string;
  source?: DsaInvoice["source"];
  status?: DsaInvoiceStatus;
  taxAmount: number;
  party?: DsaInvoiceEvent["party"];
  csvBatchId?: string;
}): DsaInvoice {
  const now = new Date().toISOString();
  const netAmount = invoiceTotal(grossAmount, adjustmentAmount, taxAmount);

  return {
    adjustmentAmount,
    createdAt: now,
    csvBatchId,
    dsaCode: dsa.code,
    dsaId: dsa.id,
    dsaName: dsa.name,
    grossAmount,
    history: [makeInvoiceEvent(source === "CSV Upload" ? "CSV Imported" : "Raised", actor, party, netAmount, note)],
    id: makeId("invoice"),
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    month,
    netAmount,
    raisedBy: actor,
    raisedByRole: party === "DSA" ? "DSA Partner" : party === "DSA Credit" ? "DSA Credit" : "DSA Manager",
    remarks: note,
    requestedAmount: netAmount,
    source,
    status,
    taxAmount,
    updatedAt: now,
  };
}

function renderInvoiceTracker(status: DsaInvoiceStatus) {
  const steps = ["Raised", "Review", "Counter", "Final"] as const;
  const activeIndex =
    status === "Raised by DSA"
      ? 0
      : status === "Pending Approval"
        ? 1
        : status === "Countered by Bank" || status === "Countered by DSA"
          ? 2
          : 3;

  return (
    <div className="flex min-w-52 items-center gap-2">
      {steps.map((step, index) => (
        <div className="flex flex-1 items-center gap-2" key={step}>
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
              index <= activeIndex ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
            }`}
          >
            {index + 1}
          </span>
          <span className={`hidden text-[10px] font-semibold md:inline ${index <= activeIndex ? "text-blue-700" : "text-slate-400"}`}>
            {step}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CommissionsPage({
  initialTab,
  showTabs = true,
}: {
  initialTab?: FinanceTab;
  showTabs?: boolean;
} = {}) {
  const { createItem, deleteItem, store, updateItem, currentUser } = useMockStore();
  const isDsaUser = currentUser?.role === "DSA Partner";
  const canReviewInvoices = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";
  const resolvedTab: FinanceTab = isDsaUser
    ? initialTab === "commissions"
      ? "commissions"
      : "raise"
    : initialTab ?? "invoices";
  const [tab, setTab] = useState<FinanceTab>(resolvedTab);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Commission | null>(null);
  const [selectedDsaId, setSelectedDsaId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [viewingInvoice, setViewingInvoice] = useState<DsaInvoice | null>(null);
  const [counterInvoice, setCounterInvoice] = useState<DsaInvoice | null>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNote, setCounterNote] = useState("");
  const [raiseMonth, setRaiseMonth] = useState(new Date().toLocaleString("default", { month: "short", year: "numeric" }));
  const [raiseGross, setRaiseGross] = useState("");
  const [raiseAdjustment, setRaiseAdjustment] = useState("0");
  const [raiseTax, setRaiseTax] = useState("0");
  const [raiseRemarks, setRaiseRemarks] = useState("");
  const defaultDsa = store.dsas.find((d) => d.status === "Active") || store.dsas[0];
  const sessionDsa = isDsaUser ? store.dsas.find((dsa) => dsa.id === currentUser?.id) : defaultDsa;
  const allInvoiceRows = useMemo(
    () =>
      [...store.dsaInvoices].sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt).getTime() -
          new Date(left.updatedAt || left.createdAt).getTime(),
      ),
    [store.dsaInvoices],
  );
  const scopedInvoices = isDsaUser
    ? allInvoiceRows.filter((invoice) => invoice.dsaId === currentUser?.id)
    : allInvoiceRows;
  const visibleInvoices = scopedInvoices.filter(
    (invoice) => (!selectedDsaId || invoice.dsaId === selectedDsaId) && (!selectedMonth || invoice.month === selectedMonth),
  );
  const invoiceMonths = Array.from(new Set(scopedInvoices.map((invoice) => invoice.month))).sort();
  const totalInvoiceAmount = visibleInvoices.reduce((sum, item) => sum + item.requestedAmount, 0);
  const approvedInvoiceAmount = visibleInvoices.reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0);
  const openInvoiceCount = visibleInvoices.filter((item) => item.status !== "Approved" && item.status !== "Rejected").length;
  const totalPayout = store.commissions.reduce((sum, item) => sum + item.payout, 0);
  const processed = store.commissions.filter((item) => item.status === "Processed").reduce((sum, item) => sum + item.payout, 0);
  const pageTitle = isDsaUser
    ? tab === "commissions"
      ? "My Commissions"
      : "Raise Invoices"
    : tab === "commissions"
      ? "Commission Management"
      : "Invoice Management";
  const pageDescription = isDsaUser
    ? tab === "commissions"
      ? "Track your commission payout batches."
      : "Raise payout invoices and track bank approval or counter-invoice status."
    : tab === "commissions"
      ? "Create, review, and maintain commission payout batches."
      : "Review DSA invoices, counter mismatches, and close approvals.";

  useEffect(() => {
    setTab(resolvedTab);
  }, [resolvedTab]);

  function notifyInvoice(title: string, body: string, href = "/finance/invoices") {
    createItem("notifications", {
      body,
      category: "Payout",
      createdAt: new Date().toISOString(),
      href,
      id: makeId("note"),
      priority: "High",
      status: "Unread",
      title,
    });
  }

  function raiseInvoiceFromForm() {
    if (!sessionDsa) return;

    const grossAmount = moneyFromInput(raiseGross);
    const adjustmentAmount = moneyFromInput(raiseAdjustment);
    const taxAmount = moneyFromInput(raiseTax);
    if (grossAmount <= 0) return;

    const actor = currentUser?.name ?? sessionDsa.name;
    const invoice = newDsaInvoice({
      actor,
      adjustmentAmount,
      dsa: sessionDsa,
      grossAmount,
      month: raiseMonth,
      note: raiseRemarks.trim() || "DSA invoice raised for bank review.",
      party: "DSA",
      source: "Manual",
      status: "Raised by DSA",
      taxAmount,
    });
    createItem("dsaInvoices", invoice);
    notifyInvoice("DSA invoice raised", `${sessionDsa.name} raised ${invoice.invoiceNumber} for ${formatCurrency(invoice.requestedAmount)}.`);
    setRaiseGross("");
    setRaiseAdjustment("0");
    setRaiseTax("0");
    setRaiseRemarks("");
  }

  function openCounter(invoice: DsaInvoice) {
    setCounterInvoice(invoice);
    setCounterAmount(String(invoice.requestedAmount));
    setCounterNote("");
  }

  function saveCounterInvoice() {
    if (!counterInvoice) return;

    const amount = moneyFromInput(counterAmount);
    if (amount <= 0) return;
    const actor = currentUser?.name ?? "DSA";
    const bankCounter = canReviewInvoices;
    const party = bankCounter ? (currentUser?.role === "DSA Credit" ? "DSA Credit" : "Super Admin") : "DSA";
    const note = counterNote.trim() || `${party} countered the invoice amount.`;
    const event = makeInvoiceEvent("Countered", actor, party, amount, note);

    updateItem("dsaInvoices", counterInvoice.id, {
      history: [event, ...counterInvoice.history],
      requestedAmount: amount,
      remarks: note,
      status: bankCounter ? "Countered by Bank" : "Countered by DSA",
      updatedAt: event.at,
    });
    notifyInvoice(
      bankCounter ? "Bank counter invoice raised" : "DSA counter invoice raised",
      `${counterInvoice.invoiceNumber} was countered at ${formatCurrency(amount)}.`,
    );
    setCounterInvoice(null);
  }

  function closeInvoice(status: "Approved" | "Rejected", invoice: DsaInvoice) {
    const actor = currentUser?.name ?? "Credit";
    const amount = invoice.requestedAmount;
    const event = makeInvoiceEvent(status, actor, currentUser?.role === "DSA Credit" ? "DSA Credit" : "Super Admin", amount, `${status} at ${formatCurrency(amount)}.`);
    updateItem("dsaInvoices", invoice.id, {
      approvedAmount: status === "Approved" ? amount : invoice.approvedAmount,
      history: [event, ...invoice.history],
      status,
      updatedAt: event.at,
    });
    notifyInvoice(`Invoice ${status.toLowerCase()}`, `${invoice.invoiceNumber} for ${invoice.dsaName} is ${status.toLowerCase()}.`);
  }

  function handleInvoiceCsv(file?: File) {
    if (!file) return;
    const batchId = makeId("csv-invoice");
    file.text().then((text) => {
      const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
      const headers = headerLine.split(",").map((item) => item.trim());
      lines.forEach((line) => {
        const row = Object.fromEntries(line.split(",").map((value, index) => [headers[index], value.trim()]));
        const dsa = store.dsas.find((item) => item.id === row.dsaId || item.code === row.dsaCode) ?? defaultDsa;
        if (!dsa) return;
        const grossAmount = moneyFromInput(row.grossAmount || row.gross || row.amount);
        const adjustmentAmount = moneyFromInput(row.adjustmentAmount || row.adjustment || "0");
        const taxAmount = moneyFromInput(row.taxAmount || row.tax || "0");
        if (grossAmount <= 0) return;
        createItem(
          "dsaInvoices",
          newDsaInvoice({
            actor: currentUser?.name ?? "CSV Upload",
            adjustmentAmount,
            csvBatchId: batchId,
            dsa,
            grossAmount,
            month: row.month || selectedMonth || raiseMonth,
            note: row.remarks || `Imported from ${file.name}.`,
            party: "Bank",
            source: "CSV Upload",
            status: (invoiceStatuses.includes(row.status as DsaInvoiceStatus) ? row.status : "Pending Approval") as DsaInvoiceStatus,
            taxAmount,
          }),
        );
      });
      notifyInvoice("Invoice CSV uploaded", `${file.name} imported as batch ${batchId}.`);
    });
  }

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

  const invoiceColumns: Column<DsaInvoice>[] = [
    { cell: (item) => <span className="font-semibold text-blue-700">{item.invoiceNumber}</span>, header: "Invoice", key: "invoiceNumber", sortable: true, sortValue: (item) => item.invoiceNumber },
    { cell: (item) => item.dsaName, header: "DSA", key: "dsaName", sortable: true, sortValue: (item) => item.dsaName },
    { cell: (item) => item.month, header: "Month", key: "month", sortable: true, sortValue: (item) => item.month },
    { cell: (item) => formatCurrency(item.requestedAmount), header: "Requested", key: "requestedAmount", sortable: true, sortValue: (item) => item.requestedAmount },
    { cell: (item) => item.approvedAmount ? formatCurrency(item.approvedAmount) : "-", header: "Approved", key: "approvedAmount" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status", sortable: true, sortValue: (item) => item.status },
    { cell: (item) => renderInvoiceTracker(item.status), header: "Track", key: "track" },
  ];

  const invoiceDashboard = (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard change="Live" icon={FileSpreadsheet} label="Requested amount" value={formatCurrency(totalInvoiceAmount)} />
        <KpiCard change="Final" icon={CheckSquare} label="Approved amount" tone="green" value={formatCurrency(approvedInvoiceAmount)} />
        <KpiCard change="Needs action" icon={GitBranch} label="Open invoices" tone="amber" value={String(openInvoiceCount)} />
      </div>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(180px,260px)_minmax(160px,220px)_auto] lg:items-end">
              <Field>
                <Label>DSA</Label>
                <Select onChange={(event) => setSelectedDsaId(event.target.value)} value={selectedDsaId}>
                  <option value="">All DSAs</option>
                  {store.dsas.map((dsa) => (
                    <option key={dsa.id} value={dsa.id}>{dsa.name} ({dsa.code})</option>
                  ))}
                </Select>
              </Field>
              <Field>
                <Label>Month</Label>
                <Select onChange={(event) => setSelectedMonth(event.target.value)} value={selectedMonth}>
                  <option value="">All months</option>
                  {invoiceMonths.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </Select>
              </Field>
              {currentUser?.role === "DSA Manager" ? (
                <Field>
                  <Label>CSV Upload</Label>
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                    <UploadCloud className="h-4 w-4" />
                    Upload CSV
                    <Input accept=".csv,text/csv" className="hidden" onChange={(event) => {
                      handleInvoiceCsv(event.target.files?.[0]);
                      event.target.value = "";
                    }} type="file" />
                  </label>
                </Field>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Invoice differences are handled through counter invoices/adjustment notes. The original claim stays in history, and final approval closes the chain.
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <BarChartCard
          data={visibleInvoices.map((invoice) => ({ name: invoice.invoiceNumber.slice(-6), value: Math.round(invoice.requestedAmount / 1000) }))}
          dataKey="value"
          subtitle="Requested invoice amount in thousands"
          title="Invoice value by claim"
        />
        <PieChartCard
          data={invoiceStatuses.map((status) => ({ name: status.replace(" by ", " "), value: visibleInvoices.filter((invoice) => invoice.status === status).length }))}
          dataKey="value"
          subtitle="Current invoice workflow split"
          title="Invoice status mix"
        />
      </div>
      <DataTable
        actions={(item) => (
          <div className="flex justify-end gap-2">
            <Button onClick={() => setViewingInvoice(item)} size="sm" type="button" variant="outline">Track</Button>
            {canReviewInvoices && item.status !== "Approved" && item.status !== "Rejected" ? (
              <>
                <Button onClick={() => openCounter(item)} size="sm" type="button" variant="secondary">Counter</Button>
                <Button onClick={() => closeInvoice("Approved", item)} size="sm" type="button">Approve</Button>
                <Button onClick={() => closeInvoice("Rejected", item)} size="sm" type="button" variant="danger">Reject</Button>
              </>
            ) : null}
          </div>
        )}
        columns={invoiceColumns}
        emptyDescription="Invoices raised by DSAs or imported by CSV will appear here."
        emptyTitle="No invoices found"
        items={visibleInvoices}
        searchKeys={["invoiceNumber", "dsaName", "dsaCode", "month", "status", "remarks"]}
      />
    </div>
  );

  const raiseInvoicePanel = (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950">Raise invoice to Cosmos Bank</h3>
            <p className="mt-1 text-xs text-slate-500">Submit monthly payout claims. Bank/Credit may approve or counter with an adjustment amount.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <Field>
              <Label>Month</Label>
              <Input onChange={(event) => setRaiseMonth(event.target.value)} value={raiseMonth} />
            </Field>
            <Field>
              <Label>Gross amount</Label>
              <Input onChange={(event) => setRaiseGross(event.target.value)} type="number" value={raiseGross} />
            </Field>
            <Field>
              <Label>Adjustment / debit note</Label>
              <Input onChange={(event) => setRaiseAdjustment(event.target.value)} type="number" value={raiseAdjustment} />
            </Field>
            <Field>
              <Label>Tax amount</Label>
              <Input onChange={(event) => setRaiseTax(event.target.value)} type="number" value={raiseTax} />
            </Field>
            <div className="flex items-end">
              <Button className="w-full" disabled={!sessionDsa || moneyFromInput(raiseGross) <= 0} onClick={raiseInvoiceFromForm} type="button">
                Raise Invoice
              </Button>
            </div>
          </div>
          <Field>
            <Label>Remarks / calculation basis</Label>
            <Textarea onChange={(event) => setRaiseRemarks(event.target.value)} placeholder="Example: June disbursal commission less prior debit note." value={raiseRemarks} />
          </Field>
        </CardContent>
      </Card>
      <DataTable
        actions={(item) => (
          <div className="flex justify-end gap-2">
            <Button onClick={() => setViewingInvoice(item)} size="sm" type="button" variant="outline">Track</Button>
            {item.status === "Countered by Bank" ? (
              <Button onClick={() => openCounter(item)} size="sm" type="button" variant="secondary">Counter back</Button>
            ) : null}
          </div>
        )}
        columns={invoiceColumns}
        emptyDescription="Raise your first monthly invoice from the form above."
        emptyTitle="No DSA invoices yet"
        items={visibleInvoices}
        searchKeys={["invoiceNumber", "month", "status", "remarks", "dsaName"]}
      />
    </div>
  );

  const commissionsPanel = (
    <>
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
        items={isDsaUser ? store.commissions.filter((item) => item.dsaId === currentUser?.id) : store.commissions}
        searchKeys={["payoutId", "dsaName", "month", "product", "status"]}
      />
    </>
  );

  return (
    <div>
      <PageHeader
        action={tab === "commissions" && !isDsaUser ? <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New Payout</Button> : undefined}
        description={pageDescription}
        eyebrow="Finance"
        title={pageTitle}
      />
      {showTabs ? (
        <Tabs
          onChange={(value) => setTab(value as FinanceTab)}
          tabs={
            isDsaUser
              ? [
                  { label: "Raise Invoices", value: "raise" },
                  { label: "My Commissions", value: "commissions" },
                ]
              : [
                  { label: "Invoices", value: "invoices" },
                  { label: "Commissions", value: "commissions" },
                ]
          }
          value={tab}
        />
      ) : null}
      <div className={showTabs ? "mt-6" : "mt-0"}>
        {tab === "raise" ? raiseInvoicePanel : null}
        {tab === "invoices" ? invoiceDashboard : null}
        {tab === "commissions" ? commissionsPanel : null}
      </div>
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
      <Modal onClose={() => setViewingInvoice(null)} open={Boolean(viewingInvoice)} title="Invoice status tracker" width="max-w-2xl">
        {viewingInvoice ? (
          <div className="space-y-4">
            <DetailGrid>
              <DetailItem label="Invoice" value={viewingInvoice.invoiceNumber} />
              <DetailItem label="DSA" value={viewingInvoice.dsaName} />
              <DetailItem label="Month" value={viewingInvoice.month} />
              <DetailItem label="Requested" value={formatCurrency(viewingInvoice.requestedAmount)} />
              <DetailItem label="Status" value={<StatusBadge status={viewingInvoice.status} />} />
              <DetailItem label="Source" value={viewingInvoice.source} />
            </DetailGrid>
            {renderInvoiceTracker(viewingInvoice.status)}
            <div className="space-y-3">
              {viewingInvoice.history.map((event) => (
                <div className="border-l-2 border-blue-100 pl-3" key={event.id}>
                  <p className="text-sm font-semibold text-slate-950">{event.action} - {formatCurrency(event.amount)}</p>
                  <p className="text-xs text-slate-500">{event.actor} / {event.party} - {formatDate(event.at)}</p>
                  <p className="mt-1 text-sm text-slate-600">{event.note}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal onClose={() => setCounterInvoice(null)} open={Boolean(counterInvoice)} title="Raise counter invoice / adjustment" width="max-w-lg">
        {counterInvoice ? (
          <div className="space-y-4">
            <DetailGrid>
              <DetailItem label="Original invoice" value={counterInvoice.invoiceNumber} />
              <DetailItem label="Current requested" value={formatCurrency(counterInvoice.requestedAmount)} />
            </DetailGrid>
            <Field>
              <Label>Counter amount</Label>
              <Input onChange={(event) => setCounterAmount(event.target.value)} type="number" value={counterAmount} />
            </Field>
            <Field>
              <Label>Reason / difference basis</Label>
              <Textarea onChange={(event) => setCounterNote(event.target.value)} placeholder="Example: payout adjusted for previous debit note or billing mismatch." value={counterNote} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCounterInvoice(null)} type="button" variant="secondary">Cancel</Button>
              <Button disabled={moneyFromInput(counterAmount) <= 0} onClick={saveCounterInvoice} type="button">Save counter</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function ReportsPage() {
  const { currentUser, store } = useMockStore();
  const [tab, setTab] = useState("performance");
  const [auditDsaFilter, setAuditDsaFilter] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState("");
  const [auditEntityFilter, setAuditEntityFilter] = useState("");
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditFromDate, setAuditFromDate] = useState("");
  const [auditToDate, setAuditToDate] = useState("");
  const [iracClassFilter, setIracClassFilter] = useState("");
  const [iracDsaFilter, setIracDsaFilter] = useState("");
  const [iracProductFilter, setIracProductFilter] = useState("");
  const [iracStatusFilter, setIracStatusFilter] = useState("");
  const isSuperAdmin = currentUser?.role === "DSA Manager";
  const performance = store.dsas.slice(0, 8).map((dsa) => ({
    name: dsa.code,
    value: dsa.approvalRate,
  }));
  const volume = ["Personal Loan", "Home Loan", "Loan Against Property", "Business Loan", "Auto Loan"].map((product) => ({
    name: product.replace(" Loan", ""),
    value: store.applications.filter((item) => item.product === product).length,
  }));
  const rejection = ["Low salary", "Bureau risk", "KYC mismatch", "Duplicate", "Policy"].map((name) => ({
    name,
    value: 0,
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
  const iracRows = useMemo<IracLoanAccountRow[]>(() => {
    const dpdPattern = [8, 17, 26, 34, 46, 58, 64, 73, 88, 96, 124, 157];
    const statusByClass: Record<IracClass, string> = {
      "SMA-0": "Servicing Watch",
      "SMA-1": "Soft Collection",
      "SMA-2": "Hard Collection",
      NPA: "Recovery / Legal",
    };
    const noteByClass: Record<IracClass, string> = {
      "SMA-0": "Early warning. Borrower contact and reminder due.",
      "SMA-1": "Collection follow-up required before bucket migration.",
      "SMA-2": "High-risk overdue account. Escalate to credit/recovery.",
      NPA: "Non-performing asset. Legal/recovery workflow required.",
    };

    return store.applications
      .filter((application) => application.status !== "Rejected")
      .map((application, index) => {
        const seed = Number(application.applicationId.replace(/\D/g, "")) || index + 1;
        const daysPastDue = dpdPattern[(seed + index) % dpdPattern.length];
        const iracClass = iracClassForDpd(daysPastDue);
        const emiAmount = Math.max(7500, Math.round(application.loanAmount / (36 + (seed % 5) * 12)));
        const overdueInstallments = Math.max(1, Math.ceil(daysPastDue / 30));
        const outstandingAmount = Math.round(application.loanAmount * (0.48 + (seed % 8) * 0.055));
        const overdueAmount = Math.min(outstandingAmount, emiAmount * overdueInstallments);

        return {
          accountStatus: statusByClass[iracClass],
          applicationId: application.applicationId,
          applicationRecordId: application.id,
          customer: application.customer,
          daysPastDue,
          dpdBucket: iracBucketForDpd(daysPastDue),
          dsaId: application.dsaId,
          dsaName: application.dsaName,
          dueDate: iracDateOffset(-daysPastDue),
          id: `irac-${application.id}`,
          iracClass,
          loanAccountNumber: `LAN-COS-${String(seed).padStart(6, "0")}`,
          overdueAmount,
          outstandingAmount,
          product: application.product,
          riskScore: application.riskScore,
          statusNote: noteByClass[iracClass],
        };
      })
      .sort((left, right) => right.daysPastDue - left.daysPastDue || left.dsaName.localeCompare(right.dsaName));
  }, [store.applications]);
  const filteredIracRows = useMemo(
    () =>
      iracRows.filter(
        (row) =>
          (!iracClassFilter || row.iracClass === iracClassFilter) &&
          (!iracDsaFilter || row.dsaId === iracDsaFilter) &&
          (!iracProductFilter || row.product === iracProductFilter) &&
          (!iracStatusFilter || row.accountStatus === iracStatusFilter),
      ),
    [iracClassFilter, iracDsaFilter, iracProductFilter, iracRows, iracStatusFilter],
  );
  const iracDsaOptions = useMemo(
    () => store.dsas.filter((dsa) => iracRows.some((row) => row.dsaId === dsa.id)).sort((left, right) => left.name.localeCompare(right.name)),
    [iracRows, store.dsas],
  );
  const iracAccountStatusOptions = useMemo(
    () => Array.from(new Set(iracRows.map((row) => row.accountStatus))).sort(),
    [iracRows],
  );
  const iracOutstanding = filteredIracRows.reduce((sum, row) => sum + row.outstandingAmount, 0);
  const iracOverdue = filteredIracRows.reduce((sum, row) => sum + row.overdueAmount, 0);
  const iracNpaRows = filteredIracRows.filter((row) => row.iracClass === "NPA");
  const iracColumns: Column<IracLoanAccountRow>[] = [
    {
      cell: (item) => (
        <div>
          <Link className="font-semibold text-blue-700 hover:underline" href={`/applications/${item.applicationRecordId}`}>
            {item.loanAccountNumber}
          </Link>
          <p className="text-xs text-slate-500">{item.applicationId} - {item.product}</p>
        </div>
      ),
      header: "Loan Account",
      key: "loanAccountNumber",
      sortable: true,
      sortValue: (item) => item.loanAccountNumber,
    },
    {
      cell: (item) => (
        <div>
          <p className="font-medium text-slate-950">{item.customer}</p>
          <p className="text-xs text-slate-500">{item.dsaName}</p>
        </div>
      ),
      header: "Borrower / DSA",
      key: "customer",
      sortable: true,
      sortValue: (item) => item.customer,
    },
    {
      cell: (item) => <StatusBadge status={item.iracClass} />,
      header: "IRAC",
      key: "iracClass",
      sortable: true,
      sortValue: (item) => iracClassRank(item.iracClass),
    },
    {
      cell: (item) => (
        <div>
          <p className="font-semibold text-slate-950">{item.daysPastDue} DPD</p>
          <p className="text-xs text-slate-500">Due {formatDate(item.dueDate)}</p>
        </div>
      ),
      header: "Overdue",
      key: "daysPastDue",
      sortable: true,
      sortValue: (item) => item.daysPastDue,
    },
    {
      cell: (item) => (
        <div className="text-right">
          <p className="font-semibold text-slate-950">{formatCurrency(item.outstandingAmount)}</p>
          <p className="text-xs text-rose-600">OD {formatCurrency(item.overdueAmount)}</p>
        </div>
      ),
      header: "Outstanding / OD",
      key: "outstandingAmount",
      sortable: true,
      sortValue: (item) => item.outstandingAmount,
    },
    { cell: (item) => item.accountStatus, header: "Collection Status", key: "accountStatus", sortable: true, sortValue: (item) => item.accountStatus },
    { cell: (item) => item.riskScore, header: "Risk", key: "riskScore", sortable: true, sortValue: (item) => item.riskScore },
    { cell: (item) => <span className="text-xs text-slate-600">{item.statusNote}</span>, header: "Action Note", key: "statusNote" },
  ];
  const auditRows = useMemo(() => {
    const fromTime = auditFromDate ? new Date(`${auditFromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = auditToDate ? new Date(`${auditToDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

    return store.auditLogs
      .filter((row) => {
        const rowTime = new Date(row.at).getTime();
        const action = row.actionType ?? row.action;
        return (
          action !== "Login" &&
          action !== "Logout" &&
          (!auditDsaFilter || row.affectedDsaId === auditDsaFilter) &&
          (!auditRoleFilter || row.actorRole === auditRoleFilter || row.affectedRole === auditRoleFilter) &&
          (!auditEntityFilter || row.collection === auditEntityFilter || row.entity === auditEntityFilter) &&
          (!auditActionFilter || row.action === auditActionFilter || row.actionType === auditActionFilter) &&
          rowTime >= fromTime &&
          rowTime <= toTime
        );
      })
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  }, [auditActionFilter, auditDsaFilter, auditEntityFilter, auditFromDate, auditRoleFilter, auditToDate, store.auditLogs]);
  const auditRoleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          store.auditLogs
            .filter((row) => !["Login", "Logout"].includes(row.actionType ?? row.action))
            .flatMap((row) => [row.actorRole, row.affectedRole])
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [store.auditLogs],
  );
  const auditEntityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          store.auditLogs
            .filter((row) => !["Login", "Logout"].includes(row.actionType ?? row.action))
            .map((row) => row.collection ?? row.entity)
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [store.auditLogs],
  );
  const auditActionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          store.auditLogs
            .map((row) => row.actionType ?? row.action)
            .filter((action) => Boolean(action) && action !== "Login" && action !== "Logout"),
        ),
      ).sort(),
    [store.auditLogs],
  );
  const auditColumns: Column<AuditLog>[] = [
    {
      cell: (item) => (
        <div>
          <p className="font-semibold text-slate-950">{formatDate(item.at)}</p>
          <p className="text-xs text-slate-500">{new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      ),
      header: "Time",
      key: "at",
      sortable: true,
      sortValue: (item) => item.at,
    },
    {
      cell: (item) => (
        <div>
          <p className="font-semibold text-slate-950">{item.actor}</p>
          <p className="text-xs text-slate-500">{item.actorRole ?? "Unknown role"}</p>
        </div>
      ),
      header: "Actor / Role",
      key: "actor",
      sortable: true,
      sortValue: (item) => item.actor,
    },
    {
      cell: (item) => (
        <div>
          <StatusBadge status={item.actionType ?? item.action} />
          <p className="mt-1 text-xs text-slate-500">{item.summary ?? `${item.action} ${item.entity}`}</p>
        </div>
      ),
      header: "Activity",
      key: "action",
      sortable: true,
      sortValue: (item) => item.action,
    },
    {
      cell: (item) => (
        <div>
          <p className="font-medium text-slate-900">{item.entityName ?? item.entity}</p>
          <p className="text-xs text-slate-500">{item.entity} {item.entityId ? `- ${item.entityId}` : ""}</p>
        </div>
      ),
      header: "Affected Entity",
      key: "entity",
      sortable: true,
      sortValue: (item) => item.entity,
    },
    {
      cell: (item) => item.affectedDsaName ? (
        <div>
          <p className="font-medium text-slate-900">{item.affectedDsaName}</p>
          <p className="font-mono text-xs text-slate-500">{item.affectedDsaId}</p>
        </div>
      ) : (
        <span className="text-xs text-slate-400">Bank-level</span>
      ),
      header: "DSA Scope",
      key: "affectedDsaName",
      sortable: true,
      sortValue: (item) => item.affectedDsaName ?? "",
    },
    {
      cell: (item) => (
        <div className="max-w-md space-y-1 text-xs text-slate-600">
          <p><span className="font-semibold text-slate-800">Fields:</span> {item.changedFields?.length ? item.changedFields.join(", ") : "-"}</p>
          {item.fromValue ? <p><span className="font-semibold text-slate-800">Before:</span> {item.fromValue}</p> : null}
          {item.toValue ? <p><span className="font-semibold text-slate-800">After:</span> {item.toValue}</p> : null}
        </div>
      ),
      header: "Change Details",
      key: "summary",
    },
    { cell: (item) => <StatusBadge status={item.severity} />, header: "Severity", key: "severity", sortable: true, sortValue: (item) => item.severity },
  ];

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
          { label: "IRAC Classification", value: "irac" },
          ...(isSuperAdmin ? [{ label: "Audit Trail", value: "auditTrail" }] : []),
          { label: "Application Volume", value: "volume" },
          { label: "Approval Rate", value: "approval" },
          { label: "Rejection Analysis", value: "rejection" },
          { label: "Lead Conversion", value: "conversion" },
        ]}
        value={tab}
      />

      {tab === "auditTrail" && isSuperAdmin ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard change="Filtered" icon={FileText} label="Trace events" value={String(auditRows.length)} />
            <KpiCard change="Unique" icon={Users} label="Actors" tone="slate" value={String(new Set(auditRows.map((row) => row.actor)).size)} />
            <KpiCard change="Workflow" icon={GitBranch} label="Approvals / flows" tone="blue" value={String(auditRows.filter((row) => (row.actionType ?? row.action).toLowerCase().includes("approval") || (row.actionType ?? row.action).toLowerCase().includes("workflow")).length)} />
            <KpiCard change="Watch" icon={Info} label="Warnings" tone="amber" value={String(auditRows.filter((row) => row.severity !== "Info").length)} />
          </div>
          <Card>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <Field>
                  <Label>DSA</Label>
                  <Select onChange={(event) => setAuditDsaFilter(event.target.value)} value={auditDsaFilter}>
                    <option value="">All DSAs / bank-level</option>
                    {store.dsas.map((dsa) => (
                      <option key={dsa.id} value={dsa.id}>{dsa.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>Role</Label>
                  <Select onChange={(event) => setAuditRoleFilter(event.target.value)} value={auditRoleFilter}>
                    <option value="">All roles</option>
                    {auditRoleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>Entity</Label>
                  <Select onChange={(event) => setAuditEntityFilter(event.target.value)} value={auditEntityFilter}>
                    <option value="">All entities</option>
                    {auditEntityOptions.map((entity) => (
                      <option key={entity} value={entity}>{titleCase(String(entity))}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>Action</Label>
                  <Select onChange={(event) => setAuditActionFilter(event.target.value)} value={auditActionFilter}>
                    <option value="">All actions</option>
                    {auditActionOptions.map((action) => (
                      <option key={action} value={action}>{action}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>From</Label>
                  <Input onChange={(event) => setAuditFromDate(event.target.value)} type="date" value={auditFromDate} />
                </Field>
                <Field>
                  <Label>To</Label>
                  <Input onChange={(event) => setAuditToDate(event.target.value)} type="date" value={auditToDate} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setAuditActionFilter("");
                    setAuditDsaFilter("");
                    setAuditEntityFilter("");
                    setAuditFromDate("");
                    setAuditRoleFilter("");
                    setAuditToDate("");
                  }}
                  type="button"
                  variant="secondary"
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>
          <DataTable
            columns={auditColumns}
            emptyDescription="Run workflow actions, approvals, invoice counters, product changes, document reviews, or DSA lifecycle changes to populate the issue trace."
            emptyTitle="No audit activity for selected filters"
            items={auditRows}
            pageSize={12}
            searchKeys={[
              "actor",
              "actorRole",
              "action",
              "actionType",
              "affectedDsaName",
              "affectedRole",
              "entity",
              "entityName",
              "summary",
              "severity",
            ]}
          />
        </div>
      ) : tab === "irac" ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard change="Filtered" icon={FileText} label="Loan accounts" value={String(filteredIracRows.length)} />
            <KpiCard change="Exposure" icon={BadgeIndianRupee} label="Outstanding" tone="slate" value={formatCurrency(iracOutstanding)} />
            <KpiCard change="Due" icon={Info} label="Overdue amount" tone="amber" value={formatCurrency(iracOverdue)} />
            <KpiCard change="90+ DPD" icon={GitBranch} label="NPA accounts" tone="amber" value={String(iracNpaRows.length)} />
          </div>

          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-slate-900">IRAC Classification</h3>
                <p className="text-xs text-slate-500">
                  SMA buckets are generated from days-past-due: SMA-0 up to 30, SMA-1 31-60, SMA-2 61-90, and NPA above 90 DPD.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field>
                  <Label>DSA</Label>
                  <Select onChange={(event) => setIracDsaFilter(event.target.value)} value={iracDsaFilter}>
                    <option value="">All DSAs</option>
                    {iracDsaOptions.map((dsa) => (
                      <option key={dsa.id} value={dsa.id}>{dsa.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>IRAC status</Label>
                  <Select onChange={(event) => setIracClassFilter(event.target.value)} value={iracClassFilter}>
                    <option value="">All IRAC statuses</option>
                    {iracClasses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>Product</Label>
                  <Select onChange={(event) => setIracProductFilter(event.target.value)} value={iracProductFilter}>
                    <option value="">All products</option>
                    {products.map((product) => (
                      <option key={product} value={product}>{product}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label>Collection status</Label>
                  <Select onChange={(event) => setIracStatusFilter(event.target.value)} value={iracStatusFilter}>
                    <option value="">All statuses</option>
                    {iracAccountStatusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setIracClassFilter("");
                    setIracDsaFilter("");
                    setIracProductFilter("");
                    setIracStatusFilter("");
                  }}
                  type="button"
                  variant="secondary"
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={iracColumns}
            emptyDescription="No loan accounts match the selected DSA, product, IRAC, collection status, or DPD filters."
            emptyTitle="No IRAC accounts found"
            items={filteredIracRows}
            pageSize={12}
            searchKeys={[
              "accountStatus",
              "applicationId",
              "customer",
              "dpdBucket",
              "dsaName",
              "iracClass",
              "loanAccountNumber",
              "product",
              "statusNote",
            ]}
          />
        </div>
      ) : tab === "recovery" ? (
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
              <TrendCard data={["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((name) => ({ name, value: 0 }))} dataKey="value" subtitle="Portfolio approval movement" title="Approval Rate" type="area" />
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
  const visibleUsers = store.users.filter((item) => item.role !== "DSA Partner" && item.role !== "DSA Agent");

  const columns: Column<User>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.name}</span>, header: "User", key: "name", sortable: true, sortValue: (item) => item.name },
    { cell: (item) => item.email, header: "Email", key: "email" },
    { cell: (item) => <Badge tone="blue">{item.role}</Badge>, header: "Role", key: "role" },
    { cell: (item) => item.region, header: "Region", key: "region" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => formatDate(item.lastLogin), header: "Last login", key: "lastLogin" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Maintain internal bank users and customer demo accounts. DSA partners and DSA agents are managed from DSA Management."
        eyebrow="Administration"
        title="User Management"
      />

      <DataTable
        actions={(item) => (
          <ActionPair
            onEdit={() => setEditing(item)}
          />
        )}
        columns={columns}
        items={visibleUsers}
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
              href: String(value.href ?? "").trim() || undefined,
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

