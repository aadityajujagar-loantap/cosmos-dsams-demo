"use client";

import React from "react";
import type { EligibleDisbursement } from "@/types/finance";
import { formatCurrency, formatDate } from "@/lib/utils";

export function EligibleDisbursementsTable({
  disbursements,
  loading,
}: {
  disbursements: EligibleDisbursement[];
  loading: boolean;
}) {
  return (
    <div className="pt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700 uppercase">
          Eligible CBS Disbursements ({disbursements.length})
        </span>
        <span className="text-xs text-slate-500">
          Total: {formatCurrency(disbursements.reduce((sum, d) => sum + Number(d.disbursed_amount), 0))}
        </span>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs text-left text-slate-600">
          <thead className="bg-slate-50 font-semibold uppercase text-slate-700">
            <tr>
              <th className="p-2">DSA Code</th>
              <th className="p-2">Customer Name</th>
              <th className="p-2">Loan A/C</th>
              <th className="p-2">Product & Type</th>
              <th className="p-2">Deviation Status</th>
              <th className="p-2 text-right">Disbursed Amount</th>
              <th className="p-2">Disbursed Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  Loading disbursements...
                </td>
              </tr>
            ) : disbursements.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  No eligible uncalculated disbursements for this period and branch.
                </td>
              </tr>
            ) : (
              disbursements.map((d) => (
                <tr key={d.lead_facility_id} className="hover:bg-slate-50">
                  <td className="p-2 font-mono font-medium text-slate-900">{d.dsa_code}</td>
                  <td className="p-2 font-medium">{d.customer_name}</td>
                  <td className="p-2 font-mono">{d.loan_account_no}</td>
                  <td className="p-2">
                    <span className="font-medium text-slate-800">{d.product_name}</span>
                    <span className="text-[10px] text-slate-400 block uppercase">
                      {d.facility_type === "CC_OD" ? "Cash Credit / OD" : "Term Loan"}
                    </span>
                  </td>
                  <td className="p-2">
                    {d.has_deviation ? (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          d.is_commission_eligible === false
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d.deviation_label || d.deviation_type || "Deviation"}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        No Deviation
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right font-medium text-slate-900">
                    {formatCurrency(Number(d.disbursed_amount))}
                  </td>
                  <td className="p-2 text-slate-500">{formatDate(d.disbursement_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
