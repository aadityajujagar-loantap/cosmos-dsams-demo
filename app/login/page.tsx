"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, ShieldCheck, User } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { getDemoRoleForCredentials, type SessionRole } from "@/lib/demo-identities";
import { useMockStore } from "@/lib/store";

const CAPTCHA_CODE = "C7K9Q";
const DUMMY_OTP = "123456";
const OTP_LENGTH = 6;
const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => "");

export default function LoginPage() {
  const { login, currentUser } = useMockStore();
  const { toast } = useToast();
  const router = useRouter();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [pendingRole, setPendingRole] = useState<SessionRole | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(EMPTY_OTP);
  const [error, setError] = useState("");

  useEffect(() => {
    if (currentUser) {
      router.push("/");
    }
  }, [currentUser, router]);

  useEffect(() => {
    if (step !== "otp") return;
    window.requestAnimationFrame(() => otpRefs.current[0]?.focus());
  }, [step]);

  const resetOtp = () => {
    setOtpDigits([...EMPTY_OTP]);
    window.requestAnimationFrame(() => otpRefs.current[0]?.focus());
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter username and password");
      return;
    }

    const role = getDemoRoleForCredentials(identifier, password);
    if (!role) {
      setError("Invalid username or password.");
      return;
    }

    if (captcha.trim().toUpperCase() !== CAPTCHA_CODE) {
      setError("Captcha does not match.");
      return;
    }

    setPendingRole(role);
    setStep("otp");
    setError("");
    setOtpDigits([...EMPTY_OTP]);
  };

  const handleOtpChange = (index: number, value: string) => {
    const nextDigits = value.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");

    setOtpDigits((current) => {
      const next = [...current];
      if (nextDigits.length === 0) {
        next[index] = "";
        return next;
      }

      nextDigits.forEach((digit, offset) => {
        const targetIndex = index + offset;
        if (targetIndex < OTP_LENGTH) {
          next[targetIndex] = digit;
        }
      });
      return next;
    });

    if (nextDigits.length > 0) {
      const nextIndex = Math.min(index + nextDigits.length, OTP_LENGTH - 1);
      window.requestAnimationFrame(() => otpRefs.current[nextIndex]?.focus());
    }
    setError("");
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      otpRefs.current[index - 1]?.focus();
    }

    if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpDigits.join("");

    if (otp.length !== OTP_LENGTH) {
      setError("Enter the 6 digit OTP.");
      toast({
        description: "All OTP fields are required.",
        title: "OTP verification failed",
        variant: "warning",
      });
      return;
    }

    if (otp !== DUMMY_OTP || !pendingRole) {
      setError("Incorrect OTP. Please try again.");
      toast({
        description: "The OTP entered is not valid.",
        title: "OTP verification failed",
        variant: "warning",
      });
      resetOtp();
      return;
    }

    login(pendingRole);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900 via-indigo-950 to-slate-900 opacity-90 z-0" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 z-0" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500 rounded-full blur-3xl opacity-10 z-0" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-2 shadow-md flex items-center justify-center">
            <Image
              src="/logo-dsasm-cosmos.svg"
              alt="Cosmos Logo"
              width={708}
              height={118}
              className="h-8 w-auto"
              priority
            />
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-100">
            Empowering DSAs with Seamless <span className="text-sky-300">Direct Selling Tools</span>
          </h2>
          <p className="text-slate-300 text-md leading-relaxed">
            Manage your agent networks, submit applicants directly, track real-time payout structures, and verify
            document checklists in one single platform.
          </p>
          <div className="flex gap-4 pt-4 border-t border-slate-800">
            <div>
              <p className="text-2xl font-bold text-blue-400">300+</p>
              <p className="text-xs text-slate-400">DSA Partners Sourced</p>
            </div>
            <div className="h-10 w-[1px] bg-slate-800" />
            <div>
              <p className="text-2xl font-bold text-blue-400">Rs. 729 Cr+</p>
              <p className="text-xs text-slate-400">Disbursed Volume</p>
            </div>
            <div className="h-10 w-[1px] bg-slate-800" />
            <div>
              <p className="text-2xl font-bold text-blue-400">Instant</p>
              <p className="text-xs text-slate-400">Auto-BRE Underwriting</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 flex justify-between border-t border-slate-800 pt-6">
          <p>(c) 2026 Cosmos Co-operative Bank Ltd.</p>
          <p>Privacy Policy - Terms of Use</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-20 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3 text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {step === "credentials" ? "Sign In" : "Verify OTP"}
            </h2>
            <p className="text-sm text-slate-500">
              {step === "credentials"
                ? "Access the direct selling console using your registered username and password."
                : "Complete verification for the selected demo account."}
            </p>
          </div>

          {error && (
            <div
              aria-live="polite"
              className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold"
            >
              {error}
            </div>
          )}

          {step === "credentials" ? (
            <form onSubmit={handleCredentialSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="identifier" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="identifier"
                    type="text"
                    placeholder="Enter username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError("");
                    }}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    id="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="captcha" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Captcha
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-3">
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      autoCapitalize="characters"
                      id="captcha"
                      placeholder="Enter captcha"
                      type="text"
                      value={captcha}
                      onChange={(e) => {
                        setCaptcha(e.target.value);
                        setError("");
                      }}
                      className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 uppercase tracking-[0.2em] focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm transition"
                    />
                  </div>
                  <div
                    aria-label={`Captcha code ${CAPTCHA_CODE}`}
                    className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-base font-black tracking-[0.24em] text-slate-800 shadow-inner"
                  >
                    {CAPTCHA_CODE}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="inline-flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-md shadow-blue-100 hover:shadow-lg transition"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Next
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5">
              <div className="space-y-3">
                <label htmlFor="otp-0" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  One Time Password
                </label>
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {otpDigits.map((digit, index) => (
                    <input
                      aria-label={`OTP digit ${index + 1}`}
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      className="h-12 rounded-xl border border-slate-200 bg-white text-center text-lg font-black text-slate-950 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      id={`otp-${index}`}
                      inputMode="numeric"
                      key={index}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      pattern="[0-9]*"
                      ref={(element) => {
                        otpRefs.current[index] = element;
                      }}
                      type="text"
                      value={digit}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setPendingRole(null);
                    setOtpDigits([...EMPTY_OTP]);
                    setError("");
                  }}
                  className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-md shadow-blue-100 hover:shadow-lg transition"
                >
                  <KeyRound className="h-4 w-4" />
                  Verify & Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
