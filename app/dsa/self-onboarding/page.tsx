"use client";

import Image from "next/image";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { DsaOnboardingForm } from "@/components/screens/dsa-onboarding-form";
import { withBasePath } from "@/lib/base-path";

export default function DsaSelfOnboardingPage() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="relative z-10 flex items-center gap-3">
                      <Image
                        src={withBasePath("/logo-dsasm-cosmos.png")}
                        alt="Cosmos Logo"
                        width={708}
                        height={118}
                        className="h-8 w-auto"
                        priority
                        unoptimized
                      />
          </div>
          <Link
            href="/login"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Already a Partner? Sign In →
          </Link>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 py-8">
        <DsaOnboardingForm mode="self" />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <p>© 2026 The Cosmos Co-operative Bank Ltd. All rights reserved. Regulated by RBI.</p>
      </footer>
    </div>
  );
}
