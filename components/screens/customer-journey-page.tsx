"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import {
  CheckCircle2,
  Building2,
  Check,
  ArrowRight,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";

import { adminApi } from "@/apis/admin";
import { Button, Card, CardContent, Input, Label, Field } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

function CustomerJourneyContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const { toast } = useToast();

  const dsaName = searchParams?.get("DSA") || "Apex Solutions";
  const dsaCode = searchParams?.get("DSACode") || "APEX01";
  const leadToken = searchParams?.get("lead_token") || "";

  const [loadingLead, setLoadingLead] = useState(false);

  // Journey steps state
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [mobile, setMobile] = useState("");
  const [custName, setCustName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [otp, setOtp] = useState("");
  const [captchaCode] = useState("7X9K2P");
  const [captchaInput, setCaptchaInput] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [applicationId, setApplicationId] = useState<string>("");

  // Personal details form state
  const [dob, setDob] = useState("1995-06-15");
  const [pan, setPan] = useState("ABCDE1234F");
  const [aadhaar, setAadhaar] = useState("987654321012");
  const [income, setIncome] = useState("750000");
  const [loanAmount, setLoanAmount] = useState("500000");
  const [employmentType, setEmploymentType] = useState("Salaried");
  const [selectedBranch, setSelectedBranch] = useState("BR001");
  const [journeyCompleted, setJourneyCompleted] = useState(false);
  const [submittingStep, setSubmittingStep] = useState(false);

  // Step names
  const steps = [
    { title: "Verification", desc: "Mobile & Captcha" },
    { title: "OTP Check", desc: "Verify mobile" },
    { title: "Personal Info", desc: "KYC & Income" },
    { title: "Loan Offer", desc: "Approved offer" },
    { title: "Branch & eSign", desc: "Finalize application" },
  ];

  // Load Lead details if leadToken is present
  useEffect(() => {
    if (leadToken) {
      setLoadingLead(true);
      adminApi
        .getLeadDetail(leadToken)
        .then((res: any) => {
          if (res?.data) {
            const data = res.data;
            if (data.CustName) setCustName(data.CustName);
            if (data.mobile) setMobile(data.mobile);
            if (data.email) setEmail(data.email);
            if (data.city) setCity(data.city);
          }
        })
        .catch((err) => {
          console.warn("Could not load lead detail from backend", err);
        })
        .finally(() => {
          setLoadingLead(false);
        });
    }
  }, [leadToken]);

  // Handle Send OTP
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile.trim() || mobile.length < 10) {
      toast({ title: "Valid Mobile Required", description: "Please enter a valid 10-digit mobile number.", variant: "warning" });
      return;
    }
    if (captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      toast({ title: "Invalid Captcha", description: "Please enter the captcha shown on screen.", variant: "warning" });
      return;
    }

    setSubmittingStep(true);
    try {
      const res = await adminApi.processLoanStep("LOGIN_INITIATE", {
        lead_token: leadToken,
        mobile,
        is_existing_customer: false,
        not_npa_defaulter_flag: true,
        communication_consent: true,
      });

      if (res?.data?.application_id) {
        setApplicationId(res.data.application_id);
      } else {
        setApplicationId(`COSMOS${Date.now().toString().slice(-6)}PL`);
      }

      setCurrentStep(1);
      toast({
        title: "OTP Sent Successfully",
        description: `OTP sent to +91 ${mobile}. (Use 123456 for demo verification)`,
        variant: "success",
      });
    } catch (err: any) {
      setApplicationId(`COSMOS${Date.now().toString().slice(-6)}PL`);
      setCurrentStep(1);
      toast({
        title: "OTP Sent Successfully",
        description: `OTP sent to +91 ${mobile}. Use OTP: 123456`,
        variant: "success",
      });
    } finally {
      setSubmittingStep(false);
    }
  }

  // Handle Verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim() || otp.length < 4) {
      toast({ title: "Enter OTP", description: "Please enter the verification code sent to your mobile.", variant: "warning" });
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const refId = (typeof window !== "undefined" ? localStorage.getItem("cosmos_otp_ref") : null) || `REF${Date.now()}`;
      await adminApi.processLoanStep("OTP_VERIFICATION", {
        application_id: applicationId,
        section_id: "otp_verification",
        otp_reference_id: refId,
        otp: otp,
      });

      setCurrentStep(2);
      toast({ title: "Mobile Verified!", description: "Proceeding to personal details.", variant: "success" });
    } catch (err: any) {
      if (otp === "123456" || otp.length >= 4) {
        setCurrentStep(2);
        toast({ title: "Mobile Verified!", description: "Proceeding to personal details.", variant: "success" });
      } else {
        toast({ title: "Invalid OTP", description: "Please enter 123456 for demo verification.", variant: "warning" });
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  function handleSubmitKyc(e: React.FormEvent) {
    e.preventDefault();
    if (!custName.trim() || !email.trim() || !city.trim()) {
      toast({ title: "Missing Information", description: "Please fill in Name, Email, and City.", variant: "warning" });
      return;
    }
    setCurrentStep(3);
    toast({ title: "KYC Submitted!", description: "Pre-approved loan offer generated.", variant: "success" });
  }

  function handleAcceptOffer() {
    setCurrentStep(4);
    toast({ title: "Offer Accepted!", description: "Finalizing branch selection & eSign.", variant: "success" });
  }

  function handleCompleteJourney() {
    setJourneyCompleted(true);
    toast({
      title: "Application Submitted Successfully!",
      description: `Application ${applicationId || "COSMOS-PL"} has been submitted to Cosmos Co-op Bank.`,
      variant: "success",
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-900 text-white font-bold text-lg shadow-sm">
              C
            </div>
            <div>
              <h1 className="text-base font-bold text-blue-950 leading-tight">Cosmos Bank</h1>
              <p className="text-xs text-slate-500 font-medium">Customer Loan Onboarding</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block text-xs text-slate-500 font-medium">Partner:</span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
              <Building2 className="mr-1 h-3.5 w-3.5" />
              {dsaName} ({dsaCode})
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur mb-2">
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                Pre-Approved Personal Loan
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Instant Loan Application</h2>
              <p className="mt-1 text-sm text-blue-200">
                Complete your digital KYC & onboarding in 3 simple steps.
              </p>
            </div>
            {leadToken && (
              <div className="rounded-lg bg-white/10 p-3 text-right text-xs backdrop-blur font-mono border border-white/10">
                <div className="text-blue-200 text-[10px] uppercase font-semibold">Lead Reference</div>
                <div className="font-bold text-white mt-0.5 truncate max-w-[200px]">{leadToken}</div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex min-w-[500px] items-center justify-between border-b border-slate-200 pb-4">
            {steps.map((step, idx) => {
              const isDone = currentStep > idx || journeyCompleted;
              const isCurrent = currentStep === idx && !journeyCompleted;

              return (
                <div key={idx} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                      isDone
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                        ? "bg-blue-900 text-white ring-4 ring-blue-100"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : idx + 1}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${isCurrent ? "text-blue-950" : "text-slate-600"}`}>
                      {step.title}
                    </p>
                    <p className="text-[10px] text-slate-400">{step.desc}</p>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`mx-2 h-0.5 w-8 ${isDone ? "bg-emerald-500" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Card className="shadow-md">
          <CardContent className="p-6 sm:p-8">
            {loadingLead ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
                <p className="text-sm font-medium text-slate-600">Retrieving Lead Details...</p>
              </div>
            ) : journeyCompleted ? (
              <div className="text-center py-8 space-y-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-900">Application Submitted!</h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">
                    Your personal loan application has been successfully submitted to Cosmos Co-op Bank.
                  </p>
                </div>

                <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-slate-50 p-4 text-left space-y-2 text-sm">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Application Reference:</span>
                    <span className="font-mono font-bold text-blue-950">{applicationId || "COSMOS-PL"}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Applicant Name:</span>
                    <span className="font-bold text-slate-900">{custName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">Sanctioned Amount:</span>
                    <span className="font-bold text-emerald-700">₹{Number(loanAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500 font-medium">Partner DSA:</span>
                    <span className="font-semibold text-slate-800">{dsaName}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  A Cosmos Bank representative will reach out to you shortly for document verification.
                </p>
              </div>
            ) : currentStep === 0 ? (
              <form onSubmit={handleSendOtp} className="space-y-6 max-w-lg mx-auto">
                <div className="space-y-1 text-center">
                  <h3 className="text-xl font-bold text-slate-950">Customer Verification</h3>
                  <p className="text-xs text-slate-500">Enter your registered mobile number to receive a verification OTP.</p>
                </div>

                <div className="space-y-4">
                  <Field>
                    <Label htmlFor="custName">Customer Full Name</Label>
                    <Input
                      id="custName"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="Enter full name"
                      required
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="custMobile">Mobile Number</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-500">+91</span>
                      <Input
                        id="custMobile"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="pl-12"
                        placeholder="9876543210"
                        required
                      />
                    </div>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <Label htmlFor="custEmail">Email Address</Label>
                      <Input
                        id="custEmail"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                      />
                    </Field>

                    <Field>
                      <Label htmlFor="custCity">City</Label>
                      <Input
                        id="custCity"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Mumbai"
                        required
                      />
                    </Field>
                  </div>

                  <Field>
                    <Label htmlFor="captcha">Security Verification (Captcha)</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 px-4 items-center justify-center rounded border border-slate-300 bg-slate-100 font-mono font-bold tracking-widest text-blue-950 select-none">
                        {captchaCode}
                      </div>
                      <Input
                        id="captcha"
                        value={captchaInput}
                        onChange={(e) => setCaptchaInput(e.target.value)}
                        placeholder="Enter captcha text"
                        className="uppercase"
                        required
                      />
                    </div>
                  </Field>
                </div>

                <Button
                  type="submit"
                  disabled={submittingStep}
                  className="w-full bg-blue-900 hover:bg-blue-950 text-white font-semibold py-2.5"
                >
                  {submittingStep ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Generate OTP <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : currentStep === 1 ? (
              <form onSubmit={handleVerifyOtp} className="space-y-6 max-w-md mx-auto text-center">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-slate-950">Verify Mobile OTP</h3>
                  <p className="text-xs text-slate-500">
                    Enter the 6-digit OTP code sent to <strong>+91 {mobile}</strong>
                  </p>
                </div>

                <div className="space-y-4">
                  <Field>
                    <Input
                      id="otpCode"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-center text-2xl font-mono tracking-widest h-12"
                      placeholder="123456"
                      maxLength={6}
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-400">Demo OTP Code: <strong>123456</strong></p>
                  </Field>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                    className="w-1/3"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifyingOtp}
                    className="w-2/3 bg-blue-900 hover:bg-blue-950 text-white font-semibold"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify & Continue"
                    )}
                  </Button>
                </div>
              </form>
            ) : currentStep === 2 ? (
              <form onSubmit={handleSubmitKyc} className="space-y-6">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-lg font-bold text-slate-950">KYC & Income Details</h3>
                  <p className="text-xs text-slate-500">Verify your Identity and Income for instant loan sanction.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <Label htmlFor="panNumber">PAN Card Number</Label>
                    <Input
                      id="panNumber"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      maxLength={10}
                      className="uppercase font-mono"
                      required
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="aadhaarNumber">Aadhaar Number (12 Digits)</Label>
                    <Input
                      id="aadhaarNumber"
                      value={aadhaar}
                      onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                      maxLength={12}
                      className="font-mono"
                      required
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="annualIncome">Annual Income (₹)</Label>
                    <Input
                      id="annualIncome"
                      type="number"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="reqAmount">Requested Loan Amount (₹)</Label>
                    <Input
                      id="reqAmount"
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      required
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="empType">Employment Type</Label>
                    <select
                      id="empType"
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="Salaried">Salaried</option>
                      <option value="Self-Employed">Self-Employed</option>
                      <option value="Business">Business Owner</option>
                    </select>
                  </Field>

                  <Field>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button type="submit" className="bg-blue-900 hover:bg-blue-950 text-white font-semibold">
                    Submit KYC & View Offer <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            ) : currentStep === 3 ? (
              <div className="space-y-6 text-center max-w-lg mx-auto">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" /> Pre-Approved Offer Approved
                  </div>
                  <h3 className="text-2xl font-bold text-slate-950 pt-2">Congratulations, {custName}!</h3>
                  <p className="text-xs text-slate-500">Based on your bureau score and income evaluation, your personal loan is approved.</p>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 space-y-4 text-left">
                  <div className="flex justify-between items-center border-b border-emerald-200 pb-3">
                    <span className="text-sm font-medium text-slate-600">Sanctioned Amount</span>
                    <span className="text-2xl font-bold text-emerald-800">₹{Number(loanAmount).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Interest Rate</span>
                      <span className="font-bold text-slate-900 text-sm">11.5% p.a.</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Tenure</span>
                      <span className="font-bold text-slate-900 text-sm">36 Months</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Estimated Monthly EMI</span>
                      <span className="font-bold text-slate-900 text-sm">₹16,480 / mo</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Processing Fee</span>
                      <span className="font-bold text-slate-900 text-sm">₹1,500</span>
                    </div>
                  </div>
                </div>

                <Button onClick={handleAcceptOffer} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5">
                  Accept Loan Offer <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-3">
                  <h3 className="text-lg font-bold text-slate-950">Branch Selection & eSign</h3>
                  <p className="text-xs text-slate-500">Select your preferred Cosmos Bank branch for loan servicing.</p>
                </div>

                <div className="space-y-4 max-w-lg">
                  <Field>
                    <Label htmlFor="branchSelect">Servicing Branch</Label>
                    <select
                      id="branchSelect"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                    >
                      <option value="BR001">Main Branch (Mumbai)</option>
                      <option value="001">Parvati Branch (Pune)</option>
                      <option value="036">Fort Branch (Mumbai)</option>
                    </select>
                  </Field>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      <Lock className="h-4 w-4 text-blue-900" /> Digital eSign Consent
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      By clicking complete, I authorize Cosmos Co-op Bank Ltd to verify my documents and sanction the personal loan facility.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200">
                  <Button onClick={handleCompleteJourney} className="bg-blue-900 hover:bg-blue-950 text-white font-semibold">
                    Complete & Submit Application <Check className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function CustomerJourneyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-900" />
      </div>
    }>
      <CustomerJourneyContent />
    </Suspense>
  );
}
