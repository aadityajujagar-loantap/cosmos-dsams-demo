"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Check,
  ClipboardList,
  Download,
  FileText,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  BarChart3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BarChartCard, KpiCard, TrendCard } from "@/components/charts";
import { ActionPair, DetailGrid, DetailItem, PageHeader } from "@/components/module";
import { OnHoldDsaDocuments } from "@/components/screens/on-hold-dsa-documents";
import { Column, DataTable } from "@/components/ui/data-table";
import {
  Button,
  Card,
  CardContent,
  Drawer,
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
import {
  dsaDocumentType,
  isMissingDsaDocumentRecord,
  requiredDsaDocumentGroups,
  requiredDsaDocuments,
} from "@/lib/dsa-documents";
import { demoAgentName } from "@/lib/agent-names";
import { useMockStore } from "@/lib/store";
import { BusinessType, Dsa, DsaStatus, Product } from "@/lib/types";
import { formatCurrency, formatDate, generateDsaId, makeId, percent } from "@/lib/utils";

type DsaType = "Independent DSA" | "Exclusive DSA" | "Corporate DSA";
type UploadedFileMeta = { name: string; size: string };

interface OnboardingDraft {
  dsaType: DsaType;
  form: typeof initialOnboardingForm;
  step: number;
  uploadedFiles: Record<string, UploadedFileMeta>;
}

const businessTypes: BusinessType[] = [
  "Sole Proprietor",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
];

// India states and their major cities for onboarding dropdowns
const INDIA_STATES_CITIES: Record<string, string[]> = {
  "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Tirupati"],
  "Delhi": ["New Delhi", "Dwarka", "Rohini", "Lajpat Nagar"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"],
  "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur"],
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane"],
  "Punjab": ["Amritsar", "Ludhiana", "Jalandhar", "Patiala"],
  "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Noida"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri"],
};

const INDIA_STATES = Object.keys(INDIA_STATES_CITIES).sort();

const dsaStatuses: DsaStatus[] = [
  "Draft",
  "Submitted",
  "Pending Credit Approval",
  "KYC Pending",
  "On Hold",
  "Active",
  "Suspended",
  "Rejected",
  "Blacklisted",
];

const queueStatuses: DsaStatus[] = ["Submitted", "KYC Pending", "Pending Credit Approval", "On Hold"];
const managementStatuses: DsaStatus[] = [
  "Draft",
  "Submitted",
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
};

function isQueueStatus(status: DsaStatus) {
  return queueStatuses.includes(status);
}

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

