"use client";

import React, { useEffect, useState } from "react";
import { ArrowDownCircle, CheckCircle2, AlertTriangle, RefreshCw, Layers } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { CbsDisbursementEvent } from "@/types/finance";
import { Button, Card, CardContent, CardHeader, Input, Label, Modal, Select, StatusBadge } from "@/components/ui/primitives";
import { formatCurrency, formatDate } from "@/lib/utils";

export function CbsReconciliationView() {
  const [events, setEvents] = useState<CbsDisbursementEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await financeApi.getCbsDisbursementEvents({
        sync_status: statusFilter !== "ALL" ? statusFilter : undefined,
        per_page: 50,
      });
      setEvents(res.data.items || []);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [statusFilter]);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    setSyncSummary(null);
    try {
      const res = await financeApi.syncCbsDisbursements({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        branch_code: branchCode || undefined,
      });
      setSyncSummary(`Processed ${res.data.total} records: ${res.data.matched} matched, ${res.data.unmatched} unmatched.`);
      loadEvents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "CBS sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const matchedCount = events.filter((e) => e.sync_status === "MATCHED").length;
  const exceptionCount = events.filter((e) => e.sync_status === "UNMATCHED_EXCEPTION").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">CBS Disbursement Reconciliation</h2>
          <p className="text-sm text-slate-500">Ingest live CBS core banking transactions and match with DSAMS loan accounts.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadEvents} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={() => setSyncOpen(true)} size="sm">
            <ArrowDownCircle className="h-4 w-4" /> Sync CBS Feed
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><Layers className="h-5 w-5" /></div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-bold">Total Ingested Events</p>
            <p className="text-xl font-bold text-slate-900">{events.length}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="h-5 w-5" /></div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-bold">Matched with Leads</p>
            <p className="text-xl font-bold text-emerald-600">{matchedCount}</p>
          </div>
        </Card>
        <Card className="p-3 flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle className="h-5 w-5" /></div>
          <div>
            <p className="text-xs uppercase text-slate-500 font-bold">Unmatched Exceptions</p>
            <p className="text-xl font-bold text-rose-600">{exceptionCount}</p>
          </div>
        </Card>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
          <span className="font-medium text-slate-800">CBS Disbursement Ingestion Log</span>
          <div className="w-48">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="MATCHED">Matched Only</option>
              <option value="UNMATCHED_EXCEPTION">Exceptions Only</option>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b text-xs font-semibold uppercase text-slate-700">
                <tr>
                  <th className="py-3 px-4">Event Ref</th>
                  <th className="py-3 px-4">Loan Account</th>
                  <th className="py-3 px-4 text-right">Disbursed Amount</th>
                  <th className="py-3 px-4 text-center">Date</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">DSA</th>
                  <th className="py-3 px-4 text-center">Sync Status</th>
                  <th className="py-3 px-4">Audit Note / Exception</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">No CBS disbursement events recorded.</td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{ev.source_event_id}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{ev.loan_account_no}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">{formatCurrency(Number(ev.disbursed_amount))}</td>
                      <td className="py-3 px-4 text-center text-slate-600">{formatDate(ev.disbursement_date)}</td>
                      <td className="py-3 px-4 font-mono text-xs">{ev.branch_code}</td>
                      <td className="py-3 px-4 font-mono text-xs text-blue-700">{ev.dsa_code || "—"}</td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={ev.sync_status === "MATCHED" ? "Approved" : "Rejected"} />
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate" title={ev.exception_reason || ""}>
                        {ev.sync_status === "MATCHED" ? `Matched lead #${ev.matched_lead_id}` : ev.exception_reason || "Unmatched"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sync Modal */}
      <Modal open={syncOpen} onClose={() => setSyncOpen(false)} title="Trigger CBS Ingestion Sync">
        <form onSubmit={handleSync} className="space-y-4">
          <p className="text-sm text-slate-600">
            Fetch loan disbursement feed from CBS core banking system to reconcile eligible transactions into DSAMS.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Branch Code (Optional)</Label>
            <Input placeholder="e.g. BR001 (leave empty for all)" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} />
          </div>
          {syncSummary && <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-sm">{syncSummary}</div>}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="ghost" onClick={() => setSyncOpen(false)}>Close</Button>
            <Button type="submit" disabled={syncing}>
              <ArrowDownCircle className="h-4 w-4" /> {syncing ? "Reconciling..." : "Execute CBS Sync"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
