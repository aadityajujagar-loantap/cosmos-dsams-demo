"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import type { DsaInvoice } from "@/types/finance";
import { formatCurrency, formatDate } from "@/lib/utils";

export function InvoiceProfileBankHeader({ invoice }: { invoice: DsaInvoice }) {
  return (
    <div className="p-3 bg-slate-50 rounded border space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">{invoice.dsa_profile?.name || invoice.dsa_code}</span>
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
            invoice.is_rcm ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
          }`}
        >
          {invoice.dsa_category || (invoice.is_rcm ? "Non-Company (RCM Basis)" : "Company DSA")}
        </span>
      </div>
      <div className="text-slate-600">
        DSA Code: <span className="font-mono font-medium">{invoice.dsa_code}</span> | Branch: {invoice.branch_code}
      </div>
      {invoice.dsa_profile?.account_number && (
        <div className="text-slate-500 pt-1.5 border-t flex flex-wrap items-center justify-between gap-1">
          <span>
            A/C: {invoice.dsa_profile.account_number} ({invoice.dsa_profile.bank_name || "Cosmos Bank"}) | IFSC:{" "}
            {invoice.dsa_profile.ifsc}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <ShieldCheck className="h-3 w-3" /> BAV Verified
          </span>
        </div>
      )}
    </div>
  );
}

export function InvoiceTaxSummary({ invoice }: { invoice: DsaInvoice }) {
  const cgst = invoice.cgst_amount || Number(invoice.gst_amount) / 2;
  const sgst = invoice.sgst_amount || Number(invoice.gst_amount) / 2;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900 text-white rounded-lg text-xs">
        <div>
          <span className="text-slate-400">Gross Commission:</span>
          <p className="text-sm font-bold text-emerald-400">{formatCurrency(Number(invoice.gross_amount))}</p>
        </div>
        <div>
          <span className="text-slate-400">TDS (2% Sec 194H):</span>
          <p className="text-sm font-bold text-rose-400">-{formatCurrency(Number(invoice.tds_amount))}</p>
        </div>
        <div>
          <span className="text-slate-400">GST (18%):</span>
          <p className="text-sm font-bold text-sky-400">
            {invoice.is_rcm ? "(RCM) " : "+"}
            {formatCurrency(Number(invoice.gst_amount))}
          </p>
          <span className="text-[10px] text-slate-400">
            CGST 9%: {formatCurrency(Number(cgst))} | SGST 9%: {formatCurrency(Number(sgst))}
          </span>
        </div>
        <div>
          <span className="text-slate-400">Net Payable:</span>
          <p className="text-sm font-bold text-amber-300">{formatCurrency(Number(invoice.net_payable_amount))}</p>
        </div>
      </div>

      {invoice.is_rcm && Number(invoice.gst_amount) > 0 && (
        <div className="p-2 bg-purple-50 border border-purple-200 rounded text-[11px] text-purple-900">
          <strong>FSD 4.5 RCM Basis:</strong> Non-Company DSA. 18% GST is settled directly with Govt by Cosmos Bank under RCM. Net payout is Gross less 2% TDS.
        </div>
      )}

      {invoice.payment_reference && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
          Paid via {invoice.payment_mode || "NEFT"} | UTR Ref: <strong className="font-mono">{invoice.payment_reference}</strong>
        </div>
      )}
    </div>
  );
}

export function InvoiceLoansTable({ invoice }: { invoice: DsaInvoice }) {
  return (
    <div className="space-y-1">
      <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wide">
        Disbursed Loans ({invoice.items?.length || 0})
      </h4>
      <div className="border rounded max-h-40 overflow-y-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 uppercase text-slate-600 sticky top-0">
            <tr>
              <th className="p-2">Loan A/C</th>
              <th className="p-2 text-right">Disbursed</th>
              <th className="p-2 text-right">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items?.map((it) => (
              <tr key={it.id}>
                <td className="p-2 font-mono">
                  <div>{it.loan_account_no || "A/C Pending"}</div>
                  <div className="text-slate-500 font-sans">{it.lead?.CustName || "Customer"}</div>
                </td>
                <td className="p-2 text-right">{formatCurrency(Number(it.disbursed_amount))}</td>
                <td className="p-2 text-right font-bold text-emerald-700">
                  {formatCurrency(Number(it.gross_commission))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InvoiceActivityTimeline({ invoice }: { invoice: DsaInvoice }) {
  return (
    <div className="space-y-1">
      <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wide">Activity Timeline</h4>
      <div className="border rounded p-2 max-h-28 overflow-y-auto space-y-2 text-xs">
        {invoice.events?.length === 0 ? <p className="text-slate-400">No events logged.</p> : null}
        {invoice.events?.map((ev) => (
          <div key={ev.id} className="border-b border-slate-100 pb-1 last:border-none">
            <div className="flex justify-between font-medium text-slate-800">
              <span>{ev.action}</span>
              <span className="text-slate-400">{formatDate(ev.created_at)}</span>
            </div>
            <p className="text-slate-600">{ev.remarks}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
