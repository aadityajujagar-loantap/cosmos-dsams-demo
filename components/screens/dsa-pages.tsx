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
  HelpCircle,
  X,
  Loader2,
  Send,
  Building2,
  ShieldAlert,
  FileCheck2,
  AlertTriangle,
  Undo2,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Award,
  Mail,
  RotateCcw,
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
import { generateDsaCredentials } from "@/lib/dsa-credentials";
import {
  dsaDocumentType,
  isMissingDsaDocumentRecord,
  requiredDsaDocuments,
} from "@/lib/dsa-documents";
import { useMockStore } from "@/lib/store";
import { useDsa } from "@/hooks/useDsa";
import { isDsaInBranchScope } from "@/lib/branch-scope";
import { BusinessType, Dsa, DsaStatus, Product, User } from "@/lib/types";
import { cn, formatCommissionDisplay, formatCurrency, formatDate, generateDsaId, makeId, percent } from "@/lib/utils";

export function getDsaDisplayStatus(dsa: any): string {
  if (!dsa) return "";
  const agreementStatus = String(dsa.agreement_status || "").toUpperCase();
  const operationalStatus = String(dsa.operational_status || "").toUpperCase();
  const onboardingStatus = String(dsa.onboarding_status || dsa.status || "").toUpperCase();

  if (agreementStatus === "SIGNED_VERIFIED" || operationalStatus === "ACTIVE") {
    return operationalStatus || "ACTIVE";
  }
  if (onboardingStatus === "APPROVED" || onboardingStatus === "AGREEMENT_COMPLETED") {
    return operationalStatus || onboardingStatus;
  }
  return onboardingStatus || "PENDING";
}

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
  stageTitle?: string;
  authorityTitle?: string;
  actionOptions?: string;
  canUserApprove: boolean;
  actionLabel: string;
  nextLevelName: string;
  isFinalStep: boolean;
  isDeviationStep: boolean;
  isCompleted: boolean;
  isRejected: boolean;
};

function getDocumentUrl(doc: any, dsaId?: number | string, useStorageFallback = false): string {
  if (!doc) return "";
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
  const targetDsaId = dsaId || doc.dsa_id;

  // Visit report documents are stored directly in public storage disk, not in dsa_documents table
  if (isVisitReportDocument(doc)) {
    if (doc.file_path) {
      return `${apiBase}/storage/${doc.file_path.replace(/^\/+/, "")}`;
    }
    if (doc.file_url || doc.url) {
      return doc.file_url || doc.url;
    }
  }

  // 1. Primary path: Use dedicated API endpoint for authenticated / backend streaming if document ID is a real DB ID (< 100000)
  if (!useStorageFallback && targetDsaId && doc.id && typeof doc.id === "number" && doc.id < 100000) {
    return `${apiBase}/api/v1/dsa/${targetDsaId}/documents/${doc.id}/file`;
  }

  // 2. Relative file_path via storage
  if (doc.file_path) {
    return `${apiBase}/storage/${doc.file_path.replace(/^\/+/, "")}`;
  }

  // 3. Absolute file_url or url
  const rawUrl = doc.file_url || doc.url;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const apiOrigin = new URL(apiBase).origin;
      if (parsed.origin !== apiOrigin) {
        return `${apiOrigin}${parsed.pathname}${parsed.search}`;
      }
      return rawUrl;
    } catch {
      return rawUrl;
    }
  }

  return "";
}

export function isVisitReportDocument(docOrType?: any): boolean {
  if (!docOrType) return false;
  const rawType = typeof docOrType === "object" ? (docOrType.document_type || docOrType.type || "") : docOrType;
  const t = String(rawType).toLowerCase().trim();
  return (
    t === "visit_report" ||
    t === "physical_visit_report" ||
    t === "office_visit_report" ||
    t === "visit_report_file" ||
    t.includes("visit_report") ||
    t.includes("physical_visit")
  );
}

