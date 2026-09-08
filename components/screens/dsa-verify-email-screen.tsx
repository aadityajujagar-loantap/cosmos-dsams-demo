"use client";

import React, { useEffect, useState } from "react";
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
  Building2,
  Lock,
} from "lucide-react";
import { adminApi } from "@/apis/admin";
import { withBasePath } from "@/lib/base-path";
import { Button, Card, CardContent } from "@/components/ui/primitives";

interface DsaVerifyEmailScreenProps {
  token?: string;
}

type VerificationState = "loading" | "success" | "error";

interface VerificationResult {
  message: string;
  dsaCode?: string;
  dsaId?: number | string;
}

export function DsaVerifyEmailScreen({ token }: DsaVerifyEmailScreenProps) {
  const router = useRouter();
  const [state, setState] = useState<VerificationState>("loading");
  const [result, setResult] = useState<VerificationResult>({
    message: "",
  });

  const performVerification = async (verifyToken: string) => {
    setState("loading");
    try {
      const res: any = await adminApi.verifyDsaEmail(verifyToken);

      if (res?.status === true || res?.status === "success" || res?.status_code === 200) {
        setResult({
          message: res?.message || "Email address verified successfully.",
          dsaCode: res?.data?.dsa_code || res?.dsa_code,
          dsaId: res?.data?.dsa_id || res?.dsa_id,
        });
        setState("success");
      } else {
        setResult({
          message: res?.message || "Invalid or expired email verification link.",
        });
        setState("error");
      }
    } catch (err: any) {
      const errMsg =
        err?.data?.message ||
        err?.message ||
        "Invalid or expired email verification link.";
      setResult({
        message: errMsg,
      });
      setState("error");
    }
  };

  useEffect(() => {
    if (!token || token.trim() === "") {
      setState("error");
      setResult({
        message: "No verification token provided. Please check the link from your email.",
      });
      return;
    }

    performVerification(token.trim());
  }, [token]);

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
                  {result.dsaCode && (
                    <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                      <span className="text-xs font-semibold uppercase text-emerald-900">
                        DSA Reference Code
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-800 bg-white px-3 py-1 rounded-md border border-emerald-200">
                        {result.dsaCode}
                      </span>
                    </div>
                  )}
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
                      Level 1 Review Queue
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed text-left flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Next Steps</p>
                    <p className="mt-0.5">
                      Your application is currently under verification by bank officials. You will receive an SMS and email notification with your DSA partner credentials once approved.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => router.push("/login")}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 shadow-md"
                  >
                    Go to Partner Sign In <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
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

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Button
                    onClick={() => router.push("/login")}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 shadow-md"
                  >
                    Sign In to Portal <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/dsa/self-onboarding")}
                    className="w-full sm:w-auto text-slate-700 border-slate-300 hover:bg-slate-50"
                  >
                    DSA Self-Onboarding
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
