"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, CreditCard, MessageSquare, Send } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { DsaInvoice } from "@/types/finance";
import { Button, Drawer, Input, Label, Modal, Select, StatusBadge, Textarea } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/utils";

export function InvoiceDetailDrawer({
  invoice,
  onClose,
  onUpdated,
  isDsaUser = false,
}: {
  invoice: DsaInvoice | null;
  onClose: () => void;
  onUpdated?: () => void;
  isDsaUser?: boolean;
}) {
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [utr, setUtr] = useState("");
  const [payMode, setPayMode] = useState("NEFT");
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  if (!invoice) return null;

  const handleStatusUpdate = async (status: "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID", extra?: { payment_reference?: string; payment_mode?: string; remarks?: string }) => {
    setActionLoading(true);
    try {
      await financeApi.updateDsaInvoiceStatus(invoice.id, {
        status,
        ...extra,
      });
      alert(`Invoice status updated to ${status}!`);
      setPayModalOpen(false);
      onUpdated?.();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Status update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment) return;
    setActionLoading(true);
    try {
      await financeApi.addDsaInvoiceEvent(invoice.id, {
        action: "COMMENT_ADDED",
        remarks: comment,
      });
      setComment("");
      setNoteModalOpen(false);
      alert("Note added successfully!");
      onUpdated?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Drawer
        open={Boolean(invoice)}
        onClose={onClose}
        title={`Invoice ${invoice.invoice_no}`}
        description={`Issued on ${formatDate(invoice.invoice_date)}`}
      >
        <div className="space-y-4 text-sm pb-8">
          <div className="flex items-center justify-between border-b pb-3">
            <span className="text-xs uppercase font-bold text-slate-500">Current Status</span>
            <StatusBadge status={invoice.status === "PAID" ? "Active" : invoice.status === "APPROVED" ? "Approved" : invoice.status === "REJECTED" ? "Rejected" : "In Review"} />
          </div>

          {/* DSA Profile & Bank info */}
          <div className="p-3 bg-slate-50 rounded border space-y-1 text-xs">
            <div className="font-semibold text-slate-900">{invoice.dsa_profile?.name || invoice.dsa_code}</div>
            <div className="text-slate-600">DSA Code: <span className="font-mono">{invoice.dsa_code}</span> | Branch: {invoice.branch_code}</div>
            {invoice.dsa_profile?.account_number && (
              <div className="text-slate-500 pt-1 border-t">
                Bank: {invoice.dsa_profile.bank_name || "Bank Account"} | A/C: {invoice.dsa_profile.account_number} | IFSC: {invoice.dsa_profile.ifsc}
              </div>
            )}
          </div>

          {/* Financial Totals */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900 text-white rounded-lg text-xs">
            <div><span className="text-slate-400">Gross Commission:</span> <p className="text-sm font-bold text-emerald-400">{formatCurrency(Number(invoice.gross_amount))}</p></div>
            <div><span className="text-slate-400">State TDS:</span> <p className="text-sm font-bold text-rose-400">-{formatCurrency(Number(invoice.tds_amount))}</p></div>
            <div><span className="text-slate-400">GST (18%):</span> <p className="text-sm font-bold text-sky-400">+{formatCurrency(Number(invoice.gst_amount))}</p></div>
            <div><span className="text-slate-400">Net Payable:</span> <p className="text-sm font-bold text-amber-300">{formatCurrency(Number(invoice.net_payable_amount))}</p></div>
          </div>

          {invoice.payment_reference && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900">
              Paid via {invoice.payment_mode || "NEFT"} | UTR Ref: <strong className="font-mono">{invoice.payment_reference}</strong>
            </div>
          )}

          {/* Line Items */}
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wide">Disbursed Loans ({invoice.items?.length || 0})</h4>
            <div className="border rounded max-h-48 overflow-y-auto">
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
                      <td className="p-2">
                        <div className="font-mono font-medium">{it.loan_account_no}</div>
                        <div className="text-slate-500">{it.lead?.CustName || "Customer"}</div>
                      </td>
                      <td className="p-2 text-right">{formatCurrency(Number(it.disbursed_amount))}</td>
                      <td className="p-2 text-right font-bold text-emerald-700">{formatCurrency(Number(it.gross_commission))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Events Trail */}
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wide">Activity Timeline</h4>
            <div className="border rounded p-2 max-h-36 overflow-y-auto space-y-2">
              {invoice.events?.length === 0 ? <p className="text-xs text-slate-400">No events logged.</p> : null}
              {invoice.events?.map((ev) => (
                <div key={ev.id} className="text-xs border-b border-slate-100 pb-1.5 last:border-none">
                  <div className="flex justify-between font-medium text-slate-800">
                    <span>{ev.action}</span>
                    <span className="text-slate-400">{formatDate(ev.created_at)}</span>
                  </div>
                  <p className="text-slate-600">{ev.remarks}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setNoteModalOpen(true)}>
              <MessageSquare className="h-3.5 w-3.5" /> Add Note
            </Button>

            {isDsaUser && invoice.status === "DRAFT" && (
              <Button size="sm" disabled={actionLoading} onClick={() => handleStatusUpdate("SUBMITTED", { remarks: "Submitted for bank approval" })}>
                <Send className="h-3.5 w-3.5" /> Submit to Bank
              </Button>
            )}

            {!isDsaUser && invoice.status === "SUBMITTED" && (
              <>
                <Button size="sm" disabled={actionLoading} onClick={() => handleStatusUpdate("APPROVED", { remarks: "Approved by finance checker" })}>
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Approve
                </Button>
                <Button size="sm" variant="danger" disabled={actionLoading} onClick={() => handleStatusUpdate("REJECTED", { remarks: "Rejected due to rate discrepancy" })}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </>
            )}

            {!isDsaUser && invoice.status === "APPROVED" && (
              <Button size="sm" onClick={() => setPayModalOpen(true)}>
                <CreditCard className="h-3.5 w-3.5" /> Record Payout (UTR)
              </Button>
            )}
          </div>
        </div>
      </Drawer>

      {/* Record Payout Modal */}
      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Record Payout Details">
        <div className="space-y-3">
          <div>
            <Label>Payment Mode *</Label>
            <Select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="CBS_INTERNAL">CBS Internal Account Transfer</option>
            </Select>
          </div>
          <div>
            <Label>UTR / Reference Number *</Label>
            <Input required placeholder="e.g. UTR20261026998877" value={utr} onChange={(e) => setUtr(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" onClick={() => setPayModalOpen(false)}>Cancel</Button>
            <Button disabled={!utr || actionLoading} onClick={() => handleStatusUpdate("PAID", { payment_reference: utr, payment_mode: payMode, remarks: "Payout disbursed" })}>
              Confirm Payout
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Note Modal */}
      <Modal open={noteModalOpen} onClose={() => setNoteModalOpen(false)} title="Add Audit Comment">
        <form onSubmit={handleAddComment} className="space-y-3">
          <div>
            <Label>Remarks / Observation *</Label>
            <Textarea required placeholder="Enter comment or query regarding this invoice..." value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="ghost" onClick={() => setNoteModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!comment || actionLoading}>Save Comment</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