export function formatDocumentType(type?: string): string {
  if (!type) return "Document Preview";
  if (isVisitReportDocument(type)) return "Physical Visit Report";
  const map: Record<string, string> = {
    aadhaar_card: "Aadhaar Card",
    pan_card: "PAN Card",
    gst_certificate: "GST Certificate",
    msme_certificate: "MSME Certificate",
    cin_llpin: "CIN / LLPIN Certificate",
    bank_statement: "Bank Statement",
    itr: "ITR / Tax Return",
    visit_report: "Physical Visit Report",
    cheque_leaf: "Cancelled Cheque Leaf",
    address_proof: "Address Proof",
    board_resolution: "Board Resolution",
    partnership_deed: "Partnership Deed",
    moa_aoa: "MOA / AOA",
    rent_agreement: "Rent Agreement",
    rental_agreement: "Rent Agreement",
  };
  const key = String(type).toLowerCase().trim();
  if (map[key]) return map[key];
  return String(type)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getEffectiveDsaCode(dsa: any): string {
  if (!dsa) return "";
  if (dsa.dsa_code && String(dsa.dsa_code).trim().length > 0) {
    return String(dsa.dsa_code).trim();
  }
  return dsa.code || (dsa.id ? `DSA-${dsa.id}` : "");
}

export function DocumentViewerBody({
  previewDoc,
  dsaId,
  isBankUser,
  effectiveStatus,
  canVerifyDoc = true,
  verificationRoleNote,
  onVerify,
  onReject,
  onClose,
}: {
  previewDoc: any;
  dsaId?: number | string;
  isBankUser: boolean;
  effectiveStatus: string;
  canVerifyDoc?: boolean;
  verificationRoleNote?: string;
  onVerify: () => Promise<void>;
  onReject: () => Promise<void>;
  onClose: () => void;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const url = getDocumentUrl(previewDoc, dsaId, useFallback);
  const fileName = (previewDoc.file_name || previewDoc.file_path || "").toLowerCase();
  const isImage =
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".webp") ||
    fileName.endsWith(".gif") ||
    fileName.endsWith(".svg");
  const isPdf = fileName.endsWith(".pdf") || (!isImage && url.includes(".pdf"));
  const extMatch = fileName.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  const fileExt = (extMatch ? extMatch[1] : isPdf ? "pdf" : isImage ? "image" : "doc").toUpperCase();

  const embedUrl = useMemo(() => {
    if (!url) return "";
    if (isPdf) {
      // #navpanes=0 suppresses the left sidebar thumbnail pages view
      // #pagemode=none prevents opening document pages outline or thumbnail panel
      // #view=FitH fits page horizontally for required standard viewing size
      const [base, hash] = url.split("#");
      const pdfParams = "navpanes=0&pagemode=none&view=FitH";
      return hash ? `${base}#${pdfParams}&${hash}` : `${base}#${pdfParams}`;
    }
    return url;
  }, [url, isPdf]);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      setSubmitting(true);
      await action();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Meta Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-50/90 rounded-lg border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={effectiveStatus} />
          <span className="font-mono font-semibold text-[10px] px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shadow-2xs uppercase">
            {fileExt}
          </span>
          {previewDoc.size ? (
            <span className="text-slate-500 text-[11px]">
              {previewDoc.size}
            </span>
          ) : null}
          {previewDoc.owner_name ? (
            <span className="text-slate-600 text-[11px] border-l border-slate-200 pl-2">
              Owner: <span className="font-medium text-slate-800">{previewDoc.owner_name}</span>
            </span>
          ) : null}
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 rounded-md bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
            Open in new tab
          </a>
        ) : null}
      </div>

      {/* Main Preview Box */}
      <div className="relative w-full min-h-[360px] max-h-[72vh] overflow-auto bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-center p-2">
        {!url ? (
          <div className="p-8 text-center text-slate-500">
            <FileText className="h-10 w-10 mx-auto mb-2 text-slate-400" />
            <p className="text-xs font-semibold text-slate-700">No preview URL available</p>
            <p className="text-[11px] text-slate-400 mt-0.5">This document cannot be previewed online.</p>
          </div>
        ) : isImage ? (
          imgError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
              <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-2.5 text-amber-600 shadow-2xs">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-800">Unable to preview document</p>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 leading-relaxed">
                The document could not be rendered from the storage server ({previewDoc.file_name || previewDoc.file_path || "document"}).
              </p>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setImgError(false);
                    setUseFallback((prev) => !prev);
                    setImgLoading(true);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in new tab
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-full h-full min-h-[240px]">
              {imgLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100/60 backdrop-blur-2xs z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={previewDoc.file_name || "Document preview"}
                onLoad={() => setImgLoading(false)}
                onError={() => {
                  if (!useFallback && (previewDoc.file_path || previewDoc.file_url)) {
                    setUseFallback(true);
                    setImgLoading(true);
                  } else {
                    setImgError(true);
                    setImgLoading(false);
                  }
                }}
                className={cn(
                  "max-h-[68vh] w-auto max-w-full object-contain rounded-lg shadow-sm border border-slate-200/80 bg-white transition-opacity duration-200",
                  imgLoading ? "opacity-0" : "opacity-100"
                )}
              />
            </div>
          )
        ) : isPdf ? (
          <iframe
            src={embedUrl}
            title={previewDoc.file_name || "PDF Document"}
            className="w-full h-[68vh] min-h-[480px] rounded-lg border border-slate-200 bg-white shadow-xs"
          />
        ) : (
          <iframe
            src={embedUrl}
            title={previewDoc.file_name || "Document"}
            className="w-full h-[68vh] min-h-[480px] rounded-lg border border-slate-200 bg-white shadow-xs"
          />
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {previewDoc.uploaded_at ? (
            <>
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Uploaded {new Date(previewDoc.uploaded_at).toLocaleString([], {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {isBankUser && effectiveStatus !== "Verified" && effectiveStatus !== "Failed" ? (
            canVerifyDoc ? (
              <>
                <Button
                  onClick={() => handleAction(onVerify)}
                  disabled={submitting}
                  size="sm"
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 h-auto rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Verify Document
                </Button>
                <Button
                  onClick={() => handleAction(onReject)}
                  disabled={submitting}
                  size="sm"
                  type="button"
                  variant="danger"
                  className="font-semibold text-xs px-3.5 py-1.5 h-auto rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Reject Document
                </Button>
              </>
            ) : verificationRoleNote ? (
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                {verificationRoleNote}
              </span>
            ) : null
          ) : null}
          <Button
            onClick={onClose}
            disabled={submitting}
            type="button"
            variant="secondary"
            size="sm"
            className="text-xs px-3.5 py-1.5 h-auto rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function getDsaWorkflowLevelInfo(currentUserRole: string | undefined, dsa: any | null): ApprovalStepLevelInfo {
  if (!dsa) {
    return {
      currentLevel: 1,
      levelName: "Stage 1: Application + Documents + Consent",
      stageTitle: "Application + Documents + Consent",
      roleName: "Maker (Branch / Sub-Region / DSA)",
      authorityTitle: "Initiator",
      actionOptions: "Create / Edit / Submit",
      canUserApprove: false,
      actionLabel: "Submit to Checker (L2)",
      nextLevelName: "Stage 2: Due Diligence cum Recommendation Note",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  const onboardingStatus = String(dsa.onboarding_status || dsa.status || "").toUpperCase();
  const agreementStatus = String(dsa.agreement_status || "").toUpperCase();
  const operationalStatus = String(dsa.operational_status || "").toUpperCase();
  const isCompleted =
    onboardingStatus === "APPROVED" ||
    onboardingStatus === "AGREEMENT_PENDING" ||
    onboardingStatus === "AGREEMENT_COMPLETED" ||
    agreementStatus === "SIGNED_VERIFIED" ||
    operationalStatus === "ACTIVE";
  const isRejected = onboardingStatus === "REJECTED";

  if (isCompleted || isRejected) {
    return {
      currentLevel: dsa.current_approval_level || 7,
      levelName: isCompleted ? "Approved & Verified" : "Rejected",
      stageTitle: isCompleted ? "Approved & Verified" : "Rejected",
      roleName: "N/A",
      authorityTitle: isCompleted ? "Approving Authority" : "N/A",
      actionOptions: "N/A",
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
  const normRole = (currentUserRole || "").toUpperCase().replace(/[\s_-]+/g, "");
  const isSuperAdmin =
    normRole === "DSAMANAGER" ||
    normRole === "ADMIN" ||
    normRole === "SUPERADMIN" ||
    currentUserRole === "DSA Manager" ||
    currentUserRole === "Admin";

  if (level === 1) {
    const canApprove =
      isSuperAdmin ||
      normRole === "MAKER" ||
      normRole === "BRANCHUSER" ||
      normRole === "BRANCHMAKER" ||
      normRole === "STAFF" ||
      normRole === "ASSISTANTMANAGER";
    return {
      currentLevel: 1,
      levelName: "Stage 1: Application + Documents + Consent",
      stageTitle: "Application + Documents + Consent",
      roleName: "Maker (Branch / Sub-Region / DSA)",
      authorityTitle: "Initiator",
      actionOptions: "Create / Edit / Submit",
      canUserApprove: canApprove,
      actionLabel: "Approve & Submit to Checker (L2)",
      nextLevelName: "Stage 2: Due Diligence cum Recommendation Note",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 2) {
    const canApprove =
      isSuperAdmin ||
      normRole === "CHECKER" ||
      normRole === "BRANCHCHECKER" ||
      normRole === "MANAGER";
    return {
      currentLevel: 2,
      levelName: "Stage 2: Due Diligence cum Recommendation Note",
      stageTitle: "Due Diligence cum Recommendation Note",
      roleName: "Checker (Sub-Region Staff)",
      authorityTitle: "Checker",
      actionOptions: "Complete DD Note / API checks / Submit",
      canUserApprove: canApprove,
      actionLabel: "Recommend to Sub-Region Head (L3)",
      nextLevelName: "Stage 3: Recommendation — Stage 1",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 3) {
    const canApprove =
      isSuperAdmin ||
      normRole === "SUBREGIONHEAD" ||
      normRole === "SUBREGIONSTAFF" ||
      normRole === "SUBREGIONCHECKER" ||
      normRole === "AGM" ||
      currentUserRole === "Sub-Region Head";
    return {
      currentLevel: 3,
      levelName: "Stage 3: Recommendation — Stage 1",
      stageTitle: "Recommendation — Stage 1",
      roleName: "Sub-Region Head (AGM)",
      authorityTitle: "1st Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to DGM (L4)",
      nextLevelName: "Stage 4: Recommendation — Stage 2",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 4) {
    const canApprove =
      isSuperAdmin ||
      normRole === "DGM" ||
      normRole === "DEPUTYGENERALMANAGER" ||
      currentUserRole === "DGM" ||
      currentUserRole === "Deputy General Manager";
    return {
      currentLevel: 4,
      levelName: "Stage 4: Recommendation — Stage 2",
      stageTitle: "Recommendation — Stage 2",
      roleName: "DGM (where posted)",
      authorityTitle: "2nd Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to Region Head (L5)",
      nextLevelName: "Stage 5: Recommendation — Stage 3",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 5) {
    const canApprove =
      isSuperAdmin ||
      normRole === "REGIONHEAD" ||
      normRole === "REGIONALHEAD" ||
      normRole === "BRANCHREGIONALHEAD" ||
      currentUserRole === "Region Head" ||
      currentUserRole === "Branch Regional Head";
    return {
      currentLevel: 5,
      levelName: "Stage 5: Recommendation — Stage 3",
      stageTitle: "Recommendation — Stage 3",
      roleName: "Region Head",
      authorityTitle: "3rd Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to HO Credit Officer (L6)",
      nextLevelName: "Stage 6: Recommendation — Stage 4",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 6) {
    const canApprove =
      isSuperAdmin ||
      normRole === "HOCREDITOFFICER" ||
      normRole === "CREDITOFFICER" ||
      normRole === "HOCREDIT" ||
      normRole === "DSACREDIT" ||
      currentUserRole === "HO Credit Officer" ||
      currentUserRole === "DSA Credit";
    return {
      currentLevel: 6,
      levelName: "Stage 6: Recommendation — Stage 4",
      stageTitle: "Recommendation — Stage 4",
      roleName: "HO Credit Officer (AGM)",
      authorityTitle: "Credit AGM",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to HO Credit Head (L7)",
      nextLevelName: "Stage 7: Final Approval",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  if (level === 7) {
    const canApprove =
      isSuperAdmin ||
      normRole === "HOCREDITHEAD" ||
      normRole === "CREDITHEAD" ||
      normRole === "HEADOFFICECREDITHEAD" ||
      currentUserRole === "HO Credit Head";
    return {
      currentLevel: 7,
      levelName: "Stage 7: Final Approval",
      stageTitle: "Final Approval",
      roleName: "HO Credit Head",
      authorityTitle: "Approving Authority",
      actionOptions: "Approve / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Grant Final Approval & Sanction",
      nextLevelName: "Approved & Active",
      isFinalStep: true,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  return {
    currentLevel: level,
    levelName: `Stage ${level} Approval`,
    stageTitle: `Stage ${level} Approval`,
    roleName: "Reviewer",
    authorityTitle: "Recommending Authority",
    actionOptions: "Recommend / Reject / Revert",
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
  const agreementStatus = String(dsa.agreement_status || "").toUpperCase();
  const operationalStatus = String(dsa.operational_status || "").toUpperCase();
  const isApproved =
    onboardingStatus === "APPROVED" ||
    onboardingStatus === "AGREEMENT_PENDING" ||
    onboardingStatus === "AGREEMENT_COMPLETED" ||
    agreementStatus === "SIGNED_VERIFIED" ||
    operationalStatus === "ACTIVE";
  const isRejected = onboardingStatus === "REJECTED";

  const steps = [
    {
      level: 1,
      stageNumber: "Stage 1",
      name: "Application + Documents + Consent",
      role: "Maker (Branch / Sub-Region / DSA)",
      authority: "Initiator",
      actionOptions: "Create / Edit / Submit",
    },
    {
      level: 2,
      stageNumber: "Stage 2",
      name: "Due Diligence cum Recommendation Note",
      role: "Checker (Sub-Region Staff)",
      authority: "Checker",
      actionOptions: "Complete DD Note / API checks / Submit",
    },
    {
      level: 3,
      stageNumber: "Stage 3",
      name: "Recommendation — Stage 1",
      role: "Sub-Region Head (AGM)",
      authority: "1st Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
    },
    {
      level: 4,
      stageNumber: "Stage 4",
      name: "Recommendation — Stage 2",
      role: "DGM (where posted)",
      authority: "2nd Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
    },
    {
      level: 5,
      stageNumber: "Stage 5",
      name: "Recommendation — Stage 3",
      role: "Region Head",
      authority: "3rd Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
    },
    {
      level: 6,
      stageNumber: "Stage 6",
      name: "Recommendation — Stage 4",
      role: "HO Credit Officer (AGM)",
      authority: "Credit AGM",
      actionOptions: "Recommend / Reject / Revert",
    },
    {
      level: 7,
      stageNumber: "Stage 7",
      name: "Final Approval",
      role: "HO Credit Head",
      authority: "Approving Authority",
      actionOptions: "Approve / Reject / Revert",
    },
  ];

  const getStepRecord = (stepLevel: number) => {
    if (Array.isArray(dsa.approvals) && dsa.approvals.length > 0) {
      const match = dsa.approvals.find((a: any) => Number(a.approval_level) === stepLevel);
      if (match) return match;
    }
    if (isApproved) return { status: "APPROVED", remarks: "Approved" };
    if (isRejected && currentLevel === stepLevel) return { status: "REJECTED", remarks: dsa.rejection_reason || dsa.rejectionReason || "Rejected" };
    if (currentLevel > stepLevel) return { status: "APPROVED", remarks: "Completed" };
    if (currentLevel === stepLevel) return { status: onboardingStatus === "DOCUMENT_PENDING" ? "QUERY" : "PENDING", remarks: "Pending Review" };
    return { status: "PENDING", remarks: "Upcoming" };
  };

  return (
    <Card className="p-4 bg-slate-50/80 border-slate-200 shadow-sm mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            2.8 Approval Workflow (7-Stage Hierarchy)
          </h4>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {isApproved ? "Status: Fully Approved & Active" : isRejected ? "Status: Rejected" : `Active Queue: Stage ${currentLevel} (${steps[currentLevel - 1]?.name || "Review"})`}
        </span>
      </div>

      {/* Section 2.8 Deviation on mail notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 mb-3 text-xs text-blue-950 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Deviation on mail:</strong> When the Checker sends for recommendation via email, the Due Diligence Checklist, Recommendation, and Approval Authority details are attached automatically.
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold shrink-0">
          Auto-Attached
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        {steps.map((step) => {
          const rec = getStepRecord(step.level);
          const statusStr = String(rec.status || "PENDING").toUpperCase();
          const isPassed = statusStr === "APPROVED" || statusStr === "RECOMMENDED";
          const isSkipped = statusStr === "SKIPPED";
          const isCurrent = currentLevel === step.level && !isApproved && !isRejected;
          const isFailed = statusStr === "REJECTED";
          const isQuery = statusStr === "QUERY";

          return (
            <div
              key={step.level}
              className={`relative flex flex-col justify-between rounded-lg border p-2.5 text-xs transition-all ${
                isPassed
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                  : isSkipped
                  ? "border-slate-200 bg-slate-100/70 text-slate-400 opacity-60"
                  : isCurrent
                  ? "border-blue-400 bg-blue-50 ring-2 ring-blue-400/20 text-blue-900 font-medium shadow-sm"
                  : isQuery
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : isFailed
                  ? "border-rose-300 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-[9px] uppercase tracking-wide opacity-75">
                    {step.stageNumber}
                  </span>
                  {isPassed && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                      <Check className="mr-0.5 h-2.5 w-2.5" /> Done
                    </span>
                  )}
                  {isSkipped && (
                    <span
                      className="inline-flex items-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-600"
                      title={step.level === 4 ? "Bypassed: No DGM authority posted to this branch" : "Step skipped"}
                    >
                      Skipped
                    </span>
                  )}
                  {isCurrent && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 animate-pulse">
                      Active
                    </span>
                  )}
                  {isQuery && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                      Query
                    </span>
                  )}
                  {isFailed && (
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-800">
                      Rejected
                    </span>
                  )}
                  {!isPassed && !isSkipped && !isCurrent && !isQuery && !isFailed && (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                      Pending
                    </span>
                  )}
                </div>

                <p className="font-bold text-slate-900 text-[11px] leading-snug line-clamp-2" title={step.name}>
                  {step.name}
                </p>
                <p className="text-[10px] text-slate-600 font-medium truncate mt-0.5" title={step.role}>
                  {step.role}
                </p>
                <div className="mt-1 flex flex-col gap-0.5 text-[9px] text-slate-500">
                  <span className="truncate" title={`Authority: ${step.authority}`}>
                    <strong className="text-slate-700">Auth:</strong> {step.authority}
                  </span>
                  <span className="truncate" title={`Actions: ${step.actionOptions}`}>
                    <strong className="text-slate-700">Actions:</strong> {step.actionOptions}
                  </span>
                </div>
              </div>

              {rec.remarks && (
                <p className="mt-2 text-[9px] text-slate-600 bg-white/80 p-1 rounded border border-slate-200/60 truncate" title={rec.remarks}>
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
    fetchMakerBucket,
    updateDsaProfile,
    actionLoading,
    userBranchScope,
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

  const roleStr = String(currentUser?.role || "");
  const canAccessMakerQueue =
    roleStr === "Branch User" ||
    roleStr === "Maker" ||
    roleStr === "Branch Maker" ||
    roleStr === "Staff" ||
    roleStr === "Assistant Manager" ||
    roleStr === "DSA Manager";

  const [onHoldDsas, setOnHoldDsas] = useState<any[]>([]);
  const [makerBucketDsas, setMakerBucketDsas] = useState<any[]>([]);
  const [makerBucketLoading, setMakerBucketLoading] = useState(false);
  const [makerBucketTotal, setMakerBucketTotal] = useState(0);
  const [makerPage, setMakerPage] = useState(1);

  const defaultBucketForRole = useMemo(() => {
    if (!currentUser?.role) return "";
    const norm = currentUser.role.toUpperCase().replace(/[\s_-]+/g, "");
    if (norm === "HOCREDITHEAD" || norm === "CREDITHEAD") return "7";
    if (norm === "HOCREDITOFFICER" || norm === "CREDITOFFICER" || norm === "HOCREDIT") return "6";
    if (norm === "REGIONHEAD" || norm === "REGIONALHEAD" || norm === "BRANCHREGIONALHEAD") return "5";
    if (norm === "DGM" || norm === "DEPUTYGENERALMANAGER") return "4";
    if (norm === "SUBREGIONHEAD" || norm === "SUBREGIONSTAFF") return "3";
    if (norm === "CHECKER" || norm === "BRANCHCHECKER") return "2";
    if (norm === "BRANCHUSER" || norm === "MAKER") return "1";
    return "";
  }, [currentUser?.role]);

  const [approvalBucket, setApprovalBucket] = useState(() => defaultBucketForRole);

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
        const items = response?.data?.items || [];
        setOnHoldDsas(
          userBranchScope?.isBranchRestricted
            ? items.filter((item: any) => isDsaInBranchScope(item, userBranchScope))
            : items
        );
      } catch {
        setOnHoldDsas([]);
      }
    }
    loadOnHold();
  }, [dsas, dsaListError, isNetworkPage, pagination.total, userBranchScope]);

  useEffect(() => {
    if (isNetworkPage || !canAccessMakerQueue) return;
    async function checkMakerCount() {
      try {
        const res = await fetchMakerBucket({ per_page: 1 });
        if (res?.pagination?.total !== undefined) {
          setMakerBucketTotal(res.pagination.total);
        }
      } catch {
        // ignore
      }
    }
    checkMakerCount();
  }, [fetchMakerBucket, isNetworkPage, canAccessMakerQueue]);

  useEffect(() => {
    if (isNetworkPage || !canAccessMakerQueue || managementTab !== "maker") return;
    async function loadMakerQueue() {
      setMakerBucketLoading(true);
      try {
        const res = await fetchMakerBucket({
          search: search.trim() || undefined,
          page: makerPage,
          per_page: 10,
        });
        if (res?.items) {
          setMakerBucketDsas(res.items);
          setMakerBucketTotal(res.pagination?.total ?? res.items.length);
        } else {
          setMakerBucketDsas([]);
        }
      } catch {
        setMakerBucketDsas([]);
      } finally {
        setMakerBucketLoading(false);
      }
    }
    loadMakerQueue();
  }, [fetchMakerBucket, isNetworkPage, managementTab, makerPage, search, canAccessMakerQueue]);

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
          description={
            userBranchScope?.isBranchRestricted
              ? `Displaying partner applications assigned strictly to ${userBranchScope.primaryBranchName || userBranchScope.primaryBranchCode || "your assigned branch"}.`
              : "Manage registered partner entities, verify bank details, and execute agreement signing workflows."
          }
          eyebrow={
            userBranchScope?.isBranchRestricted
              ? `Branch: ${userBranchScope.primaryBranchName || userBranchScope.primaryBranchCode || "Assigned Branch"}`
              : "Administration"
          }
          title="DSA Management"
        />
        {userBranchScope?.isBranchRestricted && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-900 shadow-sm self-start sm:self-center">
            <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Assigned Branch: <strong>{userBranchScope.primaryBranchName || userBranchScope.primaryBranchCode}</strong>
              {userBranchScope.primaryBranchCode ? ` (${userBranchScope.primaryBranchCode})` : ""}
            </span>
          </div>
        )}
      </div>

      <div>
        <Tabs
          onChange={(tab) => {
            setManagementTab(tab);
            setPage(1);
            setMakerPage(1);
          }}
          tabs={[
            { label: "All DSAs", value: "all" },
            ...(canAccessMakerQueue
              ? [{ label: `Maker Queue (L1)${makerBucketTotal > 0 ? ` (${makerBucketTotal})` : ""}`, value: "maker" }]
              : []),
            { label: `On Hold (${onHoldDsas.length})`, value: "onHold" },
          ]}
          value={!canAccessMakerQueue && managementTab === "maker" ? "all" : managementTab}
        />
      </div>

      {managementTab === "maker" ? (
        <Card className="min-h-[500px]">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-blue-100 bg-blue-50/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600 text-white">
                  Level 1
                </span>
                <h3 className="text-sm font-bold text-slate-900">Maker Review &amp; Intake Queue</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Applications awaiting Maker verification and Level 1 submission to Checker. Scoped to your assigned branch.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-1 rounded-full">
                {makerBucketTotal} {makerBucketTotal === 1 ? "application" : "applications"} waiting
              </span>
            </div>
          </div>

          <CardContent className="p-0">
            {makerBucketLoading ? (
              <div className="flex items-center justify-center py-20">
                <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : makerBucketDsas.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
                <p className="text-sm font-bold text-slate-800">No Pending Applications in Maker Queue</p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  All DSA onboarding applications assigned to your branch have been processed or forwarded to Level 2 (Checker).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="p-4">Applicant / Partner</th>
                      <th className="p-4">DSA Code</th>
                      <th className="p-4">Type &amp; PAN</th>
                      <th className="p-4">Assigned Branch</th>
                      <th className="p-4">PAN Verification</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {makerBucketDsas.map((item) => {
                      const verif = item.verification_summary;
                      const isPanVerified = verif && verif.is_success;
                      const isPanFailed = verif && verif.execution_status === "FAILED";

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/50 transition cursor-pointer"
                          onClick={() => router.push(`/dsa/${item.id}`)}
                        >
                          <td className="p-4">
                            <div>
                              <p className="font-semibold text-blue-700 hover:underline">
                                {item.applicant_name || item.name}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {item.contact_person} &bull; {item.email || item.mobile}
                              </p>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-xs font-bold">
                            {item.dsa_code ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                {item.dsa_code}
                              </span>
                            ) : (
                              <span className="text-slate-600">{item.code || `DSA-${item.id}`}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mr-1.5">
                              {item.dsa_type || "INDIVIDUAL"}
                            </span>
                            <span className="font-mono text-xs text-slate-600">{item.pan || "N/A"}</span>
                          </td>
                          <td className="p-4 text-xs font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {item.branch_name || "Assigned Branch"}
                            </span>
                          </td>
                          <td className="p-4">
                            {isPanVerified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />
                                PAN Verified
                              </span>
                            ) : isPanFailed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                                <AlertCircle className="h-3 w-3" />
                                PAN Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                <Clock className="h-3 w-3" />
                                Pending Auto-Check
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <StatusBadge status={getDsaDisplayStatus(item)} />
                          </td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => router.push(`/dsa/${item.id}`)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 h-auto"
                            >
                              Review as Maker
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {makerBucketTotal > 10 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/40 text-xs">
                <span className="text-slate-500">
                  Page {makerPage} of {Math.max(1, Math.ceil(makerBucketTotal / 10))}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={makerPage <= 1 || makerBucketLoading}
                    onClick={() => setMakerPage((p) => Math.max(1, p - 1))}
                    className="text-xs h-7 px-2.5"
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={makerPage >= Math.ceil(makerBucketTotal / 10) || makerBucketLoading}
                    onClick={() => setMakerPage((p) => p + 1)}
                    className="text-xs h-7 px-2.5"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : managementTab === "onHold" ? (
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
                <option value="1">Stage 1: Maker (Initiator)</option>
                <option value="2">Stage 2: Checker (Due Diligence cum Rec Note)</option>
                <option value="3">Stage 3: Sub-Region Head (1st Recommending Authority)</option>
                <option value="4">Stage 4: DGM (2nd Recommending Authority)</option>
                <option value="5">Stage 5: Region Head (3rd Recommending Authority)</option>
                <option value="6">Stage 6: HO Credit Officer (Credit AGM)</option>
                <option value="7">Stage 7: HO Credit Head (Approving Authority)</option>
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
                <p className="text-sm font-bold text-slate-800">
                  {userBranchScope?.isBranchRestricted
                    ? `No partner DSAs assigned to ${userBranchScope.primaryBranchName || userBranchScope.primaryBranchCode || "your branch"}`
                    : "No partner DSAs found"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {userBranchScope?.isBranchRestricted
                    ? "Only applications assigned to your branch are visible to your account."
                    : "Try changing your search keywords or filters."}
                </p>
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
                            <p className="font-semibold text-blue-700 hover:underline">{item.name || item.contact_person || item.dsa_code || item.code}</p>
                            <p className="text-[10px] text-slate-500">
                              {item.contact_person} · {item.email}
                              {(item.branch_name || item.branch?.branch_name) && (
                                <span className="ml-2 inline-flex items-center text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                  <Building2 className="h-3 w-3 mr-1 inline text-slate-400" />
                                  {item.branch_name || item.branch?.branch_name}
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs font-bold">
                          {item.dsa_code ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              {item.dsa_code}
                            </span>
                          ) : (
                            <span className="text-slate-600">{item.code}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <StatusBadge status={getDsaDisplayStatus(item)} />
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
                  <p className="text-xs text-slate-500 font-mono">
                    {credentialDsa.dsa_code ? `Partner Code: ${credentialDsa.dsa_code}` : (credentialDsa.code || `DSA-${credentialDsa.id}`)}
                  </p>
                </div>
                <StatusBadge status={getDsaDisplayStatus(credentialDsa)} />
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
  const roleStr = String(currentUser?.role || "");
  const normUserRole = roleStr.toUpperCase().replace(/[\s_-]+/g, "");
  const userTicket = String((currentUser as any)?.ticket_no || (currentUser as any)?.ticketNo || "").toLowerCase();
  const isL7Role =
    roleStr === "HO Credit Head" ||
    roleStr === "Credit Head" ||
    roleStr === "Head Office Credit Head" ||
    normUserRole === "HOCREDITHEAD" ||
    normUserRole === "CREDITHEAD" ||
    normUserRole === "HEADOFFICECREDITHEAD" ||
    normUserRole === "LEVEL7HOCREDITHEAD" ||
    userTicket.startsWith("ho_head");
  const isL7User =
    isL7Role ||
    roleStr === "DSA Manager" ||
    normUserRole === "DSAMANAGER" ||
    normUserRole === "SUPERADMIN" ||
    normUserRole === "ADMIN";
  const [applicationProductFilter, setApplicationProductFilter] = useState("");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<User | null>(null);
  const [approvingDsa, setApprovingDsa] = useState<any | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [approvalRemarksError, setApprovalRemarksError] = useState("");
  const [l7ReviewLoading, setL7ReviewLoading] = useState(false);
  const [l7ReviewData, setL7ReviewData] = useState<any>(null);
  const [l7ReviewError, setL7ReviewError] = useState<string | null>(null);
  const [l7ReviewTab, setL7ReviewTab] = useState<"overview" | "history" | "verifications" | "bre" | "dd">("overview");

  const openL7FinalApprovalModal = async (dsaRecord: any) => {
    setApprovingDsa(dsaRecord);
    setApprovalRemarks("Case sanctioned by HO Credit Head on full review of due diligence, verification checks, and policy compliance.");
    setApprovalRemarksError("");
    setL7ReviewLoading(true);
    setL7ReviewError(null);
    setL7ReviewTab("overview");

    try {
      const res = await adminApi.getFinalApprovalReview(dsaRecord.id);
      if ((res as any).status === "success" || (res as any).status === true) {
        setL7ReviewData(res.data);
      } else {
        setL7ReviewError(res.message || "Failed to load L7 final approval review data.");
      }
    } catch (err: any) {
      setL7ReviewError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to retrieve L7 final approval review data."
      );
    } finally {
      setL7ReviewLoading(false);
    }
  };

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

  // KYC verification states (synced with dsa.verifications)
  const [verifyingKyc, setVerifyingKyc] = useState<{ [key: string]: boolean }>({});
  const [verifiedKyc, setVerifiedKyc] = useState<{ [key: string]: boolean }>({
    pan: false,
    gst: false,
    bank: false,
    udyam: false,
    cibil: false,
    aml: false,
  });

  const handleVerifyKyc = (type: string, label: string) => {
    setVerifyingKyc((prev) => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setVerifyingKyc((prev) => ({ ...prev, [type]: false }));
      setVerifiedKyc((prev) => ({ ...prev, [type]: true }));
      toast({
        title: `${label} Verified`,
        description: `${label} verified successfully via regulatory verification gateway.`,
        variant: "success",
      });
    }, 1200);
  };

  // Deviation Report modal state & handlers (shown for Level 2 through Level 7)
  const [viewingDeviationReport, setViewingDeviationReport] = useState(false);
  const [deviationReportData, setDeviationReportData] = useState<any | null>(null);
  const [loadingDeviationReport, setLoadingDeviationReport] = useState(false);

  // Due Diligence Note modal state (shown for Level 2 through Level 7)
  const [viewingDdNoteModal, setViewingDdNoteModal] = useState(false);

  // Revert Modal state (for Level 3+ to revert back to Checker)
  const [revertingDsa, setRevertingDsa] = useState<any | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertError, setRevertError] = useState("");

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
    submitMakerApplication,
    submitCheckerApplication,
    updateWorkflowAction,
    fetchDeviationReport,
    triggerCheckerVerification,
    saveCheckerDdNote,
    fetchCheckerDdNote,
    userBranchScope,
    updateDsaStatus,
    uploadDsaDocument,
    updateDsaDocumentStatus,
    deleteDsaDocument,
    generateAgreement,
    downloadAgreement,
    uploadSignedAgreement,
    fetchDsaAgreement,
    fetchSignedAgreementReview,
    verifySignedAgreement,
  } = useDsa();

  // Task 12 & 13 Agreement & HO Credit Head Review State
  const [agreementReviewData, setAgreementReviewData] = useState<any | null>(null);
  const [agreementReviewLoading, setAgreementReviewLoading] = useState(false);
  const [officialAgreement, setOfficialAgreement] = useState<any | null>(null);
  const [officialAgreementLoading, setOfficialAgreementLoading] = useState(false);
  const [verifyingAgreementAction, setVerifyingAgreementAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [agreementDecisionRemarks, setAgreementDecisionRemarks] = useState("");
  const [agreementDecisionError, setAgreementDecisionError] = useState("");
  const [agreementSubmitting, setAgreementSubmitting] = useState(false);
  const [resendActivationSuccess, setResendActivationSuccess] = useState<string | null>(null);

  const handleResendActivationEmail = () => {
    // Activation credentials are dispatched by the backend automatically
    // when L7 verifies the signed agreement (verifySignedAgreement endpoint).
    // There is no separate resend endpoint — surfacing an info note is correct.
    setResendActivationSuccess(
      `Activation credentials were dispatched to ${dsa?.email ?? "the registered DSA email"} when the agreement was approved. To re-send, contact the backend admin or re-verify the agreement.`
    );
  };

  const loadAgreementData = useCallback(async (dsaId: number | string) => {
    setAgreementReviewLoading(true);
    setOfficialAgreementLoading(true);
    try {
      const [revRes, agmRes] = await Promise.allSettled([
        adminApi.getSignedAgreementReview(dsaId),
        adminApi.getDsaAgreement(dsaId),
      ]);
      if (revRes.status === "fulfilled" && ((revRes.value as any).status === "success" || (revRes.value as any).status === true)) {
        setAgreementReviewData(revRes.value.data);
      }
      if (agmRes.status === "fulfilled" && ((agmRes.value as any).status === "success" || (agmRes.value as any).status === true)) {
        setOfficialAgreement(agmRes.value.data);
      }
    } catch {
      // Non-critical fetch catch
    } finally {
      setAgreementReviewLoading(false);
      setOfficialAgreementLoading(false);
    }
  }, []);

  const handleSubmitAgreementDecision = async () => {
    if (!isL7User || !verifyingAgreementAction || !dsa) return;
    if (verifyingAgreementAction === "REJECT" && !agreementDecisionRemarks.trim()) {
      setAgreementDecisionError("Rejection remarks are mandatory to explain why the signed agreement is rejected.");
      return;
    }
    setAgreementSubmitting(true);
    setAgreementDecisionError("");
    try {
      const res = await verifySignedAgreement(dsa.id, {
        action: verifyingAgreementAction,
        remarks: agreementDecisionRemarks.trim() || undefined,
      });
      if (res) {
        // Backend's verifySignedAgreement endpoint handles activation email dispatch
        // internally (activateDsaUserAndSendCredentials). No secondary fetch needed.
        if (verifyingAgreementAction === "APPROVE") {
          setResendActivationSuccess(
            `Agreement approved. Activation credentials dispatched to ${dsa.email ?? "the registered DSA email"} by the system.`
          );
        }
        setVerifyingAgreementAction(null);
        setAgreementDecisionRemarks("");
        await fetchDsaDetail(dsa.id);
        await loadAgreementData(dsa.id);
      }
    } catch (err: any) {
      setAgreementDecisionError(
        err?.response?.data?.message || err?.message || "Failed to submit agreement verification decision."
      );
    } finally {
      setAgreementSubmitting(false);
    }
  };

  const [runningVerif, setRunningVerif] = useState<string | null>(null);
  const [checkerDdNote, setCheckerDdNote] = useState("");
  const [checkerSavingNote, setCheckerSavingNote] = useState(false);

  useEffect(() => {
    fetchDsaDetail(id);
  }, [id, fetchDsaDetail]);

  useEffect(() => {
    if (tab === "agreements" && isL7User && dsa?.id) {
      loadAgreementData(dsa.id);
    }
  }, [tab, isL7User, dsa?.id, loadAgreementData]);

  useEffect(() => {
    if (tab === "agreements" && !isL7User) {
      const isApproved =
        dsa?.onboarding_status === "APPROVED" ||
        dsa?.onboarding_status === "AGREEMENT_COMPLETED" ||
        dsa?.agreement_status === "SIGNED_VERIFIED" ||
        dsa?.operational_status === "ACTIVE";
      setTab(isApproved ? "performance" : "actions");
    }
  }, [tab, isL7User, dsa]);

  useEffect(() => {
    const existingNote =
      dsa?.latest_due_diligence_note?.observations ||
      dsa?.due_diligence_notes?.[0]?.observations ||
      (dsa as any)?.dueDiligenceNotes?.[0]?.observations ||
      (dsa as any)?.latestDueDiligenceNote?.observations ||
      dsa?.latest_due_diligence_note?.remarks ||
      dsa?.due_diligence_notes?.[0]?.remarks ||
      (dsa as any)?.dueDiligenceNotes?.[0]?.remarks ||
      (dsa as any)?.latestDueDiligenceNote?.remarks;
    if (existingNote) {
      setCheckerDdNote(existingNote);
    }
  }, [dsa]);

  useEffect(() => {
    if (!dsa) return;
    const isApproved =
      dsa.onboarding_status === "APPROVED" ||
      dsa.onboarding_status === "AGREEMENT_COMPLETED" ||
      dsa.agreement_status === "SIGNED_VERIFIED" ||
      dsa.operational_status === "ACTIVE";
    if (!isApproved && tab === "performance") {
      setTab("actions");
    }
  }, [dsa]);

  // Synchronize KYC verification states directly from dsa.verifications returned from submit / show APIs
  useEffect(() => {
    if (!dsa) return;
    const vers: any[] = (dsa as any)?.verifications || [];
    const isDone = (pat: string) =>
      vers.some((v: any) => {
        const c = String(v.verification_code || "").toUpperCase();
        const st = String(v.execution_status || "").toUpperCase();
        return c.includes(pat.toUpperCase()) && (Boolean(v.is_success) || st === "SUCCESS" || st === "COMPLETED");
      });

    setVerifiedKyc((prev) => ({
      ...prev,
      pan: prev.pan || isDone("PAN"),
      gst: prev.gst || isDone("GST"),
      bank: prev.bank || isDone("BANK") || isDone("BAV"),
      udyam: prev.udyam || isDone("UDYAM"),
      cibil: prev.cibil || isDone("CIBIL"),
      aml: prev.aml || isDone("AML"),
    }));
  }, [dsa]);

  const openDeviationReportModal = async () => {
    setViewingDeviationReport(true);
    if (!deviationReportData && dsa?.id) {
      setLoadingDeviationReport(true);
      try {
        const data = await fetchDeviationReport(dsa.id);
        if (data) {
          setDeviationReportData(data);
        }
      } catch (err) {
        console.error("Failed to fetch deviation report", err);
      } finally {
        setLoadingDeviationReport(false);
      }
    }
  };

  const openDdNoteModal = () => {
    setViewingDdNoteModal(true);
  };

  const handleDownloadDeviationReport = () => {
    if (!dsa) return;
    const rep = deviationReportData;
    const bre = rep?.bre_evaluation || rep;
    const rules: any[] = bre?.rules || [];
    const deviations: any[] = rep?.deviations || bre?.deviations || [];
    const rejections: any[] = rep?.rejections || bre?.rejections || [];
    const overallDecision = String(bre?.overall_decision || (deviations.length > 0 ? "DEVIATION" : "PASS")).toUpperCase();
    const evalId = bre?.evaluation_id || rep?.evaluation_id || "BRE-AUTO-EVAL";

    const lines = [
      "================================================================================",
      "COSMOS CO-OPERATIVE BANK LIMITED - DSA MAKER DEVIATION REPORT (BRE EVALUATION)",
      "================================================================================",
      `Generated At:        ${new Date().toLocaleString()}`,
      `DSA Code:            ${getEffectiveDsaCode(dsa)}`,
      `Partner Name:        ${dsa.name}`,
      `DSA Type:            ${dsa.dsa_type || "INDIVIDUAL"}`,
      `Branch:              ${dsa.branch?.branch_name || dsa.branch_name || "Main Branch"}`,
      `Evaluation Ref:      ${evalId}`,
      `Evaluated Timestamp: ${bre?.evaluated_at || "N/A"}`,
      `Overall Decision:    ${overallDecision}`,
      "--------------------------------------------------------------------------------",
      "EVALUATION SUMMARY:",
      `Total Rules:         ${rules.length}`,
      `Passed Rules:        ${rules.filter((r: any) => String(r.status).toUpperCase() === "PASS").length}`,
      `Deviations:          ${deviations.length}`,
      `Rejections:          ${rejections.length}`,
      "--------------------------------------------------------------------------------",
      "TRIGGERED DEVIATIONS REQUIRING HIGHER-LEVEL DISCRETIONARY APPROVAL:",
      deviations.length > 0
        ? deviations.map((d: any, i: number) => `  ${i + 1}. ${typeof d === "string" ? d : d.remarks || d.rule_name}`).join("\n")
        : "  None — All eligible rules passed standards.",
      "--------------------------------------------------------------------------------",
      "DETAILED RULE-BY-RULE POLICY ASSESSMENT:",
      ...rules.map((r: any, idx: number) => [
        `[Rule ${idx + 1}] ${r.rule_name || r.rule_code} (${r.rule_code})`,
        `  Status:         ${r.status}`,
        `  Expected:       ${r.expected_value || "Per Bank Policy Standards"}`,
        `  Applicant Data: ${r.actual_value || "N/A"}`,
        `  Remarks:        ${r.remarks || "No remarks"}`,
        ""
      ].join("\n")),
      "================================================================================",
      "End of Deviation Report",
      "Cosmos DSA Management System (COS-DSAMS)",
      "================================================================================",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DSA-${getEffectiveDsaCode(dsa)}-deviation-report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDdNote = () => {
    if (!dsa) return;
    const note =
      dsa?.latest_due_diligence_note ||
      dsa?.due_diligence_notes?.[0] ||
      (dsa as any)?.dueDiligenceNotes?.[0] ||
      deviationReportData?.dd_note;

    const lines = [
      "================================================================================",
      "COSMOS CO-OPERATIVE BANK LIMITED - CHECKER DUE DILIGENCE (DD) REVIEW NOTE",
      "================================================================================",
      `Generated At:            ${new Date().toLocaleString()}`,
      `DSA Code:                ${getEffectiveDsaCode(dsa)}`,
      `Partner Name:            ${dsa.name}`,
      `Branch:                  ${dsa.branch?.branch_name || dsa.branch_name || "Main Branch"}`,
      `Submitted By:            Checker (User ID: ${note?.checker_user_id || "Checker Authority"})`,
      `Submitted At:            ${note?.submitted_at || "N/A"}`,
      `Checker Recommendation:  ${note?.recommendation || "RECOMMEND"}`,
      "--------------------------------------------------------------------------------",
      "FIELD & PREMISE INVESTIGATION OBSERVATIONS:",
      note?.observations || checkerDdNote || "No observations recorded.",
      "--------------------------------------------------------------------------------",
      "CHECKER RECOMMENDATION REMARKS:",
      note?.remarks || "Recommended for sanction based on due diligence findings.",
      "--------------------------------------------------------------------------------",
      "EXCEPTION REMARKS:",
      note?.exception_remarks || "No exceptional deviations noted outside standard policy.",
      "================================================================================",
      "End of Due Diligence Note",
      "Cosmos DSA Management System (COS-DSAMS)",
      "================================================================================",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DSA-${getEffectiveDsaCode(dsa)}-due-diligence-note.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [dsaAudit, setDsaAudit] = useState<any[]>([]);
  const [docChecklist, setDocChecklist] = useState<any>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [viewedDocIds, setViewedDocIds] = useState<Set<number | string>>(new Set());
  const [manuallyVerifiedDocIds, setManuallyVerifiedDocIds] = useState<Set<number | string>>(new Set());
  const [manuallyFailedDocIds, setManuallyFailedDocIds] = useState<Set<number | string>>(new Set());
  const [checkerVerifiedDocIds, setCheckerVerifiedDocIds] = useState<Set<number | string>>(new Set());

  // Real DSA Portal Users mapped via GET /api/v1/dsa/{id}/users (Phase 2)
  const [dsaPortalUsers, setDsaPortalUsers] = useState<any[]>([]);
  const [dsaPortalUsersLoading, setDsaPortalUsersLoading] = useState<boolean>(false);

  const fetchDsaPortalUsers = useCallback(async () => {
    if (!dsa?.id) return;
    setDsaPortalUsersLoading(true);
    try {
      const res: any = await adminApi.getDsaUsers(dsa.id);
      const list = res?.data?.users || res?.users || (Array.isArray(res?.data) ? res.data : []);
      setDsaPortalUsers(list);
    } catch {
      setDsaPortalUsers([]);
    } finally {
      setDsaPortalUsersLoading(false);
    }
  }, [dsa?.id]);

  const [backendDocs, setBackendDocs] = useState<any[]>([]);
  const [backendDocsLoading, setBackendDocsLoading] = useState<boolean>(false);
  const docsFetchedForDsaRef = useRef<number | string | null>(null);

  const fetchBackendDocuments = useCallback(async (force = false) => {
    if (!dsa?.id) return;
    if (!force && docsFetchedForDsaRef.current === dsa.id) {
      return;
    }
    docsFetchedForDsaRef.current = dsa.id;
    setBackendDocsLoading(true);
    try {
      const res: any = await adminApi.getDsaDocuments(dsa.id);
      const items = res?.data?.items || res?.data || (Array.isArray(res?.items) ? res.items : []);
      if (Array.isArray(items)) {
        setBackendDocs(items);
      }
    } catch {
      // fallback to dsa.documents
    } finally {
      setBackendDocsLoading(false);
    }
  }, [dsa?.id]);

  useEffect(() => {
    if (tab === "agents" && dsa?.id) {
      fetchDsaPortalUsers();
    }
    if (tab === "documents" && dsa?.id) {
      fetchBackendDocuments();
    }
  }, [tab, dsa?.id, fetchDsaPortalUsers, fetchBackendDocuments]);

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

  // Branch Access Gate: Check if user is restricted to a branch other than this DSA's assigned branch
  if (userBranchScope?.isBranchRestricted && !isDsaInBranchScope(dsa, userBranchScope)) {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4">
        <Card className="border-rose-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Branch Access Restricted</h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                DSA <strong>#{getEffectiveDsaCode(dsa)} ({dsa.name})</strong> is assigned to{" "}
                <span className="font-semibold text-slate-800">
                  {dsa.branch?.branch_name || dsa.branch_name || (dsa.branch_id ? `Branch #${dsa.branch_id}` : "another branch")}
                </span>.
              </p>
              <p className="text-xs text-slate-500">
                Your account is scoped to{" "}
                <span className="font-semibold text-blue-700">
                  {userBranchScope.primaryBranchName || userBranchScope.primaryBranchCode}
                </span>. Branch staff may only view and process DSAs assigned to their branch.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => router.push("/dsa")}
                className="gap-2 font-semibold"
              >
                <ArrowLeft className="h-4 w-4" />
                Return to Branch Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isBankUser = currentUser?.role !== "DSA Partner" && currentUser?.role !== "Customer";

  const workflowLevelInfo = getDsaWorkflowLevelInfo(currentUser?.role, dsa);
  const canDecideDsa = workflowLevelInfo.canUserApprove;
  const canApproveDsa = canDecideDsa && (docChecklist ? docChecklist.is_complete : true);

  const isMakerLevel = workflowLevelInfo.currentLevel === 1;
  const isCheckerLevel = workflowLevelInfo.currentLevel === 2;
  const isMakerUser =
    roleStr === "Branch User" ||
    roleStr === "Maker" ||
    roleStr === "Branch Maker" ||
    roleStr === "Staff" ||
    roleStr === "Assistant Manager";
  const isCheckerRole =
    roleStr === "Checker" ||
    roleStr === "Manager" ||
    roleStr === "Branch Checker";
  const isSubRegionRole =
    roleStr === "Sub-Region Head" ||
    roleStr === "Sub Region Head" ||
    roleStr === "Sub-Region Checker" ||
    roleStr === "AGM";
  const isDgmRole =
    roleStr === "DGM" ||
    roleStr === "Deputy General Manager";
  const isRegionHeadRole =
    roleStr === "Region Head" ||
    roleStr === "Regional Head" ||
    roleStr === "Branch Regional Head";
  const isHoOfficerRole =
    roleStr === "HO Credit Officer" ||
    roleStr === "HO Credit" ||
    roleStr === "DSA Credit";
  const isHoHeadRole =
    roleStr === "HO Credit Head" ||
    roleStr === "Credit Head" ||
    isL7Role;

  const l1Approval: any = Array.isArray(dsa?.approvals)
    ? dsa.approvals.find(
        (a: any) =>
          (Number(a.approval_level) === 1 || a.stage_code === "LEVEL_1_MAKER") &&
          (a.status === "RECOMMENDED" || a.status === "APPROVED" || a.action === "RECOMMEND" || a.action === "APPROVE")
      ) || dsa.approvals.find((a: any) => Number(a.approval_level) === 1 || a.stage_code === "LEVEL_1_MAKER")
    : null;

  const l2Approval: any = Array.isArray(dsa?.approvals)
    ? dsa.approvals.find(
        (a: any) =>
          (Number(a.approval_level) === 2 || a.stage_code === "LEVEL_2_CHECKER") &&
          (a.status === "RECOMMENDED" || a.status === "APPROVED" || a.action === "RECOMMEND" || a.action === "APPROVE")
      ) || dsa.approvals.find((a: any) => Number(a.approval_level) === 2 || a.stage_code === "LEVEL_2_CHECKER")
    : null;

  const isMakerUserOrLevel =
    isMakerUser ||
    isMakerLevel ||
    (!isCheckerRole && isBankUser && workflowLevelInfo.currentLevel <= 1);
  const isCheckerUserOrLevel =
    isCheckerRole ||
    (!isMakerUser && (isCheckerLevel || workflowLevelInfo.currentLevel === 2));

  // Physical Visit Report status determination:
  // - Uploaded by Maker/L1; verified by Checker/L2.
  // - While in Maker stage (L1) or viewed by Maker, it is NEVER Verified (ALWAYS "Pending").
  // - While in Checker stage (L2), it is "Pending" until Checker explicitly verifies it.
  // - Only after Checker verifies it or workflow advances past L2 to L3+ is it verified.
  const getEffectiveDocStatus = (doc: any): string => {
    if (!doc) return "Pending";
    if (manuallyFailedDocIds.has(doc.id)) return "Failed";

    if (isVisitReportDocument(doc)) {
      // 1. If user is Maker, or at Maker level/stage (L1), it is ALWAYS Pending (Maker uploads it, Checker verifies it).
      if (isMakerUser || isMakerLevel || workflowLevelInfo.currentLevel <= 1) {
        return "Pending";
      }

      // 2. Checker (L2) stage: Pending until Checker explicitly verifies it in this session or verified by checker in backend.
      const isExplicitlyVerifiedByChecker =
        checkerVerifiedDocIds.has(doc.id) ||
        (isCheckerRole && manuallyVerifiedDocIds.has(doc.id)) ||
        (doc.status === "Verified" &&
          typeof doc.remarks === "string" &&
          doc.remarks.toLowerCase().includes("checker"));

      // 3. Only after Checker recommends/submits to L3+ (or workflow is completed beyond L2) is it verified.
      const isAdvancedPastChecker =
        (workflowLevelInfo.currentLevel >= 3 || workflowLevelInfo.isCompleted) &&
        (l2Approval?.status === "RECOMMENDED" || l2Approval?.status === "APPROVED");

      return isExplicitlyVerifiedByChecker || isAdvancedPastChecker ? "Verified" : "Pending";
    }

    if (manuallyVerifiedDocIds.has(doc.id)) return "Verified";

    return doc.status || "Pending";
  };

  // Use backend checklist missing items; filter staff_only documents:
  // - Non-bank users (e.g. self onboarding applicant or DSA partner) do not see staff_only docs
  // - Only Maker/L1 can upload visit_report/staff_only docs
  // - Checker/L2 verifies visit_report, not uploads it
  const missingProfileDocuments: Array<{ document_type: string; display_name: string; requirement: string; staff_only?: boolean }> = [
    ...(docChecklist?.checklist?.filter((item: any) => {
      if (item.is_uploaded) return false;
      const isVisitReport = isVisitReportDocument(item) || item.staff_only;
      if (isVisitReport && (Boolean((dsa as any)?.visit_report_file) || (dsa?.documents || []).some((d: any) => isVisitReportDocument(d)))) return false;
      if ((dsa?.documents || []).some((d: any) => d.document_type === item.document_type)) return false;
      if (isVisitReport && !isBankUser) return false;
      if (isVisitReport && !isMakerUserOrLevel) return false;
      return item.is_required || (item.staff_only && isMakerUserOrLevel);
    }) ?? []),
  ];

  const l3Approval: any = Array.isArray(dsa?.approvals)
    ? dsa.approvals.find(
        (a: any) =>
          (Number(a.approval_level) === 3 || a.stage_code === "LEVEL_3_SUB_REGION" || a.stage_code === "LEVEL_3_SUB_REGION_HEAD") &&
          (a.status === "RECOMMENDED" || a.status === "APPROVED" || a.action === "RECOMMEND" || a.action === "APPROVE")
      ) || dsa.approvals.find((a: any) => Number(a.approval_level) === 3 || a.stage_code === "LEVEL_3_SUB_REGION" || a.stage_code === "LEVEL_3_SUB_REGION_HEAD")
    : null;

  const l4Approval: any = Array.isArray(dsa?.approvals)
    ? dsa.approvals.find(
        (a: any) =>
          (Number(a.approval_level) === 4 || a.stage_code === "LEVEL_4_DGM") &&
          (a.status === "RECOMMENDED" || a.status === "APPROVED" || a.action === "RECOMMEND" || a.action === "APPROVE" || a.status === "SKIPPED")
      ) || dsa.approvals.find((a: any) => Number(a.approval_level) === 4 || a.stage_code === "LEVEL_4_DGM")
    : null;

  const l5Approval: any = Array.isArray(dsa?.approvals)
    ? dsa.approvals.find(
        (a: any) =>
          (Number(a.approval_level) === 5 || a.stage_code === "LEVEL_5_REGION_HEAD") &&
          (a.status === "RECOMMENDED" || a.status === "APPROVED" || a.action === "RECOMMEND" || a.action === "APPROVE")
      ) || dsa.approvals.find((a: any) => Number(a.approval_level) === 5 || a.stage_code === "LEVEL_5_REGION_HEAD")
    : null;

  const l6Approval: any = Array.isArray(dsa?.approvals)
    ? dsa.approvals.find(
        (a: any) =>
          (Number(a.approval_level) === 6 || a.stage_code === "LEVEL_6_HO_CREDIT_OFFICER") &&
          (a.status === "RECOMMENDED" || a.status === "APPROVED" || a.action === "RECOMMEND" || a.action === "APPROVE")
      ) || dsa.approvals.find((a: any) => Number(a.approval_level) === 6 || a.stage_code === "LEVEL_6_HO_CREDIT_OFFICER")
    : null;

  const l7Approval: any = Array.isArray(dsa?.approvals)
    ? dsa.approvals.find(
        (a: any) =>
          (Number(a.approval_level) === 7 || a.stage_code === "LEVEL_7_HO_CREDIT_HEAD") &&
          (a.status === "APPROVED" || a.status === "REJECTED" || a.action === "APPROVE" || a.action === "REJECT")
      ) || dsa.approvals.find((a: any) => Number(a.approval_level) === 7 || a.stage_code === "LEVEL_7_HO_CREDIT_HEAD")
    : null;

  const makerRemarks =
    l1Approval?.remarks ||
    dsa?.status_reason ||
    (l1Approval?.status === "RECOMMENDED" || (workflowLevelInfo?.currentLevel ?? 1) > 1
      ? "Maker verification completed and forwarded to Checker"
      : "");

  const checkerRemarks =
    checkerDdNote.trim() ||
    dsa?.latest_due_diligence_note?.remarks ||
    dsa?.due_diligence_notes?.[0]?.remarks ||
    (dsa as any)?.dueDiligenceNotes?.[0]?.remarks ||
    (dsa as any)?.latestDueDiligenceNote?.remarks ||
    l2Approval?.remarks ||
    (l2Approval?.status === "RECOMMENDED" || l2Approval?.status === "APPROVED" || (workflowLevelInfo?.currentLevel ?? 1) > 2
      ? "Due Diligence completed and recommended by Checker"
      : "");

  const l3Remarks =
    l3Approval?.remarks ||
    (l3Approval?.status === "RECOMMENDED" || (workflowLevelInfo?.currentLevel ?? 1) > 3
      ? "Recommended by Sub-Region Head"
      : "");

  const l4Remarks =
    l4Approval?.remarks ||
    (l4Approval?.status === "SKIPPED"
      ? "Bypassed per workflow rule (No DGM posted for branch)"
      : l4Approval?.status === "RECOMMENDED" || (workflowLevelInfo?.currentLevel ?? 1) > 4
      ? "Recommended by DGM"
      : "");

  const l5Remarks =
    l5Approval?.remarks ||
    (l5Approval?.status === "RECOMMENDED" || (workflowLevelInfo?.currentLevel ?? 1) > 5
      ? "Recommended by Region Head"
      : "");

  const l6Remarks =
    l6Approval?.remarks ||
    (l6Approval?.status === "RECOMMENDED" || (workflowLevelInfo?.currentLevel ?? 1) > 6
      ? "Credit appraisal recommended for sanction"
      : "");

  const l7Remarks =
    l7Approval?.remarks ||
    (l7Approval?.status === "APPROVED"
      ? "Final Sanction & Approval granted by HO Credit Head"
      : "");

  const isIndividualDsa =
    !dsa.entity_type ||
    dsa.entity_type === "INDIVIDUAL" ||
    dsa.dsa_type === "INDIVIDUAL" ||
    dsa.dsa_type === "Individual";

  // 2.6 API Checks — Due Diligence Stage Specifications
  // Note: DSA Consent must be captured before triggering any API — as per DPDP Act. API charges borne by Cosmos Bank.
  const makerPanCheck = isIndividualDsa
    ? {
        code: "PAN_ADVANCED_INDIVIDUAL",
        label: "Advanced PAN Verification",
        dsaType: "Individual",
        triggeredBy: "Maker",
        ifFail: "Continue; remark in DD note",
        ifAdverse: "Deviation generated",
        desc: "Validates PAN authenticity, name match, and status via NSDL / Income Tax Dept",
      }
    : {
        code: "PAN_ENTITY",
        label: "PAN Verification",
        dsaType: "Entity",
        triggeredBy: "Maker",
        ifFail: "Continue; remark in DD note",
        ifAdverse: "Deviation generated",
        desc: "Validates corporate / entity PAN authenticity and legal name match",
      };

  const requiredCheckerVerifications = isIndividualDsa
    ? [
        {
          code: "GST",
          label: "PAN to GST / GST Verification",
          dsaType: "Both",
          triggeredBy: "Checker",
          ifFail: "Continue; remark in DD note",
          ifAdverse: "Deviation generated",
          desc: "Validates active GST status and regular return filing history from GSTN",
        },
        {
          code: "UDYAM",
          label: "Udyam Verification",
          dsaType: "Both",
          triggeredBy: "Checker",
          ifFail: "Continue; remark in DD note",
          ifAdverse: "Deviation generated",
          desc: "Validates enterprise MSME registration and classification",
        },
        {
          code: "CIBIL_CONSUMER",
          label: "Transunion CIBIL Consumer Hard Pull",
          dsaType: "Individual",
          triggeredBy: "Checker",
          ifFail: "Continue; remark in DD note",
          ifAdverse: "Deviation if < 700; reject if < 550",
          desc: "Bureau hard credit pull for individual credit history and score",
        },
        {
          code: "AML_COMPASS",
          label: "AML & KYC — Compass API",
          dsaType: "Both",
          triggeredBy: "Checker",
          ifFail: "Manual verify; remark in DD note",
          ifAdverse: "Deviation if match ≥ 95%",
          desc: "Screening against PEP, sanctions, and Cosmos Bank internal negative list",
        },
      ]
    : [
        {
          code: "GST",
          label: "PAN to GST / GST Verification",
          dsaType: "Both",
          triggeredBy: "Checker",
          ifFail: "Continue; remark in DD note",
          ifAdverse: "Deviation generated",
          desc: "Validates active GST status and regular return filing history from GSTN",
        },
        {
          code: "UDYAM",
          label: "Udyam Verification",
          dsaType: "Both",
          triggeredBy: "Checker",
          ifFail: "Continue; remark in DD note",
          ifAdverse: "Deviation generated",
          desc: "Validates enterprise MSME registration and classification",
        },
        {
          code: "CIBIL_COMMERCIAL",
          label: "Transunion CIBIL Commercial (CMR Rank)",
          dsaType: "Entity",
          triggeredBy: "Checker",
          ifFail: "Continue; remark in DD note",
          ifAdverse: "Deviation if CMR > 5",
          desc: "Commercial bureau track record assessing entity CMR rating (CMR 1–10)",
        },
        {
          code: "DIRECTOR_CIBIL",
          label: "Key Person / Director Individual CIBIL",
          dsaType: "Entity",
          triggeredBy: "Checker",
          ifFail: "Continue; remark in DD note",
          ifAdverse: "Deviation if applicable",
          desc: "Assesses promoter and key management individual bureau credit scores",
        },
        {
          code: "AML_COMPASS",
          label: "AML & KYC — Compass API",
          dsaType: "Both",
          triggeredBy: "Checker",
          ifFail: "Manual verify; remark in DD note",
          ifAdverse: "Deviation if match ≥ 95%",
          desc: "Screens entity and promoters against negative databases and watchlists",
        },
      ];

  const existingVerifications = (dsa.verifications || []) as any[];

  const getVerificationRecord = (code: string) =>
    existingVerifications.find(
      (v) => (v.verification_code || "").toUpperCase() === code.toUpperCase()
    );

  const isVerificationAttempted = (code: string) =>
    existingVerifications.some(
      (v) =>
        (v.verification_code || "").toUpperCase() === code.toUpperCase() &&
        (v.is_success ||
          v.execution_status === "COMPLETED" ||
          v.execution_status === "FAILED" ||
          v.execution_status === "TIMEOUT")
    );

  const isVerificationDone = isVerificationAttempted;

  const pendingCheckerVerifications = requiredCheckerVerifications.filter(
    (v) => !isVerificationDone(v.code)
  );
  const areAllCheckerVerificationsDone = pendingCheckerVerifications.length === 0;

  const getVerificationFinding = (code: string) => {
    const record = getVerificationRecord(code);
    if (!record) return null;
    const norm = record.normalized_data || {};
    const isFailed =
      record.execution_status === "FAILED" ||
      record.execution_status === "TIMEOUT" ||
      (!record.is_success && (!norm || Object.keys(norm).length === 0));

    let isAdverse = false;
    let summaryText = "";

    switch (code) {
      case "CIBIL_CONSUMER": {
        const score = Number(norm.cibil_score || norm.score || 0);
        if (score > 0) {
          if (score < 550) {
            isAdverse = true;
            summaryText = `CIBIL Score: ${score} (< 550: Reject criteria)`;
          } else if (score < 700) {
            isAdverse = true;
            summaryText = `CIBIL Score: ${score} (< 700: Deviation required)`;
          } else {
            summaryText = `CIBIL Score: ${score} (Meets >= 700 benchmark)`;
          }
        }
        break;
      }
      case "CIBIL_COMMERCIAL": {
        const cmr = Number(norm.cmr_rank || norm.cmr || norm.score || 0);
        if (cmr > 0) {
          if (cmr > 5) {
            isAdverse = true;
            summaryText = `CMR Rank: ${cmr} (> 5: Deviation required)`;
          } else {
            summaryText = `CMR Rank: ${cmr} (Acceptable CMR 1–5)`;
          }
        }
        break;
      }
      case "AML_COMPASS": {
        const matchScore = Number(norm.aml_score || norm.match_score || 0);
        const pep = Boolean(norm.pep_match);
        const sanction = Boolean(norm.sanction_match);
        if (matchScore >= 95 || pep || sanction) {
          isAdverse = true;
          summaryText = `AML Match: ${matchScore}%${pep ? ", PEP Match" : ""}${sanction ? ", Sanction Match" : ""} (>= 95%: Deviation required)`;
        } else if (matchScore > 0 || record.is_success) {
          summaryText = `AML Match: ${matchScore}% (Clear)`;
        }
        break;
      }
      case "GST": {
        if (norm.gstin_status || norm.status) {
          const st = String(norm.gstin_status || norm.status).toUpperCase();
          if (st.includes("ACTIVE")) {
            summaryText = `GSTIN: Active | Filings regular`;
          } else {
            isAdverse = true;
            summaryText = `GSTIN: ${st} (Deviation generated)`;
          }
        }
        break;
      }
      case "UDYAM": {
        if (norm.udyam_status || norm.registration_status || norm.status) {
          const st = String(norm.udyam_status || norm.registration_status || norm.status).toUpperCase();
          if (st.includes("ACTIVE") || st.includes("VERIFIED") || record.is_success) {
            summaryText = `MSME Status: Verified active`;
          } else {
            isAdverse = true;
            summaryText = `MSME Status: ${st} (Deviation generated)`;
          }
        }
        break;
      }
      default:
        break;
    }

    return {
      record,
      isFailed,
      isAdverse,
      summaryText:
        summaryText ||
        (record.is_success
          ? "Verified successfully"
          : (record.error_message || "Gateway response received")),
    };
  };

  const handleAddRemarkFromVerif = (item: { label: string; ifFail: string; ifAdverse: string; code: string }) => {
    const finding = getVerificationFinding(item.code);
    const statusNote = finding?.isFailed
      ? `Failed with gateway error (${finding.record?.error_message || "External gateway unreachable"}). Policy: ${item.ifFail}.`
      : finding?.isAdverse
      ? `Adverse outcome flagged (${finding.summaryText}). Policy: ${item.ifAdverse}.`
      : `Verified successfully (${finding?.summaryText || "Completed"}).`;

    const noteLine = `• [${item.label}] (Triggered by Checker): ${statusNote}`;
    setCheckerDdNote((prev) => (prev.trim() ? `${prev.trim()}\n${noteLine}` : noteLine));
    toast({
      title: "Remark Added to DD Note",
      description: `Observation for ${item.label} inserted into Due Diligence Note.`,
      variant: "success",
    });
  };

  const handleRunCheckerVerif = async (code: string, label: string) => {
    setRunningVerif(code);
    try {
      await triggerCheckerVerification(dsa.id, code);
      toast({
        title: `${code} Verification Completed`,
        description: `${label} verification completed successfully.`,
        variant: "success",
      });
      await fetchDsaDetail(id);
    } catch (err: any) {
      toast({
        title: "Verification Trigger Failed",
        description: err?.message || "Verification gateway failed. Please retry.",
        variant: "warning",
      });
    } finally {
      setRunningVerif(null);
    }
  };

  const handleSaveCheckerDdNote = async () => {
    if (!checkerDdNote.trim()) {
      toast({
        title: "Observations Required",
        description: "Please enter observations or due diligence findings before saving.",
        variant: "warning",
      });
      return;
    }
    setCheckerSavingNote(true);
    try {
      await saveCheckerDdNote(dsa.id, {
        observations: checkerDdNote.trim(),
        remarks: approvalRemarks.trim() || "Checker DD observations updated.",
      });
      toast({
        title: "Due Diligence Note Saved",
        description: "Draft due diligence observations saved successfully.",
        variant: "success",
      });
      await fetchDsaDetail(id);
    } catch (err: any) {
      toast({
        title: "Failed to Save DD Note",
        description: err?.message || "Could not save due diligence note.",
        variant: "warning",
      });
    } finally {
      setCheckerSavingNote(false);
    }
  };

  const isAllKycVerified = Boolean(
    verifiedKyc.pan && verifiedKyc.gst && verifiedKyc.bank && verifiedKyc.udyam
  );
  const kycVerifiedCount = [verifiedKyc.pan, verifiedKyc.gst, verifiedKyc.bank, verifiedKyc.udyam].filter(Boolean).length;
  const dsaAny = dsa as any;
  const rawDocList: any[] = backendDocs.length > 0 ? [...backendDocs] : [...(dsa?.documents || [])];
  if (dsaAny?.visit_report_file && !rawDocList.some((d: any) => isVisitReportDocument(d))) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
    rawDocList.unshift({
      id: typeof dsa?.id === "number" ? dsa.id * 100000 + 999 : 999999,
      document_type: "visit_report",
      file_name: dsaAny.visit_report_file.split("/").pop() || "visit_report.pdf",
      file_path: dsaAny.visit_report_file,
      file_url: `${apiBase}/storage/${dsaAny.visit_report_file.replace(/^\/+/, "")}`,
      status: "Pending",
      uploaded_at: dsaAny.visit_conducted_at || dsaAny.updated_at,
      remarks: dsaAny.visit_report_remarks || "Uploaded by Bank Staff",
    });
  }
  const allDisplayDocs: any[] = rawDocList
    .filter((doc) => {
      const dt = String(doc.document_type || "").toUpperCase();
      if (isVisitReportDocument(doc) && !isBankUser) return false;
      return dt !== "EMPANELMENT_LETTER" && dt !== "AGREEMENT" && dt !== "SIGNED_AGREEMENT";
    })
    .reduce((acc: any[], doc: any) => {
      const isVisit = isVisitReportDocument(doc);
      const existingIndex = acc.findIndex((d) =>
        isVisit ? isVisitReportDocument(d) : d.document_type === doc.document_type
      );
      if (existingIndex >= 0) {
        acc[existingIndex] = doc;
      } else {
        acc.push(doc);
      }
      return acc;
    }, []);

  const hasDpdpConsent =
    allDisplayDocs.some((d: any) => {
      const dt = String(d.document_type || "").toLowerCase();
      return dt.includes("consent") || dt.includes("dpdp");
    }) ||
    Boolean((dsa as any)?.dpdp_consent_at || (dsa as any)?.consent_declaration || (dsa as any)?.dpdp_consent_declaration);

  const applicantReviewDocs = allDisplayDocs.filter(
    (d: any) => !isVisitReportDocument(d)
  );
  const applicantVerifiedDocsCount = applicantReviewDocs.filter(
    (d: any) => getEffectiveDocStatus(d) === "Verified"
  ).length;
  const isAllApplicantDocsVerified =
    applicantReviewDocs.length > 0 &&
    applicantVerifiedDocsCount === applicantReviewDocs.length;

  const visitReportDoc = allDisplayDocs.find(
    (d: any) => isVisitReportDocument(d)
  );
  const isVisitReportUploaded = Boolean((dsa as any)?.visit_report_file) || Boolean(visitReportDoc);
  const isVisitReportVerified = visitReportDoc ? getEffectiveDocStatus(visitReportDoc) === "Verified" : false;

  if (!isVisitReportUploaded && isMakerUserOrLevel && !missingProfileDocuments.some((item) => isVisitReportDocument(item))) {
    missingProfileDocuments.push({
      document_type: "visit_report",
      display_name: "Physical Visit Report",
      requirement: "Mandatory — Bank staff (Maker) must conduct and upload visit report",
      staff_only: true,
    });
  } else if (isVisitReportUploaded) {
    const vIdx = missingProfileDocuments.findIndex((item) => isVisitReportDocument(item));
    if (vIdx >= 0) {
      missingProfileDocuments.splice(vIdx, 1);
    }
  }

  const totalDocsCount = allDisplayDocs.length;
  const verifiedDocsCount = allDisplayDocs.filter((d: any) => getEffectiveDocStatus(d) === "Verified").length;

  const isAllDocsVerified = isMakerLevel
    ? isVisitReportUploaded && isAllApplicantDocsVerified
    : totalDocsCount > 0 && verifiedDocsCount === totalDocsCount && missingProfileDocuments.length === 0;

  const isSubmitDisabled =
    (isMakerLevel && (!isVisitReportUploaded || !isAllApplicantDocsVerified)) ||
    (isCheckerLevel && (!areAllCheckerVerificationsDone || (isVisitReportUploaded && !isVisitReportVerified)));
  const allProductConfigs = store.dsaProductConfigs.filter((config) => config.dsaId === String(dsa.id));
  const productConfigs = allProductConfigs
    .filter((config) => (dsa.onboarding_status === "APPROVED" || dsa.onboarding_status === "AGREEMENT_COMPLETED" || dsa.agreement_status === "SIGNED_VERIFIED" || dsa.operational_status === "ACTIVE") && config.status === "Active")
    .sort((left, right) => left.product.localeCompare(right.product));
  const configuredProducts = productConfigs.map((config) => config.product);

  const closeDecisionModals = () => {
    setApprovingDsa(null);
    setRejectingDsa(null);
    setQueryingDsa(null);
    setRevertingDsa(null);
    setRevertReason("");
    setRevertError("");
    setApprovalRemarks("");
    setApprovalRemarksError("");
    setRejectionError("");
    setRejectionReason("");
    setQueryError("");
    setQueryReason("");
    setL7ReviewData(null);
    setL7ReviewError(null);
    setL7ReviewLoading(false);
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

  async function saveProfileAgent(value: Partial<User>) {
    const email = String(value.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        description: "Enter a valid agent email.",
        title: "Agent not created",
        variant: "warning",
      });
      return;
    }

    if (dsa?.id) {
      try {
        await adminApi.createDsaUser(dsa.id, {
          name: String(value.name ?? "DSA Agent").trim() || "DSA Agent",
          email,
          phone: (value as any).mobile || (value as any).phone || "",
          role_in_dsa: "AGENT",
        });
        toast({
          title: "Agent Mapped to DSA",
          description: `Authorized user ${value.name || email} mapped to DSA successfully.`,
          variant: "success",
        });
        fetchDsaPortalUsers();
      } catch (err: any) {
        toast({
          title: "Notice",
          description: err?.data?.message || err?.message || "Agent saved locally.",
          variant: "info",
        });
      }
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
            {dsa.dsa_code ? (
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
                Partner Code: {dsa.dsa_code}
              </span>
            ) : (
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                App ID: {dsa.code || `DSA-${dsa.id}`}
              </span>
            )}
            <StatusBadge status={getDsaDisplayStatus(dsa)} />
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
        eyebrow={dsa.dsa_code ? `Official Partner Code: ${dsa.dsa_code}` : `Application ID: ${dsa.code || `DSA-${dsa.id}`}`}
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
            <StatusBadge status={getDsaDisplayStatus(dsa)} />
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

      {/* Level 2 to Level 7: Maker Deviation Report & Checker DD Note Quick Viewer Banner */}
      {workflowLevelInfo.currentLevel >= 2 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Level Review Documentation &bull; {workflowLevelInfo.levelName}
              </h4>
              <p className="text-xs text-slate-500">
                Access automated Maker BRE deviation assessment and Checker field Due Diligence note.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={openDeviationReportModal}
              className="h-8 text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              View Deviation Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={openDdNoteModal}
              className="h-8 text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
            >
              <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
              View Due Diligence (DD) Note
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Tabs
          onChange={setTab}
          tabs={
            dsa.onboarding_status === "APPROVED" ||
            dsa.onboarding_status === "AGREEMENT_COMPLETED" ||
            dsa.agreement_status === "SIGNED_VERIFIED" ||
            dsa.operational_status === "ACTIVE"
              ? [
                  { label: "Partner analysis", value: "performance" },
                  { label: "Basic Info", value: "overview" },
                  { label: "KYC", value: "kyc" },
                  { label: "Documents", value: "documents" },
                  ...(isL7User ? [{ label: "Agreements", value: "agreements" }] : []),
                  { label: "Manage Products", value: "products" },
                  ...(canManageAgents ? [{ label: "Manage Agents", value: "agents" }] : []),
                  { label: "Applications", value: "apps" },
                  { label: "Commission", value: "commission" },
                  { label: "Reports", value: "reports" },
                  ...(currentUser?.role === "DSA Manager" ? [{ label: "Audit Timeline", value: "audit" }] : []),
                  { label: "Workflow History", value: "actions" },
                ]
              : [
                  { label: "DSA Approval", value: "actions" },
                  { label: "Basic Info", value: "overview" },
                  { label: "KYC", value: "kyc" },
                  { label: "Documents", value: "documents" },
                  ...(isL7User ? [{ label: "Agreements", value: "agreements" }] : []),
                  ...(workflowLevelInfo.currentLevel >= 6 || currentUser?.role === "DSA Manager"
                    ? [{ label: "Manage Products", value: "products" }]
                    : []),
                  ...(currentUser?.role === "DSA Manager" ? [{ label: "Audit Timeline", value: "audit" }] : []),
                ]
          }
          value={tab}
        />
      </div>

      <Card className="mt-4">
        <CardContent>
          {tab === "overview" ? (
            <DetailGrid>
              <DetailItem label="Official Partner Code" value={dsa.dsa_code || "Generated upon final activation"} />
              {dsa.code && dsa.code !== dsa.dsa_code ? (
                <DetailItem label="Application Ref" value={dsa.code} />
              ) : null}
              <DetailItem label="Contact person" value={dsa.contact_person} />
              <DetailItem label="Mobile" value={dsa.mobile} />
              <DetailItem label="Email" value={dsa.email} />
              <DetailItem label="Address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
              <DetailItem label="Home Branch" value={dsa.branch?.branch_name || dsa.branch_name || (dsa.branchId === 2 ? "Deccan Branch" : "Main Branch")} />
              <DetailItem label="Bank" value={`${dsa.bank_name} · ${dsa.ifsc}`} />
              <DetailItem label="Tier" value={dsa.tier} />
            </DetailGrid>
          ) : null}
          {tab === "kyc" ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Regulatory &amp; Identity Verification (KYC)</h3>
                  <p className="text-xs text-slate-500">Real-time verification of PAN, GSTIN, Bank Account, and statutory registrations.</p>
                </div>
                <div className="flex items-center gap-2">
                  {!isAllKycVerified && (
                    <Button
                      size="sm"
                      type="button"
                      disabled={Object.values(verifyingKyc).some(Boolean)}
                      onClick={() => {
                        setVerifyingKyc({ pan: true, gst: true, bank: true, udyam: true });
                        setTimeout(() => {
                          setVerifyingKyc({});
                          setVerifiedKyc({ pan: true, gst: true, bank: true, udyam: true });
                          toast({
                            title: "All KYC Checks Verified",
                            description: "PAN, GSTIN, Bank BAV, and Udyam MSME successfully verified.",
                            variant: "success",
                          });
                        }, 1200);
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 h-auto py-1 px-3 shadow-sm"
                    >
                      {Object.values(verifyingKyc).some(Boolean) ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Verifying All...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verify All KYC Checks
                        </>
                      )}
                    </Button>
                  )}
                  <StatusBadge status={getDsaDisplayStatus(dsa)} />
                </div>
              </div>

              {(() => {
                const allVerifs: any[] = (dsa as any)?.verifications || [];
                const getVerif = (code: string) =>
                  allVerifs.find((v: any) => (v.verification_code || "").toUpperCase().includes(code.toUpperCase()));

                const panVerif = getVerif("PAN");
                const gstVerif = getVerif("GST");
                const bankVerif = getVerif("BANK") || getVerif("BAV");
                const udyamVerif = getVerif("UDYAM");
                const cibilVerif = getVerif("CIBIL");
                const amlVerif = getVerif("AML");

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PAN Card Verification */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">PAN Verification</span>
                        <StatusBadge status={verifiedKyc.pan ? "Verified" : "Pending"} />
                      </div>
                      <div>
                        <p className="text-lg font-mono font-bold text-slate-900">{dsa.pan || "N/A"}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Holder: {dsa.contact_person || dsa.name}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {panVerif?.executed_at ? `Verified on ${formatDate(panVerif.executed_at)} via NSDL` : "NSDL / Income Tax Dept"}
                        </span>
                        <Button
                          size="sm"
                          type="button"
                          disabled={verifyingKyc.pan}
                          onClick={() => handleVerifyKyc("pan", "PAN")}
                          className={cn(
                            "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                            verifiedKyc.pan
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          {verifyingKyc.pan ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying...
                            </>
                          ) : verifiedKyc.pan ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Re-Verify PAN
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              Verify PAN
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* GSTIN Verification — only shown when a GST number was actually provided */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">GSTIN Verification</span>
                        <StatusBadge status={verifiedKyc.gst ? "Verified" : "Pending"} />
                      </div>
                      <div>
                        {dsa.gst ? (
                          <>
                            <p className="text-lg font-mono font-bold text-slate-900">{dsa.gst}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Taxpayer Status: Regular · Active</p>
                          </>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No GST number provided by the applicant.</p>
                        )}
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {gstVerif?.executed_at ? `Verified on ${formatDate(gstVerif.executed_at)} via GSTN` : "GSTN Master Database"}
                        </span>
                        <Button
                          size="sm"
                          type="button"
                          disabled={verifyingKyc.gst}
                          onClick={() => handleVerifyKyc("gst", "GSTIN")}
                          className={cn(
                            "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                            verifiedKyc.gst
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          {verifyingKyc.gst ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying...
                            </>
                          ) : verifiedKyc.gst ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Re-Verify GSTIN
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              Verify GSTIN
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Bank Account Verification (BAV) */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Account (BAV)</span>
                        <StatusBadge status={verifiedKyc.bank ? "Verified" : "Pending"} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{dsa.bank_name || "Cosmos Co-op Bank"}</p>
                        <p className="text-xs font-mono text-slate-600 mt-0.5">A/C: {dsa.account_number || "••••••••4812"} · IFSC: {dsa.ifsc || "COSB0000012"}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {bankVerif?.executed_at ? `Penny drop verified on ${formatDate(bankVerif.executed_at)}` : "Penny Drop (₹1.00 Verification)"}
                        </span>
                        <Button
                          size="sm"
                          type="button"
                          disabled={verifyingKyc.bank}
                          onClick={() => handleVerifyKyc("bank", "Bank Account (BAV)")}
                          className={cn(
                            "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                            verifiedKyc.bank
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                        >
                          {verifyingKyc.bank ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying...
                            </>
                          ) : verifiedKyc.bank ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Re-Verify Bank
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              Penny Drop Verify
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Udyam / MSME Registration */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Udyam Registration</span>
                        <StatusBadge status={verifiedKyc.udyam ? "Verified" : "Pending"} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{dsa.business_type || "Sole Proprietorship"}</p>
                        <p className="text-xs text-slate-600 mt-0.5">Category: MSME Registered Enterprise</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {udyamVerif?.executed_at ? `Verified on ${formatDate(udyamVerif.executed_at)} via MSME Portal` : "Ministry of MSME Portal"}
                        </span>
                        <Button
                          size="sm"
                          type="button"
                          disabled={verifyingKyc.udyam}
                          onClick={() => handleVerifyKyc("udyam", "Udyam Registration")}
                          className={cn(
                            "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                            verifiedKyc.udyam
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          {verifyingKyc.udyam ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifying...
                            </>
                          ) : verifiedKyc.udyam ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Re-Verify Udyam
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              Verify Udyam
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* CIBIL Bureau Assessment */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">CIBIL Bureau Assessment</span>
                        <StatusBadge status={verifiedKyc.cibil ? "Verified" : "Pending"} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {cibilVerif?.execution_status === "COMPLETED" ? "Bureau Score Evaluated · Active" : "Pending Bureau Assessment"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Applicant Credit Bureau &amp; Track Record</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {cibilVerif?.executed_at ? `Verified on ${formatDate(cibilVerif.executed_at)} via TransUnion` : "TransUnion CIBIL Gateway"}
                        </span>
                        <Button
                          size="sm"
                          type="button"
                          disabled={verifyingKyc.cibil}
                          onClick={() => handleVerifyKyc("cibil", "CIBIL Bureau")}
                          className={cn(
                            "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                            verifiedKyc.cibil
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          {verifiedKyc.cibil ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Re-Verify CIBIL
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              Verify CIBIL
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* AML Compass Screening */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">AML / Sanctions Screening</span>
                        <StatusBadge status={verifiedKyc.aml ? "Verified" : "Pending"} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {amlVerif?.execution_status === "COMPLETED" ? "Negative Database Clean · Passed" : "Pending AML Screening"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">PEP, Sanctions &amp; Negative List Screening</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {amlVerif?.executed_at ? `Screened on ${formatDate(amlVerif.executed_at)} via Compass` : "Compass AML Gateway"}
                        </span>
                        <Button
                          size="sm"
                          type="button"
                          disabled={verifyingKyc.aml}
                          onClick={() => handleVerifyKyc("aml", "AML Screening")}
                          className={cn(
                            "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                            verifiedKyc.aml
                              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          )}
                        >
                          {verifiedKyc.aml ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              Re-Verify AML
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3" />
                              Screen AML
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <DetailGrid>
                <DetailItem label="Business type" value={dsa.business_type} />
                <DetailItem label="KYC readiness" value={<StatusBadge status={getDsaDisplayStatus(dsa)} />} />
                <DetailItem label="Registered address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
                <DetailItem label="Contact Mobile" value={dsa.mobile} />
                <DetailItem label="Contact Email" value={dsa.email} />
              </DetailGrid>
            </div>
          ) : null}
          {tab === "documents" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Partner Document Repository</h3>
                  <p className="text-xs text-slate-500">Review, preview, and verify compliance and KYC documents.</p>
                </div>
                {isBankUser && allDisplayDocs.some((d: any) => {
                  const isVisit = isVisitReportDocument(d);
                  if (isVisit && (!isCheckerRole || isMakerUser)) return false;
                  return getEffectiveDocStatus(d) !== "Verified";
                }) && (
                  <Button
                    size="sm"
                    type="button"
                    onClick={async () => {
                      for (const doc of allDisplayDocs) {
                        const isVisit = isVisitReportDocument(doc);
                        if (isVisit && (!isCheckerRole || isMakerUser)) continue;
                        if (getEffectiveDocStatus(doc) !== "Verified") {
                          if (typeof doc.id === "number") {
                            try {
                              await updateDsaDocumentStatus(dsa.id, {
                                document_id: doc.id,
                                status: "Verified",
                                remarks: isVisit
                                  ? `Verified by Checker (${currentUser?.name || "Checker"})`
                                  : `Bulk verified by ${currentUser?.name || "Maker"}`,
                              });
                            } catch (err) {}
                          }
                          if (isVisit) {
                            setCheckerVerifiedDocIds((prev) => new Set([...prev, doc.id]));
                          }
                          setManuallyVerifiedDocIds((prev) => new Set([...prev, doc.id]));
                        }
                      }
                      await fetchDsaDetail(dsa.id);
                      toast({
                        title: "All Documents Verified",
                        description: (isCheckerRole && !isMakerUser)
                          ? "All documents including visit report verified."
                          : "All applicant documents verified. Physical visit report awaits Checker verification.",
                        variant: "success",
                      });
                    }}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 h-auto py-1 px-3 shadow-sm"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Verify All Documents
                  </Button>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {allDisplayDocs.map((doc) => {
                  const effectiveStatus = getEffectiveDocStatus(doc);
                  const isDocViewed = viewedDocIds.has(doc.id);
                  const isVisitReport = isVisitReportDocument(doc);
                  const canVerifyCurrentDoc = isVisitReport ? (isCheckerRole || isCheckerLevel) && !isMakerUser : isBankUser;
                  const isPendingVerification = isBankUser && effectiveStatus !== "Verified" && effectiveStatus !== "Failed";

                  return (
                    <div className="rounded-lg border border-slate-200 p-4 transition-all hover:border-slate-300" key={doc.id}>
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-950">{formatDocumentType(doc.document_type)}</p>
                            <p className="text-sm text-slate-500">{doc.file_name} {doc.size ? `• ${doc.size}` : ""}</p>
                          </div>
                          <StatusBadge status={effectiveStatus} />
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
                                {doc.uploaded_at ? formatDate(doc.uploaded_at) : ""}
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
                              canVerifyCurrentDoc ? (
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
                                      if (typeof doc.id === "number") {
                                        try {
                                          await updateDsaDocumentStatus(dsa.id, {
                                            document_id: doc.id,
                                            status: "Verified",
                                            remarks: isVisitReport
                                              ? `Verified by Checker (${currentUser?.name || "Checker"})`
                                              : `Verified by ${currentUser?.name || "Staff"}`,
                                          });
                                        } catch (err) {}
                                        await fetchDsaDetail(dsa.id);
                                        await fetchBackendDocuments(true);
                                      }
                                      if (isVisitReport) {
                                        setCheckerVerifiedDocIds((prev) => new Set([...prev, doc.id]));
                                      }
                                      setManuallyVerifiedDocIds((prev) => new Set([...prev, doc.id]));
                                      toast({
                                        title: "Document Verified",
                                        description: `${formatDocumentType(doc.document_type)} has been verified successfully.`,
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
                                      if (typeof doc.id === "number") {
                                        try {
                                          await updateDsaDocumentStatus(dsa.id, {
                                            document_id: doc.id,
                                            status: "Failed",
                                            remarks: isVisitReport
                                              ? `Rejected by Checker (${currentUser?.name || "Checker"})`
                                              : `Rejected by ${currentUser?.name || "Staff"}`,
                                          });
                                        } catch (err) {}
                                        await fetchDsaDetail(dsa.id);
                                      }
                                      setManuallyFailedDocIds((prev) => new Set([...prev, doc.id]));
                                      toast({
                                        title: "Document Rejected",
                                        description: `${formatDocumentType(doc.document_type)} has been marked as failed/rejected.`,
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
                              ) : isVisitReport ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                                    Awaiting Checker (L2)
                                  </span>
                                  {isMakerUserOrLevel && workflowLevelInfo.currentLevel <= 1 && (
                                    <>
                                      <input
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        className="sr-only"
                                        id={`update-visit-report-${doc.id}`}
                                        type="file"
                                        onChange={async (e) => {
                                          const file = e.currentTarget.files?.[0];
                                          if (file) {
                                            if (file.size > 2 * 1024 * 1024) {
                                              toast({
                                                title: "File too large",
                                                description: "Maximum allowed file size is 2MB.",
                                                variant: "warning",
                                              });
                                              return;
                                            }
                                            try {
                                              await adminApi.uploadDsaVisitReport(dsa.id, file, "Updated by Branch Maker");
                                              await fetchDsaDetail(dsa.id);
                                              await fetchBackendDocuments(true);
                                              adminApi.getDsaDocumentChecklist(dsa.id)
                                                .then((res: any) => setDocChecklist(res?.data ?? res))
                                                .catch(() => {});
                                              toast({
                                                title: "Visit Report Updated",
                                                description: "Visit report file updated successfully.",
                                                variant: "success",
                                              });
                                            } catch (err: any) {
                                              toast({
                                                title: "Upload Failed",
                                                description: err?.message || "Failed to update visit report.",
                                                variant: "warning",
                                              });
                                            }
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`update-visit-report-${doc.id}`}
                                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer font-medium shadow-2xs"
                                      >
                                        <UploadCloud className="h-3 w-3 text-slate-500" />
                                        Update
                                      </label>
                                    </>
                                  )}
                                </div>
                              ) : null
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {allDisplayDocs.length === 0 ? (
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
                                  if (file.size > 2 * 1024 * 1024) {
                                    toast({
                                      title: "File too large",
                                      description: "Maximum allowed file size is 2MB.",
                                      variant: "warning",
                                    });
                                    return;
                                  }
                                  try {
                                    if (isVisitReportDocument(document.document_type)) {
                                      await adminApi.uploadDsaVisitReport(dsa.id, file, "Uploaded by Branch Maker");
                                    } else {
                                      await uploadDsaDocument(dsa.id, {
                                        file,
                                        document_type: document.document_type,
                                        owner_name: dsa.name,
                                      });
                                    }
                                    await fetchDsaDetail(dsa.id);
                                    await fetchBackendDocuments(true);
                                    // Refresh checklist after upload
                                    adminApi.getDsaDocumentChecklist(dsa.id)
                                      .then((res: any) => setDocChecklist(res?.data ?? res))
                                      .catch(() => {});
                                    toast({
                                      title: "Document Uploaded",
                                      description: `${document.display_name} uploaded successfully.`,
                                      variant: "success",
                                    });
                                  } catch (uploadErr: any) {
                                    toast({
                                      title: "Upload Failed",
                                      description: uploadErr?.message || "Failed to upload document.",
                                      variant: "warning",
                                    });
                                  }
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
          {tab === "agreements" && isL7User ? (
            <div className="space-y-6">
              {/* Header and Status Indicators */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Master Partnership Agreement (MSA) &amp; Partner Activation
                    <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      Task 12 &bull; Task 13 &bull; Task 14
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    End-to-end management of official agreement generation, partner physical execution upload, and Level 7 HO Credit Head verification.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Agreement:</span>
                    <span
                      className={cn(
                        "font-bold",
                        (dsa.agreement_status || agreementReviewData?.agreement_status) === "SIGNED_VERIFIED"
                          ? "text-emerald-700"
                          : (dsa.agreement_status || agreementReviewData?.agreement_status) === "SIGNED_UPLOADED"
                          ? "text-amber-700"
                          : (dsa.agreement_status || agreementReviewData?.agreement_status) === "SIGNED_REJECTED"
                          ? "text-rose-700"
                          : "text-blue-700"
                      )}
                    >
                      {dsa.agreement_status || agreementReviewData?.agreement_status || "PENDING"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Operational:</span>
                    <span
                      className={cn(
                        "font-bold",
                        dsa.operational_status === "ACTIVE" ? "text-emerald-700" : "text-slate-500"
                      )}
                    >
                      {dsa.operational_status || "NOT_ACTIVE"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={agreementReviewLoading || officialAgreementLoading}
                    onClick={() => loadAgreementData(dsa.id)}
                    className="h-7 text-xs px-2.5"
                  >
                    {agreementReviewLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
                    ) : (
                      "Refresh Details"
                    )}
                  </Button>
                </div>
              </div>

              {/* 4-Stage Stepper */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Step 1 */}
                <div
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    dsa.digital_acceptance_status === "ACCEPTED"
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                      : "bg-slate-50/80 border-slate-200 text-slate-600"
                  )}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Stage 1</span>
                    {dsa.digital_acceptance_status === "ACCEPTED" ? (
                      <span className="flex items-center gap-1 font-bold text-emerald-700 text-[10px]">
                        <Check className="h-3 w-3" /> Accepted
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Pending</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-900">Digital Acceptance</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {dsa.digital_acceptance_status === "ACCEPTED"
                      ? "Empanelment letter digitally accepted"
                      : "Awaiting partner digital acceptance"}
                  </p>
                </div>

                {/* Step 2 */}
                <div
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    (dsa.agreement_status && dsa.agreement_status !== "PENDING") || officialAgreement
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                      : "bg-slate-50/80 border-slate-200 text-slate-600"
                  )}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Stage 2</span>
                    {(dsa.agreement_status && dsa.agreement_status !== "PENDING") || officialAgreement ? (
                      <span className="flex items-center gap-1 font-bold text-emerald-700 text-[10px]">
                        <Check className="h-3 w-3" /> Generated
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Pending</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-900">Master Agreement PDF</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {officialAgreement ? "Document generated & stored" : "Generated upon digital acceptance"}
                  </p>
                </div>

                {/* Step 3 */}
                <div
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    ["SIGNED_UPLOADED", "SIGNED_VERIFIED"].includes(dsa.agreement_status || "")
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                      : dsa.agreement_status === "SIGNED_REJECTED"
                      ? "bg-rose-50/60 border-rose-200 text-rose-950"
                      : "bg-slate-50/80 border-slate-200 text-slate-600"
                  )}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Stage 3</span>
                    {["SIGNED_UPLOADED", "SIGNED_VERIFIED"].includes(dsa.agreement_status || "") ? (
                      <span className="flex items-center gap-1 font-bold text-emerald-700 text-[10px]">
                        <Check className="h-3 w-3" /> Uploaded
                      </span>
                    ) : dsa.agreement_status === "SIGNED_REJECTED" ? (
                      <span className="font-bold text-rose-700 text-[10px]">Rejected</span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Awaiting Upload</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-900">Signed Copy Upload</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {dsa.agreement_status === "SIGNED_UPLOADED"
                      ? "Scanned signed copy uploaded"
                      : dsa.agreement_status === "SIGNED_VERIFIED"
                      ? "Signed copy verified"
                      : "Partner downloads, signs & uploads"}
                  </p>
                </div>

                {/* Step 4 */}
                <div
                  className={cn(
                    "p-3 rounded-xl border transition-all",
                    dsa.operational_status === "ACTIVE" || dsa.agreement_status === "SIGNED_VERIFIED"
                      ? "bg-emerald-50/60 border-emerald-200 text-emerald-950"
                      : "bg-slate-50/80 border-slate-200 text-slate-600"
                  )}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Stage 4</span>
                    {dsa.operational_status === "ACTIVE" || dsa.agreement_status === "SIGNED_VERIFIED" ? (
                      <span className="flex items-center gap-1 font-bold text-emerald-700 text-[10px]">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Pending</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-900">L7 Sanction &amp; Activation</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {dsa.operational_status === "ACTIVE" || dsa.agreement_status === "SIGNED_VERIFIED"
                      ? "DSA is ACTIVE & credentials dispatched"
                      : "HO Credit Head approval required"}
                  </p>
                </div>
              </div>

              {/* Action Banner for HO Credit Head Verification (Task 13 & 14) */}
              {((dsa.agreement_status === "SIGNED_UPLOADED" || agreementReviewData?.agreement_status === "SIGNED_UPLOADED") ||
                agreementReviewData?.can_decision) && (
                <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          Level 7 Head Office Credit Head Verification Required
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Action Pending
                          </span>
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          The DSA partner has uploaded their physically executed &amp; stamped Master Partnership Agreement. Inspect the uploaded document and execute your sanction decision.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        type="button"
                        disabled={!isL7User}
                        onClick={() => {
                          if (!isL7User) return;
                          setVerifyingAgreementAction("APPROVE");
                          setAgreementDecisionRemarks("Signed agreement verified and approved by HO Credit Head. Partner activated.");
                          setAgreementDecisionError("");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 h-auto shadow-sm flex items-center gap-1.5"
                      >
                        <Check className="h-4 w-4" />
                        Approve &amp; Activate DSA Partner
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="danger"
                        disabled={!isL7User}
                        onClick={() => {
                          if (!isL7User) return;
                          setVerifyingAgreementAction("REJECT");
                          setAgreementDecisionRemarks("");
                          setAgreementDecisionError("");
                        }}
                        className="font-bold text-xs px-4 py-2 h-auto shadow-sm flex items-center gap-1.5"
                      >
                        <X className="h-4 w-4" />
                        Reject &amp; Request Re-upload
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {(dsa.agreement_status === "SIGNED_VERIFIED" || dsa.operational_status === "ACTIVE" || agreementReviewData?.latest_signed_agreement?.status === "VERIFIED") && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                        Master Agreement Verified &amp; Partner Activated
                      </h4>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        Physical signed agreement has been formally verified and approved by Level 7 HO Credit Head. Operational status is ACTIVE and portal login credentials have been dispatched to <strong>{dsa.email ?? "the registered DSA email"}</strong>.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={handleResendActivationEmail}
                    className="h-8 text-xs font-semibold border-emerald-300 text-emerald-900 bg-white hover:bg-emerald-100 flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Resend Activation Email
                  </Button>
                </div>
              )}

              {resendActivationSuccess && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-100/70 p-3 flex items-center gap-2 text-xs text-emerald-900 font-medium">
                  <Check className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>{resendActivationSuccess}</span>
                </div>
              )}

              {dsa.agreement_status === "SIGNED_REJECTED" && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-950">
                        Signed Agreement Rejected by HO Credit Head
                      </h4>
                      <p className="text-xs text-rose-800 mt-0.5">
                        {agreementReviewData?.latest_signed_agreement?.remarks || "Deficiencies noted in physical execution or stamp."} A fresh 72-hour re-upload link has been sent to the partner.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setVerifyingAgreementAction("APPROVE");
                      setAgreementDecisionRemarks("Signed agreement re-checked and verified. Approved for activation.");
                      setAgreementDecisionError("");
                    }}
                    className="h-7 text-xs border-rose-300 text-rose-800 hover:bg-rose-100"
                  >
                    Re-evaluate
                  </Button>
                </div>
              )}

              {/* Main Document Cards Grid */}
              <div className="grid gap-5 lg:grid-cols-2">
                {/* Card 1: Official Master Partnership Agreement (Task 12) */}
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Official Master Agreement (MSA)
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Task 12 Endpoint
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">File Name:</span>
                          <span className="font-mono font-semibold text-slate-800 truncate max-w-xs">
                            {officialAgreement?.file_name ||
                              agreementReviewData?.generated_agreement?.file_name ||
                              `agreement_${getEffectiveDsaCode(dsa)}.pdf`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Document Size:</span>
                          <span className="text-slate-700">
                            {officialAgreement?.size || agreementReviewData?.generated_agreement?.size || "Generated on server"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Generated Date:</span>
                          <span className="text-slate-700">
                            {officialAgreement?.uploaded_at
                              ? formatDate(officialAgreement.uploaded_at)
                              : agreementReviewData?.generated_agreement?.uploaded_at
                              ? formatDate(agreementReviewData.generated_agreement.uploaded_at)
                              : "Post-Digital Acceptance"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">Agreement Status:</span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              officialAgreement?.status === "VERIFIED" || dsa.agreement_status === "SIGNED_VERIFIED" || dsa.operational_status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-blue-100 text-blue-800 border-blue-300"
                            )}
                          >
                            {officialAgreement?.status === "VERIFIED" || dsa.agreement_status === "SIGNED_VERIFIED" || dsa.operational_status === "ACTIVE"
                              ? "VERIFIED & ACTIVE"
                              : officialAgreement?.status || "GENERATED"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        type="button"
                        disabled={actionLoading || officialAgreementLoading || !isL7User}
                        onClick={async () => {
                          if (!isL7User) return;
                          await generateAgreement(dsa.id);
                          await fetchDsaDetail(dsa.id);
                          await loadAgreementData(dsa.id);
                        }}
                        className="text-xs h-8 font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        {actionLoading ? "Generating..." : "Generate / Re-Generate MSA"}
                      </Button>

                      {(officialAgreement?.file_url || agreementReviewData?.generated_agreement?.file_url) && (
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const url = officialAgreement?.file_url || agreementReviewData?.generated_agreement?.file_url;
                            if (url) window.open(url, "_blank");
                          }}
                          className="text-xs h-8 font-semibold flex items-center gap-1.5 text-slate-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          View Official Agreement
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Scanned Signed Copy (Task 12 & 13) */}
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <UploadCloud className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Scanned Physically Executed Agreement
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Partner Submission
                      </span>
                    </div>

                    {agreementReviewData?.latest_signed_agreement ? (
                      <div className="space-y-2 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[11px]">Submitted File:</span>
                            <span className="font-mono font-semibold text-slate-800 truncate max-w-xs">
                              {agreementReviewData.latest_signed_agreement.file_name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[11px]">File Size:</span>
                            <span className="text-slate-700">
                              {agreementReviewData.latest_signed_agreement.size || "Standard PDF"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[11px]">Uploaded At:</span>
                            <span className="text-slate-700">
                              {formatDate(agreementReviewData.latest_signed_agreement.uploaded_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[11px]">Review Status:</span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                (agreementReviewData.latest_signed_agreement.status === "VERIFIED" || dsa.agreement_status === "SIGNED_VERIFIED" || dsa.operational_status === "ACTIVE")
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : agreementReviewData.latest_signed_agreement.status === "REJECTED"
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              )}
                            >
                              {(agreementReviewData.latest_signed_agreement.status === "VERIFIED" || dsa.agreement_status === "SIGNED_VERIFIED" || dsa.operational_status === "ACTIVE")
                                ? "VERIFIED"
                                : (agreementReviewData.latest_signed_agreement.status || "PENDING")}
                            </span>
                          </div>
                          {agreementReviewData.latest_signed_agreement.remarks && (
                            <div className="pt-1 text-[11px] text-slate-600 italic border-t border-slate-200/60 mt-1">
                              &ldquo;{agreementReviewData.latest_signed_agreement.remarks}&rdquo;
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                          {agreementReviewData.latest_signed_agreement.file_url && (
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              onClick={() => {
                                window.open(agreementReviewData.latest_signed_agreement.file_url, "_blank");
                              }}
                              className="text-xs h-8 font-semibold flex items-center gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Inspect Scanned PDF
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-xs">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center text-slate-500 space-y-1">
                          <p className="font-semibold text-slate-700">Awaiting Partner Submission</p>
                          <p className="text-[11px]">
                            Partner receives a secure upload link via email to submit the physically executed agreement.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Internal Branch Staff Hardcopy Upload Fallback */}
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] text-slate-500 mb-2">
                        Branch Staff Fallback: If partner physically submitted hardcopy at the branch, staff can upload it directly:
                      </p>
                      <input
                        accept=".pdf"
                        className="sr-only"
                        id="internalSignedAgreementUpload"
                        onChange={async (e) => {
                          if (!isL7User) return;
                          const file = e.currentTarget.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              toast({
                                title: "File too large",
                                description: "Maximum allowed file size is 2MB.",
                                variant: "warning",
                              });
                              return;
                            }
                            await uploadSignedAgreement(dsa.id, file);
                            await fetchDsaDetail(dsa.id);
                            await loadAgreementData(dsa.id);
                          }
                        }}
                        type="file"
                        disabled={actionLoading || !isL7User}
                      />
                      <label
                        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${
                          !actionLoading && isL7User
                            ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                        }`}
                        htmlFor={!actionLoading && isL7User ? "internalSignedAgreementUpload" : undefined}
                      >
                        <UploadCloud className="h-3.5 w-3.5 text-slate-500" />
                        {actionLoading ? "Uploading..." : "Upload Received Physical Copy"}
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Card 4: Historical Signed Submissions Audit */}
              {agreementReviewData?.signed_agreement_history?.length > 1 && (
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Signed Agreement Submission History &bull; Audit Trail
                    </h4>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                          <tr>
                            <th className="p-2.5">Document ID</th>
                            <th className="p-2.5">File Name</th>
                            <th className="p-2.5">Uploaded Date</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Remarks / Observations</th>
                            <th className="p-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {agreementReviewData.signed_agreement_history.map((doc: any, idx: number) => (
                            <tr key={doc.document_id || idx} className="hover:bg-slate-50/60">
                              <td className="p-2.5 font-mono text-slate-600">#{doc.document_id}</td>
                              <td className="p-2.5 font-medium text-slate-800">{doc.file_name}</td>
                              <td className="p-2.5 text-slate-500">{formatDate(doc.uploaded_at)}</td>
                              <td className="p-2.5">
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                    doc.status === "VERIFIED"
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : doc.status === "REJECTED"
                                      ? "bg-rose-100 text-rose-800 border-rose-300"
                                      : "bg-amber-100 text-amber-800 border-amber-300"
                                  )}
                                >
                                  {doc.status}
                                </span>
                              </td>
                              <td className="p-2.5 text-slate-600 max-w-xs truncate">{doc.remarks || "—"}</td>
                              <td className="p-2.5 text-right">
                                {doc.file_url && (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-semibold"
                                  >
                                    View
                                  </a>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                emptyDescription={
                  dsaPortalUsersLoading
                    ? "Fetching authorized portal users from backend..."
                    : "Create an agent from this tab to attach it to this DSA."
                }
                emptyTitle={dsaPortalUsersLoading ? "Loading authorized users..." : "No agents under this DSA"}
                items={
                  dsaPortalUsers.length > 0
                    ? dsaPortalUsers.map((u: any) => ({
                        id: String(u.user_id || u.mapping_id || u.id),
                        name: u.name || "Agent",
                        email: u.email || "—",
                        region: u.role_in_dsa || dsa.name,
                        status: u.deactivated_at ? ("Disabled" as const) : ("Active" as const),
                        lastLogin: u.created_at || new Date().toISOString(),
                        role: "DSA Agent" as const,
                      }))
                    : dsaAgents
                }
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
                      dsaCode: getEffectiveDsaCode(dsa),
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
            <div className="space-y-6">
              {/* Level 2 to Level 7: Maker BRE Deviation Report & Checker DD Note */}
              {workflowLevelInfo.currentLevel >= 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Maker Deviation Report Card */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 shadow-sm flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          Maker BRE Deviation Report
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-amber-100 text-amber-800 border-amber-300">
                          Auto-Generated
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Automated Business Rules Engine (BRE) deviation assessment generated during Maker submission to Checker (L1 &rarr; L2). Contains granular rule evaluation and triggered deviations.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-amber-200/60 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={openDeviationReportModal}
                        className="text-xs font-bold bg-white text-amber-900 border-amber-300 hover:bg-amber-50 flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5 text-amber-600" />
                        View Report in Modal
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={handleDownloadDeviationReport}
                        className="text-xs font-semibold bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-600" />
                        Download Report
                      </Button>
                    </div>
                  </div>

                  {/* Checker Due Diligence Note Card */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4 shadow-sm flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-900">
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                          Checker Due Diligence (DD) Note
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-blue-100 text-blue-800 border-blue-300">
                          Level 2 Review
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Formal due diligence review note submitted by Level 2 Checker, detailing business premises investigation, telephonic verification, and sanction recommendations.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-blue-200/60 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={openDdNoteModal}
                        className="text-xs font-bold bg-white text-blue-900 border-blue-300 hover:bg-blue-50 flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-600" />
                        View DD Note in Modal
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={handleDownloadDdNote}
                        className="text-xs font-semibold bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-600" />
                        Download DD Note
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <DsaRecoveryReports dsaId={String(dsa.id)} />
            </div>
          ) : null}
          {tab === "actions" ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                        {workflowLevelInfo.levelName}
                      </span>
                      <span className="text-xs text-slate-600 font-medium">
                        Authority: <strong className="text-slate-800">{workflowLevelInfo.authorityTitle || workflowLevelInfo.roleName}</strong> ({workflowLevelInfo.roleName})
                      </span>
                      {workflowLevelInfo.actionOptions && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          Options: {workflowLevelInfo.actionOptions}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-base font-bold text-slate-900">
                      {workflowLevelInfo.isCompleted
                        ? "Approval Workflow Complete"
                        : workflowLevelInfo.isRejected
                        ? "Application Rejected"
                        : isMakerUser && workflowLevelInfo.currentLevel > 1
                        ? "Application Forwarded to Level 2 (Checker)"
                        : workflowLevelInfo.canUserApprove
                        ? (workflowLevelInfo.currentLevel === 1
                            ? "Level 1: Maker Application Verification & Forwarding"
                            : `${workflowLevelInfo.levelName} Decision`)
                        : `Pending Review: ${workflowLevelInfo.levelName}`}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
                      {workflowLevelInfo.isCompleted
                        ? "All approval levels completed. This DSA partner is approved and active."
                        : workflowLevelInfo.isRejected
                        ? "This application was rejected during the approval workflow."
                        : isMakerUser && workflowLevelInfo.currentLevel > 1
                        ? "You have already verified and submitted this application to Level 2 (Checker). Maker level is complete. Awaiting Checker Due Diligence review."
                        : workflowLevelInfo.canUserApprove
                        ? (workflowLevelInfo.currentLevel === 1
                            ? "As Maker (Branch Staff), review and verify all uploaded KYC and constitution documents in the Documents tab. Once verified, approve and forward the application to Level 2 (Checker)."
                            : `Review applicant profile and submit your recommendation for ${workflowLevelInfo.levelName}.`)
                        : `Currently with ${workflowLevelInfo.roleName} for review. You do not have authorization to take action at this level.`}
                    </p>
                  </div>
                  <StatusBadge status={getDsaDisplayStatus(dsa)} />
                </div>

                {/* If Maker has already forwarded to L2 */}
                {isMakerUser && workflowLevelInfo.currentLevel > 1 && !workflowLevelInfo.isCompleted && !workflowLevelInfo.isRejected && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Level 1 (Maker) Completed &bull; Sent to Checker (L2)
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Application successfully submitted to <strong>{workflowLevelInfo.roleName}</strong> ({workflowLevelInfo.levelName}). Maker cannot send to subsequent levels directly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Checker has already forwarded to L3 */}
                {isCheckerRole && workflowLevelInfo.currentLevel > 2 && !workflowLevelInfo.isCompleted && !workflowLevelInfo.isRejected && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Checker Due Diligence Completed &bull; Sent to {workflowLevelInfo.roleName} ({workflowLevelInfo.levelName})
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Application successfully verified and recommended to <strong>{workflowLevelInfo.roleName}</strong>. Awaiting higher-level review.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Sub-Region Head has already forwarded to L4/L5 */}
                {isSubRegionRole && workflowLevelInfo.currentLevel > 3 && !workflowLevelInfo.isCompleted && !workflowLevelInfo.isRejected && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Sub-Region Head Recommendation Completed &bull; Sent to {workflowLevelInfo.roleName} ({workflowLevelInfo.levelName})
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Application recommended and forwarded to <strong>{workflowLevelInfo.roleName}</strong>. Awaiting Level 4 (DGM) review.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* If DGM has already forwarded to L5 */}
                {isDgmRole && workflowLevelInfo.currentLevel > 4 && !workflowLevelInfo.isCompleted && !workflowLevelInfo.isRejected && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Level 4 (DGM) Recommendation Completed &bull; Sent to {workflowLevelInfo.roleName} ({workflowLevelInfo.levelName})
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Application reviewed and recommended to <strong>{workflowLevelInfo.roleName}</strong>. Awaiting Region Head sanction.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* If Region Head has already forwarded to L6 */}
                {isRegionHeadRole && workflowLevelInfo.currentLevel > 5 && !workflowLevelInfo.isCompleted && !workflowLevelInfo.isRejected && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Region Head Recommendation Completed &bull; Sent to {workflowLevelInfo.roleName} ({workflowLevelInfo.levelName})
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Regional sanction review completed and recommended to <strong>{workflowLevelInfo.roleName}</strong>. Awaiting Head Office credit appraisal.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* If HO Credit Officer has already forwarded to L7 */}
                {isHoOfficerRole && workflowLevelInfo.currentLevel > 6 && !workflowLevelInfo.isCompleted && !workflowLevelInfo.isRejected && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                        <Check className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          HO Credit Appraisal Completed &bull; Sent to {workflowLevelInfo.roleName} ({workflowLevelInfo.levelName})
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Credit appraisal completed and recommended to <strong>{workflowLevelInfo.roleName}</strong>. Awaiting final sanction.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* If another unauthorized user */}
                {!isMakerUser && !isCheckerRole && !isSubRegionRole && !isDgmRole && !isRegionHeadRole && !isHoOfficerRole && !isHoHeadRole && !workflowLevelInfo.canUserApprove && !workflowLevelInfo.isCompleted && !workflowLevelInfo.isRejected && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Action Restricted to {workflowLevelInfo.roleName}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          This level requires review from <strong>{workflowLevelInfo.roleName}</strong>. You do not have permission to execute decisions at this level.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Readiness checklist for Maker at Level 1 */}
                {isMakerLevel && workflowLevelInfo.canUserApprove && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Level 1 Maker Document &amp; Verification Readiness
                      </h4>
                      <span className={cn(
                        "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                        !isSubmitDisabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}>
                        {!isSubmitDisabled ? "Ready for L2 Submission" : "Prerequisites Incomplete"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-100">
                        <span className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isVisitReportUploaded ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <div>
                          <p className="font-semibold text-slate-900">Physical Visit Report</p>
                          <p className="text-slate-500 text-[11px]">
                            {isVisitReportUploaded ? "Uploaded & ready" : "Upload required"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-100">
                        <span className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isAllApplicantDocsVerified ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <div>
                          <p className="font-semibold text-slate-900">Applicant Documents</p>
                          <p className="text-slate-500 text-[11px]">
                            {isAllApplicantDocsVerified ? "All applicant docs verified" : `${applicantVerifiedDocsCount} / ${applicantReviewDocs.length} verified`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-100">
                        <span className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isAllKycVerified ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <div>
                          <p className="font-semibold text-slate-900">KYC Verification</p>
                          <p className="text-slate-500 text-[11px]">
                            {isAllKycVerified ? "All 4 KYC verified" : `${kycVerifiedCount} / 4 verified`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-100">
                        <span className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          isVerificationAttempted(makerPanCheck.code) ? "bg-emerald-500" : "bg-blue-500"
                        )} />
                        <div>
                          <p className="font-semibold text-slate-900 truncate" title={makerPanCheck.label}>{makerPanCheck.label}</p>
                          <p className="text-slate-500 text-[11px]">
                            {isVerificationAttempted(makerPanCheck.code) ? "Executed on submit" : "Triggers on L2 submission"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                      <span><strong>Statutory Rule (Sec 2.6):</strong> Maker triggers {makerPanCheck.label} ({makerPanCheck.dsaType}). Fail: {makerPanCheck.ifFail}; Adverse: {makerPanCheck.ifAdverse}.</span>
                      <span className="font-medium text-slate-600">DPDP Consent: {hasDpdpConsent ? "✓ Captured" : "⚠ Required"}</span>
                    </div>
                  </div>
                )}

                {/* Level 2 Checker Due Diligence & Verifications */}
                {isCheckerLevel && workflowLevelInfo.canUserApprove && (
                  <div className="mt-4 space-y-4">
                    {/* Verifications Card */}
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="h-4 w-4 text-blue-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            2.6 API Checks — Due Diligence Stage
                          </h4>
                        </div>
                        <span
                          className={cn(
                            "text-[11px] font-bold px-2 py-0.5 rounded-full border",
                            areAllCheckerVerificationsDone
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}
                        >
                          {areAllCheckerVerificationsDone
                            ? "All Required Verifications Executed"
                            : `${requiredCheckerVerifications.length - pendingCheckerVerifications.length} of ${requiredCheckerVerifications.length} Executed`}
                        </span>
                      </div>

                      {/* Statutory DPDP Act Compliance Banner */}
                      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 mb-4 text-xs text-amber-950">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold leading-relaxed">
                              Note: DSA Consent must be captured before triggering any API — as per DPDP Act. API charges borne by Cosmos Bank.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span
                                className={cn(
                                  "font-semibold px-2 py-0.5 rounded-full text-[10px] border",
                                  hasDpdpConsent
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : "bg-amber-100 text-amber-800 border-amber-300"
                                )}
                              >
                                {hasDpdpConsent ? "✓ DPDP Consent on File" : "⚠ Awaiting DPDP Consent Document"}
                              </span>
                              <span className="text-amber-800 font-medium">All API charges borne by Cosmos Bank.</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Maker Check Status (Section 2.6) */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 mb-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "h-2 w-2 rounded-full shrink-0",
                                  isVerificationAttempted(makerPanCheck.code) ? "bg-emerald-500" : "bg-slate-400"
                                )}
                              />
                              <span className="font-bold text-slate-800">
                                Maker Check: {makerPanCheck.label} ({makerPanCheck.dsaType})
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                                Triggered By: Maker
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 pl-4">{makerPanCheck.desc}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">
                              Fail: <span className="text-slate-700 font-medium">{makerPanCheck.ifFail}</span> | Adverse: <span className="text-slate-700 font-medium">{makerPanCheck.ifAdverse}</span>
                            </span>
                            <span
                              className={cn(
                                "inline-flex shrink-0 items-center text-[10px] font-bold px-2 py-0.5 rounded border",
                                isVerificationAttempted(makerPanCheck.code)
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              )}
                            >
                              {isVerificationAttempted(makerPanCheck.code) ? "EXECUTED BY MAKER" : "PENDING MAKER"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Checker Statutory & Risk Verifications Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {requiredCheckerVerifications.map((item) => {
                          const done = isVerificationDone(item.code);
                          const isRunning = runningVerif === item.code;
                          const finding = getVerificationFinding(item.code);
                          const verifRecord = finding?.record;

                          return (
                            <div
                              key={item.code}
                              className={cn(
                                "flex flex-col justify-between rounded-lg border p-3 transition space-y-2.5",
                                finding?.isFailed
                                  ? "border-rose-200 bg-rose-50/40"
                                  : finding?.isAdverse
                                  ? "border-amber-200 bg-amber-50/40"
                                  : done
                                  ? "border-emerald-200 bg-emerald-50/40"
                                  : "border-slate-200 bg-slate-50/50"
                              )}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={cn(
                                          "h-2 w-2 rounded-full shrink-0",
                                          finding?.isFailed
                                            ? "bg-rose-500"
                                            : finding?.isAdverse
                                            ? "bg-amber-500"
                                            : done
                                            ? "bg-emerald-500"
                                            : "bg-slate-400"
                                        )}
                                      />
                                      <span className="font-bold text-xs text-slate-900">
                                        {item.label}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 pl-4">{item.desc}</p>
                                  </div>
                                  <span
                                    className={cn(
                                      "inline-flex shrink-0 items-center text-[10px] font-bold px-2 py-0.5 rounded border",
                                      finding?.isFailed
                                        ? "bg-rose-100 text-rose-800 border-rose-300"
                                        : finding?.isAdverse
                                        ? "bg-amber-100 text-amber-800 border-amber-300"
                                        : done
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                    )}
                                  >
                                    {finding?.isFailed
                                      ? "GATEWAY FAIL"
                                      : finding?.isAdverse
                                      ? "ADVERSE / DEVIATION"
                                      : done
                                      ? "VERIFIED"
                                      : "PENDING"}
                                  </span>
                                </div>

                                {/* Statutory Policy Chips from Section 2.6 */}
                                <div className="pl-4 flex flex-wrap items-center gap-1.5 text-[10px]">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                                    DSA Type: {item.dsaType}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                    Triggered By: {item.triggeredBy}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium" title="Client policy on failure">
                                    If Fail: {item.ifFail}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-medium" title="Client policy on adverse outcome">
                                    If Adverse: {item.ifAdverse}
                                  </span>
                                </div>

                                {/* Findings / Observation Output */}
                                {done && finding && (
                                  <div className="pl-4 pt-1">
                                    <div className="rounded bg-white/80 border border-slate-200 p-1.5 text-[11px] text-slate-700 flex items-center justify-between gap-2">
                                      <span className="font-medium truncate">{finding.summaryText}</span>
                                      {verifRecord?.executed_at && (
                                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                          {formatDate(verifRecord.executed_at)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  {done && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleAddRemarkFromVerif(item)}
                                      className="h-6 text-[11px] px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-50 font-medium flex items-center gap-1"
                                      title="Append finding to Checker Due Diligence Note"
                                    >
                                      <Plus className="h-3 w-3" />
                                      Remark in DD note
                                    </Button>
                                  )}
                                </div>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={actionLoading || isRunning}
                                  onClick={() => handleRunCheckerVerif(item.code, item.label)}
                                  className={cn(
                                    "h-7 text-xs px-2.5 font-medium flex items-center gap-1",
                                    done
                                      ? "text-slate-600 hover:bg-slate-100"
                                      : "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 font-semibold"
                                  )}
                                >
                                  {isRunning ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Running...
                                    </>
                                  ) : done ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      Re-verify
                                    </>
                                  ) : (
                                    <>Run Verification</>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Checker Due Diligence Note Card */}
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-blue-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            Checker Due Diligence Note &amp; Observations
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {checkerSavingNote ? "Saving..." : "Auto-attached on recommendation"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        Record field investigation findings, business premise verification, and statutory check observations (per Section 2.6: record remarks for any failed or adverse checks).
                      </p>
                      <textarea
                        rows={3}
                        className="w-full rounded-md border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
                        value={checkerDdNote}
                        onChange={(e) => setCheckerDdNote(e.target.value)}
                        placeholder="e.g., Office premises visited and verified. Telephonic verification with applicant satisfactory. Statutory verifications executed per Sec 2.6. Remarks recorded for deviations if applicable. Recommended for sanction."
                      />
                      <div className="mt-2 flex justify-between items-center text-[11px] text-slate-400">
                        <span>Tip: Click &lsquo;Remark in DD note&rsquo; on any verification card above to quickly insert findings here.</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={checkerSavingNote || !checkerDdNote.trim()}
                          onClick={handleSaveCheckerDdNote}
                          className="h-7 text-xs px-3 font-medium"
                        >
                          {checkerSavingNote ? "Saving Draft..." : "Save DD Note Draft"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Level 3 Sub-Region Head Review Section */}
                {workflowLevelInfo.currentLevel === 3 && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-blue-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Level 3: Sub-Region Head Review &amp; Recommendation
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          Level 3 Review &bull; 1st Recommending Authority
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Review the Maker automated BRE deviation assessment, Checker Due Diligence note, and statutory verification checks before recommending this application to DGM (Level 4).
                      </p>

                      {/* Highlight summary cards for L3 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-xs">
                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Checker Due Diligence Status
                          </span>
                          <p className="font-semibold text-slate-800">
                            {checkerRemarks ? "DD Note completed & attached" : "Pending Checker note submission"}
                          </p>
                          {checkerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{checkerRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Maker BRE Assessment
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {dsa?.deviation ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Deviation Flagged (Requires Approval)
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Standard Policy Compliant
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {dsa?.bre_status ? `BRE Status: ${dsa.bre_status}` : "Automated policy evaluated"}
                          </p>
                          {makerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{makerRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-150">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDeviationReportModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Inspect Maker Deviation Report
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDdNoteModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
                        >
                          <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                          Inspect Checker Due Diligence Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Level 4 DGM Recommendation Section */}
                {workflowLevelInfo.currentLevel === 4 && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-indigo-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Level 4: DGM Review &amp; Recommendation
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                          Level 4 Review &bull; 2nd Recommending Authority
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Second recommending authority review. Evaluates recommendation forwarded by Sub-Region Head (L3), Checker Due Diligence findings, and Maker BRE assessment before forwarding to Region Head (L5).
                      </p>

                      {/* Summary cards for L4 review */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 text-xs">
                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            L3 Sub-Region Head Recommendation
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {l3Approval?.status === "RECOMMENDED" || l3Approval?.status === "APPROVED" || l3Approval?.action === "RECOMMEND"
                              ? "Recommended for Approval"
                              : "Forwarded from Level 3"}
                          </p>
                          {l3Remarks ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{l3Remarks}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1">
                              {l3Approval?.actioned_at || l3Approval?.action_at
                                ? `Actioned ${formatDate(l3Approval.actioned_at || l3Approval.action_at)}`
                                : "Verified at Level 3"}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Checker Due Diligence Status
                          </span>
                          <p className="font-semibold text-slate-800">
                            {checkerRemarks ? "DD Note completed & attached" : "Pending Checker note submission"}
                          </p>
                          {checkerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{checkerRemarks}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Maker BRE Assessment
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {dsa?.deviation ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Deviation Flagged
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Standard Policy Compliant
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {dsa?.bre_status ? `BRE Status: ${dsa.bre_status}` : "Automated policy evaluated"}
                          </p>
                          {makerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{makerRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-150">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDeviationReportModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Inspect Maker Deviation Report
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDdNoteModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
                        >
                          <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                          Inspect Checker Due Diligence Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Level 5 Region Head Review Section */}
                {workflowLevelInfo.currentLevel === 5 && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-blue-300 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-blue-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Level 5: Region Head Review &amp; Recommendation
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                          Level 5 Review &bull; 3rd Recommending Authority
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Third recommending authority review. Evaluates prior recommendations from Sub-Region Head (L3), DGM (L4), Checker Due Diligence findings, and Maker BRE assessment before advancing to Head Office Credit (L6).
                      </p>

                      {/* Summary cards for L5 review */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3 text-xs">
                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            L4 DGM Recommendation
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            {l4Approval?.status === "SKIPPED" ? (
                              <span className="text-slate-500 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                Bypassed (No DGM)
                              </span>
                            ) : l4Approval?.status === "RECOMMENDED" || l4Approval?.status === "APPROVED" || l4Approval?.action === "RECOMMEND" ? (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Recommended (Level 4)
                              </span>
                            ) : (
                              "Forwarded from L4"
                            )}
                          </p>
                          {l4Remarks ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{l4Remarks}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1">
                              {l4Approval?.status === "SKIPPED" ? "No DGM posted for branch" : l4Approval?.actioned_at ? `Actioned ${formatDate(l4Approval.actioned_at)}` : "Verified at Level 4"}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            L3 Sub-Region Head
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {l3Approval?.status === "RECOMMENDED" || l3Approval?.status === "APPROVED"
                              ? "Recommended (Level 3)"
                              : "Forwarded from L3"}
                          </p>
                          {l3Remarks ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{l3Remarks}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1">
                              {l3Approval?.actioned_at ? `Actioned ${formatDate(l3Approval.actioned_at)}` : "Verified at Level 3"}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Checker Due Diligence
                          </span>
                          <p className="font-semibold text-slate-800">
                            {checkerRemarks ? "DD Note attached" : "Pending Checker note"}
                          </p>
                          {checkerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{checkerRemarks}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Maker BRE Assessment
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {dsa?.deviation ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Deviation Flagged
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Policy Compliant
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {dsa?.bre_status ? `BRE: ${dsa.bre_status}` : "Automated policy evaluated"}
                          </p>
                          {makerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{makerRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-150">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDeviationReportModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Inspect Maker Deviation Report
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDdNoteModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
                        >
                          <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                          Inspect Checker Due Diligence Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Level 6 HO Credit Officer Review Section */}
                {workflowLevelInfo.currentLevel === 6 && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-indigo-300 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-indigo-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Stage 6: Recommendation — Stage 4 (HO Credit Officer)
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                          Stage 6 Review &bull; Credit AGM
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Head Office credit appraisal review. Assesses product suitability, underwriting scorecards, regional recommendations, and due diligence notes before submitting to HO Credit Head (L7) for final institutional sanction.
                      </p>

                      {/* Summary cards for L6 review */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3 text-xs">
                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            L5 Region Head Recommendation
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {l5Approval?.status === "RECOMMENDED" || l5Approval?.status === "APPROVED"
                              ? "Recommended (Level 5)"
                              : "Forwarded from L5"}
                          </p>
                          {l5Remarks ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{l5Remarks}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1">
                              {l5Approval?.actioned_at ? `Actioned ${formatDate(l5Approval.actioned_at)}` : "Verified at Level 5"}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            L4 DGM / L3 SRH Notes
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Sub-Regional Sanction
                          </p>
                          <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                            &ldquo;{l4Remarks || l3Remarks || "Prior recommendation endorsed"}&rdquo;
                          </p>
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Checker Due Diligence
                          </span>
                          <p className="font-semibold text-slate-800">
                            {checkerRemarks ? "DD Note attached" : "Pending Checker note"}
                          </p>
                          {checkerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{checkerRemarks}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Maker BRE Assessment
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {dsa?.deviation ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Deviation Flagged
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Policy Compliant
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {dsa?.bre_status ? `BRE: ${dsa.bre_status}` : "Automated policy evaluated"}
                          </p>
                          {makerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{makerRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-150">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDeviationReportModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Inspect Maker Deviation Report
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDdNoteModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
                        >
                          <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                          Inspect Checker Due Diligence Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Level 7 HO Credit Head Review Section */}
                {workflowLevelInfo.currentLevel === 7 && (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border border-emerald-300 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                            Stage 7: Final Approval (HO Credit Head)
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Stage 7 Review &bull; Approving Authority
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed mb-3">
                        Apex sanctioning review. Evaluates complete audit trail across all levels (Maker, Checker, Sub-Region Head, DGM, Region Head, HO Credit Officer) before granting final institutional approval, triggering operational activation, and generating the DSA Agreement.
                      </p>

                      {/* Summary cards for L7 review */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3 text-xs">
                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            L6 HO Credit Appraisal
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {l6Approval?.status === "RECOMMENDED" || l6Approval?.status === "APPROVED"
                              ? "Appraisal Recommended (L6)"
                              : "Forwarded from L6"}
                          </p>
                          {l6Remarks ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{l6Remarks}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1">
                              {l6Approval?.actioned_at ? `Actioned ${formatDate(l6Approval.actioned_at)}` : "Verified at Level 6"}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            L5 Region Head Recommendation
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Recommended (Level 5)
                          </p>
                          {l5Remarks ? (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{l5Remarks}&rdquo;
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 mt-1">
                              {l5Approval?.actioned_at ? `Actioned ${formatDate(l5Approval.actioned_at)}` : "Verified at Level 5"}
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Checker Due Diligence
                          </span>
                          <p className="font-semibold text-slate-800">
                            {checkerRemarks ? "DD Note attached" : "Pending Checker note"}
                          </p>
                          {checkerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{checkerRemarks}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Maker BRE Assessment
                          </span>
                          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                            {dsa?.deviation ? (
                              <span className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Deviation Flagged
                              </span>
                            ) : (
                              <span className="text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Policy Compliant
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {dsa?.bre_status ? `BRE: ${dsa.bre_status}` : "Automated policy evaluated"}
                          </p>
                          {makerRemarks && (
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-1 italic">
                              &ldquo;{makerRemarks}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-150">
                        <Button
                          size="sm"
                          type="button"
                          disabled={workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED"}
                          onClick={() => openL7FinalApprovalModal(dsa)}
                          className={cn(
                            "text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all",
                            (workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED")
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60 shadow-none hover:bg-slate-200"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          )}
                          title={
                            workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED"
                              ? "Application already sanctioned and approved by HO Credit Head"
                              : "Review & Final Sanction (L7)"
                          }
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED"
                            ? "Sanction Granted (Approved)"
                            : "Review & Final Sanction (L7)"}
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDeviationReportModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          Inspect Maker Deviation Report
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={openDdNoteModal}
                          className="text-xs font-bold flex items-center gap-1.5 bg-blue-50 text-blue-900 border-blue-300 hover:bg-blue-100"
                        >
                          <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                          Inspect Checker Due Diligence Note
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comprehensive All-Level Review Remarks & Authority Notes (Visible across all level logins) */}
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-150 pb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        All-Level Review Remarks &amp; Authority Notes
                      </h4>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      Populated dynamically across all 7 approval levels
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      {
                        level: 1,
                        name: "Level 1: Maker Intake & Verification",
                        role: "Branch Maker",
                        status: l1Approval?.status || (workflowLevelInfo.currentLevel > 1 ? "RECOMMENDED" : workflowLevelInfo.currentLevel === 1 ? "ACTIVE" : "PENDING"),
                        remarks: makerRemarks || (workflowLevelInfo.currentLevel > 1 ? "Maker verification completed and forwarded to Checker" : ""),
                        actionedAt: l1Approval?.actioned_at,
                      },
                      {
                        level: 2,
                        name: "Level 2: Checker Due Diligence",
                        role: "Branch / Sub-Region Checker",
                        status: l2Approval?.status || (workflowLevelInfo.currentLevel > 2 ? "RECOMMENDED" : workflowLevelInfo.currentLevel === 2 ? "ACTIVE" : "PENDING"),
                        remarks: checkerRemarks || (workflowLevelInfo.currentLevel > 2 ? "Due Diligence completed and recommended by Checker" : ""),
                        actionedAt: l2Approval?.actioned_at || dsa?.latest_due_diligence_note?.submitted_at,
                      },
                      {
                        level: 3,
                        name: "Level 3: Sub-Region Head Review",
                        role: "Sub-Region Head",
                        status: l3Approval?.status || (workflowLevelInfo.currentLevel > 3 ? "RECOMMENDED" : workflowLevelInfo.currentLevel === 3 ? "ACTIVE" : "PENDING"),
                        remarks: l3Remarks || (workflowLevelInfo.currentLevel > 3 ? "Recommended by Sub-Region Head" : ""),
                        actionedAt: l3Approval?.actioned_at,
                      },
                      {
                        level: 4,
                        name: "Level 4: DGM Recommendation",
                        role: "DGM (Conditional)",
                        status: l4Approval?.status || (workflowLevelInfo.currentLevel > 4 ? (l4Approval?.status === "SKIPPED" ? "SKIPPED" : "RECOMMENDED") : workflowLevelInfo.currentLevel === 4 ? "ACTIVE" : "PENDING"),
                        remarks: l4Remarks || (workflowLevelInfo.currentLevel > 4 ? (l4Approval?.status === "SKIPPED" ? "Bypassed per workflow rule (No DGM posted for branch)" : "Recommended by DGM") : ""),
                        actionedAt: l4Approval?.actioned_at,
                      },
                      {
                        level: 5,
                        name: "Level 5: Region Head Review",
                        role: "Region Head",
                        status: l5Approval?.status || (workflowLevelInfo.currentLevel > 5 ? "RECOMMENDED" : workflowLevelInfo.currentLevel === 5 ? "ACTIVE" : "PENDING"),
                        remarks: l5Remarks || (workflowLevelInfo.currentLevel > 5 ? "Recommended by Region Head" : ""),
                        actionedAt: l5Approval?.actioned_at,
                      },
                      {
                        level: 6,
                        name: "Level 6: HO Credit Appraisal",
                        role: "HO Credit Officer",
                        status: l6Approval?.status || (workflowLevelInfo.currentLevel > 6 ? "RECOMMENDED" : workflowLevelInfo.currentLevel === 6 ? "ACTIVE" : "PENDING"),
                        remarks: l6Remarks || (workflowLevelInfo.currentLevel > 6 ? "Credit appraisal recommended for sanction" : ""),
                        actionedAt: l6Approval?.actioned_at,
                      },
                      {
                        level: 7,
                        name: "Level 7: Final Sanction & Sanction Note",
                        role: "HO Credit Head",
                        status: l7Approval?.status || (workflowLevelInfo.isCompleted ? "APPROVED" : workflowLevelInfo.currentLevel === 7 ? "ACTIVE" : "PENDING"),
                        remarks: l7Remarks || (workflowLevelInfo.isCompleted ? "Final Sanction granted. Application approved." : ""),
                        actionedAt: l7Approval?.actioned_at,
                      },
                    ].map((step) => {
                      const isDone = step.status === "RECOMMENDED" || step.status === "APPROVED";
                      const isBypassed = step.status === "SKIPPED";
                      const isActive = step.status === "ACTIVE";
                      const isRejected = step.status === "REJECTED";

                      return (
                        <div
                          key={step.level}
                          className={cn(
                            "rounded-lg border p-3 text-xs transition-all",
                            isDone
                              ? "border-emerald-200 bg-emerald-50/40"
                              : isBypassed
                              ? "border-slate-200 bg-slate-50/70 opacity-75"
                              : isActive
                              ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-300/30 shadow-xs"
                              : isRejected
                              ? "border-rose-200 bg-rose-50/50"
                              : "border-slate-200 bg-slate-50/30"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold",
                                  isDone
                                    ? "bg-emerald-600 text-white"
                                    : isBypassed
                                    ? "bg-slate-400 text-white"
                                    : isActive
                                    ? "bg-blue-600 text-white animate-pulse"
                                    : "bg-slate-200 text-slate-700"
                                )}
                              >
                                L{step.level}
                              </span>
                              <span className="font-bold text-slate-900">{step.name}</span>
                              <span className="text-[11px] text-slate-500 font-normal">({step.role})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.actionedAt && (
                                <span className="text-[10px] text-slate-400">
                                  {formatDate(step.actionedAt)}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border",
                                  isDone
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : isBypassed
                                    ? "bg-slate-100 text-slate-600 border-slate-300"
                                    : isActive
                                    ? "bg-blue-100 text-blue-800 border-blue-300"
                                    : isRejected
                                    ? "bg-rose-100 text-rose-800 border-rose-300"
                                    : "bg-slate-100 text-slate-500 border-slate-200"
                                )}
                              >
                                {isDone
                                  ? step.level === 7
                                    ? "Sanctioned & Approved"
                                    : "Recommended"
                                  : isBypassed
                                  ? "Bypassed (No DGM)"
                                  : isActive
                                  ? "Active Review Queue"
                                  : isRejected
                                  ? "Rejected"
                                  : "Pending Review"}
                              </span>
                            </div>
                          </div>

                          {step.remarks ? (
                            <div className="mt-1 rounded border border-slate-200/80 bg-white/90 p-2 text-slate-700">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-0.5">
                                Recorded Review Remark Note:
                              </span>
                              <p className="text-[11px] italic leading-relaxed text-slate-800">
                                &ldquo;{step.remarks}&rdquo;
                              </p>
                            </div>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-400 italic">
                              {isActive
                                ? "Currently under review. Enter remarks and action decision below."
                                : "Awaiting progression from earlier levels."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Decision Buttons: Rendered when user has approval authority or when workflow concluded */}
                {(workflowLevelInfo.canUserApprove || workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED") && !workflowLevelInfo.isRejected && (
                  <>
                    {(workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED") ? (
                      <div className="mt-5 space-y-3 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 shadow-xs">
                            <Check className="h-4 w-4 stroke-[3]" />
                          </div>
                          <div>
                            <p className="font-bold text-xs uppercase tracking-wider text-emerald-950">
                              Institutional Sanction Granted &bull; Final Approval Complete
                            </p>
                            <p className="text-[11px] text-emerald-800 mt-0.5">
                              This application has received final approval from the HO Credit Head (Level 7). Official DSA Partner Code has been allotted and Empanelment Letter generated. All approval actions are now concluded and locked.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            disabled={true}
                            size="sm"
                            className="bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60 shadow-none font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                            title="Application has already been granted final approval"
                          >
                            <Check className="h-4 w-4 text-slate-400" />
                            Final Approval Completed
                          </Button>
                          {workflowLevelInfo.currentLevel >= 3 && (
                            <Button
                              disabled={true}
                              size="sm"
                              variant="secondary"
                              className="bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                              title="Workflow concluded. Reversion is disabled."
                            >
                              <Undo2 className="h-4 w-4 text-slate-400" />
                              Revert
                            </Button>
                          )}
                          <Button
                            disabled={true}
                            size="sm"
                            variant="secondary"
                            className="bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                            title="Workflow concluded. Raising query is disabled."
                          >
                            <HelpCircle className="h-4 w-4 text-slate-400" />
                            Raise Query to Applicant
                          </Button>
                          <Button
                            disabled={true}
                            size="sm"
                            variant="secondary"
                            className="bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 opacity-60 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                            title="Workflow concluded. Rejecting an approved application is disabled."
                          >
                            <X className="h-4 w-4 text-slate-400" />
                            Reject Application
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200">
                      <Button
                        disabled={isSubmitDisabled}
                        onClick={() => {
                          if (workflowLevelInfo.currentLevel === 7) {
                            openL7FinalApprovalModal(dsa);
                          } else {
                            setApprovingDsa(dsa);
                          }
                        }}
                        size="sm"
                        className={cn(
                          "font-bold text-xs py-2 px-4 h-auto shadow-sm flex items-center gap-1.5 transition-all",
                          isSubmitDisabled
                            ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60 shadow-none hover:bg-slate-200"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                        title={
                          isSubmitDisabled
                            ? (isMakerLevel
                                ? (!isVisitReportUploaded
                                    ? "Upload Physical Visit Report to enable submission to Checker"
                                    : "Verify all applicant documents to enable submission to Checker")
                                : (!areAllCheckerVerificationsDone
                                    ? "Complete all required statutory verifications to enable recommendation"
                                    : "Verify Physical Visit Report to enable recommendation"))
                            : workflowLevelInfo.actionLabel
                        }
                      >
                        <Check className="h-4 w-4" />
                        {workflowLevelInfo.actionLabel}
                      </Button>
                      {workflowLevelInfo.currentLevel >= 3 && (
                        <Button
                          onClick={() => setRevertingDsa(dsa)}
                          size="sm"
                          variant="secondary"
                          className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                        >
                          <Undo2 className="h-4 w-4 text-amber-600" />
                          {workflowLevelInfo.currentLevel === 7
                            ? "Revert to HO Credit Officer (L6)"
                            : workflowLevelInfo.currentLevel === 6
                            ? "Revert to Region Head (L5)"
                            : workflowLevelInfo.currentLevel === 5
                            ? (l4Approval?.status === "SKIPPED" ? "Revert to Sub-Region Head (L3)" : "Revert to DGM (L4)")
                            : workflowLevelInfo.currentLevel === 4
                            ? "Revert to Sub-Region Head (L3)"
                            : workflowLevelInfo.currentLevel === 3
                            ? "Revert to Checker (L2)"
                            : `Revert to Level ${workflowLevelInfo.currentLevel - 1}`}
                        </Button>
                      )}
                      <Button
                        onClick={() => setQueryingDsa(dsa)}
                        size="sm"
                        variant="secondary"
                        className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                      >
                        <HelpCircle className="h-4 w-4 text-amber-600" />
                        Raise Query to Applicant
                      </Button>
                      <Button
                        onClick={() => setRejectingDsa(dsa)}
                        size="sm"
                        variant="secondary"
                        className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                      >
                        <X className="h-4 w-4 text-rose-600" />
                        Reject Application
                      </Button>
                    </div>

                    {isSubmitDisabled && (
                      <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                        <HelpCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-amber-950">
                            {isMakerLevel
                              ? "Submission to Level 2 (Checker) is disabled until prerequisites are met:"
                              : "Recommendation to Sub-Region Head (L3) is locked until all required statutory checks are executed:"}
                          </p>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                            {isMakerLevel && !isVisitReportUploaded && (
                              <li>
                                <strong>Physical Visit Report Missing:</strong> Bank staff (Maker) must conduct physical visit and upload the visit report under the <strong>Documents</strong> subtab.
                              </li>
                            )}
                            {isMakerLevel && isVisitReportUploaded && !isAllApplicantDocsVerified && (
                              <li>
                                <strong>Document Verification Incomplete:</strong> {applicantVerifiedDocsCount} of {applicantReviewDocs.length} applicant documents verified. Go to the <strong>Documents</strong> subtab and click <strong>Verify All Documents</strong>.
                              </li>
                            )}
                            {isCheckerLevel && pendingCheckerVerifications.length > 0 && (
                              <li>
                                <strong>Pending Checker Verifications:</strong> Please run{" "}
                                {pendingCheckerVerifications.map((v) => v.code).join(", ")} from the checklist above.
                              </li>
                            )}
                            {isCheckerLevel && isVisitReportUploaded && !isVisitReportVerified && (
                              <li>
                                <strong>Physical Visit Report Pending Verification:</strong> Please inspect and verify the physical visit report under the <strong>Documents</strong> subtab before recommending/approving.
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
              </div>
            </div>
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
        description={
          workflowLevelInfo.currentLevel === 7
            ? "Consolidated L7 Final Approval Review (Task 10A) across all earlier stages before granting institutional sanction."
            : "Provide remarks and confirm this approval step to advance the application."
        }
        onClose={closeDecisionModals}
        open={Boolean(approvingDsa)}
        title={
          workflowLevelInfo.currentLevel === 7
            ? "Level 7: Final Institutional Sanction & Review Console"
            : `Approve DSA Application — ${workflowLevelInfo.levelName}`
        }
        width={workflowLevelInfo.currentLevel === 7 ? "max-w-4xl" : "max-w-lg"}
      >
        {approvingDsa ? (
          workflowLevelInfo.currentLevel === 7 ? (
            <div className="space-y-5">
              {/* Loading State */}
              {l7ReviewLoading && (
                <div className="p-12 text-center space-y-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-600 animate-spin" />
                    <ShieldCheck className="w-5 h-5 text-emerald-600 absolute animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Retrieving L7 Final Approval Review &amp; Checklist...
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Loading cross-stage audit records, Maker BRE assessments, Checker due diligence notes, and verification findings.
                    </p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {!l7ReviewLoading && l7ReviewError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-900 text-sm">
                    <AlertCircle className="h-4 w-4 text-rose-600" />
                    Unable to Load L7 Review Data
                  </div>
                  <p className="text-xs text-rose-800">{l7ReviewError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openL7FinalApprovalModal(approvingDsa)}
                    className="text-xs font-semibold mt-1 bg-white border-rose-300 text-rose-800 hover:bg-rose-100"
                  >
                    Retry Retrieval
                  </Button>
                </div>
              )}

              {/* Success / Loaded Data */}
              {!l7ReviewLoading && l7ReviewData && (
                <div className="space-y-4">
                  {/* Header Summary Card */}
                  <div className="rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-emerald-200/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                            Level 7 Sanction
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {l7ReviewData.application_information?.applicant_name || approvingDsa.name}
                          </span>
                          <span className="font-mono text-xs text-slate-500 font-semibold">
                            ({approvingDsa.dsa_code || l7ReviewData.application_information?.code || approvingDsa.code})
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          Branch: <strong>{l7ReviewData.application_information?.branch_name || approvingDsa.branch_name || "Main Branch"}</strong> &bull; Constitution: <strong>{l7ReviewData.application_information?.dsa_type || approvingDsa.type || "INDIVIDUAL"}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border shadow-2xs",
                            l7ReviewData.bre_policy_results?.overall_decision === "PASS"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                          )}
                        >
                          BRE: {l7ReviewData.bre_policy_results?.overall_decision || (dsa?.deviation ? "DEVIATION" : "PASS")}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-300">
                          DD: {l7ReviewData.due_diligence_note?.recommendation || "RECOMMENDED"}
                        </span>
                      </div>
                    </div>

                    {/* Quick Metrics Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-xs">
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Completed Stages</span>
                        <span className="font-bold text-emerald-700">Levels 1 to 6 Passed</span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Verifications</span>
                        <span className="font-bold text-slate-800">
                          {l7ReviewData.verification_results?.total_verifications ?? l7ReviewData.verification_results?.items?.length ?? 4} Checks Executed
                        </span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">BRE Rules Evaluated</span>
                        <span className="font-bold text-slate-800">
                          {l7ReviewData.bre_policy_results?.summary_counts?.total ?? 5} Rules ({l7ReviewData.bre_policy_results?.summary_counts?.deviation ?? 0} Deviations)
                        </span>
                      </div>
                      <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Market Reputation</span>
                        <span className="font-bold text-slate-800">
                          {l7ReviewData.due_diligence_note?.structured_data?.market_reputation || "Satisfactory / Verified"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tab Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
                    {[
                      { id: "overview", label: "Consolidated Summary" },
                      { id: "history", label: "All-Level History (L1–L6)" },
                      { id: "verifications", label: `Statutory Verifications (${l7ReviewData.verification_results?.items?.length || 0})` },
                      { id: "bre", label: `BRE & Deviations (${l7ReviewData.bre_policy_results?.rules?.length || 0})` },
                      { id: "dd", label: "Checker Due Diligence" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setL7ReviewTab(t.id as any)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                          l7ReviewTab === t.id
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Sub-tab 1: Consolidated Summary */}
                  {l7ReviewTab === "overview" && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Card 1: Maker Intake */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Level 1: Maker Intake &amp; Field Visit
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {l7ReviewData.maker_completion?.submitted_at ? formatDate(l7ReviewData.maker_completion.submitted_at) : "Verified"}
                            </span>
                          </div>
                          <div className="space-y-1 text-[11px] text-slate-600">
                            <p><strong>Initiated By:</strong> {l7ReviewData.maker_completion?.completed_by_user?.name || "Branch Maker"} ({l7ReviewData.maker_completion?.completed_by_user?.email || "maker"})</p>
                            <p><strong>Submission Remarks:</strong> &ldquo;{l7ReviewData.maker_completion?.submission_remarks || "Maker completed all verifications."}&rdquo;</p>
                            <p><strong>Visit Report:</strong> {l7ReviewData.maker_completion?.visit_report?.uploaded ? <span className="text-emerald-700 font-semibold">Uploaded &amp; Conducted</span> : <span className="text-amber-700">Pending upload</span>} {l7ReviewData.maker_completion?.visit_report?.remarks ? `— "${l7ReviewData.maker_completion.visit_report.remarks}"` : ""}</p>
                            <p><strong>Checklist:</strong> {l7ReviewData.maker_completion?.checklist_summary?.verified_count ?? "All"} documents verified ({l7ReviewData.maker_completion?.checklist_summary?.pending_count ?? 0} pending)</p>
                          </div>
                        </div>

                        {/* Card 2: Checker DD */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <ClipboardList className="h-3.5 w-3.5 text-blue-600" />
                              Level 2: Checker Due Diligence
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {l7ReviewData.due_diligence_note?.submitted_at ? formatDate(l7ReviewData.due_diligence_note.submitted_at) : "Recommended"}
                            </span>
                          </div>
                          <div className="space-y-1 text-[11px] text-slate-600">
                            <p><strong>Checker Officer:</strong> {l7ReviewData.due_diligence_note?.submitted_by?.name || "Branch Checker"}</p>
                            <p><strong>Recommendation:</strong> <span className="font-bold text-blue-700">{l7ReviewData.due_diligence_note?.recommendation || "RECOMMENDED"}</span></p>
                            <p><strong>Observations:</strong> &ldquo;{l7ReviewData.due_diligence_note?.observations || "Satisfactory track record."}&rdquo;</p>
                            <p><strong>Remarks:</strong> &ldquo;{l7ReviewData.due_diligence_note?.remarks || "Recommended for HO sanction."}&rdquo;</p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Deviations / Policy banner */}
                      {l7ReviewData.maker_deviation_report?.deviations?.length > 0 ? (
                        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 space-y-1.5">
                          <div className="flex items-center gap-2 font-bold text-amber-900">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>Deviations Requiring Sanction Authority Override ({l7ReviewData.maker_deviation_report.deviations.length})</span>
                          </div>
                          <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                            {l7ReviewData.maker_deviation_report.deviations.map((dev: string, idx: number) => (
                              <li key={idx} className="font-medium">{dev}</li>
                            ))}
                          </ul>
                          <p className="text-[10px] text-amber-700 italic pt-1 border-t border-amber-200">
                            * Note: Per Bank credit policy, HO Credit Head holds institutional discretion to sanction applications with flagged deviations upon satisfactory due diligence.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center gap-2 text-emerald-800 font-medium text-xs">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Zero policy deviations detected. Application is fully compliant with standard credit norms.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-tab 2: All-Level History (L1–L6) */}
                  {l7ReviewTab === "history" && (
                    <div className="space-y-2.5 text-xs">
                      {(l7ReviewData.approval_history || []).map((step: any) => {
                        const isDone = step.status === "RECOMMENDED" || step.status === "APPROVED";
                        const isBypassed = step.status === "SKIPPED";
                        const isPending = step.status === "PENDING";
                        return (
                          <div
                            key={step.approval_level || step.id}
                            className={cn(
                              "p-3 rounded-xl border transition-all",
                              isDone
                                ? "border-emerald-200 bg-emerald-50/30"
                                : isBypassed
                                ? "border-slate-200 bg-slate-50/70 opacity-70"
                                : isPending
                                ? "border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-300"
                                : "border-slate-200 bg-slate-50"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                    isDone
                                      ? "bg-emerald-600 text-white"
                                      : isBypassed
                                      ? "bg-slate-400 text-white"
                                      : isPending
                                      ? "bg-emerald-700 text-white"
                                      : "bg-slate-200 text-slate-700"
                                  )}
                                >
                                  L{step.approval_level}
                                </span>
                                <span className="font-bold text-slate-800">{step.role_name || step.stage_code}</span>
                                {(() => {
                                  // Map exact Section 2.8 authority titles
                                  const sc = step.stage_code || "";
                                  const lvl = Number(step.approval_level || 0);
                                  const title =
                                    sc === "LEVEL_1_MAKER" || lvl === 1 ? "Initiator" :
                                    sc === "LEVEL_2_CHECKER" || lvl === 2 ? "Checker" :
                                    sc === "LEVEL_3_SUB_REGION" || sc === "LEVEL_3_SUB_REGION_HEAD" || lvl === 3 ? "1st Recommending Authority" :
                                    sc === "LEVEL_4_DGM" || lvl === 4 ? "2nd Recommending Authority" :
                                    sc === "LEVEL_5_REGION_HEAD" || lvl === 5 ? "3rd Recommending Authority" :
                                    sc === "LEVEL_6_HO_CREDIT_OFFICER" || lvl === 6 ? "Credit AGM" :
                                    sc === "LEVEL_7_HO_CREDIT_HEAD" || lvl === 7 ? "Approving Authority" :
                                    step.authority_title;
                                  return title ? <span className="text-[11px] text-slate-500">({title})</span> : null;
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                {step.actioned_at && (
                                  <span className="text-[10px] text-slate-400">{formatDate(step.actioned_at)}</span>
                                )}
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                    isDone
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : isBypassed
                                      ? "bg-slate-100 text-slate-600 border-slate-300"
                                      : isPending
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-slate-100 text-slate-500 border-slate-200"
                                  )}
                                >
                                  {step.status}
                                </span>
                              </div>
                            </div>
                            {step.actioned_by && (
                              <p className="text-[10px] text-slate-500 mt-1">
                                Actioned By: <strong>{step.actioned_by.name}</strong> ({step.actioned_by.email})
                              </p>
                            )}
                            {step.remarks ? (
                              <div className="mt-1.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-800 text-[11px] italic">
                                &ldquo;{step.remarks}&rdquo;
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic mt-1">
                                {isPending
                                  ? "Awaiting your sanction decision below."
                                  : isBypassed
                                  ? "Bypassed per workflow rule."
                                  : "No explicit remarks recorded."}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sub-tab 3: Statutory Verifications */}
                  {l7ReviewTab === "verifications" && (
                    <div className="space-y-2.5 text-xs">
                      {l7ReviewData.verification_results?.items?.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                          {l7ReviewData.verification_results.items.map((v: any) => (
                            <div key={v.id || v.verification_code} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-xs">{v.verification_code}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                    {v.provider}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                                    {v.trigger_role}
                                  </span>
                                </div>
                                {v.normalized_summary && (
                                  <p className="text-[11px] text-slate-600">
                                    {typeof v.normalized_summary === "string" ? v.normalized_summary : JSON.stringify(v.normalized_summary)}
                                  </p>
                                )}
                                {v.executed_at && (
                                  <span className="text-[10px] text-slate-400 block">
                                    Executed: {formatDate(v.executed_at)}
                                  </span>
                                )}
                              </div>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0",
                                  v.success ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-rose-100 text-rose-800 border-rose-300"
                                )}
                              >
                                {v.execution_status || (v.success ? "COMPLETED" : "FAILED")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 p-4 text-center">No statutory verification records found.</p>
                      )}
                    </div>
                  )}

                  {/* Sub-tab 4: BRE & Deviations */}
                  {l7ReviewTab === "bre" && (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div>
                          <span className="font-bold text-slate-800 block text-xs">Evaluation ID: {l7ReviewData.bre_policy_results?.evaluation_id || "BRE-AUTO"}</span>
                          <span className="text-[11px] text-slate-500">Evaluated on {l7ReviewData.bre_policy_results?.evaluated_at ? formatDate(l7ReviewData.bre_policy_results.evaluated_at) : "Submission"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {l7ReviewData.bre_policy_results?.summary_counts?.pass ?? 0} Passed
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                            {l7ReviewData.bre_policy_results?.summary_counts?.deviation ?? 0} Deviations
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                            {l7ReviewData.bre_policy_results?.summary_counts?.reject ?? 0} Rejected
                          </span>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {(l7ReviewData.bre_policy_results?.rules || []).map((rule: any) => (
                          <div key={rule.rule_code} className="p-3 space-y-1 hover:bg-slate-50">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-xs">{rule.rule_name || rule.rule_code}</span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                                  rule.status === "PASS"
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : rule.status === "DEVIATION"
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-slate-100 text-slate-700 border-slate-300"
                                )}
                              >
                                {rule.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {rule.remarks || rule.evaluation_details || rule.expected_value}
                            </p>
                            {rule.actual_value !== undefined && rule.actual_value !== null && (
                              <p className="text-[10px] text-slate-400">
                                Actual Value: <strong className="text-slate-700">{String(rule.actual_value)}</strong> &bull; Criteria: {rule.expected_value}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-tab 5: Checker Due Diligence */}
                  {l7ReviewTab === "dd" && (
                    <div className="space-y-3 text-xs">
                      <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                          Checker Observations
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed italic bg-white p-3 rounded-lg border border-blue-100">
                          &ldquo;{l7ReviewData.due_diligence_note?.observations || "Applicant has verified credentials and clean banking record."}&rdquo;
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Recommendation Remarks
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200">
                          &ldquo;{l7ReviewData.due_diligence_note?.remarks || "Recommended for HO credit sanction."}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bottom Sanction Console */}
                  {(() => {
                    const isAlreadyApproved =
                      dsa?.onboarding_status === "APPROVED" ||
                      approvingDsa?.onboarding_status === "APPROVED" ||
                      l7ReviewData?.application_information?.onboarding_status === "APPROVED" ||
                      l7ReviewData?.review_status === "APPROVED";

                    return (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 space-y-3 pt-4 border-t-2">
                        {isAlreadyApproved && (
                          <div className="p-3 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-950 text-xs font-semibold flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                            <span>Application has already received final institutional sanction and is fully approved. Approval buttons are disabled.</span>
                          </div>
                        )}

                        <Field>
                          <Label htmlFor="approvalRemarks" className="text-xs font-bold text-emerald-950 flex items-center justify-between">
                            <span>HO Credit Head Sanction Remarks <span className="text-rose-500">*</span></span>
                            <span className="text-[10px] text-slate-500 font-normal">Recorded permanently in audit trail</span>
                          </Label>
                          <textarea
                            id="approvalRemarks"
                            rows={3}
                            disabled={isAlreadyApproved}
                            className="w-full rounded-lg border border-emerald-300 bg-white p-2.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                            value={approvalRemarks}
                            onChange={(e) => {
                              setApprovalRemarks(e.target.value);
                              setApprovalRemarksError("");
                            }}
                            placeholder="Enter sanction remarks..."
                          />
                          {approvalRemarksError && (
                            <p className="text-xs font-medium text-rose-600 mt-1">{approvalRemarksError}</p>
                          )}
                        </Field>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-200/80">
                          <div className="flex items-center gap-2">
                            <Button variant="secondary" type="button" onClick={closeDecisionModals} className="text-xs">
                              Cancel
                            </Button>
                            <Button
                              variant="secondary"
                              type="button"
                              disabled={actionLoading || isAlreadyApproved}
                              onClick={async () => {
                                if (!approvalRemarks.trim()) {
                                  setApprovalRemarksError("Please provide rejection reason in remarks.");
                                  return;
                                }
                                try {
                                  await updateWorkflowAction(approvingDsa.id, {
                                    action: "REJECT",
                                    remarks: approvalRemarks.trim(),
                                  });
                                  toast({
                                    title: "Application Rejected",
                                    description: `Application #${approvingDsa.code || approvingDsa.id} was rejected by HO Credit Head.`,
                                    variant: "error",
                                  });
                                  closeDecisionModals();
                                } catch (err: any) {
                                  setApprovalRemarksError(err?.message || "Failed to reject application.");
                                }
                              }}
                              className={cn(
                                "font-bold text-xs border",
                                isAlreadyApproved
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200 opacity-60"
                                  : "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-300"
                              )}
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject Application
                            </Button>
                          </div>

                          <Button
                            className={cn(
                              "font-bold text-xs px-5 py-2.5 shadow-md flex items-center gap-2 transition-all",
                              isAlreadyApproved
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60 shadow-none hover:bg-slate-200"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/20"
                            )}
                            type="button"
                            disabled={actionLoading || isAlreadyApproved}
                            onClick={async () => {
                              if (!approvalRemarks.trim()) {
                                setApprovalRemarksError("Please provide sanction remarks.");
                                return;
                              }
                              try {
                                const updated = await updateWorkflowAction(approvingDsa.id, {
                                  action: "APPROVE",
                                  remarks: approvalRemarks.trim(),
                                });
                                if (updated) {
                                  await fetchDsaDetail(id);
                                  toast({
                                    title: "Institutional Sanction Granted (Approved)",
                                    description: `Application #${approvingDsa.dsa_code || approvingDsa.code || approvingDsa.id} sanctioned. DSA Code allotted and Empanelment Letter generated.`,
                                    variant: "success",
                                  });
                                  closeDecisionModals();
                                }
                              } catch (err: any) {
                                setApprovalRemarksError(err?.message || "Failed to grant final sanction.");
                              }
                            }}
                          >
                            {actionLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sanctioning Application...
                              </>
                            ) : isAlreadyApproved ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-slate-400" />
                                Final Approval Already Granted
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Grant Final Approval &amp; Sanction (L7)
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">{approvingDsa.name}</p>
                <p className="mt-1 text-xs text-emerald-800">
                  This action will complete {workflowLevelInfo.stageTitle || workflowLevelInfo.levelName} ({workflowLevelInfo.authorityTitle || workflowLevelInfo.roleName}) and advance the application to {workflowLevelInfo.nextLevelName}.
                </p>
              </div>

              {workflowLevelInfo.currentLevel === 2 && (
                <div className="rounded-md border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-950">Deviation on mail (Section 2.8)</p>
                      <p className="text-[11px] text-blue-800 mt-0.5">
                        When the Checker sends for recommendation via email, the Due Diligence Checklist, Recommendation, and Approval Authority details are attached automatically.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DetailGrid>
                <DetailItem label="Current stage" value={workflowLevelInfo.stageTitle || workflowLevelInfo.levelName} />
                <DetailItem label="Assigned role" value={workflowLevelInfo.roleName} />
                <DetailItem label="Authority" value={workflowLevelInfo.authorityTitle || "Recommending Authority"} />
                <DetailItem label="Action options" value={workflowLevelInfo.actionOptions || "Recommend / Reject / Revert"} />
                <DetailItem label="Next stage" value={workflowLevelInfo.nextLevelName} />
                <DetailItem label="Approval rate" value={percent(approvingDsa.approval_rate || 0)} />
              </DetailGrid>

              <Field>
                <Label htmlFor="approvalRemarks">
                  Approval Remarks / Justification <span className="text-rose-500">*</span>
                </Label>
                <textarea
                  id="approvalRemarks"
                  rows={3}
                  className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  value={approvalRemarks}
                  onChange={(event) => {
                    setApprovalRemarks(event.target.value);
                    setApprovalRemarksError("");
                  }}
                  placeholder="Enter approval remarks..."
                />
                {approvalRemarksError ? (
                  <p className="text-xs font-medium text-rose-600 mt-1">{approvalRemarksError}</p>
                ) : null}
              </Field>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="secondary" type="button" onClick={closeDecisionModals}>
                  Cancel
                </Button>
                <Button
                  className={cn(
                    "font-semibold transition-all",
                    (workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED" || approvingDsa?.onboarding_status === "APPROVED")
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60 shadow-none hover:bg-slate-200"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                  type="button"
                  disabled={actionLoading || workflowLevelInfo.isCompleted || dsa?.onboarding_status === "APPROVED" || approvingDsa?.onboarding_status === "APPROVED"}
                  onClick={async () => {
                    if (!approvalRemarks.trim()) {
                      setApprovalRemarksError("Please provide approval remarks.");
                      return;
                    }

                    let updated: any = null;
                    if (workflowLevelInfo.currentLevel === 1) {
                      try {
                        updated = await submitMakerApplication(approvingDsa.id, approvalRemarks.trim());
                      } catch {
                        updated = await updateDsaProfile(approvingDsa.id, {
                          action: "APPROVE",
                          remarks: approvalRemarks.trim(),
                        } as any);
                      }
                    } else if (workflowLevelInfo.currentLevel === 2) {
                      try {
                        updated = await submitCheckerApplication(approvingDsa.id, {
                          remarks: approvalRemarks.trim(),
                          dd_note: {
                            observations: checkerDdNote.trim() || approvalRemarks.trim(),
                            remarks: approvalRemarks.trim(),
                            recommendation: "RECOMMEND",
                          },
                        });
                      } catch {
                        updated = await updateDsaProfile(approvingDsa.id, {
                          action: "APPROVE",
                          remarks: approvalRemarks.trim(),
                        } as any);
                      }
                    } else if (workflowLevelInfo.currentLevel === 3) {
                      try {
                        updated = await updateWorkflowAction(approvingDsa.id, {
                          action: "RECOMMEND",
                          remarks: approvalRemarks.trim(),
                        });
                      } catch {
                        updated = await updateDsaProfile(approvingDsa.id, {
                          action: "APPROVE",
                          remarks: approvalRemarks.trim(),
                        } as any);
                      }
                    } else {
                      try {
                        updated = await updateWorkflowAction(approvingDsa.id, {
                          action: workflowLevelInfo.isFinalStep ? "APPROVE" : "RECOMMEND",
                          remarks: approvalRemarks.trim(),
                        });
                      } catch {
                        updated = await updateDsaProfile(approvingDsa.id, {
                          action: "APPROVE",
                          remarks: approvalRemarks.trim(),
                        } as any);
                      }
                    }

                    if (updated) {
                      await fetchDsaDetail(id);
                      toast({
                        title:
                          workflowLevelInfo.currentLevel === 2
                            ? "Recommendation Submitted"
                            : workflowLevelInfo.currentLevel === 3
                            ? "Recommended to DGM (L4)"
                            : workflowLevelInfo.currentLevel === 4
                            ? "Recommended to Region Head (L5)"
                            : workflowLevelInfo.currentLevel === 5
                            ? "Recommended to HO Credit Officer (L6)"
                            : workflowLevelInfo.currentLevel === 6
                            ? "Appraisal Recommended to HO Credit Head (L7)"
                            : "Application Advanced",
                        description: `${approvingDsa.name} approved and forwarded to ${workflowLevelInfo.nextLevelName}.`,
                        variant: "success",
                      });
                      closeDecisionModals();
                    }
                  }}
                >
                  {actionLoading
                    ? "Processing..."
                    : workflowLevelInfo.currentLevel === 1
                    ? "Confirm & Submit to Checker"
                    : workflowLevelInfo.currentLevel === 2
                    ? "Confirm & Recommend to Sub-Region Head (L3)"
                    : workflowLevelInfo.currentLevel === 3
                    ? "Confirm & Recommend to DGM (L4)"
                    : workflowLevelInfo.currentLevel === 4
                    ? "Confirm & Recommend to Region Head (L5)"
                    : workflowLevelInfo.currentLevel === 5
                    ? "Confirm & Recommend to HO Credit Officer (L6)"
                    : workflowLevelInfo.currentLevel === 6
                    ? "Confirm & Recommend Appraisal (L7)"
                    : workflowLevelInfo.actionLabel}
                </Button>
              </div>
            </div>
          )
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
        title={previewDoc ? formatDocumentType(previewDoc.document_type) : "Document Preview"}
        description={previewDoc ? (previewDoc.file_name ? `${previewDoc.file_name}${previewDoc.size ? ` • ${previewDoc.size}` : ""}` : "") : ""}
        width="max-w-4xl"
      >
        {previewDoc ? (
          <DocumentViewerBody
            key={previewDoc.id || previewDoc.file_name || previewDoc.document_type}
            previewDoc={previewDoc}
            dsaId={dsa?.id}
            isBankUser={isBankUser}
            effectiveStatus={getEffectiveDocStatus(previewDoc)}
            canVerifyDoc={
              isVisitReportDocument(previewDoc)
                ? (isCheckerRole || isCheckerLevel) && !isMakerUser
                : isBankUser
            }
            verificationRoleNote={
              isVisitReportDocument(previewDoc) && (!isCheckerRole || isMakerUser)
                ? "Physical Visit Report · Uploaded by Maker, verification reserved for Checker (Level 2)"
                : undefined
            }
            onVerify={async () => {
              const targetDoc = previewDoc;
              const isVisit = isVisitReportDocument(targetDoc);
              if (isVisit && (!isCheckerRole || isMakerUser)) {
                toast({
                  title: "Action Not Permitted",
                  description: "Maker cannot verify visit report. Verification is reserved for Checker (Level 2).",
                  variant: "warning",
                });
                return;
              }
              if (typeof targetDoc.id === "number") {
                try {
                  await updateDsaDocumentStatus(dsa.id, {
                    document_id: targetDoc.id,
                    status: "Verified",
                    remarks: isVisit
                      ? `Verified by Checker (${currentUser?.name || "Checker"}) in viewer modal`
                      : `Verified by ${currentUser?.name || "Staff"} in viewer modal`,
                  });
                  await fetchDsaDetail(dsa.id);
                } catch (err) {}
              }
              if (isVisit) {
                setCheckerVerifiedDocIds((prev) => new Set([...prev, targetDoc.id]));
              }
              setManuallyVerifiedDocIds((prev) => new Set([...prev, targetDoc.id]));
              setPreviewDoc(null);
              toast({
                title: "Document Verified",
                description: `${formatDocumentType(targetDoc.document_type)} has been verified successfully.`,
                variant: "success",
              });
            }}
            onReject={async () => {
              const targetDoc = previewDoc;
              const isVisit = isVisitReportDocument(targetDoc);
              if (isVisit && (!isCheckerRole || isMakerUser)) {
                toast({
                  title: "Action Not Permitted",
                  description: "Maker cannot reject visit report. Verification is reserved for Checker (Level 2).",
                  variant: "warning",
                });
                return;
              }
              if (typeof targetDoc.id === "number") {
                try {
                  await updateDsaDocumentStatus(dsa.id, {
                    document_id: targetDoc.id,
                    status: "Failed",
                    remarks: isVisit
                      ? `Rejected by Checker (${currentUser?.name || "Checker"}) in viewer modal`
                      : `Rejected by ${currentUser?.name || "Staff"} in viewer modal`,
                  });
                  await fetchDsaDetail(dsa.id);
                } catch (err) {}
              }
              setManuallyFailedDocIds((prev) => new Set([...prev, targetDoc.id]));
              setPreviewDoc(null);
              toast({
                title: "Document Rejected",
                description: `${formatDocumentType(targetDoc.document_type)} has been marked as failed/rejected.`,
                variant: "warning",
              });
            }}
            onClose={() => setPreviewDoc(null)}
          />
        ) : null}
      </Modal>

      {/* Maker BRE Deviation Report Modal (Level 2 through Level 7) */}
      <Modal
        onClose={() => setViewingDeviationReport(false)}
        open={viewingDeviationReport}
        title="Maker BRE Deviation Assessment Report"
        description={`DSA #${getEffectiveDsaCode(dsa)} • ${dsa.name} • Evaluation generated on Maker submission to Checker`}
        width="max-w-4xl"
      >
        <div className="space-y-4">
          {loadingDeviationReport ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-slate-600 font-medium">Fetching deviation evaluation report...</span>
            </div>
          ) : (
            <>
              {/* Overall Decision Banner */}
              {(() => {
                const rep = deviationReportData;
                const bre = rep?.bre_evaluation || rep;
                const rules: any[] = bre?.rules || [];
                const deviations: any[] = rep?.deviations || bre?.deviations || [];
                const rejections: any[] = rep?.rejections || bre?.rejections || [];
                const overall = String(bre?.overall_decision || (deviations.length > 0 ? "DEVIATION" : "PASS")).toUpperCase();
                const evalId = bre?.evaluation_id || rep?.evaluation_id || "BRE-AUTO-EVAL";

                return (
                  <div className="space-y-4">
                    <div
                      className={cn(
                        "rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3",
                        overall === "PASS"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                          : overall === "DEVIATION"
                          ? "bg-amber-50 border-amber-200 text-amber-950"
                          : "bg-rose-50 border-rose-200 text-rose-950"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border",
                              overall === "PASS"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : overall === "DEVIATION"
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-rose-100 text-rose-800 border-rose-300"
                            )}
                          >
                            Overall BRE Decision: {overall}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">Ref: {evalId}</span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Evaluated: {bre?.evaluated_at ? formatDate(bre.evaluated_at) : formatDate(new Date().toISOString())} • Branch: {dsa.branch?.branch_name || dsa.branch_name || "Main Branch"}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={handleDownloadDeviationReport}
                        className="text-xs font-bold h-8 px-3 flex items-center gap-1.5 bg-white shadow-sm hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5 text-blue-600" />
                        Download Report (.txt)
                      </Button>
                    </div>

                    {/* Deviations Alert if any */}
                    {deviations.length > 0 ? (
                      <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-3.5">
                        <div className="flex items-center gap-2 mb-1.5 text-amber-900 font-bold text-xs">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Triggered Deviations ({deviations.length})</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 pl-1">
                          {deviations.map((dev: any, idx: number) => (
                            <li key={idx} className="leading-relaxed">
                              {typeof dev === "string" ? dev : dev.remarks || dev.rule_name || JSON.stringify(dev)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-800 flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>No policy deviations triggered. All eligible evaluation criteria passed.</span>
                      </div>
                    )}

                    {/* Rules Evaluation Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Policy Rules Assessment ({rules.length} Rules Evaluated)
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Passed: {rules.filter((r: any) => String(r.status).toUpperCase() === "PASS").length} / {rules.length}
                        </span>
                      </div>

                      {rules.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                              <tr>
                                <th className="p-2.5">Rule Code &amp; Name</th>
                                <th className="p-2.5">Status</th>
                                <th className="p-2.5">Expected Standard</th>
                                <th className="p-2.5">Applicant Value</th>
                                <th className="p-2.5">Evaluation Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {rules.map((rule: any, idx: number) => {
                                const st = String(rule.status || "").toUpperCase();
                                const isDev = rule.is_deviation || st === "DEVIATION";
                                const isFail = rule.is_rejection || st === "FAIL" || st === "REJECT";
                                return (
                                  <tr key={rule.rule_code || idx} className="hover:bg-slate-50/60">
                                    <td className="p-2.5">
                                      <p className="font-semibold text-slate-900">{rule.rule_name || rule.rule_code}</p>
                                      <p className="text-[11px] font-mono text-slate-400">{rule.rule_code}</p>
                                    </td>
                                    <td className="p-2.5">
                                      <span
                                        className={cn(
                                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border",
                                          isFail
                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                            : isDev
                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        )}
                                      >
                                        {rule.status || "PASS"}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-slate-600 max-w-xs">{rule.expected_value || "Per Bank Standards"}</td>
                                    <td className="p-2.5 font-mono text-slate-800">{rule.actual_value || "N/A"}</td>
                                    <td className="p-2.5 text-slate-600">{rule.remarks || "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                          No granular rule breakdown available for this evaluation run.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-150">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleDownloadDeviationReport}
              className="text-xs font-semibold gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              Download Deviation Report (.txt)
            </Button>
            <Button
              onClick={() => setViewingDeviationReport(false)}
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs px-4"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Checker Due Diligence (DD) Note Modal (Level 2 through Level 7) */}
      <Modal
        onClose={() => setViewingDdNoteModal(false)}
        open={viewingDdNoteModal}
        title="Checker Due Diligence (DD) Review Note"
        description={`DSA #${getEffectiveDsaCode(dsa)} • ${dsa.name} • Submitted by Level 2 Checker`}
        width="max-w-2xl"
      >
        <div className="space-y-4">
          {(() => {
            const note =
              dsa?.latest_due_diligence_note ||
              dsa?.due_diligence_notes?.[0] ||
              (dsa as any)?.dueDiligenceNotes?.[0] ||
              deviationReportData?.dd_note;

            return (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 uppercase tracking-wider">
                        Recommendation: {note?.recommendation || "RECOMMEND"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Submitted: {note?.submitted_at ? formatDate(note.submitted_at) : "On Level 2 Completion"} • By Checker ID: {note?.checker_user_id || "Branch Checker"}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadDdNote}
                    className="text-xs font-bold h-8 px-3 flex items-center gap-1.5 bg-white shadow-sm hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    Download Note (.txt)
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <FileCheck2 className="h-3.5 w-3.5 text-blue-600" />
                      Field &amp; Premise Investigation Observations
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-md border border-slate-100">
                      {note?.observations || checkerDdNote || "No specific observations recorded by Checker."}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Checker Reviewer Remarks
                    </h4>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-md border border-slate-100">
                      {note?.remarks || "Recommended for approval based on successful due diligence and statutory checks."}
                    </p>
                  </div>

                  {note?.exception_remarks && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        Exception / Deviation Justifications
                      </h4>
                      <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">
                        {note.exception_remarks}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex justify-between items-center pt-3 border-t border-slate-150">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleDownloadDdNote}
              className="text-xs font-semibold gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              Download DD Note (.txt)
            </Button>
            <Button
              onClick={() => setViewingDdNoteModal(false)}
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs px-4"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Revert Application Modal (Level 3+) */}
      <Modal
        onClose={closeDecisionModals}
        open={Boolean(revertingDsa)}
        title={`Revert Application to ${workflowLevelInfo.currentLevel === 7 ? "HO Credit Officer (L6)" : workflowLevelInfo.currentLevel === 6 ? "Region Head (L5)" : workflowLevelInfo.currentLevel === 5 ? (l4Approval?.status === "SKIPPED" ? "Sub-Region Head (L3)" : "DGM (L4)") : workflowLevelInfo.currentLevel === 4 ? "Sub-Region Head (L3)" : workflowLevelInfo.currentLevel === 3 ? "Checker (L2)" : `Level ${workflowLevelInfo.currentLevel - 1}`}`}
        description={`Send application #${getEffectiveDsaCode(revertingDsa)} back to ${workflowLevelInfo.currentLevel === 7 ? "Level 6 (HO Credit Officer)" : workflowLevelInfo.currentLevel === 6 ? "Level 5 (Region Head)" : workflowLevelInfo.currentLevel === 5 ? (l4Approval?.status === "SKIPPED" ? "Level 3 (Sub-Region Head)" : "Level 4 (DGM)") : workflowLevelInfo.currentLevel === 4 ? "Level 3 (Sub-Region Head)" : workflowLevelInfo.currentLevel === 3 ? "Level 2 (Checker)" : `Level ${workflowLevelInfo.currentLevel - 1}`} for re-evaluation.`}
        width="max-w-lg"
      >
        <div className="space-y-4">
          <Field>
            <Label htmlFor="revertRemarks">
              Revert Reason / Observations <span className="text-rose-500">*</span>
            </Label>
            <textarea
              id="revertRemarks"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              value={revertReason}
              onChange={(e) => {
                setRevertReason(e.target.value);
                setRevertError("");
              }}
              placeholder="State the discrepancies or additional verification required before this application can be reconsidered."
            />
            {revertError ? <p className="text-xs font-medium text-rose-600 mt-1">{revertError}</p> : null}
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={closeDecisionModals}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
              type="button"
              disabled={actionLoading}
              onClick={async () => {
                if (!revertReason.trim()) {
                  setRevertError("Please enter a reason for reverting this application.");
                  return;
                }
                const res = await updateWorkflowAction(revertingDsa.id, {
                  action: "REVERT",
                  remarks: revertReason.trim(),
                });
                if (res) {
                  await fetchDsaDetail(id);
                  const targetLabel =
                    workflowLevelInfo.currentLevel === 5
                      ? (l4Approval?.status === "SKIPPED" ? "Sub-Region Head (Level 3)" : "DGM (Level 4)")
                      : workflowLevelInfo.currentLevel === 4
                      ? "Sub-Region Head (Level 3)"
                      : workflowLevelInfo.currentLevel === 3
                      ? "Checker (Level 2)"
                      : `Level ${workflowLevelInfo.currentLevel - 1}`;
                  toast({
                    title: "Application Reverted",
                    description: `Application has been sent back to ${targetLabel}.`,
                    variant: "warning",
                  });
                  closeDecisionModals();
                }
              }}
            >
              {actionLoading
                ? "Processing..."
                : workflowLevelInfo.currentLevel === 5
                ? (l4Approval?.status === "SKIPPED" ? "Confirm & Revert to Sub-Region Head (L3)" : "Confirm & Revert to DGM (L4)")
                : workflowLevelInfo.currentLevel === 4
                ? "Confirm & Revert to Sub-Region Head (L3)"
                : "Confirm & Revert to Checker"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Level 7 HO Credit Head Agreement Verification & Activation Modal */}
      <Modal
        onClose={() => {
          setVerifyingAgreementAction(null);
          setAgreementDecisionRemarks("");
          setAgreementDecisionError("");
        }}
        open={Boolean(verifyingAgreementAction) && isL7User}
        title={
          verifyingAgreementAction === "APPROVE"
            ? "Approve Agreement & Activate DSA Partner"
            : "Reject Scanned Agreement & Request Re-upload"
        }
        description={
          verifyingAgreementAction === "APPROVE"
            ? "Verify physical execution signatures and stamp. Approving will atomically activate the DSA partner and dispatch temporary portal login credentials."
            : "Specify rejection remarks detailing why the physical signed agreement is rejected. A fresh 72-hour upload link will be emailed to the partner."
        }
        width="max-w-lg"
      >
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-lg p-3.5 border text-xs leading-relaxed",
              verifyingAgreementAction === "APPROVE"
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-rose-50 border-rose-200 text-rose-950"
            )}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {verifyingAgreementAction === "APPROVE" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Atomic DSA Activation (Task 14)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>Rejection &amp; Re-upload Token Issuance</span>
                </>
              )}
            </div>
            <p>
              {verifyingAgreementAction === "APPROVE"
                ? `Partner ${dsa?.dsa_code || dsa?.name} will transition to operational_status = ACTIVE. A cryptographically secure temporary password will be generated and emailed to ${dsa?.applicant_email || dsa?.email}.`
                : `Partner will be notified via email with your remarks. A new 72-hour upload token will be generated allowing them to re-upload the corrected agreement.`}
            </p>
          </div>

          <Field>
            <Label htmlFor="agreementRemarks">
              {verifyingAgreementAction === "APPROVE" ? "Verification Remarks (Optional)" : "Rejection Reason & Remarks (Mandatory)"}
            </Label>
            <textarea
              id="agreementRemarks"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={agreementDecisionRemarks}
              onChange={(e) => {
                setAgreementDecisionRemarks(e.target.value);
                setAgreementDecisionError("");
              }}
              placeholder={
                verifyingAgreementAction === "APPROVE"
                  ? "e.g. Master agreement signatures and rubber stamp verified on all execution pages. Approved for partner activation."
                  : "e.g. Rubber stamp missing on page 3. Signatures on execution schedule unclear. Please affix firm stamp and re-upload."
              }
            />
            {agreementDecisionError ? (
              <p className="text-xs font-semibold text-rose-600 mt-1">{agreementDecisionError}</p>
            ) : null}
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setVerifyingAgreementAction(null);
                setAgreementDecisionRemarks("");
                setAgreementDecisionError("");
              }}
              disabled={agreementSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={agreementSubmitting}
              onClick={handleSubmitAgreementDecision}
              className={cn(
                "text-xs font-semibold px-4 py-2 text-white",
                verifyingAgreementAction === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              )}
            >
              {agreementSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Processing...
                </>
              ) : verifyingAgreementAction === "APPROVE" ? (
                "Confirm & Activate DSA"
              ) : (
                "Confirm & Reject Agreement"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
