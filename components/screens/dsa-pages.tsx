"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Check,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileText,
  KeyRound,
  LogIn,
  Plus,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  BarChart3,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/apis/admin";

import { BarChartCard, KpiCard, TrendCard } from "@/components/charts";
import { ActionPair, DetailGrid, DetailItem, PageHeader } from "@/components/module";
import { OnHoldDsaDocuments } from "@/components/screens/on-hold-dsa-documents";
import { Column, DataTable } from "@/components/ui/data-table";
import {
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
  Tabs,
} from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { useToast } from "@/components/ui/toast";
import { DEMO_USERS, sessionUserFromDsa } from "@/lib/demo-identities";
import { generateDsaCredentials } from "@/lib/dsa-credentials";
import {
  dsaDocumentType,
  isMissingDsaDocumentRecord,
  requiredDsaDocuments,
} from "@/lib/dsa-documents";
import { useMockStore } from "@/lib/store";
import { useDsa } from "@/hooks/useDsa";
import { BusinessType, Dsa, DsaStatus, Product, User } from "@/lib/types";
import { cn, formatCommissionDisplay, formatCurrency, formatDate, generateDsaId, makeId, percent } from "@/lib/utils";


const businessTypes: BusinessType[] = [
  "Sole Proprietor",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
];

const queueStatuses: DsaStatus[] = [
  "Submitted",
  "Pending Branch Approval",
  "Pending BRH Approval",
  "Pending Credit Approval",
  "KYC Pending",
  "On Hold",
];

const managementStatuses: DsaStatus[] = [
  "Draft",
  "Submitted",
  "Pending Branch Approval",
  "Pending BRH Approval",
  "Pending Credit Approval",
  "KYC Pending",
  "On Hold",
  "Active",
  "Suspended",
  "Rejected",
  "Blacklisted",
];

type NetworkPersonRow = {
  applications: number;
  approvedOrDisbursed: number;
  conversion: number;
  disbursed: number;
  email: string;
  id: string;
  leads: number;
  name: string;
  region: string;
  status: User["status"];
};

function activeDsaPatch(dsa: Dsa): Partial<Dsa> {
  return {
    approvalRate: 0,
    commissionEarned: 0,
    documents: dsa.documents.map((document) => ({
      ...document,
      status: "Verified" as const,
      remarks: document.remarks || "Verified during DSA approval.",
    })),
    monthlyLeads: 0,
    rejectionReason: undefined,
    status: "Active",
    statusReason: undefined,
    statusReasonAction: undefined,
    statusReasonAt: undefined,
    statusReasonBy: undefined,
    tier: "Bronze",
  };
}

export type ApprovalStepLevelInfo = {
  currentLevel: number;
  levelName: string;
  roleName: string;
  canUserApprove: boolean;
  actionLabel: string;
  nextLevelName: string;
  isFinalStep: boolean;
  isDeviationStep: boolean;
  isCompleted: boolean;
  isRejected: boolean;
};

function getDocumentUrl(doc: any): string {
  if (!doc) return "";
  const rawUrl = doc.file_url || doc.url;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const apiOrigin = new URL(apiBase).origin;
      if (parsed.hostname === "localhost" && parsed.port !== "8000") {
        return `${apiOrigin}${parsed.pathname}${parsed.search}`;
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  }
  if (doc.file_path) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
    return `${apiBase}/storage/${doc.file_path.replace(/^\/+/, "")}`;
  }
  return "";
}