export function DsaOnboardingPage() {
  const { createItem, currentUser, store } = useMockStore();
  const isBranchOnboarding = currentUser?.role === "Branch User";
  const [initialDraft] = useState(() => readOnboardingDraft());
  const [step, setStep] = useState(() => clampOnboardingStep(initialDraft.step));
  const [dsaType, setDsaType] = useState<DsaType>(() =>
    isDsaType(initialDraft.dsaType) ? initialDraft.dsaType : "Independent DSA",
  );
  const [form, setForm] = useState(() => ({ ...initialOnboardingForm, ...initialDraft.form }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFileMeta>>(
    () => initialDraft.uploadedFiles ?? {},
  );
  const [isPanVerifying, setIsPanVerifying] = useState(false);
  const [isPanVerified, setIsPanVerified] = useState(false);
  const [isAbortModalOpen, setIsAbortModalOpen] = useState(false);
  const [submittedDsaId, setSubmittedDsaId] = useState("");
  const missingRequiredDocuments = requiredDsaDocuments.filter((document) => !uploadedFiles[document.key]);

  useEffect(() => {
    const draft: OnboardingDraft = { dsaType, form, step, uploadedFiles };
    localStorage.setItem(DSA_ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  }, [dsaType, form, step, uploadedFiles]);

  if (currentUser?.role === "DSA Partner") {
    return (
      <EmptyState
        description="DSA admins cannot onboard partners. Use Sell Now to fill or send configured product journeys for customers."
        title="DSA onboarding is restricted"
      />
    );
  }

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(currentStep: number) {
    const requiredByStep: Record<number, string[]> = {
      1: ["name", "businessType", "contactPerson", "mobile", "email"],
      2: ["pan", "gst", "address", "city", "state", "pincode"],
      3: ["accountName", "accountNumber", "bankName", "ifsc"],
    };
    const nextErrors: Record<string, string> = {};
    const required = requiredByStep[currentStep] ?? [];
    required.forEach((field) => {
      if (!form[field as keyof typeof form]) nextErrors[field] = "Required";
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
      if (form.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan)) {
        nextErrors.pan = "PAN format should be ABCDE1234F";
      } else if (form.pan && !isPanVerified) {
        nextErrors.pan = "Please verify your PAN";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goNext(currentStep: number) {
    if (currentStep > 0 && currentStep < 4 && !validate(currentStep)) return;
    setErrors({});
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

  function handleSubmit() {
    const id = generateDsaId(store.dsas.map((dsa) => dsa.id));
    const submittedAt = new Date().toISOString();
    const hasMissingDocuments = missingRequiredDocuments.length > 0;
    const documentsList = requiredDsaDocuments.map((document) => {
      const file = uploadedFiles[document.key];

      return {
        id: makeId("doc"),
        documentId: `DOC-${Math.floor(10000 + Math.random() * 90000)}`,
        ownerName: form.name,
        type: dsaDocumentType(document.key),
        fileName: file?.name ?? `Missing - ${document.label}`,
        size: file?.size ?? "0 KB",
        status: "Pending" as const,
        uploadedAt: submittedAt,
        remarks: file
          ? "Uploaded via onboarding portal"
          : "Mandatory document missing during onboarding; DSA held before approval.",
      };
    });

    const managerName =
      currentUser?.role === "DSA Partner" || currentUser?.role === "Branch User"
        ? currentUser.name
        : DEMO_USERS.admin.name;

    createItem("dsas", {
      address: form.address,
      approvalRate: 0,
      bank: {
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        bankName: form.bankName,
        ifsc: form.ifsc,
      },
      businessType: form.businessType as BusinessType,
      city: form.city,
      code: id,
      commissionEarned: 0,
      contactPerson: form.contactPerson,
      documents: documentsList,
      email: form.email,
      gst: form.gst,
      id,
      manager: managerName,
      mobile: form.mobile,
      monthlyLeads: 0,
      name: form.name,
      onboardingDate: submittedAt,
      pan: form.pan,
      pincode: form.pincode,
      riskRating: "Low",
      state: form.state,
      status: hasMissingDocuments ? "On Hold" : isBranchOnboarding ? "Pending Credit Approval" : "Submitted",
      tier: "Bronze",
    });
    setSubmittedDsaId(id);
    setStep(6);
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
    setStep(0);
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
        <Input id={key} onChange={(event) => update(key, event.target.value)} type={props?.type ?? "text"} value={form[key]} />
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
                        value={form.pan}
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
                      value={form.state}
                      onChange={(e) => {
                        update("state", e.target.value);
                        update("city", "");
                      }}
                    >
                      <option value="">Select state</option>
                      {INDIA_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                    {errors.state ? <p className="text-xs font-medium text-rose-600 mt-1">{errors.state}</p> : null}
                  </Field>
                  <Field>
                    <Label htmlFor="citySelect">City</Label>
                    <Select
                      id="citySelect"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                      disabled={!form.state}
                    >
                      <option value="">{form.state ? "Select city" : "Select state first"}</option>
                      {(INDIA_STATES_CITIES[form.state] ?? []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                    {errors.city ? <p className="text-xs font-medium text-rose-600 mt-1">{errors.city}</p> : null}
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
                    <p className="font-semibold">Missing documents will move this DSA to On Hold.</p>
                    <p className="mt-1 text-xs text-blue-800">
                      DSA Credit, Branch User, or Super Admin can upload the remaining documents from the on-hold list before approval.
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
                      : isBranchOnboarding
                      ? "This application is now waiting with DSA Credit for approval. Track the status from DSA Management."
                      : "This application is now waiting in Dashboard > Verification Queue for final approval."}
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
                    <Link href="/dsa/management" className="flex-1">
                      <Button type="button" className="w-full text-xs">
                        View DSA list
                      </Button>
                    </Link>
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
            <Button onClick={resetOnboarding} type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Remove and Activate
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
  const { store, updateItem, currentUser } = useMockStore();
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Dsa | null>(null);
  const [managementTab, setManagementTab] = useState("all");
  const router = useRouter();
  const isNetworkPage = currentUser?.role === "DSA Partner";
  const networkEmail = currentUser?.email ?? DEMO_USERS.dsa.email;

  const getDsaApplications = (dsaId: string) =>
    store.applications
      .filter((application) => application.dsaId === dsaId)
      .sort((left, right) => left.product.localeCompare(right.product) || left.applicationId.localeCompare(right.applicationId));

  let scopedRows = store.dsas.filter((item) => managementStatuses.includes(item.status));
  if (currentUser?.role === "DSA Partner" || currentUser?.role === "Branch User") {
    scopedRows = scopedRows.filter((item) => item.manager === currentUser.name);
  }
  const onHoldRows = scopedRows
    .filter((item) => item.status === "On Hold")
    .sort((left, right) => right.onboardingDate.localeCompare(left.onboardingDate));
  const rows = status ? scopedRows.filter((item) => item.status === status) : scopedRows;

  const networkRows: NetworkPersonRow[] = scopedRows
    .map((item) => {
      const leads = store.leads.filter((lead) => lead.dsaId === item.id);
      const applications = getDsaApplications(item.id);
      const approvedOrDisbursed = applications.filter(
        (application) => application.status === "Approved" || application.status === "Disbursed",
      ).length;
      const disbursed = applications.filter((application) => application.status === "Disbursed").length;

      return {
        applications: applications.length,
        approvedOrDisbursed,
        conversion: applications.length ? (approvedOrDisbursed / applications.length) * 100 : 0,
        disbursed,
        email: networkEmail,
        id: item.id,
        leads: leads.length,
        name: demoAgentName(item.id),
      };
    })
    .sort((left, right) => right.applications - left.applications || right.leads - left.leads || left.name.localeCompare(right.name));

  const networkColumns: Column<NetworkPersonRow>[] = [
    {
      cell: (item) => (
        <Link className="font-semibold text-blue-700 hover:underline" href={`/dsa/${item.id}`}>
          {item.name}
        </Link>
      ),
      header: "Partner",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    { cell: (item) => item.email, header: "Email", key: "email", sortable: true, sortValue: (item) => item.email },
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

  if (isNetworkPage) {
    return (
      <div>
        <PageHeader
          description="Partner activity, lead collection, and application sourcing across your network."
          eyebrow="Network"
          title="Manage My Network"
        />
        <DataTable
          actions={(item) => (
            <Button onClick={() => router.push(`/dsa/${item.id}`)} size="sm" type="button" variant="outline">
              View
            </Button>
          )}
          columns={networkColumns}
          emptyDescription="Partner activity will appear here once leads or applications are collected."
          emptyTitle="No partners found"
          items={networkRows}
          searchKeys={["name", "email"]}
        />
      </div>
    );
  }

  const columns: Column<Dsa>[] = [
    {
      cell: (item) => (
        <Link className="font-semibold text-blue-700 hover:underline" href={`/dsa/${item.id}`}>
          {item.name}
        </Link>
      ),
      header: "Partner",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    {
      cell: (item) => <span className="font-mono text-xs text-slate-600">{item.code}</span>,
      header: "DSA ID",
      key: "code",
      sortable: true,
      sortValue: (item) => item.code,
    },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    {
      cell: (item) => store.leads.filter((lead) => lead.dsaId === item.id).length,
      header: "Leads",
      key: "leads",
      sortable: true,
      sortValue: (item) => store.leads.filter((lead) => lead.dsaId === item.id).length,
    },
    {
      cell: (item) => getDsaApplications(item.id).length,
      header: "Applications",
      key: "applications",
      sortable: true,
      sortValue: (item) => getDsaApplications(item.id).length,
    },
    { cell: (item) => percent(item.approvalRate), header: "Approval", key: "approvalRate", sortable: true, sortValue: (item) => item.approvalRate },
  ];

  return (
    <div>
      <div className="mb-5">
        <Tabs
          onChange={setManagementTab}
          tabs={[
            { label: "All DSAs", value: "all" },
            { label: `On Hold (${onHoldRows.length})`, value: "onHold" },
          ]}
          value={managementTab}
        />
      </div>
      {managementTab === "onHold" ? (
        <OnHoldDsaDocuments
          description="Upload remaining mandatory documents here. A DSA stays On Hold until every missing document is uploaded."
          dsas={onHoldRows}
        />
      ) : (
        <DataTable
          actions={(item) => (
            <div className="flex justify-end gap-2">
              <Button onClick={() => router.push(`/dsa/${item.id}`)} size="sm" type="button" variant="outline">
                View
              </Button>
              <Button onClick={() => setEditing(item)} size="sm" type="button" variant="secondary">
                Edit
              </Button>
            </div>
          )}
          columns={columns}
          emptyDescription="Approved DSAs appear here after verification. Change filters if you are looking for an existing partner."
          filters={[{ label: "status", onChange: setStatus, options: managementStatuses, value: status }]}
          items={rows}
          searchKeys={["name", "code", "pan", "mobile", "email", "city"]}
        />
      )}

      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit DSA">
        {editing ? (
          <RecordForm<Dsa>
            fields={dsaFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("dsas", editing.id, value);
              setEditing(null);
            }}
            submitLabel="Save DSA"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function DsaProfilePage({ id }: { id: string }) {
  const { deleteDsaCascade, deleteItem, store, updateItem, currentUser } = useMockStore();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState("performance");
  const [applicationProductFilter, setApplicationProductFilter] = useState("");
  const [approvingDsa, setApprovingDsa] = useState<Dsa | null>(null);
  const [rejectingDsa, setRejectingDsa] = useState<Dsa | null>(null);
  const [rejectionError, setRejectionError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [deactivatingDsa, setDeactivatingDsa] = useState<Dsa | null>(null);
  const [blacklistingDsa, setBlacklistingDsa] = useState<Dsa | null>(null);
  const [activatingDsa, setActivatingDsa] = useState<Dsa | null>(null);
  const [unblacklistingDsa, setUnblacklistingDsa] = useState<Dsa | null>(null);
  const [deletingDsa, setDeletingDsa] = useState<Dsa | null>(null);
  const [viewingLifecycleReason, setViewingLifecycleReason] = useState<Dsa | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [lifecycleReasonError, setLifecycleReasonError] = useState("");

  const dsa = store.dsas.find((item) => item.id === id) ?? store.dsas[0];
  const missingProfileDocuments = dsa.documents.filter(isMissingDsaDocumentRecord);
  const canDecideDsa =
    (currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit") &&
    isQueueStatus(dsa.status);
  const canApproveDsa = canDecideDsa && missingProfileDocuments.length === 0;
  const allProductConfigs = store.dsaProductConfigs.filter((config) => config.dsaId === dsa.id);
  const productConfigs = allProductConfigs
    .filter((config) => config.status === "Active")
    .sort((left, right) => left.product.localeCompare(right.product));
  const configuredProducts = productConfigs.map((config) => config.product);

  const closeDecisionModals = () => {
    setApprovingDsa(null);
    setRejectingDsa(null);
    setRejectionError("");
    setRejectionReason("");
  };

  const applications = store.applications
    .filter((item) => item.dsaId === dsa.id)
    .sort((left, right) => left.product.localeCompare(right.product) || left.applicationId.localeCompare(right.applicationId));
  const effectiveApplicationProductFilter = configuredProducts.includes(applicationProductFilter as Product)
    ? applicationProductFilter
    : "";
  const visibleApplications = effectiveApplicationProductFilter
    ? applications.filter((application) => application.product === effectiveApplicationProductFilter)
    : applications;
  const commissions = store.commissions.filter((item) => item.dsaId === dsa.id);
  const leads = store.leads.filter((item) => item.dsaId === dsa.id);
  const audit = store.auditLogs.slice(0, 8);
  const applicationIds = new Set(applications.map((application) => application.id));
  const applicationCodes = new Set(applications.map((application) => application.applicationId));
  const linkedDocumentCount = store.documents.filter(
    (document) => document.dsaId === dsa.id || applicationIds.has(document.applicationId ?? ""),
  ).length;
  const linkedVerificationCount = store.verificationChecks.filter((check) => applicationCodes.has(check.applicationId)).length;
  const linkedApprovalCount = store.approvals.filter((approval) => applicationCodes.has(approval.applicationId)).length;
  const linkedUserCount = store.users.filter(
    (user) => user.id === dsa.id || user.email === dsa.email || user.name === dsa.name,
  ).length;

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
    (currentUser?.role === "Branch User" && dsa.manager === currentUser.name);
  const canManageDsaLifecycle = canLifecycleRoleManageDsa && ["Active", "Suspended", "Blacklisted"].includes(dsa.status);
  const canViewDsaLifecycleReason = canLifecycleRoleManageDsa;
  const canDeleteDsa = currentUser?.role === "DSA Manager";

  function closeLifecycleModals() {
    setDeactivatingDsa(null);
    setBlacklistingDsa(null);
    setLifecycleReason("");
    setLifecycleReasonError("");
  }

  function openDeactivationModal(nextDsa: Dsa) {
    setLifecycleReason("");
    setLifecycleReasonError("");
    setDeactivatingDsa(nextDsa);
  }

  function openBlacklistModal(nextDsa: Dsa) {
    setLifecycleReason("");
    setLifecycleReasonError("");
    setBlacklistingDsa(nextDsa);
  }

  if (currentUser?.role === "DSA Partner") {
    const networkPartnerName = demoAgentName(dsa.id);
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
              <DetailItem label="Email" value={currentUser?.email ?? DEMO_USERS.dsa.email} />
              <DetailItem label="Conversion" value={percent(conversion)} />
              <DetailItem label="Disbursed applications" value={disbursedApplications} />
              <DetailItem label="Commission earned" value={formatCurrency(commissionTotal || dsa.commissionEarned)} />
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
            <StatusBadge status={dsa.status} />
            {canDecideDsa && (
              <div className="flex gap-2">
                <Button
                  disabled={!canApproveDsa}
                  onClick={() => setApprovingDsa(dsa)}
                  size="sm"
                  title={canApproveDsa ? "Approve DSA" : "Missing mandatory documents"}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 h-auto"
                >
                  Approve
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
                {dsa.status === "Active" && (
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
                {dsa.status === "Suspended" && (
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
                {dsa.status === "Blacklisted" && (
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
        <KpiCard change="+6.2%" icon={TrendingUp} label="Approval rate" tone="green" value={percent(dsa.approvalRate)} />
        <KpiCard change="+11.0%" icon={ClipboardList} label="Applications sourced" value={String(applications.length)} />
        <KpiCard change="+8.4%" icon={BadgeIndianRupee} label="Commission" tone="slate" value={formatCurrency(commissionTotal || dsa.commissionEarned)} />
      </div>

      {missingProfileDocuments.length ? (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">DSA on hold before approval</p>
          <p className="mt-1 text-xs text-blue-800">
            {missingProfileDocuments.length} mandatory document{missingProfileDocuments.length === 1 ? " is" : "s are"} missing. Upload completion is required before activation.
          </p>
        </div>
      ) : null}

      {canViewDsaLifecycleReason && dsa.statusReason ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{dsa.statusReasonAction ?? dsa.status} reason recorded</p>
              <p className="mt-1 text-xs text-amber-800">
                {dsa.statusReasonBy ? `By ${dsa.statusReasonBy}` : "Recorded by internal user"}
                {dsa.statusReasonAt ? ` - ${formatDate(dsa.statusReasonAt)}` : ""}
              </p>
            </div>
            <StatusBadge status={dsa.status} />
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
            { label: "Manage Products", value: "products" },
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
              <DetailItem label="Contact person" value={dsa.contactPerson} />
              <DetailItem label="Mobile" value={dsa.mobile} />
              <DetailItem label="Email" value={currentUser?.email ?? DEMO_USERS.dsa.email} />
              <DetailItem label="Address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
              <DetailItem label="Bank" value={`${dsa.bank.bankName} · ${dsa.bank.ifsc}`} />
              <DetailItem label="Tier" value={dsa.tier} />
            </DetailGrid>
          ) : null}
          {tab === "kyc" ? (
            <DetailGrid>
              <DetailItem label="PAN" value={dsa.pan} />
              <DetailItem label="GST" value={dsa.gst} />
              <DetailItem label="Business type" value={dsa.businessType} />
              <DetailItem label="KYC readiness" value={<StatusBadge status={dsa.status === "KYC Pending" ? "Pending" : "Verified"} />} />
              <DetailItem label="Registered address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
            </DetailGrid>
          ) : null}
          {tab === "documents" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {dsa.documents.map((doc) => (
                <div className="rounded-lg border border-slate-200 p-4" key={doc.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{doc.type}</p>
                      <p className="text-sm text-slate-500">{doc.fileName}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
              ))}
              {dsa.documents.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded for this partner.</p>
              ) : null}
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
                <DetailItem label="Commission earned" value={formatCurrency(commissionTotal || dsa.commissionEarned)} />
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
                {currentUser?.role === "DSA Manager" ? (
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
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No products configured for this DSA yet.</p>
              )}
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
                    toast({
                      title: "Invoice Generated & Sent",
                      description: `Monthly invoice for ${month} (${formatCurrency(total)}) has been generated and dispatched to ${dsa.email}.`,
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
            <DsaRecoveryReports dsaId={dsa.id} />
          ) : null}
        </CardContent>
      </Card>
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
                Approval will move this DSA to DSA Management, remove it from the pending queue, and start platform metrics at zero.
              </p>
            </div>
            <DetailGrid>
              <DetailItem label="New status" value={<StatusBadge status="Active" />} />
              <DetailItem label="Approval rate" value={percent(0)} />
              <DetailItem label="Monthly lead target" value={0} />
              <DetailItem label="Commission earned" value={formatCurrency(0)} />
            </DetailGrid>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={closeDecisionModals}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                type="button"
                onClick={() => {
                  updateItem("dsas", approvingDsa.id, activeDsaPatch(approvingDsa));
                  toast({
                    title: "Partner Approved",
                    description: `${approvingDsa.name} is now active in DSA Management.`,
                    variant: "success",
                  });
                  closeDecisionModals();
                }}
              >
                Approve and Activate
              </Button>
            </div>
          </div>
        ) : null}
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
              onClick={() => {
                if (rejectingDsa) {
                  if (!rejectionReason.trim()) {
                    setRejectionError("Add a reason before rejecting this DSA.");
                    return;
                  }
                  updateItem("dsas", rejectingDsa.id, {
                    status: "Rejected",
                    rejectionReason: rejectionReason.trim(),
                  });
                  toast({
                    title: "Partner Rejected",
                    description: `${rejectingDsa.name} has been rejected and removed from the pending queue.`,
                    variant: "success",
                  });
                  closeDecisionModals();
                }
              }}
            >
              Reject Partner
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={() => setViewingLifecycleReason(null)}
        open={Boolean(viewingLifecycleReason && canViewDsaLifecycleReason)}
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
              onClick={() => {
                if (deactivatingDsa) {
                  const reason = lifecycleReason.trim();
                  if (!reason) {
                    setLifecycleReasonError("Add a reason before deactivating this DSA.");
                    return;
                  }
                  updateItem("dsas", deactivatingDsa.id, {
                    status: "Suspended",
                    statusReason: reason,
                    statusReasonAction: "Deactivated",
                    statusReasonAt: new Date().toISOString(),
                    statusReasonBy: currentUser?.name ?? DEMO_USERS.admin.name,
                  });
                  closeLifecycleModals();
                }
              }}
              type="button"
              variant="danger"
            >
              Deactivate
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
              onClick={() => {
                if (blacklistingDsa) {
                  const reason = lifecycleReason.trim();
                  if (!reason) {
                    setLifecycleReasonError("Add a reason before blacklisting this DSA.");
                    return;
                  }
                  updateItem("dsas", blacklistingDsa.id, {
                    status: "Blacklisted",
                    statusReason: reason,
                    statusReasonAction: "Blacklisted",
                    statusReasonAt: new Date().toISOString(),
                    statusReasonBy: currentUser?.name ?? DEMO_USERS.admin.name,
                  });
                  closeLifecycleModals();
                }
              }}
              type="button"
              variant="danger"
            >
              Blacklist
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
              onClick={() => {
                if (activatingDsa) {
                  updateItem("dsas", activatingDsa.id, {
                    status: "Active",
                    statusReason: undefined,
                    statusReasonAction: undefined,
                    statusReasonAt: undefined,
                    statusReasonBy: undefined,
                  });
                  setActivatingDsa(null);
                }
              }}
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Activate
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
              onClick={() => {
                if (unblacklistingDsa) {
                  updateItem("dsas", unblacklistingDsa.id, {
                    status: "Active",
                    statusReason: undefined,
                    statusReasonAction: undefined,
                    statusReasonAt: undefined,
                    statusReasonBy: undefined,
                  });
                  setUnblacklistingDsa(null);
                }
              }}
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Remove and Activate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
