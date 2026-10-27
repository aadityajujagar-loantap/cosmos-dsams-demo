"use client";

import React, { useEffect, useState } from "react";
import { Plus, CheckCircle, RefreshCw, Calendar } from "lucide-react";
import { financeApi } from "@/apis/finance";
import type { CommissionPeriod } from "@/types/finance";
import { Button, Card, CardContent, CardHeader, Input, Label, Modal, StatusBadge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export function CommissionPeriodsView({
  onSelectPeriodForRun,
}: {
  onSelectPeriodForRun?: (period: CommissionPeriod) => void;
}) {
  const [periods, setPeriods] = useState<CommissionPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadPeriods = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await financeApi.getCommissionPeriods({ per_page: 50 });
      setPeriods(res.data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load commission periods");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodName || !newStartDate || !newEndDate) return;
    setCreating(true);
    try {
      await financeApi.createCommissionPeriod({
        period_name: newPeriodName,
        start_date: newStartDate,
        end_date: newEndDate,
      });
      setCreateOpen(false);
      setNewPeriodName("");
      setNewStartDate("");
      setNewEndDate("");
      loadPeriods();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create period");
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async (period: CommissionPeriod) => {
    if (!confirm(`Mark period "${period.period_name}" as COMPLETED? This will lock it for commission computation.`)) return;
    setActionLoading(period.id);
    try {
      await financeApi.completeCommissionPeriod(period.id);
      loadPeriods();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to complete period");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Commission Billing Periods</h2>
          <p className="text-sm text-slate-500">Create, manage, and close monthly billing windows for commission processing.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadPeriods} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> New Billing Period
          </Button>
        </div>
      </div>

      {error ? <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md">{error}</div> : null}

      <Card>
        <CardHeader className="py-3 px-4 font-medium text-slate-800">All Billing Periods</CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase">
                <tr>
                  <th className="py-3 px-4">Period Name</th>
                  <th className="py-3 px-4">Date Range</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Commissions</th>
                  <th className="py-3 px-4 text-center">Invoices</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periods.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">No commission periods found.</td>
                  </tr>
                ) : (
                  periods.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-600" /> {p.period_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDate(p.start_date)} — {formatDate(p.end_date)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={p.status === "OPEN" ? "In Review" : p.status === "COMPLETED" ? "Approved" : "Active"}
                        />
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">{p.commissions_count ?? 0}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">{p.invoices_count ?? 0}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {p.status === "OPEN" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={actionLoading === p.id}
                            onClick={() => handleComplete(p)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> Complete Period
                          </Button>
                        )}
                        {p.status === "COMPLETED" && onSelectPeriodForRun && (
                          <Button size="sm" onClick={() => onSelectPeriodForRun(p)}>
                            Run Commission
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Commission Period">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Period Name *</Label>
            <Input
              required
              placeholder="e.g. November 2026"
              value={newPeriodName}
              onChange={(e) => setNewPeriodName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date *</Label>
              <Input
                required
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date *</Label>
              <Input
                required
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create Period"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
