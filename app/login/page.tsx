"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, User } from "lucide-react";

import { getDemoRoleForCredentials, DEMO_USERS, type SessionRole } from "@/lib/demo-identities";
import { useMockStore } from "@/lib/store";

export default function LoginPage() {
  const { login, currentUser } = useMockStore();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (currentUser) {
      router.push("/");
    }
  }, [currentUser, router]);

  const handleLogin = (roleToLogin?: SessionRole) => {
    if (roleToLogin) {
      login(roleToLogin);
      return;
    }

    if (!identifier.trim()) {
      setError("Please enter a username or select a demo account below.");
      return;
    }

    const matchedRole =
      getDemoRoleForCredentials(identifier, password) ||
      (identifier.toLowerCase() === "admin"
        ? "DSA Manager"
        : identifier.toLowerCase() === "credit"
          ? "DSA Credit"
          : identifier.toLowerCase() === "branch"
            ? "Branch User"
            : identifier.toLowerCase() === "dsa"
              ? "DSA Partner"
              : identifier.toLowerCase() === "user"
                ? "Customer"
                : null);

    if (!matchedRole) {
      setError("Invalid credentials. Please click one of the demo accounts below.");
      return;
    }

    login(matchedRole);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Pane - Branding Banner */}
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
        <div className="w-full max-w-md space-y-7">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Sign In</h2>
            <p className="text-sm text-slate-500">
              Access the direct selling console using demo credentials or one-click quick login.
            </p>
          </div>

          {error && (
            <div
              aria-live="polite"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="identifier"
                  type="text"
                  placeholder="e.g. admin, branch, dsa"
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
              <label htmlFor="password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm transition"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                className="inline-flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-md shadow-blue-100 hover:shadow-lg transition cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                Sign In
              </button>
            </div>
          </form>

          {/* Quick Demo Login Accounts */}
          <div className="pt-4 border-t border-slate-100 space-y-2.5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center lg:text-left">
              Quick Login as Demo Role
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleLogin("DSA Manager")}
                className="flex items-center justify-between p-2.5 rounded-lg border border-blue-200 bg-blue-50/60 hover:bg-blue-100/80 text-blue-950 font-medium transition cursor-pointer text-left"
              >
                <span>DSA Manager</span>
                <span className="text-[10px] text-blue-700 font-mono font-bold">admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleLogin("Branch User")}
                className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-950 font-medium transition cursor-pointer text-left"
              >
                <span>Branch User</span>
                <span className="text-[10px] text-emerald-700 font-mono font-bold">branch</span>
              </button>
              <button
                type="button"
                onClick={() => handleLogin("DSA Credit")}
                className="flex items-center justify-between p-2.5 rounded-lg border border-purple-200 bg-purple-50/60 hover:bg-purple-100/80 text-purple-950 font-medium transition cursor-pointer text-left"
              >
                <span>DSA Credit</span>
                <span className="text-[10px] text-purple-700 font-mono font-bold">credit</span>
              </button>
              <button
                type="button"
                onClick={() => handleLogin("DSA Partner")}
                className="flex items-center justify-between p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/80 text-amber-950 font-medium transition cursor-pointer text-left"
              >
                <span>DSA Partner</span>
                <span className="text-[10px] text-amber-700 font-mono font-bold">dsa</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleLogin("Customer")}
              className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-medium transition cursor-pointer text-left"
            >
              <span>Customer / Applicant Portal</span>
              <span className="text-[10px] text-slate-600 font-mono font-bold">user</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
