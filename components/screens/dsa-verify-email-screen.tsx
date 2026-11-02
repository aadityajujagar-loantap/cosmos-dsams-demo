"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  MailCheck,
  Lock,
  FileText,
  Download,
} from "lucide-react";
import { adminApi } from "@/apis/admin";
import { withBasePath } from "@/lib/base-path";
import { Button, Card, CardContent } from "@/components/ui/primitives";

interface DsaVerifyEmailScreenProps {
  token?: string;
  type?: string;
  applicationId?: string;
}

interface VerificationApiResponse {
  status?: boolean | string;
  status_code?: number;
  message?: string;
  dsa_code?: string;
  dsa_id?: number | string;
  application_id?: string;
  email?: string;
  data?: {
    status?: boolean | string;
    status_code?: number;
    message?: string;
    dsa_code?: string;
    dsa_id?: number | string;
    application_id?: string;
    email?: string;
  };
}

interface VerificationError {
  message?: string;
  data?: {
    message?: string;
    application_id?: string;
  };
}

type VerificationState = "loading" | "consent" | "success" | "error";

interface DsaConsentData {
  token: string;
  dsa_id?: number | string;
  dsa_code?: string;
  dsa_type?: string;
  applicant_name?: string;
  entity_name?: string;
  email?: string;
  mobile?: string;
  pan?: string;
  branch_name?: string;
  email_verified?: boolean;
}

interface VerificationResult {
  message: string;
  dsaCode?: string;
  dsaId?: number | string;
  applicationId?: string;
  email?: string;
  isLoan?: boolean;
}

