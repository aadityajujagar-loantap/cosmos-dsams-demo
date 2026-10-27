"use client";

import React, { useEffect, useState } from "react";
import { Eye, FileCheck, RefreshCw, Send } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { FinalizedCommission } from "@/types/finance";
import { Button, Card, CardContent, CardHeader, Drawer, StatusBadge } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/utils";

export function CommissionBatchesView({
  onInvoicesGenerated,
}: {
  onInvoicesGenerated?: () => void;
}) {
  const [commissions, setCommissions] = useState<FinalizedCommission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<FinalizedCommission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generatingForId, setGeneratingForId] = useState<number | null>(null);

  const loadCommissions = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getCommissionsList({ per_page: 50 });
      setCommissions(res.data.items || []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissions();
  }, []);

  const openDetails = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await financeApi.getCommissionDetails(id);
      setSelectedBatch(res.data);
    } catch (err: unknown) {
      alert("Failed to load batch details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGenerateInvoices = async (batch: FinalizedCommission) => {
    if (!confirm(`Generate individual DSA invoices for Commission Batch #${batch.id}?`)) return;
    setGeneratingForId(batch.id);
    try {
      const res = await financeApi.generateDsaInvoices({
        period_id: batch.commission_period_id,
        commission_id: batch.id,
      });
      alert(`Success! Generated ${res.data.count} DSA invoice(s).`);
      onInvoicesGenerated?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Invoice generation failed");
    } finally {
      setGeneratingForId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Finalized Commission Batches</h2>
          <p className="text-sm text-slate-500">Immutable calculation snapshots ready for DSA invoice generation.</p>
        </div>
        <Button onClick={loadCommissions} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="py-3 px-4 font-medium text-slate-800">Finalized Batches</CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b text-xs font-semibold uppercase text-slate-700">
                <tr>
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-right">Disbursed Total</th>
                  <th className="py-3 px-4 text-right">Gross Commission</th>
                  <th className="py-3 px-4 text-right">State TDS</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commissions.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">No finalized commission batches yet.</td>
                  </tr>
                ) : (
                  commissions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">#{c.id}</td>
                      <td className="py-3 px-4 font-mono text-xs">{c.branch_id}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(Number(c.total_disbursed_amount))}</td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">{formatCurrency(Number(c.total_commission_amount))}</td>
                      <td className="py-3 px-4 text-right text-rose-600">-{formatCurrency(Number(c.total_tds_amount))}</td>
                      <td className="py-3 px-4 text-right font-bold text-blue-700">{formatCurrency(Number(c.net_payable_amount))}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={c.status === "COMPUTED" ? "In Review" : "Approved"} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => openDetails(c.id)}>
                          <Eye className="h-4 w-4" /> View Details
                        </Button>
                        <Button
                          size="sm"
                          disabled={generatingForId === c.id}
                          onClick={() => handleGenerateInvoices(c)}
                        >
                          <Send className="h-3.5 w-3.5" /> Generate Invoices
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Batch Details Drawer */}
      <Drawer
        open={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
        title={`Commission Batch #${selectedBatch?.id || ""}`}
        description={`Calculated on ${selectedBatch ? formatDate(selectedBatch.calculated_at) : ""}`}
      >
        {selectedBatch && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded border text-xs">
              <div><span className="text-slate-500">Branch:</span> <strong>{selectedBatch.branch_id}</strong></div>
              <div><span className="text-slate-500">Period ID:</span> <strong>{selectedBatch.commission_period_id}</strong></div>
              <div><span className="text-slate-500">Gross:</span> <strong className="text-emerald-700">{formatCurrency(Number(selectedBatch.total_commission_amount))}</strong></div>
              <div><span className="text-slate-500">Net Payable:</span> <strong className="text-blue-700">{formatCurrency(Number(selectedBatch.net_payable_amount))}</strong></div>
            </div>

            <h4 className="font-semibold text-slate-900 pt-2">Commission Line Items ({selectedBatch.items?.length || 0})</h4>
            <div className="border rounded overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 font-semibold uppercase text-slate-700 sticky top-0">
                  <tr>
                    <th className="p-2">DSA</th>
                    <th className="p-2">Customer / A/C</th>
                    <th className="p-2 text-right">Disbursed</th>
                    <th className="p-2 text-right">Commission</th>
                    <th className="p-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedBatch.items?.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2 font-mono text-xs">{it.dsa_code}</td>
                      <td className="p-2">
                        {it.customer_name || it.lead?.CustName || "Customer"}
                        <div className="font-mono text-slate-400">{it.loan_account_no}</div>
                      </td>
                      <td className="p-2 text-right font-medium">{formatCurrency(Number(it.disbursed_amount))}</td>
                      <td className="p-2 text-right text-emerald-700">{formatCurrency(Number(it.gross_commission))}</td>
                      <td className="p-2 text-right font-bold text-slate-900">{formatCurrency(Number(it.net_commission))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
