"use client";

import React, { useState } from "react";
import { Button, Input, Label, Modal, Select } from "@/components/ui/primitives";

export function InvoicePayoutModal({
  open,
  onClose,
  onSubmit,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { payment_reference: string; payment_mode: string }) => void;
  loading?: boolean;
}) {
  const [utr, setUtr] = useState("");
  const [payMode, setPayMode] = useState("NEFT");

  return (
    <Modal open={open} onClose={onClose} title="Record Payout Details">
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
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={loading || !utr} onClick={() => onSubmit({ payment_reference: utr, payment_mode: payMode })}>
            Confirm Payout
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function InvoiceNoteModal({
  open,
  onClose,
  onSubmit,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  loading?: boolean;
}) {
  const [comment, setComment] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment) return;
    onSubmit(comment);
    setComment("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Note / Raise Query">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Label>Query / Remark *</Label>
        <Input required placeholder="Enter query regarding loan accounts or calculations..." value={comment} onChange={(e) => setComment(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading || !comment}>Submit Note</Button>
        </div>
      </form>
    </Modal>
  );
}
