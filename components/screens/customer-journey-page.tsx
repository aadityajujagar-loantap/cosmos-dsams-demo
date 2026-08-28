"use client";

import React, { Suspense } from "react";
import { SellNowPage } from "@/components/screens/sell-now-page";

function CustomerJourneyContent() {
  return <SellNowPage publicCustomerMode />;
}

export default function CustomerJourneyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
          <div className="text-center space-y-3">
            <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-blue-600 mx-auto" />
            <p className="text-sm font-medium text-slate-600">Loading Cosmos Bank Customer Journey...</p>
          </div>
        </div>
      }
    >
      <CustomerJourneyContent />
    </Suspense>
  );
}
