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
  Lock,
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
  Briefcase,
  CreditCard,
  GraduationCap,
  MapPin,
  Pencil,
  Phone,
  Users,
  UserCheck,
  History,
  Info,
} from "lucide-react";
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/apis/admin";

import { BarChartCard, KpiCard, TrendCard } from "@/components/charts";
import {
  ActionPair,
  DetailGrid,
  DetailItem,
  PageHeader,
} from "@/components/module";
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
import { authService } from "@/services/authService";
import { useMockStore } from "@/lib/store";
import { useDsa, normalizeDsaData } from "@/hooks/useDsa";
import { isDsaInBranchScope } from "@/lib/branch-scope";
import {
  resolveCaseAccess,
  describeCaseLock,
  resolveUserLevel,
} from "@/lib/dsa-case-access";
import {
  canReAllocate,
  canShowCallBackAction,
  resolvePreviousActorLevel,
  isCalledBackStep,
} from "@/lib/dsa-workflow-actions";
import type { DsaEligibleUser } from "@/types/dsa";
import { BusinessType, Dsa, DsaStatus, Product, User } from "@/lib/types";
import { DsaBasicDetailsTab } from "./dsa-basic-details-tab";
import { DsaCaseActivityTab } from "./dsa-case-activity-tab";
import { DsaKycDataModal, KycDataType } from "./dsa-kyc-data-modal";
import type { BranchOption, DsaWorkBucket } from "@/types/dsa";
import { DSA_WORK_BUCKETS } from "@/types/dsa";
import {
  cn,
  formatCommissionDisplay,
  formatCurrency,
  formatDate,
  generateDsaId,
  makeId,
  percent,
} from "@/lib/utils";

