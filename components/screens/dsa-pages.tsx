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
} from "lucide-react";
import { useEffect, useState } from "react";

import { KpiCard } from "@/components/charts";
import { ActionPair, DetailGrid, DetailItem, PageHeader } from "@/components/module";
import { Column, DataTable } from "@/components/ui/data-table";
import {
  Badge,
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
import { demoAgentName } from "@/lib/agent-names";
import { useMockStore } from "@/lib/store";
import { BusinessType, DocumentType, Dsa, DsaStatus, Product } from "@/lib/types";
import { formatCurrency, formatDate, makeId, percent } from "@/lib/utils";

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

const dsaStatuses: DsaStatus[] = [
  "Draft",
  "Submitted",
  "KYC Pending",
  "Active",
  "Suspended",
  "Rejected",
];

const queueStatuses: DsaStatus[] = ["Submitted", "KYC Pending"];
const managementStatuses: DsaStatus[] = ["Active", "Suspended"];

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
  { label: "Status", name: "status", options: dsaStatuses, required: true, type: "select" },
  { label: "Manager", name: "manager", required: true },
];

const initialOnboardingForm = {
  accountName: "",
  accountNumber: "",
  address: "",
  bankName: "",
  businessType: "Private Limited",
  city: "",
  code: "",
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
  return Math.min(Math.max(value, 0), 5);
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
  const { createItem, currentUser } = useMockStore();
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
      1: ["code", "name", "businessType", "contactPerson", "mobile", "email"],
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
  }

  function handleSubmit() {
    const id = makeId("dsa");
    const documentsList = Object.entries(uploadedFiles).map(([key, file]) => {
      let docType: DocumentType = "Photograph";
      if (key.toLowerCase().includes("pan")) docType = "PAN";
      else if (key.toLowerCase().includes("aadhaar")) docType = "Aadhaar";
      else if (key.toLowerCase().includes("bank")) docType = "Bank Statement";

      return {
        id: makeId("doc"),
        documentId: `DOC-${Math.floor(10000 + Math.random() * 90000)}`,
        ownerName: form.name,
        type: docType,
        fileName: file.name,
        size: file.size,
        status: "Pending" as const,
        uploadedAt: new Date().toISOString(),
        remarks: "Uploaded via onboarding portal",
      };
    });

    if (documentsList.length === 0) {
      documentsList.push({
        id: makeId("doc"),
        documentId: "DOC-99001",
        ownerName: form.name,
        type: "PAN",
        fileName: "dsa-pan-card.png",
        size: "148 KB",
        status: "Pending",
        uploadedAt: new Date().toISOString(),
        remarks: "Uploaded via onboarding portal",
      });
    }

    const managerName = currentUser?.role === "DSA Partner" ? currentUser.name : DEMO_USERS.admin.name;

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
      code: form.code || `DSA-${Date.now().toString().slice(-4)}`,
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
      onboardingDate: new Date().toISOString(),
      pan: form.pan,
      pincode: form.pincode,
      riskRating: "Low",
      state: form.state,
      status: "Submitted",
      tier: "Bronze",
    });
    setStep(5);
  }

  function resetOnboarding() {
    setErrors({});
    setForm({ ...initialOnboardingForm });
    setDsaType("Independent DSA");
    setUploadedFiles({});
    setStep(0);
    localStorage.removeItem(DSA_ONBOARDING_DRAFT_KEY);
  }

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
      <div
        key={key}
        className={`flex items-center justify-between rounded-xl border border-dashed p-4 transition-all duration-200 ${
          file
            ? "border-emerald-300 bg-emerald-50/20"
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
          {step > 0 && step < 5 ? (
            <div className="mb-8 flex items-center justify-between max-w-xl mx-auto px-4">
              {[1, 2, 3, 4].map((i) => (
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
                      {["Profile", "KYC", "Bank", "Docs"][i - 1]}
                    </span>
                  </div>
                  {i < 4 && (
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
                  {renderField("code", "DSA code")}
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
                  {renderField("pan", "PAN")}
                  {renderField("gst", "GST")}
                  <div className="md:col-span-2">{renderField("address", "Address")}</div>
                  {renderField("city", "City")}
                  {renderField("state", "State")}
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
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">
                    Upload Applicant Documents
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3 mt-4">
                    {renderUploadSlot("applicantPan", "Applicant PAN Card")}
                    {renderUploadSlot("aadhaarFront", "Applicant Aadhaar (Front)")}
                    {renderUploadSlot("aadhaarBack", "Applicant Aadhaar (Back)")}
                  </div>
                </div>

                <div className="pt-4">
                  <h3 className="text-sm font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">
                    Upload Company Documents
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3 mt-4">
                    {renderUploadSlot("companyPan", "Company PAN Card")}
                    {renderUploadSlot("bankProof", "Bank Account Proof")}
                    {renderUploadSlot("mouDoc", "MOU Document")}
                    {renderUploadSlot("empanelmentLetter", "Empanelment Letter")}
                    {renderUploadSlot("gstin", "GSTIN")}
                    {renderUploadSlot("others", "Others")}
                  </div>
                </div>

                <div className="mt-10 flex flex-col items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    className="bg-blue-700 hover:bg-blue-800 text-white font-bold h-11 px-12 rounded-lg shadow-sm"
                  >
                    Submit
                  </Button>
                  <button
                    type="button"
                    onClick={() => goBack(4)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline mt-2"
                  >
                    Go back to Bank Details
                  </button>
                </div>
              </div>
            ) : null}

            {/* Step 5: Submitted Success Receipt */}
            {step === 5 ? (
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
                    This application is now waiting in Dashboard &gt; Verification Queue for final approval.
                  </p>
                </div>

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
            {step > 0 && step < 4 ? (
              <div className="mt-8 flex justify-between border-t border-slate-100 pt-5">
                <Button
                  onClick={() => goBack(step)}
                  type="button"
                  variant="secondary"
                  className="h-10 px-5"
                >
                  Back
                </Button>
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
    </div>
  );
}

export function DsaManagementPage() {
  const { deleteItem, store, updateItem, currentUser } = useMockStore();
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Dsa | null>(null);
  const [editing, setEditing] = useState<Dsa | null>(null);

  const getDsaApplications = (dsaId: string) =>
    store.applications
      .filter((application) => application.dsaId === dsaId)
      .sort((left, right) => left.product.localeCompare(right.product) || left.applicationId.localeCompare(right.applicationId));

  let rows = store.dsas.filter((item) => managementStatuses.includes(item.status));
  if (status) rows = rows.filter((item) => item.status === status);
  if (currentUser?.role === "DSA Partner") {
    rows = rows.filter((item) => item.manager === currentUser.name);
  }

  const columns: Column<Dsa>[] = [
    {
      cell: (item) => (
        <div>
          <Link className="font-semibold text-blue-700 hover:underline" href={`/dsa/${item.id}`}>
            {currentUser?.role === "DSA Partner" ? demoAgentName(item.id) : item.name}
          </Link>
          <p className="text-xs text-slate-500">{item.code}</p>
        </div>
      ),
      header: "Partner",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    { cell: (item) => item.businessType, header: "Business type", key: "businessType" },
    { cell: (item) => item.city, header: "City", key: "city", sortable: true, sortValue: (item) => item.city },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    {
      cell: (item) => getDsaApplications(item.id).length,
      header: "Applications",
      key: "applications",
      sortable: true,
      sortValue: (item) => getDsaApplications(item.id).length,
    },
    { cell: (item) => <Badge>{item.tier}</Badge>, header: "Tier", key: "tier" },
    { cell: (item) => percent(item.approvalRate), header: "Approval", key: "approvalRate", sortable: true, sortValue: (item) => item.approvalRate },
  ];

  return (
    <div>
      <PageHeader
        description="Manage partner records, commercial readiness, KYC status, risk posture, and activation lifecycle."
        eyebrow="Partner network"
        title="DSA Management"
      />
      <DataTable
        actions={(item) => (
          <ActionPair
            onDelete={() => deleteItem("dsas", item.id)}
            onEdit={() => setEditing(item)}
            onView={() => setSelected(item)}
          />
        )}
        columns={columns}
        emptyDescription="Approved DSAs appear here after verification. Change filters if you are looking for an existing partner."
        filters={[{ label: "status", onChange: setStatus, options: managementStatuses, value: status }]}
        items={rows}
        searchKeys={["name", "code", "pan", "mobile", "email", "city"]}
      />

      <Drawer
        description={selected ? `${selected.code} · ${selected.city}, ${selected.state}` : undefined}
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={selected ? (currentUser?.role === "DSA Partner" ? demoAgentName(selected.id) : selected.name) : "DSA"}
      >
        {selected ? (
          <div className="space-y-5">
            <DetailGrid>
              <DetailItem label="PAN" value={selected.pan} />
              <DetailItem label="GST" value={selected.gst} />
              <DetailItem label="Contact" value={`${selected.contactPerson} · ${selected.mobile}`} />
              <DetailItem label="Email" value={selected.email} />
              <DetailItem label="Status" value={<StatusBadge status={selected.status} />} />
              <DetailItem label="Onboarded" value={formatDate(selected.onboardingDate)} />
              <DetailItem label="Monthly leads" value={selected.monthlyLeads} />
              <DetailItem label="Applications" value={getDsaApplications(selected.id).length} />
            </DetailGrid>
            {isQueueStatus(selected.status) ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs font-medium text-blue-800">
                This partner is still in Dashboard &gt; Verification Queue. Open the full profile from the queue to approve or reject after review.
              </div>
            ) : null}
            <Link href={`/dsa/${selected.id}`}>
              <Button className="w-full" type="button">
                Open full profile
              </Button>
            </Link>
          </div>
        ) : null}
      </Drawer>

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
  const { deleteItem, store, updateItem, currentUser } = useMockStore();
  const { toast } = useToast();
  const [tab, setTab] = useState("overview");
  const [applicationProductFilter, setApplicationProductFilter] = useState("");
  const [approvingDsa, setApprovingDsa] = useState<Dsa | null>(null);
  const [rejectingDsa, setRejectingDsa] = useState<Dsa | null>(null);
  const [rejectionError, setRejectionError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const dsa = store.dsas.find((item) => item.id === id) ?? store.dsas[0];
  const canDecideDsa = currentUser?.role === "DSA Manager" && isQueueStatus(dsa.status);
  const productConfigs = store.dsaProductConfigs
    .filter((config) => config.dsaId === dsa.id && config.status === "Active")
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

  const commissionTotal = commissions.reduce((sum, item) => sum + item.payout, 0);
  const approvedApplications = applications.filter(
    (item) => item.status === "Approved" || item.status === "Disbursed",
  ).length;

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
                  onClick={() => setApprovingDsa(dsa)}
                  size="sm"
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
          </div>
        }
        description={`${dsa.code} · ${dsa.businessType} · managed by ${dsa.manager}`}
        eyebrow="DSA profile"
        title={dsa.name}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard change="+6.2%" icon={TrendingUp} label="Approval rate" tone="green" value={percent(dsa.approvalRate)} />
        <KpiCard change="+11.0%" icon={ClipboardList} label="Monthly leads" value={String(dsa.monthlyLeads)} />
        <KpiCard change="+8.4%" icon={BadgeIndianRupee} label="Commission" tone="slate" value={formatCurrency(commissionTotal || dsa.commissionEarned)} />
        <KpiCard change="-1.8%" icon={ShieldCheck} label="Risk rating" tone="amber" value={dsa.riskRating} />
      </div>

      <div className="mt-6">
        <Tabs
          onChange={setTab}
          tabs={[
            { label: "Basic Info", value: "overview" },
            { label: "KYC", value: "kyc" },
            { label: "Documents", value: "documents" },
            { label: "Performance Metrics", value: "performance" },
            { label: "Products", value: "products" },
            { label: "Applications", value: "apps" },
            { label: "Commission", value: "commission" },
            { label: "Audit Timeline", value: "audit" },
          ]}
          value={tab}
        />
      </div>

      <Card className="mt-4">
        <CardContent>
          {tab === "overview" ? (
            <DetailGrid>
              <DetailItem label="Contact person" value={dsa.contactPerson} />
              <DetailItem label="Mobile" value={dsa.mobile} />
              <DetailItem label="Email" value={dsa.email} />
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
              <DetailItem label="Risk rating" value={<StatusBadge status={dsa.riskRating} />} />
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
            <DetailGrid>
              <DetailItem label="Leads sourced" value={leads.length} />
              <DetailItem label="Applications sourced" value={applications.length} />
              <DetailItem label="Approved or disbursed" value={approvedApplications} />
              <DetailItem label="Approval rate" value={percent(dsa.approvalRate)} />
              <DetailItem label="Monthly lead target" value={dsa.monthlyLeads} />
              <DetailItem label="Commission earned" value={formatCurrency(commissionTotal || dsa.commissionEarned)} />
            </DetailGrid>
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
    </div>
  );
}
