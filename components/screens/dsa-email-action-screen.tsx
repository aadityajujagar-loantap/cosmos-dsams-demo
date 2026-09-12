"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building2,
  Lock,
  ArrowRight,
  Clock,
  UserCheck,
  FileCheck,
  XCircle,
} from "lucide-react";
import { adminApi } from "@/apis/admin";
import { withBasePath } from "@/lib/base-path";
import { Button, Card, CardContent } from "@/components/ui/primitives";

interface DsaEmailActionScreenProps {
  token: string;
}

type ScreenState = "loading" | "ready" | "submitting" | "success" | "error";

interface TokenDetails {
  dsa_id: number;
  dsa_code: string;
  applicant_name: string;
  dsa_type: string;
  branch_name: string;
  stage_level: number;
  stage_name: string;
  token_action: string;
  allowed_actions: string[];
  expires_at: string;
  designated_user: string;
}

export function DsaEmailActionScreen({ token }: DsaEmailActionScreenProps) {
  const searchParams = useSearchParams();
  const urlAction = (searchParams.get("action") || "").toUpperCase();

  const [state, setState] = useState<ScreenState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [details, setDetails] = useState<TokenDetails | null>(null);
  const [selectedAction, setSelectedAction] = useState<"RECOMMEND" | "REJECT">("RECOMMEND");
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState("");

  useEffect(() => {
    if (!token) {
      setErrorMessage("No workflow action token was provided in the link.");
      setState("error");
      return;
    }

    async function loadTokenDetails() {
      setState("loading");
      try {
        const res = await adminApi.getEmailActionDetails(token);
        if (res?.data) {
          const data = res.data;
          setDetails(data);
          if (urlAction === "REJECT" || data.token_action === "REJECT") {
            setSelectedAction("REJECT");
          } else {
            setSelectedAction("RECOMMEND");
          }
          setState("ready");
        } else {
          setErrorMessage(res?.message || "Invalid or expired workflow action token.");
          setState("error");
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "This authorization link has expired or has already been used.";
        setErrorMessage(msg);
        setState("error");
      }
    }

    loadTokenDetails();
  }, [token, urlAction]);

  const handleSubmit = async () => {
    if (selectedAction === "REJECT" && !remarks.trim()) {
      setRemarksError("Please provide rejection remarks.");
      return;
    }

    setState("submitting");
    setRemarksError("");

    try {
      const res = await adminApi.submitEmailAction(token, {
        action: selectedAction,
        remarks: remarks.trim() || undefined,
      });

      if (res?.status === "success" || res?.status_code === 200) {
        setSuccessMessage(
          res?.message ||
            (selectedAction === "RECOMMEND"
              ? "Application recommended successfully and forwarded to the next authority."
              : "Application rejected successfully.")
        );
        setState("success");
      } else {
        setErrorMessage(res?.message || "Failed to process workflow action.");
        setState("error");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to process workflow action. The token may be expired or already executed.";
      setErrorMessage(msg);
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Brand Header */}
      <div className="w-full max-w-2xl mx-auto pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-xl shadow-md border border-slate-700/40">
            <Image
              src={withBasePath("/cosmos-logo.png")}
              alt="Cosmos Bank"
              width={120}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </div>
          <span className="text-white/80 font-bold text-sm tracking-wider uppercase hidden sm:inline">
            DSAMS &bull; Workflow Gateway
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-blue-300/80 bg-blue-900/40 px-3 py-1.5 rounded-full border border-blue-500/20">
          <Lock className="h-3.5 w-3.5 text-blue-400" />
          <span>Secure Email Action</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-2xl mx-auto my-8">
        <Card className="border-slate-700/60 shadow-2xl bg-white/95 backdrop-blur-sm overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5 text-blue-200 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>COSMOS Approval Authority Action</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              DSA Onboarding Workflow Decision
            </h1>
            <p className="text-xs text-blue-100/90 mt-1 max-w-xl">
              Execute recommendation or rejection directly using your pre-authorized secure token.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8">
            {/* 1. Loading State */}
            {state === "loading" && (
              <div className="py-14 text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Verifying Action Token...</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Validating cryptographic signature and checking workflow permissions.
                  </p>
                </div>
              </div>
            )}

            {/* 2. Error State */}
            {state === "error" && (
              <div className="py-8 text-center space-y-5">
                <div className="h-14 w-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Unable to Process Action</h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto mt-2">
                    {errorMessage}
                  </p>
                </div>
                <div className="pt-3 flex justify-center gap-3">
                  <Link href="/login">
                    <Button variant="primary" className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold">
                      Log In to Staff Portal
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 3. Success State */}
            {state === "success" && (
              <div className="py-8 text-center space-y-5">
                <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Decision Recorded Successfully</h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto mt-2">
                    {successMessage}
                  </p>
                </div>
                <div className="pt-3 flex justify-center gap-3">
                  <Link href="/login">
                    <Button variant="primary" className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold">
                      Continue to Staff Portal
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* 4. Ready / Submitting State */}
            {(state === "ready" || state === "submitting") && details && (
              <div className="space-y-6">
                {/* Application Snapshot Card */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Applicant / Partner
                      </span>
                      <h2 className="text-base font-bold text-slate-900 leading-snug">
                        {details.applicant_name}
                      </h2>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {details.dsa_code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block">Type</span>
                      <span className="font-semibold text-slate-800">{details.dsa_type}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block">Branch</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        {details.branch_name || "Assigned Branch"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block">Review Level</span>
                      <span className="font-bold text-blue-700">
                        Level {details.stage_level}: {details.stage_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 block">Reviewer</span>
                      <span className="font-medium text-slate-700 flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-slate-400" />
                        {details.designated_user || "Assigned Authority"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] font-semibold text-slate-500 block">Token Validity</span>
                      <span className="font-medium text-slate-600 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        Expires {new Date(details.expires_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Decision Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Choose Your Decision <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAction("RECOMMEND")}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        selectedAction === "RECOMMEND"
                          ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20 text-emerald-950"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          selectedAction === "RECOMMEND" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <FileCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs sm:text-sm">Recommend Application</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Advance to next stage in approval pipeline.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedAction("REJECT")}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                        selectedAction === "REJECT"
                          ? "border-rose-500 bg-rose-50/70 ring-2 ring-rose-500/20 text-rose-950"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          selectedAction === "REJECT" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        <XCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs sm:text-sm">Reject Application</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Terminate onboarding process at this stage.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Remarks Field */}
                <div className="space-y-1.5">
                  <label htmlFor="emailRemarks" className="text-xs font-bold text-slate-700 block">
                    Reviewer Remarks {selectedAction === "REJECT" && <span className="text-rose-500">*</span>}
                  </label>
                  <textarea
                    id="emailRemarks"
                    rows={3}
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value);
                      setRemarksError("");
                    }}
                    placeholder={
                      selectedAction === "RECOMMEND"
                        ? "Enter recommendation remarks (optional)"
                        : "Mandatory: Enter justification for rejecting this application"
                    }
                    className={`w-full rounded-lg border p-3 text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 ${
                      remarksError
                        ? "border-rose-300 focus:ring-rose-500/20 bg-rose-50/30"
                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                    }`}
                  />
                  {remarksError && <p className="text-xs font-medium text-rose-600">{remarksError}</p>}
                </div>

                {/* Action CTA Buttons */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400 text-center sm:text-left">
                    Decision logged with timestamp &amp; audit tracking.
                  </span>
                  <Button
                    type="button"
                    disabled={state === "submitting"}
                    onClick={handleSubmit}
                    className={`w-full sm:w-auto font-bold text-xs sm:text-sm px-6 py-2.5 h-auto transition-all ${
                      selectedAction === "RECOMMEND"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-rose-600 hover:bg-rose-700 text-white"
                    }`}
                  >
                    {state === "submitting" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : selectedAction === "RECOMMEND" ? (
                      "Confirm & Submit Recommendation"
                    ) : (
                      "Confirm & Reject Application"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="w-full max-w-2xl mx-auto pb-4 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} The Cosmos Co-Operative Bank Ltd. All Rights Reserved.
      </div>
    </div>
  );
}
