"use client";

import React, { useEffect, useState } from "react";
import { Play, Calculator, Check, AlertCircle } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { BranchOption, CommissionPeriod, CommissionPreview, EligibleDisbursement } from "@/types/finance";
import { Button, Card, CardContent, CardHeader, Modal, Select, Label } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/utils";

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
        <CardHeader className="py-3 px-4 font-semibold text-slate-900 border-b">
          Commission Calculation Parameters
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Select Completed Period *</Label>
              <Select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)}>
                <option value="">-- Choose Period --</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>{p.period_name} ({formatDate(p.start_date)} to {formatDate(p.end_date)})</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Select Branch with Eligible Disbursements *</Label>
              <Select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} disabled={!branches.length}>
                <option value="">-- Choose Branch --</option>
                {branches.map((b) => (
                  <option key={b.branch_code} value={b.branch_code}>{b.branch_name} ({b.branch_code})</option>
                ))}
              </Select>
            </div>
          </div>

          {error && <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md">{error}</div>}

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-medium text-slate-700">
              Eligible Disbursed Loans: <strong className="text-blue-600">{disbursements.length}</strong>
            </span>
            <Button
              onClick={handleComputePreview}
              disabled={computing || !selectedPeriodId || !selectedBranch || disbursements.length === 0}
            >
              <Calculator className="h-4 w-4" /> {computing ? "Computing..." : "Dry-Run Preview"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4 font-medium text-slate-800">Eligible Disbursements Preview</CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b text-xs font-semibold uppercase text-slate-700">
                <tr>
                  <th className="py-3 px-4">Account No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">DSA Code</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Disbursed Amount</th>
                  <th className="py-3 px-4 text-center">Disbursed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {disbursements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {loadingEligible ? "Fetching eligible loans..." : "No eligible un-invoiced disbursements for this branch/period."}
                    </td>
                  </tr>
                ) : (
                  disbursements.map((d) => (
                    <tr key={d.lead_facility_id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">{d.loan_account_no}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{d.customer_name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-blue-700">{d.dsa_code}</td>
                      <td className="py-3 px-4 text-slate-600">{d.product_name}</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatCurrency(Number(d.disbursed_amount))}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{formatDate(d.disbursement_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Modal open={previewModalOpen} onClose={() => setPreviewModalOpen(false)} title="Commission Calculation Preview (Dry-Run)" width="max-w-4xl">
        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border">
              <div>
                <p className="text-xs text-slate-500 uppercase">Disbursed Total</p>
                <p className="text-base font-bold text-slate-900">{formatCurrency(Number(preview.total_disbursed_amount))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Gross Commission</p>
                <p className="text-base font-bold text-emerald-600">{formatCurrency(Number(preview.total_commission_amount))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">State TDS Deducted</p>
                <p className="text-base font-bold text-rose-600">-{formatCurrency(Number(preview.total_tds_amount))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Net Payable</p>
                <p className="text-base font-bold text-blue-700">{formatCurrency(Number(preview.net_payable_amount))}</p>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-md">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="bg-slate-100 font-semibold uppercase text-slate-700 sticky top-0">
                  <tr>
                    <th className="p-2">DSA</th>
                    <th className="p-2">Customer / Loan A/C</th>
                    <th className="p-2 text-right">Disbursed</th>
                    <th className="p-2 text-center">Rate</th>
                    <th className="p-2 text-right">Gross</th>
                    <th className="p-2 text-right">TDS</th>
                    <th className="p-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.items.map((it) => (
                    <tr key={it.lead_facility_id}>
                      <td className="p-2 font-mono">{it.dsa_code}</td>
                      <td className="p-2">{it.customer_name}<br /><span className="font-mono text-slate-400">{it.loan_account_no}</span></td>
                      <td className="p-2 text-right font-medium">{formatCurrency(Number(it.disbursed_amount))}</td>
                      <td className="p-2 text-center">{it.commission_rate}% ({it.rate_type})</td>
                      <td className="p-2 text-right font-semibold text-emerald-700">{formatCurrency(Number(it.gross_commission))}</td>
                      <td className="p-2 text-right text-rose-600">-{formatCurrency(Number(it.tds_amount))}</td>
                      <td className="p-2 text-right font-bold text-slate-900">{formatCurrency(Number(it.net_commission))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="ghost" onClick={() => setPreviewModalOpen(false)}>Cancel</Button>
              <Button onClick={handleFinalize} disabled={finalizing}>
                <Check className="h-4 w-4" /> {finalizing ? "Finalizing Snapshot..." : "Finalize & Persist Snapshot"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
