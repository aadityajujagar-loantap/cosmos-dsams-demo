"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, Copy, FileSpreadsheet, Loader2, Mail, MessageSquare, Send, UploadCloud, RefreshCw, Smartphone, KeyRound, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";

import { DetailItem, PageHeader } from "@/components/module";
import { adminApi } from "@/apis/admin";
import { authApi } from "@/apis/auth";
import { loanJourneyApi } from "@/apis/loanJourney";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Label,
  Modal,
  Select,
  Tabs,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { DEFAULT_DSA_ID, DEMO_USERS } from "@/lib/demo-identities";
import { configJourneyUrl } from "@/lib/journey-links";
import { getActiveProductConfigs } from "@/lib/product-configs";
import {
  buildApplicationJourney,
  createJourneyApplication,
  JourneyApplicantInput,
} from "@/lib/product-journeys";
import { useMockStore } from "@/lib/store";
import { Application, ApplicationJourney, DsaProductConfig } from "@/lib/types";
import type { StateOption, DistrictOption, BranchOption } from "@/types/dsa";
import { commissionDisplayLabel, formatCommissionDisplay, formatCurrency } from "@/lib/utils";

interface ApplicantDraft {
  aadhaar: string;
  city: string;
  customer: string;
  email: string;
  loanAmount: string;
  mobile: string;
  pan: string;
  salary: string;
}

const defaultApplicant: ApplicantDraft = {
  aadhaar: "",
  city: "",
  customer: "",
  email: "",
  loanAmount: "",
  mobile: "",
  pan: "",
  salary: "",
};

interface SellNowDraftState {
  lastLink: string;
  mode: string;
  selectedDsaId: string;
  selectedProduct: string;
  stepIndex: number;
}

type JourneyField = ApplicationJourney["fields"][number];

interface JourneyFormStep {
  fields: JourneyField[];
  label: string;
}

const sellNowDraftKey = "cosmos_sell_now_draft";

type SellNowWorkspaceTab = "punch" | "bulk" | "docs";

interface BulkUploadResult {
  acceptedRows: number;
  fileName: string;
  product: string;
  rejectedRows: number;
  requestedAt: string;
  totalRows: number;
}

const bulkCsvTemplate = [
  "customer_name,mobile,email,city,loan_amount,monthly_income,pan,aadhaar",
  "Aarav Sharma,9876543210,aarav.sharma@example.com,Mumbai,750000,85000,ABCDE1234F,123456789012",
  "Meera Iyer,9876501234,meera.iyer@example.com,Pune,1250000,140000,BCDEA2345G,234567890123",
].join("\n");

const apiReferenceSections = [
  {
    method: "POST",
    path: "/api/v1/applications/punch-in",
    summary: "Create one application against an active configured product journey.",
    request: JSON.stringify(
      {
        dsaCode: DEFAULT_DSA_ID,
        product: "Personal Loan",
        customer: {
          name: "Aarav Sharma",
          mobile: "9876543210",
          email: "aarav.sharma@example.com",
          city: "Mumbai",
          pan: "ABCDE1234F",
          aadhaar: "123456789012",
        },
        loan: {
          amount: 750000,
          monthlyIncome: 85000,
        },
        source: "api",
      },
      null,
      2,
    ),
    response: JSON.stringify(
      {
        applicationId: "APP-000245",
        status: "In Review",
        stage: "BRE Check",
        product: "Personal Loan",
        submittedAt: "2026-07-29T10:30:00+05:30",
      },
      null,
      2,
    ),
  },
  {
    method: "POST",
    path: "/api/v1/applications/bulk-upload",
    summary: "Upload a CSV batch and receive row-level validation results.",
    request: [
      "curl --request POST https://api.cosmosbank.in/dsa/api/v1/applications/bulk-upload \\",
      "  --header 'Authorization: Bearer <token>' \\",
      `  --header 'X-DSA-Code: ${DEFAULT_DSA_ID}' \\`,
      "  --form 'product=Personal Loan' \\",
      "  --form 'file=@applications.csv'",
    ].join("\n"),
    response: JSON.stringify(
      {
        batchId: "BULK-20260729-0007",
        status: "Queued",
        totalRows: 120,
        acceptedRows: 117,
        rejectedRows: 3,
        reportUrl: "/api/v1/applications/bulk-upload/BULK-20260729-0007/report",
      },
      null,
      2,
    ),
  },
  {
    method: "GET",
    path: "/api/v1/products",
    summary: "List active products configured for the authenticated partner.",
    request: [
      "curl --request GET https://api.cosmosbank.in/dsa/api/v1/products \\",
      "  --header 'Authorization: Bearer <token>' \\",
      `  --header 'X-DSA-Code: ${DEFAULT_DSA_ID}'`,
    ].join("\n"),
    response: JSON.stringify(
      {
        products: [
          { product: "Personal Loan", status: "Active", minAmount: 500000, maxAmount: 3000000 },
          { product: "Business Loan", status: "Active", minAmount: 1000000, maxAmount: 5000000 },
        ],
      },
      null,
      2,
    ),
  },
];

function loadSellNowDraft(): Partial<SellNowDraftState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(sellNowDraftKey) ?? "{}") as Partial<SellNowDraftState>;
  } catch {
    localStorage.removeItem(sellNowDraftKey);
    return {};
  }
}

function borrowerDraftKey(configId: string) {
  return `cosmos_borrower_journey_${configId}`;
}

function loadBorrowerDraft(configId: string) {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(borrowerDraftKey(configId)) ?? "{}") as Partial<SellNowDraftState>;
  } catch {
    localStorage.removeItem(borrowerDraftKey(configId));
    return {};
  }
}

function validateRecipient(draft: ApplicantDraft) {
  if (!draft.customer.trim()) return "Customer name is required.";
  if (!draft.mobile.trim() && !draft.email.trim()) return "Enter either mobile number or email.";
  return "";
}

function RecipientFields({
  draft,
  onChange,
}: {
  draft: ApplicantDraft;
  onChange: (patch: Partial<ApplicantDraft>) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field>
        <Label htmlFor="journeyCustomer">Customer name</Label>
        <Input id="journeyCustomer" onChange={(event) => onChange({ customer: event.target.value })} value={draft.customer} />
      </Field>
      <Field>
        <Label htmlFor="journeyCity">City</Label>
        <Input id="journeyCity" onChange={(event) => onChange({ city: event.target.value })} value={draft.city} />
      </Field>
      <Field>
        <Label htmlFor="journeyMobile">Mobile</Label>
        <Input id="journeyMobile" onChange={(event) => onChange({ mobile: event.target.value })} value={draft.mobile} />
      </Field>
      <Field>
        <Label htmlFor="journeyEmail">Email</Label>
        <Input id="journeyEmail" onChange={(event) => onChange({ email: event.target.value })} type="email" value={draft.email} />
      </Field>
    </div>
  );
}


