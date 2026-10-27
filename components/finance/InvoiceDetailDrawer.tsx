"use client";

import React, { useState } from "react";
import { CheckCircle, XCircle, CreditCard, MessageSquare, Send } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { DsaInvoice } from "@/types/finance";
import { Button, Drawer, StatusBadge } from "@/components/ui/primitives";
import { InvoicePayoutModal, InvoiceNoteModal } from "@/components/finance/InvoiceActionModals";
import {
  InvoiceProfileBankHeader,
  InvoiceTaxSummary,
  InvoiceLoansTable,
  InvoiceActivityTimeline,
} from "@/components/finance/InvoiceDrawerSections";
import { formatDate } from "@/lib/utils";

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
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!invoice) return null;

  const handleStatusUpdate = async (
    status: "SUBMITTED" | "RECOMMENDED" | "APPROVED" | "REJECTED" | "PAID",
    extra?: { payment_reference?: string; payment_mode?: string; remarks?: string }
  ) => {
    setActionLoading(true);
    try {
      await financeApi.updateDsaInvoiceStatus(invoice.id, { status, ...extra });
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

  const handleAddComment = async (comment: string) => {
    setActionLoading(true);
    try {
      await financeApi.addDsaInvoiceEvent(invoice.id, { action: "QUERY_RAISED", remarks: comment });
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
            <span className="text-xs uppercase font-bold text-slate-500">Invoice Status</span>
            <StatusBadge
              status={
                invoice.status === "PAID"
                  ? "Active"
                  : invoice.status === "APPROVED"
                  ? "Approved"
                  : invoice.status === "RECOMMENDED"
                  ? "In Review"
                  : invoice.status === "REJECTED"
                  ? "Rejected"
                  : "Draft"
              }
            />
          </div>

          {/* DSA Profile & Bank info with BAV Badge (FSD 4.9) */}
          <InvoiceProfileBankHeader invoice={invoice} />

          {/* Financial Totals with CGST/SGST & RCM logic (FSD 4.5 & 4.6) */}
          <InvoiceTaxSummary invoice={invoice} />

          {/* Line Items */}
          <InvoiceLoansTable invoice={invoice} />

          {/* Activity Timeline */}
          <InvoiceActivityTimeline invoice={invoice} />

          {/* Action buttons (FSD 4.7/4.8 Maker-Checker) */}
          <div className="pt-3 border-t flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setNoteModalOpen(true)}>
              <MessageSquare className="h-3.5 w-3.5" /> Query / Note
            </Button>
            {isDsaUser && invoice.status === "DRAFT" && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() => handleStatusUpdate("SUBMITTED", { remarks: "DSA raised and submitted invoice" })}
              >
                <Send className="h-3.5 w-3.5" /> Submit to Bank
              </Button>
            )}
            {!isDsaUser && invoice.status === "SUBMITTED" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actionLoading}
                  onClick={() =>
                    handleStatusUpdate("RECOMMENDED", { remarks: "Payment recommended by Finance Maker" })
                  }
                >
                  <CheckCircle className="h-3.5 w-3.5 text-blue-600" /> Recommend Payment
                </Button>
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate("APPROVED", { remarks: "Approved by Finance Checker" })}
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate("REJECTED", { remarks: "Rejected by Finance" })}
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </>
            )}
            {!isDsaUser && invoice.status === "RECOMMENDED" && (
              <>
                <Button
                  size="sm"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate("APPROVED", { remarks: "Approved by Finance Checker" })}
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Approve Payment
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={actionLoading}
                  onClick={() => handleStatusUpdate("REJECTED", { remarks: "Rejected by Finance Checker" })}
                >
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

      <InvoicePayoutModal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        loading={actionLoading}
        onSubmit={({ payment_reference, payment_mode }) =>
          handleStatusUpdate("PAID", {
            payment_reference,
            payment_mode,
            remarks: `Disbursed via ${payment_mode} UTR ${payment_reference}`,
          })
        }
      />

      <InvoiceNoteModal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        loading={actionLoading}
        onSubmit={handleAddComment}
      />
    </>
  );
}
