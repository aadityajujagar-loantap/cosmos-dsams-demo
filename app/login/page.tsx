"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, RefreshCw, ShieldCheck, User } from "lucide-react";

import { DsaOnboardingPage } from "@/components/screens/dsa-pages";
import { Modal } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import {
  getDemoUserForCredentials,
  sessionUserFromDsa,
  type DemoSessionUser,
} from "@/lib/demo-identities";
import { useMockStore } from "@/lib/store";

const CAPTCHA_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DUMMY_OTP = "123456";
const OTP_LENGTH = 6;
const EMPTY_OTP = Array.from({ length: OTP_LENGTH }, () => "");

function generateCaptcha(length = 5) {
  return Array.from({ length }, () => CAPTCHA_CHARSET[Math.floor(Math.random() * CAPTCHA_CHARSET.length)]).join("");
}

export default function LoginPage() {
  const { login, currentUser, store } = useMockStore();
  const { toast } = useToast();
  const router = useRouter();
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptcha());
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [pendingUser, setPendingUser] = useState<DemoSessionUser | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(EMPTY_OTP);
  const [error, setError] = useState("");
  const [publicOnboardingOpen, setPublicOnboardingOpen] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptchaCode(generateCaptcha());
    setCaptcha("");
    setError("");
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(refreshCaptcha, 60_000);
    return () => window.clearInterval(intervalId);
  }, [refreshCaptcha]);

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

  function getDsaCredentialUser(username: string, inputPassword: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const dsa = store.dsas.find((item) => item.loginUsername.trim().toLowerCase() === normalizedUsername);

    if (!dsa) return { user: null as DemoSessionUser | null };
    if (dsa.loginPassword !== inputPassword) {
      return { error: "Invalid username or password.", user: null };
    }
    if (dsa.status !== "Active") {
      return {
        error: `This DSA account is ${dsa.status}. Super Admin must activate it before login.`,
        user: null,
      };
    }

    return { user: sessionUserFromDsa(dsa) };
  }

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter username and password");
      return;
    }

    const demoUser = getDemoUserForCredentials(identifier, password);
    const dsaCredentialResult: { error?: string; user: DemoSessionUser | null } = demoUser
      ? { user: demoUser }
      : getDsaCredentialUser(identifier, password);
    if (dsaCredentialResult.error) {
      setError(dsaCredentialResult.error);
      return;
    }
    if (!dsaCredentialResult.user) {
      setError("Invalid username or password.");
      return;
    }

    if (!captchaCode || captcha.trim().toUpperCase() !== captchaCode) {
      setError("Captcha does not match.");
      return;
    }

    setPendingUser(dsaCredentialResult.user);
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

    if (otp !== DUMMY_OTP || !pendingUser) {
      setError("Incorrect OTP. Please try again.");
      toast({
        description: "The OTP entered is not valid.",
        title: "OTP verification failed",
        variant: "warning",
      });
      resetOtp();
      return;
    }

    login(pendingUser);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 font-sans">
      <div className="hidden h-full overflow-hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-8 xl:p-10 relative">
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

        <div className="relative z-10 my-auto max-w-lg space-y-4">
          <h2 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight text-slate-100">
            Empowering DSAs with Seamless <span className="text-sky-300">Direct Selling Tools</span>
          </h2>
          <p className="text-sm leading-relaxed text-slate-300 xl:text-base">
            Manage your agent networks, submit applicants directly, track real-time payout structures, and verify
            document checklists in one single platform.
          </p>
          <div className="flex gap-4 pt-3 border-t border-slate-800">
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

      <div className="flex h-full w-full items-center justify-center overflow-hidden bg-white p-4 sm:p-6 lg:w-1/2 xl:p-8">
        <div className="w-full max-w-md space-y-4">
          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {step === "credentials" ? "Sign In" : "Verify OTP"}
            </h2>
            <p className="text-sm text-slate-500">
              {step === "credentials"
                ? "Access the direct selling console using your registered username and password."
                : "Complete verification for the selected account."}
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
            <form onSubmit={handleCredentialSubmit} className="space-y-3">
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
                <div className="grid grid-cols-[minmax(0,1fr)_132px_44px] gap-3">
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
                  {/* suppressHydrationWarning prevents React from throwing on captcha mismatch.
                      The captchaCode is "" on the server (no Math.random()), and gets set
                      client-side in the useEffect above, so the first client paint shows ".....". */}
                  <div
                    aria-label={`Captcha code ${captchaCode || "loading"}`}
                    className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-base font-black tracking-[0.24em] text-slate-800 shadow-inner"
                    suppressHydrationWarning
                  >
                    {captchaCode || "....."}
                  </div>
                  <button
                    aria-label="Refresh captcha"
                    className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                    onClick={refreshCaptcha}
                    type="button"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
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
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
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
                    setPendingUser(null);
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
                  Verify &amp; Sign In
                </button>
              </div>
            </form>
          )}
          {step === "credentials" ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center">
              <p className="text-sm font-bold text-blue-950">New DSA partner?</p>
              <p className="mt-1 text-xs text-blue-800">Start the onboarding journey without signing in.</p>
              <button
                className="mt-2 h-9 rounded-xl border border-blue-200 bg-white px-4 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                onClick={() => setPublicOnboardingOpen(true)}
                type="button"
              >
                Apply for DSA onboarding
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <Modal
        description="Public DSA onboarding only. Login access is generated after hierarchy approval."
        onClose={() => setPublicOnboardingOpen(false)}
        open={publicOnboardingOpen}
        title="DSA Onboarding Journey"
        width="max-w-6xl"
      >
        <DsaOnboardingPage publicEntry />
      </Modal>
    </div>
  );
}
