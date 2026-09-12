"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building2,
  Lock,
  ArrowRight,
  Clock,
  FileCheck,
  Download,
  ExternalLink,
  Award,
  Check,
} from "lucide-react";
import { adminApi } from "@/apis/admin";
import { withBasePath } from "@/lib/base-path";
import { Button, Card, CardContent } from "@/components/ui/primitives";

interface DsaDigitalAcceptanceScreenProps {
  token: string;
}

type ScreenState = "loading" | "ready" | "submitting" | "success" | "error";

interface AcceptancePreview {
  valid: boolean;
  dsa_id: number;
  dsa_code: string;
  applicant_name: string;
  company_name: string;
  email: string;
  mobile_no: string;
  branch_code: string;
  branch_name: string;
  letter_document_id: number | null;
  letter_file_name: string | null;
  letter_file_url: string | null;
  digital_acceptance_status: string;
  expires_at: string;
}

export function DsaDigitalAcceptanceScreen({ token }: DsaDigitalAcceptanceScreenProps) {
  const [state, setState] = useState<ScreenState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState<any>(null);
  const [preview, setPreview] = useState<AcceptancePreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage("No digital acceptance token was provided in the link.");
      setState("error");
      return;
    }

    let isMounted = true;
    setState("loading");

    adminApi
      .getDigitalAcceptance(token)
      .then((res) => {
        if ((res as any).status === true || res.status === "success") {
          const data = res.data;
          setPreview(data);
          if (data.digital_acceptance_status === "ACCEPTED") {
            setState("success");
            setSuccessData({
              dsa_code: data.dsa_code,
              message: "This DSA Empanelment Letter has already been digitally accepted.",
            });
          } else {
            setState("ready");
          }
        } else {
          setErrorMessage(res.message || "Failed to load digital acceptance details.");
          setState("error");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Acceptance token is invalid, expired, or has already been used.";
        setErrorMessage(msg);
        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!acknowledged) return;

    setState("submitting");
    setErrorMessage("");

    try {
      const res = await adminApi.submitDigitalAcceptance(token);
      if ((res as any).status === true || res.status === "success") {
        setSuccessData(res.data || { dsa_code: preview?.dsa_code });
        setState("success");
      } else {
        setErrorMessage(res.message || "Failed to record digital acceptance.");
        setState("ready");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit digital acceptance. Please contact the administrator.";
      setErrorMessage(msg);
      setState("ready");
    }
  };

  const getStorageUrl = (url: string | null | undefined) => {
    if (!url) return "#";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const backendBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return `${backendBase.replace(/\/api\/?$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-between text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/10 p-1 border border-white/10 shadow-inner">
            <Image
              src={withBasePath("/images/bank-logo.png")}
              alt="Cosmos Bank Logo"
              width={36}
              height={36}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              THE COSMOS CO-OP. BANK LTD.
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                DSA Portal
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Direct Selling Agent Empanelment & Activation</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/50">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit Encrypted Digital Verification</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          {/* State: Loading */}
          {state === "loading" && (
            <Card className="bg-slate-900/80 border-slate-800 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-12 text-center space-y-4">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <Loader2 className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
                </div>
                <h2 className="text-base font-medium text-white">Validating Empanelment Acceptance Link...</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Retrieving your approved empanelment letter and authorization records from Cosmos Bank secure servers.
                </p>
              </CardContent>
            </Card>
          )}

          {/* State: Error */}
          {state === "error" && (
            <Card className="bg-slate-900/80 border-red-900/40 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-8 md:p-10 text-center space-y-5">
                <div className="w-14 h-14 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-white">Unable to Process Acceptance</h2>
                  <p className="text-xs text-red-300/90 max-w-md mx-auto leading-relaxed bg-red-950/40 p-3 rounded-lg border border-red-900/30">
                    {errorMessage}
                  </p>
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  This link may have expired (72h validity) or has already been used. Please contact your Cosmos Bank branch officer for a fresh link.
                </p>
                <div className="pt-2">
                  <Link href="/auth/login">
                    <Button variant="outline" className="text-xs border-slate-700 hover:bg-slate-800 text-slate-200">
                      Go to Cosmos DSAMS Login
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* State: Success */}
          {state === "success" && (
            <Card className="bg-slate-900/80 border-emerald-800/40 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-8 md:p-10 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-bounce">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/50 inline-block">
                    Empanelment Confirmed
                  </span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Digital Acceptance Recorded Successfully!
                  </h2>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Congratulations! Your Direct Selling Agent (DSA) empanelment with The Cosmos Co-Operative Bank Ltd. is now formally accepted.
                  </p>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 max-w-md mx-auto text-left space-y-2.5">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400">Allotted DSA Code:</span>
                    <span className="font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      {successData?.dsa_code || preview?.dsa_code || "Generated"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Digitally Accepted
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Next Step:</span>
                    <span className="text-slate-300">Agreement Execution & Portal Login</span>
                  </div>
                </div>

                {preview?.letter_file_url && (
                  <div className="pt-1">
                    <a
                      href={getStorageUrl(preview.letter_file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Copy of Empanelment Letter
                    </a>
                  </div>
                )}

                <div className="pt-2">
                  <Link href="/auth/login">
                    <Button className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-6 py-2.5 font-medium shadow-lg shadow-emerald-900/40">
                      Proceed to Partner Login <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* State: Ready or Submitting */}
          {(state === "ready" || state === "submitting") && preview && (
            <Card className="bg-slate-900/85 border-slate-800 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-6 md:p-8 space-y-6">
                {/* Header Badge & Title */}
                <div className="space-y-2 border-b border-slate-800 pb-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-800/40 flex items-center gap-1.5">
                      <Award className="w-3 h-3 text-amber-400" /> Formal Empanelment Acceptance
                    </span>
                    {preview.expires_at && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Expires: {new Date(preview.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    DSA Empanelment Letter Acceptance
                  </h2>
                  <p className="text-xs text-slate-400">
                    Please review the empanelment details and your formal empanelment letter below to record your digital acceptance.
                  </p>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">DSA Applicant / Entity</span>
                    <span className="font-semibold text-white mt-0.5 block">{preview.applicant_name}</span>
                    {preview.company_name && preview.company_name !== preview.applicant_name && (
                      <span className="text-[11px] text-slate-400">{preview.company_name}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Allotted DSA Code</span>
                    <span className="font-mono font-bold text-amber-300 mt-0.5 block">{preview.dsa_code}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Assigned Branch</span>
                    <span className="text-slate-200 mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {preview.branch_name || preview.branch_code} ({preview.branch_code})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Contact Details</span>
                    <span className="text-slate-300 mt-0.5 block truncate">{preview.email}</span>
                    <span className="text-slate-400 text-[11px]">{preview.mobile_no}</span>
                  </div>
                </div>

                {/* Empanelment Letter Card */}
                <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                      <FileCheck className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">
                        {preview.letter_file_name || "DSA_Empanelment_Letter.pdf"}
                      </h4>
                      <p className="text-[11px] text-slate-400">Formal Sanction & Empanelment Terms Letter</p>
                    </div>
                  </div>
                  {preview.letter_file_url && (
                    <a
                      href={getStorageUrl(preview.letter_file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> View / Download <ExternalLink className="w-3 h-3 ml-0.5 opacity-60" />
                    </a>
                  )}
                </div>

                {/* Error Banner if any */}
                {errorMessage && (
                  <div className="bg-red-950/40 border border-red-900/50 p-3 rounded-lg flex items-start gap-2.5 text-xs text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Declaration & Acceptance Checkbox */}
                <div className="space-y-4 pt-1">
                  <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800/80 transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      disabled={state === "submitting"}
                      className="mt-0.5 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 h-4 w-4 shrink-0"
                    />
                    <div className="text-xs text-slate-300 space-y-1">
                      <span className="font-semibold text-white block">Declaration & Acceptance of Terms</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        I hereby acknowledge and agree to the terms and conditions set forth in the DSA Empanelment Letter issued by The Cosmos Co-Operative Bank Ltd. I confirm adherence to the code of conduct, compliance policies, and regulatory obligations applicable to Direct Selling Agents.
                      </p>
                    </div>
                  </label>

                  {/* Submit Button */}
                  <Button
                    onClick={handleAccept}
                    disabled={!acknowledged || state === "submitting"}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {state === "submitting" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Recording Acceptance...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Accept Terms & Confirm Empanelment
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 px-6 py-4 text-center text-[11px] text-slate-500">
        &copy; {new Date().getFullYear()} The Cosmos Co-operative Bank Ltd. All rights reserved. | DSAMS Digital Onboarding
      </footer>
    </div>
  );
}
