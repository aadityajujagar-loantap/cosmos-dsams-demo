"use client";

import React, { useEffect, useState } from "react";
import { Calculator, AlertCircle } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { BranchOption, CommissionPeriod, CommissionPreview, EligibleDisbursement } from "@/types/finance";
import { Button, Card, CardContent, CardHeader, Select, Label } from "@/components/ui/primitives";
import { CommissionPreviewModal } from "@/components/finance/CommissionPreviewModal";
import { EligibleDisbursementsTable } from "@/components/finance/EligibleDisbursementsTable";
import { formatDate } from "@/lib/utils";

export function CommissionRunView({
  defaultPeriod,
  onFinalized,
}: {
  defaultPeriod?: CommissionPeriod | null;
  onFinalized?: () => void;
}) {
  const [periods, setPeriods] = useState<CommissionPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(defaultPeriod?.id ? String(defaultPeriod.id) : "");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [disbursements, setDisbursements] = useState<EligibleDisbursement[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [preview, setPreview] = useState<CommissionPreview | null>(null);
  const [computing, setComputing] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    financeApi.getCommissionPeriods({ status: "COMPLETED", per_page: 50 }).then((res) => {
      setPeriods(res.data.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) {
      setBranches([]);
      setSelectedBranch("");
      return;
    }
    financeApi.getCommissionPeriodBranches(Number(selectedPeriodId)).then((res) => {
      setBranches(res.data || []);
      if (res.data?.length > 0) setSelectedBranch(res.data[0].branch_code);
    }).catch(() => {});
  }, [selectedPeriodId]);

  useEffect(() => {
    if (!selectedPeriodId || !selectedBranch) {
      setDisbursements([]);
      return;
    }
    setLoadingEligible(true);
    setError(null);
    financeApi.getEligibleDisbursements(Number(selectedPeriodId), selectedBranch).then((res) => {
      setDisbursements(res.data?.items || []);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load eligible disbursements");
    }).finally(() => {
      setLoadingEligible(false);
    });
  }, [selectedPeriodId, selectedBranch]);

  const handleComputePreview = async () => {
    if (!selectedPeriodId || !selectedBranch) return;
    setComputing(true);
    setError(null);
    try {
      const res = await financeApi.computeCommissionPreview({
        period_id: Number(selectedPeriodId),
        branch_id: selectedBranch,
      });
      setPreview(res.data);
      setPreviewModalOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Computation failed");
    } finally {
      setComputing(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedPeriodId || !selectedBranch) return;
    setFinalizing(true);
    try {
      await financeApi.finalizeCommission({
        period_id: Number(selectedPeriodId),
        branch_id: selectedBranch,
      });
      setPreviewModalOpen(false);
      alert("Commission batch finalized successfully!");
      onFinalized?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Finalization failed");
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Run Monthly Commission Calculation</h3>
              <p className="text-xs text-slate-500">
                Select a completed billing period and branch to review eligible loan disbursements and compute preview.
              </p>
            </div>
            <Button
              disabled={!selectedPeriodId || !selectedBranch || computing || disbursements.length === 0}
              onClick={handleComputePreview}
            >
              <Calculator className="h-4 w-4" /> {computing ? "Computing..." : "Dry-Run Preview"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
            <div>
              <Label>Completed Billing Period</Label>
              <Select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
              >
                <option value="">-- Select Completed Period --</option>
                {periods.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.period_name} ({formatDate(p.start_date)} - {formatDate(p.end_date)})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <Select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={!selectedPeriodId || branches.length === 0}
              >
                <option value="">
                  {branches.length === 0 ? "-- No Branches Found --" : "-- Select Branch --"}
                </option>
                {branches.map((b) => (
                  <option key={b.branch_code} value={b.branch_code}>
                    {b.branch_code} - {b.branch_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {error && (
            <div className="my-3 p-3 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <EligibleDisbursementsTable disbursements={disbursements} loading={loadingEligible} />
        </CardContent>
      </Card>

      <CommissionPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        preview={preview}
        finalizing={finalizing}
        onFinalize={handleFinalize}
      />
    </div>
  );
}