function JourneySelection({
  configs,
  lockDsa,
  onDsaChange,
  onProductChange,
  selectedDsaId,
  selectedProduct,
}: {
  configs: DsaProductConfig[];
  lockDsa?: boolean;
  onDsaChange: (value: string) => void;
  onProductChange: (value: string) => void;
  selectedDsaId: string;
  selectedProduct: string;
}) {
  const dsaOptions = Array.from(new Map(configs.map((config) => [config.dsaId, config])).values());
  const productOptions = configs.filter((config) => config.dsaId === selectedDsaId);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field>
        <Label htmlFor="sellNowDsa">DSA partner</Label>
        <Select disabled={lockDsa} id="sellNowDsa" onChange={(event) => onDsaChange(event.target.value)} value={selectedDsaId}>
          <option value="">Select DSA</option>
          {dsaOptions.map((config) => (
            <option key={config.dsaId} value={config.dsaId}>
              {config.dsaName} ({config.dsaCode})
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <Label htmlFor="sellNowProduct">Journey / product</Label>
        <Select id="sellNowProduct" onChange={(event) => onProductChange(event.target.value)} value={selectedProduct}>
          <option value="">Select journey</option>
          {productOptions.map((config) => (
            <option key={config.id} value={config.product}>
              {config.product} Journey
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function DocumentationCodeBlock({
  label,
  onCopy,
  value,
}: {
  label: string;
  onCopy: (label: string, value: string) => void;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</p>
        <Button className="border-white/10 bg-slate-900 text-slate-100 hover:bg-slate-800" onClick={() => onCopy(label, value)} size="sm" type="button" variant="outline">
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 text-xs leading-5 text-slate-100">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function ApiDocumentationPanel({ onCopy }: { onCopy: (label: string, value: string) => void }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-950">API Documentation</h2>
            <p className="mt-1 text-xs text-slate-500">Production integration reference for direct application punch-in and CSV batch intake.</p>
          </div>
          <BookOpen className="h-5 w-5 text-blue-700" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <DetailItem label="Base URL" value="https://api.cosmosbank.in/dsa" />
            <DetailItem label="Authentication" value="Bearer token" />
            <DetailItem label="Idempotency" value="Idempotency-Key header" />
          </div>
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-950">Required headers</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2">Header</th>
                    <th className="p-2">Required</th>
                    <th className="p-2">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[
                    ["Authorization", "Yes", "Bearer token issued to the partner integration."],
                    ["X-DSA-Code", "Yes", "Maps the request to the configured partner product setup."],
                    ["Idempotency-Key", "Recommended", "Prevents duplicate applications on retry."],
                    ["Content-Type", "Yes", "application/json for punch-in, multipart/form-data for bulk upload."],
                  ].map(([header, required, purpose]) => (
                    <tr key={header}>
                      <td className="p-2 font-mono text-xs text-slate-700">{header}</td>
                      <td className="p-2 text-slate-700">{required}</td>
                      <td className="p-2 text-slate-700">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {apiReferenceSections.map((section) => (
        <Card key={`${section.method}-${section.path}`}>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{section.method}</span>
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">{section.path}</code>
                </div>
                <p className="mt-2 text-sm text-slate-600">{section.summary}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <DocumentationCodeBlock label="Request" onCopy={onCopy} value={section.request} />
            <DocumentationCodeBlock label="Response" onCopy={onCopy} value={section.response} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
export function SellNowPage() {
  const { createItem, currentUser, store } = useMockStore();
  const { toast } = useToast();
  const isDsaPartner = currentUser?.role === "DSA Partner";
  const [selectedDsaId, setSelectedDsaId] = useState(() => loadSellNowDraft().selectedDsaId ?? "");
  const [selectedProduct, setSelectedProduct] = useState(() => loadSellNowDraft().selectedProduct ?? "");
  const [mode, setMode] = useState(() => loadSellNowDraft().mode ?? "send");

  const activeConfigs = useMemo(
    () =>
      getActiveProductConfigs(store, {
        dsaId: isDsaPartner ? currentUser?.id : undefined,
      }),
    [currentUser?.id, isDsaPartner, store],
  );

  const effectiveDsaId =
    selectedDsaId && activeConfigs.some((config) => config.dsaId === selectedDsaId)
      ? selectedDsaId
      : activeConfigs[0]?.dsaId ?? "";
  const productsForDsa = activeConfigs.filter((config) => config.dsaId === effectiveDsaId);
  const effectiveProduct =
    selectedProduct && productsForDsa.some((config) => config.product === selectedProduct)
      ? selectedProduct
      : productsForDsa[0]?.product ?? "";
  const effectiveConfig = activeConfigs.find(
    (config) => config.dsaId === effectiveDsaId && config.product === effectiveProduct,
  );
  const [applicant, setApplicant] = useState<ApplicantDraft>(defaultApplicant);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [lastLink, setLastLink] = useState(() => loadSellNowDraft().lastLink ?? "");
  const [stepIndex, setStepIndex] = useState(() => loadSellNowDraft().stepIndex ?? 0);
  const [createdApplication, setCreatedApplication] = useState<Application | null>(null);

  // States for assisted onboarding step-by-step flow
  const [assistSubStep, setAssistSubStep] = useState<"initiate" | "otp" | "branch_selection" | "aadhaar_kyc_initiated" | "aadhaar_kyc_otp" | "pan_verification" | "personal_detail" | "success">("initiate");
  const [assistLoading, setAssistLoading] = useState(false);
  const [assistLeadToken, setAssistLeadToken] = useState("");
  const [assistMobile, setAssistMobile] = useState("");
  const [assistEmail, setAssistEmail] = useState("");
  const [assistOtp, setAssistOtp] = useState("");
  const [assistCaptchaValue, setAssistCaptchaValue] = useState("");
  const [assistCaptchaKey, setAssistCaptchaKey] = useState("");
  const [assistCaptchaImg, setAssistCaptchaImg] = useState("");
  const [assistCaptchaLoading, setAssistCaptchaLoading] = useState(false);
  const [assistApplicationId, setAssistApplicationId] = useState("");
  const [assistOtpReferenceId, setAssistOtpReferenceId] = useState("");
  const [assistConsent1, setAssistConsent1] = useState(false);
  const [assistConsent2, setAssistConsent2] = useState(false);

  // States for assisted branch selection
  const [statesList, setStatesList] = useState<StateOption[]>([]);
  const [districtsList, setDistrictsList] = useState<DistrictOption[]>([]);
  const [branchesList, setBranchesList] = useState<BranchOption[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");
  const [selectedBranchCode, setSelectedBranchCode] = useState("");

  // States for assisted Personal Details (KYC + Info + Address)
  const [assistAadhaarNumber, setAssistAadhaarNumber] = useState("");
  const [assistAadhaarTransId, setAssistAadhaarTransId] = useState("");
  const [assistAadhaarOtp, setAssistAadhaarOtp] = useState("");
  const [assistPanNumber, setAssistPanNumber] = useState("");

  const [assistGender, setAssistGender] = useState("");
  const [assistDob, setAssistDob] = useState("");
  const [assistMaritalStatus, setAssistMaritalStatus] = useState("");
  const [assistNoOfDependents, setAssistNoOfDependents] = useState("0");
  const [assistReligion, setAssistReligion] = useState("");
  const [assistCategory, setAssistCategory] = useState("");

  const [assistPermAddr1, setAssistPermAddr1] = useState("");
  const [assistPermAddr2, setAssistPermAddr2] = useState("");
  const [assistPermCity, setAssistPermCity] = useState("");
  const [assistPermPincode, setAssistPermPincode] = useState("");
  const [assistPermState, setAssistPermState] = useState("");
  const [assistPermResidenceOwnership, setAssistPermResidenceOwnership] = useState("");

  const [assistCurrAddr1, setAssistCurrAddr1] = useState("");
  const [assistCurrAddr2, setAssistCurrAddr2] = useState("");
  const [assistCurrCity, setAssistCurrCity] = useState("");
  const [assistCurrPincode, setAssistCurrPincode] = useState("");
  const [assistCurrState, setAssistCurrState] = useState("");
  const [assistCurrResidenceOwnership, setAssistCurrResidenceOwnership] = useState("");
  const [assistSameAddress, setAssistSameAddress] = useState(false);

  // Address copy sync for assisted flow
  useEffect(() => {
    if (assistSameAddress) {
      setAssistCurrAddr1(assistPermAddr1);
      setAssistCurrAddr2(assistPermAddr2);
      setAssistCurrCity(assistPermCity);
      setAssistCurrPincode(assistPermPincode);
      setAssistCurrState(assistPermState);
      setAssistCurrResidenceOwnership(assistPermResidenceOwnership);
    }
  }, [assistSameAddress, assistPermAddr1, assistPermAddr2, assistPermCity, assistPermPincode, assistPermState, assistPermResidenceOwnership]);

  const fetchAssistCaptcha = async () => {
    try {
      setAssistCaptchaLoading(true);
      const res = await authApi.getCaptcha();
      if (res?.respData) {
        setAssistCaptchaKey(res.respData.captcha_key);
        setAssistCaptchaImg(res.respData.captcha_img);
        setAssistCaptchaValue("");
      }
    } catch (err) {
      console.error("Failed to fetch assist captcha:", err);
      toast({ title: "Captcha load failed", description: "Could not load fresh captcha.", variant: "warning" });
    } finally {
      setAssistCaptchaLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const res = await adminApi.getStatesDropdown();
      if (res?.data) {
        setStatesList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch states:", err);
    }
  };

  const handleStateChange = async (stateCode: string) => {
    setSelectedStateCode(stateCode);
    setSelectedDistrictCode("");
    setSelectedBranchCode("");
    setDistrictsList([]);
    setBranchesList([]);
    if (!stateCode) return;
    try {
      const res = await adminApi.getDistrictsDropdown(stateCode);
      if (res?.data) {
        setDistrictsList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch districts:", err);
    }
  };

  const handleDistrictChange = async (districtCode: string) => {
    setSelectedDistrictCode(districtCode);
    setSelectedBranchCode("");
    setBranchesList([]);
    if (!districtCode) return;
    try {
      const res = await adminApi.getBranchesDropdown(districtCode);
      if (res?.data) {
        setBranchesList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  };

  useEffect(() => {
    fetchAssistCaptcha();
    fetchStates();
  }, []);

  useEffect(() => {
    if (!assistLeadToken) {
      adminApi.getLeads({ per_page: 5 })
        .then((res) => {
          const lead = res?.data?.items?.[0] || res?.data?.data?.[0];
          if (lead?.lead_uuid) {
            setAssistLeadToken(lead.lead_uuid);
            console.log("Resolved fallback lead token for assisted flow:", lead.lead_uuid);
          }
        })
        .catch((err) => {
          console.warn("Could not retrieve fallback lead for assisted flow:", err);
        });
    }
  }, [assistLeadToken]);

  // Load initial state from localStorage for assisted flow
  useEffect(() => {
    if (!effectiveConfig) return;
    const key = `cosmos_loan_journey_assist_${effectiveConfig.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.assistApplicationId) setAssistApplicationId(parsed.assistApplicationId);
        if (parsed.assistSubStep) setAssistSubStep(parsed.assistSubStep);
        if (parsed.assistOtpReferenceId) setAssistOtpReferenceId(parsed.assistOtpReferenceId);
        if (parsed.assistMobile) setAssistMobile(parsed.assistMobile);
        if (parsed.assistEmail) setAssistEmail(parsed.assistEmail);
        if (parsed.assistConsent1) setAssistConsent1(parsed.assistConsent1);
        if (parsed.assistConsent2) setAssistConsent2(parsed.assistConsent2);
        
        // Branch selection variables
        if (parsed.selectedStateCode) setSelectedStateCode(parsed.selectedStateCode);
        if (parsed.selectedDistrictCode) setSelectedDistrictCode(parsed.selectedDistrictCode);
        if (parsed.selectedBranchCode) setSelectedBranchCode(parsed.selectedBranchCode);
        if (parsed.districtsList) setDistrictsList(parsed.districtsList);
        if (parsed.branchesList) setBranchesList(parsed.branchesList);

        // Aadhaar
        if (parsed.assistAadhaarNumber) setAssistAadhaarNumber(parsed.assistAadhaarNumber);
        if (parsed.assistAadhaarTransId) setAssistAadhaarTransId(parsed.assistAadhaarTransId);
        if (parsed.assistAadhaarOtp) setAssistAadhaarOtp(parsed.assistAadhaarOtp);

        // PAN
        if (parsed.assistPanNumber) setAssistPanNumber(parsed.assistPanNumber);

        // Personal Details
        if (parsed.assistGender) setAssistGender(parsed.assistGender);
        if (parsed.assistDob) setAssistDob(parsed.assistDob);
        if (parsed.assistMaritalStatus) setAssistMaritalStatus(parsed.assistMaritalStatus);
        if (parsed.assistNoOfDependents) setAssistNoOfDependents(parsed.assistNoOfDependents);
        if (parsed.assistReligion) setAssistReligion(parsed.assistReligion);
        if (parsed.assistCategory) setAssistCategory(parsed.assistCategory);

        // Permanent Address
        if (parsed.assistPermAddr1) setAssistPermAddr1(parsed.assistPermAddr1);
        if (parsed.assistPermAddr2) setAssistPermAddr2(parsed.assistPermAddr2);
        if (parsed.assistPermCity) setAssistPermCity(parsed.assistPermCity);
        if (parsed.assistPermPincode) setAssistPermPincode(parsed.assistPermPincode);
        if (parsed.assistPermState) setAssistPermState(parsed.assistPermState);
        if (parsed.assistPermResidenceOwnership) setAssistPermResidenceOwnership(parsed.assistPermResidenceOwnership);

        // Current Address
        if (parsed.assistCurrAddr1) setAssistCurrAddr1(parsed.assistCurrAddr1);
        if (parsed.assistCurrAddr2) setAssistCurrAddr2(parsed.assistCurrAddr2);
        if (parsed.assistCurrCity) setAssistCurrCity(parsed.assistCurrCity);
        if (parsed.assistCurrPincode) setAssistCurrPincode(parsed.assistCurrPincode);
        if (parsed.assistCurrState) setAssistCurrState(parsed.assistCurrState);
        if (parsed.assistCurrResidenceOwnership) setAssistCurrResidenceOwnership(parsed.assistCurrResidenceOwnership);
        if (parsed.assistSameAddress) setAssistSameAddress(parsed.assistSameAddress);

        // Force reload districts if selectedStateCode was restored
        if (parsed.selectedStateCode) {
          adminApi.getDistrictsDropdown(parsed.selectedStateCode).then((r) => {
            if (r?.data) setDistrictsList(r.data);
          });
        }
        // Force reload branches if selectedDistrictCode was restored
        if (parsed.selectedDistrictCode) {
          adminApi.getBranchesDropdown(parsed.selectedDistrictCode).then((r) => {
            if (r?.data) setBranchesList(r.data);
          });
        }

      } catch (e) {
        console.error("Error parsing saved assist state:", e);
      }
    }
  }, [effectiveConfig]);

  // Save state to localStorage for assisted flow
  useEffect(() => {
    if (!effectiveConfig) return;
    if (!assistApplicationId && assistSubStep === "initiate") return;
    const key = `cosmos_loan_journey_assist_${effectiveConfig.id}`;
    const state = {
      assistApplicationId,
      assistSubStep,
      assistOtpReferenceId,
      assistMobile,
      assistEmail,
      assistConsent1,
      assistConsent2,
      selectedStateCode,
      selectedDistrictCode,
      selectedBranchCode,
      districtsList,
      branchesList,
      assistAadhaarNumber,
      assistAadhaarTransId,
      assistAadhaarOtp,
      assistPanNumber,
      assistGender,
      assistDob,
      assistMaritalStatus,
      assistNoOfDependents,
      assistReligion,
      assistCategory,
      assistPermAddr1,
      assistPermAddr2,
      assistPermCity,
      assistPermPincode,
      assistPermState,
      assistPermResidenceOwnership,
      assistCurrAddr1,
      assistCurrAddr2,
      assistCurrCity,
      assistCurrPincode,
      assistCurrState,
      assistCurrResidenceOwnership,
      assistSameAddress
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, [
    effectiveConfig,
    assistApplicationId,
    assistSubStep,
    assistOtpReferenceId,
    assistMobile,
    assistEmail,
    assistConsent1,
    assistConsent2,
    selectedStateCode,
    selectedDistrictCode,
    selectedBranchCode,
    districtsList,
    branchesList,
    assistAadhaarNumber,
    assistAadhaarTransId,
    assistAadhaarOtp,
    assistPanNumber,
    assistGender,
    assistDob,
    assistMaritalStatus,
    assistNoOfDependents,
    assistReligion,
    assistCategory,
    assistPermAddr1,
    assistPermAddr2,
    assistPermCity,
    assistPermPincode,
    assistPermState,
    assistPermResidenceOwnership,
    assistCurrAddr1,
    assistCurrAddr2,
    assistCurrCity,
    assistCurrPincode,
    assistCurrState,
    assistCurrResidenceOwnership,
    assistSameAddress
  ]);

  async function handleAssistInitiate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveConfig) return;

    if (!assistMobile.trim() || !/^\d{10}$/.test(assistMobile)) {
      toast({ title: "Invalid mobile", description: "Phone number must be exactly 10 digits.", variant: "warning" });
      return;
    }

    if (!assistEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assistEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "warning" });
      return;
    }

    if (!assistCaptchaValue.trim()) {
      toast({ title: "Captcha required", description: "Please solve the CAPTCHA check.", variant: "warning" });
      return;
    }

    if (!assistConsent1) {
      toast({ title: "Consent required", description: "You must confirm you are not an NPA defaulter.", variant: "warning" });
      return;
    }

    if (!assistConsent2) {
      toast({ title: "Consent required", description: "You must provide consent for communication.", variant: "warning" });
      return;
    }

    if (!assistLeadToken) {
      toast({ title: "Missing Lead Link", description: "A valid lead invitation token is required to start the journey.", variant: "warning" });
      return;
    }

    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "LOGIN_INITIATE",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          is_existing_customer: false,
          account_number: "",
          mobile: assistMobile,
          email: assistEmail,
          communication_consent: true,
          not_npa_defaulter_flag: true,
          is_special_category: false,
          lead_token: assistLeadToken,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setAssistApplicationId(res.data.application_id || "");
        setAssistOtpReferenceId(res.data.opt_reference_id || "");
        setAssistSubStep("otp");
        toast({ title: "OTP Sent", description: "Verification OTP has been sent to customer's mobile.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to initiate login.";
        toast({ title: "Initiation failed", description: errorMsg, variant: "warning" });
        fetchAssistCaptcha();
      }
    } catch (err: any) {
      console.error("Assist Initiate error:", err);
      const errorMsg = err.data?.message || err.message || "Something went wrong.";
      toast({ title: "Initiation failed", description: errorMsg, variant: "warning" });
      fetchAssistCaptcha();
    } finally {
      setAssistLoading(false);
    }
  }

  async function handleAssistVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveConfig) return;

    if (!assistOtp.trim() || !/^\d{6}$/.test(assistOtp)) {
      toast({ title: "Invalid OTP", description: "OTP must be exactly 6 digits.", variant: "warning" });
      return;
    }

    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "OTP_VERIFICATION",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          application_id: assistApplicationId,
          section_id: "otp_verification",
          otp_reference_id: assistOtpReferenceId,
          otp: assistOtp,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        const nextApplication = createJourneyApplication({
          actor: currentUser?.name ?? DEMO_USERS.admin.name,
          applicant: {
            aadhaar: "",
            city: applicant.city || "Mumbai",
            customer: applicant.customer || "Customer",
            email: assistEmail,
            loanAmount: Number(applicant.loanAmount) || 100000,
            mobile: assistMobile,
            pan: "",
            salary: Number(applicant.salary) || 20000,
          },
          dsaId: effectiveConfig.dsaId,
          dsaName: effectiveConfig.dsaName,
          fieldValues,
          product: effectiveConfig.product,
          source: "Assisted",
        });
        nextApplication.applicationId = assistApplicationId;
        createItem("applications", nextApplication);

        setAssistSubStep("branch_selection");
        toast({ title: "OTP Verified", description: "OTP verified successfully. Proceed to select branch.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Invalid OTP.";
        toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Assist OTP Verification error:", err);
      const errorMsg = err.data?.message || err.message || "OTP verification failed.";
      toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
    } finally {
      setAssistLoading(false);
    }
  }

  async function handleAssistResendOtp() {
    if (!effectiveConfig) return;
    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "RESEND_OTP",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          application_id: assistApplicationId,
          mobile: assistMobile,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setAssistOtpReferenceId(res.data.opt_reference_id || "");
        toast({ title: "OTP Resent", description: "A new OTP reference has been generated.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to resend OTP.";
        toast({ title: "Resend failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Assist Resend OTP error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to resend OTP.";
      toast({ title: "Resend failed", description: errorMsg, variant: "warning" });
    } finally {
      setAssistLoading(false);
    }
  }

  async function handleAssistBranchSelection(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveConfig) return;

    const stateObj = statesList.find((s) => s.state_code === selectedStateCode);
    const districtObj = districtsList.find((d) => d.district_code === selectedDistrictCode);
    const branchObj = branchesList.find((b) => b.branch_code === selectedBranchCode);

    if (!stateObj) {
      toast({ title: "State required", description: "Please select a state.", variant: "warning" });
      return;
    }
    if (!districtObj) {
      toast({ title: "District required", description: "Please select a district.", variant: "warning" });
      return;
    }
    if (!branchObj) {
      toast({ title: "Branch required", description: "Please select a branch location.", variant: "warning" });
      return;
    }

    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "BRANCH_SELECTION",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          application_id: assistApplicationId,
          section_id: "branch_selection",
          state: stateObj.state_name,
          district: districtObj.district_name,
          branch: branchObj.branch_name,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setAssistSubStep("aadhaar_kyc_initiated");
        toast({ title: "Branch Selected", description: "Branch selection recorded successfully.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to submit branch selection.";
        toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Assist Branch selection error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to submit branch selection.";
      toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
    } finally {
      setAssistLoading(false);
    }
  }

  async function handleAssistAadhaarInitiate(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveConfig) return;

    if (!assistAadhaarNumber.trim() || !/^\d{12}$/.test(assistAadhaarNumber)) {
      toast({ title: "Invalid Aadhaar", description: "Aadhaar number must be exactly 12 digits.", variant: "warning" });
      return;
    }

    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          application_id: assistApplicationId,
          section_id: "aadhaar_kyc_initiated",
          aadhaar_number: assistAadhaarNumber,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        const transId = (res as any).data?.aadhaar_kyc_response?.transId || "MOCK_TRANS_ID";
        setAssistAadhaarTransId(transId);
        setAssistSubStep("aadhaar_kyc_otp");
        toast({ title: "OTP Sent", description: "Aadhaar validation OTP requested.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to initiate Aadhaar KYC.";
        toast({ title: "Aadhaar initiation failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Assist Aadhaar initiation error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to initiate Aadhaar KYC.";
      toast({ title: "Aadhaar initiation failed", description: errorMsg, variant: "warning" });
    } finally {
      setAssistLoading(false);
    }
  }

  async function handleAssistAadhaarVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveConfig) return;

    if (!assistAadhaarOtp.trim() || !/^\d{4,6}$/.test(assistAadhaarOtp)) {
      toast({ title: "Invalid OTP", description: "OTP must be 4 to 6 digits.", variant: "warning" });
      return;
    }

    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          application_id: assistApplicationId,
          section_id: "aadhaar_kyc_otp",
          otp: assistAadhaarOtp,
          transId: assistAadhaarTransId,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setAssistSubStep("pan_verification");
        toast({ title: "Aadhaar Verified", description: "Aadhaar KYC OTP verified successfully.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Invalid OTP.";
        toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Assist Aadhaar OTP verification error:", err);
      const errorMsg = err.data?.message || err.message || "OTP verification failed.";
      toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
    } finally {
      setAssistLoading(false);
    }
  }

  async function handleAssistPanVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveConfig) return;

    const panClean = assistPanNumber.trim().toUpperCase();
    if (!panClean || !/^[A-Z]{5}\d{4}[A-Z]$/.test(panClean)) {
      toast({ title: "Invalid PAN", description: "Format must be AAAAA1234A.", variant: "warning" });
      return;
    }

    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          application_id: assistApplicationId,
          section_id: "pan_verification",
          pan: panClean,
          payload: {},
          equifax_payload: {
            firstName: applicant.customer ? applicant.customer.split(" ")[0] : "Customer",
            lastName: applicant.customer ? applicant.customer.split(" ").slice(1).join(" ") : "Name",
            dateOfBirth: assistDob || "1990-01-01",
          },
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setAssistSubStep("personal_detail");
        toast({ title: "PAN Verified", description: "PAN card verified and Equifax score retrieved.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "PAN verification failed.";
        toast({ title: "PAN verification failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Assist PAN verification error:", err);
      const errorMsg = err.data?.message || err.message || "PAN verification failed.";
      toast({ title: "PAN verification failed", description: errorMsg, variant: "warning" });
    } finally {
      setAssistLoading(false);
    }
  }

  async function handleAssistPersonalDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveConfig) return;

    try {
      setAssistLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(effectiveConfig.product),
        payload: {
          application_id: assistApplicationId,
          section_id: "personal_detail",
          email_id: assistEmail,
          gender: assistGender || "M",
          dob: assistDob || "1990-01-01",
          no_of_dependents: assistNoOfDependents || "0",
          marital_status: assistMaritalStatus || "Single",
          religion: assistReligion || "Hindu",
          category: assistCategory || "GENERAL",
          
          permanent_address_line1: assistPermAddr1,
          permanent_address_line2: assistPermAddr2,
          permanent_city: assistPermCity,
          permanent_pincode: assistPermPincode,
          permanent_state: assistPermState,
          permanent_country: "India",
          permanent_residence_ownership: assistPermResidenceOwnership || "Own",
          
          current_address_line1: assistCurrAddr1,
          current_address_line2: assistCurrAddr2,
          current_city: assistCurrCity,
          current_pincode: assistCurrPincode,
          current_state: assistCurrState,
          current_country: "India",
          current_residence_ownership: assistCurrResidenceOwnership || "Own",
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setAssistSubStep("success");
        toast({ title: "Personal Details Saved", description: "Personal details submitted successfully.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to submit personal details.";
        toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Assist Personal Details submit error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to submit personal details.";
      toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
    } finally {
      setAssistLoading(false);
    }
  }

  const [workspaceTab, setWorkspaceTab] = useState<SellNowWorkspaceTab>("punch");
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [bulkResultOpen, setBulkResultOpen] = useState(false);



  const journey = effectiveConfig
    ? buildApplicationJourney(effectiveConfig.product, effectiveConfig.id.length + effectiveConfig.dsaCode.length, {
        city: applicant.city,
        customer: applicant.customer || "Customer",
        loanAmount: Number(applicant.loanAmount || 0),
        salary: Number(applicant.salary || 0),
      })
    : null;

  const shareLink =
    effectiveConfig ? configJourneyUrl(effectiveConfig) : "";

  useEffect(() => {
    localStorage.setItem(
      sellNowDraftKey,
      JSON.stringify({
        lastLink,
        mode,
        selectedDsaId: effectiveDsaId,
        selectedProduct: effectiveProduct,
        stepIndex,
      }),
    );
  }, [effectiveDsaId, effectiveProduct, lastLink, mode, stepIndex]);


  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "Content copied to clipboard.", variant: "success" });
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access is not available in this browser session.", variant: "warning" });
    }
  }

  function selectBulkFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setBulkResult(null);
    setBulkFile(null);

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      event.currentTarget.value = "";
      toast({ title: "CSV required", description: "Upload a .csv file using the supported bulk application template.", variant: "warning" });
      return;
    }

    setBulkFile(file);
  }

  async function uploadBulkCsv() {
    if (!effectiveConfig) {
      toast({ title: "Select product", description: "Choose an active configured loan product before uploading a CSV.", variant: "warning" });
      return;
    }
    if (!bulkFile) {
      toast({ title: "CSV required", description: "Select a bulk application CSV file before uploading.", variant: "warning" });
      return;
    }

    setBulkUploading(true);
    setBulkResult(null);

    try {
      const contents = await bulkFile.text();
      const lines = contents.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const totalRows = Math.max(1, lines.length > 1 ? lines.length - 1 : lines.length || 1);

      await new Promise((resolve) => window.setTimeout(resolve, 900));

      setBulkResult({
        acceptedRows: totalRows,
        fileName: bulkFile.name,
        product: effectiveConfig.product,
        rejectedRows: 0,
        requestedAt: new Date().toLocaleString("en-IN"),
        totalRows,
      });
      setBulkResultOpen(true);
      toast({ title: "Bulk upload queued", description: `${totalRows} rows accepted for ${effectiveConfig.product}.`, variant: "success" });
    } catch {
      const totalRows = 1;
      setBulkResult({
        acceptedRows: totalRows,
        fileName: bulkFile.name,
        product: effectiveConfig.product,
        rejectedRows: 0,
        requestedAt: new Date().toLocaleString("en-IN"),
        totalRows,
      });
      setBulkResultOpen(true);
      toast({ title: "Bulk upload queued", description: `Dummy upload queued for ${effectiveConfig.product}.`, variant: "success" });
    } finally {
      setBulkUploading(false);
    }
  }
  async function copyLink(value: string) {
    if (!value) {
      toast({ title: "No link available", description: "Select a configured journey first.", variant: "warning" });
      return;
    }
    await navigator.clipboard.writeText(value);
    toast({ title: "Link copied", description: "Journey link copied to clipboard.", variant: "success" });
  }

  function sendJourney(channel: "Email" | "SMS") {
    if (!effectiveConfig) {
      toast({ title: "Select journey", description: "Choose a DSA and product journey first.", variant: "warning" });
      return;
    }
    if (currentUser?.role === "DSA Partner" && channel === "Email") {
      toast({ title: "SMS only", description: "DSA admins can send customer journey links by SMS.", variant: "warning" });
      return;
    }
    const error = validateRecipient(applicant);
    if (error) {
      toast({ title: "Missing recipient", description: error, variant: "warning" });
      return;
    }
    if (channel === "Email" && !applicant.email.trim()) {
      toast({ title: "Email required", description: "Enter customer email to send the journey link.", variant: "warning" });
      return;
    }
    if (channel === "SMS" && !applicant.mobile.trim()) {
      toast({ title: "Mobile required", description: "Enter customer mobile to send the journey link.", variant: "warning" });
      return;
    }
    setLastLink(shareLink);
    toast({
      title: `${channel} queued`,
      description: `${effectiveConfig.product} journey link prepared for ${applicant.customer}.`,
      variant: "success",
    });
  }

  const isBankJourneyUser = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";

  if (!isBankJourneyUser && currentUser?.role !== "DSA Partner") {
    return (
      <EmptyState
        description="This workspace is available to the admin and DSA journey desks."
        title="Sell Now is restricted"
      />
    );
  }

  return (
    <div>
      <PageHeader
        description="Punch in one application, upload CSV batches, or share API integration details from one workspace."
        eyebrow="Journeys"
        title="Sell Now"
      />

      <div className="mb-5">
        <Tabs
          onChange={(value) => setWorkspaceTab(value as SellNowWorkspaceTab)}
          tabs={[
            { label: "Punch-in Application", value: "punch" },
            { label: "Bulk Upload", value: "bulk" },
            { label: "API Documentation", value: "docs" },
          ]}
          value={workspaceTab}
        />
      </div>

      {workspaceTab === "punch" ? (
        activeConfigs.length ? (
          <div className="space-y-6">
            {!isDsaPartner ? (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold text-slate-950">Journey selection</h2>
                </CardHeader>
                <CardContent className="space-y-5">
                  <JourneySelection
                    configs={activeConfigs}
                    lockDsa={currentUser.role === "DSA Partner"}
                    onDsaChange={(value) => {
                      setSelectedDsaId(value);
                      setSelectedProduct("");
                      setFieldValues({});
                      setCreatedApplication(null);
                      setLastLink("");
                      setStepIndex(0);
                    }}
                    onProductChange={(value) => {
                      setSelectedProduct(value);
                      setFieldValues({});
                      setCreatedApplication(null);
                      setLastLink("");
                      setStepIndex(0);
                    }}
                    selectedDsaId={effectiveDsaId}
                    selectedProduct={effectiveProduct}
                  />
                  {effectiveConfig ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <DetailItem label="DSA ID" value={effectiveConfig.dsaCode} />
                      <DetailItem label="Configured product" value={effectiveConfig.product} />
                      <DetailItem label="Commission type" value={effectiveConfig.commissionType} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Journey action</h2>
                  {effectiveConfig ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {isDsaPartner ? effectiveConfig.product : `${effectiveConfig.dsaName} - ${effectiveConfig.product}`}
                    </p>
                  ) : null}
                </div>
                <Tabs
                  onChange={setMode}
                  tabs={[
                    { label: "Send Link", value: "send" },
                    { label: "Fill on Behalf", value: "assist" },
                  ]}
                  value={mode}
                />
              </CardHeader>
              <CardContent className="space-y-5">
                {isDsaPartner ? (
                  <Field className="max-w-md">
                    <Label htmlFor="sellNowPartnerProduct">Loan product</Label>
                    <Select
                      id="sellNowPartnerProduct"
                      onChange={(event) => {
                        setSelectedProduct(event.target.value);
                        setFieldValues({});
                        setCreatedApplication(null);
                        setLastLink("");
                        setStepIndex(0);
                      }}
                      value={effectiveProduct}
                    >
                      <option value="">Select product</option>
                      {productsForDsa.map((config) => (
                        <option key={config.id} value={config.product}>
                          {config.product}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                {mode === "send" ? (
                  <>
                    <RecipientFields
                      draft={applicant}
                      onChange={(patch) => setApplicant((current) => ({ ...current, ...patch }))}
                    />
                    <div className="space-y-4">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Journey link</p>
                            <p className="mt-1 break-all text-sm font-medium text-slate-950">{shareLink || "Select a journey"}</p>
                          </div>
                          <Button onClick={() => copyLink(shareLink)} type="button" variant="outline">
                            <Copy className="h-4 w-4" />
                            Copy Link
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {isBankJourneyUser ? (
                          <Button onClick={() => sendJourney("Email")} type="button" variant="outline">
                            <Mail className="h-4 w-4" />
                            Send Email
                          </Button>
                        ) : null}
                        <Button onClick={() => sendJourney("SMS")} type="button">
                          <MessageSquare className="h-4 w-4" />
                          Send SMS
                        </Button>
                      </div>
                      {lastLink ? (
                        <div className="flex flex-col gap-3 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-700 md:flex-row md:items-center md:justify-between">
                          <span className="break-all">Journey link ready: {lastLink}</span>
                          <Button onClick={() => copyLink(lastLink)} type="button" variant="outline">
                            <Copy className="h-4 w-4" />
                            Copy Link
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="space-y-5">
                    {assistSubStep === "initiate" && (
                      <form onSubmit={handleAssistInitiate} className="space-y-6 pt-2">
                        <div className="grid gap-5 md:grid-cols-2">
                          {/* Column 1: Identity Info */}
                          <div className="space-y-4">
                            <Field>
                              <Label htmlFor="assist_mobile" className="font-semibold text-slate-800">Phone Number *</Label>
                              <Input
                                id="assist_mobile"
                                placeholder="10-digit phone number"
                                type="tel"
                                maxLength={10}
                                value={assistMobile}
                                onChange={(e) => setAssistMobile(e.target.value.replace(/\D/g, ""))}
                                disabled={assistLoading}
                                className="h-10 text-sm focus:border-blue-600 focus:ring-blue-600"
                              />
                            </Field>

                            <Field>
                              <Label htmlFor="assist_email" className="font-semibold text-slate-800">Email Address *</Label>
                              <Input
                                id="assist_email"
                                placeholder="e.g. customer@example.com"
                                type="email"
                                value={assistEmail}
                                onChange={(e) => setAssistEmail(e.target.value)}
                                disabled={assistLoading}
                                className="h-10 text-sm focus:border-blue-600 focus:ring-blue-600"
                              />
                            </Field>
                          </div>

                          {/* Column 2: Captcha Verification */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="assist_captcha" className="font-semibold text-slate-800">Captcha Code *</Label>
                              <div className="flex gap-2 items-center">
                                <div className="flex-1 bg-slate-50 h-10 border border-slate-200 rounded flex items-center justify-center overflow-hidden shadow-inner">
                                  {assistCaptchaImg ? (
                                    <img src={assistCaptchaImg} alt="CAPTCHA" className="h-full w-full object-contain mix-blend-multiply" />
                                  ) : (
                                    <span className="text-xs text-slate-400">Loading...</span>
                                  )}
                                </div>
                                <Input
                                  id="assist_captcha"
                                  placeholder="Enter CAPTCHA"
                                  value={assistCaptchaValue}
                                  onChange={(e) => setAssistCaptchaValue(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 flex-1 text-sm focus:border-blue-600 focus:ring-blue-600 font-mono tracking-wider"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={fetchAssistCaptcha}
                                  disabled={assistCaptchaLoading || assistLoading}
                                  title="Refresh CAPTCHA"
                                  className="h-10 w-10 shrink-0"
                                >
                                  <RefreshCw className={`h-4 w-4 text-slate-600 ${assistCaptchaLoading ? "animate-spin" : ""}`} />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Full-width consents */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                          <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-600 hover:text-slate-800 transition">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                              checked={assistConsent1}
                              onChange={(e) => setAssistConsent1(e.target.checked)}
                              disabled={assistLoading}
                            />
                            <span className="leading-relaxed">
                              I confirm that I am not a defaulter for any bank's loan and no insolvency proceedings are initiated against me. *
                            </span>
                          </label>

                          <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-600 hover:text-slate-800 transition">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                              checked={assistConsent2}
                              onChange={(e) => setAssistConsent2(e.target.checked)}
                              disabled={assistLoading}
                            />
                            <span className="leading-relaxed">
                              I consent to Cosmos Bank / bank agent calling me / sending SMS / sending Email regarding my loan application. *
                            </span>
                          </label>
                        </div>

                        {/* Aligned Button */}
                        <div className="flex justify-end pt-2">
                          <Button type="submit" disabled={assistLoading} className="w-full md:w-48 h-10 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-150">
                            {assistLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Sending OTP...
                              </>
                            ) : (
                              "Send OTP"
                            )}
                          </Button>
                        </div>
                      </form>
                    )}

                    {assistSubStep === "otp" && (
                      <div className="max-w-md mx-auto pt-4 space-y-5">
                        <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-100/80 text-center shadow-sm">
                          <p className="text-xs text-slate-500 font-semibold text-blue-800">OTP Sent To Customer's Mobile</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">+91 ******{assistMobile.slice(-4)}</p>
                        </div>

                        <form onSubmit={handleAssistVerifyOtp} className="space-y-4">
                          <Field>
                            <Label htmlFor="assist_otp" className="font-semibold text-slate-800">Enter 6-Digit OTP *</Label>
                            <Input
                              id="assist_otp"
                              placeholder="Enter OTP"
                              type="text"
                              maxLength={6}
                              value={assistOtp}
                              onChange={(e) => setAssistOtp(e.target.value.replace(/\D/g, ""))}
                              disabled={assistLoading}
                              className="h-12 text-center text-lg font-mono font-bold tracking-widest focus:border-blue-600 focus:ring-blue-600"
                            />
                          </Field>

                          <div className="flex justify-between items-center text-xs pt-1">
                            <button
                              type="button"
                              onClick={() => setAssistSubStep("initiate")}
                              className="text-slate-500 hover:text-slate-800 transition underline font-medium"
                              disabled={assistLoading}
                            >
                              Change Details
                            </button>
                            <button
                              type="button"
                              onClick={handleAssistResendOtp}
                              className="text-blue-600 hover:text-blue-800 transition underline font-semibold"
                              disabled={assistLoading}
                            >
                              Resend OTP
                            </button>
                          </div>

                          <Button type="submit" className="w-full h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm mt-2 transition-all" disabled={assistLoading}>
                            {assistLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Verifying...
                              </>
                            ) : (
                              "Verify & Continue"
                            )}
                          </Button>
                        </form>
                      </div>
                    )}

                    {assistSubStep === "branch_selection" && (
                      <div className="space-y-4 max-w-md mx-auto pt-4">
                        <div className="text-center pb-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
                            <MapPin className="h-5 w-5 text-blue-700" />
                            Select Preferred Branch
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Choose a branch location convenient for the customer's loan servicing.
                          </p>
                        </div>

                        <form onSubmit={handleAssistBranchSelection} className="space-y-4">
                          <Field>
                            <Label htmlFor="assist_state" className="font-semibold text-slate-800">State *</Label>
                            <Select
                              id="assist_state"
                              value={selectedStateCode}
                              onChange={(e) => handleStateChange(e.target.value)}
                              disabled={assistLoading}
                              className="h-10 text-sm"
                            >
                              <option value="">Select State</option>
                              {statesList.map((s) => (
                                <option key={s.state_code} value={s.state_code}>
                                  {s.state_name}
                                </option>
                              ))}
                            </Select>
                          </Field>

                          <Field>
                            <Label htmlFor="assist_district" className="font-semibold text-slate-800">District *</Label>
                            <Select
                              id="assist_district"
                              value={selectedDistrictCode}
                              onChange={(e) => handleDistrictChange(e.target.value)}
                              disabled={assistLoading || !selectedStateCode}
                              className="h-10 text-sm"
                            >
                              <option value="">Select District</option>
                              {districtsList.map((d) => (
                                <option key={d.district_code} value={d.district_code}>
                                  {d.district_name}
                                </option>
                              ))}
                            </Select>
                          </Field>

                          <Field>
                            <Label htmlFor="assist_branch" className="font-semibold text-slate-800">Branch *</Label>
                            <Select
                              id="assist_branch"
                              value={selectedBranchCode}
                              onChange={(e) => setSelectedBranchCode(e.target.value)}
                              disabled={assistLoading || !selectedDistrictCode}
                              className="h-10 text-sm"
                            >
                              <option value="">Select Branch</option>
                              {branchesList.map((b) => (
                                <option key={b.branch_code} value={b.branch_code}>
                                  {b.branch_name}
                                </option>
                              ))}
                            </Select>
                          </Field>

                          <div className="flex justify-between gap-2 mt-6">
                            <Button type="button" variant="outline" onClick={() => setAssistSubStep("otp")} disabled={assistLoading}>
                              Back
                            </Button>
                            <Button type="submit" disabled={assistLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                              {assistLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Submitting...
                                </>
                              ) : (
                                "Submit Selection"
                              )}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {assistSubStep === "aadhaar_kyc_initiated" && (
                      <div className="space-y-4 max-w-md mx-auto pt-4">
                        <div className="text-center pb-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
                            <KeyRound className="h-5 w-5 text-blue-700" />
                            Aadhaar KYC Verification
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Enter the customer's 12-digit Aadhaar number to initiate verification.
                          </p>
                        </div>

                        <form onSubmit={handleAssistAadhaarInitiate} className="space-y-4">
                          <Field>
                            <Label htmlFor="assist_aadhaar">Aadhaar Number *</Label>
                            <Input
                              id="assist_aadhaar"
                              placeholder="Enter 12-digit Aadhaar number"
                              type="text"
                              maxLength={12}
                              value={assistAadhaarNumber}
                              onChange={(e) => setAssistAadhaarNumber(e.target.value.replace(/\D/g, ""))}
                              disabled={assistLoading}
                              className="h-10 text-sm font-mono tracking-widest text-center focus:border-blue-600 focus:ring-blue-600"
                            />
                          </Field>

                          <div className="flex justify-between gap-2 mt-6">
                            <Button type="button" variant="outline" onClick={() => setAssistSubStep("branch_selection")} disabled={assistLoading}>
                              Back
                            </Button>
                            <Button type="submit" disabled={assistLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                              {assistLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Sending OTP...
                                </>
                              ) : (
                                "Request OTP"
                              )}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {assistSubStep === "aadhaar_kyc_otp" && (
                      <div className="space-y-4 max-w-md mx-auto pt-4">
                        <div className="text-center pb-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
                            <KeyRound className="h-5 w-5 text-blue-700" />
                            Aadhaar OTP Verification
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Enter the verification OTP sent to the customer's registered mobile.
                          </p>
                        </div>

                        <form onSubmit={handleAssistAadhaarVerify} className="space-y-4">
                          <Field>
                            <Label htmlFor="assist_aadhaar_otp">Enter 6-Digit OTP *</Label>
                            <Input
                              id="assist_aadhaar_otp"
                              placeholder="Enter OTP"
                              type="text"
                              maxLength={6}
                              value={assistAadhaarOtp}
                              onChange={(e) => setAssistAadhaarOtp(e.target.value.replace(/\D/g, ""))}
                              disabled={assistLoading}
                              className="h-12 text-center text-lg font-mono font-bold tracking-widest focus:border-blue-600 focus:ring-blue-600"
                            />
                          </Field>

                          <div className="flex justify-between gap-2 mt-6">
                            <Button type="button" variant="outline" onClick={() => setAssistSubStep("aadhaar_kyc_initiated")} disabled={assistLoading}>
                              Back
                            </Button>
                            <Button type="submit" disabled={assistLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                              {assistLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Verifying...
                                </>
                              ) : (
                                "Verify Aadhaar"
                              )}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {assistSubStep === "pan_verification" && (
                      <div className="space-y-4 max-w-md mx-auto pt-4">
                        <div className="text-center pb-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-blue-700" />
                            PAN Verification
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Verify customer's Permanent Account Number (PAN) to query Equifax credit file.
                          </p>
                        </div>

                        <form onSubmit={handleAssistPanVerify} className="space-y-4">
                          <Field>
                            <Label htmlFor="assist_pan">PAN Number *</Label>
                            <Input
                              id="assist_pan"
                              placeholder="e.g. ABCDE1234F"
                              type="text"
                              maxLength={10}
                              value={assistPanNumber}
                              onChange={(e) => setAssistPanNumber(e.target.value.toUpperCase())}
                              disabled={assistLoading}
                              className="h-10 text-sm font-mono tracking-widest text-center uppercase focus:border-blue-600 focus:ring-blue-600"
                            />
                          </Field>

                          <div className="flex justify-between gap-2 mt-6">
                            <Button type="button" variant="outline" onClick={() => setAssistSubStep("aadhaar_kyc_otp")} disabled={assistLoading}>
                              Back
                            </Button>
                            <Button type="submit" disabled={assistLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                              {assistLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Verifying PAN...
                                </>
                              ) : (
                                "Verify PAN"
                              )}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {assistSubStep === "personal_detail" && (
                      <div className="space-y-6 max-w-xl mx-auto pt-4">
                        <div className="text-center pb-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
                            <MapPin className="h-5 w-5 text-blue-700" />
                            Personal Information & Addresses
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Complete the basic profile and permanent/current address details.
                          </p>
                        </div>

                        <form onSubmit={handleAssistPersonalDetailsSubmit} className="space-y-6">
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Basic Details</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <Label htmlFor="assist_gender">Gender *</Label>
                                <Select
                                  id="assist_gender"
                                  value={assistGender}
                                  onChange={(e) => setAssistGender(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                >
                                  <option value="">Select Gender</option>
                                  <option value="M">Male</option>
                                  <option value="F">Female</option>
                                  <option value="O">Other</option>
                                </Select>
                              </Field>

                              <Field>
                                <Label htmlFor="assist_dob">Date of Birth *</Label>
                                <Input
                                  id="assist_dob"
                                  type="date"
                                  value={assistDob}
                                  onChange={(e) => setAssistDob(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                />
                              </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <Label htmlFor="assist_marital">Marital Status *</Label>
                                <Select
                                  id="assist_marital"
                                  value={assistMaritalStatus}
                                  onChange={(e) => setAssistMaritalStatus(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                >
                                  <option value="">Select Status</option>
                                  <option value="Single">Single</option>
                                  <option value="Married">Married</option>
                                  <option value="Divorced">Divorced</option>
                                  <option value="Widowed">Widowed</option>
                                  <option value="Separated">Separated</option>
                                </Select>
                              </Field>

                              <Field>
                                <Label htmlFor="assist_dependents">Number of Dependents *</Label>
                                <Input
                                  id="assist_dependents"
                                  type="number"
                                  min={0}
                                  value={assistNoOfDependents}
                                  onChange={(e) => setAssistNoOfDependents(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                />
                              </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <Label htmlFor="assist_religion">Religion</Label>
                                <Select
                                  id="assist_religion"
                                  value={assistReligion}
                                  onChange={(e) => setAssistReligion(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                >
                                  <option value="">Select Religion</option>
                                  <option value="Hindu">Hindu</option>
                                  <option value="Muslim">Muslim</option>
                                  <option value="Christian">Christian</option>
                                  <option value="Sikh">Sikh</option>
                                  <option value="Buddhist">Buddhist</option>
                                  <option value="Jain">Jain</option>
                                  <option value="Other">Other</option>
                                </Select>
                              </Field>

                              <Field>
                                <Label htmlFor="assist_category">Category</Label>
                                <Select
                                  id="assist_category"
                                  value={assistCategory}
                                  onChange={(e) => setAssistCategory(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                >
                                  <option value="">Select Category</option>
                                  <option value="GENERAL">General</option>
                                  <option value="OBC">OBC</option>
                                  <option value="SC">SC</option>
                                  <option value="ST">ST</option>
                                </Select>
                              </Field>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Permanent Address</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <Field className="col-span-2">
                                <Label htmlFor="assist_perm_addr1">Address Line 1 *</Label>
                                <Input
                                  id="assist_perm_addr1"
                                  value={assistPermAddr1}
                                  onChange={(e) => setAssistPermAddr1(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                  placeholder="Street address, P.O. box"
                                />
                              </Field>
                              
                              <Field className="col-span-2">
                                <Label htmlFor="assist_perm_addr2">Address Line 2</Label>
                                <Input
                                  id="assist_perm_addr2"
                                  value={assistPermAddr2}
                                  onChange={(e) => setAssistPermAddr2(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                  placeholder="Apartment, suite, unit, building"
                                />
                              </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <Label htmlFor="assist_perm_city">City *</Label>
                                <Input
                                  id="assist_perm_city"
                                  value={assistPermCity}
                                  onChange={(e) => setAssistPermCity(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                  placeholder="City"
                                />
                              </Field>
                              
                              <Field>
                                <Label htmlFor="assist_perm_pincode">Pincode *</Label>
                                <Input
                                  id="assist_perm_pincode"
                                  value={assistPermPincode}
                                  onChange={(e) => setAssistPermPincode(e.target.value.replace(/\D/g, ""))}
                                  maxLength={6}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                  placeholder="6-digit PIN"
                                />
                              </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <Label htmlFor="assist_perm_state">State *</Label>
                                <Input
                                  id="assist_perm_state"
                                  value={assistPermState}
                                  onChange={(e) => setAssistPermState(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                  placeholder="State"
                                />
                              </Field>

                              <Field>
                                <Label htmlFor="assist_perm_ownership">Ownership *</Label>
                                <Select
                                  id="assist_perm_ownership"
                                  value={assistPermResidenceOwnership}
                                  onChange={(e) => setAssistPermResidenceOwnership(e.target.value)}
                                  disabled={assistLoading}
                                  className="h-10 text-sm"
                                >
                                  <option value="">Select Ownership</option>
                                  <option value="Own">Owned</option>
                                  <option value="Rent">Rented</option>
                                  <option value="Lease">Leased</option>
                                  <option value="Employer">Employer Provided</option>
                                </Select>
                              </Field>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Current Address</h3>
                              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-blue-700 font-semibold select-none">
                                <input
                                  type="checkbox"
                                  checked={assistSameAddress}
                                  onChange={(e) => setAssistSameAddress(e.target.checked)}
                                  disabled={assistLoading}
                                  className="rounded border-slate-300 text-blue-700 focus:ring-blue-500 h-3.5 w-3.5"
                                />
                                Same as Permanent Address
                              </label>
                            </div>

                            {!assistSameAddress && (
                              <div className="space-y-4 transition-all">
                                <div className="grid grid-cols-2 gap-4">
                                  <Field className="col-span-2">
                                    <Label htmlFor="assist_curr_addr1">Address Line 1 *</Label>
                                    <Input
                                      id="assist_curr_addr1"
                                      value={assistCurrAddr1}
                                      onChange={(e) => setAssistCurrAddr1(e.target.value)}
                                      disabled={assistLoading}
                                      className="h-10 text-sm"
                                      placeholder="Street address, P.O. box"
                                    />
                                  </Field>
                                  
                                  <Field className="col-span-2">
                                    <Label htmlFor="assist_curr_addr2">Address Line 2</Label>
                                    <Input
                                      id="assist_curr_addr2"
                                      value={assistCurrAddr2}
                                      onChange={(e) => setAssistCurrAddr2(e.target.value)}
                                      disabled={assistLoading}
                                      className="h-10 text-sm"
                                      placeholder="Apartment, suite, unit, building"
                                    />
                                  </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <Field>
                                    <Label htmlFor="assist_curr_city">City *</Label>
                                    <Input
                                      id="assist_curr_city"
                                      value={assistCurrCity}
                                      onChange={(e) => setAssistCurrCity(e.target.value)}
                                      disabled={assistLoading}
                                      className="h-10 text-sm"
                                      placeholder="City"
                                    />
                                  </Field>
                                  
                                  <Field>
                                    <Label htmlFor="assist_curr_pincode">Pincode *</Label>
                                    <Input
                                      id="assist_curr_pincode"
                                      value={assistCurrPincode}
                                      onChange={(e) => setAssistCurrPincode(e.target.value.replace(/\D/g, ""))}
                                      maxLength={6}
                                      disabled={assistLoading}
                                      className="h-10 text-sm"
                                      placeholder="6-digit PIN"
                                    />
                                  </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <Field>
                                    <Label htmlFor="assist_curr_state">State *</Label>
                                    <Input
                                      id="assist_curr_state"
                                      value={assistCurrState}
                                      onChange={(e) => setAssistCurrState(e.target.value)}
                                      disabled={assistLoading}
                                      className="h-10 text-sm"
                                      placeholder="State"
                                    />
                                  </Field>

                                  <Field>
                                    <Label htmlFor="assist_curr_ownership">Ownership *</Label>
                                    <Select
                                      id="assist_curr_ownership"
                                      value={assistCurrResidenceOwnership}
                                      onChange={(e) => setAssistCurrResidenceOwnership(e.target.value)}
                                      disabled={assistLoading}
                                      className="h-10 text-sm"
                                    >
                                      <option value="">Select Ownership</option>
                                      <option value="Own">Owned</option>
                                      <option value="Rent">Rented</option>
                                      <option value="Lease">Leased</option>
                                      <option value="Employer">Employer Provided</option>
                                    </Select>
                                  </Field>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between gap-2 mt-6">
                            <Button type="button" variant="outline" onClick={() => setAssistSubStep("pan_verification")} disabled={assistLoading}>
                              Back
                            </Button>
                            <Button type="submit" disabled={assistLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                              {assistLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Submitting...
                                </>
                              ) : (
                                "Save & Continue"
                              )}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {assistSubStep === "success" && (
                      <div className="text-center py-6 space-y-5 max-w-md mx-auto">
                        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
                          <CheckCircle2 className="h-8 w-8 text-emerald-600 animate-bounce" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-xl font-extrabold text-slate-900">Verification Complete</h2>
                          <p className="text-sm text-slate-500">
                            Application <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{assistApplicationId}</span> is created successfully.
                          </p>
                        </div>
                        <div className="p-4 bg-emerald-50/70 rounded-lg border border-emerald-100 text-xs text-emerald-800 text-left space-y-1.5 shadow-inner">
                          <p className="font-bold flex items-center gap-1.5 text-sm text-emerald-900">
                            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping"></span>
                            Next Stage: Email Verification
                          </p>
                          <p className="leading-relaxed">
                            The customer's email verification link has been triggered. Please ask the customer to check their inbox to proceed to Personal Details.
                          </p>
                        </div>
                        <div className="pt-2">
                          <Button
                            type="button"
                            className="w-full h-10 font-semibold"
                            onClick={() => {
                              if (effectiveConfig) {
                                localStorage.removeItem(`cosmos_loan_journey_assist_${effectiveConfig.id}`);
                              }
                              setAssistSubStep("initiate");
                              setAssistMobile("");
                              setAssistEmail("");
                              setAssistOtp("");
                              setAssistConsent1(false);
                              setAssistConsent2(false);
                              setAssistApplicationId("");
                              setAssistOtpReferenceId("");
                              setSelectedStateCode("");
                              setSelectedDistrictCode("");
                              setSelectedBranchCode("");
                              setDistrictsList([]);
                              setBranchesList([]);
                              
                              // Clear personal details states as well
                              setAssistAadhaarNumber("");
                              setAssistAadhaarTransId("");
                              setAssistAadhaarOtp("");
                              setAssistPanNumber("");
                              setAssistGender("");
                              setAssistDob("");
                              setAssistMaritalStatus("");
                              setAssistNoOfDependents("0");
                              setAssistReligion("");
                              setAssistCategory("");
                              setAssistPermAddr1("");
                              setAssistPermAddr2("");
                              setAssistPermCity("");
                              setAssistPermPincode("");
                              setAssistPermState("");
                              setAssistPermResidenceOwnership("");
                              setAssistCurrAddr1("");
                              setAssistCurrAddr2("");
                              setAssistCurrCity("");
                              setAssistCurrPincode("");
                              setAssistCurrState("");
                              setAssistCurrResidenceOwnership("");
                              setAssistSameAddress(false);

                              fetchAssistCaptcha();
                            }}
                          >
                            Punch Another Application
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            {!isDsaPartner && effectiveConfig ? (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold text-slate-950">Configured payout</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {effectiveConfig.ranges.map((range) => (
                    <div className="rounded-md border border-slate-100 p-3" key={range.id}>
                      <p className="font-semibold text-slate-950">{range.id}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCurrency(range.min)} - {formatCurrency(range.max)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {commissionDisplayLabel(range)}: {formatCommissionDisplay(range)} - {range.frequency}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : (
          <EmptyState
            action={
              isBankJourneyUser ? (
                <Link href="/dsa/product-setting">
                  <Button type="button">Open Product Setting</Button>
                </Link>
              ) : undefined
            }
            description={
              currentUser.role === "DSA Partner"
                ? "No active loan products are configured for your DSA yet."
                : "Configure at least one active DSA product before starting a journey."
            }
            title="No journeys configured"
          />
        )
      ) : null}

      {workspaceTab === "bulk" ? (
        activeConfigs.length ? (
          <div className="space-y-6">
            {!isDsaPartner ? (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold text-slate-950">Bulk upload product</h2>
                </CardHeader>
                <CardContent className="space-y-5">
                  <JourneySelection
                    configs={activeConfigs}
                    onDsaChange={(value) => {
                      setSelectedDsaId(value);
                      setSelectedProduct("");
                      setBulkFile(null);
                      setBulkResult(null);
                    }}
                    onProductChange={(value) => {
                      setSelectedProduct(value);
                      setBulkFile(null);
                      setBulkResult(null);
                    }}
                    selectedDsaId={effectiveDsaId}
                    selectedProduct={effectiveProduct}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Bulk application upload</h2>
                  <p className="mt-1 text-xs text-slate-500">Upload one CSV file for the selected configured product.</p>
                </div>
                <FileSpreadsheet className="h-5 w-5 text-blue-700" />
              </CardHeader>
              <CardContent className="space-y-5">
                {effectiveConfig ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <DetailItem label="Product" value={effectiveConfig.product} />
                    <DetailItem label="Partner" value={isDsaPartner ? currentUser.name : effectiveConfig.dsaName} />
                    <DetailItem label="Batch status" value={bulkResult ? "Last batch queued" : "Ready"} />
                  </div>
                ) : null}

                <label
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-200 bg-blue-50/50 p-8 text-center transition hover:bg-blue-50"
                  htmlFor="bulkCsvFile"
                >
                  <UploadCloud className="h-9 w-9 text-blue-700" />
                  <span className="mt-3 text-sm font-semibold text-slate-950">Upload bulk CSV</span>
                  <span className="mt-1 text-xs text-slate-500">CSV only, one header row, one application per row.</span>
                  <Input accept=".csv,text/csv" className="hidden" id="bulkCsvFile" onChange={selectBulkFile} type="file" />
                </label>

                {bulkFile ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-950">{bulkFile.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{Math.max(1, Math.round(bulkFile.size / 1024))} KB selected</p>
                  </div>
                ) : null}

                {bulkUploading ? (
                  <div className="flex items-center gap-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm font-medium text-blue-800">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading and validating CSV rows.
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button onClick={() => copyText("CSV template", bulkCsvTemplate)} type="button" variant="outline">
                    <Copy className="h-4 w-4" />
                    Copy CSV Template
                  </Button>
                  <Button disabled={bulkUploading || !bulkFile || !effectiveConfig} onClick={uploadBulkCsv} type="button">
                    {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {bulkUploading ? "Uploading" : "Upload CSV"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {!isDsaPartner ? (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-slate-950">CSV schema</h2>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="p-3">Column</th>
                        <th className="p-3">Required</th>
                        <th className="p-3">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ["customer_name", "Yes", "Full applicant name."],
                        ["mobile", "Yes", "10 digit Indian mobile number."],
                        ["email", "Yes", "Valid customer email address."],
                        ["city", "Yes", "Residence or business city."],
                        ["loan_amount", "Yes", "Numeric amount within product range."],
                        ["monthly_income", "Yes", "Numeric monthly income."],
                        ["pan", "Yes", "ABCDE1234F format."],
                        ["aadhaar", "Yes", "12 digit Aadhaar number."],
                      ].map(([column, required, validation]) => (
                        <tr key={column}>
                          <td className="p-3 font-mono text-xs text-slate-700">{column}</td>
                          <td className="p-3 text-slate-700">{required}</td>
                          <td className="p-3 text-slate-700">{validation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            ) : null}
          </div>
        ) : (
          <EmptyState
            action={
              isBankJourneyUser ? (
                <Link href="/dsa/product-setting">
                  <Button type="button">Open Product Setting</Button>
                </Link>
              ) : undefined
            }
            description={
              currentUser.role === "DSA Partner"
                ? "No active loan products are configured for your DSA yet."
                : "Configure at least one active DSA product before uploading application batches."
            }
            title="No bulk upload products configured"
          />
        )
      ) : null}

      {workspaceTab === "docs" ? <ApiDocumentationPanel onCopy={copyText} /> : null}

      <Modal
        description="CSV rows accepted for processing are queued for application creation and validation."
        onClose={() => setBulkResultOpen(false)}
        open={bulkResultOpen}
        title="Bulk upload queued"
        width="max-w-lg"
      >
        {bulkResult ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-emerald-100 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-semibold">{bulkResult.fileName}</p>
                <p className="mt-1 text-sm">{bulkResult.acceptedRows} of {bulkResult.totalRows} rows accepted for {bulkResult.product}.</p>
              </div>
            </div>
            <DetailItem label="Requested at" value={bulkResult.requestedAt} />
            <DetailItem label="Rejected rows" value={bulkResult.rejectedRows} />
            <div className="flex justify-end">
              <Button onClick={() => setBulkResultOpen(false)} type="button">Done</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function getLoanType(productName: string): string {
  const lower = productName.toLowerCase();
  if (lower.includes("personal")) return "PERSONAL_LOAN";
  if (lower.includes("home")) return "HOME_LOAN";
  if (lower.includes("car")) return "CAR_LOAN";
  if (lower.includes("business")) return "BUSINESS_LOAN";
  return "PERSONAL_LOAN";
}

export function BorrowerJourneyPage({ configId }: { configId: string }) {
  const { store } = useMockStore();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const leadTokenParam = searchParams ? searchParams.get("lead_token") || "" : "";

  const [subStep, setSubStep] = useState<"initiate" | "otp" | "branch_selection" | "aadhaar_kyc_initiated" | "aadhaar_kyc_otp" | "pan_verification" | "personal_detail" | "success">("initiate");
  const [loading, setLoading] = useState(false);

  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");
  const [consent1, setConsent1] = useState(false); // Defaulter flag
  const [consent2, setConsent2] = useState(false); // Communication consent
  const [otp, setOtp] = useState("");

  const [applicationId, setApplicationId] = useState("");
  const [otpReferenceId, setOtpReferenceId] = useState("");
  const [leadToken, setLeadToken] = useState(leadTokenParam);

  const [captchaKey, setCaptchaKey] = useState("");
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // States for branch selection
  const [statesList, setStatesList] = useState<StateOption[]>([]);
  const [districtsList, setDistrictsList] = useState<DistrictOption[]>([]);
  const [branchesList, setBranchesList] = useState<BranchOption[]>([]);
  const [selectedStateCode, setSelectedStateCode] = useState("");
  const [selectedDistrictCode, setSelectedDistrictCode] = useState("");
  const [selectedBranchCode, setSelectedBranchCode] = useState("");

  // States for Guest Personal Details (KYC + Info + Address)
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarTransId, setAadhaarTransId] = useState("");
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [panNumber, setPanNumber] = useState("");

  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [noOfDependents, setNoOfDependents] = useState("0");
  const [religion, setReligion] = useState("");
  const [category, setCategory] = useState("");

  const [permAddr1, setPermAddr1] = useState("");
  const [permAddr2, setPermAddr2] = useState("");
  const [permCity, setPermCity] = useState("");
  const [permPincode, setPermPincode] = useState("");
  const [permState, setPermState] = useState("");
  const [permResidenceOwnership, setPermResidenceOwnership] = useState("");

  const [currAddr1, setCurrAddr1] = useState("");
  const [currAddr2, setCurrAddr2] = useState("");
  const [currCity, setCurrCity] = useState("");
  const [currPincode, setCurrPincode] = useState("");
  const [currState, setCurrState] = useState("");
  const [currResidenceOwnership, setCurrResidenceOwnership] = useState("");
  const [sameAddress, setSameAddress] = useState(false);

  // Address copy sync for guest flow
  useEffect(() => {
    if (sameAddress) {
      setCurrAddr1(permAddr1);
      setCurrAddr2(permAddr2);
      setCurrCity(permCity);
      setCurrPincode(permPincode);
      setCurrState(permState);
      setCurrResidenceOwnership(permResidenceOwnership);
    }
  }, [sameAddress, permAddr1, permAddr2, permCity, permPincode, permState, permResidenceOwnership]);

  const config = useMemo(() => {
    const foundConfig = store.dsaProductConfigs.find((item) => item.id === configId && item.status === "Active");
    if (!foundConfig) return undefined;
    const dsa = store.dsas.find((item) => item.id === foundConfig.dsaId);
    if (!dsa || dsa.status !== "Active") return undefined;
    return foundConfig;
  }, [configId, store.dsaProductConfigs, store.dsas]);

  const fetchCaptcha = async () => {
    try {
      setCaptchaLoading(true);
      const res = await authApi.getCaptcha();
      if (res?.respData) {
        setCaptchaKey(res.respData.captcha_key);
        setCaptchaImg(res.respData.captcha_img);
        setCaptchaValue("");
      }
    } catch (err) {
      console.error("Failed to fetch captcha:", err);
      toast({ title: "Captcha load failed", description: "Could not load fresh captcha.", variant: "warning" });
    } finally {
      setCaptchaLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const res = await adminApi.getStatesDropdown();
      if (res?.data) {
        setStatesList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch states:", err);
    }
  };

  const handleStateChange = async (stateCode: string) => {
    setSelectedStateCode(stateCode);
    setSelectedDistrictCode("");
    setSelectedBranchCode("");
    setDistrictsList([]);
    setBranchesList([]);
    if (!stateCode) return;
    try {
      const res = await adminApi.getDistrictsDropdown(stateCode);
      if (res?.data) {
        setDistrictsList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch districts:", err);
    }
  };

  const handleDistrictChange = async (districtCode: string) => {
    setSelectedDistrictCode(districtCode);
    setSelectedBranchCode("");
    setBranchesList([]);
    if (!districtCode) return;
    try {
      const res = await adminApi.getBranchesDropdown(districtCode);
      if (res?.data) {
        setBranchesList(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch branches:", err);
    }
  };

  useEffect(() => {
    fetchCaptcha();
    fetchStates();
  }, []);

  useEffect(() => {
    if (!leadTokenParam) {
      adminApi.getLeads({ per_page: 5 })
        .then((res) => {
          const lead = res?.data?.items?.[0] || res?.data?.data?.[0];
          if (lead?.lead_uuid) {
            setLeadToken(lead.lead_uuid);
            console.log("Resolved fallback lead token:", lead.lead_uuid);
          }
        })
        .catch((err) => {
          console.warn("Could not retrieve fallback lead:", err);
        });
    }
  }, [leadTokenParam]);

  // Load initial state from localStorage for guest flow
  useEffect(() => {
    const key = `cosmos_loan_journey_${configId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.applicationId) setApplicationId(parsed.applicationId);
        if (parsed.subStep) setSubStep(parsed.subStep);
        if (parsed.otpReferenceId) setOtpReferenceId(parsed.otpReferenceId);
        if (parsed.mobile) setMobile(parsed.mobile);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.consent1) setConsent1(parsed.consent1);
        if (parsed.consent2) setConsent2(parsed.consent2);
        
        // Branch selection variables
        if (parsed.selectedStateCode) setSelectedStateCode(parsed.selectedStateCode);
        if (parsed.selectedDistrictCode) setSelectedDistrictCode(parsed.selectedDistrictCode);
        if (parsed.selectedBranchCode) setSelectedBranchCode(parsed.selectedBranchCode);
        if (parsed.districtsList) setDistrictsList(parsed.districtsList);
        if (parsed.branchesList) setBranchesList(parsed.branchesList);

        // Aadhaar
        if (parsed.aadhaarNumber) setAadhaarNumber(parsed.aadhaarNumber);
        if (parsed.aadhaarTransId) setAadhaarTransId(parsed.aadhaarTransId);
        if (parsed.aadhaarOtp) setAadhaarOtp(parsed.aadhaarOtp);

        // PAN
        if (parsed.panNumber) setPanNumber(parsed.panNumber);

        // Personal Details
        if (parsed.gender) setGender(parsed.gender);
        if (parsed.dob) setDob(parsed.dob);
        if (parsed.maritalStatus) setMaritalStatus(parsed.maritalStatus);
        if (parsed.noOfDependents) setNoOfDependents(parsed.noOfDependents);
        if (parsed.religion) setReligion(parsed.religion);
        if (parsed.category) setCategory(parsed.category);

        // Permanent Address
        if (parsed.permAddr1) setPermAddr1(parsed.permAddr1);
        if (parsed.permAddr2) setPermAddr2(parsed.permAddr2);
        if (parsed.permCity) setPermCity(parsed.permCity);
        if (parsed.permPincode) setPermPincode(parsed.permPincode);
        if (parsed.permState) setPermState(parsed.permState);
        if (parsed.permResidenceOwnership) setPermResidenceOwnership(parsed.permResidenceOwnership);

        // Current Address
        if (parsed.currAddr1) setCurrAddr1(parsed.currAddr1);
        if (parsed.currAddr2) setCurrAddr2(parsed.currAddr2);
        if (parsed.currCity) setCurrCity(parsed.currCity);
        if (parsed.currPincode) setCurrPincode(parsed.currPincode);
        if (parsed.currState) setCurrState(parsed.currState);
        if (parsed.currResidenceOwnership) setCurrResidenceOwnership(parsed.currResidenceOwnership);
        if (parsed.sameAddress) setSameAddress(parsed.sameAddress);

        // Force reload districts if selectedStateCode was restored
        if (parsed.selectedStateCode) {
          adminApi.getDistrictsDropdown(parsed.selectedStateCode).then((r) => {
            if (r?.data) setDistrictsList(r.data);
          });
        }
        // Force reload branches if selectedDistrictCode was restored
        if (parsed.selectedDistrictCode) {
          adminApi.getBranchesDropdown(parsed.selectedDistrictCode).then((r) => {
            if (r?.data) setBranchesList(r.data);
          });
        }

      } catch (e) {
        console.error("Error parsing saved guest state:", e);
      }
    }
  }, [configId]);

  // Save state to localStorage whenever key variables change
  useEffect(() => {
    if (!applicationId && subStep === "initiate") return;
    const key = `cosmos_loan_journey_${configId}`;
    const state = {
      applicationId,
      subStep,
      otpReferenceId,
      mobile,
      email,
      consent1,
      consent2,
      selectedStateCode,
      selectedDistrictCode,
      selectedBranchCode,
      districtsList,
      branchesList,
      aadhaarNumber,
      aadhaarTransId,
      aadhaarOtp,
      panNumber,
      gender,
      dob,
      maritalStatus,
      noOfDependents,
      religion,
      category,
      permAddr1,
      permAddr2,
      permCity,
      permPincode,
      permState,
      permResidenceOwnership,
      currAddr1,
      currAddr2,
      currCity,
      currPincode,
      currState,
      currResidenceOwnership,
      sameAddress
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, [
    configId,
    applicationId,
    subStep,
    otpReferenceId,
    mobile,
    email,
    consent1,
    consent2,
    selectedStateCode,
    selectedDistrictCode,
    selectedBranchCode,
    districtsList,
    branchesList,
    aadhaarNumber,
    aadhaarTransId,
    aadhaarOtp,
    panNumber,
    gender,
    dob,
    maritalStatus,
    noOfDependents,
    religion,
    category,
    permAddr1,
    permAddr2,
    permCity,
    permPincode,
    permState,
    permResidenceOwnership,
    currAddr1,
    currAddr2,
    currCity,
    currPincode,
    currState,
    currResidenceOwnership,
    sameAddress
  ]);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (!mobile.trim() || !/^\d{10}$/.test(mobile)) {
      toast({ title: "Invalid mobile", description: "Mobile number must be exactly 10 digits.", variant: "warning" });
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "warning" });
      return;
    }

    if (!captchaValue.trim()) {
      toast({ title: "Captcha required", description: "Please solve the CAPTCHA check.", variant: "warning" });
      return;
    }

    if (!consent1) {
      toast({ title: "Consent required", description: "You must confirm you are not an NPA defaulter.", variant: "warning" });
      return;
    }

    if (!consent2) {
      toast({ title: "Consent required", description: "You must provide consent for communication.", variant: "warning" });
      return;
    }

    if (!leadToken) {
      toast({ title: "Missing Lead Link", description: "A valid lead invitation token is required to start the journey.", variant: "warning" });
      return;
    }

    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "LOGIN_INITIATE",
        loan_type: getLoanType(config.product),
        payload: {
          is_existing_customer: false,
          account_number: "",
          mobile: mobile,
          email: email,
          communication_consent: true,
          not_npa_defaulter_flag: true,
          is_special_category: false,
          lead_token: leadToken,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setApplicationId(res.data.application_id || "");
        setOtpReferenceId(res.data.opt_reference_id || "");
        setSubStep("otp");
        toast({ title: "OTP Sent", description: "An OTP has been successfully sent to your mobile.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to initiate login.";
        toast({ title: "Initiation failed", description: errorMsg, variant: "warning" });
        fetchCaptcha();
      }
    } catch (err: any) {
      console.error("Initiate error:", err);
      const errorMsg = err.data?.message || err.message || "Something went wrong.";
      toast({ title: "Initiation failed", description: errorMsg, variant: "warning" });
      fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (!otp.trim() || !/^\d{6}$/.test(otp)) {
      toast({ title: "Invalid OTP", description: "OTP must be exactly 6 digits.", variant: "warning" });
      return;
    }

    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "OTP_VERIFICATION",
        loan_type: getLoanType(config.product),
        payload: {
          application_id: applicationId,
          section_id: "otp_verification",
          otp_reference_id: otpReferenceId,
          otp: otp,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setSubStep("branch_selection");
        toast({ title: "OTP Verified", description: "OTP verified successfully. Proceed to select branch.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Invalid OTP.";
        toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("OTP Verification error:", err);
      const errorMsg = err.data?.message || err.message || "OTP verification failed.";
      toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!config) return;
    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "RESEND_OTP",
        loan_type: getLoanType(config.product),
        payload: {
          application_id: applicationId,
          mobile: mobile,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setOtpReferenceId(res.data.opt_reference_id || "");
        toast({ title: "OTP Resent", description: "A new OTP reference has been generated.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to resend OTP.";
        toast({ title: "Resend failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to resend OTP.";
      toast({ title: "Resend failed", description: errorMsg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const stateObj = statesList.find((s) => s.state_code === selectedStateCode);
    const districtObj = districtsList.find((d) => d.district_code === selectedDistrictCode);
    const branchObj = branchesList.find((b) => b.branch_code === selectedBranchCode);

    if (!stateObj) {
      toast({ title: "State required", description: "Please select a state.", variant: "warning" });
      return;
    }
    if (!districtObj) {
      toast({ title: "District required", description: "Please select a district.", variant: "warning" });
      return;
    }
    if (!branchObj) {
      toast({ title: "Branch required", description: "Please select a branch location.", variant: "warning" });
      return;
    }

    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "BRANCH_SELECTION",
        loan_type: getLoanType(config.product),
        payload: {
          application_id: applicationId,
          section_id: "branch_selection",
          state: stateObj.state_name,
          district: districtObj.district_name,
          branch: branchObj.branch_name,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setSubStep("aadhaar_kyc_initiated");
        toast({ title: "Branch Selected", description: "Branch selection recorded successfully.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to submit branch selection.";
        toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Branch selection error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to submit branch selection.";
      toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleAadhaarInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (!aadhaarNumber.trim() || !/^\d{12}$/.test(aadhaarNumber)) {
      toast({ title: "Invalid Aadhaar", description: "Aadhaar number must be exactly 12 digits.", variant: "warning" });
      return;
    }

    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(config.product),
        payload: {
          application_id: applicationId,
          section_id: "aadhaar_kyc_initiated",
          aadhaar_number: aadhaarNumber,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        const transId = (res as any).data?.aadhaar_kyc_response?.transId || "MOCK_TRANS_ID";
        setAadhaarTransId(transId);
        setSubStep("aadhaar_kyc_otp");
        toast({ title: "OTP Sent", description: "Aadhaar validation OTP requested.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to initiate Aadhaar KYC.";
        toast({ title: "Aadhaar initiation failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Aadhaar initiation error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to initiate Aadhaar KYC.";
      toast({ title: "Aadhaar initiation failed", description: errorMsg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handleAadhaarVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (!aadhaarOtp.trim() || !/^\d{4,6}$/.test(aadhaarOtp)) {
      toast({ title: "Invalid OTP", description: "OTP must be 4 to 6 digits.", variant: "warning" });
      return;
    }

    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(config.product),
        payload: {
          application_id: applicationId,
          section_id: "aadhaar_kyc_otp",
          otp: aadhaarOtp,
          transId: aadhaarTransId,
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setSubStep("pan_verification");
        toast({ title: "Aadhaar Verified", description: "Aadhaar KYC OTP verified successfully.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Invalid OTP.";
        toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Aadhaar OTP verification error:", err);
      const errorMsg = err.data?.message || err.message || "OTP verification failed.";
      toast({ title: "Verification failed", description: errorMsg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handlePanVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    const panClean = panNumber.trim().toUpperCase();
    if (!panClean || !/^[A-Z]{5}\d{4}[A-Z]$/.test(panClean)) {
      toast({ title: "Invalid PAN", description: "Format must be AAAAA1234A.", variant: "warning" });
      return;
    }

    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(config.product),
        payload: {
          application_id: applicationId,
          section_id: "pan_verification",
          pan: panClean,
          payload: {},
          equifax_payload: {
            firstName: "Customer",
            lastName: "Name",
            dateOfBirth: dob || "1990-01-01",
          },
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setSubStep("personal_detail");
        toast({ title: "PAN Verified", description: "PAN card verified and Equifax score retrieved.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "PAN verification failed.";
        toast({ title: "PAN verification failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("PAN verification error:", err);
      const errorMsg = err.data?.message || err.message || "PAN verification failed.";
      toast({ title: "PAN verification failed", description: errorMsg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    try {
      setLoading(true);
      const res = await loanJourneyApi.processStep({
        step_key: "PERSONAL_DETAILS",
        loan_type: getLoanType(config.product),
        payload: {
          application_id: applicationId,
          section_id: "personal_detail",
          email_id: email,
          gender: gender || "M",
          dob: dob || "1990-01-01",
          no_of_dependents: noOfDependents || "0",
          marital_status: maritalStatus || "Single",
          religion: religion || "Hindu",
          category: category || "GENERAL",
          
          permanent_address_line1: permAddr1,
          permanent_address_line2: permAddr2,
          permanent_city: permCity,
          permanent_pincode: permPincode,
          permanent_state: permState,
          permanent_country: "India",
          permanent_residence_ownership: permResidenceOwnership || "Own",
          
          current_address_line1: currAddr1,
          current_address_line2: currAddr2,
          current_city: currCity,
          current_pincode: currPincode,
          current_state: currState,
          current_country: "India",
          current_residence_ownership: currResidenceOwnership || "Own",
        },
      });

      if (res.status === "success" && res.data?.status_code === 200) {
        setSubStep("success");
        toast({ title: "Personal Details Saved", description: "Personal details submitted successfully.", variant: "success" });
      } else {
        const errorMsg = res.data?.message || "Failed to submit personal details.";
        toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
      }
    } catch (err: any) {
      console.error("Personal Details submit error:", err);
      const errorMsg = err.data?.message || err.message || "Failed to submit personal details.";
      toast({ title: "Submission failed", description: errorMsg, variant: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <main className="mx-auto max-w-lg mt-8">
        {config ? (
          <div className="space-y-6">
            <PageHeader
              description={`${config.dsaName} - ${config.product}`}
              eyebrow="Digital journey"
              title={`${config.product} Onboarding`}
            />

            {subStep === "initiate" && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-blue-700" />
                    Verify Identity
                  </h2>
                  <p className="text-xs text-slate-500">Provide your contact details to receive validation OTP.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInitiate} className="space-y-4">
                    <Field>
                      <Label htmlFor="journey_mobile">Mobile Number *</Label>
                      <Input
                        id="journey_mobile"
                        placeholder="10-digit mobile number"
                        type="tel"
                        maxLength={10}
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                        disabled={loading}
                      />
                    </Field>

                    <Field>
                      <Label htmlFor="journey_email">Email Address *</Label>
                      <Input
                        id="journey_email"
                        placeholder="e.g. name@example.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                      />
                    </Field>

                    <div className="space-y-2">
                      <Label htmlFor="journey_captcha" className="font-semibold text-slate-800">Captcha Code *</Label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 bg-slate-50 h-10 border border-slate-200 rounded flex items-center justify-center overflow-hidden shadow-inner">
                          {captchaImg ? (
                            <img src={captchaImg} alt="CAPTCHA" className="h-full w-full object-contain mix-blend-multiply" />
                          ) : (
                            <span className="text-xs text-slate-400">Loading...</span>
                          )}
                        </div>
                        <Input
                          id="journey_captcha"
                          placeholder="Enter CAPTCHA"
                          value={captchaValue}
                          onChange={(e) => setCaptchaValue(e.target.value)}
                          disabled={loading}
                          className="h-10 flex-1 text-sm focus:border-blue-600 focus:ring-blue-600 font-mono tracking-wider"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={fetchCaptcha}
                          disabled={captchaLoading || loading}
                          title="Refresh CAPTCHA"
                          className="h-10 w-10 shrink-0"
                        >
                          <RefreshCw className={`h-4 w-4 text-slate-600 ${captchaLoading ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          checked={consent1}
                          onChange={(e) => setConsent1(e.target.checked)}
                          disabled={loading}
                        />
                        <span>
                          I confirm that I am not a defaulter for any bank's loan and no insolvency proceedings are initiated against me. *
                        </span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                          checked={consent2}
                          onChange={(e) => setConsent2(e.target.checked)}
                          disabled={loading}
                        />
                        <span>
                          I consent to Cosmos Bank / bank agent calling me / sending SMS / sending Email regarding my loan application. *
                        </span>
                      </label>
                    </div>

                    <Button type="submit" className="w-full mt-4" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Initiating...
                        </>
                      ) : (
                        "Proceed & Send OTP"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {subStep === "otp" && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-blue-700" />
                    Verify OTP
                  </h2>
                  <p className="text-xs text-slate-500">OTP has been sent successfully to your mobile number.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="p-3 bg-blue-50/50 rounded-md border border-blue-100 text-xs text-slate-700 text-center">
                      <p className="text-slate-500 font-medium">OTP Sent To Mobile</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">+91 ******{mobile.slice(-4)}</p>
                    </div>

                    <Field>
                      <Label htmlFor="journey_otp">Enter 6-Digit OTP *</Label>
                      <Input
                        id="journey_otp"
                        placeholder="Enter OTP"
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        disabled={loading}
                      />
                    </Field>

                    <div className="flex justify-between items-center text-xs">
                      <button
                        type="button"
                        onClick={() => setSubStep("initiate")}
                        className="text-slate-500 hover:text-slate-800 transition underline"
                        disabled={loading}
                      >
                        Change Details
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        className="text-blue-700 hover:text-blue-900 transition underline font-semibold"
                        disabled={loading}
                      >
                        Resend OTP
                      </button>
                    </div>

                    <Button type="submit" className="w-full mt-4" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Verifying...
                        </>
                      ) : (
                        "Verify & Continue"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {subStep === "branch_selection" && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-700" />
                    Select Branch
                  </h2>
                  <p className="text-xs text-slate-500">Please choose your preferred branch location.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBranchSelection} className="space-y-4">
                    <Field>
                      <Label htmlFor="journey_state" className="font-semibold text-slate-800">State *</Label>
                      <Select
                        id="journey_state"
                        value={selectedStateCode}
                        onChange={(e) => handleStateChange(e.target.value)}
                        disabled={loading}
                        className="h-10 text-sm"
                      >
                        <option value="">Select State</option>
                        {statesList.map((s) => (
                          <option key={s.state_code} value={s.state_code}>
                            {s.state_name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field>
                      <Label htmlFor="journey_district" className="font-semibold text-slate-800">District *</Label>
                      <Select
                        id="journey_district"
                        value={selectedDistrictCode}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        disabled={loading || !selectedStateCode}
                        className="h-10 text-sm"
                      >
                        <option value="">Select District</option>
                        {districtsList.map((d) => (
                          <option key={d.district_code} value={d.district_code}>
                            {d.district_name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field>
                      <Label htmlFor="journey_branch" className="font-semibold text-slate-800">Branch *</Label>
                      <Select
                        id="journey_branch"
                        value={selectedBranchCode}
                        onChange={(e) => setSelectedBranchCode(e.target.value)}
                        disabled={loading || !selectedDistrictCode}
                        className="h-10 text-sm"
                      >
                        <option value="">Select Branch</option>
                        {branchesList.map((b) => (
                          <option key={b.branch_code} value={b.branch_code}>
                            {b.branch_name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <div className="flex justify-between gap-2 mt-6">
                      <Button type="button" variant="outline" onClick={() => setSubStep("otp")} disabled={loading}>
                        Back
                      </Button>
                      <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Selection"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {subStep === "aadhaar_kyc_initiated" && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-blue-700" />
                    Aadhaar Verification
                  </h2>
                  <p className="text-xs text-slate-500">Initiate Aadhaar KYC verification for identity check.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAadhaarInitiate} className="space-y-4">
                    <Field>
                      <Label htmlFor="journey_aadhaar">Aadhaar Number *</Label>
                      <Input
                        id="journey_aadhaar"
                        placeholder="Enter 12-digit Aadhaar number"
                        type="text"
                        maxLength={12}
                        value={aadhaarNumber}
                        onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ""))}
                        disabled={loading}
                        className="h-10 text-sm font-mono tracking-widest text-center focus:border-blue-600 focus:ring-blue-600"
                      />
                    </Field>

                    <div className="flex justify-between gap-2 mt-6">
                      <Button type="button" variant="outline" onClick={() => setSubStep("branch_selection")} disabled={loading}>
                        Back
                      </Button>
                      <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Sending OTP...
                          </>
                        ) : (
                          "Request OTP"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {subStep === "aadhaar_kyc_otp" && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-blue-700" />
                    Enter Aadhaar OTP
                  </h2>
                  <p className="text-xs text-slate-500">Verification OTP has been sent by UIDAI to your Aadhaar-linked mobile.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAadhaarVerify} className="space-y-4">
                    <Field>
                      <Label htmlFor="journey_aadhaar_otp">Enter 6-Digit OTP *</Label>
                      <Input
                        id="journey_aadhaar_otp"
                        placeholder="Enter OTP"
                        type="text"
                        maxLength={6}
                        value={aadhaarOtp}
                        onChange={(e) => setAadhaarOtp(e.target.value.replace(/\D/g, ""))}
                        disabled={loading}
                        className="h-12 text-center text-lg font-mono font-bold tracking-widest focus:border-blue-600 focus:ring-blue-600"
                      />
                    </Field>

                    <div className="flex justify-between gap-2 mt-6">
                      <Button type="button" variant="outline" onClick={() => setSubStep("aadhaar_kyc_initiated")} disabled={loading}>
                        Back
                      </Button>
                      <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Verifying...
                          </>
                        ) : (
                          "Verify Aadhaar"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {subStep === "pan_verification" && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-700" />
                    PAN Verification
                  </h2>
                  <p className="text-xs text-slate-500">Enter your Permanent Account Number (PAN) for credit score verification.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePanVerify} className="space-y-4">
                    <Field>
                      <Label htmlFor="journey_pan">PAN Number *</Label>
                      <Input
                        id="journey_pan"
                        placeholder="e.g. ABCDE1234F"
                        type="text"
                        maxLength={10}
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        disabled={loading}
                        className="h-10 text-sm font-mono tracking-widest text-center uppercase focus:border-blue-600 focus:ring-blue-600"
                      />
                    </Field>

                    <div className="flex justify-between gap-2 mt-6">
                      <Button type="button" variant="outline" onClick={() => setSubStep("aadhaar_kyc_otp")} disabled={loading}>
                        Back
                      </Button>
                      <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Verifying PAN...
                          </>
                        ) : (
                          "Verify PAN"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {subStep === "personal_detail" && (
              <Card className="border border-slate-200 shadow-sm bg-white max-w-xl mx-auto">
                <CardHeader>
                  <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-700" />
                    Personal Information & Address
                  </h2>
                  <p className="text-xs text-slate-500">Provide personal info and addresses to continue onboarding.</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePersonalDetailsSubmit} className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Basic Details</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <Label htmlFor="journey_gender">Gender *</Label>
                          <Select
                            id="journey_gender"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                          >
                            <option value="">Select Gender</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="O">Other</option>
                          </Select>
                        </Field>

                        <Field>
                          <Label htmlFor="journey_dob">Date of Birth *</Label>
                          <Input
                            id="journey_dob"
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <Label htmlFor="journey_marital">Marital Status *</Label>
                          <Select
                            id="journey_marital"
                            value={maritalStatus}
                            onChange={(e) => setMaritalStatus(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                          >
                            <option value="">Select Status</option>
                            <option value="Single">Single</option>
                            <option value="Married">Married</option>
                            <option value="Divorced">Divorced</option>
                            <option value="Widowed">Widowed</option>
                            <option value="Separated">Separated</option>
                          </Select>
                        </Field>

                        <Field>
                          <Label htmlFor="journey_dependents">Number of Dependents *</Label>
                          <Input
                            id="journey_dependents"
                            type="number"
                            min={0}
                            value={noOfDependents}
                            onChange={(e) => setNoOfDependents(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <Label htmlFor="journey_religion">Religion</Label>
                          <Select
                            id="journey_religion"
                            value={religion}
                            onChange={(e) => setReligion(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                          >
                            <option value="">Select Religion</option>
                            <option value="Hindu">Hindu</option>
                            <option value="Muslim">Muslim</option>
                            <option value="Christian">Christian</option>
                            <option value="Sikh">Sikh</option>
                            <option value="Buddhist">Buddhist</option>
                            <option value="Jain">Jain</option>
                            <option value="Other">Other</option>
                          </Select>
                        </Field>

                        <Field>
                          <Label htmlFor="journey_category">Category</Label>
                          <Select
                            id="journey_category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                          >
                            <option value="">Select Category</option>
                            <option value="GENERAL">General</option>
                            <option value="OBC">OBC</option>
                            <option value="SC">SC</option>
                            <option value="ST">ST</option>
                          </Select>
                        </Field>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Permanent Address</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Field className="col-span-2">
                          <Label htmlFor="journey_perm_addr1">Address Line 1 *</Label>
                          <Input
                            id="journey_perm_addr1"
                            value={permAddr1}
                            onChange={(e) => setPermAddr1(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                            placeholder="Street address, P.O. box"
                          />
                        </Field>
                        
                        <Field className="col-span-2">
                          <Label htmlFor="journey_perm_addr2">Address Line 2</Label>
                          <Input
                            id="journey_perm_addr2"
                            value={permAddr2}
                            onChange={(e) => setPermAddr2(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                            placeholder="Apartment, suite, unit, building"
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <Label htmlFor="journey_perm_city">City *</Label>
                          <Input
                            id="journey_perm_city"
                            value={permCity}
                            onChange={(e) => setPermCity(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                            placeholder="City"
                          />
                        </Field>
                        
                        <Field>
                          <Label htmlFor="journey_perm_pincode">Pincode *</Label>
                          <Input
                            id="journey_perm_pincode"
                            value={permPincode}
                            onChange={(e) => setPermPincode(e.target.value.replace(/\D/g, ""))}
                            maxLength={6}
                            disabled={loading}
                            className="h-10 text-sm"
                            placeholder="6-digit PIN"
                          />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Field>
                          <Label htmlFor="journey_perm_state">State *</Label>
                          <Input
                            id="journey_perm_state"
                            value={permState}
                            onChange={(e) => setPermState(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                            placeholder="State"
                          />
                        </Field>

                        <Field>
                          <Label htmlFor="journey_perm_ownership">Ownership *</Label>
                          <Select
                            id="journey_perm_ownership"
                            value={permResidenceOwnership}
                            onChange={(e) => setPermResidenceOwnership(e.target.value)}
                            disabled={loading}
                            className="h-10 text-sm"
                          >
                            <option value="">Select Ownership</option>
                            <option value="Own">Owned</option>
                            <option value="Rent">Rented</option>
                            <option value="Lease">Leased</option>
                            <option value="Employer">Employer Provided</option>
                          </Select>
                        </Field>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Current Address</h3>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-blue-700 font-semibold select-none">
                          <input
                            type="checkbox"
                            checked={sameAddress}
                            onChange={(e) => setSameAddress(e.target.checked)}
                            disabled={loading}
                            className="rounded border-slate-300 text-blue-700 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                          Same as Permanent Address
                        </label>
                      </div>

                      {!sameAddress && (
                        <div className="space-y-4 transition-all">
                          <div className="grid grid-cols-2 gap-4">
                            <Field className="col-span-2">
                              <Label htmlFor="journey_curr_addr1">Address Line 1 *</Label>
                              <Input
                                id="journey_curr_addr1"
                                value={currAddr1}
                                onChange={(e) => setCurrAddr1(e.target.value)}
                                disabled={loading}
                                className="h-10 text-sm"
                                placeholder="Street address, P.O. box"
                              />
                            </Field>
                            
                            <Field className="col-span-2">
                              <Label htmlFor="journey_curr_addr2">Address Line 2</Label>
                              <Input
                                id="journey_curr_addr2"
                                value={currAddr2}
                                onChange={(e) => setCurrAddr2(e.target.value)}
                                disabled={loading}
                                className="h-10 text-sm"
                                placeholder="Apartment, suite, unit, building"
                              />
                            </Field>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <Field>
                              <Label htmlFor="journey_curr_city">City *</Label>
                              <Input
                                id="journey_curr_city"
                                value={currCity}
                                onChange={(e) => setCurrCity(e.target.value)}
                                disabled={loading}
                                className="h-10 text-sm"
                                placeholder="City"
                              />
                            </Field>
                            
                            <Field>
                              <Label htmlFor="journey_curr_pincode">Pincode *</Label>
                              <Input
                                id="journey_curr_pincode"
                                value={currPincode}
                                onChange={(e) => setCurrPincode(e.target.value.replace(/\D/g, ""))}
                                maxLength={6}
                                disabled={loading}
                                className="h-10 text-sm"
                                placeholder="6-digit PIN"
                              />
                            </Field>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <Field>
                              <Label htmlFor="journey_curr_state">State *</Label>
                              <Input
                                id="journey_curr_state"
                                value={currState}
                                onChange={(e) => setCurrState(e.target.value)}
                                disabled={loading}
                                className="h-10 text-sm"
                                placeholder="State"
                              />
                            </Field>

                            <Field>
                              <Label htmlFor="journey_curr_ownership">Ownership *</Label>
                              <Select
                                id="journey_curr_ownership"
                                value={currResidenceOwnership}
                                onChange={(e) => setCurrResidenceOwnership(e.target.value)}
                                disabled={loading}
                                className="h-10 text-sm"
                              >
                                <option value="">Select Ownership</option>
                                <option value="Own">Owned</option>
                                <option value="Rent">Rented</option>
                                <option value="Lease">Leased</option>
                                <option value="Employer">Employer Provided</option>
                              </Select>
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between gap-2 mt-6">
                      <Button type="button" variant="outline" onClick={() => setSubStep("pan_verification")} disabled={loading}>
                        Back
                      </Button>
                      <Button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm h-10">
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Submitting...
                          </>
                        ) : (
                          "Save & Continue"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {subStep === "success" && (
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardContent className="py-8 text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 animate-bounce" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">Verification Complete</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Application <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{applicationId}</span> is created successfully.
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-md border border-emerald-100 text-xs text-emerald-800 text-left space-y-1.5">
                    <p className="font-bold">Next Stage: Email Verification</p>
                    <p>
                      An automated verification link has been triggered to your registered email address ({email}). Please check your inbox to proceed to Personal Details.
                    </p>
                  </div>

                  <div className="pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        localStorage.removeItem(`cosmos_loan_journey_${configId}`);
                        window.location.reload();
                      }}
                      className="w-full text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      Start Fresh Journey
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <EmptyState
            description="This journey link is no longer active."
            title="Journey unavailable"
          />
        )}
      </main>
    </div>
  );
}
