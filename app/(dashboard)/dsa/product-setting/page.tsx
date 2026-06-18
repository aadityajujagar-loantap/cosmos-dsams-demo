"use client";

import { ProductSettingPage } from "@/components/screens/product-setting-page";
import { useMockStore } from "@/lib/store";
import { Landmark } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function Page() {
  const { currentUser } = useMockStore();

  if (currentUser?.role !== "DSA Manager" && currentUser?.role !== "DSA Credit") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto my-12">
        <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <Landmark className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md">
          You do not have administrative permissions to configure commission policies. This area is restricted to the DSA Manager and DSA Credit roles.
        </p>
        <Link href="/" className="mt-6">
          <Button type="button">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return <ProductSettingPage />;
}
