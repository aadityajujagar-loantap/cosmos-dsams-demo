"use client";

import React from "react";
import { Check } from "lucide-react";
import type { CommissionPreview } from "@/types/finance";
import { Button, Modal } from "@/components/ui/primitives";
import { formatCurrency } from "@/lib/utils";

export function CommissionPreviewModal({
  open,
  onClose,
  preview,
  finalizing,
  onFinalize,
}: {
  open: boolean;
  onClose: () => void;
  preview: CommissionPreview | null;
  finalizing: boolean;
  onFinalize: () => void;
}) {
  if (!preview) return null;

  return (
    <Modal open={open} onClose={onClose} title="Commission Calculation Preview (Dry-Run)" width="max-w-4xl">
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
            <p className="text-xs text-slate-500 uppercase">TDS Deducted (2%)</p>
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
                <th className="p-2 text-right">TDS (2%)</th>
                <th className="p-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {preview.items.map((it) => (
                <tr key={it.lead_facility_id} className={it.is_commission_eligible === false ? "bg-rose-50/50" : ""}>
                  <td className="p-2 font-mono">{it.dsa_code}</td>
                  <td className="p-2">
                    {it.customer_name}
                    <br />
                    <span className="font-mono text-slate-400">{it.loan_account_no}</span>
                    {it.is_commission_eligible === false && (
                      <div className="text-[10px] text-rose-600 font-medium">Ineligible: FSD 4.3 Deviation breach</div>
                    )}
                  </td>
                  <td className="p-2 text-right font-medium">{formatCurrency(Number(it.disbursed_amount))}</td>
                  <td className="p-2 text-center">
                    {it.is_commission_eligible === false
                      ? "0.00% (Disqualified)"
                      : `${it.commission_rate}% (${it.rate_type})`}
                  </td>
                  <td className="p-2 text-right font-semibold text-emerald-700">
                    {formatCurrency(Number(it.gross_commission))}
                  </td>
                  <td className="p-2 text-right text-rose-600">-{formatCurrency(Number(it.tds_amount))}</td>
                  <td className="p-2 text-right font-bold text-slate-900">{formatCurrency(Number(it.net_commission))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onFinalize} disabled={finalizing}>
            <Check className="h-4 w-4" /> {finalizing ? "Finalizing Snapshot..." : "Finalize & Persist Snapshot"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
