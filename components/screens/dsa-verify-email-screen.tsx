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

type VerificationState = "loading" | "success" | "error";

interface VerificationResult {
  message: string;
  dsaCode?: string;
  dsaId?: number | string;
  applicationId?: string;
  email?: string;
  isLoan?: boolean;
}

export function DsaVerifyEmailScreen({ token, type, applicationId }: DsaVerifyEmailScreenProps) {
  const router = useRouter();
  const [state, setState] = useState<VerificationState>(() =>
    !token || token.trim() === "" ? "error" : "loading"
  );
  const [result, setResult] = useState<VerificationResult>(() => ({
    message:
      !token || token.trim() === ""
        ? "No verification token provided. Please check the link from your email or paste it below."
        : "",
  }));
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [manualAppId, setManualAppId] = useState("");

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

  const extractToken = (rawInput: string): string => {
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
    // Also handle trailing paths like /dsa/verify-email/<token>
    if (clean.includes("/verify-email/")) {
      const parts = clean.split("/verify-email/");
      const lastPart = parts[parts.length - 1]?.split("?")[0]?.split("#")[0];
      if (lastPart) return lastPart.trim();
    }
    return clean;
  };

  const performVerification = useCallback(async (verifyToken: string) => {
    const cleanToken = extractToken(verifyToken);
    if (!cleanToken) {
      setState("error");
      setResult({
        message: "No verification token provided. Please check the link from your email.",
      });
      return;
    }

    setState("loading");
    const isLoanType = type === "loan" || type === "borrower" || cleanToken.length === 64;

    if (isLoanType) {
      try {
        const res = (await adminApi.verifyLoanEmail(cleanToken)) as VerificationApiResponse;
        if (res?.status === "success" || res?.status_code === 200) {
          setResult({
            message: res?.message || res?.data?.message || "Borrower email address verified successfully.",
            applicationId: res?.data?.application_id || res?.application_id || getEffectiveAppId(),
            email: res?.data?.email || res?.email,
            isLoan: true,
          });
          setState("success");
          return;
        } else {
          // Check DSA as fallback
          try {
            const dsaRes = (await adminApi.verifyDsaEmail(cleanToken)) as VerificationApiResponse;
            if (dsaRes?.status === true || dsaRes?.status === "success" || dsaRes?.status_code === 200) {
              setResult({
                message: dsaRes?.message || "Email address verified successfully.",
                dsaCode: dsaRes?.data?.dsa_code || dsaRes?.dsa_code,
                dsaId: dsaRes?.data?.dsa_id || dsaRes?.dsa_id,
                isLoan: false,
              });
              setState("success");
              return;
            }
          } catch {
            // retain primary loan error
          }

          setResult({
            message: res?.message || res?.data?.message || "Invalid or expired loan verification link.",
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
            setResult({
              message: dsaRes?.message || "Email address verified successfully.",
              dsaCode: dsaRes?.data?.dsa_code || dsaRes?.dsa_code,
              dsaId: dsaRes?.data?.dsa_id || dsaRes?.dsa_id,
              isLoan: false,
            });
            setState("success");
            return;
          }
        } catch {
          // retain primary loan error
        }

        const vErr = err as VerificationError;
        setResult({
          message: vErr?.data?.message || vErr?.message || "Invalid or expired loan verification link.",
          applicationId: vErr?.data?.application_id || getEffectiveAppId(),
          isLoan: true,
        });
        setState("error");
        return;
      }
    }

    try {
      const res = (await adminApi.verifyDsaEmail(cleanToken)) as VerificationApiResponse;

      if (res?.status === true || res?.status === "success" || res?.status_code === 200) {
        setResult({
          message: res?.message || "Email address verified successfully.",
          dsaCode: res?.data?.dsa_code || res?.dsa_code,
          dsaId: res?.data?.dsa_id || res?.dsa_id,
          isLoan: false,
        });
        setState("success");
      } else {
        // Fallback: Check if this token corresponds to a borrower loan verification
        try {
          const loanRes = (await adminApi.verifyLoanEmail(cleanToken)) as VerificationApiResponse;
          if (loanRes?.status === "success" || loanRes?.status_code === 200) {
            setResult({
              message: loanRes?.message || loanRes?.data?.message || "Borrower email address verified successfully.",
              applicationId: loanRes?.data?.application_id || loanRes?.application_id || getEffectiveAppId(),
              email: loanRes?.data?.email,
              isLoan: true,
            });
            setState("success");
            return;
          }
        } catch {
          // Retain primary DSA error
        }

        setResult({
          message: res?.message || "Invalid or expired email verification link.",
        });
        setState("error");
      }
    } catch (err: unknown) {
      // Fallback: Check if this token corresponds to a borrower loan verification
      try {
        const loanRes = (await adminApi.verifyLoanEmail(cleanToken)) as VerificationApiResponse;
        if (loanRes?.status === "success" || loanRes?.status_code === 200) {
          setResult({
            message: loanRes?.message || loanRes?.data?.message || "Borrower email address verified successfully.",
            applicationId: loanRes?.data?.application_id || loanRes?.application_id || getEffectiveAppId(),
            email: loanRes?.data?.email,
            isLoan: true,
          });
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
      setResult({
        message: errMsg,
      });
      setState("error");
    }
  }, [type, getEffectiveAppId]);

  useEffect(() => {
    if (token && token.trim() !== "") {
      const timer = setTimeout(() => {
        void performVerification(token.trim());
      }, 0);
      return () => clearTimeout(timer);
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
        <div className="w-full max-w-lg">
          {/* STATE 1: LOADING */}
          {state === "loading" && (
            <Card className="border-slate-200 bg-white shadow-xl overflow-hidden text-center animate-in fade-in duration-300">
              <div className="bg-gradient-to-r from-blue-700 to-indigo-800 py-10 px-6 text-white">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-md mb-4 shadow-inner">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Verifying Your Email</h2>
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

          {/* STATE 2: SUCCESS */}
          {state === "success" && (
            <Card className="border-emerald-200 bg-white shadow-2xl overflow-hidden text-center animate-in zoom-in-95 duration-300">
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 py-10 px-6 text-white">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md mb-4 shadow-lg border border-white/30">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Email Verified Successfully!</h2>
                <p className="mt-2 text-emerald-100 text-sm max-w-sm mx-auto">
                  {result.message || "Your email address has been confirmed."}
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
                        DSA Reference Code
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
                      Email Confirmed
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Application Pipeline</span>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800">
                      {result.isLoan ? "Loan Application Journey" : "Level 1 Review Queue"}
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
                      onClick={() => performVerification(manualToken)}
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
                      onClick={() => performVerification(token)}
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
          <p>© 2026 The Cosmos Co-operative Bank Ltd. All rights reserved. Regulated by RBI.</p>
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