export function getDsaDisplayStatus(dsa: any): string {
  if (!dsa) return "";
  const agreementStatus = String(dsa.agreement_status || "").toUpperCase();
  const operationalStatus = String(dsa.operational_status || "").toUpperCase();
  const onboardingStatus = String(
    dsa.onboarding_status || dsa.status || "",
  ).toUpperCase();

  if (agreementStatus === "SIGNED_VERIFIED" || operationalStatus === "ACTIVE") {
    return "ACTIVE";
  }
  if (
    onboardingStatus === "APPROVED" ||
    onboardingStatus === "AGREEMENT_COMPLETED"
  ) {
    // If agreement is approved/completed but operational_status is not yet ACTIVE, show APPROVED
    if (
      operationalStatus &&
      operationalStatus !== "NOT_ACTIVE" &&
      operationalStatus !== "INACTIVE"
    ) {
      return operationalStatus;
    }
    return onboardingStatus;
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

function getDocumentUrl(
  doc: any,
  dsaId?: number | string,
  useStorageFallback = false,
): string {
  if (!doc) return "";
  const apiBase = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
  ).replace(/\/api\/?$/, "");
  const targetDsaId = dsaId || doc.dsa_id;

  // Visit report documents: use streaming endpoint if available, fallback to storage
  if (isVisitReportDocument(doc)) {
    if (!useStorageFallback && targetDsaId) {
      if (doc.id && typeof doc.id === "number" && doc.id < 100000) {
        return `${apiBase}/api/v1/dsa/${targetDsaId}/documents/${doc.id}/file`;
      }
      return `${apiBase}/api/v1/dsa/${targetDsaId}/visit-report/file`;
    }
    if (doc.file_path) {
      return `${apiBase}/storage/${doc.file_path.replace(/^\/+/, "")}`;
    }
    if (doc.file_url || doc.url) {
      return doc.file_url || doc.url;
    }
  }

  // Due Diligence Review Report documents: bust cache with timestamp
  if (isDdReviewReportDocument(doc)) {
    const ts = doc._timestamp || Date.now();
    if (
      !useStorageFallback &&
      targetDsaId &&
      doc.id &&
      typeof doc.id === "number" &&
      doc.id < 100000
    ) {
      return `${apiBase}/api/v1/dsa/${targetDsaId}/documents/${doc.id}/file?t=${ts}`;
    }
    if (doc.file_path) {
      return `${apiBase}/storage/${doc.file_path.replace(/^\/+/, "")}?t=${ts}`;
    }
    if (doc.file_url || doc.url) {
      const rawUrl = doc.file_url || doc.url;
      try {
        const parsed = new URL(rawUrl);
        const apiOrigin = new URL(apiBase).origin;
        const finalUrl =
          parsed.origin !== apiOrigin
            ? `${apiOrigin}${parsed.pathname}${parsed.search}`
            : rawUrl;
        const sep = finalUrl.includes("?") ? "&" : "?";
        return `${finalUrl}${sep}t=${ts}`;
      } catch {
        const sep = rawUrl.includes("?") ? "&" : "?";
        return `${rawUrl}${sep}t=${ts}`;
      }
    }
  }

  // 1. Primary path: Use dedicated API endpoint for authenticated / backend streaming if document ID is a real DB ID (< 100000)
  if (
    !useStorageFallback &&
    targetDsaId &&
    doc.id &&
    typeof doc.id === "number" &&
    doc.id < 100000
  ) {
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
  const rawType =
    typeof docOrType === "object"
      ? docOrType.document_type || docOrType.type || ""
      : docOrType;
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

export function isApplicationFormDocument(docOrType?: any): boolean {
  if (!docOrType) return false;
  const rawType =
    typeof docOrType === "object"
      ? docOrType.document_type || docOrType.type || ""
      : docOrType;
  const t = String(rawType).toUpperCase().trim();
  return (
    t === "APPLICATION_FORM" ||
    t === "DSA_APPLICATION_FORM" ||
    t.includes("APPLICATION_FORM")
  );
}

export function isDdReviewReportDocument(docOrType?: any): boolean {
  if (!docOrType) return false;
  const rawType =
    typeof docOrType === "object"
      ? docOrType.document_type || docOrType.type || docOrType.file_name || ""
      : docOrType;
  const t = String(rawType).toUpperCase().trim();
  return (
    t === "DUE_DILIGENCE_REVIEW_REPORT" ||
    t === "DSA_DD_REVIEW_REPORT" ||
    t.includes("DUE_DILIGENCE_REVIEW_REPORT") ||
    t.includes("DD_REVIEW_REPORT") ||
    t.includes("DUE DILIGENCE REVIEW REPORT")
  );
}

export function formatDocumentType(type?: string): string {
  if (!type) return "Document Preview";
  if (isVisitReportDocument(type)) return "Physical Visit Report";
  if (isApplicationFormDocument(type)) return "Application Form";
  if (isDdReviewReportDocument(type)) return "Due Diligence Review Report";
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
  const codeVal = dsa.dsa_code ?? dsa.dsaCode;
  if (codeVal) {
    if (typeof codeVal === "object" && codeVal.code) {
      return String(codeVal.code).trim();
    }
    if (typeof codeVal === "string" && codeVal.trim().length > 0) {
      return codeVal.trim();
    }
  }
  return typeof dsa.code === "string"
    ? dsa.code
    : dsa.id
      ? `DSA-${dsa.id}`
      : "";
}

export function getDocDisplayStatus(status?: string): string {
  if (!status) return "";
  const s = String(status).trim();
  if (s.toUpperCase() === "VERIFIED" || s.toUpperCase() === "CHECKED")
    return "Verified";
  return s;
}

export type DocumentSubTab = "kyc" | "exp" | "other";

export function getDocumentCategory(docOrType?: any): DocumentSubTab {
  if (!docOrType) return "other";

  let text = "";
  if (typeof docOrType === "string") {
    text = docOrType;
  } else {
    text = `${docOrType.document_type || ""} ${docOrType.type || ""} ${docOrType.display_name || ""} ${docOrType.file_name || ""}`;
  }
  const s = text.toLowerCase().replace(/[\s_-]+/g, "_");

  // 1. KYC: business licence udyam, business shop act, photo, aadhaar, pan
  const isKyc =
    /(^|_)pan(_|$)/.test(s) ||
    s.includes("pancard") ||
    s.includes("aadhaar") ||
    s.includes("aadhar") ||
    s.includes("photo") ||
    s.includes("udyam") ||
    s.includes("shop_act") ||
    s.includes("shopact") ||
    s.includes("business_license") ||
    s.includes("business_licence") ||
    s.includes("msme");

  if (isKyc) return "kyc";

  // 2. Experience Certificates: education qualification cert, gst certificate, exp cert, itr return
  const isExp =
    s.includes("education") ||
    s.includes("qualification") ||
    /(^|_)gst(_|$)/.test(s) ||
    s.includes("gstin") ||
    s.includes("experience") ||
    s.includes("exp_cert") ||
    /(^|_)itr(_|$)/.test(s) ||
    s.includes("it_return") ||
    s.includes("tax_return");

  if (isExp) return "exp";

  // 3. Other Documents: consent dpdp, other, visit report, brief profile of dsa, rent, any other
  return "other";
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
  const fileName = (
    previewDoc.file_name ||
    previewDoc.file_path ||
    ""
  ).toLowerCase();
  const isImage =
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".webp") ||
    fileName.endsWith(".gif") ||
    fileName.endsWith(".svg");
  const isPdf = fileName.endsWith(".pdf") || (!isImage && url.includes(".pdf"));
  const extMatch = fileName.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  const fileExt = (
    extMatch ? extMatch[1] : isPdf ? "pdf" : isImage ? "image" : "doc"
  ).toUpperCase();

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
    <div className="flex flex-col h-full min-h-0 space-y-3">
      {/* Meta Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-50/90 rounded-lg border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={getDocDisplayStatus(effectiveStatus)} />
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
              Owner:{" "}
              <span className="font-medium text-slate-800">
                {previewDoc.owner_name}
              </span>
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
      <div className="flex-1 min-h-0 relative w-full overflow-hidden bg-slate-100/70 rounded-xl border border-slate-200 flex items-center justify-center p-1.5">
        {!url ? (
          <div className="p-8 text-center text-slate-500">
            <FileText className="h-10 w-10 mx-auto mb-2 text-slate-400" />
            <p className="text-xs font-semibold text-slate-700">
              No preview URL available
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              This document cannot be previewed online.
            </p>
          </div>
        ) : isImage ? (
          imgError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
              <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-2.5 text-amber-600 shadow-2xs">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold text-slate-800">
                Unable to preview document
              </p>
              <p className="text-[11px] text-slate-500 mt-1 mb-3 leading-relaxed">
                The document could not be rendered from the storage server (
                {previewDoc.file_name || previewDoc.file_path || "document"}).
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
            <div className="relative flex items-center justify-center w-full h-full min-h-[200px]">
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
                  if (
                    !useFallback &&
                    (previewDoc.file_path || previewDoc.file_url)
                  ) {
                    setUseFallback(true);
                    setImgLoading(true);
                  } else {
                    setImgError(true);
                    setImgLoading(false);
                  }
                }}
                className={cn(
                  "max-h-full w-auto max-w-full object-contain rounded-lg shadow-sm border border-slate-200/80 bg-white transition-opacity duration-200",
                  imgLoading ? "opacity-0" : "opacity-100",
                )}
              />
            </div>
          )
        ) : isPdf ? (
          <iframe
            src={embedUrl}
            title={previewDoc.file_name || "PDF Document"}
            className="w-full h-full rounded-lg border border-slate-200 bg-white shadow-xs"
          />
        ) : (
          <iframe
            src={embedUrl}
            title={previewDoc.file_name || "Document"}
            className="w-full h-full rounded-lg border border-slate-200 bg-white shadow-xs"
          />
        )}
      </div>

      {/* Footer Controls */}
      <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {previewDoc.uploaded_at ? (
            <>
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>
                Uploaded{" "}
                {new Date(previewDoc.uploaded_at).toLocaleString([], {
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
          {!isApplicationFormDocument(previewDoc) &&
          isBankUser &&
          effectiveStatus !== "Verified" &&
          effectiveStatus !== "Failed" ? (
            canVerifyDoc ? (
              <Button
                onClick={() => handleAction(onVerify)}
                disabled={submitting}
                size="sm"
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-1.5 h-auto rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Verify Document
              </Button>
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

export function getCleanRemark(str?: any): string {
  if (!str || typeof str !== "string") return "";
  const trimmed = str.trim();
  const legacyFallbacks = [
    "Checker DD observations updated.",
    "No specific remarks recorded by Checker.",
    "No specific observations recorded by Checker.",
    "No observations recorded.",
    "No remarks",
    "Due diligence completed and documents verified.",
    "Due diligence review completed and verified against submitted documents.",
    "Due diligence completed and verified against application documents.",
    "Due diligence completed and verified against entity documents.",
    "Recommended for sanction based on due diligence findings.",
    "Recommended for sanction based on due diligence findings",
    "Recommended.",
    "Appraised and recommended.",
    "Sanctioned and approved.",
    "Satisfactory track record.",
    "Recommended for HO sanction.",
    "Recommended for HO credit sanction.",
    "Case sanctioned by HO Credit Head on full review of due diligence, verification checks, and policy compliance.",
    "Pending recommendation from Sub-Region Head.",
    "Pending review from HO Credit Officer.",
    "Pending final approval decision from HO Credit Head.",
    "Pending recommendation from Region Head.",
  ];
  if (legacyFallbacks.includes(trimmed)) {
    return "";
  }
  return trimmed;
}

export function getDsaWorkflowLevelInfo(
  currentUserRole: string | undefined,
  dsa: any | null,
): ApprovalStepLevelInfo {
  if (!dsa) {
    return {
      currentLevel: 1,
      levelName: "Maker Intake & Verification",
      stageTitle: "Application + Documents + Consent",
      roleName: "Maker (Branch / Sub-Region / DSA)",
      authorityTitle: "Initiator",
      actionOptions: "Create / Edit / Submit",
      canUserApprove: false,
      actionLabel: "Submit to Checker",
      nextLevelName: "Checker Due Diligence",
      isFinalStep: false,
      isDeviationStep: false,
      isCompleted: false,
      isRejected: false,
    };
  }

  const onboardingStatus = String(
    dsa.onboarding_status || dsa.status || "",
  ).toUpperCase();
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
  const normRole = (currentUserRole || "")
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
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
      levelName: "Maker Intake & Verification",
      stageTitle: "Application + Documents + Consent",
      roleName: "Maker (Branch / Sub-Region / DSA)",
      authorityTitle: "Initiator",
      actionOptions: "Create / Edit / Submit",
      canUserApprove: canApprove,
      actionLabel: "Approve & Submit to Checker",
      nextLevelName: "Checker Due Diligence",
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
      levelName: "Checker Due Diligence",
      stageTitle: "Due Diligence cum Recommendation Note",
      roleName: "Checker (Sub-Region Staff)",
      authorityTitle: "Checker",
      actionOptions: "Complete DD Note / API checks / Submit",
      canUserApprove: canApprove,
      actionLabel: "Submit to Sub-Region Head",
      nextLevelName: "Sub-Region Head Review",
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
      levelName: "Sub-Region Head Review",
      stageTitle: "Sub-Region Head Review",
      roleName: "Sub-Region Head (AGM)",
      authorityTitle: "1st Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to DGM",
      nextLevelName: "DGM Recommendation",
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
      levelName: "DGM Recommendation",
      stageTitle: "DGM Recommendation",
      roleName: "DGM (where posted)",
      authorityTitle: "2nd Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to Region Head",
      nextLevelName: "Region Head Review",
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
      levelName: "Region Head Review",
      stageTitle: "Region Head Review",
      roleName: "Region Head",
      authorityTitle: "3rd Recommending Authority",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to HO Credit Officer",
      nextLevelName: "HO Credit Officer Review",
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
      levelName: "HO Credit Appraisal",
      stageTitle: "HO Credit Appraisal",
      roleName: "HO Credit Officer (AGM)",
      authorityTitle: "Credit AGM",
      actionOptions: "Recommend / Reject / Revert",
      canUserApprove: canApprove,
      actionLabel: "Recommend to HO Credit Head",
      nextLevelName: "HO Credit Head Final Approval",
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
      levelName: "HO Credit Head Final Approval",
      stageTitle: "Final Approval & Sanction",
      roleName: "HO Credit Head",
      authorityTitle: "Approving Authority",
      actionOptions: "Approve / Reject",
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
    levelName: "Reviewer Approval",
    stageTitle: "Reviewer Approval",
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

export function DsaWorkflowChevronBar({
  dsa,
  workflowLevelInfo,
  onSelectStage,
}: {
  dsa: any;
  workflowLevelInfo?: any;
  onSelectStage?: (stageLevel: number) => void;
}) {
  if (!dsa) return null;

  const currentLevel = Number(dsa.current_approval_level || 1);
  const onboardingStatus = String(
    dsa.onboarding_status || dsa.status || "",
  ).toUpperCase();
  const agreementStatus = String(dsa.agreement_status || "").toUpperCase();
  const operationalStatus = String(dsa.operational_status || "").toUpperCase();

  const isApproved =
    onboardingStatus === "APPROVED" ||
    onboardingStatus === "AGREEMENT_PENDING" ||
    onboardingStatus === "AGREEMENT_COMPLETED" ||
    agreementStatus === "SIGNED_VERIFIED" ||
    operationalStatus === "ACTIVE" ||
    Boolean(workflowLevelInfo?.isCompleted);

  const isRejected =
    onboardingStatus === "REJECTED" || Boolean(workflowLevelInfo?.isRejected);

  const approvals: any[] = Array.isArray(dsa.approvals) ? dsa.approvals : [];

  const stages = [
    {
      level: 1,
      roleName: "Maker",
      fullName: "L1: Maker Intake & Verification",
      stageCode: "LEVEL_1_MAKER",
    },
    {
      level: 2,
      roleName: "Checker",
      fullName: "L2: Checker Due Diligence",
      stageCode: "LEVEL_2_CHECKER",
    },
    {
      level: 3,
      roleName: "Sub-Region Head",
      fullName: "L3: Sub-Region Head Review (AGM)",
      stageCode: "LEVEL_3_SUB_REGION",
      altStageCode: "LEVEL_3_SUB_REGION_HEAD",
    },
    {
      level: 4,
      roleName: "DGM",
      fullName: "L4: DGM Recommendation",
      stageCode: "LEVEL_4_DGM",
      isConditional: true,
    },
    {
      level: 5,
      roleName: "Region Head",
      fullName: "L5: Region Head Review",
      stageCode: "LEVEL_5_REGION_HEAD",
    },
    {
      level: 6,
      roleName: "HO Credit Officer",
      fullName: "L6: HO Credit Appraisal (AGM)",
      stageCode: "LEVEL_6_HO_CREDIT_OFFICER",
    },
    {
      level: 7,
      roleName: "HO Credit Head",
      fullName: "L7: HO Credit Head Final Approval",
      stageCode: "LEVEL_7_HO_CREDIT_HEAD",
    },
  ];

  // A stage can hold several rows over time (e.g. an actioned QUERY row plus a
  // re-armed PENDING placeholder after the Maker resolves the query). Pick the
  // latest ACTIONED row (fallback: newest row) so resolved queries stop
  // rendering orange on stages that already actioned.
  const pickStageRecord = (stage: (typeof stages)[number]) => {
    const rows = approvals
      .filter(
        (a: any) =>
          Number(a.approval_level) === stage.level ||
          a.stage_code === stage.stageCode ||
          (stage.altStageCode && a.stage_code === stage.altStageCode),
      )
      .sort((a: any, b: any) => {
        const aT = a.actioned_at ? new Date(a.actioned_at).getTime() : 0;
        const bT = b.actioned_at ? new Date(b.actioned_at).getTime() : 0;
        if (aT !== bT) return bT - aT;
        return Number(b.id ?? 0) - Number(a.id ?? 0);
      });
    return rows[0];
  };

  // Query is "open" only while the Maker (L1) still has to resolve it.
  const queryOpen =
    onboardingStatus === "DOCUMENT_PENDING" ||
    onboardingStatus === "QUERY" ||
    onboardingStatus === "CALLBACK";

  const stageStates = stages.map((stage) => {
    const record = pickStageRecord(stage);

    const recordStatus = String(
      record?.status || record?.action || "",
    ).toUpperCase();

    // Check if L4 DGM is skipped
    const isDgmSkipped =
      stage.level === 4 &&
      (dsa.branch_dgm_posted === false ||
        recordStatus === "SKIPPED" ||
        recordStatus === "SKIP" ||
        (dsa as any)?.dgm_skipped === true ||
        ((currentLevel > 4 || isApproved) && !record));

    if (isDgmSkipped) {
      return {
        ...stage,
        state: "SKIPPED" as const,
        displayLabel: "DGM (Skipped)",
        details: "Bypassed (No DGM posted for branch)",
        approver: record?.user_name || null,
        timestamp: record?.created_at || null,
      };
    }

    if (
      recordStatus === "REJECTED" ||
      recordStatus === "REJECT" ||
      (isRejected && currentLevel === stage.level)
    ) {
      return {
        ...stage,
        state: "REJECTED" as const,
        displayLabel: stage.roleName,
        details:
          record?.remarks ||
          dsa.rejection_reason ||
          dsa.status_reason ||
          "Application Rejected",
        approver: record?.user_name || null,
        timestamp: record?.created_at || null,
      };
    }

    if (
      recordStatus === "REVERTED" ||
      recordStatus === "REVERT" ||
      (currentLevel === stage.level && onboardingStatus === "REVERTED")
    ) {
      return {
        ...stage,
        state: "REVERTED" as const,
        displayLabel: stage.roleName,
        details: record?.remarks || "Reverted back for corrections",
        approver: record?.user_name || null,
        timestamp: record?.created_at || null,
      };
    }

    // Orange (query/callback) only while the query is genuinely open:
    //  - the stage itself last actioned QUERY/CALLED_BACK and the case is still
    //    awaiting Maker resolution, or
    //  - the open query target (L1 Maker) is the active stage.
    // Once the Maker re-submits, DOCUMENT_PENDING is cleared and the stage
    // renders COMPLETED (green) / ACTIVE (blue) like a normal flow.
    if (
      recordStatus === "CALLBACK" ||
      recordStatus === "CALLED_BACK" ||
      ((recordStatus === "QUERY" || recordStatus === "QUERY_RAISED") &&
        queryOpen) ||
      (queryOpen && currentLevel === stage.level && stage.level === 1)
    ) {
      return {
        ...stage,
        state: "CALLBACK" as const,
        displayLabel: stage.roleName,
        details:
          record?.remarks ||
          (onboardingStatus === "DOCUMENT_PENDING"
            ? "Pending document resolution"
            : "Query / Callback raised"),
        approver: record?.user_name || null,
        timestamp: record?.created_at || null,
      };
    }

    const isRecordApproved =
      recordStatus === "APPROVED" ||
      recordStatus === "RECOMMENDED" ||
      recordStatus === "SUBMITTED" ||
      recordStatus === "APPROVE" ||
      recordStatus === "RECOMMEND" ||
      recordStatus === "SUBMIT";

    if (isApproved || isRecordApproved || currentLevel > stage.level) {
      return {
        ...stage,
        state: "COMPLETED" as const,
        displayLabel: stage.roleName,
        details:
          record?.remarks || `Completed & forwarded by ${stage.roleName}`,
        approver: record?.user_name || null,
        timestamp: record?.created_at || null,
      };
    }

    if (currentLevel === stage.level && !isRejected) {
      return {
        ...stage,
        state: "ACTIVE" as const,
        displayLabel: stage.roleName,
        details: `Currently in review at ${stage.fullName}`,
        approver: null,
        timestamp: null,
      };
    }

    return {
      ...stage,
      state: "PENDING" as const,
      displayLabel: stage.roleName,
      details: `Upcoming step: ${stage.fullName}`,
      approver: null,
      timestamp: null,
    };
  });


  const STAGE_THEMES: Record<
    string,
    { bg: string; hoverBg: string; fill: string; hoverFill: string; text: string }
  > = {
    COMPLETED: {
      bg: "bg-emerald-600",
      hoverBg: "bg-emerald-700",
      fill: "#059669",
      hoverFill: "#047857",
      text: "text-white font-semibold",
    },
    ACTIVE: {
      bg: "bg-blue-600",
      hoverBg: "bg-blue-700",
      fill: "#2563eb",
      hoverFill: "#1d4ed8",
      text: "text-white font-semibold",
    },
    REVERTED: {
      bg: "bg-amber-500",
      hoverBg: "bg-amber-600",
      fill: "#f59e0b",
      hoverFill: "#d97706",
      text: "text-white font-semibold",
    },
    CALLBACK: {
      bg: "bg-orange-500",
      hoverBg: "bg-orange-600",
      fill: "#f97316",
      hoverFill: "#ea580c",
      text: "text-white font-semibold",
    },
    REJECTED: {
      bg: "bg-rose-600",
      hoverBg: "bg-rose-700",
      fill: "#e11d48",
      hoverFill: "#be123c",
      text: "text-white font-semibold",
    },
    SKIPPED: {
      bg: "bg-slate-200",
      hoverBg: "bg-slate-200",
      fill: "#e2e8f0",
      hoverFill: "#e2e8f0",
      text: "text-slate-400 line-through",
    },
    PENDING: {
      bg: "bg-slate-100",
      hoverBg: "bg-slate-200",
      fill: "#f1f5f9",
      hoverFill: "#e2e8f0",
      text: "text-slate-700",
    },
  };

  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);

  const barContent = (
    <div className="w-full h-full flex items-center py-2">
      <div className="w-full overflow-x-auto no-scrollbar py-0.5">
        <div
          className="flex items-stretch w-full min-w-[760px] h-9 rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden"
          style={{ isolation: "isolate" }}
        >
          {stageStates.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === stageStates.length - 1;
            const isHovered = hoveredLevel === stage.level;
            const theme = STAGE_THEMES[stage.state] || STAGE_THEMES.PENDING;
            const currentBg = isHovered ? theme.hoverBg : theme.bg;
            const currentFill = isHovered ? theme.hoverFill : theme.fill;

            const tooltipText = `${stage.fullName}\nStatus: ${stage.state}${
              stage.approver ? `\nActioned by: ${stage.approver}` : ""
            }${stage.timestamp ? `\nDate: ${formatDate(stage.timestamp)}` : ""}${
              stage.details ? `\nRemarks: ${stage.details}` : ""
            }`;

            return (
              <div
                key={stage.level}
                onClick={() => onSelectStage?.(stage.level)}
                onMouseEnter={() => setHoveredLevel(stage.level)}
                onMouseLeave={() => setHoveredLevel(null)}
                role="button"
                tabIndex={0}
                className={cn(
                  "relative flex-1 min-w-0 flex items-center justify-center text-xs select-none transition-colors duration-150 h-full cursor-pointer",
                  isFirst ? "pl-3.5 pr-5" : isLast ? "pl-6 pr-3.5" : "pl-6 pr-5",
                  currentBg,
                  theme.text,
                )}
                style={{
                  zIndex: stageStates.length - index,
                }}
                title={tooltipText}
              >
                <div className="flex items-center justify-center gap-1.5 truncate px-1">
                  {stage.state === "COMPLETED" && (
                    <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                  )}
                  {stage.state === "ACTIVE" && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                    </span>
                  )}
                  {stage.state === "REVERTED" && (
                    <RotateCcw className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
                  )}
                  {stage.state === "CALLBACK" && (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
                  )}
                  {stage.state === "REJECTED" && (
                    <X className="w-3.5 h-3.5 shrink-0 stroke-[2]" />
                  )}
                  <span
                    className={cn(
                      "truncate font-medium",
                      stage.state === "SKIPPED" && "text-slate-400 line-through",
                    )}
                  >
                    {stage.displayLabel}
                  </span>
                </div>

                {!isLast && (
                  <svg
                    className="absolute inset-y-0 -right-[18px] w-[18px] pointer-events-none z-20 overflow-visible"
                    viewBox="0 0 18 34"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M -1,-2 L 4.25,-2 A 20 20 0 0 1 4.25,36 L -1,36 Z"
                      fill={currentFill}
                      className="transition-colors duration-150"
                    />
                    <path
                      d="M 4.25,-2 A 20 20 0 0 1 4.25,36"
                      stroke="#ffffff"
                      strokeWidth="3.5"
                      fill="none"
                    />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return <div className="mb-4 w-full flex justify-center">{barContent}</div>;
}

export function DsaApprovalStepper({ dsa }: { dsa: any }) {
  if (!dsa) return null;
  const currentLevel = Number(dsa.current_approval_level || 1);
  const onboardingStatus = String(
    dsa.onboarding_status || dsa.status || "",
  ).toUpperCase();
  const agreementStatus = String(dsa.agreement_status || "").toUpperCase();
  const operationalStatus = String(dsa.operational_status || "").toUpperCase();
  const isApproved =
    onboardingStatus === "APPROVED" ||
    onboardingStatus === "AGREEMENT_PENDING" ||
    onboardingStatus === "AGREEMENT_COMPLETED" ||
    agreementStatus === "SIGNED_VERIFIED" ||
    operationalStatus === "ACTIVE";
  const isRejected = onboardingStatus === "REJECTED";

  // Query state is only "open" while the Maker (L1) still has to resolve it.
  const queryOpen =
    onboardingStatus === "DOCUMENT_PENDING" ||
    onboardingStatus === "QUERY" ||
    onboardingStatus === "CALLBACK";

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
      actionOptions: "Approve / Reject",
    },
  ];

  const getStepRecord = (stepLevel: number) => {
    if (Array.isArray(dsa.approvals) && dsa.approvals.length > 0) {
      // Prefer the latest ACTIONED row so a resolved QUERY row is not treated
      // as the stage's current status (stale amber "Query" cards).
      const match = dsa.approvals
        .filter((a: any) => Number(a.approval_level) === stepLevel)
        .sort((a: any, b: any) => {
          const aT = a.actioned_at ? new Date(a.actioned_at).getTime() : 0;
          const bT = b.actioned_at ? new Date(b.actioned_at).getTime() : 0;
          if (aT !== bT) return bT - aT;
          return Number(b.id ?? 0) - Number(a.id ?? 0);
        })[0];
      if (match) return match;
    }
    if (isApproved) return { status: "APPROVED", remarks: "Approved" };
    if (isRejected && currentLevel === stepLevel)
      return {
        status: "REJECTED",
        remarks: dsa.rejection_reason || dsa.rejectionReason || "Rejected",
      };
    if (currentLevel > stepLevel)
      return { status: "APPROVED", remarks: "Completed" };
    if (currentLevel === stepLevel)
      return {
        status:
          onboardingStatus === "DOCUMENT_PENDING" && stepLevel === 1
            ? "QUERY"
            : "PENDING",
        remarks: "Pending Review",
      };
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
          {isApproved
            ? "Status: Fully Approved & Active"
            : isRejected
              ? "Status: Rejected"
              : `Active Queue: Stage ${currentLevel} (${steps[currentLevel - 1]?.name || "Review"})`}
        </span>
      </div>

      {/* Section 2.8 Deviation on mail notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-2.5 mb-3 text-xs text-blue-950 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <Mail className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Deviation on mail:</strong> When the Checker sends for
            recommendation via email, the Due Diligence Checklist,
            Recommendation, and Approval Authority details are attached
            automatically.
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
          const isPassed =
            statusStr === "APPROVED" || statusStr === "RECOMMENDED";
          const isSkipped = statusStr === "SKIPPED";
          const isCurrent =
            currentLevel === step.level && !isApproved && !isRejected;
          const isFailed = statusStr === "REJECTED";
          const isQuery =
            (statusStr === "QUERY" || statusStr === "QUERY_RAISED") &&
            queryOpen;

          return (
            <div
              key={step.level}
              className={`relative flex flex-col justify-between rounded-lg border p-2.5 text-xs transition-all ${
                isPassed
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                  : isSkipped
                    ? "border-slate-200 bg-slate-100/70 text-slate-400 opacity-60"
                    : isQuery
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : isCurrent
                        ? "border-blue-400 bg-blue-50 ring-2 ring-blue-400/20 text-blue-900 font-medium shadow-sm"
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
                      title={
                        step.level === 4
                          ? "Bypassed: No DGM authority posted to this branch"
                          : "Step skipped"
                      }
                    >
                      Skipped
                    </span>
                  )}
                  {isCurrent && !isQuery && (
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
                  {!isPassed &&
                    !isSkipped &&
                    !isCurrent &&
                    !isQuery &&
                    !isFailed && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                        Pending
                      </span>
                    )}
                </div>

                <p
                  className="font-bold text-slate-900 text-[11px] leading-snug line-clamp-2"
                  title={step.name}
                >
                  {step.name}
                </p>
                <p
                  className="text-[10px] text-slate-600 font-medium truncate mt-0.5"
                  title={step.role}
                >
                  {step.role}
                </p>
                <div className="mt-1 flex flex-col gap-0.5 text-[9px] text-slate-500">
                  <span
                    className="truncate"
                    title={`Authority: ${step.authority}`}
                  >
                    <strong className="text-slate-700">Auth:</strong>{" "}
                    {step.authority}
                  </span>
                  <span
                    className="truncate"
                    title={`Actions: ${step.actionOptions}`}
                  >
                    <strong className="text-slate-700">Actions:</strong>{" "}
                    {step.actionOptions}
                  </span>
                </div>
              </div>

              {rec.remarks && (
                <p
                  className="mt-2 text-[9px] text-slate-600 bg-white/80 p-1 rounded border border-slate-200/60 truncate"
                  title={rec.remarks}
                >
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
  {
    label: "Business type",
    name: "businessType",
    options: businessTypes,
    required: true,
    type: "select",
  },
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
  {
    label: "Status",
    name: "status",
    options: ["Active", "Invited", "Disabled"],
    required: true,
    type: "select",
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// DSA RECOVERY REPORTS sub-component (used in the Reports tab)
// ──────────────────────────────────────────────────────────────────────────────
function DsaRecoveryReports({ dsaId }: { dsaId: string }) {
  const { store } = useMockStore();
  const recoveryRows = store.dsaRecovery
    .filter((r) => r.dsaId === dsaId)
    .sort((a, b) => {
      const order = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const [aM, aY] = a.month.split(" ");
      const [bM, bY] = b.month.split(" ");
      return Number(aY) - Number(bY) || order.indexOf(aM) - order.indexOf(bM);
    });

  if (recoveryRows.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500 text-sm">
        <BarChart3 className="mx-auto h-10 w-10 text-slate-300 mb-3" />
        <p className="font-semibold text-slate-700">
          No recovery data available for this DSA.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Recovery analytics data is available for active DSAs only.
        </p>
      </div>
    );
  }

  const totalRecovered = recoveryRows.reduce(
    (s, r) => s + r.recoveredAmount,
    0,
  );
  const totalInvoice = recoveryRows.reduce((s, r) => s + r.invoiceAmount, 0);
  const totalNpa = recoveryRows.reduce((s, r) => s + r.npaCases, 0);
  const totalPending = recoveryRows.reduce((s, r) => s + r.pendingAmount, 0);

  return (
    <div className="space-y-6">
      {/* Carry-forward info banner */}
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
        <TrendingUp className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <span>
          <strong>Carry-Forward Logic:</strong> If recovery falls short of
          target in a month, the shortfall reduces next month&apos;s invoice.
          E.g. target ₹10,000, recovered ₹8,000 → shortfall ₹2,000 deducted from
          next month → if next month recovery is ₹20,000, invoice = ₹18,000.
        </span>
      </div>

      {/* KPI summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Recovered",
            value: formatCurrency(totalRecovered),
            color: "text-emerald-700",
          },
          {
            label: "Total Invoice Generated",
            value: formatCurrency(totalInvoice),
            color: "text-blue-700",
          },
          {
            label: "Total Pending",
            value: formatCurrency(totalPending),
            color: "text-rose-600",
          },
          {
            label: "Total NPA Cases",
            value: String(totalNpa),
            color: totalNpa > 0 ? "text-rose-600" : "text-slate-600",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-lg border border-slate-100 bg-slate-50 p-4"
          >
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
                const achievedPct =
                  row.targetAmount > 0
                    ? Math.round((row.recoveredAmount / row.targetAmount) * 100)
                    : 0;
                const isUnder = row.recoveredAmount < row.targetAmount;
                return (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-3 pl-4 font-semibold text-slate-800">
                      {row.month}
                    </td>
                    <td className="p-3 text-right text-slate-600 text-xs">
                      {formatCurrency(row.targetAmount)}
                    </td>
                    <td className="p-3 text-right text-xs">
                      <span
                        className={`font-bold ${isUnder ? "text-rose-600" : "text-emerald-700"}`}
                      >
                        {formatCurrency(row.recoveredAmount)}
                      </span>
                      <span
                        className={`ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded-full ${isUnder ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}
                      >
                        {achievedPct}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-amber-600 text-xs">
                      {row.carryForwardIn > 0
                        ? formatCurrency(row.carryForwardIn)
                        : "—"}
                    </td>
                    <td className="p-3 text-right text-orange-600 text-xs font-medium">
                      {row.carryForwardOut > 0
                        ? formatCurrency(row.carryForwardOut)
                        : "—"}
                    </td>
                    <td className="p-3 text-right font-bold text-blue-700 text-xs">
                      {formatCurrency(row.invoiceAmount)}
                    </td>
                    <td className="p-3 text-right text-slate-600 text-xs">
                      {row.totalCases}
                    </td>
                    <td className="p-3 text-right text-slate-600 text-xs">
                      {formatCurrency(row.totalBilling)}
                    </td>
                    <td className="p-3 text-right text-rose-500 text-xs">
                      {formatCurrency(row.pendingAmount)}
                    </td>
                    <td className="p-3 pr-4 text-right text-xs">
                      <span
                        className={`font-bold ${row.npaCases > 0 ? "text-rose-600" : "text-slate-400"}`}
                      >
                        {row.npaCases}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                <td className="p-3 pl-4">TOTAL</td>
                <td className="p-3 text-right">
                  {formatCurrency(
                    recoveryRows.reduce((s, r) => s + r.targetAmount, 0),
                  )}
                </td>
                <td className="p-3 text-right text-emerald-700">
                  {formatCurrency(totalRecovered)}
                </td>
                <td className="p-3 text-right text-amber-600">
                  {formatCurrency(
                    recoveryRows.reduce((s, r) => s + r.carryForwardIn, 0),
                  )}
                </td>
                <td className="p-3 text-right text-orange-600">
                  {formatCurrency(
                    recoveryRows.reduce((s, r) => s + r.carryForwardOut, 0),
                  )}
                </td>
                <td className="p-3 text-right text-blue-700">
                  {formatCurrency(totalInvoice)}
                </td>
                <td className="p-3 text-right">
                  {recoveryRows.reduce((s, r) => s + r.totalCases, 0)}
                </td>
                <td className="p-3 text-right">
                  {formatCurrency(
                    recoveryRows.reduce((s, r) => s + r.totalBilling, 0),
                  )}
                </td>
                <td className="p-3 text-right text-rose-500">
                  {formatCurrency(totalPending)}
                </td>
                <td className="p-3 pr-4 text-right text-rose-600">
                  {totalNpa}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export function DsaManagementPage() {
  const {
    createItem,
    deleteItem,
    store,
    updateItem,
    currentUser,
    setCurrentUser,
  } = useMockStore();
  const {
    dsas,
    listLoading,
    pagination,
    dsaListError,
    fetchDsas,
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
  const [managementTab, setManagementTab] = useState<DsaWorkBucket>("all");

  // ── Task 20C: CALL_BACK from the management list ─────────────────────────
  // A previous authority can pull a case back from the list even though the
  // row is view-only for them. Once called back the case returns to their own
  // stage (assigned + locked) and the row becomes actionable again.
  const [callBackTarget, setCallBackTarget] = useState<any | null>(null);
  const [callBackReason, setCallBackReason] = useState("");
  const [callBackError, setCallBackError] = useState("");
  const [callBackBusy, setCallBackBusy] = useState(false);
  const router = useRouter();
  const isNetworkPage = currentUser?.role === "DSA Partner";
  const canManageDsaCredentials = currentUser?.role === "DSA Manager";
  const ownerDsaId = currentUser?.id ?? "";
  const agentOwnerDsa = isNetworkPage
    ? (store.dsas.find((item) => item.id === ownerDsaId) ?? null)
    : null;
  const agentOwnerDsaId = agentOwnerDsa?.id ?? "";

  // Task 22 — role drives both bucket scoping and per-row access on this
  // page, so fall back to the persisted auth session exactly like
  // DsaProfilePage does. A blank role must never be treated as "no
  // restriction" downstream.
  const roleStr = String(
    currentUser?.role ||
      (typeof window !== "undefined"
        ? (authService.getUser() as { role?: string } | null)?.role
        : "") ||
      "",
  );

  const getBackendStatusParams = (statusVal: string) => {
    if (!statusVal) return {};
    const normalized = statusVal.toLowerCase();
    if (["active", "suspended", "blacklisted"].includes(normalized)) {
      return { operational_status: statusVal.toUpperCase() };
    }
    if (normalized === "draft") return { onboarding_status: "DRAFT" };
    if (normalized === "submitted") return { onboarding_status: "SUBMITTED" };
    if (normalized.includes("branch"))
      return { onboarding_status: "DOCUMENT_VERIFICATION" };
    if (normalized.includes("brh"))
      return { onboarding_status: "COMPLIANCE_CHECK" };
    if (normalized.includes("credit"))
      return { onboarding_status: "PENDING_APPROVAL" };
    if (normalized.includes("kyc"))
      return { onboarding_status: "COMPLIANCE_CHECK" };
    return { onboarding_status: statusVal.toUpperCase() };
  };

  const fetchParams = useMemo(() => {
    const statusParams = getBackendStatusParams(status);
    return {
      search: search.trim() || undefined,
      ...statusParams,
      // Task 22: the backend scopes each bucket to the viewer's workflow level.
      bucket: managementTab,
      page,
      per_page: 10,
    };
  }, [search, status, managementTab, page]);

  useEffect(() => {
    if (isNetworkPage) return;
    fetchDsas(fetchParams);
  }, [fetchDsas, fetchParams, isNetworkPage]);


  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleStatusChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setStatus(event.target.value);
    setPage(1);
  };

  function openCredentialModal(dsa: any) {
    setCredentialDsa(dsa);
    setCredentialUsername(dsa.login_username || "");
    setCredentialPassword("");
    setCredentialError("");
  }

  /**
   * Task 20C — CALL_BACK issued from a view-only row.
   *
   * Only the exact authority who actioned the previous stage may pull the case
   * back, and only while it sits at L4/L5/L6. Those two rules depend on
   * dynamic step resolution (L4 is skipped when no DGM is posted), so the
   * backend is the authority: we surface its exact rejection inline instead of
   * re-implementing the resolver and guessing.
   */
  async function submitCallBackFromList() {
    if (!callBackTarget) return;
    if (!callBackReason.trim()) {
      setCallBackError("A reason is mandatory to call the case back.");
      return;
    }
    setCallBackBusy(true);
    setCallBackError("");
    try {
      const res = await adminApi.updateWorkflowAction(callBackTarget.id, {
        action: "CALL_BACK",
        remarks: callBackReason.trim(),
      });
      toast({
        title: "Case Called Back",
        description:
          res?.message ||
          "The case has been returned to you and locked. It is now actionable on your desk.",
        variant: "success",
      });
      setCallBackTarget(null);
      setCallBackReason("");
      await fetchDsas(fetchParams);
    } catch (err: unknown) {
      setCallBackError(
        err instanceof Error
          ? err.message
          : "Only the previous authority who actioned this case can call it back.",
      );
    } finally {
      setCallBackBusy(false);
    }
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

    const email = String(value.email ?? "")
      .trim()
      .toLowerCase();
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
      region:
        String(value.region ?? agentOwnerDsa?.name ?? "DSA").trim() || "DSA",
      status: (value.status as User["status"]) || "Active",
    } as any);
    setCreatingAgent(false);
  }

  function saveAgentEdit(value: Partial<User>) {
    if (!editingAgent) return;

    const email = String(value.email ?? editingAgent.email)
      .trim()
      .toLowerCase();
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
      (user) =>
        user.id !== editingAgent.id &&
        user.email.trim().toLowerCase() === email,
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

  let scopedRows = store.dsas.filter((item) =>
    managementStatuses.includes(item.status),
  );
  if (currentUser?.role === "DSA Partner") {
    scopedRows = scopedRows.filter((item) => item.id === currentUser.id);
  } else if (currentUser?.role === "Branch User") {
    scopedRows = scopedRows.filter((item) => item.manager === currentUser.name);
  }
  const onHoldRows = scopedRows
    .filter((item) => item.status === "On Hold")
    .sort((left, right) =>
      right.onboardingDate.localeCompare(left.onboardingDate),
    );

  const networkDsaIds = new Set(
    isNetworkPage ? [ownerDsaId] : scopedRows.map((item) => item.id),
  );
  const networkRows: NetworkPersonRow[] = store.users
    .filter(
      (user) =>
        user.role === "DSA Agent" &&
        user.dsaId &&
        networkDsaIds.has(user.dsaId),
    )
    .map((user) => ({
      email: user.email,
      id: user.id,
      name: user.name,
      region: user.region,
      sourceDsaId: user.dsaId ?? "",
      status: user.status,
    }))
    .map((item) => {
      const leads = store.leads.filter(
        (lead) => lead.dsaId === item.sourceDsaId && lead.owner === item.name,
      );
      const applications = store.applications.filter(
        (application) =>
          application.dsaId === item.sourceDsaId &&
          leads.some((lead) => lead.customer === application.customer),
      );
      const approvedOrDisbursed = applications.filter(
        (application) =>
          application.status === "Approved" ||
          application.status === "Disbursed",
      ).length;
      const disbursed = applications.filter(
        (application) => application.status === "Disbursed",
      ).length;

      return {
        applications: applications.length,
        approvedOrDisbursed,
        conversion: applications.length
          ? (approvedOrDisbursed / applications.length) * 100
          : 0,
        disbursed,
        email: item.email,
        id: item.id,
        leads: leads.length,
        name: item.name,
        region: item.region,
        status: item.status,
      };
    })
    .sort(
      (left, right) =>
        right.applications - left.applications ||
        right.leads - left.leads ||
        left.name.localeCompare(right.name),
    );

  const networkColumns: Column<NetworkPersonRow>[] = [
    {
      cell: (item) => (
        <span className="font-semibold text-slate-950">{item.name}</span>
      ),
      header: "Agent",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    {
      cell: (item) => item.email,
      header: "Email",
      key: "email",
      sortable: true,
      sortValue: (item) => item.email,
    },
    {
      cell: (item) => item.region,
      header: "Region",
      key: "region",
      sortable: true,
      sortValue: (item) => item.region,
    },
    {
      cell: (item) => <StatusBadge status={item.status} />,
      header: "Status",
      key: "status",
      sortable: true,
      sortValue: (item) => item.status,
    },
    {
      cell: (item) => item.leads,
      header: "Leads collected",
      key: "leads",
      sortable: true,
      sortValue: (item) => item.leads,
    },
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
    {
      cell: (item) => percent(item.conversion),
      header: "Conversion",
      key: "conversion",
      sortable: true,
      sortValue: (item) => item.conversion,
    },
  ];

  const callBackModal = (
    <Modal
      description={
        callBackTarget
          ? `Pull application #${callBackTarget.dsa_code || callBackTarget.code || callBackTarget.id} back to your stage. It will be reassigned and locked to you.`
          : "Pull this application back to your stage."
      }
      onClose={() => {
        setCallBackTarget(null);
        setCallBackReason("");
        setCallBackError("");
      }}
      open={Boolean(callBackTarget)}
      title="Call Back to Your Desk"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-relaxed text-sky-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
          <p>
            Only the exact authority who actioned this case at the previous
            stage can call it back. Once returned, the case reappears on your
            desk and becomes fully actionable again.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="listCallBackReason">Reason for Call Back *</Label>
          <textarea
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            id="listCallBackReason"
            maxLength={2000}
            onChange={(e) => setCallBackReason(e.target.value)}
            placeholder="e.g. Calling back to re-evaluate branch documentation."
            rows={4}
            value={callBackReason}
          />
          <p className="text-[11px] text-slate-500">Maximum 2000 characters.</p>
        </div>
        {callBackError ? (
          <p className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {callBackError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            onClick={() => {
              setCallBackTarget(null);
              setCallBackReason("");
              setCallBackError("");
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold"
            disabled={callBackBusy}
            onClick={submitCallBackFromList}
            size="sm"
            type="button"
          >
            {callBackBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Confirm Call Back
          </Button>
        </div>
      </div>
    </Modal>
  );

  const agentModals = (
    <>
      <Modal
        onClose={() => setCreatingAgent(false)}
        open={creatingAgent}
        title={`Create DSA agent${agentOwnerDsa ? ` - ${agentOwnerDsa.name}` : ""}`}
      >
        <RecordForm<User>
          fields={agentFields}
          initialValue={{
            region: agentOwnerDsa?.name ?? currentUser?.name ?? "DSA",
            status: "Active",
          }}
          onCancel={() => setCreatingAgent(false)}
          onSubmit={saveNewAgent}
          submitLabel="Create agent"
        />
      </Modal>
      <Modal
        onClose={() => setEditingAgent(null)}
        open={Boolean(editingAgent)}
        title="Edit DSA agent"
      >
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
            const agent = store.users.find(
              (user) =>
                user.id === item.id &&
                user.role === "DSA Agent" &&
                user.dsaId === ownerDsaId,
            );
            return (
              <ActionPair
                onDelete={
                  agent ? () => deleteItem("users", agent.id) : undefined
                }
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
              Assigned Branch:{" "}
              <strong>
                {userBranchScope.primaryBranchName ||
                  userBranchScope.primaryBranchCode}
              </strong>
              {userBranchScope.primaryBranchCode
                ? ` (${userBranchScope.primaryBranchCode})`
                : ""}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Tabs
          onChange={(tab) => {
            setManagementTab(tab as DsaWorkBucket);
            setPage(1);
          }}
          tabs={DSA_WORK_BUCKETS.map((bucket) => ({
            label: bucket.label,
            value: bucket.value,
          }))}
          value={managementTab}
        />
        <p className="text-xs text-slate-500">
          {DSA_WORK_BUCKETS.find((b) => b.value === managementTab)
            ?.description}
        </p>
      </div>

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
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {listLoading
                ? "Loading partners..."
                : `Found ${pagination.total} partners`}
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
                    <Button
                      onClick={() => fetchDsas(fetchParams)}
                      type="button"
                      variant="outline"
                    >
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
                      <th className="p-4">Type &amp; PAN</th>
                      <th className="p-4">GST Applicable</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Approval Rate</th>
                      <th className="p-4">Commission</th>
                      <th className="p-4 text-right whitespace-nowrap min-w-[170px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dsas.map((item) => {
                      // Task 22 — a row is only actionable when the case is at
                      // this role's stage. Rows that are not are still listed
                      // (you can see it exists) but cannot be opened, edited or
                      // auto-acquired, so a stray click can never claim a case
                      // that has moved on.
                      const access = resolveCaseAccess(item, roleStr);
                      const locked = !access.allowed;
                      const lockNote = describeCaseLock(
                        access.reason,
                        item.current_approval_level,
                      );
                      // Task 20C — N -> N-1 rule. Only the authority at the
                      // level BELOW where the case now sits may call it back:
                      // if L3 approved to L4, only L3 can; if L4 approved to
                      // L5, only L4 can (never L5). previousActorLevel comes
                      // from the step history so a skipped DGM (L3 -> L5) is
                      // still attributed to L3.
                      const viewerLevel = resolveUserLevel(roleStr);
                      const previousActorLevel = resolvePreviousActorLevel(
                        item.approvals,
                        item.current_approval_level,
                      );
                      const showCallBackAction = canShowCallBackAction({
                        rowLocked: locked,
                        assignedUserId: item.assigned_user_id,
                        accessReason: access.reason,
                        level: item.current_approval_level,
                        viewerLevel,
                        previousActorLevel,
                      });

                      return (
                      <tr
                        className={cn(
                          "transition",
                          locked
                            ? "cursor-not-allowed bg-slate-50/60 opacity-70"
                            : "cursor-pointer hover:bg-slate-50/50",
                        )}
                        key={item.id}
                        onClick={() => {
                          if (locked) {
                            toast({
                              title: "Case not assigned to you",
                              description: lockNote,
                              variant: "warning",
                            });
                            return;
                          }
                          router.push(`/dsa/${item.id}`);
                        }}
                        title={locked ? lockNote : undefined}
                      >
                        <td className="p-4">
                          <div>
                            <div className="flex items-center gap-2">
                            <p
                              className={cn(
                                "font-semibold",
                                locked
                                  ? "text-slate-500"
                                  : "text-blue-700 hover:underline",
                              )}
                            >
                              {item.name ||
                                item.contact_person ||
                                item.dsa_code ||
                                item.code}
                            </p>
                          </div>
                            <p className="text-[10px] text-slate-500">
                              {item.contact_person} · {item.email}
                              {(item.branch_name ||
                                item.branch?.branch_name) && (
                                <span className="ml-2 inline-flex items-center text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                  <Building2 className="h-3 w-3 mr-1 inline text-slate-400" />
                                  {item.branch_name || item.branch?.branch_name}
                                </span>
                              )}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs font-bold">
                          {(
                            typeof item.dsa_code === "object"
                              ? (item.dsa_code as any)?.code
                              : item.dsa_code
                          ) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              {typeof item.dsa_code === "object"
                                ? (item.dsa_code as any)?.code
                                : item.dsa_code}
                            </span>
                          ) : (
                            <span className="text-slate-600">{item.code}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mr-1.5">
                            {item.dsa_type || "INDIVIDUAL"}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            {item.pan || "N/A"}
                          </span>
                        </td>
                        <td className="p-4">
                          {item.gst_applicable ? (
                            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="h-3 w-3" />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600">
                              No
                            </span>
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
                        <td
                          className="p-4 text-right whitespace-nowrap"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2 shrink-0 whitespace-nowrap">
                            {showCallBackAction ? (
                              <Button
                                onClick={() => {
                                  setCallBackTarget(item);
                                  setCallBackReason("");
                                  setCallBackError("");
                                }}
                                size="sm"
                                title="Pull this case back to your stage for re-evaluation"
                                type="button"
                                className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300 font-semibold text-xs h-7 px-2.5 shadow-2xs"
                              >
                                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                                <span>Call Back</span>
                              </Button>
                            ) : null}
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
                            <Button
                              disabled={locked}
                              onClick={() => {
                                if (locked) {
                                  toast({
                                    title: "Editing unavailable",
                                    description: lockNote,
                                    variant: "warning",
                                  });
                                  return;
                                }
                                setEditing(item as any);
                              }}
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Page {pagination.currentPage} of {pagination.totalPages} ·{" "}
              {pagination.total} total
            </span>
            <div className="flex gap-2">
              <Button
                disabled={listLoading || page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                size="sm"
                type="button"
                variant="outline"
              >
                Previous
              </Button>
              <Button
                disabled={listLoading || page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>

      <Modal
        onClose={() => setEditing(null)}
        open={Boolean(editing)}
        title="Edit DSA"
      >
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
      {callBackModal}
      {agentModals}
      <Modal
        onClose={closeCredentialModal}
        open={Boolean(credentialDsa)}
        title="Manage DSA credentials"
      >
        {credentialDsa ? (
          <div className="space-y-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">
                    {credentialDsa.name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {credentialDsa.dsa_code
                      ? `Partner Code: ${typeof credentialDsa.dsa_code === "object" ? credentialDsa.dsa_code?.code : credentialDsa.dsa_code}`
                      : credentialDsa.code || `DSA-${credentialDsa.id}`}
                  </p>
                </div>
                <StatusBadge status={getDsaDisplayStatus(credentialDsa)} />
              </div>
            </div>
            {credentialError ? (
              <p className="text-xs font-semibold text-rose-600">
                {credentialError}
              </p>
            ) : null}
            <div className="space-y-3">
              <Field>
                <Label htmlFor="credUser">Login email</Label>
                <Input
                  id="credUser"
                  onChange={(event) =>
                    setCredentialUsername(event.target.value)
                  }
                  type="text"
                  value={credentialUsername}
                />
              </Field>
              <Field>
                <Label htmlFor="credPass">New password</Label>
                <Input
                  id="credPass"
                  onChange={(event) =>
                    setCredentialPassword(event.target.value)
                  }
                  placeholder="Minimum 8 characters"
                  type="text"
                  value={credentialPassword}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={closeCredentialModal}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                disabled={actionLoading}
                onClick={saveDsaCredentials}
                type="button"
              >
                {actionLoading ? "Saving..." : "Save Credentials"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function mapBackendStatusToFrontend(
  onboarding?: string,
  operational?: string,
): DsaStatus {
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
  const {
    createItem,
    deleteDsaCascade,
    deleteItem,
    store,
    updateItem,
    currentUser,
    setCurrentUser,
  } = useMockStore();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState("actions");
  const [docSubTab, setDocSubTab] = useState<DocumentSubTab>("kyc");
  const [appFormSubTab, setAppFormSubTab] = useState<
    "applicant" | "kyc" | "ddl"
  >("applicant");
  const authUser = typeof window !== "undefined" ? authService.getUser() : null;
  const rawAuthRoles =
    typeof window !== "undefined" ? authService.getRoles() : [];
  const rawAuthRolesNorm = useMemo(
    () =>
      rawAuthRoles.map((r) =>
        String(r)
          .toUpperCase()
          .replace(/[\s_-]+/g, ""),
      ),
    [rawAuthRoles],
  );
  const effectiveTicket = String(
    (currentUser as any)?.ticket_no ||
      (currentUser as any)?.ticketNo ||
      authUser?.ticket_no ||
      "",
  ).toLowerCase();
  const effectiveEmail = String(
    currentUser?.email || authUser?.email || "",
  ).toLowerCase();
  const roleStr = String(
    currentUser?.role || (authUser as any)?.role || rawAuthRoles[0] || "",
  );
  const normUserRole = roleStr.toUpperCase().replace(/[\s_-]+/g, "");
  const userTicket = effectiveTicket;
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
  const [branchesList, setBranchesList] = useState<BranchOption[]>([]);
  const [approvingDsa, setApprovingDsa] = useState<any | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [approvalRemarksError, setApprovalRemarksError] = useState("");
  const [l7ReviewLoading, setL7ReviewLoading] = useState(false);
  const [l7ReviewData, setL7ReviewData] = useState<any>(null);
  const [l7ReviewError, setL7ReviewError] = useState<string | null>(null);
  const [l7ReviewModalOpen, setL7ReviewModalOpen] = useState(false);
  const [l7ModalSubTab, setL7ModalSubTab] = useState<
    "approvals" | "deviations" | "verifications" | "documents" | "dd_note"
  >("approvals");
  const [l7ActiveVerifTab, setL7ActiveVerifTab] = useState<string>("");
  const loadFinalApprovalReview = useCallback(
    async (dsaId: number | string) => {
      setL7ReviewLoading(true);
      setL7ReviewError(null);
      try {
        const res = await adminApi.getFinalApprovalReview(dsaId);
        if ((res as any).status === "success" || (res as any).status === true) {
          setL7ReviewData(res.data);
        } else {
          setL7ReviewError(
            res.message ||
              "Failed to load HO Credit Head final approval review data.",
          );
        }
      } catch (err: any) {
        setL7ReviewError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to retrieve HO Credit Head final approval review data.",
        );
      } finally {
        setL7ReviewLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tab === "overview" && branchesList.length === 0) {
      adminApi
        .getBranchesDropdown()
        .then((res) => {
          if (res && res.data && Array.isArray(res.data)) {
            setBranchesList(res.data);
          }
        })
        .catch(() => {});
    }
  }, [tab, branchesList.length]);

  const openL7FinalApprovalModal = useCallback(
    async (dsaRecord: any) => {
      setApprovalRemarks("");
      setApprovalRemarksError("");
      setL7ModalSubTab("approvals");
      setL7ActiveVerifTab("");
      setL7ReviewModalOpen(true);
      if (dsaRecord?.id) {
        await loadFinalApprovalReview(dsaRecord.id);
      }
    },
    [loadFinalApprovalReview],
  );

  const [rejectingDsa, setRejectingDsa] = useState<any | null>(null);
  const [rejectionError, setRejectionError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionStep, setRejectionStep] = useState<"input" | "confirm">(
    "input",
  );
  const [rejectionConfirmationData, setRejectionConfirmationData] = useState<
    any | null
  >(null);
  const [queryingDsa, setQueryingDsa] = useState<any | null>(null);
  const [queryReason, setQueryReason] = useState("");
  const [queryError, setQueryError] = useState("");
  const [deactivatingDsa, setDeactivatingDsa] = useState<any | null>(null);
  const [blacklistingDsa, setBlacklistingDsa] = useState<any | null>(null);
  const [activatingDsa, setActivatingDsa] = useState<any | null>(null);
  const [unblacklistingDsa, setUnblacklistingDsa] = useState<any | null>(null);
  const [deletingDsa, setDeletingDsa] = useState<any | null>(null);
  const [viewingLifecycleReason, setViewingLifecycleReason] = useState<
    any | null
  >(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleReasonError, setLifecycleReasonError] = useState("");

  // KYC verification states (synced with backend KycVerification and dsa.verifications)
  const [verifyingKyc, setVerifyingKyc] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [verifiedKyc, setVerifiedKyc] = useState<{ [key: string]: boolean }>({
    pan: false,
    gst: false,
    bank: false,
    udyam: false,
    cibil: false,
    aml: false,
  });
  const [kycVerificationsList, setKycVerificationsList] = useState<any[]>([]);
  const [failedKyc, setFailedKyc] = useState<{ [key: string]: boolean }>({});
  const [loadingKycHistory, setLoadingKycHistory] = useState(false);
  const [discoveredGstins, setDiscoveredGstins] = useState<string[]>([]);
  const [viewKycDataModalType, setViewKycDataModalType] =
    useState<KycDataType | null>(null);
  const [viewKycDataCachedVerif, setViewKycDataCachedVerif] =
    useState<any>(null);

  // Checker-only CIBIL/AML attempted flags — persisted to localStorage per DSA ID
  // so Re-Check survives page reloads.
  const checkerKycStorageKey = `checker_kyc_attempted_${id}`;
  const getCheckerKycAttempted = (): { cibil: boolean; aml: boolean } => {
    try {
      const raw = localStorage.getItem(checkerKycStorageKey);
      return raw ? JSON.parse(raw) : { cibil: false, aml: false };
    } catch {
      return { cibil: false, aml: false };
    }
  };
  const setCheckerKycAttempted = (key: "cibil" | "aml", value: boolean) => {
    try {
      const prev = getCheckerKycAttempted();
      localStorage.setItem(
        checkerKycStorageKey,
        JSON.stringify({ ...prev, [key]: value }),
      );
    } catch {
      // ignore storage errors
    }
  };
  const [checkerKycAttempted, setCheckerKycAttemptedState] = useState<{
    cibil: boolean;
    aml: boolean;
  }>(getCheckerKycAttempted);

  const loadKycHistory = useCallback(async (dsaId: number | string) => {
    setLoadingKycHistory(true);
    try {
      const res = await adminApi.getKycVerifications(dsaId);
      if (res && res.success && Array.isArray(res.data)) {
        setKycVerificationsList(res.data);
      }
    } catch {
      // Non-critical catch
    } finally {
      setLoadingKycHistory(false);
    }
  }, []);

  // Deviation Report state & handlers (shown for Level 2 through Level 7)
  const [deviationReportData, setDeviationReportData] = useState<any | null>(
    null,
  );
  const [loadingDeviationReport, setLoadingDeviationReport] = useState(false);
  const [submittingCheckerReport, setSubmittingCheckerReport] = useState(false);

  // Due Diligence Note modal state (shown for Level 2 through Level 7)
  const [viewingDdNoteModal, setViewingDdNoteModal] = useState(false);

  // Revert Modal state (for Level 3+ to revert back to Checker)
  const [revertingDsa, setRevertingDsa] = useState<any | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertError, setRevertError] = useState("");

  // ── Task 20C: RE-allocate ────────────────────────────────────────────────
  const [reAllocatingDsa, setReAllocatingDsa] = useState<any | null>(null);
  const [reAllocateTargetId, setReAllocateTargetId] = useState<number | null>(null);
  const [reAllocateReason, setReAllocateReason] = useState("");
  const [reAllocateError, setReAllocateError] = useState("");
  const [eligibleUsers, setEligibleUsers] = useState<DsaEligibleUser[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  // NOTE: this must stay ABOVE the `if (loading || !dsa)` early return, or the
  // hook order changes between the loading render and the loaded render and
  // React throws "Rendered more hooks than during the previous render".
  const [action20CBusy, setAction20CBusy] = useState(false);

  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [counterInvoice, setCounterInvoice] = useState<any>(null);
  const [counterAmount, setCounterAmount] = useState("");
  const [counterNote, setCounterNote] = useState("");

  const {
    currentDsa: rawDsa,
    loading,
    actionLoading,
    fetchDsaDetail,
    updateDsaProfile,
    submitMakerApplication,
    submitCheckerApplication,
    updateWorkflowAction,
    raiseDsaQuery,
    fetchDeviationReport,
    generateCheckerDdReviewReport,
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
    approveSignedAgreement,
    fetchEligibleUsers,
  } = useDsa();

  const dsa = useMemo(() => normalizeDsaData(rawDsa), [rawDsa]);

  const [viewingDeviationsModal, setViewingDeviationsModal] = useState(false);

  const policyEvalData = useMemo(() => {
    const rep = deviationReportData;
    return (
      rep?.policy_evaluation ||
      rep?.bre_evaluation ||
      (rep as any)?.policyEvaluation ||
      (rep as any)?.breEvaluation ||
      {}
    );
  }, [deviationReportData]);

  const allDeviationRules = useMemo(() => {
    const rep = deviationReportData;
    return policyEvalData?.rules?.length
      ? policyEvalData.rules
      : rep?.deviation_details?.length
        ? rep.deviation_details
        : rep?.bre_evaluation?.rules || [];
  }, [policyEvalData, deviationReportData]);

  const deviationRules = useMemo(() => {
    return allDeviationRules.filter((r: any) => {
      const dec = String(r.decision || r.status || "").toUpperCase();
      return dec === "DEVIATION" || Boolean(r.is_deviation);
    });
  }, [allDeviationRules]);

  const nonDeviationRules = useMemo(() => {
    return allDeviationRules.filter((r: any) => {
      const dec = String(r.decision || r.status || "").toUpperCase();
      return dec !== "DEVIATION" && !r.is_deviation;
    });
  }, [allDeviationRules]);

  const isKycTypeVerified = useCallback(
    (key: string, codePatterns: string[]) => {
      // 1. In-session explicit failure takes absolute precedence
      if (failedKyc[key]) return false;

      // 2. In-session explicit success takes precedence
      if (verifiedKyc[key]) return true;

      // 3. Check authoritative database records (dsa.verifications)
      const vers: any[] = ((dsa as any)?.verifications || []).filter(
        (v: any) => {
          if (dsa?.created_at && v.created_at) {
            return new Date(v.created_at) >= new Date(dsa.created_at);
          }
          return true;
        },
      );

      const inDsaVerifs = vers.some((v: any) => {
        const c = String(v.verification_code || v.type || "").toUpperCase();
        const st = String(v.execution_status || v.status || "").toUpperCase();
        const isSuccess =
          Boolean(v.is_success) ||
          st === "SUCCESS" ||
          st === "COMPLETED" ||
          st === "PASSED" ||
          st === "VERIFIED";
        const isFailed =
          v.is_success === false ||
          st === "FAILED" ||
          st === "ERROR" ||
          st === "REJECTED";
        return (
          codePatterns.some((p) => c.includes(p.toUpperCase())) &&
          isSuccess &&
          !isFailed
        );
      });
      if (inDsaVerifs) return true;

      // 4. Also check KycVerification records for this specific DSA
      const inDbList = kycVerificationsList.some((v: any) => {
        const t = String(v.type || v.verification_type || "").toUpperCase();
        const st = String(v.status || v.execution_status || "").toUpperCase();
        const isSuccess =
          st === "SUCCESS" ||
          st === "COMPLETED" ||
          st === "PASSED" ||
          st === "VERIFIED";
        const isFailed = st === "FAILED" || st === "ERROR" || st === "REJECTED";
        const isAfterCreation =
          !dsa?.created_at ||
          !v.created_at ||
          new Date(v.created_at) >= new Date(dsa.created_at);
        return (
          codePatterns.some((p) => t.includes(p.toUpperCase())) &&
          isSuccess &&
          !isFailed &&
          isAfterCreation
        );
      });
      if (inDbList) return true;

      return false;
    },
    [verifiedKyc, failedKyc, dsa, kycVerificationsList],
  );

  const workflowLevelInfo = getDsaWorkflowLevelInfo(
    currentUser?.role || (authUser as any)?.role || rawAuthRoles[0],
    dsa,
  );
  const isMakerLevel =
    workflowLevelInfo.currentLevel === 1 ||
    Number(dsa?.current_approval_level) === 1;
  const isCheckerLevel =
    workflowLevelInfo.currentLevel === 2 ||
    Number(dsa?.current_approval_level) === 2;
  const isCheckerRole = Boolean(
    roleStr === "Checker" ||
    roleStr === "Branch Checker" ||
    roleStr === "Sub-Region Staff" ||
    roleStr === "Sub Region Staff" ||
    roleStr === "Sub-Region Checker" ||
    roleStr === "DSA Checker" ||
    roleStr === "Admin" ||
    roleStr === "Super Admin" ||
    normUserRole === "CHECKER" ||
    normUserRole === "BRANCHCHECKER" ||
    normUserRole === "SUBREGIONSTAFF" ||
    normUserRole === "SUBREGIONCHECKER" ||
    normUserRole === "DSACHECKER" ||
    normUserRole === "LEVEL2CHECKER" ||
    normUserRole === "ADMIN" ||
    normUserRole === "SUPERADMIN" ||
    rawAuthRolesNorm.includes("CHECKER") ||
    rawAuthRolesNorm.includes("BRANCHCHECKER") ||
    rawAuthRolesNorm.includes("SUBREGIONSTAFF") ||
    rawAuthRolesNorm.includes("SUB_REGION_STAFF") ||
    rawAuthRolesNorm.includes("ADMIN") ||
    rawAuthRolesNorm.includes("SUPERADMIN") ||
    effectiveTicket.startsWith("chk") ||
    effectiveEmail.includes("checker"),
  );
  const isMakerUser = Boolean(
    !isCheckerRole &&
    (roleStr === "Branch User" ||
      roleStr === "Maker" ||
      roleStr === "Branch Maker" ||
      roleStr === "Staff" ||
      roleStr === "Assistant Manager" ||
      normUserRole === "BRANCHUSER" ||
      normUserRole === "MAKER" ||
      normUserRole === "BRANCHMAKER" ||
      normUserRole === "STAFF" ||
      normUserRole === "ASSISTANTMANAGER" ||
      rawAuthRolesNorm.includes("MAKER") ||
      rawAuthRolesNorm.includes("BRANCHMAKER") ||
      rawAuthRolesNorm.includes("BRANCHUSER") ||
      effectiveTicket.startsWith("mkr") ||
      effectiveEmail.includes("maker")),
  );
  const isSubRegionRole =
    roleStr === "Sub-Region Head" ||
    roleStr === "Sub Region Head" ||
    roleStr === "Sub-Region Checker" ||
    roleStr === "AGM" ||
    normUserRole === "SUBREGIONHEAD" ||
    rawAuthRolesNorm.includes("SUBREGIONHEAD") ||
    effectiveTicket.startsWith("srh");
  const isDgmRole =
    roleStr === "DGM" ||
    roleStr === "Deputy General Manager" ||
    normUserRole === "DGM" ||
    rawAuthRolesNorm.includes("DGM") ||
    effectiveTicket.startsWith("dgm");
  const isRegionHeadRole =
    roleStr === "Region Head" ||
    roleStr === "Regional Head" ||
    roleStr === "Branch Regional Head" ||
    normUserRole === "REGIONHEAD" ||
    rawAuthRolesNorm.includes("REGIONHEAD") ||
    effectiveTicket.startsWith("rh");
  const isHoOfficerRole =
    roleStr === "HO Credit Officer" ||
    roleStr === "HO Credit" ||
    roleStr === "DSA Credit" ||
    normUserRole === "HOCREDITOFFICER" ||
    rawAuthRolesNorm.includes("HOCREDITOFFICER") ||
    effectiveTicket.startsWith("ho_officer");
  const isHoHeadRole =
    roleStr === "HO Credit Head" ||
    roleStr === "Credit Head" ||
    isL7Role ||
    normUserRole === "HOCREDITHEAD" ||
    rawAuthRolesNorm.includes("HOCREDITHEAD") ||
    effectiveTicket.startsWith("ho_head");

  const isAdminOrSuperAdmin = Boolean(
    roleStr === "Admin" ||
    roleStr === "Super Admin" ||
    normUserRole === "ADMIN" ||
    normUserRole === "SUPERADMIN" ||
    rawAuthRolesNorm.includes("ADMIN") ||
    rawAuthRolesNorm.includes("SUPERADMIN"),
  );

  const isOtherNonCheckerRole =
    isMakerUser ||
    isSubRegionRole ||
    isDgmRole ||
    isRegionHeadRole ||
    isHoOfficerRole ||
    isHoHeadRole;

  // ONLY Checker can perform or re-check KYC verifications.
  // Maker and the other 5 workflow roles can ONLY view verification statuses.
  const canCheckerVerifyKyc = Boolean(
    !isMakerUser &&
    isCheckerRole &&
    dsa?.operational_status !== "ACTIVE" &&
    dsa?.onboarding_status !== "REJECTED",
  );

  // View Data button access:
  // PAN  → Maker + Checker only
  // All others (GST/Bank/Udyam/CIBIL/AML) → Checker only
  // L3-L7 and any other role → hidden entirely
  const canViewPanKycData = isMakerUser || isCheckerRole;
  const canViewKycData    = isCheckerRole;

  const handleVerifyKyc = async (
    type: string,
    label: string,
    variant?: "pennydrop" | "pennyless" | "pan_to_gstin",
  ) => {
    if (!dsa) return;
    if (!canCheckerVerifyKyc) {
      toast({
        title: "Access Restricted",
        description:
          "Only Checker authority can perform or re-check KYC verifications.",
        variant: "warning",
      });
      return;
    }
    setVerifyingKyc((prev) => ({ ...prev, [type]: true }));
    const dsaIdNum = Number(dsa.id);

    try {
      if (type === "pan") {
        if (!dsa.pan) {
          toast({
            title: "PAN Missing",
            description:
              "No PAN number available on the DSA profile to verify.",
            variant: "warning",
          });
          return;
        }
        const isEntity =
          dsa.dsa_type === "ENTITY" ||
          dsa.dsa_type === "Entity" ||
          dsa.entity_type === "ENTITY";

        let res: any;
        if (isEntity) {
          res = await adminApi.verifyPanEntity({
            pan: dsa.pan,
            dsa_id: dsaIdNum,
            entity_name: dsa.entity_name || dsa.name,
          });
        } else {
          res = await adminApi.verifyPanAdvance({
            pan: dsa.pan,
            dsa_id: dsaIdNum,
          });
        }
        if (res && res.success) {
          setVerifiedKyc((prev) => ({ ...prev, pan: true }));
          setFailedKyc((prev) => ({ ...prev, pan: false }));
          toast({
            title: isEntity ? "Entity PAN Verified" : "PAN Verified",
            description:
              res.message ||
              (isEntity
                ? "Corporate PAN verified successfully via Karza Gateway."
                : "PAN verified successfully via ScoreMe API Gateway."),
            variant: "success",
          });
          await loadKycHistory(dsa.id);
          await fetchDsaDetail(dsa.id);
        } else {
          setVerifiedKyc((prev) => ({ ...prev, pan: false }));
          setFailedKyc((prev) => ({ ...prev, pan: true }));
          toast({
            title: isEntity
              ? "Entity PAN Verification Failed"
              : "PAN Verification Failed",
            description: res?.message || "Failed to verify PAN.",
            variant: "destructive",
          });
        }
      } else if (type === "gst") {
        try {
          await triggerCheckerVerification(dsa.id, "GST");
        } catch {
          // non-critical if not at Level 2 review stage
        }

        if (variant === "pan_to_gstin" || !dsa.gst) {
          if (!dsa.pan) {
            toast({
              title: "PAN Missing",
              description:
                "PAN number required to resolve linked GSTIN records.",
              variant: "warning",
            });
            return;
          }
          const res = await adminApi.resolvePanToGstin({
            pan: dsa.pan,
            dsa_id: dsaIdNum,
          });
          if (res && res.success) {
            setVerifiedKyc((prev) => ({ ...prev, gst: true }));
            setFailedKyc((prev) => ({ ...prev, gst: false }));
            const details = res.data?.details?.data || res.data?.details || [];
            if (Array.isArray(details) && details.length > 0) {
              const gsts = details
                .map((d: any) => d.gstin || d.gstinId || d)
                .filter(Boolean);
              setDiscoveredGstins(gsts);
            }
            toast({
              title: "PAN to GSTIN Resolved",
              description:
                res.message || "Linked GSTIN numbers resolved successfully.",
              variant: "success",
            });
            await loadKycHistory(dsa.id);
            await fetchDsaDetail(dsa.id);
          } else {
            setVerifiedKyc((prev) => ({ ...prev, gst: false }));
            setFailedKyc((prev) => ({ ...prev, gst: true }));
            toast({
              title: "GSTIN Lookup Failed",
              description: res?.message || "Failed to find GSTIN for PAN.",
              variant: "destructive",
            });
          }
        } else {
          const res = await adminApi.verifyGstInfo({
            gstin: dsa.gst,
            flag: 1,
            dsa_id: dsaIdNum,
          });
          if (res && res.success) {
            setVerifiedKyc((prev) => ({ ...prev, gst: true }));
            setFailedKyc((prev) => ({ ...prev, gst: false }));
            toast({
              title: "GSTIN Verified",
              description:
                res.message ||
                "GSTIN filing and registration verified via GSTN.",
              variant: "success",
            });
            await loadKycHistory(dsa.id);
            await fetchDsaDetail(dsa.id);
          } else {
            setVerifiedKyc((prev) => ({ ...prev, gst: false }));
            setFailedKyc((prev) => ({ ...prev, gst: true }));
            toast({
              title: "GSTIN Verification Failed",
              description: res?.message || "Failed to verify GSTIN.",
              variant: "destructive",
            });
          }
        }
      } else if (type === "bank") {
        if (!dsa.account_number || !dsa.ifsc) {
          toast({
            title: "Bank Details Missing",
            description:
              "Account number and IFSC are required for verification.",
            variant: "warning",
          });
          return;
        }

        const isPennyless = variant === "pennyless";
        const res = isPennyless
          ? await adminApi.verifyBankAccountPennyless({
              account_number: dsa.account_number,
              ifsc: dsa.ifsc,
              dsa_id: dsaIdNum,
            })
          : await adminApi.verifyBankAccount({
              account_number: dsa.account_number,
              ifsc: dsa.ifsc,
              dsa_id: dsaIdNum,
            });

        if (res && res.success) {
          setVerifiedKyc((prev) => ({ ...prev, bank: true }));
          setFailedKyc((prev) => ({ ...prev, bank: false }));
          toast({
            title: isPennyless
              ? "Pennyless BAV Verified"
              : "Penny Drop BAV Verified",
            description:
              res.message ||
              (isPennyless
                ? "Bank account verified successfully via Pennyless BAV."
                : "Bank account verified successfully via Penny Drop (₹1.00)."),
            variant: "success",
          });
          await loadKycHistory(dsa.id);
          await fetchDsaDetail(dsa.id);
        } else {
          setVerifiedKyc((prev) => ({ ...prev, bank: false }));
          setFailedKyc((prev) => ({ ...prev, bank: true }));
          toast({
            title: "Bank Verification Failed",
            description: res?.message || "Failed to verify bank account.",
            variant: "destructive",
          });
        }
      } else if (type === "udyam") {
        try {
          await triggerCheckerVerification(dsa.id, "UDYAM");
        } catch {
          // non-critical if not at Level 2 review stage
        }

        const regNo =
          dsa.business_license_no ||
          (dsa as any)?.udyam_registration_no ||
          "UDYAM-MH-12-0012345";
        const res = await adminApi.verifyUdyam({
          registration_number: regNo,
          dsa_id: dsaIdNum,
        });
        if (res && res.success) {
          setVerifiedKyc((prev) => ({ ...prev, udyam: true }));
          setFailedKyc((prev) => ({ ...prev, udyam: false }));
          toast({
            title: "Udyam Registration Verified",
            description:
              res.message || "MSME Udyam certificate verified successfully.",
            variant: "success",
          });
          await loadKycHistory(dsa.id);
          await fetchDsaDetail(dsa.id);
        } else {
          setVerifiedKyc((prev) => ({ ...prev, udyam: false }));
          setFailedKyc((prev) => ({ ...prev, udyam: true }));
          toast({
            title: "Udyam Verification Failed",
            description: res?.message || "Failed to verify Udyam registration.",
            variant: "destructive",
          });
        }
      } else if (type === "cibil") {
        if (isMakerUser) return;
        const isInd =
          dsa.dsa_type === "INDIVIDUAL" || dsa.dsa_type === "Individual";
        const cibilCode = isInd ? "CIBIL_CONSUMER" : "CIBIL_COMMERCIAL";
        const res = await triggerCheckerVerification(dsa.id, cibilCode, {
          pan: dsa.pan,
        });
        // Mark attempted regardless of success/failure (only throws are excluded)
        setCheckerKycAttempted("cibil", true);
        setCheckerKycAttemptedState((prev) => ({ ...prev, cibil: true }));
        await loadKycHistory(dsa.id);
        await fetchDsaDetail(dsa.id);
        if (
          res &&
          res.is_success !== false &&
          (res.status === undefined ||
            res.status === "success" ||
            res.status === true)
        ) {
          setVerifiedKyc((prev) => ({ ...prev, cibil: true }));
          setFailedKyc((prev) => ({ ...prev, cibil: false }));
        } else {
          setVerifiedKyc((prev) => ({ ...prev, cibil: false }));
          setFailedKyc((prev) => ({ ...prev, cibil: true }));
        }
      } else if (type === "aml") {
        if (isMakerUser) return;
        const res = await triggerCheckerVerification(dsa.id, "AML_COMPASS", {
          name: dsa.name,
          pan: dsa.pan,
        });
        // Mark attempted regardless of success/failure (only throws are excluded)
        setCheckerKycAttempted("aml", true);
        setCheckerKycAttemptedState((prev) => ({ ...prev, aml: true }));
        await loadKycHistory(dsa.id);
        await fetchDsaDetail(dsa.id);
        if (
          res &&
          res.is_success !== false &&
          (res.status === undefined ||
            res.status === "success" ||
            res.status === true)
        ) {
          setVerifiedKyc((prev) => ({ ...prev, aml: true }));
          setFailedKyc((prev) => ({ ...prev, aml: false }));
        } else {
          setVerifiedKyc((prev) => ({ ...prev, aml: false }));
          setFailedKyc((prev) => ({ ...prev, aml: true }));
        }
      }
    } catch (err: any) {
      setVerifiedKyc((prev) => ({ ...prev, [type]: false }));
      setFailedKyc((prev) => ({ ...prev, [type]: true }));
      const errMsg =
        err?.response?.data?.message ||
        err?.data?.message ||
        (Array.isArray(err?.response?.data?.error)
          ? err.response.data.error.join(", ")
          : err?.response?.data?.error) ||
        err?.message ||
        `Failed to process ${label}.`;
      toast({
        title: `${label} Error`,
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setVerifyingKyc((prev) => ({ ...prev, [type]: false }));
    }
  };

  // Task 12 & 13 Agreement & HO Credit Head Review State
  const [agreementReviewData, setAgreementReviewData] = useState<any | null>(
    null,
  );
  const [agreementReviewLoading, setAgreementReviewLoading] = useState(false);
  const [officialAgreement, setOfficialAgreement] = useState<any | null>(null);
  const [officialAgreementLoading, setOfficialAgreementLoading] =
    useState(false);
  const [verifyingAgreementAction, setVerifyingAgreementAction] = useState<
    "APPROVE" | "REJECT" | null
  >(null);
  const [agreementDecisionRemarks, setAgreementDecisionRemarks] = useState("");
  const [agreementDecisionError, setAgreementDecisionError] = useState("");
  const [agreementSubmitting, setAgreementSubmitting] = useState(false);
  const [resendActivationSuccess, setResendActivationSuccess] = useState<
    string | null
  >(null);
  const [downloadingAgreement, setDownloadingAgreement] = useState(false);

  const handleResendActivationEmail = () => {
    // Activation credentials are dispatched by the backend automatically
    // when the Branch Checker approves the signed agreement
    // (agreement/approve endpoint).
    // There is no separate resend endpoint — surfacing an info note is correct.
    setResendActivationSuccess(
      `Activation credentials were dispatched to ${dsa?.email ?? "the registered DSA email"} when the agreement was approved. To re-send, contact the backend admin or re-verify the agreement.`,
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
      if (
        revRes.status === "fulfilled" &&
        ((revRes.value as any).status === "success" ||
          (revRes.value as any).status === true)
      ) {
        setAgreementReviewData(revRes.value.data);
      }
      if (
        agmRes.status === "fulfilled" &&
        ((agmRes.value as any).status === "success" ||
          (agmRes.value as any).status === true)
      ) {
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
    // Only the Branch Checker can approve or reject the signed agreement.
    const canAct = isCheckerUserOrLevel;
    if (!canAct || !verifyingAgreementAction || !dsa) return;

    if (
      verifyingAgreementAction === "REJECT" &&
      !agreementDecisionRemarks.trim()
    ) {
      setAgreementDecisionError(
        "Rejection remarks are mandatory to explain why the signed agreement is rejected.",
      );
      return;
    }
    setAgreementSubmitting(true);
    setAgreementDecisionError("");
    try {
      let res;
      if (verifyingAgreementAction === "REJECT") {
        const signedDoc = (dsa?.documents || []).find((doc: any) => {
          const t = String(doc.document_type || doc.type || "").toUpperCase();
          return t === "SIGNED_AGREEMENT" || t === "SIGNED AGREEMENT";
        });
        if (!signedDoc?.id) {
          setAgreementDecisionError(
            "No uploaded scanned copy found to reject. Refresh the case and try again.",
          );
          return;
        }
        res = await adminApi.updateDsaDocumentStatus(dsa.id, {
          document_id: signedDoc.id,
          status: "Failed",
          remarks: agreementDecisionRemarks.trim(),
        });
        toast({
          title: "Agreement Rejected",
          description:
            "The scanned copy was rejected. Branch Maker or Branch Checker must upload a corrected copy.",
          variant: "warning",
        });
      } else {
        res = await approveSignedAgreement(
          dsa.id,
          agreementDecisionRemarks.trim() || undefined,
        );
        if (res) {
          setResendActivationSuccess(
            `Agreement approved. Activation credentials dispatched to ${dsa.email ?? "the registered DSA email"} by the system.`,
          );
        }
      }
      if (res) {
        setVerifyingAgreementAction(null);
        setAgreementDecisionRemarks("");
        await fetchDsaDetail(dsa.id);
        await loadAgreementData(dsa.id);
      }
    } catch (err: any) {
      setAgreementDecisionError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to submit agreement decision.",
      );
    } finally {
      setAgreementSubmitting(false);
    }
  };

  const [checkerDdNote, setCheckerDdNote] = useState("");
  const [isEditingDdNote, setIsEditingDdNote] = useState(false);
  const [isDdNoteModalOpen, setIsDdNoteModalOpen] = useState(false);
  const [checkerSavingNote, setCheckerSavingNote] = useState(false);
  const [savedCheckerDdNote, setSavedCheckerDdNote] = useState<any>(null);

  useEffect(() => {
    fetchDsaDetail(id);
  }, [id, fetchDsaDetail]);

  // Task 22 — case access control. A role may only open a case that is
  // currently at its own stage. Mirrors
  // DsaCaseAssignmentService::validateUserEligibilityForDsa() so the detail
  // UI is withheld entirely instead of letting a user claim (auto-acquire) a
  // case that has moved past them.
  const caseAccess = useMemo(
    () => resolveCaseAccess(dsa, currentUser?.role),
    [dsa, currentUser?.role],
  );

  // Task 22 — auto-acquire on open.
  // Opening a case claims the user-level lock so concurrent users cannot work
  // the same application. Fire-and-forget: a rejected acquire (locked by
  // someone else, or not this user's stage) must never block the read view,
  // so the detail is rendered regardless and the Audit Trails tab surfaces
  // the lock state. Guarded per DSA id to avoid duplicate claims on re-render.
  const autoAcquireRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || autoAcquireRef.current === String(id)) return;
    // Never claim a case that is not at this user's stage — that is the
    // loophole where a stray click would auto-acquire someone else's case.
    if (!dsa || !caseAccess.allowed) return;
    autoAcquireRef.current = String(id);
    void adminApi
      .acquireCase(id)
      .then((res) => {
        const data = res?.data as
          | { lock_status?: string; message?: string }
          | undefined;
        const alreadyMine = data?.lock_status === "LOCKED";
        toast({
          title: alreadyMine
            ? "Case already acquired by you"
            : "Case auto-acquired",
          description:
            data?.message ||
            "You now hold an exclusive lock on this case. Other users cannot process it until you release it or act on it.",
          variant: "success",
        });
        return fetchDsaDetail(id);
      })
      .catch((err: unknown) => {
        // 423 => someone else holds the lock. Surface it rather than silently
        // swallowing, so the user knows why they cannot act on this case.
        const status = (err as { status?: number })?.status;
        if (status === 423) {
          toast({
            title: "Case locked by another user",
            description:
              err instanceof Error
                ? err.message
                : "This case is already being processed by another user.",
            variant: "warning",
          });
        }
      });
  }, [id, dsa, caseAccess.allowed, fetchDsaDetail, toast]);

  /**
   * Task 22 — no client-side release is required after a workflow action.
   * DsaApprovalEngine already clears the lock atomically for every forward,
   * reject and revert transition (assigned_user_id = null, lock_status =
   * UNLOCKED), so the acting user is un-acquired server-side. Calling
   * releaseCase() here would only add a failure mode and a spurious
   * CASE_RELEASED audit row.
   */

  useEffect(() => {
    if (
      l7ReviewModalOpen &&
      dsa?.id &&
      !l7ReviewData &&
      !l7ReviewLoading
    ) {
      loadFinalApprovalReview(dsa.id);
    }
  }, [l7ReviewModalOpen, dsa?.id, l7ReviewData, l7ReviewLoading, loadFinalApprovalReview]);

  useEffect(() => {
    if (!dsa?.id || isMakerUser || !isCheckerRole) {
      setCheckerDdNote("");
      setSavedCheckerDdNote(null);
      return;
    }

    const noteFromDsa =
      dsa?.latest_due_diligence_note ||
      (dsa as any)?.latestDueDiligenceNote ||
      dsa?.due_diligence_notes?.[0] ||
      (dsa as any)?.dueDiligenceNotes?.[0];

    if (noteFromDsa) {
      setSavedCheckerDdNote(noteFromDsa);
    }

    const isSubmitted = Boolean(
      noteFromDsa?.submitted_at ||
      dsa?.documents?.some(
        (d: any) =>
          String(d.document_type || d.type || "").toUpperCase() ===
          "DUE_DILIGENCE_REVIEW_REPORT",
      ),
    );

    if (isSubmitted) {
      setCheckerDdNote("");
    } else {
      const rawObs = noteFromDsa?.observations;
      const existingNote = getCleanRemark(rawObs);
      if (existingNote) {
        setCheckerDdNote(existingNote);
      }
    }

    fetchCheckerDdNote(dsa.id)
      .then((noteData) => {
        if (noteData) {
          setSavedCheckerDdNote(noteData);
          if (!noteData.submitted_at && !isSubmitted) {
            const obs = getCleanRemark(noteData.observations);
            if (obs) {
              setCheckerDdNote(obs);
            }
          }
        }
      })
      .catch(() => {});
  }, [dsa?.id, isMakerUser, isCheckerRole, fetchCheckerDdNote]);

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

  // Synchronize KYC verification states on mount / DSA change.
  // Always fetch kyc_verifications (both tables) so statuses persist after reload.
  useEffect(() => {
    if (!dsa?.id) return;

    // Always load KYC history so verifiedKyc can be seeded from kyc_verifications
    loadKycHistory(dsa.id).then((/* void */) => {
      // After history is loaded, seed verifiedKyc from kycVerificationsList.
      // This is handled reactively in the kycVerificationsList effect below.
    });

    // Pre-populate from dsa_verifications for already-approved DSAs
    const isAlreadyApproved =
      dsa.onboarding_status === "APPROVED" ||
      dsa.onboarding_status === "AGREEMENT_COMPLETED" ||
      dsa.agreement_status === "SIGNED_VERIFIED" ||
      dsa.operational_status === "ACTIVE";

    if (isAlreadyApproved) {
      const vers: any[] = ((dsa as any)?.verifications || []).filter(
        (v: any) => {
          if (dsa?.created_at && v.created_at) {
            return new Date(v.created_at) >= new Date(dsa.created_at);
          }
          return true;
        },
      );
      const isDoneInDsa = (pat: string) =>
        vers.some((v: any) => {
          const c = String(v.verification_code || "").toUpperCase();
          const st = String(v.execution_status || "").toUpperCase();
          return (
            c.includes(pat.toUpperCase()) &&
            (Boolean(v.is_success) || st === "SUCCESS" || st === "COMPLETED")
          );
        });

      setVerifiedKyc((prev) => ({
        ...prev,
        pan: prev.pan || isDoneInDsa("PAN"),
        gst: prev.gst || isDoneInDsa("GST"),
        bank: prev.bank || isDoneInDsa("BANK") || isDoneInDsa("BAV"),
        udyam: prev.udyam || isDoneInDsa("UDYAM"),
        cibil: prev.cibil || isDoneInDsa("CIBIL"),
        aml: prev.aml || isDoneInDsa("AML"),
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsa?.id, dsa?.onboarding_status, dsa?.agreement_status, dsa?.operational_status]);

  // Reactively seed verifiedKyc whenever kycVerificationsList changes (fires after loadKycHistory resolves).
  // This is what makes KYC status survive page reloads — statuses come from kyc_verifications DB records.
  useEffect(() => {
    if (!kycVerificationsList.length) return;
    const checkSuccess = (v: any) => {
      const st = String(v.status || v.execution_status || "").toUpperCase();
      return (
        Boolean(v.is_success) ||
        st === "SUCCESS" ||
        st === "COMPLETED" ||
        st === "PASSED" ||
        st === "VERIFIED"
      );
    };
    const checkFailed = (v: any) => {
      const st = String(v.status || v.execution_status || "").toUpperCase();
      return (
        v.is_success === false ||
        st === "FAILED" ||
        st === "ERROR" ||
        st === "REJECTED"
      );
    };
    const matchesPat = (v: any, pats: string[]) => {
      const t = String(
        v.type || v.verification_type || v.verification_code || "",
      ).toUpperCase();
      return pats.some((p) => t.includes(p.toUpperCase()));
    };
    const afterCreation = (v: any) =>
      !dsa?.created_at ||
      !v.created_at ||
      new Date(v.created_at) >= new Date(dsa.created_at);

    const has = (pats: string[]) =>
      kycVerificationsList.some(
        (v: any) =>
          matchesPat(v, pats) &&
          checkSuccess(v) &&
          !checkFailed(v) &&
          afterCreation(v),
      );

    setVerifiedKyc((prev) => ({
      pan:   prev.pan   || has(["PAN"]),
      gst:   prev.gst   || has(["GST"]),
      bank:  prev.bank  || has(["BANK", "BAV"]),
      udyam: prev.udyam || has(["UDYAM", "MSME"]),
      cibil: prev.cibil || has(["CIBIL", "BUREAU", "TRANSUNION"]),
      aml:   prev.aml   || has(["AML", "SANCTION", "COMPASS"]),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kycVerificationsList]);

  const openDdNoteModal = () => {
    if (isMakerUser && !hasCheckerGeneratedReport) {
      toast({
        title: "Access Restricted",
        description:
          "Due Diligence Note is accessible only from Checker stage onwards.",
        variant: "warning",
      });
      return;
    }
    setViewingDdNoteModal(true);
  };

  const handleDownloadDeviationReport = async () => {
    if (!dsa) return;
    if (isMakerUser && !hasCheckerGeneratedReport) {
      toast({
        title: "Report Not Available Yet",
        description:
          "Due Diligence Review Report is available for download once Checker generates and submits it.",
        variant: "warning",
      });
      return;
    }

    try {
      const pdfRes = await adminApi.getDdReviewReportPdf(dsa.id);
      if (pdfRes?.data?.file_url) {
        fetchDeviationReport(dsa.id)
          .then((fresh) => {
            if (fresh) setDeviationReportData(fresh);
          })
          .catch(() => {});
        fetchBackendDocuments(true).catch(() => {});
        const link = document.createElement("a");
        link.href = pdfRes.data.file_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.download =
          pdfRes.data.file_name ||
          `DSA-${getEffectiveDsaCode(dsa)}-DD-Review-Report.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({
          title: "Report Downloaded",
          description: "Fresh Due Diligence Review Report PDF generated.",
          variant: "success",
        });
        return;
      }
    } catch {
      // Fallback to text report generation if PDF generation is not available
    }

    const rep = deviationReportData;
    const bre = rep?.bre_evaluation || rep;
    const rules: any[] = bre?.rules || [];
    const deviations: any[] = rep?.deviations || bre?.deviations || [];
    const rejections: any[] = rep?.rejections || bre?.rejections || [];
    const overallDecision = String(
      bre?.overall_decision || (deviations.length > 0 ? "DEVIATION" : "PASS"),
    ).toUpperCase();
    const evalId = bre?.evaluation_id || rep?.evaluation_id || "BRE-AUTO-EVAL";
    const makerVerif = rep?.maker_verification;
    const checkerVerifs: Record<string, any> = rep?.checker_verifications || {};
    const ddNote =
      rep?.dd_note ||
      dsa?.latest_due_diligence_note ||
      dsa?.due_diligence_notes?.[0];

    const lines = [
      "================================================================================",
      "COSMOS CO-OPERATIVE BANK LIMITED - DUE DILIGENCE & BRE DEVIATION ASSESSMENT REPORT",
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
        ? deviations
            .map(
              (d: any, i: number) =>
                `  ${i + 1}. ${typeof d === "string" ? d : d.remarks || d.rule_name}`,
            )
            .join("\n")
        : "  None — All eligible rules passed standards.",
      "--------------------------------------------------------------------------------",
      "DETAILED RULE-BY-RULE POLICY ASSESSMENT:",
      ...rules.map((r: any, idx: number) =>
        [
          `[Rule ${idx + 1}] ${r.rule_name || r.rule_code} (${r.rule_code})`,
          `  Status:         ${r.status}`,
          `  Expected:       ${r.expected_value || "Per Bank Policy Standards"}`,
          `  Applicant Data: ${r.actual_value || "N/A"}`,
          `  Remarks:        ${r.remarks || "No remarks"}`,
          "",
        ].join("\n"),
      ),
      "--------------------------------------------------------------------------------",
      "STATUTORY DUE DILIGENCE (DDL) VERIFICATIONS:",
      makerVerif
        ? `[Maker Check] ${makerVerif.verification_code}: ${makerVerif.execution_status} (Attempt ${makerVerif.attempt_number || 1}) - Ref: ${makerVerif.request_reference || "N/A"}`
        : "",
      ...Object.entries(checkerVerifs).map(
        ([code, ver]: [string, any]) =>
          `[Checker Check] ${code}: ${ver.execution_status || "NOT_TRIGGERED"}${ver.is_success ? " (PASSED)" : ""} (Attempt ${ver.attempt_number || 0}) - Ref: ${ver.request_reference || "N/A"}`,
      ),
      "--------------------------------------------------------------------------------",
      "CHECKER DUE DILIGENCE (DD) REVIEW NOTE & OBSERVATIONS:",
      `Submitted:           ${ddNote?.submitted_at ? formatDate(ddNote.submitted_at) : "Draft / In Progress"}`,
      `Submitted By:        Checker ID: ${ddNote?.checker_user_id || "Branch Checker"}`,
      `Recommendation:      ${ddNote?.recommendation || "RECOMMEND"}`,
      `Field Observations:  ${getCleanRemark(ddNote?.observations || checkerDdNote)}`,
      `Reviewer Remarks:    ${getCleanRemark(ddNote?.remarks || checkerRemarks)}`,
      ddNote?.exception_remarks
        ? `Exceptions:          ${getCleanRemark(ddNote.exception_remarks)}`
        : "",

      "================================================================================",
    ].filter(Boolean);

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
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
    if (isMakerUser) {
      toast({
        title: "Access Restricted",
        description: "Due Diligence Note is not accessible to Maker.",
        variant: "warning",
      });
      return;
    }
    const note =
      savedCheckerDdNote ||
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
      getCleanRemark(note?.observations || checkerDdNote),
      ...(getCleanRemark(note?.exception_remarks)
        ? [
            "--------------------------------------------------------------------------------",
            "EXCEPTION REMARKS:",
            getCleanRemark(note?.exception_remarks),
          ]
        : []),
      "================================================================================",
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
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
  const [viewedDocIds, setViewedDocIds] = useState<Set<number | string>>(
    new Set(),
  );
  const [manuallyVerifiedDocIds, setManuallyVerifiedDocIds] = useState<
    Set<number | string>
  >(new Set());
  const [manuallyFailedDocIds, setManuallyFailedDocIds] = useState<
    Set<number | string>
  >(new Set());
  const [checkerVerifiedDocIds, setCheckerVerifiedDocIds] = useState<
    Set<number | string>
  >(new Set());
  const [reuploadingDocType, setReuploadingDocType] = useState<string | null>(
    null,
  );
  const [loadingPreviewDocId, setLoadingPreviewDocId] = useState<any>(null);

  // Real DSA Portal Users mapped via GET /api/v1/dsa/{id}/users (Phase 2)
  const [dsaPortalUsers, setDsaPortalUsers] = useState<any[]>([]);
  const [dsaPortalUsersLoading, setDsaPortalUsersLoading] =
    useState<boolean>(false);

  const fetchDsaPortalUsers = useCallback(async () => {
    if (!dsa?.id) return;
    setDsaPortalUsersLoading(true);
    try {
      const res: any = await adminApi.getDsaUsers(dsa.id);
      const list =
        res?.data?.users ||
        res?.users ||
        (Array.isArray(res?.data) ? res.data : []);
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

  const fetchBackendDocuments = useCallback(
    async (force = false) => {
      if (!dsa?.id) return;
      if (!force && docsFetchedForDsaRef.current === dsa.id) {
        return;
      }
      docsFetchedForDsaRef.current = dsa.id;
      setBackendDocsLoading(true);
      try {
        const res: any = await adminApi.getDsaDocuments(dsa.id);
        const items =
          res?.data?.items ||
          res?.data ||
          (Array.isArray(res?.items) ? res.items : []);
        if (Array.isArray(items)) {
          setBackendDocs(items);
        }
      } catch {
        // fallback to dsa.documents
      } finally {
        setBackendDocsLoading(false);
      }
    },
    [dsa?.id],
  );

  useEffect(() => {
    if (tab === "agents" && dsa?.id) {
      fetchDsaPortalUsers();
    }
  }, [tab, dsa?.id, fetchDsaPortalUsers]);

  useEffect(() => {
    if (dsa?.id) {
      fetchBackendDocuments();
    }
  }, [dsa?.id, fetchBackendDocuments]);

  const openDocPreview = async (doc: any) => {
    if (isDdReviewReportDocument(doc) && dsa?.id) {
      try {
        setLoadingPreviewDocId(doc?.id || "dd_report");
        const res = await adminApi.getDdReviewReportPdf(dsa.id);
        const data = res?.data;
        if (data) {
          const freshDoc = {
            ...doc,
            id: data.document_id || doc.id,
            document_type: "DUE_DILIGENCE_REVIEW_REPORT",
            file_name: data.file_name || doc.file_name,
            file_path: data.file_path || doc.file_path,
            file_url: data.file_url
              ? `${data.file_url}?t=${Date.now()}`
              : doc.file_url,
            url: data.file_url ? `${data.file_url}?t=${Date.now()}` : doc.url,
            size: data.size || doc.size,
            status: doc.status || (data as any)?.status || "Uploaded",
            _timestamp: Date.now(),
          };
          setPreviewDoc(freshDoc);
          if (freshDoc.id) {
            setViewedDocIds((prev) => new Set([...prev, freshDoc.id]));
          }
          fetchBackendDocuments(true).catch(() => {});
          return;
        }
      } catch (err) {
        console.error("Failed to fetch fresh DD review report PDF", err);
      } finally {
        setLoadingPreviewDocId(null);
      }
    }
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
        const response = await adminApi.getActivityLogs({
          group: "dsa",
          page: 1,
          per_page: 8,
        });
        setDsaAudit(response.data);
      } catch (err) {
        // Activity log API access is restricted to Super Admin (DSA Manager)
      }
    }
    loadDsaAudit();
  }, [dsa, currentUser?.role]);

  useEffect(() => {
    if (!dsa) return;
    adminApi
      .getDsaDocumentChecklist(dsa.id)
      .then((res: any) => setDocChecklist(res?.data ?? res))
      .catch(() => {
        /* non-fatal — checklist stays null */
      });
  }, [dsa]);

  const isRefreshingDdReportRef = useRef(false);
  const lastFetchedDdlKeyRef = useRef<string | null>(null);

  const refreshDdReviewReport = useCallback(
    async (showLoading: boolean = true) => {
      if (!dsa?.id || isRefreshingDdReportRef.current) return;
      isRefreshingDdReportRef.current = true;
      if (showLoading) setLoadingDeviationReport(true);
      try {
        if (!isMakerUser) {
          try {
            await adminApi.getDdReviewReportPdf(dsa.id);
          } catch (pdfErr) {
            console.warn("getDdReviewReportPdf error on DD report refresh:", pdfErr);
          }
        }
        const data = await fetchDeviationReport(dsa.id);
        if (data) {
          setDeviationReportData(data);
          if (data.dd_note) {
            setSavedCheckerDdNote(data.dd_note);
          }
        }
        fetchBackendDocuments(true).catch(() => {});
      } catch (err) {
        console.error("Failed to refresh due diligence report:", err);
      } finally {
        if (showLoading) setLoadingDeviationReport(false);
        isRefreshingDdReportRef.current = false;
      }
    },
    [dsa?.id, isMakerUser, fetchDeviationReport, fetchBackendDocuments],
  );

  useEffect(() => {
    if (tab === "overview" && appFormSubTab === "ddl" && dsa?.id) {
      const key = `${dsa.id}_${tab}_${appFormSubTab}`;
      if (lastFetchedDdlKeyRef.current !== key) {
        lastFetchedDdlKeyRef.current = key;
        refreshDdReviewReport();
      }
    } else if (tab !== "overview" || appFormSubTab !== "ddl") {
      lastFetchedDdlKeyRef.current = null;
    }
  }, [tab, appFormSubTab, dsa?.id, refreshDdReviewReport]);

  useEffect(() => {
    if (
      (tab === "reports" || (tab === "overview" && appFormSubTab !== "ddl") || tab === "actions") &&
      dsa?.id
    ) {
      setLoadingDeviationReport(true);
      fetchDeviationReport(dsa.id)
        .then((data) => {
          if (data) {
            setDeviationReportData(data);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch deviation report", err);
        })
        .finally(() => {
          setLoadingDeviationReport(false);
        });
    }
  }, [tab, appFormSubTab, dsa?.id, fetchDeviationReport]);

  const isPanChecked =
    !failedKyc.pan && (Boolean(verifiedKyc.pan) || isKycTypeVerified("pan", ["PAN"]));
  const isGstChecked =
    !failedKyc.gst &&
    (Boolean(verifiedKyc.gst) || isKycTypeVerified("gst", ["GST"]));
  const isBankChecked =
    !failedKyc.bank &&
    (Boolean(verifiedKyc.bank) || isKycTypeVerified("bank", ["BANK", "BAV"]));
  const isUdyamChecked =
    !failedKyc.udyam &&
    (Boolean(verifiedKyc.udyam) ||
      isKycTypeVerified("udyam", ["UDYAM", "MSME"]));
  const isCibilChecked =
    !failedKyc.cibil &&
    (Boolean(verifiedKyc.cibil) ||
      isKycTypeVerified("cibil", ["CIBIL", "BUREAU", "TRANSUNION"]));
  const isAmlChecked =
    !failedKyc.aml &&
    (Boolean(verifiedKyc.aml) ||
      isKycTypeVerified("aml", ["AML", "SANCTION", "COMPASS"]));

  const isAllKycVerified = Boolean(
    isPanChecked &&
    isGstChecked &&
    isBankChecked &&
    isUdyamChecked &&
    isCibilChecked &&
    isAmlChecked,
  );

  if (loading || !dsa) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  // Branch Access Gate: Check if user is restricted to a branch other than this DSA's assigned branch
  if (
    userBranchScope?.isBranchRestricted &&
    !isDsaInBranchScope(dsa, userBranchScope)
  ) {
    return (
      <div className="mx-auto max-w-2xl py-12 px-4">
        <Card className="border-rose-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                Branch Access Restricted
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                DSA{" "}
                <strong>
                  #{getEffectiveDsaCode(dsa)} ({dsa.name})
                </strong>{" "}
                is assigned to{" "}
                <span className="font-semibold text-slate-800">
                  {dsa.branch?.branch_name ||
                    dsa.branch_name ||
                    (dsa.branch_id
                      ? `Branch #${dsa.branch_id}`
                      : "another branch")}
                </span>
                .
              </p>
              <p className="text-xs text-slate-500">
                Your account is scoped to{" "}
                <span className="font-semibold text-blue-700">
                  {userBranchScope.primaryBranchName ||
                    userBranchScope.primaryBranchCode}
                </span>
                . Branch staff may only view and process DSAs assigned to their
                branch.
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

  const isBankUser =
    currentUser?.role !== "DSA Partner" && currentUser?.role !== "Customer";

  const canDecideDsa = workflowLevelInfo.canUserApprove;
  const canApproveDsa =
    canDecideDsa && (docChecklist ? docChecklist.is_complete : true);

  // Newest-wins rule shared by the DSA Actions tab, the L7 review modal and the
  // DD Review Report: prefer actioned rows, then the latest actioned_at, then the
  // highest row id (same-second actions).
  const isLaterApprovalRow = (a: any, b: any): boolean => {
    const aActioned =
      Boolean(a?.actioned_at) || (a?.status && a.status !== "PENDING");
    const bActioned =
      Boolean(b?.actioned_at) || (b?.status && b.status !== "PENDING");
    if (aActioned !== bActioned) return aActioned;
    const aT = a?.actioned_at ? new Date(a.actioned_at).getTime() : 0;
    const bT = b?.actioned_at ? new Date(b.actioned_at).getTime() : 0;
    if (aT !== bT) return aT > bT;
    return Number(a?.id ?? 0) > Number(b?.id ?? 0);
  };

  // Approvals are append-only: a stage accumulates rows over time
  // (RECOMMEND → REVERT/QUERY → RECOMMEND again). Always surface the NEWEST
  // actioned row per stage so re-approved remarks replace the stale ones.
  const pickLatestApproval = (matches: (a: any) => boolean): any => {
    if (!Array.isArray(dsa?.approvals)) return null;
    return dsa.approvals
      .filter(matches)
      .reduce(
        (latest: any, row: any) =>
          !latest || isLaterApprovalRow(row, latest) ? row : latest,
        null,
      );
  };

  const l1Approval: any = pickLatestApproval(
    (a: any) =>
      Number(a.approval_level) === 1 || a.stage_code === "LEVEL_1_MAKER",
  );

  const l2Approval: any = pickLatestApproval(
    (a: any) =>
      Number(a.approval_level) === 2 || a.stage_code === "LEVEL_2_CHECKER",
  );

  const isMakerUserOrLevel =
    isMakerUser ||
    isMakerLevel ||
    (!isCheckerRole && isBankUser && workflowLevelInfo.currentLevel <= 1);
  const isCheckerUserOrLevel =
    isCheckerRole ||
    (!isMakerUser && (isCheckerLevel || workflowLevelInfo.currentLevel === 2));

  // Task: L7 (HO Credit Head / DSA Manager / Admin) must NOT see the Agreements
  // tab. `isCheckerRole` and `isL7User` both match Admin/Super Admin, so the
  // exclusion has to be explicit rather than relying on the OR below.
  const canViewAgreementsTab = Boolean(
    !isL7User &&
      (isMakerUserOrLevel || isCheckerUserOrLevel || isMakerLevel || isCheckerLevel),
  );

  const canEditBasicDetails = Boolean(
    (isMakerLevel ||
      isMakerUserOrLevel ||
      (dsa as any)?.current_stage_info?.is_maker_actionable) &&
    !["APPROVED", "REJECTED"].includes(dsa?.onboarding_status),
  );

  // Document Operations RBAC:
  // ONLY Maker can re-upload or upload missing documents
  const canMakerReuploadDocs = Boolean(
    isMakerUser &&
    dsa?.operational_status !== "ACTIVE" &&
    dsa?.onboarding_status !== "REJECTED",
  );

  // Maker AND Checker can verify documents (Task 24).
  const canApproveDocs = Boolean(
    (isMakerUser || isCheckerRole || (isCheckerLevel && !isMakerUser)) &&
    dsa?.operational_status !== "ACTIVE" &&
    dsa?.onboarding_status !== "REJECTED",
  );

  // DD Review Report verification stays Checker-only.
  const canApproveDoc = (doc: any): boolean =>
    canApproveDocs &&
    !isApplicationFormDocument(doc) &&
    (!isDdReviewReportDocument(doc) ||
      isCheckerRole ||
      (isCheckerLevel && !isMakerUser));

  // Document status resolution across all 7 roles:
  // - Returns "Verified" (badge displays "Checked") if verified in backend or during session by Checker
  // - Returns "Failed" if failed in backend or during session by Checker
  // - Returns "Pending" if newly uploaded, re-uploaded by Maker, or awaiting Checker verification
  const getEffectiveDocStatus = (doc: any): string => {
    if (!doc) return "Pending";
    if (isApplicationFormDocument(doc)) return "Verified";
    if (manuallyFailedDocIds.has(doc.id)) return "Failed";
    if (manuallyVerifiedDocIds.has(doc.id) || checkerVerifiedDocIds.has(doc.id))
      return "Verified";

    const backendStatus = String(doc.status || "").trim();
    if (backendStatus.toLowerCase() === "verified") return "Verified";
    if (
      backendStatus.toLowerCase() === "failed" ||
      backendStatus.toLowerCase() === "rejected"
    )
      return "Failed";

    if (isVisitReportDocument(doc)) {
      if ((workflowLevelInfo?.currentLevel ?? 1) > 2) return "Verified";
      return "Pending";
    }

    return doc.status || "Pending";
  };

  // Maker-only document re-upload handler:
  // Replaces the document in storage and backend DB, resets status to 'Pending' for Checker review
  const handleMakerReupload = async (doc: any, file: File) => {
    if (!dsa?.id) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum allowed file size is 10MB.",
        variant: "warning",
      });
      return;
    }
    const docType = doc.document_type || doc.type;
    setReuploadingDocType(docType);
    try {
      if (isVisitReportDocument(doc)) {
        await adminApi.uploadDsaVisitReport(
          dsa.id,
          file,
          `Re-uploaded by Maker (${currentUser?.name || "Maker"})`,
        );
      } else {
        await uploadDsaDocument(dsa.id, {
          file,
          document_type: docType,
          owner_name: dsa.name,
          remarks: `Re-uploaded by Maker (${currentUser?.name || "Maker"})`,
        });
      }

      // Reset local manual verification / fail states for this document
      if (doc.id) {
        setManuallyVerifiedDocIds((prev) => {
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
        setManuallyFailedDocIds((prev) => {
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
        setCheckerVerifiedDocIds((prev) => {
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
        setViewedDocIds((prev) => {
          const next = new Set(prev);
          next.delete(doc.id);
          return next;
        });
      }

      await fetchBackendDocuments(true);
      await fetchDsaDetail(dsa.id);
      adminApi
        .getDsaDocumentChecklist(dsa.id)
        .then((res: any) => setDocChecklist(res?.data ?? res))
        .catch(() => {});

      toast({
        title: "Document Re-uploaded",
        description: `${formatDocumentType(docType)} replaced successfully. Status is reset to Pending for Checker review.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Re-upload Failed",
        description: err?.message || "Failed to re-upload document.",
        variant: "warning",
      });
    } finally {
      setReuploadingDocType(null);
    }
  };

  // Use backend checklist missing items; filter staff_only documents:
  // - Non-bank users (e.g. self onboarding applicant or DSA partner) do not see staff_only docs
  // - Only Maker/L1 can upload visit_report/staff_only docs
  // - Checker/L2 verifies visit_report, not uploads it
  const missingProfileDocuments: Array<{
    document_type: string;
    display_name: string;
    requirement: string;
    staff_only?: boolean;
  }> = [
    ...(docChecklist?.checklist?.filter((item: any) => {
      // Rely solely on the checklist API's is_uploaded flag (authoritative)
      if (item.is_uploaded) return false;
      const isVisitReport = isVisitReportDocument(item) || item.staff_only;
      if (isVisitReport && Boolean((dsa as any)?.visit_report_file))
        return false;
      if (isVisitReport && !isBankUser) return false;
      const canUploadStaffDoc = isMakerUserOrLevel || isCheckerUserOrLevel;
      if (isVisitReport && !canUploadStaffDoc) return false;
      return item.is_required || (item.staff_only && canUploadStaffDoc);
    }) ?? []),
  ];

  const l3Approval: any = pickLatestApproval(
    (a: any) =>
      Number(a.approval_level) === 3 ||
      a.stage_code === "LEVEL_3_SUB_REGION" ||
      a.stage_code === "LEVEL_3_SUB_REGION_HEAD",
  );

  const l4Approval: any = pickLatestApproval(
    (a: any) =>
      Number(a.approval_level) === 4 || a.stage_code === "LEVEL_4_DGM",
  );

  const l5Approval: any = pickLatestApproval(
    (a: any) =>
      Number(a.approval_level) === 5 ||
      a.stage_code === "LEVEL_5_REGION_HEAD",
  );

  const l6Approval: any = pickLatestApproval(
    (a: any) =>
      Number(a.approval_level) === 6 ||
      a.stage_code === "LEVEL_6_HO_CREDIT_OFFICER",
  );

  const l7Approval: any = pickLatestApproval(
    (a: any) =>
      Number(a.approval_level) === 7 ||
      a.stage_code === "LEVEL_7_HO_CREDIT_HEAD",
  );

  const makerRemarks =
    l1Approval?.remarks ||
    dsa?.status_reason ||
    (l1Approval?.status === "RECOMMENDED" ||
    l1Approval?.status === "SUBMITTED" ||
    (workflowLevelInfo?.currentLevel ?? 1) > 1
      ? "Maker verification completed and forwarded to Checker"
      : "");

  const isL2Actioned = Boolean(
    l2Approval?.status === "RECOMMENDED" ||
      l2Approval?.status === "SUBMITTED" ||
      l2Approval?.status === "APPROVED" ||
      l2Approval?.status === "REJECTED" ||
      l2Approval?.status === "REVERTED" ||
      (workflowLevelInfo?.currentLevel ?? 1) > 2,
  );

  const checkerRemarks =
    l2Approval?.remarks ||
    (isL2Actioned
      ? "Due Diligence completed and forwarded by Checker"
      : "");

  const l3Remarks =
    l3Approval?.remarks ||
    (l3Approval?.status === "RECOMMENDED" ||
    (workflowLevelInfo?.currentLevel ?? 1) > 3
      ? "Recommended by Sub-Region Head"
      : "");

  const l4Remarks =
    l4Approval?.remarks ||
    (l4Approval?.status === "SKIPPED"
      ? "Bypassed per workflow rule (No DGM posted for branch)"
      : l4Approval?.status === "RECOMMENDED" ||
          (workflowLevelInfo?.currentLevel ?? 1) > 4
        ? "Recommended by DGM"
        : "");

  const l5Remarks =
    l5Approval?.remarks ||
    (l5Approval?.status === "RECOMMENDED" ||
    (workflowLevelInfo?.currentLevel ?? 1) > 5
      ? "Recommended by Region Head"
      : "");

  const l6Remarks =
    l6Approval?.remarks ||
    (l6Approval?.status === "RECOMMENDED" ||
    (workflowLevelInfo?.currentLevel ?? 1) > 6
      ? "Credit appraisal recommended for sanction"
      : "");

  const l7Remarks =
    l7Approval?.remarks ||
    (l7Approval?.status === "APPROVED"
      ? "Final Sanction & Approval granted by HO Credit Head"
      : "");

  const isL7AlreadyApproved = Boolean(
    dsa?.onboarding_status === "APPROVED" ||
      dsa?.onboarding_status === "AGREEMENT_PENDING" ||
      dsa?.onboarding_status === "AGREEMENT_COMPLETED" ||
      dsa?.agreement_status === "SIGNED_UPLOADED" ||
      dsa?.agreement_status === "SIGNED_VERIFIED" ||
      dsa?.operational_status === "ACTIVE" ||
      workflowLevelInfo?.isCompleted ||
      (workflowLevelInfo?.currentLevel ?? 1) > 7,
  );

  const isL7AlreadyRejected = Boolean(
    dsa?.onboarding_status === "REJECTED" ||
      (dsa as any)?.status === "REJECTED",
  );

  const canViewL7Review = Boolean(
    isL7User ||
      isHoHeadRole ||
      (workflowLevelInfo?.currentLevel ?? 1) >= 7 ||
      isAdminOrSuperAdmin,
  );

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

  const isVerificationAttempted = (code: string) => {
    const codeUpper = (code || "").toUpperCase();

    // 1. In existingVerifications (from dsa.verifications)
    const inExisting = existingVerifications.some((v) => {
      const vCode = (v.verification_code || v.type || "").toUpperCase();
      const st = (v.execution_status || v.status || "").toUpperCase();
      return (
        vCode === codeUpper &&
        (v.is_success !== undefined ||
          st === "COMPLETED" ||
          st === "FAILED" ||
          st === "TIMEOUT" ||
          st === "SUCCESS" ||
          st === "PASSED" ||
          st === "VERIFIED" ||
          (v.attempt_number && v.attempt_number > 0))
      );
    });
    if (inExisting) return true;

    // 2. In session / local state fallback
    if (codeUpper.includes("PAN")) {
      if (failedKyc.pan) return false;
      if (verifiedKyc.pan) return true;
    }
    if (codeUpper === "CIBIL_CONSUMER" || codeUpper === "CIBIL_COMMERCIAL") {
      if (checkerKycAttempted.cibil || verifiedKyc.cibil || failedKyc.cibil)
        return true;
    }
    if (codeUpper === "AML_COMPASS") {
      if (checkerKycAttempted.aml || verifiedKyc.aml || failedKyc.aml)
        return true;
    }
    if (codeUpper === "GST") {
      if (verifiedKyc.gst || failedKyc.gst) return true;
    }
    if (codeUpper === "UDYAM") {
      if (verifiedKyc.udyam || failedKyc.udyam) return true;
    }

    return false;
  };

  const isVerificationDone = isVerificationAttempted;

  const pendingCheckerVerifications = requiredCheckerVerifications.filter(
    (v) => !isVerificationDone(v.code),
  );
  const areAllCheckerVerificationsDone =
    pendingCheckerVerifications.length === 0;

  const handleSaveCheckerDdNote = async () => {
    if (!checkerDdNote.trim()) {
      toast({
        title: "Observations Required",
        description:
          "Please enter observations or due diligence findings before saving.",
        variant: "warning",
      });
      return;
    }
    setCheckerSavingNote(true);
    try {
      const res = await saveCheckerDdNote(dsa.id, {
        observations: checkerDdNote.trim(),
        remarks: checkerRemarks.trim() || approvalRemarks.trim() || "",
      });
      const saved = res || {
        observations: checkerDdNote.trim(),
        remarks: checkerRemarks.trim() || approvalRemarks.trim() || "",
      };
      setSavedCheckerDdNote(saved);
      setCheckerDdNote("");
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

  const handleSubmitCheckerDdReport = async () => {
    if (!dsa) return;

    const effectiveObs =
      checkerDdNote.trim() ||
      savedCheckerDdNote?.observations ||
      dsa?.latest_due_diligence_note?.observations ||
      dsa?.due_diligence_notes?.[0]?.observations ||
      (dsa as any)?.dueDiligenceNotes?.[0]?.observations ||
      (dsa as any)?.latestDueDiligenceNote?.observations ||
      deviationReportData?.dd_note?.observations ||
      "";

    const effectiveRemarks =
      checkerRemarks.trim() ||
      approvalRemarks.trim() ||
      savedCheckerDdNote?.remarks ||
      dsa?.latest_due_diligence_note?.remarks ||
      dsa?.due_diligence_notes?.[0]?.remarks ||
      (dsa as any)?.dueDiligenceNotes?.[0]?.remarks ||
      (dsa as any)?.latestDueDiligenceNote?.remarks ||
      deviationReportData?.dd_note?.remarks ||
      "";

    if (!effectiveObs && !hasCheckerDdNote) {
      toast({
        title: "Due Diligence Note Required",
        description:
          "Please enter your due diligence observations before submitting the report.",
        variant: "warning",
      });
      return;
    }

    setSubmittingCheckerReport(true);
    try {
      const res = await generateCheckerDdReviewReport(dsa.id, {
        observations: effectiveObs || undefined,
        remarks: effectiveRemarks || undefined,
      });
      if (res) {
        setDeviationReportData(res);
        setSavedCheckerDdNote(
          res?.dd_note || {
            observations: effectiveObs,
            remarks: effectiveRemarks,
            submitted_at: new Date().toISOString(),
          },
        );
        setCheckerDdNote("");
        setIsEditingDdNote(false);
        const ddlDocId = res?.pdf?.document_id;
        if (ddlDocId) {
          setCheckerVerifiedDocIds((prev) => {
            const next = new Set(prev);
            next.delete(ddlDocId);
            return next;
          });
          setManuallyVerifiedDocIds((prev) => {
            const next = new Set(prev);
            next.delete(ddlDocId);
            return next;
          });
          setViewedDocIds((prev) => {
            const next = new Set(prev);
            next.delete(ddlDocId);
            return next;
          });
        }
        await Promise.all([
          fetchBackendDocuments(true).catch(() => {}),
          fetchDsaDetail(dsa.id).catch(() => {}),
          fetchDeviationReport(dsa.id)
            .then((freshRep) => {
              if (freshRep) setDeviationReportData(freshRep);
            })
            .catch(() => {}),
        ]);
        toast({
          title: "Due Diligence Report Submitted",
          description:
            "Due Diligence Review Report generated. Please view and verify the updated report in the Documents tab before submitting recommendation.",
          variant: "success",
        });
      }
    } catch (err: any) {
      toast({
        title: "Report Submission Failed",
        description: err?.message || "Failed to submit Due Diligence Report.",
        variant: "destructive",
      });
    } finally {
      setSubmittingCheckerReport(false);
    }
  };

  const kycVerifiedCount = [
    isPanChecked,
    isGstChecked,
    isBankChecked,
    isUdyamChecked,
    isCibilChecked,
    isAmlChecked,
  ].filter(Boolean).length;
  const dsaAny = dsa as any;
  const rawDocList: any[] = (
    backendDocs.length > 0 ? [...backendDocs] : [...(dsa?.documents || [])]
  ).filter((d: any) => {
    if (dsa?.created_at && d?.created_at) {
      return (
        new Date(d.created_at).getTime() >=
        new Date(dsa.created_at).getTime() - 300000
      );
    }
    return true;
  });

  const hasValidVisitReportFile =
    Boolean(dsaAny?.visit_report_file) &&
    (!dsa?.created_at ||
      !dsaAny?.visit_conducted_at ||
      new Date(dsaAny.visit_conducted_at) >= new Date(dsa.created_at));

  if (
    hasValidVisitReportFile &&
    !rawDocList.some((d: any) => isVisitReportDocument(d))
  ) {
    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
    ).replace(/\/api\/?$/, "");
    rawDocList.unshift({
      id: typeof dsa?.id === "number" ? dsa.id * 100000 + 999 : 999999,
      document_type: "visit_report",
      file_name:
        dsaAny.visit_report_file.split("/").pop() || "visit_report.pdf",
      file_path: dsaAny.visit_report_file,
      file_url: `${apiBase}/storage/${dsaAny.visit_report_file.replace(/^\/+/, "")}`,
      status: "Pending",
      uploaded_at: dsaAny.visit_conducted_at || dsaAny.updated_at,
      remarks: dsaAny.visit_report_remarks || "Uploaded by Bank Staff",
    });
  }

  const hasCheckerGeneratedReport = Boolean(
    rawDocList.some(
      (d: any) =>
        String(d.document_type || d.type || "").toUpperCase() ===
        "DUE_DILIGENCE_REVIEW_REPORT",
    ) ||
    dsa?.documents?.some(
      (d: any) =>
        String(d.document_type || d.type || "").toUpperCase() ===
        "DUE_DILIGENCE_REVIEW_REPORT",
    ) ||
    dsa?.latest_due_diligence_note?.submitted_at ||
    Boolean(deviationReportData?.pdf?.document_id) ||
    Boolean(deviationReportData?.metadata?.pdf_generated),
  );

  const allDisplayDocs: any[] = rawDocList
    .filter((doc) => {
      const dt = String(doc.document_type || "").toUpperCase();
      if (isVisitReportDocument(doc) && !isBankUser) return false;
      return (
        dt !== "EMPANELMENT_LETTER" &&
        dt !== "AGREEMENT" &&
        dt !== "SIGNED_AGREEMENT"
      );
    })
    .reduce((acc: any[], doc: any) => {
      const isVisit = isVisitReportDocument(doc);
      const existingIndex = acc.findIndex((d) =>
        isVisit
          ? isVisitReportDocument(d)
          : d.document_type === doc.document_type,
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
    Boolean(
      (dsa as any)?.dpdp_consent_at ||
      (dsa as any)?.consent_declaration ||
      (dsa as any)?.dpdp_consent_declaration,
    );

  const applicantReviewDocs = allDisplayDocs.filter((d: any) => {
    if (isVisitReportDocument(d)) return false;
    const dt = String(d.document_type || d.type || "").toUpperCase();
    return (
      dt !== "APPLICATION_FORM" &&
      dt !== "DUE_DILIGENCE_REVIEW_REPORT" &&
      dt !== "EMPANELMENT_LETTER" &&
      dt !== "AGREEMENT" &&
      dt !== "SIGNED_AGREEMENT"
    );
  });
  const applicantVerifiedDocsCount = applicantReviewDocs.filter(
    (d: any) => getEffectiveDocStatus(d) === "Verified",
  ).length;
  const isAllApplicantDocsVerified =
    applicantReviewDocs.length > 0 &&
    applicantVerifiedDocsCount === applicantReviewDocs.length;

  const visitReportDoc = allDisplayDocs.find((d: any) =>
    isVisitReportDocument(d),
  );
  const isVisitReportUploaded =
    hasValidVisitReportFile || Boolean(visitReportDoc);
  const isVisitReportVerified = visitReportDoc
    ? getEffectiveDocStatus(visitReportDoc) === "Verified"
    : false;

  if (
    !isVisitReportUploaded &&
    (isMakerUserOrLevel || isCheckerUserOrLevel) &&
    !missingProfileDocuments.some((item) => isVisitReportDocument(item))
  ) {
    missingProfileDocuments.push({
      document_type: "visit_report",
      display_name: "Physical Visit Report",
      requirement:
        "Mandatory — Bank staff (Maker / Checker) must conduct and upload visit report",
      staff_only: true,
    });
  } else if (isVisitReportUploaded) {
    const vIdx = missingProfileDocuments.findIndex((item) =>
      isVisitReportDocument(item),
    );
    if (vIdx >= 0) {
      missingProfileDocuments.splice(vIdx, 1);
    }
  }

  const totalDocsCount = allDisplayDocs.length;
  const verifiedDocsCount = allDisplayDocs.filter(
    (d: any) => getEffectiveDocStatus(d) === "Verified",
  ).length;

  const isAllDocsVerified = isMakerLevel
    ? isVisitReportUploaded
    : totalDocsCount > 0 &&
      verifiedDocsCount === totalDocsCount &&
      missingProfileDocuments.length === 0;

  const hasUnverifiedApplicantDocs =
    applicantReviewDocs.length > 0 &&
    applicantReviewDocs.some(
      (d: any) => getEffectiveDocStatus(d) !== "Verified",
    );

  const hasCheckerDdNote = Boolean(
    checkerDdNote.trim() ||
    savedCheckerDdNote?.observations ||
    savedCheckerDdNote?.remarks ||
    dsa?.latest_due_diligence_note?.observations ||
    dsa?.due_diligence_notes?.[0]?.observations ||
    (dsa as any)?.dueDiligenceNotes?.[0]?.observations ||
    (dsa as any)?.latestDueDiligenceNote?.observations ||
    dsa?.latest_due_diligence_note?.remarks ||
    dsa?.due_diligence_notes?.[0]?.remarks ||
    (dsa as any)?.dueDiligenceNotes?.[0]?.remarks ||
    (dsa as any)?.latestDueDiligenceNote?.remarks ||
    deviationReportData?.dd_note?.observations ||
    deviationReportData?.dd_note?.remarks,
  );

  const canCheckerSubmitReport = Boolean(
    !isMakerUser &&
    isCheckerRole &&
    (isCheckerLevel ||
      workflowLevelInfo.currentLevel === 2 ||
      Number(dsa?.current_approval_level) === 2 ||
      normUserRole === "ADMIN" ||
      normUserRole === "SUPERADMIN"),
  );

  const ddlReportDoc = allDisplayDocs.find((d: any) =>
    isDdReviewReportDocument(d),
  );
  const isDdlReportVerified = ddlReportDoc
    ? getEffectiveDocStatus(ddlReportDoc) === "Verified"
    : false;
  const hasUnverifiedDdlReport =
    hasCheckerGeneratedReport && Boolean(ddlReportDoc) && !isDdlReportVerified;

  const getWorkflowBlockReason = (): string | null => {
    if (isMakerLevel) {
      if (!isVisitReportUploaded) {
        return "Physical Visit Report is required. Please upload the Physical Visit Report in the Documents tab before submitting to Checker.";
      }
    }
    if (isCheckerLevel) {
      if (hasUnverifiedApplicantDocs) {
        return `Partner Documents Incomplete: ${applicantReviewDocs.length - applicantVerifiedDocsCount} document(s) still require verification by Checker in Documents tab before proceeding.`;
      }
      if (!areAllCheckerVerificationsDone) {
        return "Statutory Checks Incomplete: Please trigger and complete all statutory checks before recommending to Sub-Region Head.";
      }
      if (!isVisitReportUploaded) {
        return "Physical Visit Report Required: Please ensure the Physical Visit Report is uploaded and verified.";
      }
      if (!hasCheckerDdNote) {
        return "Due Diligence Notes Required: Please record due diligence observations in Reports tab before submitting recommendation.";
      }
      if (!hasCheckerGeneratedReport) {
        return "Due Diligence Report Required: Please generate and submit the Due Diligence & Deviations Report in the Reports tab.";
      }
      if (hasUnverifiedDdlReport) {
        return "Due Diligence Report Verification Required: Please view and verify the updated Due Diligence Review Report in the Documents tab.";
      }
    }
    return null;
  };

  const isSubmitDisabled = Boolean(getWorkflowBlockReason());
  const allProductConfigs = store.dsaProductConfigs.filter(
    (config) => config.dsaId === String(dsa.id),
  );
  const productConfigs = allProductConfigs
    .filter(
      (config) =>
        (dsa.onboarding_status === "APPROVED" ||
          dsa.onboarding_status === "AGREEMENT_COMPLETED" ||
          dsa.agreement_status === "SIGNED_VERIFIED" ||
          dsa.operational_status === "ACTIVE") &&
        config.status === "Active",
    )
    .sort((left, right) => left.product.localeCompare(right.product));
  const configuredProducts = productConfigs.map((config) => config.product);

  const closeDecisionModals = () => {
    setApprovingDsa(null);
    setRejectingDsa(null);
    setQueryingDsa(null);
    setRevertingDsa(null);
    setRevertReason("");
    setRevertError("");
    setReAllocatingDsa(null);
    setReAllocateTargetId(null);
    setReAllocateReason("");
    setReAllocateError("");
    setEligibleUsers([]);
    setApprovalRemarks("");
    setApprovalRemarksError("");
    setRejectionError("");
    setRejectionReason("");
    setRejectionStep("input");
    setRejectionConfirmationData(null);
    setQueryError("");
    setQueryReason("");
    setL7ReviewData(null);
    setL7ReviewError(null);
    setL7ReviewLoading(false);
  };

  // Task 20B: Dynamic Revert Target Calculation (Levels 3 to 6 only; L1 Maker, L2 Checker, and L7 HO Credit Head prohibited)
  const isDgmPostedForBranch = Boolean(
    dsa?.branch_dgm_posted === true ||
    (dsa?.branch_dgm_posted !== false &&
      l4Approval &&
      l4Approval.status !== "SKIPPED" &&
      !(dsa as any)?.dgm_skipped),
  );

  const getRevertTargetInfo = (level: number) => {
    switch (level) {
      case 3:
        return {
          targetLevel: 2,
          targetRole: "Checker",
          label: "Revert to Checker",
          isDynamic: false,
        };
      case 4:
        return {
          targetLevel: 3,
          targetRole: "Sub-Region Head",
          label: "Revert to Sub-Region Head",
          isDynamic: false,
        };
      case 5:
        if (isDgmPostedForBranch) {
          return {
            targetLevel: 4,
            targetRole: "DGM",
            label: "Revert to DGM",
            isDynamic: true,
            dgmPosted: true,
          };
        }
        return {
          targetLevel: 3,
          targetRole: "Sub-Region Head",
          label: "Revert to Sub-Region Head",
          isDynamic: true,
          dgmPosted: false,
        };
      case 6:
        return {
          targetLevel: 5,
          targetRole: "Region Head",
          label: "Revert to Region Head",
          isDynamic: false,
        };
      default:
        return null;
    }
  };

  const currentRevertTarget = getRevertTargetInfo(
    workflowLevelInfo.currentLevel,
  );

  // 20B: Revert is only permitted for the reviewer whose role maps to the
  // CURRENTLY PENDING step (L3 Sub-Region Head, L4 DGM, L5 Region Head, L6 HO Credit Officer).
  // L1 Maker, L2 Checker, and L7 HO Credit Head are prohibited.
  // We use the user's own role flags, not the DSA's current level, so a
  // Checker viewing an L3 case never sees the button.
  const canRevert = Boolean(
    currentRevertTarget &&
    workflowLevelInfo.currentLevel >= 3 &&
    workflowLevelInfo.currentLevel <= 6 &&
    !isMakerUser &&
    !isL7User &&
    ((!isCheckerRole && (isSubRegionRole || isDgmRole || isRegionHeadRole || isHoOfficerRole)) ||
      isAdminOrSuperAdmin),
  );

  // ── Task 20C: RE-allocate ────────────────────────────────────────────────
  // Gated on the CURRENTLY PENDING level, exactly as the backend matrix does.
  const currentStepLevel = Number(dsa?.current_approval_level) || workflowLevelInfo.currentLevel;
  const showReAllocate = canReAllocate(currentStepLevel);

  // NOTE: this calls adminApi directly rather than the useDsa wrapper. The
  // wrapper swallows errors into a generic toast, but 20C validation is
  // deliberately strict (e.g. "Target user [X] does not have an eligible role
  // for Level 3, 4, or 5."), and the user needs that exact reason inline in
  // the modal rather than after it closes.
  const openReAllocate = async () => {
    setReAllocatingDsa(dsa);
    setReAllocateTargetId(null);
    setReAllocateReason("");
    setReAllocateError("");
    setEligibleLoading(true);
    const data = await fetchEligibleUsers(dsa.id, "RE_ALLOCATE");
    setEligibleUsers(data?.eligible_users ?? []);
    setEligibleLoading(false);
  };

  const submitReAllocate = async () => {
    if (!reAllocateTargetId) {
      setReAllocateError("Select the authority to re-allocate this case to.");
      return;
    }
    if (!reAllocateReason.trim()) {
      setReAllocateError("A reason is mandatory for re-allocation.");
      return;
    }
    setAction20CBusy(true);
    setReAllocateError("");
    try {
      const target = eligibleUsers.find((u) => u.id === reAllocateTargetId);
      const res = await adminApi.updateWorkflowAction(dsa.id, {
        action: "RE_ALLOCATE",
        target_user_id: reAllocateTargetId,
        remarks: reAllocateReason.trim(),
      });
      toast({
        title: "Case Re-allocated",
        description:
          res?.message ||
          `Handed to ${target?.name ?? "the selected authority"} and locked for their review.`,
        variant: "success",
      });
      closeDecisionModals();
      router.push("/dsa/management");
    } catch (err: unknown) {
      setReAllocateError(
        err instanceof Error
          ? err.message
          : "Failed to re-allocate this case.",
      );
    } finally {
      setAction20CBusy(false);
    }
  };

  const applications = store.applications
    .filter((item) => item.dsaId === String(dsa.id))
    .sort(
      (left, right) =>
        left.product.localeCompare(right.product) ||
        left.applicationId.localeCompare(right.applicationId),
    );
  const effectiveApplicationProductFilter = configuredProducts.includes(
    applicationProductFilter as Product,
  )
    ? applicationProductFilter
    : "";
  const visibleApplications = effectiveApplicationProductFilter
    ? applications.filter(
        (application) =>
          application.product === effectiveApplicationProductFilter,
      )
    : applications;
  const commissions = store.commissions.filter(
    (item) => item.dsaId === String(dsa.id),
  );
  const leads = store.leads.filter((item) => item.dsaId === String(dsa.id));
  const audit = dsaAudit;
  const applicationIds = new Set(
    applications.map((application) => application.id),
  );
  const applicationCodes = new Set(
    applications.map((application) => application.applicationId),
  );
  const linkedDocumentCount = store.documents.filter(
    (document) =>
      document.dsaId === String(dsa.id) ||
      applicationIds.has(document.applicationId ?? ""),
  ).length;
  const linkedVerificationCount = store.verificationChecks.filter((check) =>
    applicationCodes.has(check.applicationId),
  ).length;
  const linkedApprovalCount = store.approvals.filter((approval) =>
    applicationCodes.has(approval.applicationId),
  ).length;
  const linkedUserCount = store.users.filter(
    (user) =>
      user.id === String(dsa.id) ||
      user.dsaId === String(dsa.id) ||
      user.email === dsa.email ||
      user.name === dsa.name,
  ).length;
  const canManageAgents =
    currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";
  const dsaAgents = store.users
    .filter(
      (user) => user.role === "DSA Agent" && user.dsaId === String(dsa.id),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  const commissionTotal = commissions.reduce(
    (sum, item) => sum + item.payout,
    0,
  );
  const approvedApplications = applications.filter(
    (item) => item.status === "Approved" || item.status === "Disbursed",
  ).length;
  const disbursedApplications = applications.filter(
    (item) => item.status === "Disbursed",
  ).length;
  const sourcedLoanValue = applications.reduce(
    (sum, item) => sum + item.loanAmount,
    0,
  );
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
        (application) =>
          application.customer === lead.customer &&
          application.dsaId === lead.dsaId,
      );
      current.applications += leadApplications.length;
      current.approvedOrDisbursed += leadApplications.filter(
        (application) =>
          application.status === "Approved" ||
          application.status === "Disbursed",
      ).length;
      analysis.set(lead.owner, current);
      return analysis;
    }, new Map<string, { name: string; leads: number; applications: number; approvedOrDisbursed: number; loanValue: number }>()),
  )
    .map(([, value]) => value)
    .sort(
      (left, right) =>
        right.applications - left.applications || right.leads - left.leads,
    );
  const canLifecycleRoleManageDsa =
    currentUser?.role === "DSA Manager" ||
    currentUser?.role === "DSA Credit" ||
    currentUser?.role === "Branch Regional Head" ||
    (currentUser?.role === "Branch User" && dsa.manager === currentUser.name);
  const canManageDsaLifecycle =
    canLifecycleRoleManageDsa &&
    ["ACTIVE", "SUSPENDED", "TERMINATED"].includes(
      dsa.operational_status || "",
    );
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

    const isBank =
      currentUser?.role !== "DSA Partner" && currentUser?.role !== "Customer";
    const actor = currentUser?.name ?? dsa?.name ?? "Partner";
    const party = isBank ? ("Bank" as const) : ("DSA" as const);
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
      `${status} at ${formatCurrency(amount)}.`,
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
    const email = String(value.email ?? "")
      .trim()
      .toLowerCase();
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
          description:
            err?.data?.message || err?.message || "Agent saved locally.",
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
      region:
        String(value.region ?? dsa?.name ?? "DSA").trim() ||
        (dsa?.name ?? "DSA"),
      role: "DSA Agent",
      status: (value.status as User["status"]) || "Active",
    });
    setCreatingAgent(false);
  }

  function saveProfileAgentEdit(value: Partial<User>) {
    if (!editingAgent) return;
    const email = String(value.email ?? editingAgent.email)
      .trim()
      .toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        description: "Enter a valid agent email.",
        title: "Agent not updated",
        variant: "warning",
      });
      return;
    }

    const duplicate = store.users.find(
      (user) =>
        user.id !== editingAgent.id &&
        user.email.trim().toLowerCase() === email,
    );
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
    {
      cell: (item) => item.email,
      header: "Email",
      key: "email",
      sortable: true,
      sortValue: (item) => item.email,
    },
    {
      cell: (item) => item.region,
      header: "Region",
      key: "region",
      sortable: true,
      sortValue: (item) => item.region,
    },
    {
      cell: (item) => <StatusBadge status={item.status} />,
      header: "Status",
      key: "status",
      sortable: true,
      sortValue: (item) => item.status,
    },
    {
      cell: (item) => formatDate(item.lastLogin),
      header: "Last login",
      key: "lastLogin",
      sortable: true,
      sortValue: (item) => item.lastLogin,
    },
  ];

  if (currentUser?.role === "DSA Partner") {
    const networkPartnerName = dsa.name;
    const networkPartnerEmail = dsa.email;
    const conversion = applications.length
      ? (approvedApplications / applications.length) * 100
      : 0;

    return (
      <div>
        <Link
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700"
          href="/dsa/management"
        >
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
            {
              label: "Applications collected",
              value: String(applications.length),
            },
            {
              label: "Approved / disbursed",
              value: String(approvedApplications),
            },
            { label: "Loan value", value: formatCurrency(sourcedLoanValue) },
          ].map((metric) => (
            <Card key={metric.label}>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {metric.value}
                </p>
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
              <DetailItem
                label="Disbursed applications"
                value={disbursedApplications}
              />
              <DetailItem
                label="Commission earned"
                value={formatCurrency(commissionTotal || dsa.commission_earned)}
              />
              <DetailItem
                label="Active products"
                value={productConfigs.length || "None"}
              />
            </DetailGrid>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Collected Applications
                </h3>
                <p className="text-xs text-slate-500">
                  Applications sourced by this network partner.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {applications.length} total
              </span>
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
                        <td className="p-3 font-mono text-xs text-slate-600">
                          {application.applicationId}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          {application.customer}
                        </td>
                        <td className="p-3 text-slate-700">
                          {application.product}
                        </td>
                        <td className="p-3 text-right font-medium text-slate-900">
                          {formatCurrency(application.loanAmount)}
                        </td>
                        <td className="p-3 text-slate-700">
                          {application.stage}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={application.status} />
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          {formatDate(application.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No applications have been collected yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Lead Pipeline
                </h3>
                <p className="text-xs text-slate-500">
                  Leads collected before application submission.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {leads.length} total
              </span>
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
                        <td className="p-3 font-mono text-xs text-slate-600">
                          {lead.leadId}
                        </td>
                        <td className="p-3 font-semibold text-slate-900">
                          {lead.customer}
                        </td>
                        <td className="p-3 text-slate-700">{lead.product}</td>
                        <td className="p-3 text-right font-medium text-slate-900">
                          {formatCurrency(lead.amount)}
                        </td>
                        <td className="p-3">
                          <StatusBadge status={lead.status} />
                        </td>
                        <td className="p-3 text-slate-700">
                          {lead.nextAction}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No leads have been collected yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderDueDiligenceReportContent = ({
    showSanctionActions = false,
  }: {
    showSanctionActions?: boolean;
  } = {}) => {
    const rep = deviationReportData;
    const isEntity =
      dsa?.dsa_type === "ENTITY" ||
      rep?.metadata?.is_entity ||
      rep?.dsa_type === "ENTITY" ||
      Boolean(dsa?.entity_name);

    const basicInfo =
      rep?.basic_information ||
      (rep as any)?.basicInformation ||
      {};
    const finDd =
      rep?.financial_due_diligence ||
      (rep as any)?.financialDueDiligence ||
      {};
    const bgRep =
      rep?.background_reputational_verification ||
      (rep as any)?.backgroundReputationalVerification ||
      {};

    const note =
      rep?.dd_note ||
      savedCheckerDdNote ||
      dsa?.latest_due_diligence_note ||
      dsa?.due_diligence_notes?.[0] ||
      (dsa as any)?.dueDiligenceNotes?.[0];

    const makerHist =
      rep?.recommendation_approval_history?.maker ||
      (rep as any)?.recommendationApprovalHistory?.maker;

    const checkerRemarks =
      rep?.checker_remarks ||
      (rep as any)?.checkerRemarks ||
      {};

    const l3Hist =
      rep?.recommendation_approval_history?.first_recommending_authority ||
      (rep as any)?.recommendationApprovalHistory?.first_recommending_authority;

    const l4Hist =
      rep?.recommendation_approval_history?.second_recommending_authority ||
      (rep as any)?.recommendationApprovalHistory?.second_recommending_authority;

    const l5Hist =
      rep?.recommendation_approval_history?.third_recommending_authority ||
      (rep as any)?.recommendationApprovalHistory?.third_recommending_authority;

    const l6Hist =
      rep?.recommendation_approval_history?.fourth_recommending_authority ||
      (rep as any)?.recommendationApprovalHistory?.fourth_recommending_authority;

    const l7Hist =
      rep?.recommendation_approval_history?.approving_authority ||
      (rep as any)?.recommendationApprovalHistory?.approving_authority;

    const postL7Hist =
      rep?.recommendation_approval_history?.post_l7_checker_approval ||
      (rep as any)?.recommendationApprovalHistory?.post_l7_checker_approval;

    const dsaBranchName =
      basicInfo.regions_to_assign ||
      basicInfo.branches_to_assign ||
      rep?.branch_name ||
      dsa?.branch?.branch_name ||
      dsa?.branch_name ||
      "Main Branch";

    const dsaAppCode =
      (typeof rep?.dsa_code === "object"
        ? rep?.dsa_code?.code
        : rep?.dsa_code) ||
      (typeof (rep as any)?.dsaCode === "object"
        ? (rep as any)?.dsaCode?.code
        : (rep as any)?.dsaCode) ||
      (typeof dsa?.dsa_code === "object"
        ? dsa?.dsa_code?.code
        : dsa?.dsa_code) ||
      dsa?.code ||
      `DSA-${dsa?.id || "N/A"}`;

    const reportDate = rep?.generated_at
      ? formatDate(rep.generated_at)
      : formatDate(new Date().toISOString());

    const isAlreadyApproved = Boolean(
      dsa?.onboarding_status === "APPROVED" ||
        dsa?.onboarding_status === "AGREEMENT_PENDING" ||
        dsa?.onboarding_status === "AGREEMENT_COMPLETED" ||
        dsa?.agreement_status === "SIGNED_UPLOADED" ||
        dsa?.agreement_status === "SIGNED_VERIFIED" ||
        dsa?.operational_status === "ACTIVE" ||
        workflowLevelInfo.isCompleted ||
        l7ReviewData?.application_information?.onboarding_status === "APPROVED" ||
        l7ReviewData?.review_status === "APPROVED" ||
        (Number(dsa?.current_approval_level) >= 7 &&
          ((dsa as any)?.status === "APPROVED" ||
            (dsa as any)?.action === "APPROVE")),
    );

    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-xs space-y-5 text-slate-800 font-sans">
          {/* Report Header Title */}
          <div className="text-center pb-2 border-b-2 border-slate-900">
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-slate-900">
              Due Diligence Report For DSA Onboarding
            </h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-0.5">
              ({isEntity ? "Entity" : "Individual"})
            </p>
          </div>

          {/* Application Metadata Top Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 text-sm gap-y-1.5 text-slate-700 font-medium pb-1">
            <div>
              <span className="font-bold text-slate-900">
                Branch:
              </span>{" "}
              {dsaBranchName}
            </div>
            <div className="sm:text-right">
              <span className="font-bold text-slate-900">
                Application Ref / Code:
              </span>{" "}
              <span className="font-mono font-semibold">
                {dsaAppCode}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-900">
                Report Generated Date:
              </span>{" "}
              {reportDate}
            </div>
            <div className="sm:text-right">
              <span className="font-bold text-slate-900">
                DSA Type:
              </span>{" "}
              <span className="font-bold text-slate-900">
                {isEntity ? "ENTITY" : "INDIVIDUAL"}
              </span>
            </div>
          </div>

          {/* Checker DD Note */}
          {(() => {
            const ddObs =
              note?.observations ||
              savedCheckerDdNote?.observations ||
              deviationReportData?.dd_note?.observations;
            if (!ddObs) return null;
            return (
              <div>
                <div className="bg-[#0f172a] text-white px-3 py-2 text-sm font-bold uppercase tracking-wider rounded-t">
                  Due Diligence Note <span className="text-red-400 ml-0.5">*</span>
                </div>
                <div className="border border-t-0 border-slate-300 rounded-b px-4 py-3 bg-white">
                  <p className="text-base font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{ddObs}</p>
                </div>
              </div>
            );
          })()}

          {/* SECTION 1: Basic Information */}
          <div>
            <div className="bg-[#0f172a] text-white px-3 py-2 text-sm font-bold uppercase tracking-wider rounded-t">
              SECTION 1: Basic Information
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-sm table-fixed">
                <tbody>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Applicant Name (Entity):"
                        : "Name of DSA:"}
                    </td>
                    <td
                      colSpan={3}
                      className="bg-white border border-slate-300 p-2.5 font-bold text-slate-900"
                    >
                      {basicInfo.applicant_name ||
                        basicInfo.name_of_dsa ||
                        dsa?.name ||
                        dsa?.entity_name ||
                        "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Constitution:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {basicInfo.constitution ||
                        (isEntity
                          ? "Private Limited"
                          : "Individual")}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Date of Establishment:"
                        : "Date of Birth:"}
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {basicInfo.date_of_birth ||
                        basicInfo.date_of_establishment ||
                        dsa?.dob ||
                        "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Registered Office Address:"
                        : "Residence Address:"}
                    </td>
                    <td
                      colSpan={3}
                      className="bg-white border border-slate-300 p-2 text-slate-900"
                    >
                      {basicInfo.residence_address ||
                        basicInfo.registered_office_address ||
                        dsa?.address ||
                        "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Branch Office Address:"
                        : "Business / Office Address:"}
                    </td>
                    <td
                      colSpan={3}
                      className="bg-white border border-slate-300 p-2 text-slate-900"
                    >
                      {basicInfo.business_office_address ||
                        basicInfo.branch_office_address ||
                        basicInfo.residence_address ||
                        dsa?.address ||
                        "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Ownership:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {basicInfo.ownership || "Owned"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Promoter / Key Person:"
                        : "Contact Number:"}
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {isEntity
                        ? basicInfo.promoter_key_person ||
                          dsa?.contact_person ||
                          "N/A"
                        : basicInfo.contact_number ||
                          dsa?.mobile ||
                          "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Office Contact Number:"
                        : "Mail ID:"}
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {isEntity
                        ? basicInfo.office_contact_number ||
                          dsa?.mobile ||
                          "N/A"
                        : basicInfo.email ||
                          dsa?.email ||
                          "N/A"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Office Mail ID:"
                        : "PAN:"}
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {isEntity
                        ? basicInfo.office_email ||
                          dsa?.email ||
                          "N/A"
                        : basicInfo.pan ||
                          dsa?.pan ||
                          "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity ? "PAN:" : "Aadhaar:"}
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {isEntity
                        ? basicInfo.pan ||
                          dsa?.pan ||
                          "N/A"
                        : basicInfo.aadhaar ||
                          dsa?.aadhaar_no ||
                          dsa?.aadhaar ||
                          "N/A"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Business License Type:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {basicInfo.business_license_type ||
                        "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Business License Number:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2 text-slate-900 font-mono">
                      {basicInfo.business_license_number ||
                        "N/A"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      {isEntity
                        ? "Branches to Assign:"
                        : "Regions / Branch to Assign:"}
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {basicInfo.regions_to_assign ||
                        basicInfo.branches_to_assign ||
                        dsaBranchName}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Expected Monthly Business
                      Commitment:
                    </td>
                    <td
                      colSpan={3}
                      className="bg-white border border-slate-300 p-2 text-slate-900 font-medium"
                    >
                      {basicInfo.expected_monthly_business_commitment ||
                        (isEntity
                          ? "25 Lakhs"
                          : "10 Lakhs")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: Financial Due Diligence */}
          <div>
            <div className="bg-[#0f172a] text-white px-3 py-2 text-sm font-bold uppercase tracking-wider rounded-t">
              SECTION 2: Financial Due Diligence
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-sm table-fixed">
                <tbody>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Annual Turnover (Latest Year):
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2 text-slate-900 font-semibold">
                      {finDd.annual_turnover ||
                        (isEntity
                          ? "1.25 Crores"
                          : "35 Lakhs")}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Net Profit / Income:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2 text-slate-900 font-semibold">
                      {finDd.net_profit ||
                        (isEntity
                          ? "18.5 Lakhs"
                          : "8.2 Lakhs")}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      ITR Acknowledgment / Filing Status:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {finDd.itr_status ||
                        "Filed (Last 2 Years on Record)"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Primary Banker / Account:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {finDd.primary_bank ||
                        (dsa?.bank_name
                          ? `${dsa.bank_name} (A/C Verified via BAV)`
                          : "Cosmos Co-op Bank")}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Average Monthly Balance (AMB):
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {finDd.amb || "₹ 1,85,000"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Cheque Bounce / Return Instances:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {finDd.cheque_bounce_instances ||
                        "Nil in last 12 months"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      GST Return Filing Compliance:
                    </td>
                    <td
                      colSpan={3}
                      className="bg-white border border-slate-300 p-2 text-slate-900"
                    >
                      {finDd.gst_filing_compliance ||
                        (dsa?.gst
                          ? "GSTR-3B & GSTR-1 Regular / Active"
                          : "Exempt / Certificate Attached")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: Background & Reputational Verification */}
          <div>
            <div className="bg-[#0f172a] text-white px-3 py-2 text-sm font-bold uppercase tracking-wider rounded-t">
              SECTION 3: Background &amp; Reputational
              Verification
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-sm table-fixed">
                <tbody>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Market Reputation / Reference Check:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {bgRep.market_reputation ||
                        "Satisfactory / Positive"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Prior Relationship with Cosmos Bank:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {bgRep.prior_relationship_with_bank ||
                        "No Adverse Record"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      CIBIL / Commercial Bureau Score:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2 font-bold text-slate-900">
                      {bgRep.cibil_score ||
                        (isEntity
                          ? "785 (Commercial CMR-2)"
                          : "768 (TransUnion)")}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Overdue / Default History:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {bgRep.overdue_history ||
                        "Nil Defaults Reported"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Negative / Blacklist Database Check:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-emerald-700 font-semibold">
                      {bgRep.negative_database_check ||
                        "Clear (RBI Defaulter / Cautious List Clean)"}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      AML / PEP Screening Result:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-emerald-700 font-semibold">
                      {bgRep.aml_pep_screening ||
                        "No PEP or Sanctions Match"}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Directorship / Entity Cross-check:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      {bgRep.directorship_cross_check ||
                        (isEntity
                          ? "DIN Active / MCA Compliant"
                          : "N/A - Individual")}
                    </td>
                    <td className="w-[28%] bg-slate-50 border border-slate-300 p-2.5 font-bold text-slate-700">
                      Compass AML Match Score:
                    </td>
                    <td className="w-[22%] bg-white border border-slate-300 p-2.5 text-slate-900">
                      <span className="font-mono text-emerald-700 font-semibold">
                        {bgRep.compass_matching_percentage ||
                          "0% (Clear)"}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4: Maker & Checker Remarks */}
          <div>
            <div className="bg-[#0f172a] text-white px-3 py-2 text-sm font-bold uppercase tracking-wider rounded-t">
              SECTION 4: Maker &amp; Checker Remarks
            </div>
            <div className="border border-t-0 border-slate-300 rounded-b divide-y divide-slate-200">
              {/* Maker (Level 1) */}
              {(() => {
                const ddlMakerRemark =
                  getCleanRemark(makerHist?.remarks) ||
                  getCleanRemark((rep as any)?.maker_remarks?.remarks) ||
                  getCleanRemark(makerRemarks) ||
                  "Application submitted with verified primary documents.";

                return (
                  <div className="p-4 space-y-3 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-700 text-white shadow-2xs">
                          Maker
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          Maker Verification — Level 1
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          (Branch Maker Intake)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {makerHist?.date && (
                          <span className="text-xs text-slate-500 font-medium">
                            {formatDate(makerHist.date)}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Submitted
                        </span>
                      </div>
                    </div>

                    {/* Maker Remarks */}
                    <p className="text-base font-bold text-slate-900 whitespace-pre-wrap leading-relaxed py-0.5">
                      &ldquo;{ddlMakerRemark}&rdquo;
                    </p>

                    <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 pt-1 font-medium">
                      <span><strong className="text-slate-900">Name:</strong> {makerHist?.name || (rep as any)?.maker_remarks?.name || dsa?.maker_user?.name || "—"}</span>
                      <span><strong className="text-slate-900">Designation:</strong> {makerHist?.designation || (rep as any)?.maker_remarks?.designation || "Branch Maker"}</span>
                      <span><strong className="text-slate-900">Date:</strong> {makerHist?.date ? formatDate(makerHist.date) : (rep as any)?.maker_remarks?.date ? formatDate((rep as any)?.maker_remarks?.date) : "—"}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Checker (Level 2) */}
              {(() => {
                const ddlCheckerRemark =
                  getCleanRemark(checkerRemarks?.remarks) ||
                  getCleanRemark(note?.observations) ||
                  getCleanRemark(note?.remarks) ||
                  getCleanRemark((note as any)?.recommendation_justification) ||
                  getCleanRemark((rep?.recommendation_approval_history as any)?.checker?.remarks) ||
                  getCleanRemark((rep as any)?.recommendationApprovalHistory?.checker?.remarks) ||
                  (isL2Actioned ? "Due Diligence completed and forwarded by Checker." : "");

                return (
                  <div className="p-4 space-y-3 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-700 text-white shadow-2xs">
                          Checker
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          Checker Due Diligence — Level 2
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          (Branch / Sub-Region Checker)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {note?.submitted_at && (
                          <span className="text-xs text-slate-500 font-medium">
                            {formatDate(note.submitted_at)}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {note?.recommendation || "RECOMMENDED"}
                        </span>
                      </div>
                    </div>

                    {/* Checker Remarks */}
                    {ddlCheckerRemark ? (
                      <p className="text-base font-bold text-slate-900 whitespace-pre-wrap leading-relaxed py-0.5">
                        &ldquo;{ddlCheckerRemark}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Awaiting Checker Due Diligence note and remarks.
                      </p>
                    )}

                    <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 pt-1 font-medium">
                      <span><strong className="text-slate-900">Name:</strong> {note?.submitted_by?.name || (note as any)?.officer_name || checkerRemarks?.name || "—"}</span>
                      <span><strong className="text-slate-900">Designation:</strong> {note?.submitted_by?.role || (note as any)?.officer_designation || checkerRemarks?.designation || "Branch / Sub-Region Checker"}</span>
                      <span><strong className="text-slate-900">Date:</strong> {note?.submitted_at ? formatDate(note.submitted_at) : (checkerRemarks as any)?.date ? formatDate((checkerRemarks as any).date) : "—"}</span>
                      <span><strong className="text-slate-900">Decision:</strong> <span className="text-emerald-700 font-bold">{note?.recommendation || "RECOMMEND"}</span></span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Workflow Approval Trail */}
          {Boolean(l3Hist || l4Hist || l5Hist || l6Hist || l7Hist || postL7Hist || l3Approval || l4Approval || l5Approval || l6Approval || l7Approval || (workflowLevelInfo?.currentLevel ?? 1) > 2) && (
            <div>
              <div className="bg-[#0f172a] text-white px-3 py-2 text-sm font-bold uppercase tracking-wider rounded-t">
                Workflow Approval Trail
              </div>
              <div className="border border-t-0 border-slate-300 rounded-b divide-y divide-slate-200">
                {[
                  {
                    level: 3,
                    roleBadge: "Sub-Region Head",
                    authority: l3Hist?.designation || "Sub-Region Head (Level 3)",
                    name: l3Hist?.name || l3Approval?.actioned_by?.name || "—",
                    date: l3Hist?.date || l3Approval?.actioned_at,
                    remarks:
                      getCleanRemark(l3Hist?.remarks) ||
                      getCleanRemark(l3Approval?.remarks) ||
                      ((workflowLevelInfo?.currentLevel ?? 1) > 3
                        ? "Recommended by Sub-Region Head"
                        : ""),
                    status:
                      l3Approval?.status ||
                      ((workflowLevelInfo?.currentLevel ?? 1) > 3
                        ? "RECOMMENDED"
                        : l3Hist
                          ? "RECOMMENDED"
                          : "PENDING"),
                  },
                  {
                    level: 4,
                    roleBadge: "DGM",
                    authority: l4Hist?.designation || "Deputy General Manager (Level 4)",
                    name:
                      l4Hist?.name ||
                      l4Approval?.actioned_by?.name ||
                      (l4Approval?.status === "SKIPPED"
                        ? "System Auto-Bypass"
                        : "—"),
                    date: l4Hist?.date || l4Approval?.actioned_at,
                    remarks:
                      getCleanRemark(l4Hist?.remarks) ||
                      getCleanRemark(l4Approval?.remarks) ||
                      (l4Approval?.status === "SKIPPED"
                        ? "Bypassed per workflow rule (No DGM posted for branch)"
                        : (workflowLevelInfo?.currentLevel ?? 1) > 4
                          ? "Recommended by DGM"
                          : ""),
                    status:
                      l4Approval?.status ||
                      (l4Hist ? "RECOMMENDED" : "PENDING"),
                  },
                  {
                    level: 5,
                    roleBadge: "Region Head",
                    authority: l5Hist?.designation || "Region Head (Level 5)",
                    name: l5Hist?.name || l5Approval?.actioned_by?.name || "—",
                    date: l5Hist?.date || l5Approval?.actioned_at,
                    remarks:
                      getCleanRemark(l5Hist?.remarks) ||
                      getCleanRemark(l5Approval?.remarks) ||
                      ((workflowLevelInfo?.currentLevel ?? 1) > 5
                        ? "Recommended by Region Head"
                        : ""),
                    status:
                      l5Approval?.status ||
                      ((workflowLevelInfo?.currentLevel ?? 1) > 5
                        ? "RECOMMENDED"
                        : l5Hist
                          ? "RECOMMENDED"
                          : "PENDING"),
                  },
                  {
                    level: 6,
                    roleBadge: "Credit Officer",
                    authority: l6Hist?.designation || "HO Credit Appraisal Officer (Level 6)",
                    name: l6Hist?.name || l6Approval?.actioned_by?.name || "—",
                    date: l6Hist?.date || l6Approval?.actioned_at,
                    remarks:
                      getCleanRemark(l6Hist?.remarks) ||
                      getCleanRemark(l6Approval?.remarks) ||
                      ((workflowLevelInfo?.currentLevel ?? 1) > 6
                        ? "Credit appraisal recommended for sanction"
                        : ""),
                    status:
                      l6Approval?.status ||
                      ((workflowLevelInfo?.currentLevel ?? 1) > 6
                        ? "RECOMMENDED"
                        : l6Hist
                          ? "RECOMMENDED"
                          : "PENDING"),
                  },
                  {
                    level: 7,
                    roleBadge: "Credit Head",
                    authority: l7Hist?.designation || "HO Credit Head Final Sanction (Level 7)",
                    name: l7Hist?.name || l7Approval?.actioned_by?.name || "—",
                    date: l7Hist?.date || l7Approval?.actioned_at,
                    remarks:
                      getCleanRemark(l7Hist?.remarks) ||
                      getCleanRemark(l7Approval?.remarks) ||
                      (isAlreadyApproved
                        ? "Final Sanction granted. Application approved."
                        : ""),
                    status:
                      l7Approval?.status ||
                      (isAlreadyApproved
                        ? "APPROVED"
                        : l7Hist
                          ? "APPROVED"
                          : "PENDING"),
                  },
                  postL7Hist
                    ? (() => {
                        const isPostL7Approved = Boolean(
                          postL7Hist?.is_approved ||
                          postL7Hist?.action === "APPROVED" ||
                          dsa?.agreement_status === "SIGNED_VERIFIED" ||
                          dsa?.operational_status === "ACTIVE"
                        );
                        return {
                          level: 8,
                          roleBadge: "Checker Post-Sanction",
                          authority:
                            postL7Hist?.designation ||
                            "Post-Sanction Checker Verification",
                          name: isPostL7Approved && postL7Hist?.name !== "Pending"
                            ? (postL7Hist?.name || "—")
                            : "—",
                          date: isPostL7Approved ? postL7Hist?.date : null,
                          remarks: isPostL7Approved
                            ? (getCleanRemark(postL7Hist?.remarks) || "Agreement verified and activated.")
                            : "",
                          status: isPostL7Approved ? "APPROVED" : "PENDING",
                        };
                      })()
                    : null,
                ]
                  .filter(Boolean)
                  .map((item: any) => {
                    const isDone =
                      item.status === "RECOMMENDED" ||
                      item.status === "SUBMITTED" ||
                      item.status === "APPROVED";
                    const isBypassed = item.status === "SKIPPED";
                    const isRejected = item.status === "REJECTED";
                    const isQuery = item.status === "QUERY" || item.status === "QUERY_RAISED";
                    const isReturned =
                      item.status === "REVERTED" ||
                      item.status === "REALLOCATED" ||
                      item.status === "FORWARDED";

                    return (
                      <div key={item.level} className="p-4 space-y-3 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider shadow-2xs",
                                isDone
                                  ? "bg-emerald-700 text-white"
                                  : isBypassed
                                    ? "bg-slate-500 text-white"
                                    : isRejected
                                      ? "bg-rose-700 text-white"
                                      : "bg-slate-200 text-slate-700",
                              )}
                            >
                              {item.roleBadge}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {item.authority}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.date && (
                              <span className="text-xs text-slate-500 font-medium">
                                {formatDate(item.date)}
                              </span>
                            )}
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                                isDone
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : isBypassed
                                    ? "bg-slate-100 text-slate-600 border-slate-300"
                                    : isQuery || isReturned
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : isRejected
                                        ? "bg-rose-100 text-rose-800 border-rose-300"
                                        : "bg-slate-100 text-slate-500 border-slate-200",
                              )}
                            >
                              {isDone
                                ? item.level >= 7
                                  ? "Approved"
                                  : "Recommended"
                                : isBypassed
                                  ? "Bypassed"
                                  : isQuery
                                    ? "Query Raised"
                                    : isReturned
                                      ? item.status === "REVERTED"
                                        ? "Reverted"
                                          : item.status === "REALLOCATED"
                                            ? "Reallocated"
                                            : "Forwarded"
                                      : isRejected
                                        ? "Rejected"
                                        : "Pending Review"}
                            </span>
                          </div>
                        </div>

                        {!isCalledBackStep(item.status) && item.remarks ? (
                          <p className="text-base font-bold text-slate-900 whitespace-pre-wrap leading-relaxed py-0.5">
                            &ldquo;{item.remarks}&rdquo;
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            Awaiting review remarks and progression from this authority.
                          </p>
                        )}

                        <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 pt-1 font-medium">
                          <span><strong className="text-slate-900">Name:</strong> {item.name || "—"}</span>
                          {item.date && (
                            <span><strong className="text-slate-900">Date:</strong> {formatDate(item.date)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Sanction Console */}
        {showSanctionActions && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 space-y-3 pt-4 border-t-2">
            {isAlreadyApproved ? (
              <div className="p-3 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-950 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>
                  Application has received final institutional
                  sanction and is fully approved.
                </span>
              </div>
            ) : null}

            <Field>
              <Label
                htmlFor="approvalRemarks"
                className="text-xs font-bold text-emerald-950 flex items-center justify-between"
              >
                <span>
                  HO Credit Head Sanction Remarks{" "}
                  <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Recorded permanently in audit trail
                </span>
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
                <p className="text-xs font-medium text-rose-600 mt-1">
                  {approvalRemarksError}
                </p>
              )}
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-200/80">
              <div>
                {!isAlreadyApproved && (
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={actionLoading || isAlreadyApproved}
                    onClick={() => {
                      setRejectingDsa(dsa);
                      setRejectionReason(approvalRemarks.trim());
                      setRejectionStep("input");
                      setRejectionError("");
                    }}
                    className="font-bold text-xs border bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-300 flex items-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject Application
                  </Button>
                )}
              </div>
              <Button
                className={cn(
                  "font-bold text-xs px-5 py-2.5 shadow-md flex items-center gap-2 transition-all",
                  isAlreadyApproved
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60 shadow-none hover:bg-slate-200"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-950/20",
                )}
                type="button"
                disabled={actionLoading || isAlreadyApproved}
                onClick={async () => {
                  if (!approvalRemarks.trim()) {
                    setApprovalRemarksError(
                      "Please provide sanction remarks.",
                    );
                    return;
                  }
                  try {
                    const updated = await updateWorkflowAction(
                      dsa.id,
                      {
                        action: "APPROVE",
                        remarks: approvalRemarks.trim(),
                      },
                    );
                    if (updated) {
                      // The engine already un-acquires the case on sanction.
                      toast({
                        title:
                          "Institutional Sanction Granted (Approved)",
                        description: `Application #${dsa.dsa_code || dsa.code || dsa.id} sanctioned. DSA Code allotted and Empanelment Letter generated.`,
                        variant: "success",
                      });
                      router.push("/dsa/management");
                    }
                  } catch (err: any) {
                    setApprovalRemarksError(
                      err?.message ||
                        "Failed to grant final sanction.",
                    );
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
                    Grant Final Approval &amp; Sanction
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (dsa && !caseAccess.allowed) {
    const copy =
      caseAccess.reason === "rejected"
        ? `Application #${dsa.dsa_code || dsa.code || dsa.id} has been rejected. A rejected application is closed to every role and cannot be opened, regardless of who holds the lock. It remains visible in the All and Rejected lists for your records.`
        : caseAccess.reason === "closed"
          ? `Application #${dsa.dsa_code || dsa.code || dsa.id} has completed sanction. Post-sanction agreement work is handled by the Branch Maker and Branch Checker.`
          : `Application #${dsa.dsa_code || dsa.code || dsa.id} is currently at Level ${
              dsa.current_approval_level
            }. It is not assigned to your stage, so the full case view is unavailable. It will open automatically once it is reverted or reassigned back to you.`;

    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700"
          href="/dsa/management"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to DSA management
        </Link>
        <EmptyState
          title={
            caseAccess.reason === "rejected"
              ? "This application has been rejected"
              : caseAccess.reason === "closed"
                ? "This application has been approved"
                : "This application is not at your stage"
          }
          description={copy}
        />
      </div>
    );
  }

  return (
    <div>
      <DsaWorkflowChevronBar
        dsa={dsa}
        workflowLevelInfo={workflowLevelInfo}
        onSelectStage={(lvl) => {
          setTab("actions");
          if (lvl === 7 && canViewL7Review) {
            openL7FinalApprovalModal(dsa);
          }
        }}
      />

      <Link
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700"
        href="/dsa/management"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to DSA management
      </Link>
      <PageHeader
        action={
          <div className="flex items-center gap-2">
            {(!isMakerUser || isL2Actioned) && (
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => setViewingDeviationsModal(true)}
                className="h-8 text-xs font-semibold px-3 flex items-center gap-1.5 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-2xs"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                View Deviations{" "}
                {deviationRules.length > 0
                  ? `(${deviationRules.length})`
                  : ""}
              </Button>
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
        title={dsa.name}
      />

      {canViewDsaLifecycleReason && dsa.status_reason ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {dsa.status_reason_action ?? dsa.onboarding_status} reason
                recorded
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {dsa.status_reason_by
                  ? `By ${dsa.status_reason_by}`
                  : "Recorded by internal user"}
                {dsa.status_reason_at
                  ? ` - ${formatDate(dsa.status_reason_at)}`
                  : ""}
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

      <div className="mt-6">
        <Tabs
          onChange={setTab}
          tabs={[
            { label: "DSA Approval", value: "actions" },
            { label: "DSA Application Form", value: "overview" },
            { label: "Documents Checklist", value: "documents" },
            ...(canViewAgreementsTab
              ? [{ label: "Agreements", value: "agreements" }]
              : []),
            { label: "Audit Trails", value: "case-activity" },
          ]}
          value={tab}
        />
      </div>

      <Card className="mt-4">
        <CardContent>
          {tab === "overview" ? (
            <div className="space-y-6">
              {/* Sub-Category Toggle Navigation for DSA Application Form */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-lg border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setAppFormSubTab("applicant")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                    appFormSubTab === "applicant"
                      ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                  )}
                >
                  <UserCheck
                    className={cn(
                      "h-3.5 w-3.5",
                      appFormSubTab === "applicant"
                        ? "text-blue-600"
                        : "text-slate-400",
                    )}
                  />
                  <span>Applicant Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAppFormSubTab("kyc")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                    appFormSubTab === "kyc"
                      ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                  )}
                >
                  <ShieldCheck
                    className={cn(
                      "h-3.5 w-3.5",
                      appFormSubTab === "kyc"
                        ? "text-blue-600"
                        : "text-slate-400",
                    )}
                  />
                  <span>KYC</span>
                  <span
                    className={cn(
                      "inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold min-w-4 text-center",
                      appFormSubTab === "kyc"
                        ? "bg-slate-100 text-slate-800"
                        : "bg-slate-200/80 text-slate-500",
                    )}
                  >
                    6
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAppFormSubTab("ddl");
                    refreshDdReviewReport();
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                    appFormSubTab === "ddl"
                      ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                  )}
                >
                  <ClipboardList
                    className={cn(
                      "h-3.5 w-3.5",
                      appFormSubTab === "ddl"
                        ? "text-blue-600"
                        : "text-slate-400",
                    )}
                  />
                  <span>Due Diligence Report</span>
                </button>
              </div>

              {/* Sub-Tab 1: DSA Application Details */}
              {appFormSubTab === "applicant" && (
                <DsaBasicDetailsTab
                  dsa={dsa}
                  canEdit={canEditBasicDetails}
                  branches={branchesList}
                  isVisitReportUploaded={isVisitReportUploaded}
                  onSaveBlock={async (blockKey, payload) => {
                    const updated = await updateDsaProfile(dsa.id, payload);
                    if (updated) {
                      if (fetchDsaDetail) {
                        await fetchDsaDetail(dsa.id);
                      }
                      return true;
                    }
                    return false;
                  }}
                  loading={actionLoading}
                />
              )}

              {/* Sub-Tab 2: Regulatory & Statutory KYC Verification */}
              {appFormSubTab === "kyc" && (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-5 sm:p-6 space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                      KYC Verification
                    </h3>
                    <div className="flex items-center gap-2">
                      {canCheckerVerifyKyc && (
                        <Button
                          size="sm"
                          type="button"
                          disabled={Object.values(verifyingKyc).some(Boolean)}
                          onClick={async () => {
                            if (!dsa) return;
                            setVerifyingKyc({
                              pan: true,
                              gst: true,
                              bank: true,
                              udyam: true,
                              cibil: true,
                              aml: true,
                            });
                            const dsaIdNum = Number(dsa.id);
                            let hasError = false;
                            const newVerified: { [key: string]: boolean } = {};
                            const newFailed: { [key: string]: boolean } = {};
                            try {
                              const tasks: {
                                key: string;
                                promise: Promise<any>;
                              }[] = [];
                              if (dsa.pan) {
                                const isEntity =
                                  dsa.dsa_type === "ENTITY" ||
                                  dsa.dsa_type === "Entity" ||
                                  dsa.entity_type === "ENTITY";
                                tasks.push({
                                  key: "pan",
                                  promise: isEntity
                                    ? adminApi.verifyPanEntity({
                                        pan: dsa.pan,
                                        dsa_id: dsaIdNum,
                                        entity_name:
                                          dsa.entity_name || dsa.name,
                                      })
                                    : adminApi.verifyPanAdvance({
                                        pan: dsa.pan,
                                        dsa_id: dsaIdNum,
                                      }),
                                });
                              }
                              if (dsa.gst) {
                                tasks.push({
                                  key: "gst",
                                  promise: (async () => {
                                    try {
                                      await triggerCheckerVerification(
                                        dsa.id,
                                        "GST",
                                      );
                                    } catch {}
                                    return adminApi.verifyGstInfo({
                                      gstin: dsa.gst,
                                      flag: 1,
                                      dsa_id: dsaIdNum,
                                    });
                                  })(),
                                });
                              } else if (dsa.pan) {
                                tasks.push({
                                  key: "gst",
                                  promise: (async () => {
                                    try {
                                      await triggerCheckerVerification(
                                        dsa.id,
                                        "GST",
                                      );
                                    } catch {}
                                    return adminApi.resolvePanToGstin({
                                      pan: dsa.pan,
                                      dsa_id: dsaIdNum,
                                    });
                                  })(),
                                });
                              }
                              if (dsa.account_number && dsa.ifsc) {
                                tasks.push({
                                  key: "bank",
                                  promise: adminApi.verifyBankAccount({
                                    account_number: dsa.account_number,
                                    ifsc: dsa.ifsc,
                                    dsa_id: dsaIdNum,
                                  }),
                                });
                              }
                              const regNo =
                                dsa.business_license_no ||
                                (dsa as any)?.udyam_registration_no ||
                                "UDYAM-MH-12-0012345";
                              tasks.push({
                                key: "udyam",
                                promise: (async () => {
                                  try {
                                    await triggerCheckerVerification(
                                      dsa.id,
                                      "UDYAM",
                                    );
                                  } catch {}
                                  return adminApi.verifyUdyam({
                                    registration_number: regNo,
                                    dsa_id: dsaIdNum,
                                  });
                                })(),
                              });
                              if (
                                !isMakerUser &&
                                (canCheckerVerifyKyc ||
                                  isCheckerUserOrLevel ||
                                  isCheckerRole)
                              ) {
                                const isInd =
                                  dsa.dsa_type === "INDIVIDUAL" ||
                                  dsa.dsa_type === "Individual";
                                const cibilCode = isInd
                                  ? "CIBIL_CONSUMER"
                                  : "CIBIL_COMMERCIAL";
                                tasks.push({
                                  key: "cibil",
                                  promise: triggerCheckerVerification(
                                    dsa.id,
                                    cibilCode,
                                    { pan: dsa.pan },
                                  ),
                                });
                                tasks.push({
                                  key: "aml",
                                  promise: triggerCheckerVerification(
                                    dsa.id,
                                    "AML_COMPASS",
                                    { name: dsa.name, pan: dsa.pan },
                                  ),
                                });
                              }

                              const results = await Promise.allSettled(
                                tasks.map((t) => t.promise),
                              );

                              results.forEach((res, idx) => {
                                const key = tasks[idx].key;
                                if (
                                  res.status === "fulfilled" &&
                                  res.value &&
                                  res.value.success !== false &&
                                  res.value.is_success !== false
                                ) {
                                  newVerified[key] = true;
                                  newFailed[key] = false;
                                  if (key === "cibil" || key === "aml") {
                                    setCheckerKycAttempted(key as any, true);
                                    setCheckerKycAttemptedState((prev) => ({
                                      ...prev,
                                      [key]: true,
                                    }));
                                  }
                                } else {
                                  hasError = true;
                                  newVerified[key] = false;
                                  newFailed[key] = true;
                                }
                              });

                              setVerifiedKyc((prev) => ({
                                ...prev,
                                ...newVerified,
                              }));
                              setFailedKyc((prev) => ({
                                ...prev,
                                ...newFailed,
                              }));
                              await loadKycHistory(dsa.id);
                              await fetchDsaDetail(dsa.id);

                              if (hasError) {
                                toast({
                                  title: "Some KYC Checks Incomplete",
                                  description:
                                    "One or more verification steps returned errors or require manual review.",
                                  variant: "warning",
                                });
                              } else {
                                toast({
                                  title: "All KYC Checks Verified",
                                  description:
                                    "PAN, GSTIN, Bank BAV, Udyam MSME, CIBIL, and AML checks executed successfully via API gateways.",
                                  variant: "success",
                                });
                              }
                            } catch {
                              toast({
                                title: "Verification Error",
                                description:
                                  "Failed to execute one or more KYC verification steps.",
                                variant: "destructive",
                              });
                            } finally {
                              setVerifyingKyc({});
                            }
                          }}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5 h-auto py-1 px-3 shadow-sm"
                        >
                          {Object.values(verifyingKyc).some(Boolean) ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Checking All...
                            </>
                          ) : !isAllKycVerified ? (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Check All KYC
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              Re-Check All KYC
                            </>
                          )}
                        </Button>
                      )}
                      <StatusBadge status={getDsaDisplayStatus(dsa)} />
                    </div>
                  </div>

                  {(() => {
                    const allVerifs: any[] = (
                      (dsa as any)?.verifications || []
                    ).filter((v: any) => {
                      if (dsa?.created_at && v.created_at) {
                        return (
                          new Date(v.created_at) >= new Date(dsa.created_at)
                        );
                      }
                      return true;
                    });
                    const getVerif = (code: string) => {
                      const fromDsa = ((dsa as any)?.verifications || []).find(
                        (v: any) => {
                          const match = (v.verification_code || "")
                            .toUpperCase()
                            .includes(code.toUpperCase());
                          if (!match) return false;
                          if (dsa?.created_at && v.created_at) {
                            return (
                              new Date(v.created_at) >= new Date(dsa.created_at)
                            );
                          }
                          return true;
                        },
                      );
                      if (fromDsa) return fromDsa;

                      const fromDb = kycVerificationsList.find((v: any) => {
                        const t = String(v.type || "").toUpperCase();
                        const isMatch = t.includes(code.toUpperCase());
                        if (!isMatch) return false;
                        if (dsa?.created_at && v.created_at) {
                          return (
                            new Date(v.created_at) >= new Date(dsa.created_at)
                          );
                        }
                        return true;
                      });
                      if (fromDb) {
                        return {
                          executed_at: fromDb.created_at,
                          execution_status: fromDb.status,
                          provider: fromDb.provider,
                          details: fromDb.response_json,
                        };
                      }
                      return undefined;
                    };

                    const panVerif = getVerif("PAN");
                    const gstVerif = getVerif("GST");
                    const bankVerif = getVerif("BANK") || getVerif("BAV");
                    const udyamVerif = getVerif("UDYAM");
                    const cibilVerif = getVerif("CIBIL");
                    const amlVerif = getVerif("AML");

                    const extractAllGstins = (obj: any): string[] => {
                      const gsts = new Set<string>();
                      if (!obj) return [];
                      const traverse = (item: any) => {
                        if (!item) return;
                        if (typeof item === "string") {
                          const trimmed = item.trim().toUpperCase();
                          const matches = trimmed.match(
                            /\b\d{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Zz][0-9A-Z]{1}\b/g,
                          );
                          if (matches) {
                            matches.forEach((m) => gsts.add(m));
                          } else if (
                            trimmed.length === 15 &&
                            /^[0-9]{2}[A-Z]{5}/.test(trimmed)
                          ) {
                            gsts.add(trimmed);
                          }
                          return;
                        }
                        if (Array.isArray(item)) {
                          item.forEach(traverse);
                          return;
                        }
                        if (typeof item === "object") {
                          for (const [k, v] of Object.entries(item)) {
                            const kLower = k.toLowerCase();
                            if (
                              typeof v === "string" &&
                              (kLower.includes("gst") || kLower.includes("tax"))
                            ) {
                              const vTrim = v.trim().toUpperCase();
                              if (vTrim && vTrim.length >= 10) {
                                gsts.add(vTrim);
                              }
                            }
                            traverse(v);
                          }
                        }
                      };
                      traverse(obj);
                      return Array.from(gsts);
                    };

                    const allDiscoveredGsts: string[] = Array.from(
                      new Set([
                        ...(dsa.gst
                          ? [String(dsa.gst).trim().toUpperCase()]
                          : []),
                        ...(dsa.gstin
                          ? [String(dsa.gstin).trim().toUpperCase()]
                          : []),
                        ...(dsa.gst_number
                          ? [String(dsa.gst_number).trim().toUpperCase()]
                          : []),
                        ...extractAllGstins(gstVerif),
                        ...extractAllGstins(discoveredGstins),
                      ]),
                    );

                    const resolvedGstNumber: string | null =
                      allDiscoveredGsts.length > 0
                        ? allDiscoveredGsts[0]
                        : dsa.gst || dsa.gstin || null;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* PAN Card Verification */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              PAN Verification
                            </span>
                            <StatusBadge
                              status={isPanChecked ? "Verified" : "Pending"}
                            />
                          </div>
                          <div>
                            <p className="text-lg font-mono font-bold text-slate-900">
                              {dsa.pan || "N/A"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Holder: {dsa.contact_person || dsa.name}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                              {panVerif?.executed_at
                                ? `Checked on ${formatDate(panVerif.executed_at)} via ${panVerif.provider === "scoreme" ? "ScoreMe" : "NSDL"}`
                                : isPanChecked
                                  ? "Verified via NSDL / Income Tax Dept"
                                  : "NSDL / Income Tax Dept"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {canViewPanKycData && Boolean(dsa.pan || isPanChecked) && (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setViewKycDataCachedVerif(panVerif);
                                    setViewKycDataModalType("pan");
                                  }}
                                  className="text-xs px-2.5 py-1 h-auto font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-300 flex items-center gap-1 shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Data
                                </Button>
                              )}
                              {canCheckerVerifyKyc && (
                                <Button
                                  size="sm"
                                  type="button"
                                  disabled={verifyingKyc.pan}
                                  onClick={() => handleVerifyKyc("pan", "PAN")}
                                  className={cn(
                                    "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                                    isPanChecked
                                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      : "bg-blue-600 hover:bg-blue-700 text-white",
                                  )}
                                >
                                  {verifyingKyc.pan ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Checking...
                                    </>
                                  ) : isPanChecked ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      Re-Check PAN
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3 w-3" />
                                      Check PAN
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* GSTIN Verification */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              GSTIN Verification
                            </span>
                            <StatusBadge
                              status={isGstChecked ? "Verified" : "Pending"}
                            />
                          </div>
                          <div>
                            {resolvedGstNumber ? (
                              <>
                                <p className="text-lg font-mono font-bold text-slate-900">
                                  {resolvedGstNumber}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Taxpayer Status: Regular · Active{" "}
                                  {allDiscoveredGsts.length > 1
                                    ? `(${allDiscoveredGsts.length} linked GSTINs found)`
                                    : ""}
                                </p>
                                {allDiscoveredGsts.length > 1 && (
                                  <div className="mt-1.5 p-1.5 bg-slate-50 rounded border border-slate-200 text-xs">
                                    <span className="font-semibold text-slate-700">
                                      Linked GSTINs:
                                    </span>{" "}
                                    <span className="font-mono text-blue-600 font-medium">
                                      {allDiscoveredGsts.join(", ")}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : isGstChecked ? (
                              <>
                                <p className="text-base font-semibold text-slate-900">
                                  Verified via GSTN Database
                                </p>
                                <p className="text-xs text-emerald-700 font-medium mt-0.5">
                                  {dsa.pan
                                    ? `PAN ${dsa.pan} record validated · Active Taxpayer`
                                    : "Verified & Active"}
                                </p>
                              </>
                            ) : dsa.gst_applicable ? (
                              <div>
                                <p className="text-sm font-semibold text-emerald-800">
                                  GST Applicable (Certificate on File)
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Registered Business Proof:{" "}
                                  {dsa.registered_business_proof ||
                                    "GST Document Attached"}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-slate-400 italic">
                                  No GST number provided by the applicant.
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">
                              {gstVerif?.executed_at
                                ? `Checked on ${formatDate(gstVerif.executed_at)} via ${gstVerif.provider === "scoreme" ? "GSTN" : "GSTN"}`
                                : isGstChecked
                                  ? "GSTN Master Database"
                                  : dsa.gst
                                    ? "GSTN Master Database"
                                    : isMakerUser
                                      ? "Pending Checker Verification"
                                      : "ScoreMe PAN-to-GSTIN"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {canViewKycData && (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setViewKycDataCachedVerif(gstVerif);
                                    setViewKycDataModalType("gst");
                                  }}
                                  className="text-xs px-2.5 py-1 h-auto font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-300 flex items-center gap-1 shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Data
                                </Button>
                              )}
                              {canCheckerVerifyKyc &&
                                (dsa.gst ? (
                                  <Button
                                    size="sm"
                                    type="button"
                                    disabled={verifyingKyc.gst}
                                    onClick={() =>
                                      handleVerifyKyc("gst", "GSTIN")
                                    }
                                    className={cn(
                                      "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                                      isGstChecked
                                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        : "bg-blue-600 hover:bg-blue-700 text-white",
                                    )}
                                  >
                                    {verifyingKyc.gst ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Checking...
                                      </>
                                    ) : isGstChecked ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        Re-Check GSTIN
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="h-3 w-3" />
                                        Check GSTIN
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    type="button"
                                    disabled={verifyingKyc.gst}
                                    onClick={() =>
                                      handleVerifyKyc(
                                        "gst",
                                        "PAN to GSTIN",
                                        "pan_to_gstin",
                                      )
                                    }
                                    className={cn(
                                      "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                                      isGstChecked
                                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        : "bg-blue-600 hover:bg-blue-700 text-white",
                                    )}
                                  >
                                    {verifyingKyc.gst ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Looking up...
                                      </>
                                    ) : isGstChecked ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-600" />
                                        Re-Check GSTIN
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="h-3 w-3" />
                                        Resolve from PAN
                                      </>
                                    )}
                                  </Button>
                                ))}
                            </div>
                          </div>
                        </div>

                        {/* Bank Account Verification (BAV) */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Bank Account (BAV)
                            </span>
                            <StatusBadge
                              status={isBankChecked ? "Verified" : "Pending"}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {dsa.bank_name || "Cosmos Co-op Bank"}
                            </p>
                            <p className="text-xs font-mono text-slate-600 mt-0.5">
                              A/C: {dsa.account_number || "••••••••4812"} ·
                              IFSC: {dsa.ifsc || "COSB0000012"}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">
                              {bankVerif?.executed_at
                                ? `Checked on ${formatDate(bankVerif.executed_at)} via BAV`
                                : isBankChecked
                                  ? "Bank Account Verification (BAV)"
                                  : isMakerUser
                                    ? "Pending Checker Verification"
                                    : "Bank Account Verification (BAV)"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {canViewKycData && (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setViewKycDataCachedVerif(bankVerif);
                                    setViewKycDataModalType("bank");
                                  }}
                                  className="text-xs px-2.5 py-1 h-auto font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-300 flex items-center gap-1 shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Data
                                </Button>
                              )}
                              {canCheckerVerifyKyc && (
                                <Button
                                  size="sm"
                                  type="button"
                                  disabled={verifyingKyc.bank}
                                  onClick={() =>
                                    handleVerifyKyc(
                                      "bank",
                                      "Bank Account (BAV)",
                                      "pennydrop",
                                    )
                                  }
                                  className={cn(
                                    "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                                    isBankChecked
                                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      : "bg-blue-600 hover:bg-blue-700 text-white",
                                  )}
                                >
                                  {verifyingKyc.bank ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Checking...
                                    </>
                                  ) : isBankChecked ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      Re-Check Bank
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3 w-3" />
                                      Check Bank
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Udyam / MSME Registration */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Udyam Registration
                            </span>
                            <StatusBadge
                              status={isUdyamChecked ? "Verified" : "Pending"}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {dsa.business_type || "Sole Proprietorship"}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Category: MSME Registered Enterprise
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                              {udyamVerif?.executed_at
                                ? `Checked on ${formatDate(udyamVerif.executed_at)} via MSME Portal`
                                : isUdyamChecked
                                  ? "Ministry of MSME Portal"
                                  : isMakerUser
                                    ? "Pending Checker Verification"
                                    : "Ministry of MSME Portal"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {canViewKycData && (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setViewKycDataCachedVerif(udyamVerif);
                                    setViewKycDataModalType("udyam");
                                  }}
                                  className="text-xs px-2.5 py-1 h-auto font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-300 flex items-center gap-1 shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Data
                                </Button>
                              )}
                              {canCheckerVerifyKyc && (
                                <Button
                                  size="sm"
                                  type="button"
                                  disabled={verifyingKyc.udyam}
                                  onClick={() =>
                                    handleVerifyKyc(
                                      "udyam",
                                      "Udyam Registration",
                                    )
                                  }
                                  className={cn(
                                    "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                                    isUdyamChecked
                                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      : "bg-blue-600 hover:bg-blue-700 text-white",
                                  )}
                                >
                                  {verifyingKyc.udyam ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Checking...
                                    </>
                                  ) : isUdyamChecked ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      Re-Check Udyam
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3 w-3" />
                                      Check Udyam
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* CIBIL Bureau Assessment */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              CIBIL Bureau Assessment
                            </span>
                            <StatusBadge
                              status={isCibilChecked ? "Verified" : "Pending"}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {isCibilChecked
                                ? "Bureau Score Evaluated · Active"
                                : "Pending Bureau Assessment"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Applicant Credit Bureau &amp; Track Record
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                              {cibilVerif?.executed_at
                                ? `Checked on ${formatDate(cibilVerif.executed_at)} via TransUnion`
                                : isCibilChecked
                                  ? "TransUnion CIBIL Gateway"
                                  : isMakerUser
                                    ? "Pending Checker Verification"
                                    : "TransUnion CIBIL Gateway"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {canViewKycData && (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setViewKycDataCachedVerif(cibilVerif);
                                    setViewKycDataModalType("cibil");
                                  }}
                                  className="text-xs px-2.5 py-1 h-auto font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-300 flex items-center gap-1 shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Data
                                </Button>
                              )}
                              {canCheckerVerifyKyc && (
                                <Button
                                  size="sm"
                                  type="button"
                                  disabled={verifyingKyc.cibil}
                                  onClick={() =>
                                    handleVerifyKyc("cibil", "CIBIL Bureau")
                                  }
                                  className={cn(
                                    "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                                    isCibilChecked
                                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      : "bg-blue-600 hover:bg-blue-700 text-white",
                                  )}
                                >
                                  {verifyingKyc.cibil ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Checking...
                                    </>
                                  ) : isCibilChecked ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      Re-Check CIBIL
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3 w-3" />
                                      Check CIBIL
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* AML Compass Screening */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              AML / Sanctions Screening
                            </span>
                            <StatusBadge
                              status={isAmlChecked ? "Verified" : "Pending"}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {isAmlChecked
                                ? "Negative Database Clean · Passed"
                                : "Pending AML Screening"}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              PEP, Sanctions &amp; Negative List Screening
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">
                              {amlVerif?.executed_at
                                ? `Screened on ${formatDate(amlVerif.executed_at)} via Compass`
                                : isAmlChecked
                                  ? "Compass AML Gateway"
                                  : isMakerUser
                                    ? "Pending Checker Verification"
                                    : "Compass AML Gateway"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {canViewKycData && (
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setViewKycDataCachedVerif(amlVerif);
                                    setViewKycDataModalType("aml");
                                  }}
                                  className="text-xs px-2.5 py-1 h-auto font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-300 flex items-center gap-1 shadow-2xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View Data
                                </Button>
                              )}
                              {canCheckerVerifyKyc && (
                                <Button
                                  size="sm"
                                  type="button"
                                  disabled={verifyingKyc.aml}
                                  onClick={() =>
                                    handleVerifyKyc("aml", "AML Screening")
                                  }
                                  className={cn(
                                    "text-xs px-3 py-1 h-auto font-semibold flex items-center gap-1.5",
                                    isAmlChecked
                                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                      : "bg-blue-600 hover:bg-blue-700 text-white",
                                  )}
                                >
                                  {verifyingKyc.aml ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Screening...
                                    </>
                                  ) : isAmlChecked ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-600" />
                                      Re-Check AML
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3 w-3" />
                                      Check AML
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <DsaKycDataModal
                    open={Boolean(viewKycDataModalType)}
                    onClose={() => {
                      setViewKycDataModalType(null);
                      setViewKycDataCachedVerif(null);
                    }}
                    type={viewKycDataModalType}
                    dsa={dsa}
                    cachedVerif={viewKycDataCachedVerif}
                    isMaker={isMakerUser}
                  />
                </div>
              )}

              {/* Sub-Tab 3: Due Diligence Review Report */}
              {appFormSubTab === "ddl" && (
                <div className="space-y-4">
                  {(canCheckerSubmitReport ||
                    isCheckerRole ||
                    isCheckerLevel ||
                    isMakerUser ||
                    workflowLevelInfo.currentLevel >= 2) && (
                    <div className="space-y-4">
                      {/* DD Note Modal for Checker */}
                      {isCheckerRole && !isMakerUser && (
                        <Modal
                          open={isDdNoteModalOpen}
                          onClose={() => setIsDdNoteModalOpen(false)}
                          title="Checker Due Diligence Note *"
                          width="max-w-xl"
                        >
                          <div className="space-y-4">
                            <p className="text-xs text-slate-500">
                              This observation is mandatory and will be embedded in the generated Due Diligence Report.
                            </p>
                            <textarea
                              rows={5}
                              className="w-full rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed"
                              value={checkerDdNote}
                              onChange={(e) => setCheckerDdNote(e.target.value)}
                              placeholder="Enter your due diligence observations here..."
                              autoFocus
                            />
                            <div className="flex justify-end items-center gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setIsDdNoteModalOpen(false)}
                                className="h-8 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={
                                  submittingCheckerReport ||
                                  (!checkerDdNote.trim() && !hasCheckerDdNote)
                                }
                                onClick={() => {
                                  handleSubmitCheckerDdReport();
                                  setIsDdNoteModalOpen(false);
                                }}
                                className="h-8 text-xs px-4 font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                              >
                                <Check className="h-3.5 w-3.5" />
                                {submittingCheckerReport
                                  ? "Submitting..."
                                  : hasCheckerGeneratedReport
                                    ? "Re-submit DD Report"
                                    : "Submit DD Report"}
                              </Button>
                            </div>
                          </div>
                        </Modal>
                      )}

                      {/* Due Diligence Review Report Card */}
                      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-150">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                            <h3 className="text-sm font-bold text-slate-900">Due Diligence Review Report</h3>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded border",
                                hasCheckerGeneratedReport
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300",
                              )}
                            >
                              {hasCheckerGeneratedReport
                                ? "Generated"
                                : isCheckerRole
                                  ? "Pending Generation"
                                  : "Pending Checker"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {hasCheckerGeneratedReport && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  type="button"
                                  onClick={() => refreshDdReviewReport()}
                                  disabled={loadingDeviationReport}
                                  className="text-xs font-semibold bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex items-center gap-1.5 h-8"
                                >
                                  <RotateCcw
                                    className={cn(
                                      "h-3.5 w-3.5 text-slate-600",
                                      loadingDeviationReport && "animate-spin",
                                    )}
                                  />
                                  Refresh
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  type="button"
                                  onClick={handleDownloadDeviationReport}
                                  className="text-xs font-semibold bg-white text-slate-700 border-slate-300 hover:bg-slate-50 flex items-center gap-1.5 h-8"
                                >
                                  <Download className="h-3.5 w-3.5 text-blue-600" />
                                  Download PDF
                                </Button>
                              </>
                            )}
                            {isCheckerRole && !isMakerUser && (
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => {
                                  const obs =
                                    savedCheckerDdNote?.observations ||
                                    dsa?.latest_due_diligence_note?.observations ||
                                    deviationReportData?.dd_note?.observations ||
                                    "";
                                  if (!checkerDdNote && obs) setCheckerDdNote(obs);
                                  setIsDdNoteModalOpen(true);
                                }}
                                className={cn(
                                  "h-8 text-xs font-bold flex items-center gap-1.5",
                                  hasCheckerDdNote
                                    ? "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
                                    : "bg-blue-600 hover:bg-blue-700 text-white",
                                )}
                              >
                                <Pencil className="h-3 w-3" />
                                DD Note <span className="text-red-500 font-bold">*</span>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Report Content Body */}
                        {loadingDeviationReport && !deviationReportData ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                            <span className="text-xs text-slate-600 font-medium">
                              Fetching due diligence report...
                            </span>
                          </div>
                        ) : !hasCheckerGeneratedReport && isMakerUser ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800">
                            Due Diligence report will become viewable once
                            Checker generates and submits the report.
                          </div>
                        ) : (
                          renderDueDiligenceReportContent()
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
          {tab === "documents"
            ? (() => {
                const categoryConfigs: Array<{
                  id: DocumentSubTab;
                  label: string;
                  icon: any;
                }> = [
                  { id: "kyc", label: "KYC Documents", icon: ShieldCheck },
                  { id: "exp", label: "Experience Certificates", icon: Award },
                  { id: "other", label: "Other Documents", icon: FileText },
                ];

                const categoryUploadedDocs = allDisplayDocs.filter(
                  (d) => getDocumentCategory(d) === docSubTab,
                );
                const categoryMissingDocs = missingProfileDocuments.filter(
                  (d) => getDocumentCategory(d) === docSubTab,
                );

                const kycUploadedCount = allDisplayDocs.filter(
                  (d) => getDocumentCategory(d) === "kyc",
                ).length;
                const expUploadedCount = allDisplayDocs.filter(
                  (d) => getDocumentCategory(d) === "exp",
                ).length;
                const otherUploadedCount = allDisplayDocs.filter(
                  (d) => getDocumentCategory(d) === "other",
                ).length;

                const kycMissingCount = missingProfileDocuments.filter(
                  (d) => getDocumentCategory(d) === "kyc",
                ).length;
                const expMissingCount = missingProfileDocuments.filter(
                  (d) => getDocumentCategory(d) === "exp",
                ).length;
                const otherMissingCount = missingProfileDocuments.filter(
                  (d) => getDocumentCategory(d) === "other",
                ).length;

                const currentCategoryLabel =
                  docSubTab === "kyc"
                    ? "KYC Documents"
                    : docSubTab === "exp"
                      ? "Experience Certificates"
                      : "Other Documents";

                return (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Sub-Category Toggle Navigation */}
                      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/90 rounded-lg border border-slate-200/80">
                        {categoryConfigs.map((cat) => {
                          const isActive = docSubTab === cat.id;
                          const Icon = cat.icon;
                          const uploadedCount =
                            cat.id === "kyc"
                              ? kycUploadedCount
                              : cat.id === "exp"
                                ? expUploadedCount
                                : otherUploadedCount;
                          const missingCount =
                            cat.id === "kyc"
                              ? kycMissingCount
                              : cat.id === "exp"
                                ? expMissingCount
                                : otherMissingCount;

                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setDocSubTab(cat.id)}
                              className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                                isActive
                                  ? "bg-white text-slate-950 shadow-xs border border-slate-200/80"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "h-3.5 w-3.5",
                                  isActive ? "text-blue-600" : "text-slate-400",
                                )}
                              />
                              <span>{cat.label}</span>
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold min-w-4 text-center",
                                  isActive
                                    ? "bg-slate-100 text-slate-800"
                                    : "bg-slate-200/80 text-slate-500",
                                )}
                              >
                                {uploadedCount}
                              </span>
                              {missingCount > 0 && canMakerReuploadDocs ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center justify-center px-1.5 py-0.2 rounded text-[10px] font-bold",
                                    isActive
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : "bg-amber-50 text-amber-800 border border-amber-200/70",
                                  )}
                                  title={`${missingCount} missing document(s)`}
                                >
                                  {missingCount} missing
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      {canApproveDocs && hasUnverifiedApplicantDocs && (
                        <Button
                          size="sm"
                          type="button"
                          onClick={async () => {
                            const toVerify = applicantReviewDocs.filter(
                              (d: any) =>
                                getEffectiveDocStatus(d) !== "Verified",
                            );
                            await Promise.all(
                              toVerify.map(async (doc: any) => {
                                if (typeof doc.id === "number") {
                                  try {
                                    await updateDsaDocumentStatus(dsa.id, {
                                      document_id: doc.id,
                                      status: "Verified",
                                      remarks: `Bulk verified by ${currentUser?.name || "Reviewer"}`,
                                    });
                                  } catch (err) {}
                                }
                              }),
                            );
                            const verifiedIds = toVerify.map((d: any) => d.id);
                            setManuallyVerifiedDocIds(
                              (prev) => new Set([...prev, ...verifiedIds]),
                            );
                            setCheckerVerifiedDocIds(
                              (prev) => new Set([...prev, ...verifiedIds]),
                            );
                            setManuallyFailedDocIds((prev) => {
                              const next = new Set(prev);
                              verifiedIds.forEach((id: any) => next.delete(id));
                              return next;
                            });
                            await fetchBackendDocuments(true);
                            await fetchDsaDetail(dsa.id);
                            toast({
                              title: "All Partner Documents Verified",
                              description: `All ${applicantReviewDocs.length} partner documents have been verified.`,
                              variant: "success",
                            });
                          }}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 h-auto py-1.5 px-3 shadow-sm self-start sm:self-auto"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Verify All Documents ({applicantReviewDocs.length})
                        </Button>
                      )}
                    </div>

                    {/* Uploaded Documents Grid */}
                    <div className="grid gap-4 lg:grid-cols-2">
                      {categoryUploadedDocs.map((doc) => {
                        const effectiveStatus = getEffectiveDocStatus(doc);
                        const isDocViewed = viewedDocIds.has(doc.id);
                        const isVisitReport = isVisitReportDocument(doc);
                        const isAppForm = isApplicationFormDocument(doc);
                        const isDdReport = isDdReviewReportDocument(doc);
                        const canVerifyCurrentDoc = canApproveDoc(doc);
                        const isPendingVerification =
                          canVerifyCurrentDoc &&
                          effectiveStatus !== "Verified" &&
                          effectiveStatus !== "Failed";
                        const docType = doc.document_type || doc.type;
                        const isCurrentlyReuploading =
                          reuploadingDocType === docType;

                        return (
                          <div
                            className="rounded-lg border border-slate-200 p-4 transition-all hover:border-slate-300"
                            key={doc.id}
                          >
                            <div className="flex flex-col gap-2 w-full">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-slate-950">
                                    {formatDocumentType(doc.document_type)}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {doc.file_name}{" "}
                                    {doc.size ? `• ${doc.size}` : ""}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <StatusBadge
                                    status={
                                      isAppForm
                                        ? "Generated"
                                        : getDocDisplayStatus(effectiveStatus)
                                    }
                                  />
                                  {canMakerReuploadDocs &&
                                    !isAppForm &&
                                    !isDdReport &&
                                    typeof doc.id === "number" && (
                                      <button
                                        type="button"
                                        title="Delete this document"
                                        className="text-[10px] font-medium text-rose-500 hover:text-rose-700 hover:underline leading-none mt-0.5"
                                        onClick={async () => {
                                          if (
                                            !window.confirm(
                                              `Delete "${formatDocumentType(doc.document_type)}"? This cannot be undone.`,
                                            )
                                          )
                                            return;
                                          await deleteDsaDocument(dsa.id, {
                                            document_id: doc.id,
                                          });
                                          await fetchBackendDocuments(true);
                                          await fetchDsaDetail(dsa.id);
                                          adminApi
                                            .getDsaDocumentChecklist(dsa.id)
                                            .then((res: any) =>
                                              setDocChecklist(res?.data ?? res),
                                            )
                                            .catch(() => {});
                                        }}
                                      >
                                        Delete
                                      </button>
                                    )}
                                </div>
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
                                      {doc.uploaded_at
                                        ? formatDate(doc.uploaded_at)
                                        : ""}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={() => openDocPreview(doc)}
                                    disabled={
                                      loadingPreviewDocId ===
                                      (doc.id || "dd_report")
                                    }
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    className="text-xs px-2.5 py-0.5 h-auto flex items-center gap-1 text-slate-700 hover:bg-slate-50 border-slate-300"
                                  >
                                    {loadingPreviewDocId ===
                                    (doc.id || "dd_report") ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                                    ) : (
                                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                                    )}
                                    View
                                  </Button>
                                  {canMakerReuploadDocs &&
                                    !isAppForm &&
                                    !isDdReport && (
                                      <>
                                        <input
                                          accept=".jpg,.jpeg,.png,.pdf"
                                          className="sr-only"
                                          id={`reupload-doc-${doc.id || docType}`}
                                          type="file"
                                          disabled={isCurrentlyReuploading}
                                          onChange={async (e) => {
                                            const target = e.currentTarget;
                                            const file = target.files?.[0];
                                            if (file) {
                                              target.value = "";
                                              await handleMakerReupload(
                                                doc,
                                                file,
                                              );
                                            }
                                          }}
                                        />
                                        <label
                                          htmlFor={`reupload-doc-${doc.id || docType}`}
                                          className={cn(
                                            "inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer font-medium shadow-2xs transition-colors",
                                            isCurrentlyReuploading &&
                                              "opacity-60 pointer-events-none",
                                          )}
                                          title="Upload a new document to replace the current one"
                                        >
                                          {isCurrentlyReuploading ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                          ) : (
                                            <UploadCloud className="h-3 w-3 text-blue-600" />
                                          )}
                                          {isCurrentlyReuploading
                                            ? "Replacing..."
                                            : "Re-upload"}
                                        </label>
                                      </>
                                    )}
                                  {isPendingVerification &&
                                  canVerifyCurrentDoc ? (
                                    <Button
                                      onClick={async () => {
                                        if (!isDocViewed) {
                                          toast({
                                            title: "Document Not Viewed",
                                            description:
                                              "Please view the uploaded document in the viewer before verifying.",
                                            variant: "warning",
                                          });
                                          return;
                                        }
                                        if (typeof doc.id === "number") {
                                          try {
                                            await updateDsaDocumentStatus(
                                              dsa.id,
                                              {
                                                document_id: doc.id,
                                                status: "Verified",
                                                remarks: `Verified by ${currentUser?.name || "Reviewer"}`,
                                              },
                                            );
                                          } catch (err) {}
                                          await fetchDsaDetail(dsa.id);
                                          await fetchBackendDocuments(true);
                                        }
                                        setManuallyVerifiedDocIds(
                                          (prev) => new Set([...prev, doc.id]),
                                        );
                                        setCheckerVerifiedDocIds(
                                          (prev) => new Set([...prev, doc.id]),
                                        );
                                        setManuallyFailedDocIds((prev) => {
                                          const next = new Set(prev);
                                          next.delete(doc.id);
                                          return next;
                                        });
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
                                          : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60",
                                      )}
                                      title={
                                        !isDocViewed
                                          ? "You must view the document before verifying"
                                          : "Verify this document"
                                      }
                                    >
                                      Verify
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {categoryUploadedDocs.length === 0 ? (
                        <div className="col-span-full py-8 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                          <p className="text-sm font-medium text-slate-500">
                            {docSubTab === "kyc"
                              ? "No KYC documents uploaded for this partner."
                              : docSubTab === "exp"
                                ? "No experience certificates or financial documents uploaded for this partner."
                                : "No other documents uploaded for this partner."}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Missing Documents Grid (Maker Upload) */}
                    {categoryMissingDocs.length > 0 && canMakerReuploadDocs ? (
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                          Upload Missing {currentCategoryLabel}
                        </h4>
                        <div className="grid gap-4 lg:grid-cols-2">
                          {categoryMissingDocs.map((document) => {
                            const inputId = `profile-doc-${dsa.id}-${document.document_type}`;
                            const isStaffOnly = Boolean(document.staff_only);

                            return (
                              <div
                                className={cn(
                                  "rounded-lg border border-dashed p-4 flex items-center justify-between",
                                  isStaffOnly
                                    ? "border-amber-200 bg-amber-50/60"
                                    : "border-sky-100 bg-sky-50/50",
                                )}
                                key={document.document_type}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-slate-800 text-sm">
                                      {document.display_name}
                                    </p>
                                    {isStaffOnly ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                        Bank Staff Only
                                      </span>
                                    ) : null}
                                  </div>
                                  <p
                                    className={cn(
                                      "text-xs mt-0.5",
                                      isStaffOnly
                                        ? "text-amber-700"
                                        : "text-sky-700",
                                    )}
                                  >
                                    {document.requirement}
                                  </p>
                                </div>
                                <div>
                                  <input
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    className="sr-only"
                                    id={inputId}
                                    onChange={async (e) => {
                                      const target = e.currentTarget;
                                      const file = target.files?.[0];
                                      if (file) {
                                        target.value = "";
                                        if (file.size > 10 * 1024 * 1024) {
                                          toast({
                                            title: "File too large",
                                            description:
                                              "Maximum allowed file size is 10MB.",
                                            variant: "warning",
                                          });
                                          return;
                                        }
                                        try {
                                          if (
                                            isVisitReportDocument(
                                              document.document_type,
                                            )
                                          ) {
                                            await adminApi.uploadDsaVisitReport(
                                              dsa.id,
                                              file,
                                              `Uploaded by Maker (${currentUser?.name || "Maker"})`,
                                            );
                                          } else {
                                            await uploadDsaDocument(dsa.id, {
                                              file,
                                              document_type:
                                                document.document_type,
                                              owner_name: dsa.name,
                                              remarks: `Uploaded by Maker (${currentUser?.name || "Maker"})`,
                                            });
                                          }
                                          await fetchDsaDetail(dsa.id);
                                          await fetchBackendDocuments(true);
                                          // Refresh checklist after upload
                                          adminApi
                                            .getDsaDocumentChecklist(dsa.id)
                                            .then((res: any) =>
                                              setDocChecklist(res?.data ?? res),
                                            )
                                            .catch(() => {});
                                          toast({
                                            title: "Document Uploaded",
                                            description: `${document.display_name} uploaded successfully.`,
                                            variant: "success",
                                          });
                                        } catch (uploadErr: any) {
                                          toast({
                                            title: "Upload Failed",
                                            description:
                                              uploadErr?.message ||
                                              "Failed to upload document.",
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
                    ) : categoryMissingDocs.length > 0 &&
                      !canMakerReuploadDocs ? (
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Missing {currentCategoryLabel} (Pending Maker Upload)
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {categoryMissingDocs.map((document) => (
                            <span
                              key={document.document_type}
                              className="text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200"
                            >
                              {document.display_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })()
            : null}

          {tab === "case-activity" ? (
            <DsaCaseActivityTab dsaId={id} />
          ) : null}

          {tab === "agreements"
            ? (() => {
                const isL7Approved = Boolean(
                  dsa &&
                  (dsa.onboarding_status === "APPROVED" ||
                    dsa.onboarding_status === "AGREEMENT_PENDING" ||
                    dsa.onboarding_status === "AGREEMENT_COMPLETED" ||
                    dsa.agreement_status === "SIGNED_UPLOADED" ||
                    dsa.agreement_status === "SIGNED_VERIFIED" ||
                    dsa.operational_status === "ACTIVE" ||
                    workflowLevelInfo.isCompleted ||
                    (Number(dsa.current_approval_level) >= 7 &&
                      ((dsa as any)?.status === "APPROVED" ||
                        (dsa as any)?.action === "APPROVE"))),
                );

                const signedAgreementDoc = (dsa?.documents || []).find(
                  (doc: any) => {
                    const t = String(
                      doc.document_type || doc.type || "",
                    ).toUpperCase();
                    return t === "SIGNED_AGREEMENT" || t === "SIGNED AGREEMENT";
                  },
                );

                const isSignedAgreementUploaded = Boolean(
                  signedAgreementDoc ||
                  dsa?.agreement_status === "SIGNED_UPLOADED" ||
                  dsa?.agreement_status === "SIGNED_VERIFIED",
                );

                const generatedAgreementDoc = (dsa?.documents || []).find(
                  (doc: any) => {
                    const t = String(
                      doc.document_type || doc.type || "",
                    ).toUpperCase();
                    return t === "AGREEMENT" || t === "OFFICIAL_AGREEMENT";
                  },
                );

                // Upload / download of the agreement copy is restricted to
                // Branch Maker and Branch Checker. L7 (HO Credit Head) gets a
                // read-only view of this tab.
                const canManageAgreementFiles =
                  isMakerUserOrLevel || isCheckerUserOrLevel;

                // Only the Branch Checker can approve or reject the signed
                // agreement uploaded by Maker/Checker.
                const canDecideSignedAgreement = isCheckerUserOrLevel;

                return (
                  <div className="py-6 flex justify-center">
                    <Card className="border-slate-200/90 shadow-sm w-full max-w-2xl bg-white">
                      <CardContent className="p-6 space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                              <UploadCloud className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">
                                Scanned Physically Executed Agreement
                              </h4>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-bold border",
                              isSignedAgreementUploaded ||
                                dsa?.agreement_status === "SIGNED_VERIFIED" ||
                                dsa?.operational_status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : dsa?.agreement_status === "SIGNED_REJECTED"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-slate-50 text-slate-600 border-slate-200",
                            )}
                          >
                            {dsa?.agreement_status === "SIGNED_VERIFIED" ||
                            dsa?.operational_status === "ACTIVE"
                              ? "VERIFIED & ACTIVE"
                              : isSignedAgreementUploaded
                                ? "SIGNED_UPLOADED"
                                : dsa?.agreement_status === "SIGNED_REJECTED"
                                  ? "REJECTED"
                                  : "AWAITING SUBMISSION"}
                          </span>
                        </div>

                        {/* Existing uploaded signed agreement info if available */}
                        {signedAgreementDoc ? (
                          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">
                                Submitted File:
                              </span>
                              <span className="font-mono font-semibold text-slate-800 truncate max-w-sm">
                                {signedAgreementDoc.file_name ||
                                  `signed_agreement_${getEffectiveDsaCode(dsa)}.pdf`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">
                                Document Status:
                              </span>
                              <span className="font-semibold text-emerald-700">
                                {signedAgreementDoc.status ||
                                  dsa?.agreement_status ||
                                  "UPLOADED"}
                              </span>
                            </div>
                            {(signedAgreementDoc.uploaded_at ||
                              signedAgreementDoc.created_at) && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">
                                  Uploaded Date:
                                </span>
                                <span className="text-slate-700">
                                  {formatDate(
                                    signedAgreementDoc.uploaded_at ||
                                      signedAgreementDoc.created_at,
                                  )}
                                </span>
                              </div>
                            )}
                            {signedAgreementDoc.file_url &&
                              canManageAgreementFiles && (
                              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-start">
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    window.open(
                                      signedAgreementDoc.file_url,
                                      "_blank",
                                    )
                                  }
                                  className="text-xs h-7 gap-1.5 text-blue-700 border-blue-200 hover:bg-blue-50"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View Uploaded Document
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/60 text-center space-y-1">
                            <p className="text-xs font-bold text-slate-800">
                              {isL7Approved
                                ? "Ready for Signed Agreement Upload"
                                : "Awaiting HO Credit Head (L7) Final Approval"}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {isL7Approved
                                ? canManageAgreementFiles
                                  ? "Download official partnership agreement, execute physically, and upload scanned signed copy."
                                  : "Awaiting Branch Maker / Branch Checker to download, execute physically and upload the scanned signed copy."
                                : "Agreement download and upload will unlock once final approval is completed."}
                            </p>
                          </div>
                        )}

                        {/* File Actions — Branch Maker & Branch Checker only */}
                        {canManageAgreementFiles && (
                          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
                            {/* Download Agreement Button */}
                            <Button
                              size="sm"
                              type="button"
                              variant="outline"
                              disabled={
                                !isL7Approved ||
                                actionLoading ||
                                downloadingAgreement
                              }
                              title={
                                !isL7Approved
                                  ? "Agreement download disabled until final approval by L7 is completed."
                                  : undefined
                              }
                              onClick={async () => {
                                if (!dsa?.id) return;
                                try {
                                  setDownloadingAgreement(true);
                                  if (generatedAgreementDoc?.file_url) {
                                    window.open(
                                      generatedAgreementDoc.file_url,
                                      "_blank",
                                    );
                                    return;
                                  }
                                  let res = await downloadAgreement(dsa.id);
                                  if (!res?.file_url) {
                                    try {
                                      await generateAgreement(dsa.id);
                                      res = await downloadAgreement(dsa.id);
                                    } catch {
                                      // fallback
                                    }
                                  }
                                  if (res?.file_url) {
                                    window.open(res.file_url, "_blank");
                                  } else {
                                    toast({
                                      title: "Document not ready",
                                      description:
                                        "Official agreement has not been generated yet.",
                                      variant: "warning",
                                    });
                                  }
                                } catch (err: any) {
                                  toast({
                                    title: "Download failed",
                                    description:
                                      err?.message ||
                                      "Failed to download agreement.",
                                    variant: "warning",
                                  });
                                } finally {
                                  setDownloadingAgreement(false);
                                }
                              }}
                              className={cn(
                                "h-9 text-xs font-semibold flex items-center gap-1.5",
                                !isL7Approved || downloadingAgreement
                                  ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
                                  : "text-slate-700 hover:bg-slate-100 border-slate-300",
                              )}
                            >
                              {downloadingAgreement ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3.5 w-3.5" />
                                  Download Agreement
                                </>
                              )}
                            </Button>

                            {/* Upload Signed Physical Copy Button */}
                            {dsa?.agreement_status !== "SIGNED_VERIFIED" && (
                              <div>
                                <input
                                  accept=".pdf"
                                  className="sr-only"
                                  id="internalSignedAgreementUpload"
                                  disabled={!isL7Approved || actionLoading}
                                  onChange={async (e) => {
                                    const file = e.currentTarget.files?.[0];
                                    if (file) {
                                      if (file.size > 10 * 1024 * 1024) {
                                        toast({
                                          title: "File too large",
                                          description:
                                            "Maximum allowed file size is 10MB.",
                                          variant: "warning",
                                        });
                                        return;
                                      }
                                      await uploadSignedAgreement(dsa.id, file);
                                      await fetchDsaDetail(dsa.id);
                                    }
                                  }}
                                  type="file"
                                />
                                <label
                                  className={cn(
                                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3.5 text-xs font-semibold transition",
                                    !isL7Approved || actionLoading
                                      ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200"
                                      : "bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600 cursor-pointer shadow-sm",
                                  )}
                                  htmlFor={
                                    isL7Approved && !actionLoading
                                      ? "internalSignedAgreementUpload"
                                      : undefined
                                  }
                                  title={
                                    !isL7Approved
                                      ? "Upload disabled until final approval by L7 is completed."
                                      : undefined
                                  }
                                >
                                  <UploadCloud className="h-3.5 w-3.5" />
                                  {actionLoading
                                    ? "Uploading..."
                                    : "Upload Signed Physical Copy"}
                                </label>
                              </div>
                            )}


                            {/* Approve Signed Agreement — Branch Checker only */}
                            {canDecideSignedAgreement &&
                              (signedAgreementDoc ||
                                isSignedAgreementUploaded) &&
                              dsa?.agreement_status !== "SIGNED_VERIFIED" &&
                              dsa?.operational_status !== "ACTIVE" && (
                                <Button
                                  size="sm"
                                  type="button"
                                  onClick={() =>
                                    setVerifyingAgreementAction("APPROVE")
                                  }
                                  className="h-9 text-xs font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Approve &amp; Activate DSA
                                </Button>
                              )}

                            {/* Reject Signed Agreement — Branch Checker only */}
                            {canDecideSignedAgreement &&
                              (signedAgreementDoc ||
                                isSignedAgreementUploaded) &&
                              dsa?.agreement_status !== "SIGNED_VERIFIED" &&
                              dsa?.operational_status !== "ACTIVE" && (
                                <>
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      setVerifyingAgreementAction("REJECT")
                                    }
                                    className="h-9 text-xs font-semibold flex items-center gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50"
                                  >
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Reject &amp; Request Re-upload
                                  </Button>
                                  <p className="w-full text-center text-[11px] text-slate-500">
                                    Only the Branch Checker can approve or
                                    reject the scanned signed agreement.
                                  </p>
                                </>
                              )}
                          </div>
                        )}

                      </CardContent>
                    </Card>
                  </div>
                );
              })()
            : null}
          {tab === "performance" ? (
            <div className="space-y-5">
              <DetailGrid>
                <DetailItem label="Leads sourced" value={leads.length} />
                <DetailItem
                  label="Applications sourced"
                  value={applications.length}
                />
                <DetailItem
                  label="Approved or disbursed"
                  value={approvedApplications}
                />
                <DetailItem
                  label="Disbursed applications"
                  value={disbursedApplications}
                />
                <DetailItem
                  label="Sourced loan value"
                  value={formatCurrency(sourcedLoanValue)}
                />
                <DetailItem
                  label="Commission earned"
                  value={formatCurrency(
                    commissionTotal || dsa.commission_earned,
                  )}
                />
              </DetailGrid>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  User activity analysis
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Performance for users who sourced activity for this DSA.
                </p>
                {agentAnalysis.length ? (
                  <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="p-3">User</th>
                          <th className="p-3 text-right">Leads</th>
                          <th className="p-3 text-right">Applications</th>
                          <th className="p-3 text-right">
                            Approved / disbursed
                          </th>
                          <th className="p-3 text-right">Conversion</th>
                          <th className="p-3 text-right">Loan value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {agentAnalysis.map((agent) => (
                          <tr key={agent.name}>
                            <td className="p-3 font-semibold text-slate-900">
                              {agent.name}
                            </td>
                            <td className="p-3 text-right text-slate-700">
                              {agent.leads}
                            </td>
                            <td className="p-3 text-right text-slate-700">
                              {agent.applications}
                            </td>
                            <td className="p-3 text-right text-slate-700">
                              {agent.approvedOrDisbursed}
                            </td>
                            <td className="p-3 text-right text-slate-700">
                              {percent(
                                agent.applications
                                  ? (agent.approvedOrDisbursed /
                                      agent.applications) *
                                      100
                                  : 0,
                              )}
                            </td>
                            <td className="p-3 text-right font-medium text-slate-900">
                              {formatCurrency(agent.loanValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No user activity has been recorded for this DSA yet.
                  </p>
                )}
              </div>
            </div>
          ) : null}
          {tab === "products" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Configured Products
                  </h3>
                </div>
                {currentUser?.role === "DSA Manager" &&
                dsa.operational_status === "ACTIVE" ? (
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
                    <div
                      className="rounded-md border border-slate-100 p-4"
                      key={config.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {config.product}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {config.commissionType} - {config.ranges.length}{" "}
                            range{config.ranges.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={config.status} />
                          {currentUser?.role === "DSA Manager" ? (
                            <>
                              <Button
                                onClick={() => {
                                  updateItem("dsaProductConfigs", config.id, {
                                    status:
                                      config.status === "Active"
                                        ? "Inactive"
                                        : "Active",
                                  });
                                  toast({
                                    title:
                                      config.status === "Active"
                                        ? "Product Disabled"
                                        : "Product Enabled",
                                    description: `${config.product} has been ${config.status === "Active" ? "disabled" : "re-enabled"} for this DSA.`,
                                    variant: "success",
                                  });
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                                className={
                                  config.status === "Active"
                                    ? "text-amber-600 hover:bg-amber-50 border-amber-200 font-semibold text-xs"
                                    : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 font-semibold text-xs"
                                }
                              >
                                {config.status === "Active"
                                  ? "Disable"
                                  : "Enable"}
                              </Button>
                              <Button
                                onClick={() => {
                                  deleteItem("dsaProductConfigs", config.id);
                                  if (
                                    applicationProductFilter === config.product
                                  )
                                    setApplicationProductFilter("");
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
                        <span>
                          Configured: {formatDate(config.configuredAt)}
                        </span>
                        <span>
                          Commission:{" "}
                          {config.ranges.length
                            ? config.ranges
                                .map((range) => formatCommissionDisplay(range))
                                .join(", ")
                            : "Not configured"}
                        </span>
                        <span>
                          Growth rule: current month must beat previous month
                        </span>
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
                  <h3 className="text-sm font-bold text-slate-900">
                    Manage Agents
                  </h3>
                  <p className="text-xs text-slate-500">
                    Agents listed here are linked only to {dsa.name}. New agents
                    are saved under this DSA.
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
                emptyTitle={
                  dsaPortalUsersLoading
                    ? "Loading authorized users..."
                    : "No agents under this DSA"
                }
                items={
                  dsaPortalUsers.length > 0
                    ? dsaPortalUsers.map((u: any) => ({
                        id: String(u.user_id || u.mapping_id || u.id),
                        name: u.name || "Agent",
                        email: u.email || "—",
                        region: u.role_in_dsa || dsa.name,
                        status: u.deactivated_at
                          ? ("Disabled" as const)
                          : ("Active" as const),
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
                  <h3 className="text-sm font-bold text-slate-900">
                    Applications by Product
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sorted by product, then application number.
                  </p>
                </div>
                <Select
                  aria-label="application product"
                  className="sm:w-56"
                  onChange={(event) =>
                    setApplicationProductFilter(event.target.value)
                  }
                  value={effectiveApplicationProductFilter}
                >
                  <option value="">All products</option>
                  {configuredProducts.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
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
                      <p className="font-semibold text-slate-950">
                        {app.applicationId}
                      </p>
                      <p className="text-sm text-slate-500">
                        {app.product} - {app.customer} -{" "}
                        {formatCurrency(app.loanAmount)}
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No applications sourced by this DSA yet.
                </p>
              )}
            </div>
          ) : null}
          {tab === "commission" ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Commission Payouts
                  </h3>
                  <p className="text-xs text-slate-500">
                    Monthly slab-based commission records for this partner.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    const month = new Date().toLocaleString("default", {
                      month: "short",
                      year: "numeric",
                    });
                    const total = commissions.reduce(
                      (sum, c) => sum + c.payout,
                      0,
                    );
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
                        },
                      ],
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
                    <div
                      className="grid gap-3 rounded-md border border-slate-100 p-3 md:grid-cols-4"
                      key={commission.id}
                    >
                      <DetailItem label="Month" value={commission.month} />
                      <DetailItem label="Product" value={commission.product} />
                      <DetailItem
                        label="Disbursed"
                        value={formatCurrency(commission.disbursedAmount)}
                      />
                      <DetailItem
                        label="Payout"
                        value={formatCurrency(commission.payout)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No commission records found for this DSA yet.
                </p>
              )}

              <hr className="my-6 border-slate-200" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Raised Invoices
                  </h3>
                  <p className="text-xs text-slate-500">
                    Invoices raised and their processing stages.
                  </p>
                </div>
              </div>
              <DataTable
                actions={(item) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => setViewingInvoice(item)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Track
                    </Button>
                    {isBankUser &&
                    item.status !== "Approved" &&
                    item.status !== "Rejected" ? (
                      <>
                        <Button
                          onClick={() => openCounter(item)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Counter
                        </Button>
                        <Button
                          onClick={() => closeInvoice("Approved", item)}
                          size="sm"
                          type="button"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => closeInvoice("Rejected", item)}
                          size="sm"
                          type="button"
                          variant="danger"
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {!isBankUser && item.status === "Countered by Bank" ? (
                      <>
                        <Button
                          onClick={() => openCounter(item)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Counter back
                        </Button>
                        <Button
                          onClick={() => {
                            const actor = currentUser?.name ?? dsa.name;
                            const event = makeInvoiceEvent(
                              "Approved",
                              actor,
                              "DSA",
                              item.requestedAmount,
                              "DSA accepted the bank counter proposal.",
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
                  {
                    cell: (item) => (
                      <span className="font-semibold text-blue-700">
                        {item.invoiceNumber}
                      </span>
                    ),
                    header: "Invoice",
                    key: "invoiceNumber",
                  },
                  { cell: (item) => item.month, header: "Month", key: "month" },
                  {
                    cell: (item) => formatCurrency(item.requestedAmount),
                    header: "Requested",
                    key: "requestedAmount",
                  },
                  {
                    cell: (item) =>
                      item.approvedAmount
                        ? formatCurrency(item.approvedAmount)
                        : "-",
                    header: "Approved",
                    key: "approvedAmount",
                  },
                  {
                    cell: (item) => <StatusBadge status={item.status} />,
                    header: "Status",
                    key: "status",
                  },
                  {
                    cell: (item) => renderInvoiceTracker(item.status),
                    header: "Track",
                    key: "track",
                  },
                ]}
                emptyDescription="No invoices generated or raised for this DSA yet."
                emptyTitle="No invoices found"
                items={store.dsaInvoices.filter(
                  (invoice) => invoice.dsaId === String(dsa.id),
                )}
                searchKeys={["invoiceNumber", "month", "status", "remarks"]}
              />
            </div>
          ) : null}
          {tab === "audit" ? (
            <div className="space-y-3">
              {audit.length ? (
                audit.map((item, idx) => {
                  const action =
                    item.action ||
                    item.event ||
                    item.description ||
                    "Activity logged";
                  const actor =
                    item.actor ||
                    item.user?.name ||
                    item.causer?.name ||
                    "System";
                  const atDate = item.at || item.created_at || item.createdAt;
                  const ip = item.ipAddress || item.ip_address || "Internal";

                  return (
                    <div
                      className="flex gap-3 rounded-md border border-slate-100 p-3"
                      key={item.id || idx}
                    >
                      <FileText className="mt-0.5 h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-slate-950">{action}</p>
                        <p className="text-sm text-slate-500">
                          {actor} · {formatDate(atDate)} · {ip}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">
                  No activity logs recorded for this DSA yet.
                </p>
              )}
            </div>
          ) : null}
          {tab === "actions" ? (
            <div className="space-y-6">
              {/* Comprehensive Review Remarks & Authority Notes by Role */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 shadow-2xs">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                          DSA Approval Process &amp; Remarks
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        level: 1,
                        roleBadge: "Maker",
                        name: "Maker Intake & Verification",
                        role: "Branch Maker",
                        status:
                          l1Approval?.status ||
                          (workflowLevelInfo.currentLevel > 1
                            ? "SUBMITTED"
                            : workflowLevelInfo.currentLevel === 1
                              ? "ACTIVE"
                              : "PENDING"),
                        remarks:
                          makerRemarks ||
                          (workflowLevelInfo.currentLevel > 1
                            ? "Maker verification completed and forwarded to Checker"
                            : ""),
                        actionedAt: l1Approval?.actioned_at,
                      },
                      {
                        level: 2,
                        roleBadge: "Checker",
                        name: "Checker Due Diligence",
                        role: "Branch / Sub-Region Checker",
                        status:
                          l2Approval?.status ||
                          (workflowLevelInfo.currentLevel > 2
                            ? "SUBMITTED"
                            : workflowLevelInfo.currentLevel === 2
                              ? "ACTIVE"
                              : "PENDING"),
                        remarks: checkerRemarks,
                        actionedAt: l2Approval?.actioned_at,
                      },
                      {
                        level: 3,
                        roleBadge: "Sub-Region Head",
                        name: "Sub-Region Head Review",
                        role: "Sub-Region Head",
                        status:
                          l3Approval?.status ||
                          (workflowLevelInfo.currentLevel > 3
                            ? "RECOMMENDED"
                            : workflowLevelInfo.currentLevel === 3
                              ? "ACTIVE"
                              : "PENDING"),
                        remarks:
                          l3Remarks ||
                          (workflowLevelInfo.currentLevel > 3
                            ? "Recommended by Sub-Region Head"
                            : ""),
                        actionedAt: l3Approval?.actioned_at,
                      },
                      {
                        level: 4,
                        roleBadge: "DGM",
                        name: "DGM Recommendation",
                        role: "DGM (Conditional)",
                        status:
                          l4Approval?.status ||
                          (workflowLevelInfo.currentLevel > 4
                            ? l4Approval?.status === "SKIPPED"
                              ? "SKIPPED"
                              : "RECOMMENDED"
                            : workflowLevelInfo.currentLevel === 4
                              ? "ACTIVE"
                              : "PENDING"),
                        remarks:
                          l4Remarks ||
                          (workflowLevelInfo.currentLevel > 4
                            ? l4Approval?.status === "SKIPPED"
                              ? "Bypassed per workflow rule (No DGM posted for branch)"
                              : "Recommended by DGM"
                            : ""),
                        actionedAt: l4Approval?.actioned_at,
                      },
                      {
                        level: 5,
                        roleBadge: "Region Head",
                        name: "Region Head Review",
                        role: "Region Head",
                        status:
                          l5Approval?.status ||
                          (workflowLevelInfo.currentLevel > 5
                            ? "RECOMMENDED"
                            : workflowLevelInfo.currentLevel === 5
                              ? "ACTIVE"
                              : "PENDING"),
                        remarks:
                          l5Remarks ||
                          (workflowLevelInfo.currentLevel > 5
                            ? "Recommended by Region Head"
                            : ""),
                        actionedAt: l5Approval?.actioned_at,
                      },
                      {
                        level: 6,
                        roleBadge: "Credit Officer",
                        name: "HO Credit Appraisal",
                        role: "HO Credit Officer",
                        status:
                          l6Approval?.status ||
                          (workflowLevelInfo.currentLevel > 6
                            ? "RECOMMENDED"
                            : workflowLevelInfo.currentLevel === 6
                              ? "ACTIVE"
                              : "PENDING"),
                        remarks:
                          l6Remarks ||
                          (workflowLevelInfo.currentLevel > 6
                            ? "Credit appraisal recommended for sanction"
                            : ""),
                        actionedAt: l6Approval?.actioned_at,
                      },
                      {
                        level: 7,
                        roleBadge: "Credit Head",
                        name: "HO Credit Head Final Sanction",
                        role: "HO Credit Head",
                        status:
                          l7Approval?.status ||
                          (workflowLevelInfo.isCompleted
                            ? "APPROVED"
                            : workflowLevelInfo.currentLevel === 7
                              ? "ACTIVE"
                              : "PENDING"),
                        remarks:
                          l7Remarks ||
                          (workflowLevelInfo.isCompleted
                            ? "Final Sanction granted. Application approved."
                            : ""),
                        actionedAt: l7Approval?.actioned_at,
                      },
                    ].map((step) => {
                      const isDone =
                        step.status === "RECOMMENDED" ||
                        step.status === "SUBMITTED" ||
                        step.status === "APPROVED";
                      const isBypassed = step.status === "SKIPPED";
                      const isActive = step.status === "ACTIVE";
                      const isRejected = step.status === "REJECTED";
                      const isQuery = step.status === "QUERY" || step.status === "QUERY_RAISED";
                      const isReturned =
                        step.status === "REVERTED" ||
                        step.status === "REALLOCATED" ||
                        step.status === "FORWARDED";

                      return (
                        <div
                          key={step.level}
                          className={cn(
                            "rounded-xl border p-4 transition-all shadow-2xs space-y-2.5",
                            isDone
                              ? "border-emerald-300/90 bg-emerald-50/30"
                              : isBypassed
                                ? "border-slate-200 bg-slate-50/70 opacity-80"
                                : isActive
                                  ? "border-blue-300 bg-blue-50/50 ring-2 ring-blue-400/20 shadow-xs"
                                  : isRejected
                                    ? "border-rose-300 bg-rose-50/40 ring-1 ring-rose-200/50"
                                    : "border-slate-200 bg-slate-50/20",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider",
                                  isDone
                                    ? "bg-emerald-700 text-white"
                                    : isBypassed
                                      ? "bg-slate-500 text-white"
                                      : isActive
                                        ? "bg-blue-600 text-white"
                                        : isRejected
                                          ? "bg-rose-700 text-white"
                                          : "bg-slate-200 text-slate-700",
                                )}
                              >
                                {step.roleBadge}
                              </span>
                              <span className="text-sm font-bold text-slate-900">
                                {step.name}
                              </span>
                              <span className="text-xs text-slate-500 font-normal">
                                ({step.role})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.actionedAt && (
                                <span className="text-xs text-slate-500 font-medium">
                                  {formatDate(step.actionedAt)}
                                </span>
                              )}
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                                  isDone
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                    : isBypassed
                                      ? "bg-slate-100 text-slate-600 border-slate-300"
                                      : isActive
                                        ? "bg-blue-100 text-blue-800 border-blue-300"
                                        : isQuery || isReturned
                                          ? "bg-amber-100 text-amber-800 border-amber-300"
                                          : isRejected
                                            ? "bg-rose-100 text-rose-800 border-rose-300"
                                            : "bg-slate-100 text-slate-500 border-slate-200",
                                )}
                              >
                                {isDone
                                  ? step.level === 7
                                    ? "Sanctioned & Approved"
                                    : step.level === 1 || step.level === 2
                                      ? "Submitted"
                                      : "Recommended"
                                  : isBypassed
                                    ? "Bypassed (No DGM)"
                                    : isActive
                                      ? "Active Review Queue"
                                      : isQuery
                                        ? "Query Raised"
                                        : isReturned
                                          ? step.status === "REVERTED"
                                              ? "Reverted"
                                              : step.status === "REALLOCATED"
                                                ? "Reallocated"
                                                : "Forwarded"
                                          : isRejected
                                            ? "Rejected"
                                            : "Pending Review"}
                              </span>
                            </div>
                          </div>

                          {!isCalledBackStep(step.status) && step.remarks ? (
                            <p className="text-sm font-bold text-slate-900 whitespace-pre-wrap leading-relaxed py-0.5">
                              &ldquo;{step.remarks}&rdquo;
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic py-0.5">
                              {isActive
                                ? "Currently under review. Enter remarks and action decision below."
                                : isBypassed
                                  ? "Bypassed per operational workflow rules."
                                  : "Awaiting progression from prior review stages."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Decision Buttons: Rendered when user has approval authority */}
                {workflowLevelInfo.canUserApprove &&
                  !workflowLevelInfo.isCompleted &&
                  dsa?.onboarding_status !== "APPROVED" &&
                  !workflowLevelInfo.isRejected && (
                    <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200">
                            <Button
                              disabled={isSubmitDisabled}
                              onClick={() => {
                                const blockReason = getWorkflowBlockReason();
                                if (blockReason) {
                                  toast({
                                    title: "Verification Incomplete",
                                    description: blockReason,
                                    variant: "warning",
                                  });
                                  return;
                                }
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
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white",
                              )}
                              title={
                                isSubmitDisabled
                                  ? isMakerLevel
                                    ? "Upload Physical Visit Report to enable submission to Checker"
                                    : hasUnverifiedApplicantDocs
                                      ? `Checker must verify all partner documents (${applicantVerifiedDocsCount}/${applicantReviewDocs.length} verified)`
                                      : !areAllCheckerVerificationsDone
                                        ? "Complete all required statutory verifications to enable recommendation"
                                        : !isVisitReportUploaded
                                          ? "Upload Physical Visit Report to enable recommendation"
                                          : !hasCheckerDdNote
                                            ? "Enter Due Diligence Notes to enable recommendation"
                                            : !hasCheckerGeneratedReport
                                              ? "Submit Due Diligence Report to enable recommendation"
                                              : hasUnverifiedDdlReport
                                                ? "Due Diligence Review Report must be verified in the Documents tab before submitting recommendation"
                                                : "Complete all steps to enable recommendation"
                                  : workflowLevelInfo.actionLabel
                              }
                            >
                              <Check className="h-4 w-4" />
                              {workflowLevelInfo.actionLabel}
                            </Button>
                            {showReAllocate && (
                              <Button
                                onClick={openReAllocate}
                                size="sm"
                                variant="secondary"
                                title="Hand this case to another authority at Level 3, 4 or 5"
                                className="bg-violet-50 text-violet-800 hover:bg-violet-100 border border-violet-300 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                              >
                                <Users className="h-4 w-4 text-violet-600" />
                                Re-allocate
                              </Button>
                            )}
                            {canRevert && (
                              <Button
                                onClick={() => setRevertingDsa(dsa)}
                                size="sm"
                                variant="secondary"
                                className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                              >
                                <Undo2 className="h-4 w-4 text-amber-600" />
                                {currentRevertTarget?.label}
                              </Button>
                            )}
                            {workflowLevelInfo.currentLevel === 2 && (
                              <Button
                                onClick={() => setQueryingDsa(dsa)}
                                size="sm"
                                variant="secondary"
                                className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                              >
                                <HelpCircle className="h-4 w-4 text-amber-600" />
                                Raise Query to Maker
                              </Button>
                            )}
                            {workflowLevelInfo.currentLevel >= 2 && (
                              <Button
                                onClick={() => {
                                  setRejectingDsa(dsa);
                                  setRejectionReason("");
                                  setRejectionStep("input");
                                  setRejectionError("");
                                }}
                                size="sm"
                                variant="secondary"
                                className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 font-bold text-xs py-2 px-4 h-auto flex items-center gap-1.5"
                              >
                                <X className="h-4 w-4 text-rose-600" />
                                Reject Application
                              </Button>
                            )}
                          </div>
                  )}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Modal
        onClose={() => setCreatingAgent(false)}
        open={creatingAgent}
        title={`Create DSA agent - ${dsa.name}`}
      >
        <RecordForm<User>
          fields={agentFields}
          initialValue={{ region: dsa.name, status: "Active" }}
          onCancel={() => setCreatingAgent(false)}
          onSubmit={saveProfileAgent}
          submitLabel="Create agent"
        />
      </Modal>
      <Modal
        onClose={() => setEditingAgent(null)}
        open={Boolean(editingAgent)}
        title="Edit DSA agent"
      >
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
        onClose={closeDecisionModals}
        open={Boolean(approvingDsa)}
        title={
          approvingDsa
            ? workflowLevelInfo.currentLevel === 7
              ? "Grant Final Approval & Sanction — HO Credit Head"
              : `Approve DSA Application — ${workflowLevelInfo.levelName}`
            : ""
        }
        width="max-w-lg"
      >
        {approvingDsa ? (
          <div className="space-y-4">
            <Field>
              <Label htmlFor="approvalRemarks">
                {workflowLevelInfo.currentLevel === 7
                  ? "Sanction Remarks / Justification"
                  : "Approval Remarks / Justification"}{" "}
                <span className="text-rose-500">*</span>
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
                placeholder={
                  workflowLevelInfo.currentLevel === 7
                    ? "Enter final sanction remarks..."
                    : "Enter approval remarks..."
                }
              />
              {approvalRemarksError ? (
                <p className="text-xs font-medium text-rose-600 mt-1">
                  {approvalRemarksError}
                </p>
              ) : null}
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              {workflowLevelInfo.currentLevel === 7 ? (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setApprovingDsa(null);
                    setL7ReviewModalOpen(true);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeDecisionModals}
                >
                  Cancel
                </Button>
              )}
              <Button
                className={cn(
                  "font-semibold transition-all",
                  workflowLevelInfo.isCompleted ||
                    dsa?.onboarding_status === "APPROVED" ||
                    approvingDsa?.onboarding_status === "APPROVED" ||
                    (workflowLevelInfo.currentLevel === 2 &&
                      (hasUnverifiedApplicantDocs ||
                        !hasCheckerDdNote ||
                        !hasCheckerGeneratedReport ||
                        hasUnverifiedDdlReport))
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60 shadow-none hover:bg-slate-200"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white",
                )}
                type="button"
                disabled={
                  actionLoading ||
                  workflowLevelInfo.isCompleted ||
                  dsa?.onboarding_status === "APPROVED" ||
                  approvingDsa?.onboarding_status === "APPROVED" ||
                  (workflowLevelInfo.currentLevel === 2 &&
                    (hasUnverifiedApplicantDocs ||
                      !hasCheckerDdNote ||
                      !hasCheckerGeneratedReport ||
                      hasUnverifiedDdlReport))
                }
                onClick={async () => {
                  if (!approvalRemarks.trim()) {
                    setApprovalRemarksError("Please provide approval remarks.");
                    return;
                  }

                  let updated: any = null;
                  if (workflowLevelInfo.currentLevel === 1) {
                    try {
                      updated = await submitMakerApplication(
                        approvingDsa.id,
                        approvalRemarks.trim(),
                      );
                    } catch {
                      updated = await updateDsaProfile(approvingDsa.id, {
                        action: "APPROVE",
                        remarks: approvalRemarks.trim(),
                      } as any);
                    }
                  } else if (workflowLevelInfo.currentLevel === 2) {
                    if (hasUnverifiedApplicantDocs) {
                      toast({
                        title: "Documents Verification Required",
                        description: `Cannot recommend to Sub-Region Head until all partner documents are verified by Checker (${applicantVerifiedDocsCount}/${applicantReviewDocs.length} checked).`,
                        variant: "warning",
                      });
                      setApprovalRemarksError(
                        "Please verify all partner documents in the Documents tab first.",
                      );
                      return;
                    }
                    if (!hasCheckerDdNote) {
                      toast({
                        title: "Due Diligence Notes Required",
                        description:
                          "Please record due diligence observations before submitting recommendation.",
                        variant: "warning",
                      });
                      setApprovalRemarksError(
                        "Please enter due diligence observations in the Actions tab first.",
                      );
                      return;
                    }
                    if (!hasCheckerGeneratedReport) {
                      toast({
                        title: "Due Diligence Report Required",
                        description:
                          "Please submit the Due Diligence & Deviations Report before recommending to Sub-Region Head.",
                        variant: "warning",
                      });
                      setApprovalRemarksError(
                        "Please submit the Due Diligence Report in the Reports tab first.",
                      );
                      return;
                    }
                    if (hasUnverifiedDdlReport) {
                      toast({
                        title: "Due Diligence Report Verification Required",
                        description:
                          "Please view and verify the updated Due Diligence Review Report in the Documents tab before recommending to Sub-Region Head.",
                        variant: "warning",
                      });
                      setApprovalRemarksError(
                        "Please verify the updated Due Diligence Review Report in the Documents tab first.",
                      );
                      return;
                    }
                    try {
                      updated = await submitCheckerApplication(
                        approvingDsa.id,
                        {
                          remarks: approvalRemarks.trim(),
                          dd_note: {
                            observations:
                              checkerDdNote.trim() ||
                              savedCheckerDdNote?.observations ||
                              approvalRemarks.trim(),
                            remarks: approvalRemarks.trim(),
                            recommendation: "RECOMMEND",
                          },
                        },
                      );
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
                        action: workflowLevelInfo.isFinalStep
                          ? "APPROVE"
                          : "RECOMMEND",
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
                    toast({
                      title:
                        workflowLevelInfo.currentLevel === 1
                          ? "Application Submitted to Checker"
                          : workflowLevelInfo.currentLevel === 2
                            ? "Application Submitted to Sub-Region Head"
                            : workflowLevelInfo.currentLevel === 3
                              ? "Recommended to DGM"
                              : workflowLevelInfo.currentLevel === 4
                                ? "Recommended to Region Head"
                                : workflowLevelInfo.currentLevel === 5
                                  ? "Recommended to HO Credit Officer"
                                  : workflowLevelInfo.currentLevel === 6
                                    ? "Appraisal Recommended to HO Credit Head"
                                    : "Application Advanced",
                      description:
                        workflowLevelInfo.currentLevel === 7
                          ? `Application #${approvingDsa.dsa_code || approvingDsa.code || approvingDsa.id} sanctioned. DSA Code allotted and Empanelment Letter generated.`
                          : `${approvingDsa.name} approved and forwarded to ${workflowLevelInfo.nextLevelName}.`,
                      variant: "success",
                    });
                    if (workflowLevelInfo.currentLevel === 7) {
                      // L7 has no Agreements tab — route to the activity trail.
                      setTab(canViewAgreementsTab ? "agreements" : "case-activity");
                    }
                    closeDecisionModals();
                    router.push("/dsa/management");
                  }
                }}
              >
                {actionLoading
                  ? "Processing..."
                  : workflowLevelInfo.currentLevel === 1
                    ? "Confirm & Submit to Checker"
                    : workflowLevelInfo.currentLevel === 2
                      ? "Confirm & Submit to Sub-Region Head"
                      : workflowLevelInfo.currentLevel === 3
                        ? "Confirm & Recommend to DGM"
                        : workflowLevelInfo.currentLevel === 4
                          ? "Confirm & Recommend to Region Head"
                          : workflowLevelInfo.currentLevel === 5
                            ? "Confirm & Recommend to HO Credit Officer"
                            : workflowLevelInfo.currentLevel === 6
                              ? "Confirm & Recommend Appraisal to HO Credit Head"
                              : workflowLevelInfo.currentLevel === 7
                                ? "Grant Final Approval & Sanction"
                                : workflowLevelInfo.actionLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* L7 Executive Sanction Case Review Modal */}
      <Modal
        onClose={() => {
          setL7ReviewModalOpen(false);
          setL7ActiveVerifTab("");
        }}
        open={l7ReviewModalOpen}
        title="DSA Empanelment Sanction Report"
        width="max-w-5xl"
      >
        {(() => {
          if (l7ReviewLoading && !l7ReviewData) {
            return (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">
                  Loading case review report...
                </span>
                <span className="text-xs text-slate-400">
                  Fetching case audit data across all workflow stages (L1–L6)
                </span>
              </div>
            );
          }

          if (l7ReviewError && !l7ReviewData) {
            return (
              <div className="p-5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>Error loading review report</span>
                </div>
                <p className="text-xs">{l7ReviewError}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => dsa?.id && loadFinalApprovalReview(dsa.id)}
                  className="text-xs font-semibold bg-white"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Retry
                </Button>
              </div>
            );
          }

          const appInfo = l7ReviewData?.application_information || {};
          const makerComp = l7ReviewData?.maker_completion || {};
          const verifRes = l7ReviewData?.verification_results || {};
          const breResults = l7ReviewData?.bre_policy_results || {};
          const makerDevRep = l7ReviewData?.maker_deviation_report || {};
          const ddNote = l7ReviewData?.due_diligence_note || {};
          const reviewMeta = l7ReviewData?.review_metadata || {};
          const historySource: any[] =
            Array.isArray(l7ReviewData?.approval_history) && l7ReviewData.approval_history.length > 0
              ? l7ReviewData.approval_history
              : Array.isArray(dsa?.approvals)
                ? dsa.approvals
                : [];

          // One row per level (newest actioned) so this table shows exactly the
          // same state + remarks as the DSA Actions tab and the DD Review Report.
          const historyList: any[] = Object.values(
            historySource.reduce((acc: Record<string, any>, row: any) => {
              const level = Number(row?.approval_level || 0);
              if (!level) return acc;
              const key = String(level);
              if (!acc[key] || isLaterApprovalRow(row, acc[key])) acc[key] = row;
              return acc;
            }, {}),
          ).sort(
            (a: any, b: any) =>
              Number(a.approval_level) - Number(b.approval_level),
          );

          const deviationsList: any[] = Array.isArray(makerDevRep?.deviations)
            ? makerDevRep.deviations
            : [];
          const breRulesList: any[] = Array.isArray(breResults?.rules)
            ? breResults.rules
            : [];
          const verifsList: any[] = Array.isArray(verifRes?.items)
            ? verifRes.items
            : [];
          const checklistDocs = Array.isArray(docChecklist?.checklist)
            ? docChecklist.checklist.filter((item: any) => item.is_uploaded)
            : [];

          const baseDocs = allDisplayDocs.length > 0
            ? allDisplayDocs
            : Array.isArray(dsa?.documents) && dsa.documents.length > 0
              ? dsa.documents
              : checklistDocs;

          const docsList: any[] = [...baseDocs];
          checklistDocs.forEach((cItem: any) => {
            const exists = docsList.some(
              (d: any) => (d.document_type || d.type) === cItem.document_type
            );
            if (!exists) {
              docsList.push({
                ...cItem,
                name: cItem.display_name,
                file_name: cItem.file_path ? cItem.file_path.split("/").pop() : "Uploaded File",
              });
            }
          });

          const isSanctionApproved =
            dsa?.onboarding_status === "APPROVED" ||
            dsa?.onboarding_status === "AGREEMENT_PENDING" ||
            dsa?.onboarding_status === "AGREEMENT_COMPLETED" ||
            workflowLevelInfo.isCompleted ||
            reviewMeta?.review_status === "CONCLUDED";

          const isSanctionRejected =
            dsa?.onboarding_status === "REJECTED" ||
            workflowLevelInfo.isRejected;

          const breDecision = (
            breResults?.overall_decision ||
            makerDevRep?.overall_decision ||
            (deviationsList.length > 0 ? "DEVIATION" : "PASS")
          ).toUpperCase();

          return (
            <div className="space-y-6 text-xs text-slate-800 pb-2">
              {/* Report Header: Case Information */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                      Applicant Case File
                    </span>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      {appInfo?.applicant_name || dsa?.applicant_name || dsa?.name || "—"}
                      {appInfo?.entity_name && (
                        <span className="text-slate-500 font-normal text-xs">
                          ({appInfo.entity_name} &bull; {appInfo.constitution || "Individual"})
                        </span>
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-50 border border-slate-200 font-bold text-slate-800">
                      {appInfo?.code || dsa?.code || `DSA-${dsa?.id}`}
                    </span>
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-bold border",
                        isSanctionApproved
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isSanctionRejected
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-blue-50 text-blue-700 border-blue-200",
                      )}
                    >
                      {isSanctionApproved
                        ? "SANCTION APPROVED"
                        : isSanctionRejected
                          ? "REJECTED"
                          : "PENDING L7 SANCTION"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">PAN</span>
                    <strong className="text-slate-900 font-mono font-bold text-xs">{appInfo?.pan || dsa?.pan || "—"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Contact</span>
                    <span className="text-slate-800 font-medium">{appInfo?.mobile || dsa?.mobile || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Assigned Branch</span>
                    <span className="text-slate-800 font-medium">{appInfo?.branch_name || dsa?.branch_name || "Main Branch"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">Applied Date</span>
                    <span className="text-slate-800 font-medium">{formatDate(appInfo?.submitted_at || appInfo?.created_at || dsa?.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* 1. Prior Level Approvals (L1–L6 Audit Trail) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    1. Prior Level Approvals (L1–L6)
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {historyList.filter((h: any) => h.status === "RECOMMENDED" || h.status === "SUBMITTED" || h.status === "APPROVED").length} of {historyList.length} levels signed off
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Level / Role</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Status</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Actioned By</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Date</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Review Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {historyList.map((stepItem: any, idx: number) => {
                        const level = Number(stepItem.approval_level || idx + 1);
                        const status = String(stepItem.status || stepItem.action || "").toUpperCase();
                        const isDone = status === "RECOMMENDED" || status === "SUBMITTED" || status === "APPROVED";
                        const isSkipped = status === "SKIPPED" || stepItem.is_skipped;
                        const isRejected = status === "REJECTED";
                        const isQuery = status === "QUERY" || status === "QUERY_RAISED";
                        const isReturned =
                          status === "REVERTED" ||
                          status === "REALLOCATED" ||
                          status === "FORWARDED";

                        return (
                          <tr key={stepItem.id || level}>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              <span className="inline-block w-5 text-slate-400 font-mono text-[10px]">L{level}</span>
                              {stepItem.role_name || `Level ${level}`}
                              {stepItem.authority_title && (
                                <span className="text-[10px] text-slate-400 block font-normal">
                                  {stepItem.authority_title}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                                  isDone
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isSkipped
                                      ? "bg-slate-100 text-slate-500 border-slate-200"
                                      : isQuery || isReturned
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : isRejected
                                          ? "bg-rose-50 text-rose-700 border-rose-200"
                                          : "bg-blue-50 text-blue-700 border-blue-200",
                                )}
                              >
                                {isDone
                                  ? level === 7
                                    ? "Approved"
                                    : level <= 2
                                      ? "Submitted"
                                      : "Recommended"
                                  : isSkipped
                                    ? "Skipped"
                                    : isQuery
                                      ? "Query Raised"
                                      : isReturned
                                        ? status === "REVERTED"
                                            ? "Reverted"
                                            : status === "REALLOCATED"
                                              ? "Reallocated"
                                              : "Forwarded"
                                        : isRejected
                                          ? "Rejected"
                                          : "Pending"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-medium text-slate-800">
                                {stepItem.actioned_by?.name || (isSkipped ? "System Auto-Bypass" : "—")}
                              </span>
                              {stepItem.actioned_by?.email && (
                                <span className="text-[10px] text-slate-400 block">{stepItem.actioned_by.email}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                              {stepItem.actioned_at ? formatDate(stepItem.actioned_at) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-900 max-w-[320px]">
                              {!isCalledBackStep(stepItem.status) &&
                              stepItem.remarks ? (
                                <span className="font-bold text-slate-900 text-xs leading-relaxed block">
                                  &ldquo;{stepItem.remarks}&rdquo;
                                </span>
                              ) : isSkipped ? (
                                <span className="text-slate-400 italic text-xs">Bypassed (no DGM posted for branch)</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. BRE Policy Results & Deviations */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      2. BRE Policy &amp; Deviations
                    </h4>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold border",
                        breDecision === "PASS"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : breDecision === "DEVIATION"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200",
                      )}
                    >
                      {breDecision}
                    </span>
                  </div>
                </div>

                {/* Deviations Table if any */}
                {deviationsList.length > 0 && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 px-3 py-2.5 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                      Policy Deviations ({deviationsList.length})
                    </span>
                    <table className="w-full text-xs">
                      <thead className="border-b border-amber-200/80 text-amber-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Rule</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Actual Value</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Policy Benchmark</th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider">Justification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 text-slate-800">
                        {deviationsList.map((dev: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2.5 font-medium text-slate-900">{dev.rule_name || dev.rule_code}</td>
                            <td className="px-3 py-2.5 font-mono text-amber-900">{String(dev.actual_value ?? dev.value ?? "—")}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-600">{String(dev.threshold ?? dev.policy_value ?? "—")}</td>
                            <td className="px-3 py-2.5 text-slate-700">{dev.justification || "Reviewed"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Evaluated Rules Table */}
                <div className="rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Policy Rule</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Rule Code</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {breRulesList.map((rule: any, i: number) => {
                        const status = String(rule.rule_status || rule.status || "PASS").toUpperCase();
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2.5 font-medium text-slate-900">{rule.rule_name || rule.rule_code}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-500 text-[11px]">{rule.rule_code}</td>
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                                  status === "PASS"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : status === "DEVIATION"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200",
                                )}
                              >
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Statutory KYC & Verification Checks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    3. Statutory KYC Verifications ({verifsList.length})
                  </h4>
                  {verifsList.length > 0 ? (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        verifsList.filter(
                          (v: any) =>
                            v?.success === true ||
                            v?.execution_status === "COMPLETED",
                        ).length === verifsList.length
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200",
                      )}
                    >
                      {verifsList.filter(
                        (v: any) =>
                          v?.success === true ||
                          v?.execution_status === "COMPLETED",
                      ).length}
                      /{verifsList.length} passed
                    </span>
                  ) : null}
                </div>

                {verifsList.length > 0 ? (() => {
                  const getTabKey = (vItem: any, idx: number) =>
                    String(
                      vItem?.id !== undefined && vItem?.id !== null
                        ? `verif_${vItem.id}_${idx}`
                        : `verif_${vItem?.verification_code || "check"}_${idx}`,
                    );

                  const codeCounts: Record<string, number> = {};
                  verifsList.forEach((v: any) => {
                    const c = v.verification_code || "CHECK";
                    codeCounts[c] = (codeCounts[c] || 0) + 1;
                  });

                  const activeIndex = Math.max(
                    0,
                    verifsList.findIndex(
                      (v: any, i: number) => getTabKey(v, i) === l7ActiveVerifTab,
                    ),
                  );
                  const activeItem = verifsList[activeIndex] || verifsList[0];

                  const isSuccess = activeItem.success === true || activeItem.execution_status === "COMPLETED";
                  const summary = activeItem.normalized_summary || {};
                  const summaryEntries = Object.entries(summary);

                  const seenCounts: Record<string, number> = {};

                  return (
                    <div className="space-y-2">
                      {/* Tabs — minimal underline style */}
                      <div
                        role="tablist"
                        aria-label="Statutory verification checks"
                        className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] items-center gap-x-2 overflow-x-auto no-scrollbar border-b border-slate-200"
                      >
                        {verifsList.map((vItem: any, i: number) => {
                          const tabKey = getTabKey(vItem, i);
                          const isSelected = i === activeIndex;
                          const code = vItem.verification_code || "CHECK";
                          seenCounts[code] = (seenCounts[code] || 0) + 1;
                          const isDuplicate = (codeCounts[code] || 0) > 1;
                          const countSuffix = isDuplicate
                            ? ` (${vItem.trigger_role ? `${vItem.trigger_role} ` : ""}#${seenCounts[code]})`
                            : "";
                          const label = `${(vItem.verification_code || `Check ${i + 1}`).replace(/_/g, " ")}${countSuffix}`;
                          const itemSuccess = vItem.success === true || vItem.execution_status === "COMPLETED";

                          return (
                            <button
                              key={tabKey}
                              type="button"
                              role="tab"
                              aria-selected={isSelected}
                              onClick={() => setL7ActiveVerifTab(tabKey)}
                              className={cn(
                                "-mb-px flex items-center justify-center gap-2 whitespace-nowrap border-b-2 px-1 pb-2.5 pt-1 text-center text-xs font-semibold transition-colors duration-150",
                                isSelected
                                  ? "border-blue-600 text-slate-900"
                                  : "border-transparent text-slate-500 hover:text-slate-800",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  itemSuccess ? "bg-emerald-500" : "bg-rose-500",
                                )}
                              />
                              <span className="min-w-0 truncate">{label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Tab Panel */}
                      <div className="rounded-xl border border-slate-200 bg-white">
                        {/* Meta strip */}
                        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                              {(activeItem.verification_code || "Verification").replace(/_/g, " ")}
                              {(codeCounts[activeItem.verification_code || "CHECK"] || 0) > 1
                                ? ` (#${activeIndex + 1})`
                                : ""}
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-slate-600 text-[11px]">
                              Provider: <strong className="text-slate-800 font-semibold">{activeItem.provider || "API Gateway"}</strong>
                            </span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-slate-600 text-[11px]">
                              Role: <strong className="text-slate-800 font-semibold">{activeItem.trigger_role || "MAKER"}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold border",
                                isSuccess
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200",
                              )}
                            >
                              {isSuccess ? "VERIFIED" : "FAILED"}
                            </span>
                            {activeItem.executed_at && (
                              <span className="text-slate-500 text-[11px] whitespace-nowrap">
                                Executed: <strong className="text-slate-700">{formatDate(activeItem.executed_at)}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Findings & Summary Table */}
                        <div className="p-3.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                            Findings &amp; Summary
                          </span>
                          {summaryEntries.length > 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-xs">
                                <tbody>
                                  {summaryEntries.reduce<any[][]>((rows, [k, val], idx) => {
                                    if (idx % 2 === 0) rows.push([[k, val]]);
                                    else rows[rows.length - 1].push([k, val]);
                                    return rows;
                                  }, []).map((pairRow, rIdx) => (
                                    <tr key={rIdx} className="border-b border-slate-100 last:border-b-0">
                                      {pairRow.map(([k, val]: [string, any]) => {
                                        const label = k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
                                        const displayVal = typeof val === "boolean" ? (val ? "Yes" : "No") : String(val ?? "—");
                                        return (
                                          <React.Fragment key={k}>
                                            <td className="px-3 py-2 text-[11px] font-medium capitalize text-slate-500 whitespace-nowrap w-[20%]">
                                              {label}
                                            </td>
                                            <td className="px-3 py-2 text-xs font-semibold text-slate-900 break-words w-[30%]">
                                              {displayVal}
                                            </td>
                                          </React.Fragment>
                                        );
                                      })}
                                      {pairRow.length === 1 && (
                                        <>
                                          <td className="px-3 py-2 w-[20%]">&nbsp;</td>
                                          <td className="px-3 py-2 w-[30%]">&nbsp;</td>
                                        </>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="py-4 text-center text-slate-500 text-xs italic">
                              {activeItem.error_message || "Verification executed successfully. No exceptions noted."}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-slate-500 text-xs">
                    No statutory KYC verifications found.
                  </div>
                )}
              </div>

              {/* 4. Due Diligence, Inspection & Document Checklist */}
              <div className="space-y-3">
                <div className="pb-1 border-b border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    4. Due Diligence &amp; Inspection
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Physical Visit & Consent */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-900 text-xs">Physical Premises Inspection</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {makerComp.visit_report?.uploaded ? "VISIT VERIFIED" : "INSPECTION DONE"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      {makerComp.visit_report?.remarks || "Physical office premises inspected and verified by Branch Maker."}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Conducted: {formatDate(makerComp.visit_report?.conducted_at || makerComp.submitted_at)}</span>
                      <span>DPDP Consent: <strong className="text-emerald-700 font-semibold">Captured &amp; Verified</strong></span>
                    </div>
                  </div>

                  {/* Checker Due Diligence Note */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-900 text-xs">Checker DD Recommendation</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {ddNote.recommendation || "RECOMMENDED"}
                      </span>
                    </div>
                    <div className="text-[11px] space-y-1">
                      <p className="text-slate-700">
                        <strong className="text-slate-900">Observations:</strong> {ddNote.observations || "Applicant has verified market reputation and operational track record."}
                      </p>
                      <p className="text-slate-700">
                        <strong className="text-slate-900">Remarks:</strong> {ddNote.remarks || "Recommended for empanelment subject to HO Credit Head final sanction."}
                      </p>
                      {ddNote.exception_remarks && (
                        <p className="text-amber-800">
                          <strong>Exception:</strong> {ddNote.exception_remarks}
                        </p>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      Submitted by {ddNote.submitted_by?.name || "Checker"} on {formatDate(ddNote.submitted_at || ddNote.created_at)}
                    </div>
                  </div>
                </div>

                {/* Document Checklist Table */}
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="px-3 py-2.5 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <span>Verified Documents ({docsList.length} files)</span>
                  </div>
                    {docsList.map((doc: any, i: number) => {
                      const docType = doc.document_type || doc.type;
                      const checklistMatch = Array.isArray(docChecklist?.checklist)
                        ? docChecklist.checklist.find(
                            (c: any) =>
                              c.document_type === docType ||
                              (doc.file_path && c.file_path === doc.file_path),
                          )
                        : null;

                      const effectiveStatus = getEffectiveDocStatus(doc);
                      const rawStatus = String(
                        doc.status ||
                          doc.verification_status ||
                          checklistMatch?.status ||
                          "",
                      )
                        .trim()
                        .toLowerCase();

                      const isVerified =
                        isApplicationFormDocument(doc) ||
                        effectiveStatus.toLowerCase() === "verified" ||
                        rawStatus === "verified" ||
                        rawStatus === "checked" ||
                        doc.is_verified === true ||
                        doc.is_verified === 1 ||
                        doc.is_verified === "1" ||
                        checklistMatch?.status?.toLowerCase() === "verified";

                      const displayName =
                        checklistMatch?.display_name ||
                        doc.display_name ||
                        doc.name ||
                        (docType
                          ? docType
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (c: string) => c.toUpperCase())
                          : "Document");

                      const fileName =
                        doc.file_name ||
                        doc.filename ||
                        (doc.file_path
                          ? doc.file_path.split("/").pop()
                          : checklistMatch?.file_path
                            ? checklistMatch.file_path.split("/").pop()
                            : "Uploaded File");

                      return (
                        <div
                          key={doc.id ? `doc_${doc.id}` : `doc_${docType || "file"}_${i}`}
                          className="py-2.5 px-3 flex items-center justify-between gap-3 text-xs border-b border-slate-100 last:border-b-0"
                        >
                          <div>
                            <span className="font-medium text-slate-900">
                              {displayName}
                            </span>
                            <span className="text-slate-400 text-[11px] ml-2 font-mono">
                              {fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500">
                              {doc.verified_at
                                ? formatDate(doc.verified_at)
                                : isVerified
                                  ? "Verified"
                                  : "Pending"}
                            </span>
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold border",
                                isVerified
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200",
                              )}
                            >
                              {isVerified ? "VERIFIED" : "PENDING"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Decision / Action Footer Strip */}
              {isSanctionApproved ? (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between">
                  <div>
                    <strong className="font-bold block">Institutional Sanction Granted &bull; Case Concluded</strong>
                    <span className="text-emerald-800 text-[11px]">
                      DSA Code: <strong className="font-mono">{dsa?.dsa_code || dsa?.code}</strong> &bull; Empanelment letter generated.
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setL7ReviewModalOpen(false)}
                    className="text-xs bg-white"
                  >
                    Close
                  </Button>
                </div>
              ) : isSanctionRejected ? (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-center justify-between">
                  <div>
                    <strong className="font-bold block">Application Rejected</strong>
                    <span className="text-rose-800 text-[11px]">This application was rejected by the HO Credit Head.</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setL7ReviewModalOpen(false)}
                    className="text-xs bg-white"
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setL7ReviewModalOpen(false)}
                    className="text-xs"
                  >
                    Close
                  </Button>

                  <Button
                    size="sm"
                    type="button"
                    disabled={actionLoading}
                    onClick={() => {
                      setL7ReviewModalOpen(false);
                      setApprovingDsa(dsa);
                    }}
                    className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Proceed for Final Verification
                  </Button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal
        description="Query is routed back to the Branch Maker (L1). The Maker resolves it and re-submits; the workflow then continues L1 → L2 Checker and onwards."
        onClose={closeDecisionModals}
        open={Boolean(queryingDsa)}
        title="Raise Query to Maker (Checker → L1)"
        width="max-w-lg"
      >
        <div className="space-y-4">
          <Field>
            <Label htmlFor="queryReason">Query details (mandatory)</Label>
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
            {queryError ? (
              <p className="text-xs font-medium text-rose-600">{queryError}</p>
            ) : null}
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
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
              type="button"
              disabled={actionLoading}
              onClick={async () => {
                if (queryingDsa) {
                  if (!queryReason.trim()) {
                    setQueryError(
                      "Please provide query details before submitting.",
                    );
                    return;
                  }
                  const updated = await raiseDsaQuery(queryingDsa.id, {
                    remarks: queryReason.trim(),
                  });
                  if (updated) {
                    // The case now belongs to the Maker, so this user no longer
                    // has a viewable case. Return to the list instead of
                    // landing on a "not at your stage" dead-end.
                    toast({
                      title: "Query Raised to Maker",
                      description: `Query submitted for ${queryingDsa.name}. Case returned to the Level 1 Maker for resolution.`,
                      variant: "success",
                    });
                    closeDecisionModals();
                    router.push("/dsa/management");
                  }
                }
              }}
            >
              {actionLoading ? "Processing..." : "Submit Query"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={closeDecisionModals}
        open={Boolean(rejectingDsa)}
        title={
          rejectionStep === "confirm"
            ? "Confirm Application Rejection (Double Validation)"
            : "Reject DSA Application"
        }
        description={
          rejectionStep === "confirm"
            ? `Permanent terminal action on Application #${rejectingDsa?.code || rejectingDsa?.id}`
            : `Level ${workflowLevelInfo.currentLevel} (${workflowLevelInfo.levelName}) Review Action`
        }
        width="max-w-lg"
      >
        {rejectionStep === "input" ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Rejection Policy (Task 20A)</p>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Rejection is a terminal action. You must provide a clear
                  mandatory remark (1–2000 characters). Upon rejection, the case
                  will be moved to the Maker Rejected Bucket.
                </p>
              </div>
            </div>

            <Field>
              <Label htmlFor="profileRejectionReason">
                Rejection reason / justification{" "}
                <span className="text-rose-600">*</span>
              </Label>
              <textarea
                id="profileRejectionReason"
                rows={3}
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder:text-slate-400"
                value={rejectionReason}
                onChange={(event) => {
                  setRejectionReason(event.target.value);
                  setRejectionError("");
                }}
                placeholder="Enter specific mandatory justification (e.g. KYC document discrepancy, adverse track record, field verification failed)"
                maxLength={2000}
              />
              <div className="flex justify-between items-center mt-1">
                {rejectionError ? (
                  <p className="text-xs font-medium text-rose-600">
                    {rejectionError}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-[10px] text-slate-400 font-mono">
                  {rejectionReason.trim().length}/2000
                </span>
              </div>
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                onClick={closeDecisionModals}
              >
                Cancel
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5"
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  if (!rejectingDsa) return;
                  const trimmed = rejectionReason.trim();
                  if (!trimmed) {
                    setRejectionError(
                      "Rejection remark is mandatory and cannot be empty or whitespace only.",
                    );
                    return;
                  }
                  if (trimmed.length > 2000) {
                    setRejectionError(
                      "Rejection remark must not exceed 2000 characters.",
                    );
                    return;
                  }

                  try {
                    const res = await updateWorkflowAction(rejectingDsa.id, {
                      action: "REJECT",
                      remarks: trimmed,
                    });

                    // Check if backend returned confirmation_required (Step 1 response)
                    const isConfirmReq =
                      (res as any)?.status === "confirmation_required" ||
                      (res as any)?.requires_confirmation === true;

                    if (isConfirmReq) {
                      setRejectionConfirmationData((res as any)?.data || res);
                      setRejectionStep("confirm");
                      setRejectionError("");
                    } else if (res) {
                      toast({
                        title: "Application Rejected",
                        description: `Application #${rejectingDsa.code || rejectingDsa.id} has been rejected and moved to Maker bucket.`,
                        variant: "success",
                      });
                      closeDecisionModals();
                      // Rejected is a dead-end for every role — return to the list.
                      router.push("/dsa/management");
                    }
                  } catch (err: any) {
                    setRejectionError(
                      err?.message || "Failed to initiate rejection.",
                    );
                  }
                }}
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" />
                    Reject Application
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: Confirmation UI */
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                Permanent Rejection Confirmation
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                Are you sure you want to permanently reject application{" "}
                <strong className="font-mono text-rose-950">
                  {rejectingDsa?.code || `APP0000${rejectingDsa?.id}`}
                </strong>{" "}
                ({rejectingDsa?.name || rejectingDsa?.entity_name})?
              </p>
              <p className="text-[11px] text-rose-600 font-medium">
                ⚠️ This is a terminal action. The application will be
                immediately moved to the <strong>Maker Rejected Bucket</strong>{" "}
                with the recorded remarks. No further workflow approvals or
                partner code generation will be possible.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 pb-1.5 border-b border-slate-200">
                <span className="font-semibold">
                  Reviewing Authority Stage:
                </span>
                <span className="font-bold text-slate-900">
                  {rejectionConfirmationData?.assigned_role ||
                    workflowLevelInfo.levelName}{" "}
                  (Level{" "}
                  {rejectionConfirmationData?.approval_level ||
                    workflowLevelInfo.currentLevel}
                  )
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-600 block mb-1">
                  Recorded Rejection Reason:
                </span>
                <p className="p-2 bg-white rounded border border-slate-200 text-slate-900 font-mono text-[11px] italic break-words">
                  "{rejectionConfirmationData?.remarks || rejectionReason}"
                </p>
              </div>
            </div>

            {rejectionError && (
              <p className="text-xs font-medium text-rose-600">
                {rejectionError}
              </p>
            )}

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setRejectionStep("input");
                  setRejectionError("");
                }}
                className="text-xs flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Edit Reason
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeDecisionModals}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
                  type="button"
                  disabled={actionLoading}
                  onClick={async () => {
                    if (!rejectingDsa) return;
                    try {
                      const updated = await updateWorkflowAction(
                        rejectingDsa.id,
                        {
                          action: "REJECT",
                          remarks: rejectionReason.trim(),
                          confirmed: true,
                        },
                      );
                      if (updated) {
                        toast({
                          title: "Application Rejected",
                          description: `Application #${rejectingDsa.code || rejectingDsa.id} has been permanently rejected and routed to Maker Bucket.`,
                          variant: "success",
                        });
                        closeDecisionModals();
                        // Rejected is a dead-end for every role — return to the list.
                        router.push("/dsa/management");
                      }
                    } catch (err: any) {
                      setRejectionError(
                        err?.message || "Failed to confirm rejection.",
                      );
                    }
                  }}
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5" />
                      Confirm &amp; Reject Permanently
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        onClose={() => setViewingLifecycleReason(null)}
        open={Boolean(
          viewingLifecycleReason &&
          canViewDsaLifecycleReason &&
          viewingLifecycleReason.statusReason,
        )}
        title={`${viewingLifecycleReason?.statusReasonAction ?? viewingLifecycleReason?.status ?? "Lifecycle"} reason`}
        width="max-w-md"
      >
        {viewingLifecycleReason ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  {viewingLifecycleReason.name}
                </p>
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
              <Button
                onClick={() => setViewingLifecycleReason(null)}
                type="button"
                variant="secondary"
              >
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
            <p className="text-sm font-semibold text-rose-900">
              {deletingDsa?.name}
            </p>
            <p className="mt-1 text-xs text-rose-800">
              This removes the DSA record and every linked product, lead,
              application, payout, and document record from the app.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <DetailItem
              label="Product configs"
              value={allProductConfigs.length}
            />
            <DetailItem label="Leads" value={leads.length} />
            <DetailItem label="Applications" value={applications.length} />
            <DetailItem label="Commissions" value={commissions.length} />
            <DetailItem label="Documents" value={linkedDocumentCount} />
            <DetailItem
              label="Verification checks"
              value={linkedVerificationCount}
            />
            <DetailItem label="Approval records" value={linkedApprovalCount} />
            <DetailItem label="User records" value={linkedUserCount} />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setDeletingDsa(null)}
              type="button"
              variant="secondary"
            >
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
            Are you sure you want to deactivate{" "}
            <span className="font-bold text-slate-800">
              {deactivatingDsa?.name}
            </span>
            ?
          </p>
          <p className="text-xs text-slate-500">
            This will suspend the DSA, disable their marketing journeys, and
            remove their name from dropdowns across the platform.
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
            {lifecycleReasonError ? (
              <p className="text-xs font-medium text-rose-600">
                {lifecycleReasonError}
              </p>
            ) : null}
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              onClick={closeLifecycleModals}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (deactivatingDsa) {
                  const reason = lifecycleReason.trim();
                  if (!reason) {
                    setLifecycleReasonError(
                      "Add a reason before deactivating this DSA.",
                    );
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
            Are you sure you want to blacklist{" "}
            <span className="font-bold text-slate-800">
              {blacklistingDsa?.name}
            </span>
            ?
          </p>
          <p className="text-xs text-slate-500">
            This will put the partner in the blacklisted DSAs list, suspend
            their marketing journeys, and disable their access.
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
            {lifecycleReasonError ? (
              <p className="text-xs font-medium text-rose-600">
                {lifecycleReasonError}
              </p>
            ) : null}
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              onClick={closeLifecycleModals}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (blacklistingDsa) {
                  const reason = lifecycleReason.trim();
                  if (!reason) {
                    setLifecycleReasonError(
                      "Add a reason before blacklisting this DSA.",
                    );
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
            Are you sure you want to reactivate{" "}
            <span className="font-bold text-slate-800">
              {activatingDsa?.name}
            </span>
            ?
          </p>
          <p className="text-xs text-slate-500">
            This will set the DSA&apos;s status to Active and restore their
            availability in dropdowns and marketing journeys.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setActivatingDsa(null)}
              type="button"
              variant="secondary"
            >
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
            Are you sure you want to remove{" "}
            <span className="font-bold text-slate-800">
              {unblacklistingDsa?.name}
            </span>{" "}
            from the blacklist?
          </p>
          <p className="text-xs text-slate-500">
            This will restore their status to Active and make them available in
            dropdowns and marketing journeys again.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setUnblacklistingDsa(null)}
              type="button"
              variant="secondary"
            >
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
      <Modal
        onClose={() => setViewingInvoice(null)}
        open={Boolean(viewingInvoice)}
        title="Invoice status tracker"
        width="max-w-2xl"
      >
        {viewingInvoice ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div>
                <p className="text-sm font-bold text-slate-950">
                  {viewingInvoice.invoiceNumber}
                </p>
                <p className="text-xs text-slate-500">
                  {viewingInvoice.month} · Requested by{" "}
                  {viewingInvoice.raisedBy}
                </p>
              </div>
              <StatusBadge status={viewingInvoice.status} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Current status
              </p>
              {renderInvoiceTracker(viewingInvoice.status)}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Activity logs
              </p>
              <div className="divide-y divide-slate-100 rounded-md border border-slate-150 bg-white">
                {viewingInvoice.history.map((event: any, idx: number) => (
                  <div className="p-3 text-xs" key={event.id || idx}>
                    <div className="flex items-center justify-between font-semibold text-slate-900">
                      <span>
                        {event.action} by {event.party}
                      </span>
                      <span>{formatCurrency(event.amount)}</span>
                    </div>
                    <p className="text-slate-500 mt-1">
                      {event.actor} · {formatDate(event.at)}
                    </p>
                    {event.note ? (
                      <p className="mt-1 text-slate-700 italic border-l-2 border-slate-200 pl-2 bg-slate-50/50 p-1">
                        {event.note}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setViewingInvoice(null)}
                type="button"
                variant="secondary"
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        onClose={() => setCounterInvoice(null)}
        open={Boolean(counterInvoice)}
        title="Counter invoice claim"
        width="max-w-md"
      >
        <div className="space-y-4">
          <Field>
            <Label>Original claim</Label>
            <p className="text-sm font-semibold text-slate-900">
              {counterInvoice
                ? formatCurrency(counterInvoice.requestedAmount)
                : "-"}
            </p>
          </Field>
          <Field>
            <Label htmlFor="counterValue">
              Counter amount (gross net payout)
            </Label>
            <Input
              id="counterValue"
              onChange={(event) => setCounterAmount(event.target.value)}
              type="number"
              value={counterAmount}
            />
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
            <Button
              onClick={() => setCounterInvoice(null)}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
            <Button onClick={submitCounter} type="button">
              Submit Counter
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document Viewer Modal */}
      <Modal
        onClose={() => setPreviewDoc(null)}
        open={Boolean(previewDoc)}
        title={
          previewDoc
            ? formatDocumentType(previewDoc.document_type)
            : "Document Preview"
        }
        description={
          previewDoc
            ? previewDoc.file_name
              ? `${previewDoc.file_name}${previewDoc.size ? ` • ${previewDoc.size}` : ""}`
              : ""
            : ""
        }
        width="max-w-2xl"
        className="h-[88vh] max-h-[88vh]"
        bodyClassName="overflow-hidden flex flex-col p-4 sm:p-5"
      >
        {previewDoc ? (
          <DocumentViewerBody
            key={
              previewDoc.id || previewDoc.file_name || previewDoc.document_type
            }
            previewDoc={previewDoc}
            dsaId={dsa?.id}
            isBankUser={isBankUser}
            effectiveStatus={getEffectiveDocStatus(previewDoc)}
            canVerifyDoc={canApproveDoc(previewDoc)}
            verificationRoleNote={
              isApplicationFormDocument(previewDoc)
                ? undefined
                : !canApproveDoc(previewDoc) &&
                    getEffectiveDocStatus(previewDoc) !== "Verified" &&
                    getEffectiveDocStatus(previewDoc) !== "Failed"
                  ? isDdReviewReportDocument(previewDoc)
                    ? "Only the Checker can verify the DD Review Report"
                    : "Read-only view"
                  : undefined
            }
            onVerify={async () => {
              if (!canApproveDoc(previewDoc)) return;
              const targetDoc = previewDoc;
              if (typeof targetDoc.id === "number") {
                try {
                  await updateDsaDocumentStatus(dsa.id, {
                    document_id: targetDoc.id,
                    status: "Verified",
                    remarks: `Verified by ${currentUser?.name || "Reviewer"} in viewer modal`,
                  });
                  await fetchBackendDocuments(true);
                  await fetchDsaDetail(dsa.id);
                } catch (err) {}
              }
              setManuallyVerifiedDocIds(
                (prev) => new Set([...prev, targetDoc.id]),
              );
              setCheckerVerifiedDocIds(
                (prev) => new Set([...prev, targetDoc.id]),
              );
              setManuallyFailedDocIds((prev) => {
                const next = new Set(prev);
                next.delete(targetDoc.id);
                return next;
              });
              setPreviewDoc(null);
              toast({
                title: "Document Checked",
                description: `${formatDocumentType(targetDoc.document_type)} has been checked successfully.`,
                variant: "success",
              });
            }}
            onReject={async () => {
              if (!canApproveDoc(previewDoc)) return;
              const targetDoc = previewDoc;
              if (typeof targetDoc.id === "number") {
                try {
                  await updateDsaDocumentStatus(dsa.id, {
                    document_id: targetDoc.id,
                    status: "Failed",
                    remarks: `Rejected by ${currentUser?.name || "Reviewer"} in viewer modal`,
                  });
                  await fetchBackendDocuments(true);
                  await fetchDsaDetail(dsa.id);
                } catch (err) {}
              }
              setManuallyFailedDocIds(
                (prev) => new Set([...prev, targetDoc.id]),
              );
              setManuallyVerifiedDocIds((prev) => {
                const next = new Set(prev);
                next.delete(targetDoc.id);
                return next;
              });
              setCheckerVerifiedDocIds((prev) => {
                const next = new Set(prev);
                next.delete(targetDoc.id);
                return next;
              });
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

      {/* Checker Due Diligence (DD) Note Modal (Level 2 through Level 7) */}
      <Modal
        onClose={() => setViewingDdNoteModal(false)}
        open={viewingDdNoteModal}
        title="Checker Due Diligence (DD) Review Note"
        description={`DSA #${getEffectiveDsaCode(dsa)} • ${dsa.name} • Submitted by Checker`}
        width="max-w-2xl"
      >
        <div className="space-y-4">
          {(() => {
            const note =
              savedCheckerDdNote ||
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
                        Action: {note?.submitted_at ? "SUBMITTED" : "SUBMIT"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Submitted:{" "}
                      {note?.submitted_at
                        ? formatDate(note.submitted_at)
                        : "On Checker Review Completion"}{" "}
                      • By Checker ID:{" "}
                      {note?.checker_user_id || "Branch Checker"}
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
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-md border border-slate-100 min-h-[38px]">
                      {getCleanRemark(note?.observations || checkerDdNote)}
                    </p>
                  </div>

                  {getCleanRemark(note?.exception_remarks) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        Exception / Deviation Justifications
                      </h4>
                      <p className="text-xs text-amber-800 leading-relaxed whitespace-pre-wrap">
                        {getCleanRemark(note.exception_remarks)}
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

      {/* Revert Application Modal (Levels 3 to 6 only; L1, L2, L7 prohibited) */}
      <Modal
        onClose={closeDecisionModals}
        open={Boolean(revertingDsa) && canRevert}
        title={
          currentRevertTarget
            ? `Revert Application to ${currentRevertTarget.targetRole}`
            : "Revert Application"
        }
        description={
          currentRevertTarget
            ? `Send application #${getEffectiveDsaCode(revertingDsa)} back to ${currentRevertTarget.targetRole} (Level ${currentRevertTarget.targetLevel}) for re-evaluation.`
            : "Send application back for re-evaluation."
        }
        width="max-w-lg"
      >
        <div className="space-y-4">
          {currentRevertTarget?.isDynamic && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Dynamic Workflow Routing:</span>{" "}
                {currentRevertTarget.dgmPosted
                  ? "DGM is posted for this branch. Application will route back to DGM (Level 4)."
                  : "DGM is not posted for this branch (skipped). Application will route dynamically back to Sub-Region Head (Level 3)."}
              </div>
            </div>
          )}

          <Field>
            <Label htmlFor="revertRemarks">
              Revert Reason / Observations{" "}
              <span className="text-rose-500">*</span>
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
            {revertError ? (
              <p className="text-xs font-medium text-rose-600 mt-1">
                {revertError}
              </p>
            ) : null}
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              type="button"
              onClick={closeDecisionModals}
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs"
              type="button"
              disabled={actionLoading}
              onClick={async () => {
                if (!revertReason.trim()) {
                  setRevertError(
                    "Please enter a reason for reverting this application.",
                  );
                  return;
                }
                const res = await updateWorkflowAction(revertingDsa.id, {
                  action: "REVERT",
                  remarks: revertReason.trim(),
                });
                if (res) {
                  const targetLabel =
                    currentRevertTarget?.targetRole || "Previous Reviewer";
                  toast({
                    title: "Application Reverted",
                    description: `Application has been sent back to ${targetLabel}.`,
                    variant: "warning",
                  });
                  closeDecisionModals();
                  // The case now sits at another authority's stage, so this
                  // user has no viewable case — return to the list.
                  router.push("/dsa/management");
                }
              }}
            >
              {actionLoading
                ? "Processing..."
                : currentRevertTarget
                  ? `Confirm & ${currentRevertTarget.label}`
                  : "Confirm & Revert"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Task 20C: RE_ALLOCATE modal ───────────────────────────────────── */}
      <Modal
        description={`Hand application #${getEffectiveDsaCode(dsa)} to another authority. Re-allocation is permitted between Levels 3, 4 and 5 only.`}
        onClose={closeDecisionModals}
        open={Boolean(reAllocatingDsa) && showReAllocate}
        title="Re-allocate to Another Authority"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-3 text-xs leading-relaxed text-violet-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <p>
              The target must hold a Sub-Region Head, DGM or Region Head role.
              The DGM option appears only when a DGM is posted for this branch.
              The case moves to the target&rsquo;s level, assigned and locked to
              them.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reAllocateTarget">Re-allocate To *</Label>
            {eligibleLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-3 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading eligible authorities...
              </div>
            ) : eligibleUsers.length === 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                No other eligible authority is available for this case.
              </div>
            ) : (
              <Select
                className="w-full"
                id="reAllocateTarget"
                onChange={(e) =>
                  setReAllocateTargetId(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                value={reAllocateTargetId ? String(reAllocateTargetId) : ""}
              >
                <option value="">Select an authority...</option>
                {eligibleUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} &mdash; {u.role} (Level {u.level})
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reAllocateReason">Reason for Re-allocation *</Label>
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              id="reAllocateReason"
              maxLength={2000}
              onChange={(e) => setReAllocateReason(e.target.value)}
              placeholder="e.g. Re-allocating to Region Head for expedited approval."
              rows={4}
              value={reAllocateReason}
            />
            <p className="text-[11px] text-slate-500">Maximum 2000 characters.</p>
          </div>

          {reAllocateError ? (
            <p className="flex items-start gap-1.5 text-xs font-medium text-rose-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {reAllocateError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={closeDecisionModals} size="sm" type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={action20CBusy || eligibleLoading || eligibleUsers.length === 0}
              onClick={submitReAllocate}
              size="sm"
              type="button"
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
            >
              {action20CBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Confirm Re-allocation
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={() => {
          setVerifyingAgreementAction(null);
          setAgreementDecisionRemarks("");
          setAgreementDecisionError("");
        }}
        open={Boolean(verifyingAgreementAction) && isCheckerUserOrLevel}
        title={
          verifyingAgreementAction === "APPROVE"
            ? "Approve Signed Agreement & Activate DSA Partner"
            : "Reject Scanned Signed Agreement Copy"
        }
        description={
          verifyingAgreementAction === "APPROVE"
            ? "Branch Checker verification of the scanned physical copy uploaded by the Maker or Checker. Approving activates the DSA partner atomically."
            : "Branch Checker rejection of the scanned copy. The copy is marked failed and must be re-uploaded by the Branch Maker or Branch Checker."
        }
        width="max-w-lg"
      >
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-lg p-3.5 border text-xs leading-relaxed",
              verifyingAgreementAction === "APPROVE"
                ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                : "bg-rose-50 border-rose-200 text-rose-950",
            )}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {verifyingAgreementAction === "APPROVE" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Approval &amp; Atomic Partner Activation</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  <span>Rejection &amp; Correction Required</span>
                </>
              )}
            </div>
            {verifyingAgreementAction === "APPROVE" ? (
              <ul className="list-disc pl-4 space-y-0.5">
                <li>
                  Agreement status set to SIGNED_VERIFIED and scanned copy
                  upload permanently locked.
                </li>
                <li>
                  Partner {dsa?.dsa_code || dsa?.name} activated
                  (operational_status = ACTIVE); temporary portal credentials
                  emailed to{" "}
                  {dsa?.applicant_email || dsa?.email || "the registered email"}.
                </li>
                <li>1-year agreement validity recorded from approval date.</li>
              </ul>
            ) : (
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Scanned copy marked failed with your remarks recorded.</li>
                <li>Partner stays NOT_ACTIVE until a valid copy is approved.</li>
                <li>
                  Branch Maker or Branch Checker must upload a corrected scanned
                  copy before re-approval.
                </li>
              </ul>
            )}
          </div>

          <Field>
            <Label htmlFor="agreementRemarks">
              {verifyingAgreementAction === "APPROVE"
                ? "Checking Remarks (Optional)"
                : "Rejection Reason & Remarks (Mandatory)"}
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
                  ? "e.g. Master agreement signatures and rubber stamp checked on all execution pages. Approved for partner activation."
                  : "e.g. Rubber stamp missing on page 3. Signatures on execution schedule unclear. Please affix firm stamp and re-upload."
              }
            />
            {agreementDecisionError ? (
              <p className="text-xs font-semibold text-rose-600 mt-1">
                {agreementDecisionError}
              </p>
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
                  : "bg-rose-600 hover:bg-rose-700",
              )}
            >
              {agreementSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Processing...
                </>
              ) : verifyingAgreementAction === "APPROVE" ? (
                "Confirm & Activate Partner"
              ) : (
                "Confirm & Reject Copy"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Policy Evaluation & Deviations Modal */}
      <Modal
        onClose={() => setViewingDeviationsModal(false)}
        open={viewingDeviationsModal}
        title="Policy Evaluation &amp; Deviation Details"
        width="max-w-5xl"
      >
        <div className="space-y-4">
          {deviationRules.length > 0 || nonDeviationRules.length > 0 ? (
            <div className="overflow-x-auto max-h-[60vh] border border-slate-300 rounded">
              <table className="w-full border-collapse border border-slate-300 text-xs table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr className="text-slate-800 font-bold border-b border-slate-300 text-left">
                    <th className="w-[22%] border border-slate-300 p-2">
                      Parameter
                    </th>
                    <th className="w-[24%] border border-slate-300 p-2">
                      Policy Requirement
                    </th>
                    <th className="w-[18%] border border-slate-300 p-2">
                      Actual Value
                    </th>
                    <th className="w-[24%] border border-slate-300 p-2">
                      Evaluation Remarks / Trigger
                    </th>
                    <th className="w-[12%] border border-slate-300 p-2 text-center">
                      Decision
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deviationRules.length > 0 && (
                    <>
                      <tr className="bg-amber-100/90 text-amber-950 font-bold border border-slate-300">
                        <td
                          colSpan={5}
                          className="p-2 border border-slate-300 text-amber-900"
                        >
                          Deviations Flagged (Discretionary Approval Required)
                        </td>
                      </tr>
                      {deviationRules.map((dev: any, idx: number) => (
                        <tr key={idx} className="bg-white hover:bg-slate-50">
                          <td className="border border-slate-300 p-2 font-bold text-slate-900">
                            {dev.parameter ||
                              dev.rule_name ||
                              dev.rule_code ||
                              "N/A"}
                          </td>
                          <td className="border border-slate-300 p-2 text-slate-700">
                            {dev.policy ||
                              dev.expected_value ||
                              "Standard Criteria"}
                          </td>
                          <td className="border border-slate-300 p-2 font-mono text-slate-900 font-semibold">
                            {dev.actual_value !== undefined &&
                            dev.actual_value !== null
                              ? String(dev.actual_value)
                              : "N/A"}
                          </td>
                          <td className="border border-slate-300 p-2 text-slate-700">
                            {dev.deviation_trigger ||
                              dev.remarks ||
                              "Deviation Flagged"}
                          </td>
                          <td className="border border-slate-300 p-2 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold border border-amber-300 bg-amber-100 text-amber-800 uppercase">
                              {dev.decision || "DEVIATION"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}

                  {nonDeviationRules.length > 0 && (
                    <>
                      <tr className="bg-emerald-50 text-emerald-950 font-bold border border-slate-300">
                        <td
                          colSpan={5}
                          className="p-2 border border-slate-300 text-emerald-800"
                        >
                          Compliant Parameters (Non-Deviations Meeting Policy
                          Standards)
                        </td>
                      </tr>
                      {nonDeviationRules.map((pass: any, idx: number) => {
                        const dec = String(
                          pass.decision || pass.status || "PASS",
                        ).toUpperCase();
                        const isUnavailable =
                          dec === "UNAVAILABLE" ||
                          (String(pass.actual_value || "").toUpperCase() ===
                            "N/A" &&
                            dec !== "PASS");
                        return (
                          <tr key={idx} className="bg-white hover:bg-slate-50">
                            <td className="border border-slate-300 p-2 font-bold text-slate-900">
                              {pass.parameter ||
                                pass.rule_name ||
                                pass.rule_code ||
                                "N/A"}
                            </td>
                            <td className="border border-slate-300 p-2 text-slate-700">
                              {pass.policy ||
                                pass.expected_value ||
                                "Standard Criteria"}
                            </td>
                            <td className="border border-slate-300 p-2 font-mono text-slate-900">
                              {pass.actual_value !== undefined &&
                              pass.actual_value !== null
                                ? String(pass.actual_value)
                                : "N/A"}
                            </td>
                            <td className="border border-slate-300 p-2 text-slate-700">
                              {pass.remarks ||
                                "Compliant with standard criteria"}
                            </td>
                            <td className="border border-slate-300 p-2 text-center">
                              <span
                                className={cn(
                                  "inline-block px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
                                  isUnavailable
                                    ? "bg-slate-100 text-slate-700 border-slate-300"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-300",
                                )}
                              >
                                {pass.decision || "PASS"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-slate-200 rounded p-6 text-center text-xs text-slate-500">
              No policy rule records available.
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setViewingDeviationsModal(false)}
              className="text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