export function getDsaWorkflowLevelInfo(currentUserRole: string | undefined, dsa: any | null): ApprovalStepLevelInfo {
  if (!dsa) {
    return {
      currentLevel: 1,
      levelName: "Level 1: Assistant Manager",
      roleName: "Assistant Manager",
      canUserApprove: false,
      actionLabel: "Approve",
      nextLevelName: "Level 2: Manager",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  const onboardingStatus = String(dsa.onboarding_status || dsa.status || "").toUpperCase();
  const isCompleted = onboardingStatus === "APPROVED" || onboardingStatus === "AGREEMENT_PENDING" || onboardingStatus === "AGREEMENT_COMPLETED";
  const isRejected = onboardingStatus === "REJECTED";

  if (isCompleted || isRejected) {
    return {
      currentLevel: dsa.current_approval_level || 5,
      levelName: isCompleted ? "Approved & Verified" : "Rejected",
      roleName: "N/A",
      canUserApprove: false,
      actionLabel: isCompleted ? "Approved" : "Rejected",
      nextLevelName: "Completed",
      isFinalStep: true,
      isDeviationStep: false,
      isCompleted,
      isRejected,
    };
  }

  const level = Number(dsa.current_approval_level || 1);
  const isSuperAdmin = currentUserRole === "DSA Manager" || currentUserRole === "Admin";

  if (level === 1) {
    const canApprove = isSuperAdmin || currentUserRole === "Branch User" || currentUserRole === "Assistant Manager";
    return {
      currentLevel: 1,
      levelName: "Level 1: Assistant Manager Review",
      roleName: "Assistant Manager",
      canUserApprove: canApprove,
      actionLabel: "Approve Level 1 (Assistant Manager)",
      nextLevelName: "Level 2: Manager",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 2) {
    const canApprove = isSuperAdmin || currentUserRole === "Branch Regional Head" || currentUserRole === "Manager";
    const isDeviationRequired = (dsa.bre_status === "FAILED" || dsa.bre_status === "failed") && Boolean(dsa.deviation);
    return {
      currentLevel: 2,
      levelName: "Level 2: Manager Review",
      roleName: "Manager",
      canUserApprove: canApprove,
      actionLabel: isDeviationRequired ? "Approve to DGM Deviation (Level 2)" : "Approve to AGM (Level 2)",
      nextLevelName: isDeviationRequired ? "Level 4: DGM (Deviation)" : "Level 3: AGM",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 4) {
    const canApprove = isSuperAdmin || currentUserRole === "DGM";
    return {
      currentLevel: 4,
      levelName: "Level 4: DGM Deviation Approval",
      roleName: "DGM",
      canUserApprove: canApprove,
      actionLabel: "Approve Deviation (DGM Level 4)",
      nextLevelName: "Level 3: AGM",
      isFinalStep: false,
      isDeviationStep: true,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 3) {
    const canApprove = isSuperAdmin || currentUserRole === "DSA Credit" || currentUserRole === "AGM";
    return {
      currentLevel: 3,
      levelName: "Level 3: AGM Final Approval",
      roleName: "AGM",
      canUserApprove: canApprove,
      actionLabel: "Grant Final Approval & Activate (AGM)",
      nextLevelName: "Approved & Active",
      isFinalStep: true,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  return {
    currentLevel: level,
    levelName: `Level ${level} Approval`,
    roleName: "Reviewer",
    canUserApprove: isSuperAdmin,
    actionLabel: "Approve",
    nextLevelName: "Next Step",
    isFinalStep: false,
    isDeviationStep: false,
    isCompleted: false,
    isRejected: false,
  };
}

export function DsaApprovalStepper({ dsa }: { dsa: any }) {
  if (!dsa) return null;
  const currentLevel = Number(dsa.current_approval_level || 1);
  const onboardingStatus = String(dsa.onboarding_status || dsa.status || "").toUpperCase();
  const isApproved = onboardingStatus === "APPROVED" || onboardingStatus === "AGREEMENT_PENDING" || onboardingStatus === "AGREEMENT_COMPLETED";
  const isRejected = onboardingStatus === "REJECTED";

  const steps = [
    { level: 1, name: "Level 1: Assistant Manager", role: "Assistant Manager" },
    { level: 2, name: "Level 2: Manager", role: "Manager" },
    ...(dsa.deviation || dsa.bre_status === "FAILED" || dsa.bre_status === "failed" || (Array.isArray(dsa.approvals) && dsa.approvals.some((a: any) => a.approval_level === 4))
      ? [{ level: 4, name: "Level 4: DGM Deviation", role: "DGM" }]
      : []),
    { level: 3, name: "Level 3: AGM Final", role: "AGM" },
  ];

  const getStepRecord = (stepLevel: number) => {
    if (Array.isArray(dsa.approvals) && dsa.approvals.length > 0) {
      const match = dsa.approvals.find((a: any) => Number(a.approval_level) === stepLevel);
      if (match) return match;
    }
    if (isApproved) return { status: "APPROVED", remarks: "Approved" };
    if (isRejected && currentLevel === stepLevel) return { status: "REJECTED", remarks: dsa.rejection_reason || dsa.rejectionReason || "Rejected" };
    if (currentLevel > stepLevel && stepLevel !== 4) return { status: "APPROVED", remarks: "Completed" };
    if (currentLevel === stepLevel) return { status: onboardingStatus === "DOCUMENT_PENDING" ? "QUERY" : "PENDING", remarks: "Pending Review" };
    return { status: "PENDING", remarks: "Upcoming" };
  };

  return (
    <Card className="p-4 bg-slate-50/80 border-slate-200 shadow-sm mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          4-Level Approval Workflow Stepper
        </h4>
        <span className="text-xs font-medium text-slate-500">
          {isApproved ? "Status: Fully Approved & Active" : isRejected ? "Status: Rejected" : `Active Queue: Level ${currentLevel}`}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, idx) => {
          const rec = getStepRecord(step.level);
          const statusStr = String(rec.status || "PENDING").toUpperCase();
          const isPassed = statusStr === "APPROVED";
          const isCurrent = currentLevel === step.level && !isApproved && !isRejected;
          const isFailed = statusStr === "REJECTED";
          const isQuery = statusStr === "QUERY";

          return (
            <div
              key={step.level}
              className={`relative flex flex-col justify-between rounded-lg border p-3 text-xs transition-all ${
                isPassed
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                  : isCurrent
                  ? "border-blue-400 bg-blue-50 ring-2 ring-blue-400/20 text-blue-900 font-medium"
                  : isQuery
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : isFailed
                  ? "border-rose-300 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="font-bold text-[10px] uppercase tracking-wide opacity-75">
                  Step {idx + 1}
                </span>
                {isPassed && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <Check className="mr-0.5 h-3 w-3" /> Approved
                  </span>
                )}
                {isCurrent && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 animate-pulse">
                    In Review
                  </span>
                )}
                {isQuery && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Query Raised
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                    Rejected
                  </span>
                )}
                {!isPassed && !isCurrent && !isQuery && !isFailed && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Pending
                  </span>
                )}
              </div>

              <div>
                <p className="font-bold text-slate-900 text-xs">{step.name}</p>
                <p className="text-[11px] text-slate-600 font-normal mt-0.5">Role: {step.role}</p>
              </div>

              {rec.remarks && (
                <p className="mt-2 text-[10px] text-slate-600 bg-white/70 p-1.5 rounded border border-slate-200/50 truncate">
                  {rec.remarks}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const dsaFields: FieldConfig<Dsa>[] = [
  { label: "DSA name", name: "name", required: true },
  { label: "Business type", name: "businessType", options: businessTypes, required: true, type: "select" },
  { label: "PAN", name: "pan", required: true },
  { label: "GST", name: "gst", required: true },
  { label: "Contact person", name: "contactPerson", required: true },
  { label: "Mobile", name: "mobile", required: true },
  { label: "Email", name: "email", required: true, type: "email" },
  { label: "City", name: "city", required: true },
  { label: "State", name: "state", required: true },
  { label: "Pincode", name: "pincode", required: true },
  { label: "Manager", name: "manager", required: true },
];

const agentFields: FieldConfig<User>[] = [
  { label: "Name", name: "name", required: true },
  { label: "Email", name: "email", required: true, type: "email" },
  { label: "Region", name: "region", required: true },
  { label: "Status", name: "status", options: ["Active", "Invited", "Disabled"], required: true, type: "select" },
];



// ──────────────────────────────────────────────────────────────────────────────
// DSA RECOVERY REPORTS sub-component (used in the Reports tab)
// ──────────────────────────────────────────────────────────────────────────────
function DsaRecoveryReports({ dsaId }: { dsaId: string }) {
  const { store } = useMockStore();
  const recoveryRows = store.dsaRecovery
    .filter((r) => r.dsaId === dsaId)
    .sort((a, b) => {
      const order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const [aM, aY] = a.month.split(" ");
      const [bM, bY] = b.month.split(" ");
      return Number(aY) - Number(bY) || order.indexOf(aM) - order.indexOf(bM);
    });

  if (recoveryRows.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500 text-sm">
        <BarChart3 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
        <p className="font-semibold text-slate-700">No recovery data available for this DSA.</p>
        <p className="text-xs text-slate-400 mt-1">Recovery analytics data is available for active DSAs only.</p>
      </div>
    );
  }

  const totalRecovered = recoveryRows.reduce((s, r) => s + r.recoveredAmount, 0);
  const totalInvoice = recoveryRows.reduce((s, r) => s + r.invoiceAmount, 0);
  const totalNpa = recoveryRows.reduce((s, r) => s + r.npaCases, 0);
  const totalPending = recoveryRows.reduce((s, r) => s + r.pendingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Carry-forward info banner */}
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
        <TrendingUp className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <span>
          <strong>Carry-Forward Logic:</strong> If recovery falls short of target in a month, the shortfall reduces next month&apos;s invoice.
          E.g. target ₹10,000, recovered ₹8,000 → shortfall ₹2,000 deducted from next month → if next month recovery is ₹20,000, invoice = ₹18,000.
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
          <div key={kpi.label} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Recovery vs Target trend chart */}
      <TrendCard
        data={recoveryRows.map((r) => ({
          name: r.month.split(" ")[0],
          value: Math.round(r.recoveredAmount / 1000),
        }))}
        dataKey="value"
        subtitle="Monthly recovery amount (₹K) vs target — shortfalls trigger carry-forward into next invoice"
        title="Recovery vs Target Trend (₹K)"
        type="area"
      />

      {/* Invoice generated vs carry-forward chart */}
      <BarChartCard
        data={recoveryRows.map((r) => ({
          name: r.month.split(" ")[0],
          value: Math.round(r.invoiceAmount / 1000),
        }))}
        dataKey="value"
        subtitle="Net invoice amount (₹K) raised after deducting carry-forward shortfall"
        title="Invoice Generated After Carry-Forward (₹K)"
      />

      {/* Month-wise detailed table */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          Month-wise Recovery Report
        </h3>
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-3 pl-4">Month</th>
                <th className="p-3 text-right">Target</th>
                <th className="p-3 text-right">Recovered</th>
                <th className="p-3 text-right">Carry-In</th>
                <th className="p-3 text-right">Carry-Out</th>
                <th className="p-3 text-right">Invoice</th>
                <th className="p-3 text-right">Cases</th>
                <th className="p-3 text-right">Billing</th>
                <th className="p-3 text-right">Pending</th>
                <th className="p-3 pr-4 text-right">NPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recoveryRows.map((row) => {
                const achievedPct = row.targetAmount > 0 ? Math.round((row.recoveredAmount / row.targetAmount) * 100) : 0;
                const isUnder = row.recoveredAmount < row.targetAmount;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 pl-4 font-semibold text-slate-800">{row.month}</td>
                    <td className="p-3 text-right text-slate-600 text-xs">{formatCurrency(row.targetAmount)}</td>
                    <td className="p-3 text-right text-xs">
                      <span className={`font-bold ${isUnder ? "text-rose-600" : "text-emerald-700"}`}>
                        {formatCurrency(row.recoveredAmount)}
                      </span>
                      <span className={`ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded-full ${isUnder ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}>
                        {achievedPct}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-amber-600 text-xs">{row.carryForwardIn > 0 ? formatCurrency(row.carryForwardIn) : "—"}</td>
                    <td className="p-3 text-right text-orange-600 text-xs font-medium">{row.carryForwardOut > 0 ? formatCurrency(row.carryForwardOut) : "—"}</td>
                    <td className="p-3 text-right font-bold text-blue-700 text-xs">{formatCurrency(row.invoiceAmount)}</td>
                    <td className="p-3 text-right text-slate-600 text-xs">{row.totalCases}</td>
                    <td className="p-3 text-right text-slate-600 text-xs">{formatCurrency(row.totalBilling)}</td>
                    <td className="p-3 text-right text-rose-500 text-xs">{formatCurrency(row.pendingAmount)}</td>
                    <td className="p-3 pr-4 text-right text-xs">
                      <span className={`font-bold ${row.npaCases > 0 ? "text-rose-600" : "text-slate-400"}`}>{row.npaCases}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                <td className="p-3 pl-4">TOTAL</td>
                <td className="p-3 text-right">{formatCurrency(recoveryRows.reduce((s, r) => s + r.targetAmount, 0))}</td>
                <td className="p-3 text-right text-emerald-700">{formatCurrency(totalRecovered)}</td>
                <td className="p-3 text-right text-amber-600">{formatCurrency(recoveryRows.reduce((s, r) => s + r.carryForwardIn, 0))}</td>
                <td className="p-3 text-right text-orange-600">{formatCurrency(recoveryRows.reduce((s, r) => s + r.carryForwardOut, 0))}</td>
                <td className="p-3 text-right text-blue-700">{formatCurrency(totalInvoice)}</td>
                <td className="p-3 text-right">{recoveryRows.reduce((s, r) => s + r.totalCases, 0)}</td>
                <td className="p-3 text-right">{formatCurrency(recoveryRows.reduce((s, r) => s + r.totalBilling, 0))}</td>
                <td className="p-3 text-right text-rose-500">{formatCurrency(totalPending)}</td>
                <td className="p-3 pr-4 text-right text-rose-600">{totalNpa}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DsaManagementPage() {
  const { createItem, deleteItem, store, updateItem, currentUser, setCurrentUser } = useMockStore();
  const {
    dsas,
    listLoading,
    pagination,
    dsaListError,
    fetchDsas,
    updateDsaProfile,
    actionLoading,
  } = useDsa();

  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<User | null>(null);
  const [credentialDsa, setCredentialDsa] = useState<any | null>(null);
  const [credentialUsername, setCredentialUsername] = useState("");
  const [credentialPassword, setCredentialPassword] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const [managementTab, setManagementTab] = useState("all");
  const router = useRouter();
  const isNetworkPage = currentUser?.role === "DSA Partner";
  const canManageDsaCredentials = currentUser?.role === "DSA Manager";
  const ownerDsaId = currentUser?.id ?? "";
  const agentOwnerDsa = isNetworkPage ? store.dsas.find((item) => item.id === ownerDsaId) ?? null : null;
  const agentOwnerDsaId = agentOwnerDsa?.id ?? "";

  const [onHoldDsas, setOnHoldDsas] = useState<any[]>([]);

  const [approvalBucket, setApprovalBucket] = useState("");

  const getBackendStatusParams = (statusVal: string) => {
    if (!statusVal) return {};
    const normalized = statusVal.toLowerCase();
    if (["active", "suspended", "blacklisted"].includes(normalized)) {
      return { operational_status: statusVal.toUpperCase() };
    }
    if (normalized === "draft") return { onboarding_status: "DRAFT" };
    if (normalized === "submitted") return { onboarding_status: "SUBMITTED" };
    if (normalized.includes("branch")) return { onboarding_status: "DOCUMENT_VERIFICATION" };
    if (normalized.includes("brh")) return { onboarding_status: "COMPLIANCE_CHECK" };
    if (normalized.includes("credit")) return { onboarding_status: "PENDING_APPROVAL" };
    if (normalized.includes("kyc")) return { onboarding_status: "COMPLIANCE_CHECK" };
    return { onboarding_status: statusVal.toUpperCase() };
  };

  const fetchParams = useMemo(() => {
    const statusParams = getBackendStatusParams(status);
    return {
      search: search.trim() || undefined,
      ...statusParams,
      approval_bucket: approvalBucket ? Number(approvalBucket) : undefined,
      page,
      per_page: 10,
    };
  }, [search, status, approvalBucket, page]);

  useEffect(() => {
    if (isNetworkPage) return;
    fetchDsas(fetchParams);
  }, [fetchDsas, fetchParams, isNetworkPage]);

  useEffect(() => {
    if (isNetworkPage) return;
    if (dsaListError) {
      setOnHoldDsas([]);
      return;
    }
    if (pagination.total === 0) {
      setOnHoldDsas([]);
      return;
    }
    async function loadOnHold() {
      try {
        const response = await adminApi.getDsas({ onboarding_status: "ON_HOLD", per_page: 50 });
        setOnHoldDsas(response.data.items);
      } catch {
        setOnHoldDsas([]);
      }
    }
    loadOnHold();
  }, [dsas, dsaListError, isNetworkPage, pagination.total]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(event.target.value);
    setPage(1);
  };

  const handleApprovalBucketChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setApprovalBucket(event.target.value);
    setPage(1);
  };

  function openCredentialModal(dsa: any) {
    setCredentialDsa(dsa);
    setCredentialUsername(dsa.login_username || "");
    setCredentialPassword("");
    setCredentialError("");
  }

  function closeCredentialModal() {
    setCredentialDsa(null);
    setCredentialUsername("");
    setCredentialPassword("");
    setCredentialError("");
  }

  async function saveDsaCredentials() {
    if (!credentialDsa) return;

    const nextUsername = credentialUsername.trim().toLowerCase();
    const nextPassword = credentialPassword.trim();
    if (!/^\S+@\S+\.\S+$/.test(nextUsername)) {
      setCredentialError("Enter a valid login email.");
      return;
    }
    if (nextPassword.length < 8) {
      setCredentialError("Password must be at least 8 characters.");
      return;
    }

    const updated = await updateDsaProfile(credentialDsa.id, {
      login_username: nextUsername,
      login_password: nextPassword,
    } as any);

    if (updated) {
      fetchDsas(fetchParams);
      closeCredentialModal();
    }
  }

  function saveNewAgent(value: Partial<User>) {
    if (!agentOwnerDsaId) {
      toast({
        description: "Select a DSA before creating an agent.",
        title: "Agent not created",
        variant: "warning",
      });
      return;
    }

    const email = String(value.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        description: "Enter a valid agent email address.",
        title: "Invalid email",
        variant: "warning",
      });
      return;
    }

    const duplicateUser = store.users.find(
      (user) => user.email.trim().toLowerCase() === email,
    );
    if (duplicateUser) {
      toast({
        description: `User is already registered: ${duplicateUser.name} (${duplicateUser.role}).`,
        title: "Conflict detected",
        variant: "warning",
      });
      return;
    }

    createItem("users", {
      ...value,
      dsaId: agentOwnerDsaId,
      email,
      id: makeId("user"),
      name: String(value.name ?? "").trim(),
      role: "DSA Agent",
      region: String(value.region ?? agentOwnerDsa?.name ?? "DSA").trim() || "DSA",
      status: (value.status as User["status"]) || "Active",
    } as any);
    setCreatingAgent(false);
  }

  function saveAgentEdit(value: Partial<User>) {
    if (!editingAgent) return;

    const email = String(value.email ?? editingAgent.email).trim().toLowerCase();
    const dsaId = editingAgent.dsaId ?? agentOwnerDsaId;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        description: "Enter a valid agent email address.",
        title: "Invalid email",
        variant: "warning",
      });
      return;
    }

    const duplicateUser = store.users.find(
      (user) => user.id !== editingAgent.id && user.email.trim().toLowerCase() === email,
    );
    if (duplicateUser) {
      toast({
        description: `Email is already assigned to ${duplicateUser.name} (${duplicateUser.role}).`,
        title: "Conflict detected",
        variant: "warning",
      });
      return;
    }

    updateItem("users", editingAgent.id, {
      ...value,
      dsaId,
      email,
      name: String(value.name ?? editingAgent.name).trim() || editingAgent.name,
      role: "DSA Agent",
    });
    setEditingAgent(null);
  }

  let scopedRows = store.dsas.filter((item) => managementStatuses.includes(item.status));
  if (currentUser?.role === "DSA Partner") {
    scopedRows = scopedRows.filter((item) => item.id === currentUser.id);
  } else if (currentUser?.role === "Branch User") {
    scopedRows = scopedRows.filter((item) => item.manager === currentUser.name);
  }
  const onHoldRows = scopedRows
    .filter((item) => item.status === "On Hold")
    .sort((left, right) => right.onboardingDate.localeCompare(left.onboardingDate));

  const networkDsaIds = new Set(isNetworkPage ? [ownerDsaId] : scopedRows.map((item) => item.id));
  const networkRows: NetworkPersonRow[] = store.users
    .filter((user) => user.role === "DSA Agent" && user.dsaId && networkDsaIds.has(user.dsaId))
    .map((user) => ({
      email: user.email,
      id: user.id,
      name: user.name,
      region: user.region,
      sourceDsaId: user.dsaId ?? "",
      status: user.status,
    }))
    .map((item) => {
      const leads = store.leads.filter((lead) => lead.dsaId === item.sourceDsaId && lead.owner === item.name);
      const applications = store.applications.filter(
        (application) => application.dsaId === item.sourceDsaId && leads.some((lead) => lead.customer === application.customer),
      );
      const approvedOrDisbursed = applications.filter(
        (application) => application.status === "Approved" || application.status === "Disbursed",
      ).length;
      const disbursed = applications.filter((application) => application.status === "Disbursed").length;

      return {
        applications: applications.length,
        approvedOrDisbursed,
        conversion: applications.length ? (approvedOrDisbursed / applications.length) * 100 : 0,
        disbursed,
        email: item.email,
        id: item.id,
        leads: leads.length,
        name: item.name,
        region: item.region,
        status: item.status,
      };
    })
    .sort((left, right) => right.applications - left.applications || right.leads - left.leads || left.name.localeCompare(right.name));

  const networkColumns: Column<NetworkPersonRow>[] = [
    {
      cell: (item) => (
        <span className="font-semibold text-slate-950">
          {item.name}
        </span>
      ),
      header: "Agent",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    { cell: (item) => item.email, header: "Email", key: "email", sortable: true, sortValue: (item) => item.email },
    { cell: (item) => item.region, header: "Region", key: "region", sortable: true, sortValue: (item) => item.region },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status", sortable: true, sortValue: (item) => item.status },
    { cell: (item) => item.leads, header: "Leads collected", key: "leads", sortable: true, sortValue: (item) => item.leads },
    {
      cell: (item) => item.applications,
      header: "Applications collected",
      key: "applications",
      sortable: true,
      sortValue: (item) => item.applications,
    },
    {
      cell: (item) => item.approvedOrDisbursed,
      header: "Approved / disbursed",
      key: "approvedOrDisbursed",
      sortable: true,
      sortValue: (item) => item.approvedOrDisbursed,
    },
    { cell: (item) => percent(item.conversion), header: "Conversion", key: "conversion", sortable: true, sortValue: (item) => item.conversion },
  ];

  const agentModals = (
    <>
      <Modal onClose={() => setCreatingAgent(false)} open={creatingAgent} title={`Create DSA agent${agentOwnerDsa ? ` - ${agentOwnerDsa.name}` : ""}`}>
        <RecordForm<User>
          fields={agentFields}
          initialValue={{ region: agentOwnerDsa?.name ?? currentUser?.name ?? "DSA", status: "Active" }}
          onCancel={() => setCreatingAgent(false)}
          onSubmit={saveNewAgent}
          submitLabel="Create agent"
        />
      </Modal>
      <Modal onClose={() => setEditingAgent(null)} open={Boolean(editingAgent)} title="Edit DSA agent">
        {editingAgent ? (
          <RecordForm<User>
            fields={agentFields}
            initialValue={editingAgent}
            onCancel={() => setEditingAgent(null)}
            onSubmit={saveAgentEdit}
            submitLabel="Save agent"
          />
        ) : null}
      </Modal>
    </>
  );

  if (isNetworkPage) {
    return (
      <div className="space-y-6">
        <PageHeader
          action={
            <Button onClick={() => setCreatingAgent(true)} type="button">
              <Plus className="h-4 w-4" />
              New Agent
            </Button>
          }
          description="Create DSA Agent users and track lead collection, application sourcing, and conversion across your network."
          eyebrow="Network"
          title="Manage My Network"
        />
        <DataTable
          actions={(item) => {
            const agent = store.users.find((user) => user.id === item.id && user.role === "DSA Agent" && user.dsaId === ownerDsaId);
            return (
              <ActionPair
                onDelete={agent ? () => deleteItem("users", agent.id) : undefined}
                onEdit={agent ? () => setEditingAgent(agent) : undefined}
              />
            );
          }}
          columns={networkColumns}
          emptyDescription="Create your first DSA Agent from this DSA Management page."
          emptyTitle="No DSA agents found"
          items={networkRows}
          searchKeys={["name", "email", "region", "status"]}
        />
        {agentModals}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          description="Manage registered partner entities, verify bank details, and execute agreement signing workflows."
          eyebrow="Administration"
          title="DSA Management"
        />
      </div>

      <div>
        <Tabs
          onChange={setManagementTab}
          tabs={[
            { label: "All DSAs", value: "all" },
            { label: `On Hold (${onHoldDsas.length})`, value: "onHold" },
          ]}
          value={managementTab}
        />
      </div>

      {managementTab === "onHold" ? (
        <OnHoldDsaDocuments
          description="Upload remaining mandatory documents here. A DSA stays On Hold until every missing document is uploaded."
          dsas={onHoldDsas as any[]}
        />
      ) : (
        <Card className="min-h-[500px]">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input
                aria-label="Search partners"
                onChange={handleSearchChange}
                placeholder="Search by name, code, pan, city..."
                value={search}
                className="w-full sm:w-[300px]"
              />
              <Select
                aria-label="Filter by status"
                onChange={handleStatusChange}
                value={status}
                className="w-full sm:w-[180px]"
              >
                <option value="">All statuses</option>
                {managementStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Select
                aria-label="Filter by approval queue"
                onChange={handleApprovalBucketChange}
                value={approvalBucket}
                className="w-full sm:w-[220px]"
              >
                <option value="">All Approval Queues</option>
                <option value="1">Level 1: Assistant Manager</option>
                <option value="2">Level 2: Manager</option>
                <option value="3">Level 3: AGM (Final)</option>
                <option value="4">Level 4: DGM (Deviation)</option>
              </Select>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Found {pagination.total} partners
            </span>
          </div>
          <CardContent className="p-0">
            {listLoading ? (
              <div className="flex items-center justify-center py-20">
                <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : dsaListError ? (
              <div className="px-6 py-12">
                <EmptyState
                  action={
                    <Button onClick={() => fetchDsas(fetchParams)} type="button" variant="outline">
                      Retry DSA API
                    </Button>
                  }
                  description={dsaListError}
                  title="DSA API unavailable"
                />
              </div>
            ) : dsas.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-bold text-slate-800">No partner DSAs found</p>
                <p className="mt-1 text-xs text-slate-500">Try changing your search keywords or filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="p-4">Partner</th>
                      <th className="p-4">DSA ID</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Approval Rate</th>
                      <th className="p-4">Commission</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dsas.map((item) => (
                      <tr className="hover:bg-slate-50/50 transition cursor-pointer" key={item.id} onClick={() => router.push(`/dsa/${item.id}`)}>
                        <td className="p-4">
                          <div>
                            <p className="font-semibold text-blue-700 hover:underline">{item.name || item.contact_person || item.code}</p>
                            <p className="text-[10px] text-slate-500">{item.contact_person} · {item.email}</p>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-600">
                          {item.code}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={item.onboarding_status} />
                        </td>
                        <td className="p-4 text-slate-700 text-xs">
                          {item.city}, {item.state}
                        </td>
                        <td className="p-4 font-medium text-slate-700">
                          {percent(item.approval_rate || 0)}
                        </td>
                        <td className="p-4 font-semibold text-slate-900">
                          {formatCurrency(item.commission_earned || 0)}
                        </td>
                        <td className="p-4 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            {canManageDsaCredentials ? (
                              <Button
                                aria-label={`Manage credentials for ${item.name}`}
                                onClick={() => openCredentialModal(item as any)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                <KeyRound className="h-4 w-4 mr-1.5" />
                                Creds
                              </Button>
                            ) : null}
                            <Button onClick={() => setEditing(item as any)} size="sm" type="button" variant="secondary">
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Page {pagination.currentPage} of {pagination.totalPages} · {pagination.total} total
            </span>
            <div className="flex gap-2">
              <Button disabled={listLoading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} size="sm" type="button" variant="outline">
                Previous
              </Button>
              <Button disabled={listLoading || page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} size="sm" type="button" variant="outline">
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit DSA">
        {editing ? (
          <RecordForm<Dsa>
            fields={dsaFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (value) => {
              const updated = await updateDsaProfile(editing.id, value as any);
              if (updated) {
                fetchDsas(fetchParams);
                setEditing(null);
              }
            }}
            submitLabel="Save DSA"
          />
        ) : null}
      </Modal>
      {agentModals}
      <Modal onClose={closeCredentialModal} open={Boolean(credentialDsa)} title="Manage DSA credentials">
        {credentialDsa ? (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{credentialDsa.name}</p>
                  <p className="text-xs text-slate-500">{credentialDsa.code}</p>
                </div>
                <StatusBadge status={credentialDsa.onboarding_status} />
              </div>
            </div>
            {credentialError ? (
              <p className="text-xs font-semibold text-rose-600">{credentialError}</p>
            ) : null}
            <div className="space-y-3">
              <Field>
                <Label htmlFor="credUser">Login email</Label>
                <Input
                  id="credUser"
                  onChange={(event) => setCredentialUsername(event.target.value)}
                  type="text"
                  value={credentialUsername}
                />
              </Field>
              <Field>
                <Label htmlFor="credPass">New password</Label>
                <Input
                  id="credPass"
                  onChange={(event) => setCredentialPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  type="text"
                  value={credentialPassword}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={closeCredentialModal} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={actionLoading} onClick={saveDsaCredentials} type="button">
                {actionLoading ? "Saving..." : "Save Credentials"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function mapBackendStatusToFrontend(onboarding?: string, operational?: string): DsaStatus {
  if (operational === "ACTIVE") return "Active";
  if (operational === "SUSPENDED") return "Suspended";
  if (operational === "TERMINATED") return "Blacklisted";

  const norm = (onboarding || "").toUpperCase();
  if (norm === "DRAFT") return "Draft";
  if (norm === "SUBMITTED") return "Submitted";
  if (norm === "DOCUMENT_VERIFICATION") return "Pending Branch Approval";
  if (norm === "COMPLIANCE_CHECK") return "KYC Pending";
  if (norm === "PENDING_APPROVAL") return "Pending Credit Approval";
  if (norm === "APPROVED") return "Active";
  if (norm === "REJECTED") return "Rejected";
  return "Draft";
}

export function DsaProfilePage({ id }: { id: string }) {
  const { createItem, deleteDsaCascade, deleteItem, store, updateItem, currentUser, setCurrentUser } = useMockStore();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState("performance");
  const [applicationProductFilter, setApplicationProductFilter] = useState("");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<User | null>(null);
  const [approvingDsa, setApprovingDsa] = useState<any | null>(null);
  const [rejectingDsa, setRejectingDsa] = useState<any | null>(null);
  const [rejectionError, setRejectionError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [queryingDsa, setQueryingDsa] = useState<any | null>(null);
  const [queryReason, setQueryReason] = useState("");
  const [queryError, setQueryError] = useState("");
  const [deactivatingDsa, setDeactivatingDsa] = useState<any | null>(null);
  const [blacklistingDsa, setBlacklistingDsa] = useState<any | null>(null);
  const [activatingDsa, setActivatingDsa] = useState<any | null>(null);
  const [unblacklistingDsa, setUnblacklistingDsa] = useState<any | null>(null);
  const [deletingDsa, setDeletingDsa] = useState<any | null>(null);
  const [viewingLifecycleReason, setViewingLifecycleReason] = useState<any | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleReasonError, setLifecycleReasonError] = useState("");

  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [counterInvoice, setCounterInvoice] = useState<any>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNote, setCounterNote] = useState("");

  const {
    currentDsa: dsa,
    loading,
    actionLoading,
    fetchDsaDetail,
    updateDsaProfile,
    updateDsaStatus,
    uploadDsaDocument,
    updateDsaDocumentStatus,
    deleteDsaDocument,
    generateAgreement,
    downloadAgreement,
    uploadSignedAgreement,
  } = useDsa();

  useEffect(() => {
    fetchDsaDetail(id);
  }, [id, fetchDsaDetail]);

  const [dsaAudit, setDsaAudit] = useState<any[]>([]);
  const [docChecklist, setDocChecklist] = useState<any>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [viewedDocIds, setViewedDocIds] = useState<Set<number | string>>(new Set());

  const openDocPreview = (doc: any) => {
    setPreviewDoc(doc);
    if (doc?.id) {
      setViewedDocIds((prev) => {
        const next = new Set(prev);
        next.add(doc.id);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!dsa || currentUser?.role !== "DSA Manager") return;
    async function loadDsaAudit() {
      try {
        const response = await adminApi.getActivityLogs({ group: "dsa", page: 1, per_page: 8 });
        setDsaAudit(response.data);
      } catch (err) {
        // Activity log API access is restricted to Super Admin (DSA Manager)
      }
    }
    loadDsaAudit();
  }, [dsa, currentUser?.role]);

  useEffect(() => {
    if (!dsa) return;
    adminApi.getDsaDocumentChecklist(dsa.id)
      .then((res: any) => setDocChecklist(res?.data ?? res))
      .catch(() => { /* non-fatal — checklist stays null */ });
  }, [dsa]);

  if (loading || !dsa) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const isBankUser = currentUser?.role !== "DSA Partner" && currentUser?.role !== "Customer";

  // Use backend checklist missing items; filter staff_only documents:
  // - Non-bank users (e.g. self onboarding applicant or DSA partner) do not see staff_only docs
  // - Bank staff (Super Admin, Maker, Checker, Credit, etc.) see all required docs plus staff_only docs
  const missingProfileDocuments: Array<{ document_type: string; display_name: string; requirement: string; staff_only?: boolean }> =
    docChecklist?.checklist?.filter((item: any) => {
      if (item.is_uploaded) return false;
      if (item.staff_only && !isBankUser) return false;
      return item.is_required || (item.staff_only && isBankUser);
    }) ?? [];

  const workflowLevelInfo = getDsaWorkflowLevelInfo(currentUser?.role, dsa);
  const canDecideDsa = workflowLevelInfo.canUserApprove;
  const canApproveDsa = canDecideDsa && (docChecklist ? docChecklist.is_complete : true);
  const allProductConfigs = store.dsaProductConfigs.filter((config) => config.dsaId === String(dsa.id));
  const productConfigs = allProductConfigs
    .filter((config) => (dsa.onboarding_status === "APPROVED" || dsa.onboarding_status === "AGREEMENT_COMPLETED") && config.status === "Active")
    .sort((left, right) => left.product.localeCompare(right.product));
  const configuredProducts = productConfigs.map((config) => config.product);

  const closeDecisionModals = () => {
    setApprovingDsa(null);
    setRejectingDsa(null);
    setQueryingDsa(null);
    setRejectionError("");
    setRejectionReason("");
    setQueryError("");
    setQueryReason("");
  };

  const applications = store.applications
    .filter((item) => item.dsaId === String(dsa.id))
    .sort((left, right) => left.product.localeCompare(right.product) || left.applicationId.localeCompare(right.applicationId));
  const effectiveApplicationProductFilter = configuredProducts.includes(applicationProductFilter as Product)
    ? applicationProductFilter
    : "";
  const visibleApplications = effectiveApplicationProductFilter
    ? applications.filter((application) => application.product === effectiveApplicationProductFilter)
    : applications;
  const commissions = store.commissions.filter((item) => item.dsaId === String(dsa.id));
  const leads = store.leads.filter((item) => item.dsaId === String(dsa.id));
  const audit = dsaAudit;
  const applicationIds = new Set(applications.map((application) => application.id));
  const applicationCodes = new Set(applications.map((application) => application.applicationId));
  const linkedDocumentCount = store.documents.filter(
    (document) => document.dsaId === String(dsa.id) || applicationIds.has(document.applicationId ?? ""),
  ).length;
  const linkedVerificationCount = store.verificationChecks.filter((check) => applicationCodes.has(check.applicationId)).length;
  const linkedApprovalCount = store.approvals.filter((approval) => applicationCodes.has(approval.applicationId)).length;
  const linkedUserCount = store.users.filter(
    (user) => user.id === String(dsa.id) || user.dsaId === String(dsa.id) || user.email === dsa.email || user.name === dsa.name,
  ).length;
  const canManageAgents = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";
  const dsaAgents = store.users
    .filter((user) => user.role === "DSA Agent" && user.dsaId === String(dsa.id))
    .sort((left, right) => left.name.localeCompare(right.name));

  const commissionTotal = commissions.reduce((sum, item) => sum + item.payout, 0);
  const approvedApplications = applications.filter(
    (item) => item.status === "Approved" || item.status === "Disbursed",
  ).length;
  const disbursedApplications = applications.filter((item) => item.status === "Disbursed").length;
  const sourcedLoanValue = applications.reduce((sum, item) => sum + item.loanAmount, 0);
  const agentAnalysis = Array.from(
    leads.reduce((analysis, lead) => {
      const current = analysis.get(lead.owner) ?? {
        applications: 0,
        approvedOrDisbursed: 0,
        leads: 0,
        loanValue: 0,
        name: lead.owner,
      };
      current.leads += 1;
      current.loanValue += lead.amount;
      const leadApplications = applications.filter(
        (application) => application.customer === lead.customer && application.dsaId === lead.dsaId,
      );
      current.applications += leadApplications.length;
      current.approvedOrDisbursed += leadApplications.filter(
        (application) => application.status === "Approved" || application.status === "Disbursed",
      ).length;
      analysis.set(lead.owner, current);
      return analysis;
    }, new Map<string, { name: string; leads: number; applications: number; approvedOrDisbursed: number; loanValue: number }>()),
  ).map(([, value]) => value).sort((left, right) => right.applications - left.applications || right.leads - left.leads);
  const canLifecycleRoleManageDsa =
    currentUser?.role === "DSA Manager" ||
    currentUser?.role === "DSA Credit" ||
    currentUser?.role === "Branch Regional Head" ||
    (currentUser?.role === "Branch User" && dsa.manager === currentUser.name);
  const canManageDsaLifecycle = canLifecycleRoleManageDsa && ["ACTIVE", "SUSPENDED", "TERMINATED"].includes(dsa.operational_status || "");
  const canViewDsaLifecycleReason = canLifecycleRoleManageDsa;
  const canDeleteDsa = currentUser?.role === "DSA Manager";

  function closeLifecycleModals() {
    setDeactivatingDsa(null);
    setBlacklistingDsa(null);
    setLifecycleReason("");
    setLifecycleReasonError("");
  }

  function makeInvoiceEvent(
    action: any,
    actor: string,
    party: any,
    amount: number,
    note: string,
  ): any {
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

  function openCounter(invoice: any) {
    setCounterInvoice(invoice);
    setCounterAmount(String(invoice.requestedAmount));
    setCounterNote("");
  }

  function submitCounter() {
    if (!counterInvoice) return;
    const amount = Number(counterAmount);
    if (isNaN(amount) || amount <= 0) return;

    const isBank = currentUser?.role !== "DSA Partner" && currentUser?.role !== "Customer";
    const actor = currentUser?.name ?? dsa?.name ?? "Partner";
    const party = isBank ? "Bank" as const : "DSA" as const;
    const note = counterNote.trim() || `${party} countered the invoice amount.`;
    const event = makeInvoiceEvent("Countered", actor, party, amount, note);

    updateItem("dsaInvoices", counterInvoice.id, {
      history: [event, ...counterInvoice.history],
      requestedAmount: amount,
      remarks: note,
      status: isBank ? "Countered by Bank" : "Countered by DSA",
      updatedAt: event.at,
    });
    setCounterInvoice(null);
  }

  function closeInvoice(status: "Approved" | "Rejected", invoice: any) {
    const actor = currentUser?.name ?? "Credit";
    const amount = invoice.requestedAmount;
    const event = makeInvoiceEvent(
      status,
      actor,
      currentUser?.role === "DSA Credit" ? "DSA Credit" : "Super Admin",
      amount,
      `${status} at ${formatCurrency(amount)}.`
    );
    updateItem("dsaInvoices", invoice.id, {
      approvedAmount: status === "Approved" ? amount : invoice.approvedAmount,
      history: [event, ...invoice.history],
      status,
      updatedAt: event.at,
    });
  }

  function renderInvoiceTracker(status: any) {
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
      <div className="flex items-center gap-1.5 text-[11px] font-bold">
        {steps.map((step, idx) => {
          const isPast = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          return (
            <span
              className={`rounded-full px-2 py-0.5 ${
                isPast
                  ? "bg-blue-100 text-blue-700"
                  : isCurrent
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-400"
              }`}
              key={step}
            >
              {idx + 1} {step}
            </span>
          );
        })}
      </div>
    );
  }

  function openDeactivationModal(nextDsa: any) {
    setLifecycleReason("");
    setLifecycleReasonError("");
    setDeactivatingDsa(nextDsa);
  }

  function openBlacklistModal(nextDsa: any) {
    setLifecycleReason("");
    setLifecycleReasonError("");
    setBlacklistingDsa(nextDsa);
  }

  function saveProfileAgent(value: Partial<User>) {
    const email = String(value.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        description: "Enter a valid agent email.",
        title: "Agent not created",
        variant: "warning",
      });
      return;
    }

    const duplicate = store.users.find((user) => user.email.trim().toLowerCase() === email);
    if (duplicate) {
      toast({
        description: `${email} is already assigned to ${duplicate.name}.`,
        title: "Duplicate agent email",
        variant: "warning",
      });
      return;
    }

    createItem("users", {
      dsaId: String(dsa?.id || ""),
      email,
      id: makeId("usr-agent"),
      lastLogin: new Date().toISOString(),
      name: String(value.name ?? "DSA Agent").trim() || "DSA Agent",
      region: String(value.region ?? dsa?.name ?? "DSA").trim() || (dsa?.name ?? "DSA"),
      role: "DSA Agent",
      status: (value.status as User["status"]) || "Active",
    });
    setCreatingAgent(false);
  }

  function saveProfileAgentEdit(value: Partial<User>) {
    if (!editingAgent) return;
    const email = String(value.email ?? editingAgent.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        description: "Enter a valid agent email.",
        title: "Agent not updated",
        variant: "warning",
      });
      return;
    }

    const duplicate = store.users.find((user) => user.id !== editingAgent.id && user.email.trim().toLowerCase() === email);
    if (duplicate) {
      toast({
        description: `${email} is already assigned to ${duplicate.name}.`,
        title: "Duplicate agent email",
        variant: "warning",
      });
      return;
    }

    updateItem("users", editingAgent.id, {
      ...value,
      dsaId: String(dsa?.id || ""),
      email,
      name: String(value.name ?? editingAgent.name).trim() || editingAgent.name,
      role: "DSA Agent",
    });
    setEditingAgent(null);
  }

  const dsaAgentColumns: Column<User>[] = [
    {
      cell: (item) => (
        <div>
          <p className="font-semibold text-slate-950">{item.name}</p>
          <p className="text-xs text-slate-500">{item.id}</p>
        </div>
      ),
      header: "Agent",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    { cell: (item) => item.email, header: "Email", key: "email", sortable: true, sortValue: (item) => item.email },
    { cell: (item) => item.region, header: "Region", key: "region", sortable: true, sortValue: (item) => item.region },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status", sortable: true, sortValue: (item) => item.status },
    { cell: (item) => formatDate(item.lastLogin), header: "Last login", key: "lastLogin", sortable: true, sortValue: (item) => item.lastLogin },
  ];

  if (currentUser?.role === "DSA Partner") {
    const networkPartnerName = dsa.name;
    const networkPartnerEmail = dsa.email;
    const conversion = applications.length ? (approvedApplications / applications.length) * 100 : 0;

    return (
      <div>
        <Link className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700" href="/dsa/management">
          <ArrowLeft className="h-4 w-4" />
          Back to Manage My Network
        </Link>
        <PageHeader
          description="Lead collection, application sourcing, and payout activity for this network partner."
          eyebrow="Network partner"
          title={networkPartnerName}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Leads collected", value: String(leads.length) },
            { label: "Applications collected", value: String(applications.length) },
            { label: "Approved / disbursed", value: String(approvedApplications) },
            { label: "Loan value", value: formatCurrency(sourcedLoanValue) },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-4">
          <CardContent>
            <DetailGrid>
              <DetailItem label="Partner" value={networkPartnerName} />
              <DetailItem label="Email" value={networkPartnerEmail} />
              <DetailItem label="Conversion" value={percent(conversion)} />
              <DetailItem label="Disbursed applications" value={disbursedApplications} />
              <DetailItem label="Commission earned" value={formatCurrency(commissionTotal || dsa.commission_earned)} />
              <DetailItem label="Active products" value={productConfigs.length || "None"} />
            </DetailGrid>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Collected Applications</h3>
                <p className="text-xs text-slate-500">Applications sourced by this network partner.</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{applications.length} total</span>
            </div>
            {applications.length ? (
              <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Application</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td className="p-3 font-mono text-xs text-slate-600">{application.applicationId}</td>
                        <td className="p-3 font-semibold text-slate-900">{application.customer}</td>
                        <td className="p-3 text-slate-700">{application.product}</td>
                        <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(application.loanAmount)}</td>
                        <td className="p-3 text-slate-700">{application.stage}</td>
                        <td className="p-3"><StatusBadge status={application.status} /></td>
                        <td className="p-3 text-right text-slate-600">{formatDate(application.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No applications have been collected yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Lead Pipeline</h3>
                <p className="text-xs text-slate-500">Leads collected before application submission.</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">{leads.length} total</span>
            </div>
            {leads.length ? (
              <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Lead</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Next action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="p-3 font-mono text-xs text-slate-600">{lead.leadId}</td>
                        <td className="p-3 font-semibold text-slate-900">{lead.customer}</td>
                        <td className="p-3 text-slate-700">{lead.product}</td>
                        <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(lead.amount)}</td>
                        <td className="p-3"><StatusBadge status={lead.status} /></td>
                        <td className="p-3 text-slate-700">{lead.nextAction}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No leads have been collected yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Link className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700" href="/dsa/management">
        <ArrowLeft className="h-4 w-4" />
        Back to DSA management
      </Link>
      <PageHeader
        action={
          <div className="flex items-center gap-2">
            <StatusBadge status={dsa.onboarding_status === "APPROVED" || dsa.onboarding_status === "AGREEMENT_COMPLETED" ? dsa.operational_status : dsa.onboarding_status} />
            {canDecideDsa && (
              <div className="flex gap-2">
                <Button
                  disabled={!canApproveDsa}
                  onClick={() => setApprovingDsa(dsa)}
                  size="sm"
                  title={canApproveDsa ? "Approve DSA" : "Missing mandatory documents"}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 h-auto"
                >
                  {workflowLevelInfo.actionLabel}
                </Button>
                <Button
                  onClick={() => setQueryingDsa(dsa)}
                  size="sm"
                  variant="secondary"
                  className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold text-xs py-1 h-auto"
                >
                  Raise Query
                </Button>
                <Button
                  onClick={() => setRejectingDsa(dsa)}
                  size="sm"
                  variant="secondary"
                  className="bg-rose-50 text-rose-600 hover:bg-rose-100 border-none font-bold text-xs py-1 h-auto"
                >
                  Reject
                </Button>
              </div>
            )}
            {canManageDsaLifecycle && (
              <div className="flex gap-2">
                {dsa.operational_status === "ACTIVE" && (
                  <>
                    <Button
                      onClick={() => openDeactivationModal(dsa)}
                      size="sm"
                      variant="outline"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-bold text-xs py-1.5 px-3 h-auto"
                    >
                      Deactivate
                    </Button>
                    <Button
                      onClick={() => openBlacklistModal(dsa)}
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs py-1.5 px-3 h-auto"
                    >
                      Blacklist
                    </Button>
                  </>
                )}
                {dsa.operational_status === "SUSPENDED" && (
                  <>
                    <Button
                      onClick={() => setActivatingDsa(dsa)}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 h-auto border-none"
                    >
                      Activate
                    </Button>
                    <Button
                      onClick={() => openBlacklistModal(dsa)}
                      size="sm"
                      variant="outline"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs py-1.5 px-3 h-auto"
                    >
                      Blacklist
                    </Button>
                  </>
                )}
                {dsa.operational_status === "TERMINATED" && (
                  <>
                    <Button
                      onClick={() => setUnblacklistingDsa(dsa)}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 h-auto border-none"
                    >
                      Remove from Blacklist
                    </Button>
                    <Button
                      onClick={() => openDeactivationModal(dsa)}
                      size="sm"
                      variant="outline"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-bold text-xs py-1.5 px-3 h-auto"
                    >
                      Deactivate
                    </Button>
                  </>
                )}
              </div>
            )}
            {canDeleteDsa ? (
              <Button
                onClick={() => setDeletingDsa(dsa)}
                size="sm"
                type="button"
                variant="danger"
                className="font-bold text-xs py-1.5 px-3 h-auto"
              >
                Delete Permanently
              </Button>
            ) : null}
          </div>
        }
        description="Partner performance, sourcing activity, and configured loan products."
        eyebrow="Partner analysis"
        title={dsa.name}
      />

      <DsaApprovalStepper dsa={dsa} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard change="+6.2%" icon={TrendingUp} label="Approval rate" tone="green" value={percent(dsa.approval_rate || 0)} />
        <KpiCard change="+11.0%" icon={ClipboardList} label="Applications sourced" value={String(applications.length)} />
        <KpiCard change="+8.4%" icon={BadgeIndianRupee} label="Commission" tone="slate" value={formatCurrency(commissionTotal || dsa.commission_earned || 0)} />
      </div>

      {missingProfileDocuments.length ? (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">DSA on hold before approval</p>
          <p className="mt-1 text-xs text-blue-800">
            {missingProfileDocuments.length} mandatory document{missingProfileDocuments.length === 1 ? " is" : "s are"} missing. Upload completion is required before activation.
          </p>
        </div>
      ) : null}

      {canViewDsaLifecycleReason && dsa.status_reason ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{dsa.status_reason_action ?? dsa.onboarding_status} reason recorded</p>
              <p className="mt-1 text-xs text-amber-800">
                {dsa.status_reason_by ? `By ${dsa.status_reason_by}` : "Recorded by internal user"}
                {dsa.status_reason_at ? ` - ${formatDate(dsa.status_reason_at)}` : ""}
              </p>
            </div>
            <StatusBadge status={dsa.onboarding_status} />
          </div>
          <Button
            className="mt-3 border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
            onClick={() => setViewingLifecycleReason(dsa)}
            size="sm"
            type="button"
            variant="outline"
          >
            View reason
          </Button>
        </div>
      ) : null}

      <div className="mt-6">
        <Tabs
          onChange={setTab}
          tabs={[
            { label: "Partner analysis", value: "performance" },
            { label: "Basic Info", value: "overview" },
            { label: "KYC", value: "kyc" },
            { label: "Documents", value: "documents" },
            { label: "Agreements", value: "agreements" },
            { label: "Manage Products", value: "products" },
            ...(canManageAgents ? [{ label: "Manage Agents", value: "agents" }] : []),
            { label: "Applications", value: "apps" },
            { label: "Commission", value: "commission" },
            { label: "Reports", value: "reports" },
            ...(currentUser?.role === "DSA Manager" ? [{ label: "Audit Timeline", value: "audit" }] : []),
          ]}
          value={tab}
        />
      </div>

      <Card className="mt-4">
        <CardContent>
          {tab === "overview" ? (
            <DetailGrid>
              <DetailItem label="DSA ID" value={dsa.code} />
              <DetailItem label="Contact person" value={dsa.contact_person} />
              <DetailItem label="Mobile" value={dsa.mobile} />
              <DetailItem label="Email" value={dsa.email} />
              <DetailItem label="Address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
              <DetailItem label="Bank" value={`${dsa.bank_name} · ${dsa.ifsc}`} />
              <DetailItem label="Tier" value={dsa.tier} />
            </DetailGrid>
          ) : null}
          {tab === "kyc" ? (
            <DetailGrid>
              <DetailItem
                label="PAN"
                value={
                  <div className="flex items-center gap-2">
                    <span>{dsa.pan || "N/A"}</span>
                    <StatusBadge status="Verified" />
                  </div>
                }
              />
              <DetailItem
                label="GST"
                value={
                  <div className="flex items-center gap-2">
                    <span>{dsa.gst || (dsa.pan ? `27${dsa.pan}1Z5` : "27AAAAC1234H1Z5")}</span>
                    <StatusBadge status="Validated" />
                  </div>
                }
              />
              <DetailItem label="Business type" value={dsa.business_type} />
              <DetailItem label="KYC readiness" value={<StatusBadge status={dsa.onboarding_status} />} />
              <DetailItem label="Registered address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
            </DetailGrid>
          ) : null}
          {tab === "documents" ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {(dsa.documents || []).map((doc) => {
                  const isDocViewed = viewedDocIds.has(doc.id);
                  const isPendingVerification = isBankUser && doc.status !== "Verified" && doc.status !== "Failed";

                  return (
                    <div className="rounded-lg border border-slate-200 p-4 transition-all hover:border-slate-300" key={doc.id}>
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">{doc.document_type}</p>
                            <p className="text-sm text-slate-500">{doc.file_name} {doc.size ? `• ${doc.size}` : ""}</p>
                          </div>
                          <StatusBadge status={doc.status} />
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                          <div>
                            {isPendingVerification ? (
                              !isDocViewed ? (
                                <span className="text-[11px] font-medium text-amber-600 flex items-center gap-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  View document to verify
                                </span>
                              ) : (
                                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                                  <Check className="h-3 w-3 text-emerald-600" />
                                  Viewed • Ready to verify
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-slate-400">
                                {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => openDocPreview(doc)}
                              size="sm"
                              type="button"
                              variant="outline"
                              className="text-xs px-2.5 py-0.5 h-auto flex items-center gap-1 text-slate-700 hover:bg-slate-50 border-slate-300"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                              View
                            </Button>
                            {isPendingVerification ? (
                              <>
                                <Button
                                  onClick={async () => {
                                    if (!isDocViewed) {
                                      toast({
                                        title: "Document Not Viewed",
                                        description: "Please view the uploaded document in the viewer before verifying.",
                                        variant: "warning",
                                      });
                                      return;
                                    }
                                    await updateDsaDocumentStatus(dsa.id, {
                                      document_id: doc.id,
                                      status: "Verified",
                                      remarks: `Verified by ${currentUser?.name}`,
                                    });
                                    await fetchDsaDetail(dsa.id);
                                    toast({
                                      title: "Document Verified",
                                      description: `${doc.document_type} has been verified successfully.`,
                                      variant: "success",
                                    });
                                  }}
                                  disabled={!isDocViewed}
                                  size="sm"
                                  type="button"
                                  className={cn(
                                    "font-semibold text-xs px-2.5 py-0.5 h-auto transition-all",
                                    isDocViewed
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                      : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                  )}
                                  title={!isDocViewed ? "You must view the document before verifying" : "Verify this document"}
                                >
                                  Verify
                                </Button>
                                <Button
                                  onClick={async () => {
                                    await updateDsaDocumentStatus(dsa.id, {
                                      document_id: doc.id,
                                      status: "Failed",
                                      remarks: `Rejected by ${currentUser?.name}`,
                                    });
                                    await fetchDsaDetail(dsa.id);
                                    toast({
                                      title: "Document Rejected",
                                      description: `${doc.document_type} has been marked as failed/rejected.`,
                                      variant: "warning",
                                    });
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="danger"
                                  className="font-semibold text-xs px-2 py-0.5 h-auto"
                                >
                                  Fail
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(dsa.documents || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No documents uploaded for this partner.</p>
                ) : null}
              </div>

              {missingProfileDocuments.length > 0 ? (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Upload Missing Documents</h4>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {missingProfileDocuments.map((document) => {
                      const inputId = `profile-doc-${dsa.id}-${document.document_type}`;
                      const isStaffOnly = Boolean(document.staff_only);

                      return (
                        <div
                          className={cn(
                            "rounded-lg border border-dashed p-4 flex items-center justify-between",
                            isStaffOnly
                              ? "border-amber-200 bg-amber-50/60"
                              : "border-sky-100 bg-sky-50/50"
                          )}
                          key={document.document_type}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-800 text-sm">{document.display_name}</p>
                              {isStaffOnly ? (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Bank Staff Only
                                </span>
                              ) : null}
                            </div>
                            <p className={cn("text-xs mt-0.5", isStaffOnly ? "text-amber-700" : "text-sky-700")}>
                              {document.requirement}
                            </p>
                          </div>
                          <div>
                            <input
                              accept=".jpg,.jpeg,.png,.pdf"
                              className="sr-only"
                              id={inputId}
                              onChange={async (e) => {
                                const file = e.currentTarget.files?.[0];
                                if (file) {
                                  await uploadDsaDocument(dsa.id, {
                                    file,
                                    document_type: document.document_type,
                                    owner_name: dsa.name,
                                  });
                                  await fetchDsaDetail(dsa.id);
                                  // Refresh checklist after upload
                                  adminApi.getDsaDocumentChecklist(dsa.id)
                                    .then((res: any) => setDocChecklist(res?.data ?? res))
                                    .catch(() => {});
                                }
                              }}
                              type="file"
                            />
                            <label
                              className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 transition"
                              htmlFor={inputId}
                            >
                              <UploadCloud className="h-3.5 w-3.5" />
                              Upload
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {tab === "agreements" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-slate-900">Master Service Agreement (MSA)</h3>
                <p className="text-xs text-slate-500">Generate, review, and execute legal agreements for partner activation.</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Agreement Generation</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The agreement can be generated once the partner is approved. Generating will create a customized legal document.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        disabled={actionLoading || (dsa.onboarding_status !== "PENDING_APPROVAL" && dsa.onboarding_status !== "APPROVED" && dsa.onboarding_status !== "AGREEMENT_PENDING")}
                        onClick={async () => {
                          await generateAgreement(dsa.id);
                          await fetchDsaDetail(dsa.id);
                        }}
                        size="sm"
                        type="button"
                      >
                        {actionLoading ? "Generating..." : "Generate Agreement PDF"}
                      </Button>
                      <Button
                        disabled={dsa.onboarding_status !== "AGREEMENT_PENDING" && dsa.onboarding_status !== "AGREEMENT_COMPLETED"}
                        onClick={async () => {
                          const details = await downloadAgreement(dsa.id);
                          if (details?.file_url) {
                            window.open(details.file_url, "_blank");
                          }
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Download Agreement
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Upload Signed Agreement</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Upload the signed and scanned PDF copy of the generated MSA. Uploading the signed agreement will automatically transition the partner to Active status.
                    </p>
                    <div className="pt-2">
                      <input
                        accept=".pdf"
                        className="sr-only"
                        id="signedAgreementUpload"
                        onChange={async (e) => {
                          const file = e.currentTarget.files?.[0];
                          if (file) {
                            await uploadSignedAgreement(dsa.id, file);
                            await fetchDsaDetail(dsa.id);
                          }
                        }}
                        type="file"
                        disabled={actionLoading || dsa.onboarding_status !== "AGREEMENT_PENDING"}
                      />
                      <label
                        className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold text-white transition ${
                          dsa.onboarding_status === "AGREEMENT_PENDING" && !actionLoading
                            ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                            : "bg-slate-300 cursor-not-allowed"
                        }`}
                        htmlFor={dsa.onboarding_status === "AGREEMENT_PENDING" ? "signedAgreementUpload" : undefined}
                      >
                        <UploadCloud className="h-4 w-4" />
                        {actionLoading ? "Uploading..." : "Upload Signed PDF"}
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
          {tab === "performance" ? (
            <div className="space-y-5">
              <DetailGrid>
                <DetailItem label="Leads sourced" value={leads.length} />
                <DetailItem label="Applications sourced" value={applications.length} />
                <DetailItem label="Approved or disbursed" value={approvedApplications} />
                <DetailItem label="Disbursed applications" value={disbursedApplications} />
                <DetailItem label="Sourced loan value" value={formatCurrency(sourcedLoanValue)} />
                <DetailItem label="Commission earned" value={formatCurrency(commissionTotal || dsa.commission_earned)} />
              </DetailGrid>
              <div>
                <h3 className="text-sm font-bold text-slate-900">User activity analysis</h3>
                <p className="mt-1 text-xs text-slate-500">Performance for users who sourced activity for this DSA.</p>
                {agentAnalysis.length ? (
                  <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="p-3">User</th>
                          <th className="p-3 text-right">Leads</th>
                          <th className="p-3 text-right">Applications</th>
                          <th className="p-3 text-right">Approved / disbursed</th>
                          <th className="p-3 text-right">Conversion</th>
                          <th className="p-3 text-right">Loan value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {agentAnalysis.map((agent) => (
                          <tr key={agent.name}>
                            <td className="p-3 font-semibold text-slate-900">{agent.name}</td>
                            <td className="p-3 text-right text-slate-700">{agent.leads}</td>
                            <td className="p-3 text-right text-slate-700">{agent.applications}</td>
                            <td className="p-3 text-right text-slate-700">{agent.approvedOrDisbursed}</td>
                            <td className="p-3 text-right text-slate-700">{percent(agent.applications ? (agent.approvedOrDisbursed / agent.applications) * 100 : 0)}</td>
                            <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(agent.loanValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No user activity has been recorded for this DSA yet.</p>
                )}
              </div>
            </div>
          ) : null}
          {tab === "products" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Configured Products</h3>
                  <p className="text-xs text-slate-500">Products configured here drive the Applications tab product filter.</p>
                </div>
                {currentUser?.role === "DSA Manager" && dsa.operational_status === "ACTIVE" ? (
                  <Link href="/dsa/product-setting">
                    <Button size="sm" type="button" variant="outline">
                      Add product
                    </Button>
                  </Link>
                ) : null}
              </div>
              {productConfigs.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {productConfigs.map((config) => (
                    <div className="rounded-md border border-slate-100 p-4" key={config.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{config.product}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {config.commissionType} - {config.ranges.length} range{config.ranges.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={config.status} />
                          {currentUser?.role === "DSA Manager" ? (
                            <>
                              <Button
                                onClick={() => {
                                  updateItem("dsaProductConfigs", config.id, {
                                    status: config.status === "Active" ? "Inactive" : "Active",
                                  });
                                  toast({
                                    title: config.status === "Active" ? "Product Disabled" : "Product Enabled",
                                    description: `${config.product} has been ${config.status === "Active" ? "disabled" : "re-enabled"} for this DSA.`,
                                    variant: "success",
                                  });
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                                className={config.status === "Active"
                                  ? "text-amber-600 hover:bg-amber-50 border-amber-200 font-semibold text-xs"
                                  : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 font-semibold text-xs"}
                              >
                                {config.status === "Active" ? "Disable" : "Enable"}
                              </Button>
                              <Button
                                onClick={() => {
                                  deleteItem("dsaProductConfigs", config.id);
                                  if (applicationProductFilter === config.product) setApplicationProductFilter("");
                                }}
                                size="sm"
                                type="button"
                                variant="danger"
                              >
                                Remove
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                        <span>URL: {config.loanUrl}</span>
                        <span>Configured: {formatDate(config.configuredAt)}</span>
                        <span>
                          Commission:{" "}
                          {config.ranges.length
                            ? config.ranges.map((range) => formatCommissionDisplay(range)).join(", ")
                            : "Not configured"}
                        </span>
                        <span>Growth rule: current month must beat previous month</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {dsa.operational_status === "ACTIVE"
                    ? "No products configured for this DSA yet."
                    : "Loan products will be available only after this DSA is verified and onboarded."}
                </p>
              )}
            </div>
          ) : null}
          {tab === "agents" && canManageAgents ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Manage Agents</h3>
                  <p className="text-xs text-slate-500">
                    Agents listed here are linked only to {dsa.name}. New agents are saved under this DSA.
                  </p>
                </div>
                <Button onClick={() => setCreatingAgent(true)} type="button">
                  <Plus className="h-4 w-4" />
                  New Agent
                </Button>
              </div>
              <DataTable
                actions={(item) => (
                  <ActionPair
                    onDelete={() => deleteItem("users", item.id)}
                    onEdit={() => setEditingAgent(item)}
                  />
                )}
                columns={dsaAgentColumns}
                emptyDescription="Create an agent from this tab to attach it to this DSA."
                emptyTitle="No agents under this DSA"
                items={dsaAgents}
                pageSize={8}
                searchKeys={["name", "email", "region", "status"]}
              />
            </div>
          ) : null}
          {tab === "apps" ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Applications by Product</h3>
                  <p className="text-xs text-slate-500">Sorted by product, then application number.</p>
                </div>
                <Select
                  aria-label="application product"
                  className="sm:w-56"
                  onChange={(event) => setApplicationProductFilter(event.target.value)}
                  value={effectiveApplicationProductFilter}
                >
                  <option value="">All products</option>
                  {configuredProducts.map((product) => (
                    <option key={product} value={product}>{product}</option>
                  ))}
                </Select>
              </div>
              {visibleApplications.length ? (
                visibleApplications.map((app) => (
                  <Link
                    className="flex items-center justify-between rounded-md border border-slate-100 p-3 hover:bg-slate-50"
                    href={`/applications/${app.id}`}
                    key={app.id}
                  >
                    <div>
                      <p className="font-semibold text-slate-950">{app.applicationId}</p>
                      <p className="text-sm text-slate-500">{app.product} - {app.customer} - {formatCurrency(app.loanAmount)}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500">No applications sourced by this DSA yet.</p>
              )}
            </div>
          ) : null}
          {tab === "commission" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Commission Payouts</h3>
                  <p className="text-xs text-slate-500">Monthly slab-based commission records for this partner.</p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    const month = new Date().toLocaleString("default", { month: "short", year: "numeric" });
                    const total = commissions.reduce((sum, c) => sum + c.payout, 0);
                    const tax = Math.round(total * 0.18);
                    const net = total + tax;
                    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
                    
                    const invoice = {
                      id: `inv-${Date.now()}`,
                      invoiceNumber: invoiceNum,
                      dsaId: String(dsa.id),
                      dsaName: dsa.name,
                      dsaCode: dsa.code,
                      month,
                      grossAmount: total,
                      adjustmentAmount: 0,
                      taxAmount: tax,
                      netAmount: net,
                      requestedAmount: net,
                      status: "Raised by DSA" as const,
                      raisedBy: currentUser?.name ?? dsa.contact_person,
                      raisedByRole: (currentUser?.role ?? "DSA Partner") as any,
                      source: "Manual" as const,
                      remarks: `Auto-generated monthly invoice for ${month} from Commission Payouts.`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      history: [
                        {
                          id: `event-${Date.now()}`,
                          action: "Raised" as const,
                          actor: currentUser?.name ?? dsa.contact_person,
                          party: "DSA" as const,
                          amount: net,
                          at: new Date().toISOString(),
                          note: "Invoice generated from commission payout records.",
                        }
                      ]
                    };

                    createItem("dsaInvoices", invoice);
                    toast({
                      title: "Invoice Generated & Sent",
                      description: `Monthly invoice for ${month} (${formatCurrency(net)}) has been generated and dispatched to ${dsa.email}.`,
                      variant: "success",
                    });
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 h-auto flex items-center gap-2"
                >
                  <BadgeIndianRupee className="h-4 w-4" />
                  Generate &amp; Send Monthly Invoice
                </Button>
              </div>
              {commissions.length ? (
                <div className="space-y-3">
                  {commissions.map((commission) => (
                    <div className="grid gap-3 rounded-md border border-slate-100 p-3 md:grid-cols-4" key={commission.id}>
                      <DetailItem label="Month" value={commission.month} />
                      <DetailItem label="Product" value={commission.product} />
                      <DetailItem label="Disbursed" value={formatCurrency(commission.disbursedAmount)} />
                      <DetailItem label="Payout" value={formatCurrency(commission.payout)} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No commission records found for this DSA yet.</p>
              )}

              <hr className="my-6 border-slate-200" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Raised Invoices</h3>
                  <p className="text-xs text-slate-500">Invoices raised and their processing stages.</p>
                </div>
              </div>
              <DataTable
                actions={(item) => (
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setViewingInvoice(item)} size="sm" type="button" variant="outline">Track</Button>
                    {isBankUser && item.status !== "Approved" && item.status !== "Rejected" ? (
                      <>
                        <Button onClick={() => openCounter(item)} size="sm" type="button" variant="secondary">Counter</Button>
                        <Button onClick={() => closeInvoice("Approved", item)} size="sm" type="button">Approve</Button>
                        <Button onClick={() => closeInvoice("Rejected", item)} size="sm" type="button" variant="danger">Reject</Button>
                      </>
                    ) : null}
                    {!isBankUser && item.status === "Countered by Bank" ? (
                      <>
                        <Button onClick={() => openCounter(item)} size="sm" type="button" variant="secondary">Counter back</Button>
                        <Button
                          onClick={() => {
                            const actor = currentUser?.name ?? dsa.name;
                            const event = makeInvoiceEvent(
                              "Approved",
                              actor,
                              "DSA",
                              item.requestedAmount,
                              "DSA accepted the bank counter proposal."
                            );
                            updateItem("dsaInvoices", item.id, {
                              approvedAmount: item.requestedAmount,
                              history: [event, ...item.history],
                              status: "Approved",
                              updatedAt: event.at,
                            });
                          }}
                          size="sm"
                          type="button"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 h-auto flex items-center justify-center"
                        >
                          Accept Proposal
                        </Button>
                      </>
                    ) : null}
                  </div>
                )}
                columns={[
                  { cell: (item) => <span className="font-semibold text-blue-700">{item.invoiceNumber}</span>, header: "Invoice", key: "invoiceNumber" },
                  { cell: (item) => item.month, header: "Month", key: "month" },
                  { cell: (item) => formatCurrency(item.requestedAmount), header: "Requested", key: "requestedAmount" },
                  { cell: (item) => item.approvedAmount ? formatCurrency(item.approvedAmount) : "-", header: "Approved", key: "approvedAmount" },
                  { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
                  { cell: (item) => renderInvoiceTracker(item.status), header: "Track", key: "track" },
                ]}
                emptyDescription="No invoices generated or raised for this DSA yet."
                emptyTitle="No invoices found"
                items={store.dsaInvoices.filter((invoice) => invoice.dsaId === String(dsa.id))}
                searchKeys={["invoiceNumber", "month", "status", "remarks"]}
              />
            </div>
          ) : null}
          {tab === "audit" ? (
            <div className="space-y-3">
              {audit.length ? (
                audit.map((item, idx) => {
                  const action = item.action || item.event || item.description || "Activity logged";
                  const actor = item.actor || item.user?.name || item.causer?.name || "System";
                  const atDate = item.at || item.created_at || item.createdAt;
                  const ip = item.ipAddress || item.ip_address || "Internal";

                  return (
                    <div className="flex gap-3 rounded-md border border-slate-100 p-3" key={item.id || idx}>
                      <FileText className="mt-0.5 h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-slate-950">{action}</p>
                        <p className="text-sm text-slate-500">{actor} · {formatDate(atDate)} · {ip}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No activity logs recorded for this DSA yet.</p>
              )}
            </div>
          ) : null}
          {tab === "reports" ? (
            <DsaRecoveryReports dsaId={String(dsa.id)} />
          ) : null}
        </CardContent>
      </Card>
      <Modal onClose={() => setCreatingAgent(false)} open={creatingAgent} title={`Create DSA agent - ${dsa.name}`}>
        <RecordForm<User>
          fields={agentFields}
          initialValue={{ region: dsa.name, status: "Active" }}
          onCancel={() => setCreatingAgent(false)}
          onSubmit={saveProfileAgent}
          submitLabel="Create agent"
        />
      </Modal>
      <Modal onClose={() => setEditingAgent(null)} open={Boolean(editingAgent)} title="Edit DSA agent">
        {editingAgent ? (
          <RecordForm<User>
            fields={agentFields}
            initialValue={editingAgent}
            onCancel={() => setEditingAgent(null)}
            onSubmit={saveProfileAgentEdit}
            submitLabel="Save agent"
          />
        ) : null}
      </Modal>
      <Modal
        description="Confirm this approval step after verifying KYC, documents, and business information."
        onClose={closeDecisionModals}
        open={Boolean(approvingDsa)}
        title={`Approve DSA Partner — ${workflowLevelInfo.levelName}`}
        width="max-w-lg"
      >
        {approvingDsa ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">{approvingDsa.name}</p>
              <p className="mt-1 text-xs text-emerald-800">
                This action will approve Level {workflowLevelInfo.currentLevel} ({workflowLevelInfo.roleName}) and advance the application to {workflowLevelInfo.nextLevelName}.
              </p>
            </div>
            <DetailGrid>
              <DetailItem label="Current stage" value={workflowLevelInfo.levelName} />
              <DetailItem label="Assigned role" value={workflowLevelInfo.roleName} />
              <DetailItem label="Next stage" value={workflowLevelInfo.nextLevelName} />
              <DetailItem label="Approval rate" value={percent(approvingDsa.approval_rate || 0)} />
            </DetailGrid>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={closeDecisionModals}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  const remarks = `Approved Level ${workflowLevelInfo.currentLevel} by ${currentUser?.role} (${currentUser?.name})`;
                  const updated = await updateDsaProfile(approvingDsa.id, {
                    action: "APPROVE",
                    remarks,
                  } as any);
                  if (updated) {
                    await fetchDsaDetail(id);
                    toast({
                      title: "Partner Approved",
                      description: `${approvingDsa.name} approved to ${workflowLevelInfo.nextLevelName}.`,
                      variant: "success",
                    });
                    closeDecisionModals();
                  }
                }}
              >
                {actionLoading ? "Processing..." : workflowLevelInfo.actionLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        description="Specify the missing information or document query required from the applicant."
        onClose={closeDecisionModals}
        open={Boolean(queryingDsa)}
        title="Raise Onboarding Query"
        width="max-w-lg"
      >
        <div className="space-y-4">
          <Field>
            <Label htmlFor="queryReason">Query details</Label>
            <textarea
              id="queryReason"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={queryReason}
              onChange={(event) => {
                setQueryReason(event.target.value);
                setQueryError("");
              }}
              placeholder="Enter query details (e.g. Bank statement signature missing, GST registration certificate unclear)"
            />
            {queryError ? <p className="text-xs font-medium text-rose-600">{queryError}</p> : null}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={closeDecisionModals}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              type="button"
              disabled={actionLoading}
              onClick={async () => {
                if (queryingDsa) {
                  if (!queryReason.trim()) {
                    setQueryError("Please provide query details before submitting.");
                    return;
                  }
                  const updated = await updateDsaProfile(queryingDsa.id, {
                    action: "QUERY",
                    query: queryReason.trim(),
                    remarks: queryReason.trim(),
                  } as any);
                  if (updated) {
                    await fetchDsaDetail(id);
                    toast({
                      title: "Query Raised",
                      description: `Query submitted for ${queryingDsa.name}. Status updated to Document Pending.`,
                      variant: "success",
                    });
                    closeDecisionModals();
                  }
                }
              }}
            >
              {actionLoading ? "Processing..." : "Submit Query"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal onClose={closeDecisionModals} open={Boolean(rejectingDsa)} title="Reject DSA Partner" width="max-w-lg">
        <div className="space-y-4">
          <Field>
            <Label htmlFor="profileRejectionReason">Rejection reason</Label>
            <textarea
              id="profileRejectionReason"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={rejectionReason}
              onChange={(event) => {
                setRejectionReason(event.target.value);
                setRejectionError("");
              }}
              placeholder="Enter reason (e.g. KYC mismatch, business documentation incomplete)"
            />
            {rejectionError ? <p className="text-xs font-medium text-rose-600">{rejectionError}</p> : null}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={closeDecisionModals}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              type="button"
              disabled={actionLoading}
              onClick={async () => {
                if (rejectingDsa) {
                  if (!rejectionReason.trim()) {
                    setRejectionError("Add a reason before rejecting this DSA.");
                    return;
                  }
                  const updated = await updateDsaProfile(rejectingDsa.id, {
                    action: "REJECT",
                    remarks: rejectionReason.trim(),
                  } as any);
                  if (updated) {
                    await fetchDsaDetail(id);
                    toast({
                      title: "Partner Rejected",
                      description: `${rejectingDsa.name} has been rejected.`,
                      variant: "success",
                    });
                    closeDecisionModals();
                  }
                }
              }}
            >
              {actionLoading ? "Processing..." : "Reject Partner"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={() => setViewingLifecycleReason(null)}
        open={Boolean(viewingLifecycleReason && canViewDsaLifecycleReason && viewingLifecycleReason.statusReason)}
        title={`${viewingLifecycleReason?.statusReasonAction ?? viewingLifecycleReason?.status ?? "Lifecycle"} reason`}
        width="max-w-md"
      >
        {viewingLifecycleReason ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="text-sm font-semibold text-amber-950">{viewingLifecycleReason.name}</p>
                <p className="mt-1 text-xs text-amber-800">
                  {viewingLifecycleReason.statusReasonBy
                    ? `Recorded by ${viewingLifecycleReason.statusReasonBy}`
                    : "Recorded by internal user"}
                  {viewingLifecycleReason.statusReasonAt
                    ? ` on ${formatDate(viewingLifecycleReason.statusReasonAt)}`
                    : ""}
                </p>
              </div>
              <StatusBadge status={viewingLifecycleReason.status} />
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
              {viewingLifecycleReason.statusReason}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setViewingLifecycleReason(null)} type="button" variant="secondary">
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        onClose={() => setDeletingDsa(null)}
        open={Boolean(deletingDsa)}
        title="Permanently delete DSA?"
        width="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-900">{deletingDsa?.name}</p>
            <p className="mt-1 text-xs text-rose-800">
              This removes the DSA record and every linked product, lead, application, payout, and document record from the app.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <DetailItem label="Product configs" value={allProductConfigs.length} />
            <DetailItem label="Leads" value={leads.length} />
            <DetailItem label="Applications" value={applications.length} />
            <DetailItem label="Commissions" value={commissions.length} />
            <DetailItem label="Documents" value={linkedDocumentCount} />
            <DetailItem label="Verification checks" value={linkedVerificationCount} />
            <DetailItem label="Approval records" value={linkedApprovalCount} />
            <DetailItem label="User records" value={linkedUserCount} />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDeletingDsa(null)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!deletingDsa) return;
                deleteDsaCascade(deletingDsa.id);
                setDeletingDsa(null);
                router.push("/dsa/management");
              }}
              type="button"
              variant="danger"
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={closeLifecycleModals}
        open={Boolean(deactivatingDsa)}
        title="Deactivate DSA Partner?"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to deactivate <span className="font-bold text-slate-800">{deactivatingDsa?.name}</span>?
          </p>
          <p className="text-xs text-slate-500">
            This will suspend the DSA, disable their marketing journeys, and remove their name from dropdowns across the platform.
          </p>
          <Field>
            <Label htmlFor="deactivationReason">Deactivation reason</Label>
            <textarea
              id="deactivationReason"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={lifecycleReason}
              onChange={(event) => {
                setLifecycleReason(event.target.value);
                setLifecycleReasonError("");
              }}
              placeholder="Enter reason visible to Branch, DSA Credit, and Super Admin"
            />
            {lifecycleReasonError ? <p className="text-xs font-medium text-rose-600">{lifecycleReasonError}</p> : null}
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={closeLifecycleModals} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (deactivatingDsa) {
                  const reason = lifecycleReason.trim();
                  if (!reason) {
                    setLifecycleReasonError("Add a reason before deactivating this DSA.");
                    return;
                  }
                  const updated = await updateDsaStatus(deactivatingDsa.id, {
                    operational_status: "SUSPENDED",
                    reason,
                  });
                  if (updated) {
                    await fetchDsaDetail(id);
                    closeLifecycleModals();
                  }
                }
              }}
              type="button"
              variant="danger"
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Deactivate"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={closeLifecycleModals}
        open={Boolean(blacklistingDsa)}
        title="Blacklist DSA Partner?"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to blacklist <span className="font-bold text-slate-800">{blacklistingDsa?.name}</span>?
          </p>
          <p className="text-xs text-slate-500">
            This will put the partner in the blacklisted DSAs list, suspend their marketing journeys, and disable their access.
          </p>
          <Field>
            <Label htmlFor="blacklistReason">Blacklist reason</Label>
            <textarea
              id="blacklistReason"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={lifecycleReason}
              onChange={(event) => {
                setLifecycleReason(event.target.value);
                setLifecycleReasonError("");
              }}
              placeholder="Enter reason visible to Branch, DSA Credit, and Super Admin"
            />
            {lifecycleReasonError ? <p className="text-xs font-medium text-rose-600">{lifecycleReasonError}</p> : null}
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={closeLifecycleModals} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (blacklistingDsa) {
                  const reason = lifecycleReason.trim();
                  if (!reason) {
                    setLifecycleReasonError("Add a reason before blacklisting this DSA.");
                    return;
                  }
                  const updated = await updateDsaStatus(blacklistingDsa.id, {
                    operational_status: "TERMINATED",
                    reason,
                  });
                  if (updated) {
                    await fetchDsaDetail(id);
                    closeLifecycleModals();
                  }
                }
              }}
              type="button"
              variant="danger"
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Blacklist"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={() => setActivatingDsa(null)}
        open={Boolean(activatingDsa)}
        title="Reactivate DSA Partner?"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to reactivate <span className="font-bold text-slate-800">{activatingDsa?.name}</span>?
          </p>
          <p className="text-xs text-slate-500">
            This will set the DSA&apos;s status to Active and restore their availability in dropdowns and marketing journeys.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setActivatingDsa(null)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (activatingDsa) {
                  const updated = await updateDsaStatus(activatingDsa.id, {
                    operational_status: "ACTIVE",
                    reason: "Reactivated by admin",
                  });
                  if (updated) {
                    await fetchDsaDetail(id);
                    setActivatingDsa(null);
                  }
                }
              }}
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Activate"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={() => setUnblacklistingDsa(null)}
        open={Boolean(unblacklistingDsa)}
        title="Remove DSA Partner from Blacklist?"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to remove <span className="font-bold text-slate-800">{unblacklistingDsa?.name}</span> from the blacklist?
          </p>
          <p className="text-xs text-slate-500">
            This will restore their status to Active and make them available in dropdowns and marketing journeys again.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setUnblacklistingDsa(null)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (unblacklistingDsa) {
                  const updated = await updateDsaStatus(unblacklistingDsa.id, {
                    operational_status: "ACTIVE",
                    reason: "Removed from blacklist",
                  });
                  if (updated) {
                    await fetchDsaDetail(id);
                    setUnblacklistingDsa(null);
                  }
                }
              }}
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Remove and Activate"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal onClose={() => setViewingInvoice(null)} open={Boolean(viewingInvoice)} title="Invoice status tracker" width="max-w-2xl">
        {viewingInvoice ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <p className="text-sm font-bold text-slate-950">{viewingInvoice.invoiceNumber}</p>
                <p className="text-xs text-slate-500">{viewingInvoice.month} · Requested by {viewingInvoice.raisedBy}</p>
              </div>
              <StatusBadge status={viewingInvoice.status} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Current status</p>
              {renderInvoiceTracker(viewingInvoice.status)}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Activity logs</p>
              <div className="divide-y divide-slate-100 rounded-md border border-slate-150 bg-white">
                {viewingInvoice.history.map((event: any, idx: number) => (
                  <div className="p-3 text-xs" key={event.id || idx}>
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>{event.action} by {event.party}</span>
                      <span>{formatCurrency(event.amount)}</span>
                    </div>
                    <p className="text-slate-500 mt-1">{event.actor} · {formatDate(event.at)}</p>
                    {event.note ? <p className="mt-1 text-slate-700 italic border-l-2 border-slate-200 pl-2 bg-slate-50/50 p-1">{event.note}</p> : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewingInvoice(null)} type="button" variant="secondary">Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal onClose={() => setCounterInvoice(null)} open={Boolean(counterInvoice)} title="Counter invoice claim" width="max-w-md">
        <div className="space-y-4">
          <Field>
            <Label>Original claim</Label>
            <p className="text-sm font-semibold text-slate-900">{counterInvoice ? formatCurrency(counterInvoice.requestedAmount) : "-"}</p>
          </Field>
          <Field>
            <Label htmlFor="counterValue">Counter amount (gross net payout)</Label>
            <Input id="counterValue" onChange={(event) => setCounterAmount(event.target.value)} type="number" value={counterAmount} />
          </Field>
          <Field>
            <Label htmlFor="counterNote">Counter remarks / basis</Label>
            <textarea
              id="counterNote"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={counterNote}
              onChange={(event) => setCounterNote(event.target.value)}
              placeholder="Provide reason for countering this invoice claim."
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setCounterInvoice(null)} type="button" variant="secondary">Cancel</Button>
            <Button onClick={submitCounter} type="button">Submit Counter</Button>
          </div>
        </div>
      </Modal>

      {/* Document Viewer Modal */}
      <Modal
        onClose={() => setPreviewDoc(null)}
        open={Boolean(previewDoc)}
        title={previewDoc ? `${previewDoc.document_type || "Document Preview"}` : "Document Preview"}
        description={previewDoc ? `${previewDoc.file_name || ""}${previewDoc.size ? ` • ${previewDoc.size}` : ""}` : ""}
        width="max-w-4xl"
      >
        {previewDoc ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <StatusBadge status={previewDoc.status} />
                {previewDoc.owner_name ? (
                  <span className="text-xs text-slate-600 font-mono">
                    Owner: {previewDoc.owner_name}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {getDocumentUrl(previewDoc) ? (
                  <a
                    href={getDocumentUrl(previewDoc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded bg-white border border-slate-200 shadow-sm hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in new tab
                  </a>
                ) : null}
              </div>
            </div>

            <div className="w-full min-h-[380px] max-h-[68vh] overflow-auto bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center p-2">
              {(() => {
                const url = getDocumentUrl(previewDoc);
                const fileName = (previewDoc.file_name || previewDoc.file_path || "").toLowerCase();
                const isImage =
                  fileName.endsWith(".jpg") ||
                  fileName.endsWith(".jpeg") ||
                  fileName.endsWith(".png") ||
                  fileName.endsWith(".webp") ||
                  fileName.endsWith(".gif") ||
                  fileName.endsWith(".svg");
                const isPdf = fileName.endsWith(".pdf") || (!isImage && url.includes(".pdf"));

                if (!url) {
                  return (
                    <div className="p-8 text-center text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm font-medium">No preview URL available for this document.</p>
                    </div>
                  );
                }

                if (isImage) {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={previewDoc.file_name || "Document preview"}
                      className="max-h-[64vh] w-auto max-w-full object-contain rounded shadow-sm"
                    />
                  );
                }

                if (isPdf) {
                  return (
                    <iframe
                      src={url}
                      title={previewDoc.file_name || "PDF Document"}
                      className="w-full h-[64vh] rounded border-0 bg-white shadow-sm"
                    />
                  );
                }

                return (
                  <iframe
                    src={url}
                    title={previewDoc.file_name || "Document"}
                    className="w-full h-[64vh] rounded border-0 bg-white shadow-sm"
                  />
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-500">
                {previewDoc.uploaded_at ? `Uploaded: ${new Date(previewDoc.uploaded_at).toLocaleString()}` : ""}
              </span>
              <div className="flex items-center gap-2">
                {isBankUser && previewDoc.status !== "Verified" && previewDoc.status !== "Failed" ? (
                  <>
                    <Button
                      onClick={async () => {
                        const targetDoc = previewDoc;
                        await updateDsaDocumentStatus(dsa.id, {
                          document_id: targetDoc.id,
                          status: "Verified",
                          remarks: `Verified by ${currentUser?.name} in viewer modal`,
                        });
                        await fetchDsaDetail(dsa.id);
                        setPreviewDoc(null);
                        toast({
                          title: "Document Verified",
                          description: `${targetDoc.document_type} has been verified successfully.`,
                          variant: "success",
                        });
                      }}
                      size="sm"
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1.5 h-auto"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Verify Document
                    </Button>
                    <Button
                      onClick={async () => {
                        const targetDoc = previewDoc;
                        await updateDsaDocumentStatus(dsa.id, {
                          document_id: targetDoc.id,
                          status: "Failed",
                          remarks: `Rejected by ${currentUser?.name} in viewer modal`,
                        });
                        await fetchDsaDetail(dsa.id);
                        setPreviewDoc(null);
                        toast({
                          title: "Document Rejected",
                          description: `${targetDoc.document_type} has been marked as failed/rejected.`,
                          variant: "warning",
                        });
                      }}
                      size="sm"
                      type="button"
                      variant="danger"
                      className="font-semibold text-xs px-3 py-1.5 h-auto"
                    >
                      Reject Document
                    </Button>
                  </>
                ) : null}
                <Button
                  onClick={() => setPreviewDoc(null)}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-xs px-3 py-1.5 h-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
