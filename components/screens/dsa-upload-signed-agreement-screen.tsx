"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building2,
  FileCheck,
  Download,
  UploadCloud,
  FileText,
  Clock,
  Check,
  X,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { adminApi } from "@/apis/admin";
import { withBasePath } from "@/lib/base-path";
import { Button, Card, CardContent } from "@/components/ui/primitives";

interface DsaUploadSignedAgreementScreenProps {
  token: string;
}

type ScreenState = "loading" | "ready" | "submitting" | "success" | "error";

interface UploadPreview {
  valid: boolean;
  dsa_id: number;
  dsa_code: string;
  applicant_name: string;
  company_name: string | null;
  email: string;
  mobile_no: string;
  branch_code: string;
  branch_name: string;
  agreement_document_id: number;
  agreement_file_name: string;
  agreement_file_url: string;
  agreement_status: string;
  expires_at: string;
}

export function DsaUploadSignedAgreementScreen({ token }: DsaUploadSignedAgreementScreenProps) {
  const [state, setState] = useState<ScreenState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) {
      setErrorMessage("No signed agreement upload token was provided in the link.");
      setState("error");
      return;
    }

    let isMounted = true;
    setState("loading");

    adminApi
      .getSignedAgreementUploadPreview(token)
      .then((res) => {
        if (!isMounted) return;
        if ((res as any).status === true || res.status === "success") {
          const data = res.data;
          setPreview(data);
          if (data.agreement_status === "SIGNED_UPLOADED" || data.agreement_status === "SIGNED_VERIFIED") {
            setState("success");
            setSuccessData({
              dsa_code: data.dsa_code,
              message: "Your physically signed agreement has already been uploaded and received.",
            });
          } else {
            setState("ready");
          }
        } else {
          setErrorMessage(res.message || "Failed to validate upload link.");
          setState("error");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Upload token is invalid, expired, or has already been used.";
        setErrorMessage(msg);
        setState("error");
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please select a valid PDF document.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("File size exceeds maximum limit of 2MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please attach your signed agreement PDF document.");
      return;
    }
    if (!acknowledged) {
      alert("Please confirm the document verification declaration before submitting.");
      return;
    }

    setState("submitting");
    setErrorMessage("");

    try {
      const res = await adminApi.uploadPartnerSignedAgreement(token, {
        file: selectedFile,
        remarks: remarks.trim() || undefined,
      });

      if ((res as any).status === true || res.status === "success") {
        setSuccessData(res.data || { dsa_code: preview?.dsa_code });
        setState("success");
      } else {
        setErrorMessage(res.message || "Failed to upload signed agreement.");
        setState("ready");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Upload failed. Token may be expired or already consumed.";
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
                DSA Agreement Execution
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Direct Selling Agent Empanelment & Final Activation</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-full border border-slate-700/50">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit Encrypted Secure Submission</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl">
          {/* State: Loading */}
          {state === "loading" && (
            <Card className="bg-slate-900/80 border-slate-800 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-12 text-center space-y-4">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <Loader2 className="w-6 h-6 text-indigo-400 absolute animate-pulse" />
                </div>
                <h2 className="text-base font-medium text-white">Validating Secure Upload Link...</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Verifying your partnership credentials and retrieving Master Agreement metadata from Cosmos Bank secure servers.
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
                  <h2 className="text-lg font-semibold text-white">Upload Link Unavailable</h2>
                  <p className="text-xs text-red-300/90 max-w-md mx-auto leading-relaxed bg-red-950/40 p-3 rounded-lg border border-red-900/30">
                    {errorMessage}
                  </p>
                </div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  This upload link has a 72-hour validity window and can only be used once. If your link has expired, please contact your mapped Cosmos Bank branch officer.
                </p>
                <div className="pt-2">
                  <Link href="/auth/login">
                    <Button variant="outline" className="text-xs border-slate-700 hover:bg-slate-800 text-slate-200">
                      Go to Cosmos Bank Portal
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
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800/50 inline-block">
                    Submission Received
                  </span>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Signed Agreement Uploaded Successfully!
                  </h2>
                  <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
                    Thank you! Your signed Master Partnership Agreement document has been securely stored and submitted to The Cosmos Co-Operative Bank Ltd.
                  </p>
                </div>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 max-w-md mx-auto text-left space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400">DSA Code:</span>
                    <span className="font-mono font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                      {successData?.dsa_code || preview?.dsa_code || "COSMOS DSA"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-700/40">
                    <span className="text-slate-400">Agreement Status:</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> SIGNED_UPLOADED
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Next Step:</span>
                    <span className="text-slate-200 font-medium">Head Office Credit Verification</span>
                  </div>
                </div>

                <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl p-4 max-w-md mx-auto text-left text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>What happens next?</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Our Level 7 HO Credit Head will review the stamp and execution signatures on your uploaded agreement. Once approved, your DSA account will be automatically activated and temporary login credentials will be dispatched to your registered email address.
                  </p>
                </div>

                <div className="pt-2">
                  <Link href="/auth/login">
                    <Button className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-6 py-2.5 font-medium shadow-lg shadow-emerald-900/40">
                      Proceed to Cosmos DSAMS Portal <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40 flex items-center gap-1.5">
                      <FileCheck className="w-3 h-3 text-amber-400" /> Task 12 — Signed Agreement Upload
                    </span>
                    {preview.expires_at && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        Valid Until: {new Date(preview.expires_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Upload Scanned Master Partnership Agreement
                  </h2>
                  <p className="text-xs text-slate-400">
                    Please download your official agreement PDF, affix physical signatures and rubber stamps on all execution pages, scan the complete document, and upload it below.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/50 border border-red-900/50 rounded-lg text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Partner Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-800/40 p-4 rounded-xl border border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">DSA Code</span>
                    <span className="font-mono font-bold text-amber-300 mt-0.5 block">{preview.dsa_code}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Applicant / Partner</span>
                    <span className="font-semibold text-white mt-0.5 block">{preview.applicant_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Servicing Branch</span>
                    <span className="text-slate-200 mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-indigo-400" />
                      {preview.branch_name} ({preview.branch_code})
                    </span>
                  </div>
                </div>

                {/* Step 1: Download Master Agreement PDF */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-[10px] text-white flex items-center justify-center">1</span>
                        Official Master Agreement Document
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Generated specifically for DSA Partner {preview.dsa_code}.
                      </p>
                    </div>
                    {preview.agreement_file_url && (
                      <a
                        href={getStorageUrl(preview.agreement_file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Agreement PDF
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 italic">
                    Print all pages. The authorized signatory must sign and affix the firm / individual stamp on designated signature blocks.
                  </p>
                </div>

                {/* Step 2: Upload Scanned Document Box */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-[10px] text-white flex items-center justify-center">2</span>
                    Upload Scanned Signed Document (PDF, Max 10MB)
                  </h3>

                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      dragActive
                        ? "border-indigo-400 bg-indigo-950/30"
                        : selectedFile
                        ? "border-emerald-500/60 bg-emerald-950/20"
                        : "border-slate-700 hover:border-slate-600 bg-slate-800/30"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileChange}
                      id="fileInputAgreement"
                    />

                    {selectedFile ? (
                      <div className="flex items-center justify-between p-3 bg-slate-800/90 rounded-lg border border-slate-700 max-w-md mx-auto">
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div className="truncate text-left">
                            <p className="text-xs font-semibold text-white truncate">{selectedFile.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready to submit
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
                          <UploadCloud className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className="text-xs">
                          <span className="text-indigo-400 font-semibold hover:underline">Click to browse</span> or drag and drop your scanned PDF here
                        </div>
                        <p className="text-[10px] text-slate-500">PDF documents only &bull; Up to 2 MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional Remarks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">
                    Upload Remarks / Notes <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Scanned copy with firm stamp on all execution pages"
                    maxLength={255}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Declaration Checkbox */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60 cursor-pointer hover:bg-slate-800/60 transition">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500/20 bg-slate-900 w-4 h-4"
                  />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-white">Declaration of Physical Execution:</span> I hereby verify that this document represents the genuine, complete, and physically signed and stamped Master Partnership Agreement executed with The Cosmos Co-Operative Bank Ltd.
                  </div>
                </label>

                {/* Submit Action */}
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || !acknowledged || state === "submitting"}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state === "submitting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading Signed Agreement...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" /> Submit Signed Agreement to Cosmos Bank
                    </>
                  )}
                </Button>
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
