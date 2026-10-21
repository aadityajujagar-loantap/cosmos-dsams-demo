"use client";

import { useMockStore } from "@/lib/store";
import { DsaOnboardingForm } from "@/components/screens/dsa-onboarding-form";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives";

function isCheckerRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().replace(/[-_ ]/g, "");
  return normalized === "checker" || normalized === "branchchecker";
}

export default function DsaOnboardingPage() {
  const { currentUser } = useMockStore();

  if (isCheckerRole(currentUser?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="rounded-full bg-rose-100 p-4 mb-4 text-rose-600">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied (403 Forbidden)</h1>
        <p className="text-slate-600 max-w-md mb-6 text-sm">
          Only Maker can onboard a DSA. Checker accounts are not authorized to onboard a DSA or access this page.
        </p>
        <Link href="/">
          <Button variant="primary">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return <DsaOnboardingForm mode="branch" />;
}