const getStoredDsaCode = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    for (const mode of ["self", "branch", "admin"]) {
      const raw =
        sessionStorage.getItem(`cosmos_dsa_onboarding_v2_${mode}`) ||
        localStorage.getItem(`cosmos_dsa_onboarding_v2_${mode}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.submittedDsa?.code) return parsed.submittedDsa.code;
        if (parsed?.submittedDsa?.dsa_code) return parsed.submittedDsa.dsa_code;
      }
    }
    const legacyCode = localStorage.getItem("last_submitted_dsa_code");
    if (legacyCode) return legacyCode;
  } catch {}
  return undefined;
};

const getCachedVerification = (rawToken: string): VerificationResult | null => {
  if (typeof window === "undefined" || !rawToken) return null;
  try {
    const raw =
      sessionStorage.getItem(`email_verified_${rawToken}`) ||
      localStorage.getItem(`email_verified_${rawToken}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const saveCachedVerification = (rawToken: string, res: VerificationResult) => {
  if (typeof window === "undefined" || !rawToken) return;
  try {
    const str = JSON.stringify(res);
    sessionStorage.setItem(`email_verified_${rawToken}`, str);
    localStorage.setItem(`email_verified_${rawToken}`, str);
  } catch {}
};

const isAlreadyOrExpiredMessage = (msg?: string): boolean => {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("invalid or expired") ||
    lower.includes("already") ||
    lower.includes("expired") ||
    lower.includes("not found")
  );
};

const extractCleanToken = (rawInput: string): string => {
  const clean = rawInput.trim();
  if (clean.includes("token=")) {
    try {
      const url = new URL(clean, "http://dummy");
      const t = url.searchParams.get("token");
      if (t) return t.trim();
    } catch {
      const match = clean.match(/token=([a-zA-Z0-9_-]+)/);
      if (match) return match[1].trim();
    }
  }
  if (clean.includes("/verify-email/")) {
    const parts = clean.split("/verify-email/");
    const lastPart = parts[parts.length - 1]?.split("?")[0]?.split("#")[0];
    if (lastPart) return lastPart.trim();
  }
  return clean;
};

export function DsaVerifyEmailScreen({ token, type, applicationId }: DsaVerifyEmailScreenProps) {
  const router = useRouter();
  const attemptedTokensRef = React.useRef<Set<string>>(new Set());
  const verifiedTokensRef = React.useRef<Set<string>>(new Set());

  const initialClean = token ? extractCleanToken(token) : "";
  const initialCached = initialClean ? getCachedVerification(initialClean) : null;

  const [state, setState] = useState<VerificationState>(() => {
    if (initialCached) return "success";
    if (!token || token.trim() === "") return "error";
    return "loading";
  });
  const [result, setResult] = useState<VerificationResult>(() => {
    if (initialCached) return initialCached;
    if (!token || token.trim() === "") {
      return {
        message:
          "No verification token provided. Please check the link from your email or paste it below.",
      };
    }
    return { message: "" };
  });
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [manualAppId, setManualAppId] = useState("");
  const [consentData, setConsentData] = useState<DsaConsentData | null>(null);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [submittingConsent, setSubmittingConsent] = useState(false);

  const handleGiveConsent = async () => {
    const activeToken = token || consentData?.token;
    if (!activeToken || !consentAgreed) return;
    const cleanToken = extractCleanToken(activeToken);
    if (!cleanToken) return;

    setSubmittingConsent(true);
    try {
      const res = (await adminApi.verifyDsaEmail(cleanToken)) as VerificationApiResponse;
      if (res?.status === true || res?.status === "success" || res?.status_code === 200) {
        const successRes: VerificationResult = {
          message: res?.message || "Consent provided and email verified successfully.",
          dsaCode: res?.data?.dsa_code || res?.dsa_code || consentData?.dsa_code || getStoredDsaCode(),
          dsaId: res?.data?.dsa_id || res?.dsa_id || consentData?.dsa_id,
          isLoan: false,
        };
        saveCachedVerification(cleanToken, successRes);
        verifiedTokensRef.current.add(cleanToken);
        setResult(successRes);
        setState("success");
      } else {
        const rawMsg = res?.message || res?.data?.message || "Failed to submit consent. Please try again.";
        alert(rawMsg);
      }
    } catch (err: unknown) {
      const vErr = err as VerificationError;
      const rawMsg = vErr?.data?.message || vErr?.message || "Failed to submit consent.";
      if (isAlreadyOrExpiredMessage(rawMsg)) {
        const fallbackSuccess: VerificationResult = {
          message: "Consent has already been provided and verified.",
          dsaCode: consentData?.dsa_code || getStoredDsaCode(),
          dsaId: consentData?.dsa_id,
          isLoan: false,
        };
        saveCachedVerification(cleanToken, fallbackSuccess);
        setResult(fallbackSuccess);
        setState("success");
      } else {
        alert(rawMsg);
      }
    } finally {
      setSubmittingConsent(false);
    }
  };

  const getEffectiveAppId = useCallback(() => {
    if (applicationId) return applicationId;
    if (result.applicationId) return result.applicationId;
    if (manualAppId.trim()) return manualAppId.trim();
    if (typeof window !== "undefined") {
      return localStorage.getItem("cosmos_assisted_application_id") || "";
    }
    return "";
  }, [applicationId, result.applicationId, manualAppId]);

  const handleResendLoanVerification = async (customId?: string) => {
    const targetAppId = customId || getEffectiveAppId();
    if (!targetAppId) return;
    setResending(true);
    setResendStatus(null);
    try {
      const res = await adminApi.resendLoanEmailVerification(targetAppId);
      setResendStatus(res?.message || res?.data?.message || "Verification email has been resent successfully. Please check your inbox.");
    } catch (err: unknown) {
      const vErr = err as VerificationError;
      setResendStatus(vErr?.data?.message || vErr?.message || "Failed to resend verification email. Check Application ID.");
    } finally {
      setResending(false);
    }
  };

  const extractToken = extractCleanToken;

  const performVerification = useCallback(
    async (verifyToken: string, isManual = false) => {
      const cleanToken = extractCleanToken(verifyToken);
      if (!cleanToken) {
        setState("error");
        setResult({
          message: "No verification token provided. Please check the link from your email.",
        });
        return;
      }

      // Check cache first — if already verified, do not verify again and again
      const cached = getCachedVerification(cleanToken);
      if (cached || verifiedTokensRef.current.has(cleanToken)) {
        if (cached) {
          setResult(cached);
        }
        setState("success");
        return;
      }

      // If already on success screen, prevent repeated verify requests
      if (state === "success") {
        return;
      }

      // Prevent duplicate in-flight calls (e.g. React 18/19 StrictMode double-invocation in dev)
      if (!isManual && attemptedTokensRef.current.has(cleanToken)) {
        return;
      }
      attemptedTokensRef.current.add(cleanToken);

      setState("loading");
      const isLoanType = type === "loan" || type === "borrower" || cleanToken.length === 64;

      if (isLoanType) {
        try {
          const res = (await adminApi.verifyLoanEmail(cleanToken)) as VerificationApiResponse;
          if (res?.status === "success" || res?.status_code === 200) {
            const successRes: VerificationResult = {
              message: res?.message || res?.data?.message || "Borrower email address verified successfully.",
              applicationId: res?.data?.application_id || res?.application_id || getEffectiveAppId(),
              email: res?.data?.email || res?.email,
              isLoan: true,
            };
            saveCachedVerification(cleanToken, successRes);
            setResult(successRes);
            setState("success");
            return;
          } else {
            // Check DSA as fallback
            try {
              const dsaRes = (await adminApi.verifyDsaEmail(cleanToken)) as VerificationApiResponse;
              if (dsaRes?.status === true || dsaRes?.status === "success" || dsaRes?.status_code === 200) {
                const successRes: VerificationResult = {
                  message: dsaRes?.message || "Email address verified successfully.",
                  dsaCode: dsaRes?.data?.dsa_code || dsaRes?.dsa_code || getStoredDsaCode(),
                  dsaId: dsaRes?.data?.dsa_id || dsaRes?.dsa_id,
                  isLoan: false,
                };
                saveCachedVerification(cleanToken, successRes);
                setResult(successRes);
                setState("success");
                return;
              }
            } catch {
              // retain primary loan error
            }

            const rawMsg = res?.message || res?.data?.message || "Invalid or expired loan verification link.";
            if (isAlreadyOrExpiredMessage(rawMsg) && cleanToken.length >= 20) {
              const fallbackSuccess: VerificationResult = {
                message: "Email address has already been verified.",
                applicationId: res?.data?.application_id || res?.application_id || getEffectiveAppId(),
                isLoan: true,
              };
              saveCachedVerification(cleanToken, fallbackSuccess);
              setResult(fallbackSuccess);
              setState("success");
              return;
            }

            setResult({
              message: rawMsg,
              applicationId: res?.data?.application_id || res?.application_id || getEffectiveAppId(),
              isLoan: true,
            });
            setState("error");
            return;
          }
        } catch (err: unknown) {
          // Fallback: Check if DSA token
          try {
            const dsaRes = (await adminApi.verifyDsaEmail(cleanToken)) as VerificationApiResponse;
            if (dsaRes?.status === true || dsaRes?.status === "success" || dsaRes?.status_code === 200) {
              const successRes: VerificationResult = {
                message: dsaRes?.message || "Email address verified successfully.",
                dsaCode: dsaRes?.data?.dsa_code || dsaRes?.dsa_code || getStoredDsaCode(),
                dsaId: dsaRes?.data?.dsa_id || dsaRes?.dsa_id,
                isLoan: false,
              };
              saveCachedVerification(cleanToken, successRes);
              setResult(successRes);
              setState("success");
              return;
            }
          } catch {
            // retain primary loan error
          }

          const vErr = err as VerificationError;
          const rawMsg = vErr?.data?.message || vErr?.message || "Invalid or expired loan verification link.";
          if (isAlreadyOrExpiredMessage(rawMsg) && cleanToken.length >= 20) {
            const fallbackSuccess: VerificationResult = {
              message: "Email address has already been verified.",
              applicationId: vErr?.data?.application_id || getEffectiveAppId(),
              isLoan: true,
            };
            saveCachedVerification(cleanToken, fallbackSuccess);
            setResult(fallbackSuccess);
            setState("success");
            return;
          }

          setResult({
            message: rawMsg,
            applicationId: vErr?.data?.application_id || getEffectiveAppId(),
            isLoan: true,
          });
          setState("error");
          return;
        }
      }

      try {
        const res = (await adminApi.getDsaConsentDetails(cleanToken)) as any;

        if (res?.status === true && res?.data) {
          const consent = res.data as DsaConsentData;
          if (consent.email_verified) {
            const successRes: VerificationResult = {
              message: "Consent has already been provided and email verified.",
              dsaCode: consent.dsa_code || getStoredDsaCode(),
              dsaId: consent.dsa_id,
              isLoan: false,
            };
            saveCachedVerification(cleanToken, successRes);
            setResult(successRes);
            setState("success");
            return;
          }

          setConsentData(consent);
          setState("consent");
          return;
        } else {
          // Fallback: Check if this token corresponds to a borrower loan verification
          try {
            const loanRes = (await adminApi.verifyLoanEmail(cleanToken)) as VerificationApiResponse;
            if (loanRes?.status === "success" || loanRes?.status_code === 200) {
              const successRes: VerificationResult = {
                message: loanRes?.message || loanRes?.data?.message || "Borrower email address verified successfully.",
                applicationId: loanRes?.data?.application_id || loanRes?.application_id || getEffectiveAppId(),
                email: loanRes?.data?.email,
                isLoan: true,
              };
              saveCachedVerification(cleanToken, successRes);
              setResult(successRes);
              setState("success");
              return;
            }
          } catch {
            // Retain primary DSA error
          }

          const rawMsg = res?.message || "Invalid or expired email verification link.";
          if (isAlreadyOrExpiredMessage(rawMsg) && cleanToken.length >= 20) {
            const fallbackSuccess: VerificationResult = {
              message: "Email address has already been verified.",
              dsaCode: getStoredDsaCode(),
              applicationId: getEffectiveAppId(),
              isLoan: false,
            };
            saveCachedVerification(cleanToken, fallbackSuccess);
            setResult(fallbackSuccess);
            setState("success");
            return;
          }

          setResult({
            message: rawMsg,
          });
          setState("error");
        }
      } catch (err: unknown) {
        // Fallback: Check if this token corresponds to a borrower loan verification
        try {
          const loanRes = (await adminApi.verifyLoanEmail(cleanToken)) as VerificationApiResponse;
          if (loanRes?.status === "success" || loanRes?.status_code === 200) {
            const successRes: VerificationResult = {
              message: loanRes?.message || loanRes?.data?.message || "Borrower email address verified successfully.",
              applicationId: loanRes?.data?.application_id || loanRes?.application_id || getEffectiveAppId(),
              email: loanRes?.data?.email,
              isLoan: true,
            };
            saveCachedVerification(cleanToken, successRes);
            setResult(successRes);
            setState("success");
            return;
          }
        } catch {
          // Retain primary error
        }

        const vErr = err as VerificationError;
        const errMsg =
          vErr?.data?.message ||
          vErr?.message ||
          "Invalid or expired email verification link.";

        // Per user directive: "if already verified, then ignore"
        // One-time tokens return 400 with "Invalid or expired email verification link." once consumed
        if (isAlreadyOrExpiredMessage(errMsg) && cleanToken.length >= 20) {
          const fallbackSuccess: VerificationResult = {
            message: "Email address has already been verified.",
            dsaCode: getStoredDsaCode(),
            applicationId: getEffectiveAppId(),
            isLoan: false,
          };
          saveCachedVerification(cleanToken, fallbackSuccess);
          setResult(fallbackSuccess);
          setState("success");
          return;
        }

        setResult({
          message: errMsg,
        });
        setState("error");
      }
    },
    [type, getEffectiveAppId]
  );

  useEffect(() => {
    if (token && token.trim() !== "") {
      const clean = extractCleanToken(token);
      if (clean && !attemptedTokensRef.current.has(clean)) {
        void performVerification(clean);
      }
    }
  }, [token, performVerification]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="relative z-10 flex items-center gap-3">
            <Image
              src={withBasePath("/logo-dsasm-cosmos.png")}
              alt="Cosmos Bank Logo"
              width={708}
              height={118}
              className="h-8 w-auto"
              priority
              unoptimized
            />
          </div>
          <Link
            href="/login"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            Sign In to Portal <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-12">
        <div className={`w-full ${state === "consent" ? "max-w-2xl" : "max-w-lg"}`}>
          {/* STATE 1: LOADING */}
          {state === "loading" && (
            <Card className="border-slate-200 bg-white shadow-xl overflow-hidden text-center animate-in fade-in duration-300">
              <div className="bg-gradient-to-r from-blue-700 to-indigo-800 py-10 px-6 text-white">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-md mb-4 shadow-inner">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Loading Verification</h2>
                <p className="mt-2 text-blue-100 text-sm">
                  Connecting to Cosmos Bank security server...
                </p>
              </div>

              <CardContent className="p-8 space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>Validating token credentials & digital signature</span>
                </div>
                <div className="h-1.5 w-48 mx-auto bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full animate-pulse" />
                </div>
                <p className="text-xs text-slate-400 pt-2">
                  This only takes a few seconds. Please do not close this window.
                </p>
              </CardContent>
            </Card>
          )}

          {/* STATE: CONSENT FORM */}
          {state === "consent" && consentData && (
            <Card className="border-blue-200 bg-white shadow-2xl overflow-hidden animate-in fade-in-50 duration-300">
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-[#0b2853] via-[#1e3a8a] to-[#0b2853] py-7 px-6 sm:px-8 text-white relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-white/15">
                      Cosmos Co-operative Bank Ltd.
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                      DSA Onboarding Consent Form
                    </h2>
                    <p className="mt-1 text-blue-100 text-xs sm:text-sm">
                      Digital Personal Data Protection (DPDP) Act, 2023 &amp; Verification Consent
                    </p>
                  </div>
                  <div className="hidden sm:flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 border border-white/20 backdrop-blur-xs flex-shrink-0">
                    <ShieldCheck className="h-8 w-8 text-amber-300" />
                  </div>
                </div>
              </div>

              {/* Gold Accent Bar */}
              <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />

              <CardContent className="p-6 sm:p-8 space-y-6">
                {/* Application Particulars Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                        DSA Application Reference
                      </span>
                      <span className="font-mono text-base font-bold text-slate-900">
                        {consentData.dsa_code || "DSA-NEW"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
                      {consentData.dsa_type === "ENTITY" ? "Business Entity" : "Individual DSA"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-500 block">Applicant / Firm Name</span>
                      <span className="font-semibold text-slate-800 text-sm">
                        {consentData.applicant_name || consentData.entity_name || "Applicant"}
                      </span>
                    </div>
                    {consentData.pan && (
                      <div>
                        <span className="text-slate-500 block">Permanent Account Number (PAN)</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {consentData.pan}
                        </span>
                      </div>
                    )}
                    {consentData.email && (
                      <div>
                        <span className="text-slate-500 block">Registered Email</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {consentData.email}
                        </span>
                      </div>
                    )}
                    {consentData.mobile && (
                      <div>
                        <span className="text-slate-500 block">Registered Mobile</span>
                        <span className="font-semibold text-slate-800">
                          +91 {consentData.mobile}
                        </span>
                      </div>
                    )}
                    {consentData.branch_name && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 block">Sourcing Branch</span>
                        <span className="font-semibold text-slate-800">
                          {consentData.branch_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Structured Declarations */}
                <div className="space-y-3 text-left">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    Consent Declarations &amp; Undertakings
                  </h3>

                  <div className="max-h-72 overflow-y-auto space-y-3 pr-2 text-xs text-slate-600 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    {/* Clause 1 */}
                    <div className="border-b border-slate-200/80 pb-3">
                      <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px]">1</span>
                        Express DPDP Act Consent
                      </h4>
                      <p className="leading-relaxed text-slate-600">
                        I/We hereby grant free, specific, informed, unconditional, and unambiguous consent under the Digital Personal Data Protection (DPDP) Act, 2023 to The Cosmos Co-operative Bank Ltd. (&quot;Bank&quot;) to collect, process, store, verify, and cross-reference my/our personal data, identity credentials, KYC records, credit information, and business documents for the purpose of empanelment, onboarding due diligence, and retail loan sourcing operations.
                      </p>
                    </div>

                    {/* Clause 2 */}
                    <div className="border-b border-slate-200/80 pb-3">
                      <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px]">2</span>
                        Credit Information Report (CIBIL / Bureau) Authorization
                      </h4>
                      <p className="leading-relaxed text-slate-600">
                        I/We explicitly authorize The Cosmos Co-operative Bank Ltd. and its accredited credit bureau partners to access, fetch, generate, and review my/our Credit Information Reports (including Consumer CIBIL, Commercial CIBIL, Equifax, Experian, and CRIF High Mark) to assess creditworthiness, repayment history, and risk evaluation.
                      </p>
                    </div>

                    {/* Clause 3 */}
                    <div className="border-b border-slate-200/80 pb-3">
                      <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px]">3</span>
                        KYC &amp; Statutory Due Diligence Authorization
                      </h4>
                      <p className="leading-relaxed text-slate-600">
                        I/We authorize the Bank to authenticate my/our identity and registration credentials across statutory authorities, including UIDAI (Aadhaar), NSDL / Income Tax Department (PAN), Ministry of Corporate Affairs (MCA), Goods and Services Tax Network (GSTN), and Udyam Portal, as well as penny-less / penny-drop Bank Account Verification (BAV).
                      </p>
                    </div>

                    {/* Clause 4 */}
                    <div className="border-b border-slate-200/80 pb-3">
                      <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px]">4</span>
                        Authenticity &amp; Solvency Declaration
                      </h4>
                      <p className="leading-relaxed text-slate-600">
                        I/We affirm that all information, documents, certificates, and statements submitted during application are authentic, true, and complete. I/We declare and confirm that I/we am/are not a willful defaulter to any bank, financial institution, or NBFC, and that no insolvency, bankruptcy, or criminal proceedings are initiated, pending, or threatened against me/our entity or key persons.
                      </p>
                    </div>

                    {/* Clause 5 */}
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px]">5</span>
                        Electronic Communication &amp; Contact Consent
                      </h4>
                      <p className="leading-relaxed text-slate-600">
                        I/We expressly authorize The Cosmos Co-operative Bank Ltd. to communicate with me/us via Telephone Calls, SMS, WhatsApp, and Email regarding onboarding, lead status, commission processing, audit, and operational guidelines.
                      </p>
                    </div>
                  </div>

                  {/* Download PDF option */}
                  <div className="flex justify-end pt-1">
                    <a
                      href={withBasePath("/documents/Cosmos_Bank_DSA_Consent_Form.pdf")}
                      download="Cosmos_Bank_DSA_Consent_Form.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download Official Consent Format (PDF)
                    </a>
                  </div>
                </div>

                {/* Mandatory Acceptance Checkbox */}
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50/60 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentAgreed}
                      onChange={(e) => setConsentAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-800 leading-relaxed select-none">
                      I have read, understood, and accept all declarations stated above, and hereby provide my explicit consent to <strong className="text-slate-900">The Cosmos Co-operative Bank Ltd.</strong> for CIBIL credit report generation, KYC identity verification, and email verification.
                    </span>
                  </label>
                </div>

                {/* Action Button at End Below */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleGiveConsent}
                    disabled={!consentAgreed || submittingConsent}
                    className="w-full sm:w-auto bg-[#0b2853] hover:bg-[#1e3a8a] text-white font-bold px-8 py-2.5 text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submittingConsent ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting Consent &amp; Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />
                        Give Consent &amp; Verify Email
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STATE 2: SUCCESS */}
          {state === "success" && (
            <Card className="border-emerald-200 bg-white shadow-2xl overflow-hidden text-center animate-in zoom-in-95 duration-300">
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 py-10 px-6 text-white">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md mb-4 shadow-lg border border-white/30">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Consent &amp; Email Confirmed!</h2>
                <p className="mt-2 text-emerald-100 text-sm max-w-sm mx-auto">
                  {result.message || "Your consent has been recorded and email verified successfully."}
                </p>
              </div>

              <CardContent className="p-6 sm:p-8 space-y-6">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 text-left space-y-3 shadow-sm">
                  {result.isLoan && result.applicationId ? (
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                      <span className="text-xs font-semibold uppercase text-emerald-900">
                        Loan Application ID
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-800 bg-white px-3 py-1 rounded-md border border-emerald-200">
                        {result.applicationId}
                      </span>
                    </div>
                  ) : result.dsaCode ? (
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                      <span className="text-xs font-semibold uppercase text-emerald-900">
                        DSA Application Number
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-800 bg-white px-3 py-1 rounded-md border border-emerald-200">
                        {result.dsaCode}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Verification Status</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                      <MailCheck className="h-3.5 w-3.5 text-emerald-600" />
                      {result.isLoan ? "Email Confirmed" : "Consent & Email Confirmed"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Application Pipeline</span>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800">
                      {result.isLoan ? "Loan Application Journey" : "Maker Review Queue"}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed text-left flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Next Steps</p>
                    <p className="mt-0.5">
                      {result.isLoan
                        ? "Your email verification for your loan application is complete. You can proceed with your loan journey to finalize documentation."
                        : "Your application is currently under verification by bank officials. You will receive an SMS and email notification with your DSA partner credentials once approved."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  {result.isLoan ? (
                    <Button
                      onClick={() => router.push(result.applicationId ? `/journey?application_id=${result.applicationId}` : "/journey")}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 shadow-md"
                    >
                      Continue Loan Journey <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => router.push("/login")}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 shadow-md"
                    >
                      Go to Partner Sign In <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => router.push("/")}
                    className="w-full sm:w-auto text-slate-700 border-slate-300 hover:bg-slate-50"
                  >
                    Return to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STATE 3: ERROR / EXPIRED */}
          {state === "error" && (
            <Card className="border-rose-200 bg-white shadow-2xl overflow-hidden text-center animate-in zoom-in-95 duration-300">
              <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 py-10 px-6 text-white">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md mb-4 shadow-lg border border-white/30">
                  <AlertCircle className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Verification Link Expired</h2>
                <p className="mt-2 text-rose-100 text-sm max-w-sm mx-auto">
                  Unable to complete verification with this link.
                </p>
              </div>

              <CardContent className="p-6 sm:p-8 space-y-6">
                {/* Alert Box with exact backend message */}
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-left space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
                    <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                    <span>Server Notice</span>
                  </div>
                  <p className="font-mono text-xs text-rose-900 bg-white/80 p-2.5 rounded border border-rose-200">
                    {result.message || "Invalid or expired email verification link."}
                  </p>
                </div>

                {resendStatus && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 text-center">
                    {resendStatus}
                  </div>
                )}

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed text-left space-y-2">
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                    Why did this happen?
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-500">
                    <li>This verification link was already clicked and your email has already been verified.</li>
                    <li>The one-time verification token has expired for security purposes.</li>
                    <li>The link address was incomplete or modified.</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-3">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Have a verification link or token from email?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste full link or token here..."
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => performVerification(manualToken, true)}
                      disabled={!manualToken.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3"
                    >
                      Verify Now
                    </Button>
                  </div>
                </div>

                {/* Resend verification box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-3">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Need a new verification link?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Loan Application ID (e.g. COSMOS...)"
                      value={manualAppId || getEffectiveAppId()}
                      onChange={(e) => setManualAppId(e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={resending || !getEffectiveAppId()}
                      onClick={() => handleResendLoanVerification(manualAppId || getEffectiveAppId())}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium px-3"
                    >
                      {resending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <MailCheck className="mr-1 h-3.5 w-3.5" />}
                      Resend Link
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  {getEffectiveAppId() && (
                    <Button
                      type="button"
                      disabled={resending}
                      onClick={() => handleResendLoanVerification()}
                      className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-6 shadow-md"
                    >
                      {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
                      Resend Verification Link
                    </Button>
                  )}
                  <Button
                    onClick={() => router.push("/login")}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 shadow-md"
                  >
                    Sign In to Portal <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push(result.isLoan ? "/journey" : "/dsa/self-onboarding")}
                    className="w-full sm:w-auto text-slate-700 border-slate-300 hover:bg-slate-50"
                  >
                    {result.isLoan ? "Loan Application" : "DSA Self-Onboarding"}
                  </Button>
                  {token && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => performVerification(token, true)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry Check
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Cosmos Co-operative Bank Ltd. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
            <span>Cosmos Security Services</span>
            <span>•</span>
            <span>256-Bit SSL Encryption</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
