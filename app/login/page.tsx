"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Lock, Phone } from "lucide-react";
import { useMockStore } from "@/lib/store";

export default function LoginPage() {
  const { login, currentUser } = useMockStore();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (currentUser) {
      router.push("/");
    }
  }, [currentUser, router]);

  const handlePasswordLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setError("Please enter mobile number or username");
      return;
    }
    const val = identifier.toLowerCase();
    if (val === "9999999999" || val === "admin") {
      login("DSA Manager", identifier);
    } else if (val === "8888888888" || val === "dsa") {
      login("DSA Partner", identifier);
    } else if (val === "7777777777" || val === "user") {
      login("Customer", identifier);
    } else {
      setError("Invalid credentials. Use registered demo credentials.");
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Pane - Branding Banner */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900 via-indigo-950 to-slate-900 opacity-90 z-0" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 z-0" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500 rounded-full blur-3xl opacity-10 z-0" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white shadow-lg">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">COSMOS BANK</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">DSA Partnership Portal</p>
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-100">
            Empowering DSAs with Seamless <span className="text-amber-400">Direct Selling Tools</span>
          </h2>
          <p className="text-slate-300 text-md leading-relaxed">
            Manage your agent networks, submit applicants directly, track real-time payout structures, and verify document checklists in one single platform.
          </p>
          <div className="flex gap-4 pt-4 border-t border-slate-800">
            <div>
              <p className="text-2xl font-bold text-blue-400">300+</p>
              <p className="text-xs text-slate-400">DSA Partners Sourced</p>
            </div>
            <div className="h-10 w-[1px] bg-slate-800" />
            <div>
              <p className="text-2xl font-bold text-blue-400">₹729 Cr+</p>
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
          <p>© 2026 Cosmos Co-operative Bank Ltd.</p>
          <p>Privacy Policy · Terms of Use</p>
        </div>
      </div>

      {/* Right Pane - Form Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-20 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-3 text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sign In</h2>
            <p className="text-sm text-slate-500">
              Access the direct selling console using your registered mobile number or DSA Code.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Mobile / DSA Code / Username
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="identifier"
                  type="text"
                  placeholder="Enter Mobile / DSA Code / Username"
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
                <button type="button" className="text-xs font-semibold text-blue-600 hover:underline">
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm transition"
                />
              </div>
            </div>

            {otpSent && (
              <div className="space-y-1.5">
                <label htmlFor="otp" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Enter One-Time Password (OTP)
                </label>
                <div className="relative">
                  <input
                    id="otp"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-center font-bold tracking-widest text-lg transition"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {!otpSent ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!identifier) {
                      setError("Enter a mobile number to receive OTP");
                      return;
                    }
                    setOtpSent(true);
                  }}
                  className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Send OTP
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="h-11 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Edit Mobile
                </button>
              )}
              <button
                type="submit"
                className="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-md shadow-amber-100 hover:shadow-lg transition"
              >
                Sign In
              </button>
            </div>
          </form>

          {/* Demo Credentials Helper Box */}
          <div className="pt-6 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider text-center lg:text-left">
              Registered Demo Credentials
            </h4>
            <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-xs text-slate-600 space-y-2 font-sans shadow-inner">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200/50">
                <span className="font-bold text-slate-800">1. Super Admin (DSA Manager)</span>
                <span className="font-mono text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">admin / 9999999999</span>
              </div>
              <div className="flex justify-between items-center pb-1 border-b border-slate-200/50">
                <span className="font-bold text-slate-800">2. DSA Partner</span>
                <span className="font-mono text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">dsa / 8888888888</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">3. Customer (User)</span>
                <span className="font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">user / 7777777777</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
