"use client";

import React, { useEffect, useState } from "react";
import { Tabs } from "@/components/ui/primitives";
import { isAgentPortal, DSA_PORTAL_ROLES } from "@/lib/portal";
import { authService } from "@/services/authService";
import { CommissionPeriodsView } from "@/components/finance/CommissionPeriodsView";
import { CommissionRunView } from "@/components/finance/CommissionRunView";
import { CommissionBatchesView } from "@/components/finance/CommissionBatchesView";
import { InvoicesView } from "@/components/finance/InvoicesView";
import { CbsReconciliationView } from "@/components/finance/CbsReconciliationView";
import type { CommissionPeriod } from "@/types/finance";

export function FinanceDashboard({
  initialTab = "invoices",
}: {
  initialTab?: "periods" | "run" | "batches" | "invoices" | "cbs";
}) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedPeriodForRun, setSelectedPeriodForRun] = useState<CommissionPeriod | null>(null);
  const [isDsa, setIsDsa] = useState(isAgentPortal);

  useEffect(() => {
    const roles = authService.getRoles();
    const hasDsaRole = roles.some((r) => (DSA_PORTAL_ROLES as readonly string[]).includes(r));
    setIsDsa(isAgentPortal || hasDsaRole);
  }, []);

  const tabs = isDsa
    ? [
        { label: "My Invoices", value: "invoices" },
        { label: "Commission Batches", value: "batches" },
      ]
    : [
        { label: "Invoices & Payouts", value: "invoices" },
        { label: "Billing Periods", value: "periods" },
        { label: "Run Commission", value: "run" },
        { label: "Finalized Batches", value: "batches" },
        { label: "CBS Reconciliation", value: "cbs" },
      ];

  const handleSelectPeriodForRun = (period: CommissionPeriod) => {
    setSelectedPeriodForRun(period);
    setActiveTab("run");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isDsa ? "Commission & Invoicing Portal" : "Commission, Invoicing & CBS Reconciliation"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isDsa
              ? "View commission earnings, track invoice approvals, and manage tax details."
              : "End-to-end loan disbursement matching, slab commission calculation, and payout settlement."}
          </p>
        </div>
      </div>

      <div className="w-full">
        <Tabs tabs={tabs} value={activeTab} onChange={(val) => setActiveTab(val)} />
      </div>

      <div className="mt-4">
        {activeTab === "invoices" && <InvoicesView isDsaUser={isDsa} />}
        {activeTab === "periods" && !isDsa && (
          <CommissionPeriodsView onSelectPeriodForRun={handleSelectPeriodForRun} />
        )}
        {activeTab === "run" && !isDsa && (
          <CommissionRunView
            defaultPeriod={selectedPeriodForRun}
            onFinalized={() => setActiveTab("batches")}
          />
        )}
        {activeTab === "batches" && (
          <CommissionBatchesView onInvoicesGenerated={() => setActiveTab("invoices")} />
        )}
        {activeTab === "cbs" && !isDsa && <CbsReconciliationView />}
      </div>
    </div>
  );
}
