"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Lock, User } from "lucide-react";
import { getDemoRoleForCredentials } from "@/lib/demo-identities";
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

  const handlePasswordLogin = (e: React.FormEvent) => {
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
    login(role);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* Left Pane - Branding Banner */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900 via-indigo-950 to-slate-900 opacity-90 z-0" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 z-0" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500 rounded-full blur-3xl opacity-10 z-0" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="bg-white/95 backdrop-blur rounded-lg px-4 py-2 shadow-md flex items-center justify-center">
            <img src="/logo-dsasm-cosmos.svg" alt="Cosmos Logo" className="h-8 w-auto" />
          </div>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-100">
            Empowering DSAs with Seamless <span className="text-sky-300">Direct Selling Tools</span>
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
              Access the direct selling console using your registered username and password.
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm transition"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-md shadow-blue-100 hover:shadow-lg transition"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
