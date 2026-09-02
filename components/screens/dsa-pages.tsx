"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Check,
  ClipboardList,
  Download,
  FileText,
  KeyRound,
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
import { DEMO_USERS } from "@/lib/demo-identities";
import { generateDsaCredentials } from "@/lib/dsa-credentials";
import {
  dsaDocumentType,
  isMissingDsaDocumentRecord,
  requiredDsaDocumentGroups,
  requiredDsaDocuments,
} from "@/lib/dsa-documents";
import { useMockStore } from "@/lib/store";
import { useDsa } from "@/hooks/useDsa";
import { BusinessType, Dsa, DsaStatus, Product, User } from "@/lib/types";
import { formatCommissionDisplay, formatCurrency, formatDate, generateDsaId, makeId, percent } from "@/lib/utils";

type DsaType = "Independent DSA" | "Exclusive DSA" | "Corporate DSA";
type UploadedFileMeta = { name: string; size: string };

interface OnboardingDraft {
  dsaType: DsaType;
  form: typeof initialOnboardingForm;
  step: number;
  uploadedFiles: Record<string, UploadedFileMeta>;
  dsaDbId?: number;
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

// Approval action eligibility — driven by backend current_approval_level + onboarding_status
const APPROVAL_ACTIONABLE_STATUSES = [
  "SUBMITTED",
  "DOCUMENT_VERIFICATION",
  "COMPLIANCE_CHECK",
  "RISK_ASSESSMENT",
  "PENDING_APPROVAL",
];

function canActOnDsa(
  role: string | undefined,
  currentLevel: number,
  onboardingStatus: string,
  operationalStatus: string
): boolean {
  if (operationalStatus === "ACTIVE" || operationalStatus === "TERMINATED") return false;
  if (!APPROVAL_ACTIONABLE_STATUSES.includes(onboardingStatus)) return false;
  if (role === "DSA Manager") return true; // Super Admin: bypass all levels
  if (role === "Branch User" && currentLevel === 1) return true;
  if (role === "Branch Regional Head" && currentLevel === 2) return true;
  if (role === "DSA Credit" && (currentLevel === 3 || currentLevel === 4)) return true;
  return false;
}

function approvalLevelLabel(currentLevel: number, deviation: boolean): string {
  if (currentLevel === 1) return "Approve (Level 1 – Asst. Manager)";
  if (currentLevel === 2) return "Approve (Level 2 – Manager)";
  if (currentLevel === 4) return "Approve Deviation (Level 4 – DGM)";
  if (currentLevel === 3) return "Final Approve (Level 3 – AGM)";
  if (currentLevel >= 5) return "Fully Approved";
  return "Approve";
}

// Keep legacy shims used in a few places below
function nextDsaApprovalStatus(role: string | undefined, status: DsaStatus): DsaStatus | null {
  return null; // Deprecated — use canActOnDsa instead
}
function dsaApprovalActionLabel(_: DsaStatus | null) { return "Approve"; }

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

const initialOnboardingForm = {
  accountName: "",
  accountNumber: "",
  address: "",
  bankName: "",
  businessType: "Private Limited",
  city: "",
  contactPerson: "",
  email: "",
  gst: "",
  ifsc: "",
  mobile: "",
  name: "",
  pan: "",
  pincode: "",
  state: "",
  subregion_id: "",
  status: "Submitted",
};

const DSA_ONBOARDING_DRAFT_KEY = "cosmos_dsa_onboarding_draft";

function clampOnboardingStep(value: unknown) {
  if (typeof value !== "number") return 0;
  return Math.min(Math.max(value, 0), 6);
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isDsaType(value: unknown): value is DsaType {
  return value === "Independent DSA" || value === "Exclusive DSA" || value === "Corporate DSA";
}

function readOnboardingDraft(): Partial<OnboardingDraft> {
  if (typeof window === "undefined") return {};

  const savedDraft = localStorage.getItem(DSA_ONBOARDING_DRAFT_KEY);
  if (!savedDraft) return {};

  try {
    return JSON.parse(savedDraft) as Partial<OnboardingDraft>;
  } catch {
    localStorage.removeItem(DSA_ONBOARDING_DRAFT_KEY);
    return {};
  }
}

export function DsaOnboardingPage({ publicEntry = false }: { publicEntry?: boolean } = {}) {
  const { currentUser, store, createItem } = useMockStore();
  const {
    createDsa,
    uploadDsaDocument,
    updateDsaProfile,
    updateDsaStatus,
    states,
    districts,
    subRegions,
    fetchStatesDropdown,
    fetchDistrictsDropdown,
    fetchSubRegionsDropdown,
    setDistricts,
    actionLoading,
  } = useDsa();

  const isBranchOnboarding = currentUser?.role === "Branch User";
  const isDsaPartnerBlocked = currentUser?.role === "DSA Partner" && !publicEntry;
  const isDsaSubmittedOnboarding = publicEntry;
  const isSuperAdminOnboarding = currentUser?.role === "DSA Manager";
  const [initialDraft] = useState(() => readOnboardingDraft());
  const [step, setStep] = useState(() => clampOnboardingStep(initialDraft.step));
  const [dsaType, setDsaType] = useState<DsaType>(() =>
    isDsaType(initialDraft.dsaType) ? initialDraft.dsaType : "Independent DSA",
  );
  const [form, setForm] = useState(() => ({ ...initialOnboardingForm, ...initialDraft.form }));
  const [dsaDbId, setDsaDbId] = useState<number | null>(() => initialDraft.dsaDbId ?? null);

  useEffect(() => {
    fetchStatesDropdown();
    fetchSubRegionsDropdown();
  }, [fetchStatesDropdown, fetchSubRegionsDropdown]);

  // Load districts when state changes
  const handleStateChange = async (stateName: string) => {
    update("state", stateName);
    update("city", "");
    setDistricts([]);
    
    const stateObj = states.find((s) => s.state_name === stateName);
    if (stateObj) {
      await fetchDistrictsDropdown(stateObj.state_code);
    }
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFileMeta>>(
    () => initialDraft.uploadedFiles ?? {},
  );
  const [isPanVerifying, setIsPanVerifying] = useState(false);
  const [isPanVerified, setIsPanVerified] = useState(false);
  const [isAbortModalOpen, setIsAbortModalOpen] = useState(false);
  const [submittedDsaId, setSubmittedDsaId] = useState("");
  const [submittedDsaStatus, setSubmittedDsaStatus] = useState<DsaStatus | "">("");
  const missingRequiredDocuments = requiredDsaDocuments.filter((document) => !uploadedFiles[document.key]);

  useEffect(() => {
    if (isDsaPartnerBlocked) return;
    const draft: OnboardingDraft = { dsaType, form, step, uploadedFiles, dsaDbId: dsaDbId ?? undefined };
    localStorage.setItem(DSA_ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  }, [dsaType, form, isDsaPartnerBlocked, step, uploadedFiles, dsaDbId]);

  if (isDsaPartnerBlocked) {
    return (
      <div>
        <PageHeader
          description="Active DSA accounts can manage their own network and applications, but cannot submit another DSA onboarding request from inside the dashboard."
          eyebrow="DSA onboarding"
          title="Onboarding restricted"
        />
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600">
              New DSA onboarding requests must be submitted from the public login page and approved through the branch, regional, and credit hierarchy.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(currentStep: number) {
    const requiredByStep: Record<number, string[]> = {
      1: ["name", "businessType", "contactPerson", "mobile", "email"],
      2: ["pan", "gst", "address", "city", "state", "subregion_id", "pincode"],
      3: ["accountName", "accountNumber", "bankName", "ifsc"],
    };
    const nextErrors: Record<string, string> = {};
    const required = requiredByStep[currentStep] ?? [];
    required.forEach((field) => {
      const val = form[field as keyof typeof form];
      const isEmpty = !val || val === "Draft" || val === "000000" || val === "DUMMY000001" || (field === "pan" && val.startsWith("DFT"));
      if (isEmpty) nextErrors[field] = "Required";
    });
    if (currentStep === 1) {
      if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) {
        nextErrors.mobile = "Enter a valid 10 digit Indian mobile number";
      }
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
        nextErrors.email = "Enter a valid email";
      }
    }
    if (currentStep === 2) {
      const actualPan = form.pan?.startsWith("DFT") ? "" : form.pan;
      if (actualPan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(actualPan)) {
        nextErrors.pan = "PAN format should be ABCDE1234F";
      } else if (actualPan && !isPanVerified) {
        nextErrors.pan = "Please verify your PAN";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validatePublicDocuments() {
    if (!publicEntry || missingRequiredDocuments.length === 0) return true;

    setErrors((current) => ({
      ...current,
      ...Object.fromEntries(missingRequiredDocuments.map((document) => [document.key, "Required for public onboarding"])),
    }));
    return false;
  }

  async function goNext(currentStep: number) {
    if (currentStep > 0 && currentStep < 4 && !validate(currentStep)) return;
    if (currentStep === 4 && !validatePublicDocuments()) return;
    setErrors({});

    try {
      if (currentStep === 1) {
        const dummyPan = `DFT${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
        const payload = {
          name: form.name,
          business_type: form.businessType,
          contact_person: form.contactPerson,
          mobile: form.mobile,
          email: form.email,
          pan: form.pan || dummyPan,
          gst: form.gst || null,
          address: form.address || "Draft",
          city: form.city || "Draft",
          state: form.state || "Draft",
          subregion_id: form.subregion_id || "SR001",
          pincode: form.pincode || "000000",
          account_name: form.accountName || form.name || "Draft",
          account_number: form.accountNumber || "000000",
          ifsc: form.ifsc || "DUMMY000001",
          bank_name: form.bankName || "Draft",
          onboarding_status: "DRAFT",
        };

        if (dsaDbId === null) {
          const dsaObj = await createDsa(payload);
          if (dsaObj) {
            setDsaDbId(dsaObj.id);
            if (!form.pan) {
              setForm((current) => ({ ...current, pan: dummyPan }));
            }
          } else {
            return;
          }
        } else {
          await updateDsaProfile(dsaDbId, {
            name: form.name,
            business_type: form.businessType,
            contact_person: form.contactPerson,
            mobile: form.mobile,
            email: form.email,
          });
        }
      } else if (currentStep === 2) {
        if (dsaDbId !== null) {
          await updateDsaProfile(dsaDbId, {
            pan: form.pan,
            gst: form.gst || null,
            address: form.address,
            city: form.city,
            state: form.state,
            subregion_id: form.subregion_id || undefined,
            pincode: form.pincode,
          });
        }
      } else if (currentStep === 3) {
        if (dsaDbId !== null) {
          await updateDsaProfile(dsaDbId, {
            account_name: form.accountName,
            account_number: form.accountNumber,
            bank_name: form.bankName,
            ifsc: form.ifsc,
          });
          await updateDsaStatus(dsaDbId, {
            onboarding_status: "DOCUMENT_VERIFICATION",
            reason: "Transitioning to document verification stage",
          });
        }
      } else if (currentStep === 4) {
        if (dsaDbId !== null) {
          for (const key of Object.keys(uploadedFiles)) {
            const fileMeta = uploadedFiles[key] as any;
            if (fileMeta?.file && !fileMeta.uploaded) {
              const uploadedDoc = await uploadDsaDocument(dsaDbId, {
                file: fileMeta.file,
                document_type: dsaDocumentType(key),
                owner_name: form.name,
              });
              if (uploadedDoc) {
                setUploadedFiles((current) => ({
                  ...current,
                  [key]: {
                    ...current[key],
                    uploaded: true,
                  },
                }));
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to progress onboarding API step:", err);
      return;
    }

    setStep(currentStep + 1);
  }

  function goBack(currentStep: number) {
    setErrors({});
    setStep(Math.max(0, currentStep - 1));
  }

  function handleFileUpload(key: string, file?: File) {
    if (!file) return;
    setUploadedFiles((current) => ({
      ...current,
      [key]: {
        file,
        name: file.name,
        size: formatFileSize(file.size),
      },
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit() {
    if (!validatePublicDocuments()) {
      setStep(4);
      return;
    }

    let finalDsa = null;

    if (dsaDbId !== null) {
      // DSA was already created at step 1 with onboarding_status="SUBMITTED".
      // Do NOT call updateDsaStatus here — backend already set the correct status.
      // Just upload any remaining documents that weren't uploaded in step 4.
      for (const key of Object.keys(uploadedFiles)) {
        const fileMeta = uploadedFiles[key] as any;
        if (fileMeta?.file && !fileMeta.uploaded) {
          await uploadDsaDocument(dsaDbId, {
            file: fileMeta.file,
            document_type: dsaDocumentType(key),
            owner_name: form.name,
          });
        }
      }
      // Fetch latest DSA state to use for the rest of handleSubmit
      finalDsa = await (async () => {
        try {
          const { adminApi } = await import("@/apis/admin");
          const res = await adminApi.getDsaDetail(dsaDbId);
          return res.data;
        } catch {
          return null;
        }
      })();
    } else {
      const payload = {
        name: form.name,
        business_type: form.businessType,
        pan: form.pan,
        gst: form.gst || null,
        contact_person: form.contactPerson,
        mobile: form.mobile,
        email: form.email,
        address: form.address,
        city: form.city,
        state: form.state,
        subregion_id: form.subregion_id || "SR001",
        pincode: form.pincode,
        account_name: form.accountName,
        account_number: form.accountNumber,
        ifsc: form.ifsc,
        bank_name: form.bankName,
        onboarding_status: "SUBMITTED",
      };
      finalDsa = await createDsa(payload);
      if (finalDsa) {
        for (const key of Object.keys(uploadedFiles)) {
          const fileMeta = uploadedFiles[key] as any;
          if (fileMeta?.file) {
            await uploadDsaDocument(finalDsa.id, {
              file: fileMeta.file,
              document_type: dsaDocumentType(key),
              owner_name: form.name,
            });
          }
        }
      }
    }


    if (!finalDsa) return;

    if (createItem) {
      createItem("dsas", {
        id: String(finalDsa.id),
        code: finalDsa.code,
        name: finalDsa.name,
        businessType: finalDsa.business_type as any,
        pan: finalDsa.pan,
        gst: finalDsa.gst || "",
        contactPerson: finalDsa.contact_person,
        mobile: finalDsa.mobile,
        email: finalDsa.email,
        loginUsername: finalDsa.login_username || "",
        loginPassword: finalDsa.login_password || "",
        address: finalDsa.address,
        city: finalDsa.city,
        state: finalDsa.state,
        pincode: finalDsa.pincode,
        bank: {
          accountName: finalDsa.account_name,
          accountNumber: finalDsa.account_number,
          bankName: finalDsa.bank_name,
          ifsc: finalDsa.ifsc,
        },
        status: "Pending Branch Approval",
        onboardingDate: new Date().toISOString(),
        manager: finalDsa.manager || "",
        tier: (finalDsa.tier as any) || "Bronze",
        riskRating: (finalDsa.risk_rating as any) || "Low",
        monthlyLeads: finalDsa.monthly_leads || 0,
        approvalRate: finalDsa.approval_rate || 0,
        commissionEarned: finalDsa.commission_earned || 0,
        documents: [],
      });
    }

    setSubmittedDsaId(finalDsa.code);
    setSubmittedDsaStatus(finalDsa.onboarding_status as DsaStatus);
    setStep(6);
    localStorage.removeItem(DSA_ONBOARDING_DRAFT_KEY);
  }

  function resetOnboarding() {
    setErrors({});
    setForm({ ...initialOnboardingForm });
    setDsaType("Independent DSA");
    setUploadedFiles({});
    setIsPanVerified(false);
    setIsPanVerifying(false);
    setIsAbortModalOpen(false);
    setSubmittedDsaId("");
    setSubmittedDsaStatus("");
    setStep(0);
    setDsaDbId(null);
    localStorage.removeItem(DSA_ONBOARDING_DRAFT_KEY);
  }

  const abortOnboardingButton = (
    <Button
      onClick={() => setIsAbortModalOpen(true)}
      type="button"
      variant="outline"
      className="h-10 border-rose-200 px-5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
    >
      Abort DSA Onboarding
    </Button>
  );

  const renderField = (
    key: keyof typeof form,
    label: string,
    props?: { options?: string[]; type?: string },
  ) => (
    <Field>
      <Label htmlFor={key}>{label}</Label>
      {props?.options ? (
        <Select id={key} onChange={(event) => update(key, event.target.value)} value={form[key]}>
          {props.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      ) : (
        <Input id={key} onChange={(event) => update(key, event.target.value)} type={props?.type ?? "text"} value={form[key] === "Draft" || form[key] === "000000" || (key === "ifsc" && form[key] === "DUMMY000001") ? "" : form[key]} />
      )}
      {errors[key] ? <p className="text-xs font-medium text-rose-600 mt-1">{errors[key]}</p> : null}
    </Field>
  );

  const renderUploadSlot = (key: string, label: string) => {
    const file = uploadedFiles[key];
    const inputId = `dsa-doc-${key}`;
    return (
      <div key={key} className="space-y-1">
        <div
          className={`flex items-center justify-between rounded-xl border border-dashed p-4 transition-all duration-200 ${
            file
              ? "border-emerald-300 bg-emerald-50/20"
              : errors[key]
                ? "border-rose-300 bg-rose-50/30"
                : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
          }`}
        >
          <div className="min-w-0 flex-1 pr-3">
            <p className="text-xs font-bold text-slate-800 truncate">{label}</p>
            {file ? (
              <p className="text-[10px] text-emerald-600 font-semibold truncate">
                {file.name} ({file.size})
              </p>
            ) : (
              <p className="text-[10px] text-slate-400">Acceptable formats: JPEG, JPG, PNG or PDF.</p>
            )}
          </div>
          {file ? (
            <button
              aria-label={`Remove ${label}`}
              title="Remove document"
              type="button"
              onClick={() => {
                setUploadedFiles((current) => {
                  const copy = { ...current };
                  delete copy[key];
                  return copy;
                });
              }}
              className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-rose-50 hover:text-rose-600 transition"
            >
              <Check className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex shrink-0">
              <input
                accept=".jpg,.jpeg,.png,.pdf"
                className="sr-only"
                id={inputId}
                onChange={(event) => handleFileUpload(key, event.currentTarget.files?.[0])}
                type="file"
              />
              <label
                aria-label={`Upload ${label}`}
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                htmlFor={inputId}
                title="Upload local file"
              >
                <UploadCloud className="h-4 w-4" />
              </label>
            </div>
          )}
        </div>
        {errors[key] ? <p className="text-xs font-medium text-rose-600">{errors[key]}</p> : null}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        description="Capture partner business details, validate KYC identity, collect settlement banking, and upload required documents."
        eyebrow="DSA onboarding"
        title="Create DSA"
      />

      <Card className="max-w-5xl mx-auto shadow-md">
        <CardContent className="p-6 md:p-8">
          {/* Top horizontal progress bar */}
          {step > 0 && step < 6 ? (
            <div className="mb-8 flex items-center justify-between max-w-xl mx-auto px-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-colors ${
                        i <= step
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {i < step ? <Check className="h-4 w-4" /> : i}
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-wider text-center">
                      {["Profile", "KYC", "Bank", "Docs", "Bank Verified"][i - 1]}
                    </span>
                  </div>
                  {i < 5 && (
                    <div
                      className={`h-[2px] flex-1 mx-2 -mt-4 transition-colors ${
                        i < step ? "bg-blue-600" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div>
            {/* Step 0: Select DSA Type */}
            {step === 0 ? (
              <div className="flex flex-col items-center py-6">
                <h2 className="text-2xl font-bold text-slate-800 text-center">Select DSA Type</h2>
                <p className="text-sm text-slate-500 text-center mt-2 mb-8 max-w-md">
                  Select the type of Direct Selling Agent (DSA) that suits your needs.
                </p>

                <div className="grid gap-6 md:grid-cols-3 w-full max-w-4xl px-4">
                  {[
                    {
                      id: "Independent DSA",
                      title: "Independent DSA",
                      badge: (
                        <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M50 5L55.5 16.5L67.5 13.5L68 26L79.5 28.5L75 40.5L84.5 49L76.5 59L82.5 70L71 73L67.5 85L55.5 83.5L50 95L44.5 83.5L32.5 85L29 73L17.5 70L23.5 59L15.5 49L25 40.5L20.5 28.5L32 26L32.5 13.5L44.5 16.5L50 5Z" fill="#FBBF24" stroke="#D97706" strokeWidth="2" strokeLinejoin="round"/>
                          <circle cx="50" cy="48" r="32" fill="#F59E0B"/>
                          <path d="M20 62L50 72L80 62L80 78L50 88L20 78V62Z" fill="#DC2626"/>
                          <path d="M25 65L50 73.5L75 65" stroke="#FCA5A5" strokeWidth="1.5" strokeLinecap="round"/>
                          <text x="50" y="77" fill="white" fontSize="7" fontWeight="bold" textAnchor="middle" letterSpacing="0.5">TOP RATED</text>
                          <g fill="#FEF3C7">
                            <path d="M50 22L51.5 26.5H56.5L52.5 29.5L54 34L50 31L46 34L47.5 29.5L43.5 26.5H48.5L50 22Z"/>
                            <path d="M38 27L39 30.5H43L40 32.5L41.2 36L38 33.8L34.8 36L36 32.5L33 30.5H37L38 27Z"/>
                            <path d="M62 27L63 30.5H67L64 32.5L65.2 36L62 33.8L58.8 36L60 32.5L57 30.5H61L62 27Z"/>
                          </g>
                          <path d="M50 38L53.5 45.5H62L55 50L57.5 57.5L50 52.5L42.5 57.5L45 50L38 45.5H46.5L50 38Z" fill="#FFFBEB" stroke="#D97706" strokeWidth="1"/>
                        </svg>
                      )
                    },
                    {
                      id: "Exclusive DSA",
                      title: "Exclusive DSA",
                      badge: (
                        <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M50 5L55.5 16.5L67.5 13.5L68 26L79.5 28.5L75 40.5L84.5 49L76.5 59L82.5 70L71 73L67.5 85L55.5 83.5L50 95L44.5 83.5L32.5 85L29 73L17.5 70L23.5 59L15.5 49L25 40.5L20.5 28.5L32 26L32.5 13.5L44.5 16.5L50 5Z" fill="#34D399" stroke="#059669" strokeWidth="2" strokeLinejoin="round"/>
                          <circle cx="50" cy="50" r="32" fill="#10B981"/>
                          <path d="M32 65 L44 51 L54 57 L68 36" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M56 36 H68 V48" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="50" cy="50" r="24" stroke="white" strokeWidth="1.5" strokeDasharray="3 3"/>
                        </svg>
                      )
                    },
                    {
                      id: "Corporate DSA",
                      title: "Corporate DSA",
                      badge: (
                        <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M50 5L55.5 16.5L67.5 13.5L68 26L79.5 28.5L75 40.5L84.5 49L76.5 59L82.5 70L71 73L67.5 85L55.5 83.5L50 95L44.5 83.5L32.5 85L29 73L17.5 70L23.5 59L15.5 49L25 40.5L20.5 28.5L32 26L32.5 13.5L44.5 16.5L50 5Z" fill="#60A5FA" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round"/>
                          <circle cx="50" cy="50" r="32" fill="#3B82F6"/>
                          <rect x="32" y="52" width="8" height="18" fill="white" rx="1"/>
                          <rect x="44" y="40" width="8" height="30" fill="white" rx="1"/>
                          <rect x="56" y="32" width="8" height="38" fill="white" rx="1"/>
                          <circle cx="70" cy="65" r="7" fill="#FBBF24" stroke="#D97706" strokeWidth="1"/>
                          <circle cx="67" cy="68" r="7" fill="#F59E0B" stroke="#B45309" strokeWidth="1"/>
                        </svg>
                      )
                    }
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setDsaType(type.id as DsaType)}
                      className={`flex flex-col items-center justify-center p-8 rounded-2xl border-2 transition cursor-pointer text-center bg-slate-50/50 ${
                        dsaType === type.id
                          ? "border-blue-600 bg-blue-50/20 shadow-md ring-1 ring-blue-100"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {type.badge}
                      <span className="mt-4 font-bold text-slate-800 text-md">{type.title}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-10 flex justify-center w-full">
                  <Button
                    type="button"
                    onClick={() => setStep(1)}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold h-11 px-10 rounded-lg shadow-sm"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Step 1: Business Profile */}
            {step === 1 ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">
                  Partner Profile Details
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderField("name", "Legal business name")}
                  {renderField("businessType", "Business type", { options: businessTypes })}
                  {renderField("contactPerson", "Contact person")}
                  {renderField("mobile", "Mobile")}
                  {renderField("email", "Email", { type: "email" })}
                </div>
              </div>
            ) : null}

            {/* Step 2: KYC Details */}
            {step === 2 ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">
                  KYC & Address Details
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <Label htmlFor="pan">PAN</Label>
                    <div className="relative flex items-center">
                      <Input
                        id="pan"
                        onChange={(event) => {
                          const val = event.target.value.toUpperCase();
                          update("pan", val);
                          if (isPanVerified) setIsPanVerified(false);
                          if (errors.pan) {
                            setErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.pan;
                              return copy;
                            });
                          }
                        }}
                        className="pr-28 uppercase font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal"
                        placeholder="ABCDE1234F"
                        value={form.pan?.startsWith("DFT") ? "" : form.pan}
                        disabled={isPanVerifying}
                      />
                      <div className="absolute right-1">
                        {isPanVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-md border border-emerald-200 mr-1">
                            <Check className="h-3.5 w-3.5 stroke-[3]" /> Verified
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={!form.pan || isPanVerifying}
                            onClick={() => {
                              if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan)) {
                                setErrors((prev) => ({ ...prev, pan: "PAN format should be ABCDE1234F" }));
                                return;
                              }
                              setErrors((prev) => {
                                const copy = { ...prev };
                                delete copy.pan;
                                return copy;
                              });
                              setIsPanVerifying(true);
                              setTimeout(() => {
                                setIsPanVerifying(false);
                                setIsPanVerified(true);
                              }, 1000);
                            }}
                            className="h-8 text-xs font-semibold px-3"
                          >
                            {isPanVerifying ? (
                              <span className="flex items-center gap-1">
                                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                verifying
                              </span>
                            ) : (
                              "Verify"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    {errors.pan ? <p className="text-xs font-medium text-rose-600 mt-1">{errors.pan}</p> : null}
                  </Field>
                  {renderField("gst", "GST")}
                  <div className="md:col-span-2">{renderField("address", "Address")}</div>
                  <Field>
                    <Label htmlFor="stateSelect">State</Label>
                    <Select
                      id="stateSelect"
                      value={form.state === "Draft" ? "" : form.state}
                      onChange={(e) => handleStateChange(e.target.value)}
                    >
                      <option value="">Select state</option>
                      {states.map((s) => (
                        <option key={s.state_code} value={s.state_name}>{s.state_name}</option>
                      ))}
                    </Select>
                    {errors.state ? <p className="text-xs font-medium text-rose-600 mt-1">{errors.state}</p> : null}
                  </Field>
                  <Field>
                    <Label htmlFor="citySelect">City / District</Label>
                    <Select
                      id="citySelect"
                      value={form.city === "Draft" ? "" : form.city}
                      onChange={(e) => update("city", e.target.value)}
                      disabled={!form.state || form.state === "Draft"}
                    >
                      <option value="">{form.state ? "Select city/district" : "Select state first"}</option>
                      {districts.map((d) => (
                        <option key={d.district_code} value={d.district_name}>{d.district_name}</option>
                      ))}
                    </Select>
                    {errors.city ? <p className="text-xs font-medium text-rose-600 mt-1">{errors.city}</p> : null}
                  </Field>
                  <Field>
                    <Label htmlFor="subRegionSelect">Subregion</Label>
                    <Select
                      id="subRegionSelect"
                      value={form.subregion_id || ""}
                      onChange={(e) => update("subregion_id", e.target.value)}
                    >
                      <option value="">Select subregion</option>
                      {subRegions.map((sr) => (
                        <option key={sr.sub_region_code} value={sr.sub_region_code}>
                          {sr.sub_region_name} ({sr.sub_region_code})
                        </option>
                      ))}
                    </Select>
                    {errors.subregion_id ? <p className="text-xs font-medium text-rose-600 mt-1">{errors.subregion_id}</p> : null}
                  </Field>
                  {renderField("pincode", "Pincode")}
                </div>
              </div>
            ) : null}

            {/* Step 3: Bank Details */}
            {step === 3 ? (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">
                  Payout Bank Details
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderField("accountName", "Account name")}
                  {renderField("accountNumber", "Account number")}
                  {renderField("bankName", "Bank name")}
                  {renderField("ifsc", "IFSC")}
                </div>
              </div>
            ) : null}

            {/* Step 4: Doc Uploads */}
            {step === 4 ? (
              <div className="space-y-6">
                {requiredDsaDocumentGroups.map((group, index) => (
                  <div className={index === 0 ? "" : "pt-4"} key={group.title}>
                    <h3 className="text-sm font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">
                      {group.title}
                    </h3>
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Documents are required before approval. Missing files can be completed from the on-hold queue after submission.
                    </p>
                    <div className="grid gap-4 md:grid-cols-3 mt-4">
                      {group.documents.map((document) => renderUploadSlot(document.key, document.label))}
                    </div>
                  </div>
                ))}
                {missingRequiredDocuments.length ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-blue-900">
                    <p className="font-semibold">
                      {publicEntry ? "All mandatory documents are required before public submission." : "Missing documents will move this DSA to On Hold."}
                    </p>
                    <p className="mt-1 text-xs text-blue-800">
                      {publicEntry
                        ? "Upload each required document to continue to bank verification and submit this DSA request."
                        : "DSA Credit, Branch User, or Super Admin can upload the remaining documents from the on-hold list before approval."}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Step 5: Bank Account Verified Status */}
            {step === 5 ? (
              <div className="space-y-6 max-w-xl mx-auto py-4">
                <div className="text-center space-y-2">
                  <div className="mx-auto bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full w-12 h-12 flex items-center justify-center shadow-sm">
                    <ShieldCheck className="h-6 w-6 stroke-[2.5]" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-950">
                    {missingRequiredDocuments.length ? "Bank Verified - Documents Pending" : "Bank Verification Approved"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {missingRequiredDocuments.length
                      ? "Bank details are verified. Because documents are missing, this DSA will be submitted as On Hold."
                      : "The bank has verified this DSA and it is ready to onboard now."}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 space-y-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Account Holder</span>
                      <span className="font-semibold text-slate-800">{form.accountName || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Account Number</span>
                      <span className="font-semibold text-slate-800 font-mono">{form.accountNumber || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Bank Name</span>
                      <span className="font-semibold text-slate-800">{form.bankName || "N/A"}</span>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400">IFSC Code</span>
                      <span className="font-semibold text-slate-800 font-mono">{form.ifsc || "N/A"}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="w-full flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl shadow-sm">
                      <Check className="h-6 w-6 stroke-[3] text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="text-sm font-bold text-emerald-950">Pre-Verified by Bank</p>
                        <p className="text-xs text-emerald-700 leading-relaxed">
                          Cosmos Bank has successfully verified the settlement bank details for this DSA. The account is validated and ready for onboarding.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      onClick={() => goBack(5)}
                      type="button"
                      variant="secondary"
                      className="h-10 px-5"
                    >
                      Back
                    </Button>
                    {abortOnboardingButton}
                  </div>
                  <Button
                    onClick={handleSubmit}
                    type="button"
                    className="h-10 px-6 bg-blue-700 hover:bg-blue-800 text-white font-bold"
                  >
                    Submit Onboarding
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Step 6: Submitted Success Receipt */}
            {step === 6 ? (
              <div className="flex flex-col items-center text-center p-8 space-y-6 max-w-md mx-auto">
                <div className="relative grid h-24 w-24 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-100">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>

                <div className="space-y-3">
                  <h2 className="text-3xl font-black text-blue-600 tracking-tight">
                    Submitted !
                  </h2>
                  <p className="text-md font-bold text-slate-700">Thank you for onboarding a new DSA.</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {missingRequiredDocuments.length
                      ? "Mandatory documents are missing, so this DSA is now On Hold until the pending documents are uploaded."
                      : submittedDsaStatus === "Active"
                        ? "Super Admin has directly activated this DSA. Credentials are available from the DSA Management list."
                        : submittedDsaStatus === "Pending Branch Approval"
                          ? "This application is waiting for Branch approval, then BRH approval, then Credit final approval."
                          : submittedDsaStatus === "Pending BRH Approval"
                            ? "This application is waiting for Branch Regional Head approval before Credit final approval."
                            : "This application is waiting with DSA Credit for final approval."}
                  </p>
                </div>

                {submittedDsaId ? (
                  <div className="w-full rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-left">
                    <p className="text-xs font-semibold uppercase text-blue-700">Generated DSA ID</p>
                    <p className="mt-1 break-all font-mono text-sm font-bold text-blue-950">
                      {submittedDsaId}
                    </p>
                  </div>
                ) : null}

                <div className="pt-4 flex flex-col gap-3 w-full max-w-xs">
                  <Button
                    type="button"
                    onClick={() => alert("Receipt PDF downloaded.")}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold h-11 border-none rounded-lg w-full flex items-center justify-center gap-2"
                  >
                    <Download className="h-5 w-5" /> DOWNLOAD
                  </Button>
                  <div className="flex gap-2 w-full mt-2">
                    <Button
                      onClick={resetOnboarding}
                      type="button"
                      variant="secondary"
                      className="flex-1 text-xs"
                    >
                      Onboard another
                    </Button>
                    {!publicEntry ? (
                      <Link href="/dsa/management" className="flex-1">
                        <Button type="button" className="w-full text-xs">
                          View DSA list
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Bottom Back/Continue Navigation for middle steps */}
            {step > 0 && step < 5 ? (
              <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    onClick={() => goBack(step)}
                    type="button"
                    variant="secondary"
                    className="h-10 px-5"
                  >
                    Back
                  </Button>
                  {abortOnboardingButton}
                </div>
                <Button
                  onClick={() => goNext(step)}
                  type="button"
                  className="h-10 px-5"
                >
                  Continue
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Modal
        onClose={() => setIsAbortModalOpen(false)}
        open={isAbortModalOpen}
        title="Abort DSA onboarding?"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will delete all in-progress onboarding data from this session, including profile fields, KYC details, bank details, uploaded document metadata, and the saved draft.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsAbortModalOpen(false)} type="button" variant="secondary">
              Cancel
            </Button>
            <Button onClick={resetOnboarding} type="button" variant="danger">
              Abort onboarding
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

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
  const { createItem, deleteItem, store, updateItem, currentUser } = useMockStore();
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
      page,
      per_page: 10,
    };
  }, [search, status, page]);

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
                className="w-full sm:w-[200px]"
              >
                <option value="">All statuses</option>
                {managementStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
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
                            <p className="font-semibold text-blue-700 hover:underline">{item.name}</p>
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
  if (norm === "DOCUMENT_PENDING") return "KYC Pending";
  if (norm === "COMPLIANCE_CHECK") return "Pending BRH Approval";
  if (norm === "RISK_ASSESSMENT") return "Pending Credit Approval";
  if (norm === "PENDING_APPROVAL") return "Pending Credit Approval";
  // APPROVED = all approvals done, agreement pending — NOT operationally active yet
  if (norm === "APPROVED") return "Pending Credit Approval";
  if (norm === "AGREEMENT_PENDING") return "Pending Credit Approval";
  if (norm === "AGREEMENT_COMPLETED") return "Active";
  if (norm === "REJECTED") return "Rejected";
  return "Draft";
}

export function DsaProfilePage({ id }: { id: string }) {
  const { createItem, deleteDsaCascade, deleteItem, store, updateItem, currentUser } = useMockStore();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState("performance");
  const [applicationProductFilter, setApplicationProductFilter] = useState("");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [editingAgent, setEditingAgent] = useState<User | null>(null);
  const [approvingDsa, setApprovingDsa] = useState<any | null>(null);
  const [queryingDsa, setQueryingDsa] = useState<any | null>(null);
  const [queryText, setQueryText] = useState("");
  const [queryError, setQueryError] = useState("");
  const [rejectingDsa, setRejectingDsa] = useState<any | null>(null);
  const [rejectionError, setRejectionError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
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

  useEffect(() => {
    if (!dsa) return;
    if (!currentUser || currentUser.role === "DSA Partner" || currentUser.role === "Customer") {
      return;
    }
    async function loadDsaAudit() {
      try {
        const response = await adminApi.getActivityLogs({ group: "dsa", page: 1, per_page: 8 });
        setDsaAudit(response?.data || []);
      } catch (err) {
        console.warn("Failed to load DSA audit logs:", err);
      }
    }
    loadDsaAudit();
  }, [dsa, currentUser]);

  if (loading || !dsa) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  const uploadedTypes = new Set(dsa.documents?.map((d) => d.document_type) || []);
  const missingProfileDocuments = requiredDsaDocuments.filter(
    (req) => !uploadedTypes.has(dsaDocumentType(req.key))
  );

  const dsaStatus = mapBackendStatusToFrontend(dsa.onboarding_status, dsa.operational_status);
  // Level-based approval gating: uses actual backend current_approval_level
  const canDecideDsa = canActOnDsa(
    currentUser?.role,
    dsa.current_approval_level,
    dsa.onboarding_status,
    dsa.operational_status
  );
  const canApproveDsa = canDecideDsa && missingProfileDocuments.length === 0;
  const nextApprovalStatus = null; // legacy compat — unused
  const allProductConfigs = store.dsaProductConfigs.filter((config) => config.dsaId === String(dsa.id));
  const productConfigs = allProductConfigs
    .filter((config) => (dsa.onboarding_status === "APPROVED" || dsa.onboarding_status === "AGREEMENT_COMPLETED") && config.status === "Active")
    .sort((left, right) => left.product.localeCompare(right.product));
  const configuredProducts = productConfigs.map((config) => config.product);

  const closeDecisionModals = () => {
    setApprovingDsa(null);
    setQueryingDsa(null);
    setQueryText("");
    setQueryError("");
    setRejectingDsa(null);
    setRejectionError("");
    setRejectionReason("");
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
  const isBankUser = currentUser?.role !== "DSA Partner" && currentUser?.role !== "Customer";

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
                  title={canApproveDsa ? "Approve DSA" : "Missing mandatory documents — verify all docs first"}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 h-auto"
                >
                  {approvalLevelLabel(dsa.current_approval_level, dsa.deviation)}
                </Button>
                <Button
                  onClick={() => {
                    setQueryText("");
                    setQueryError("");
                    setQueryingDsa(dsa);
                  }}
                  size="sm"
                  variant="secondary"
                  className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 font-bold text-xs py-1 h-auto"
                >
                  Query
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
            { label: "Approval & BRE", value: "workflow" },
            { label: "KYC", value: "kyc" },
            { label: "Documents", value: "documents" },
            { label: "Agreements", value: "agreements" },
            { label: "Manage Products", value: "products" },
            ...(canManageAgents ? [{ label: "Manage Agents", value: "agents" }] : []),
            { label: "Applications", value: "apps" },
            { label: "Commission", value: "commission" },
            { label: "Reports", value: "reports" },
            { label: "Audit Timeline", value: "audit" },
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
              <DetailItem label="Subregion" value={dsa.subregion_id || "N/A"} />
              <DetailItem label="Bank" value={`${dsa.bank_name} · ${dsa.ifsc}`} />
              <DetailItem label="Tier" value={dsa.tier} />
            </DetailGrid>
          ) : null}
          {tab === "workflow" ? (
            <div className="space-y-6">
              {/* BRE Engine Section */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">BRE Engine Evaluation Results</h3>
                    <p className="text-xs text-slate-500">Automated underwriting checks & deviation eligibility</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                      dsa.bre_status === "PASSED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}>
                      {dsa.bre_status || "PENDING"}
                    </span>
                    {dsa.deviation ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                        Deviation Required (DGM Level 4)
                      </span>
                    ) : null}
                  </div>
                </div>

                {dsa.bre_results && dsa.bre_results.length ? (
                  <div className="overflow-x-auto rounded-md border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="p-2.5">Rule Code</th>
                          <th className="p-2.5">Rule Name</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Rule Value</th>
                          <th className="p-2.5">Expected Value</th>
                          <th className="p-2.5">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dsa.bre_results.map((rule) => (
                          <tr key={rule.id}>
                            <td className="p-2.5 font-mono font-bold text-slate-700">{rule.rule_code}</td>
                            <td className="p-2.5 font-semibold text-slate-900">{rule.rule_name}</td>
                            <td className="p-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                rule.rule_status === "PASS"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                              }`}>
                                {rule.rule_status}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700">{rule.rule_value || "-"}</td>
                            <td className="p-2.5 text-slate-500">{rule.expected_value || "-"}</td>
                            <td className="p-2.5 text-slate-600">{rule.remarks || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No BRE execution records found.</p>
                )}
              </div>

              {/* Multi-Level Approval Chain Section */}
              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Multi-Level Approval Hierarchy</h3>
                    <p className="text-xs text-slate-500">Level 1 Assistant Manager → Level 2 Manager → (Level 4 DGM if deviation) → Level 3 AGM</p>
                  </div>
                  {isBankUser && (dsa.onboarding_status === "SUBMITTED" || dsa.onboarding_status === "PENDING_APPROVAL" || dsa.onboarding_status === "DOCUMENT_VERIFICATION") ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setApprovingDsa(dsa)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                      >
                        Approve Level
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setQueryText("");
                          setQueryError("");
                          setQueryingDsa(dsa);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8"
                      >
                        Raise Query
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRejectingDsa(dsa)}
                        className="bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs h-8"
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>

                {dsa.approvals && dsa.approvals.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {dsa.approvals.map((app) => (
                      <div
                        key={app.id}
                        className={`rounded-lg border p-3.5 space-y-2 ${
                          app.status === "APPROVED"
                            ? "border-emerald-200 bg-emerald-50/30"
                            : app.status === "QUERY"
                            ? "border-amber-200 bg-amber-50/30"
                            : app.status === "REJECTED"
                            ? "border-rose-200 bg-rose-50/30"
                            : "border-slate-200 bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Level {app.approval_level} — {app.assigned_role}
                          </span>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            app.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : app.status === "QUERY"
                              ? "bg-amber-100 text-amber-800"
                              : app.status === "REJECTED"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-200 text-slate-700"
                          }`}>
                            {app.status}
                          </span>
                        </div>
                        {app.remarks ? (
                          <p className="text-xs text-slate-700">
                            <span className="font-semibold">Remarks:</span> {app.remarks}
                          </p>
                        ) : null}
                        {app.query_response ? (
                          <p className="text-xs text-amber-800 bg-amber-100/60 p-2 rounded">
                            <span className="font-semibold">Query Note:</span> {app.query_response}
                          </p>
                        ) : null}
                        {app.action_at ? (
                          <p className="text-[10px] text-slate-400">Actioned at: {formatDate(app.action_at)}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No approval history records available yet.</p>
                )}
              </div>
            </div>
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
                {(dsa.documents || []).map((doc) => (
                  <div className="rounded-lg border border-slate-200 p-4" key={doc.id}>
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{doc.document_type}</p>
                          <p className="text-sm text-slate-500">{doc.file_name}</p>
                        </div>
                        <StatusBadge status={doc.status} />
                      </div>
                      {isBankUser && doc.status !== "Verified" && doc.status !== "Failed" ? (
                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 mt-2">
                          <Button
                            onClick={async () => {
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
                            size="sm"
                            type="button"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-2 py-0.5 h-auto"
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
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(dsa.documents || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No documents uploaded for this partner.</p>
                ) : null}
              </div>

              {missingProfileDocuments.length ? (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Upload Missing Documents</h4>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {missingProfileDocuments.map((document) => {
                      const inputId = `profile-doc-${dsa.id}-${document.key}`;
                      return (
                        <div className="rounded-lg border border-dashed border-sky-100 bg-sky-50/50 p-4 flex items-center justify-between" key={document.key}>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{document.label}</p>
                            <p className="text-xs text-sky-700">Missing - Required document</p>
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
                                    document_type: dsaDocumentType(document.key),
                                    owner_name: dsa.name,
                                  });
                                  await fetchDsaDetail(dsa.id);
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
              {audit.map((item) => (
                <div className="flex gap-3 rounded-md border border-slate-100 p-3" key={item.id}>
                  <FileText className="mt-0.5 h-4 w-4 text-blue-600" />
                  <div>
                    <p className="font-medium text-slate-950">{item.action}</p>
                    <p className="text-sm text-slate-500">{item.actor} · {formatDate(item.at)} · {item.ipAddress}</p>
                  </div>
                </div>
              ))}
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
        description="Confirm this only after KYC, documents, bank details, and business information have been checked."
        onClose={closeDecisionModals}
        open={Boolean(approvingDsa)}
        title="Approve DSA Partner"
        width="max-w-lg"
      >
        {approvingDsa ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">{approvingDsa.name}</p>
              <p className="mt-1 text-xs text-emerald-800">
                Level {dsa.current_approval_level} approval — {approvalLevelLabel(dsa.current_approval_level, dsa.deviation)}. This will advance the DSA to the next review stage.
              </p>
            </div>
            <DetailGrid>
              <DetailItem label="New status" value={<StatusBadge status={nextApprovalStatus ?? approvingDsa.onboarding_status} />} />
              <DetailItem label="Approval rate" value={percent(approvingDsa.approval_rate || 0)} />
              <DetailItem label="Monthly lead target" value={0} />
              <DetailItem label="Commission earned" value={formatCurrency(approvingDsa.commission_earned || 0)} />
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
                  const remarks = `Approved by ${currentUser?.role} (${currentUser?.name})`;
                  const updated = await updateDsaProfile(approvingDsa.id, {
                    action: "APPROVE",
                    remarks,
                  } as any);
                  if (updated) {
                    await fetchDsaDetail(id);
                    toast({
                      title: "Partner Approved",
                      description: `${approvingDsa.name} moved to the next stage.`,
                      variant: "success",
                    });
                    closeDecisionModals();
                  }
                }}
              >
                {actionLoading ? "Processing..." : approvalLevelLabel(dsa.current_approval_level, dsa.deviation)}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal onClose={closeDecisionModals} open={Boolean(queryingDsa)} title="Raise Query for DSA Partner" width="max-w-lg">
        <div className="space-y-4">
          <Field>
            <Label htmlFor="profileQueryText">Query details</Label>
            <textarea
              id="profileQueryText"
              rows={3}
              className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={queryText}
              onChange={(event) => {
                setQueryText(event.target.value);
                setQueryError("");
              }}
              placeholder="Enter query details (e.g. Please re-upload clearer GST registration copy)"
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
                  if (!queryText.trim()) {
                    setQueryError("Enter query text before submitting.");
                    return;
                  }
                  const updated = await updateDsaProfile(queryingDsa.id, {
                    action: "QUERY",
                    query: queryText.trim(),
                  } as any);
                  if (updated) {
                    await fetchDsaDetail(id);
                    toast({
                      title: "Query Raised",
                      description: `Query sent for ${queryingDsa.name}.`,
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
    </div>
  );
}
