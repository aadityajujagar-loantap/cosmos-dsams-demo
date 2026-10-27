"use client";

import React, { useEffect, useState } from "react";
import { Eye, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { DsaInvoice, DsaInvoiceStatus } from "@/types/finance";
import { Button, Card, CardContent, CardHeader, Input, Select, StatusBadge } from "@/components/ui/primitives";
import { InvoiceDetailDrawer } from "@/components/finance/InvoiceDetailDrawer";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All Statuses", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Recommended", value: "RECOMMENDED" },
  { label: "Approved", value: "APPROVED" },
  { label: "Paid", value: "PAID" },
  { label: "Rejected", value: "REJECTED" },
];

export function InvoicesView({
  isDsaUser = false,
}: {
  isDsaUser?: boolean;
}) {
  const [invoices, setInvoices] = useState<DsaInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<DsaInvoice | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getDsaInvoicesList({
        status: statusFilter || undefined,
        per_page: 50,
      });
      setInvoices(res.data.items || []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const filtered = invoices.filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.invoice_no?.toLowerCase().includes(q) ||
      inv.dsa_code?.toLowerCase().includes(q) ||
      inv.dsa_profile?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{isDsaUser ? "My Invoices" : "DSA Invoices & Payouts"}</h2>
          <p className="text-sm text-slate-500">
            {isDsaUser
              ? "Track your commission invoices, view tax deductions, and submit drafts."
              : "Verify submitted invoices, approve amounts, and track bank payout UTRs."}
          </p>
        </div>
        <Button onClick={loadInvoices} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by invoice # or DSA code..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 px-4 font-medium text-slate-800">
          Invoices List ({filtered.length})
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b text-xs font-semibold uppercase text-slate-700">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">DSA Partner</th>
                  <th className="py-3 px-4 text-center">Date</th>
                  <th className="py-3 px-4 text-right">Gross Comm.</th>
                  <th className="py-3 px-4 text-right">TDS</th>
                  <th className="py-3 px-4 text-right">GST</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">No invoices match your filter criteria.</td>
                  </tr>
                ) : (
                  filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{inv.invoice_no}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{inv.dsa_profile?.name || inv.dsa_code}</div>
                        <div className="text-xs font-mono text-slate-500">{inv.dsa_code}</div>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">{formatDate(inv.invoice_date)}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(Number(inv.gross_amount))}</td>
                      <td className="py-3 px-4 text-right text-rose-600">-{formatCurrency(Number(inv.tds_amount))}</td>
                      <td className="py-3 px-4 text-right text-sky-600">+{formatCurrency(Number(inv.gst_amount))}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(Number(inv.net_payable_amount))}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge
                          status={
                            inv.status === "PAID"
                              ? "Active"
                              : inv.status === "APPROVED"
                              ? "Approved"
                              : inv.status === "REJECTED"
                              ? "Rejected"
                              : "In Review"
                          }
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedInvoice(inv)}>
                          <Eye className="h-4 w-4" /> View
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

      <InvoiceDetailDrawer
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onUpdated={loadInvoices}
        isDsaUser={isDsaUser}
      />
    </div>
  );
}
