"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Filter,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";
import { useDsa } from "@/hooks/useDsa";
import { useMockStore } from "@/lib/store";
import { formatCurrency, formatDate, percent } from "@/lib/utils";
import type { Dsa } from "@/types/dsa";

export function ActiveDsasPage() {
  const router = useRouter();
  const { store, currentUser } = useMockStore();
  const {
    dsas,
    listLoading,
    pagination,
    fetchDsas,
    dsaListError,
  } = useDsa();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchParams = useMemo(() => {
    return {
      search: search.trim() || undefined,
      operational_status: "ACTIVE",
      business_type: typeFilter || undefined,
      tier: tierFilter || undefined,
      page,
      per_page: 15,
    };
  }, [search, typeFilter, tierFilter, page]);

  useEffect(() => {
    fetchDsas(fetchParams);
  }, [fetchDsas, fetchParams]);

  // Combine live active DSAs with store fallback for offline/demo robustness
  const activeItems: Dsa[] = useMemo(() => {
    if (dsas && dsas.length > 0) {
      // Return items that have operational_status = ACTIVE or agreement_status = SIGNED_VERIFIED
      return dsas.filter(
        (item: any) =>
          String(item.operational_status || "").toUpperCase() === "ACTIVE" ||
          String(item.agreement_status || "").toUpperCase() === "SIGNED_VERIFIED",
      );
    }

    // Fallback to store if API returns empty list or offline demo
    return store.dsas
      .filter(
        (dsa) =>
          String(dsa.status || "").toLowerCase() === "active" ||
          String((dsa as any).operational_status || "").toUpperCase() === "ACTIVE",
      )
      .map((dsa) => ({
        ...dsa,
        id: Number(dsa.id) || 1,
        operational_status: "ACTIVE",
        agreement_status: "SIGNED_VERIFIED",
      })) as any[];
  }, [dsas, store.dsas]);

  // Client-side search & filtering over the items
  const filteredItems = useMemo(() => {
    return activeItems.filter((item) => {
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const name = String(item.name || "").toLowerCase();
        const code = String(
          (typeof item.dsa_code === "object" ? (item.dsa_code as any)?.code : item.dsa_code) ||
            item.code ||
            "",
        ).toLowerCase();
        const pan = String(item.pan || "").toLowerCase();
        const city = String(item.city || "").toLowerCase();
        const contact = String(item.contact_person || "").toLowerCase();
        if (
          !name.includes(query) &&
          !code.includes(query) &&
          !pan.includes(query) &&
          !city.includes(query) &&
          !contact.includes(query)
        ) {
          return false;
        }
      }

      if (typeFilter) {
        const itemType = String(item.dsa_type || item.business_type || "").toUpperCase();
        if (typeFilter === "INDIVIDUAL" && !itemType.includes("INDIVIDUAL")) {
          return false;
        }
        if (
          typeFilter === "NON_INDIVIDUAL" &&
          itemType.includes("INDIVIDUAL") &&
          !itemType.includes("NON")
        ) {
          return false;
        }
      }

      if (tierFilter && item.tier !== tierFilter) {
        return false;
      }

      return true;
    });
  }, [activeItems, search, typeFilter, tierFilter]);

  // KPI Metrics
  const individualCount = activeItems.filter((i) =>
    String(i.dsa_type || i.business_type || "").toUpperCase().includes("INDIVIDUAL"),
  ).length;
  const entityCount = activeItems.length - individualCount;
  const totalLeads = activeItems.reduce(
    (acc, curr) => acc + (Number(curr.monthly_leads) || 0),
    0,
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <UserCheck className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Active DSAs
            </h1>
            <Badge tone="green">
              {activeItems.length} Operational
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Directory of fully onboarded and sanctioned Direct Selling Agents (DSAs) with verified partnership agreements and active partner codes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => fetchDsas(fetchParams)}
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={listLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={() => router.push("/dsa/management")}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            All Queues
          </Button>

          <Button
            onClick={() => router.push("/dsa/onboarding")}
            size="sm"
            className="gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Onboard DSA
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-50/50 to-white border-emerald-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Partners</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{activeItems.length}</div>
            <p className="mt-0.5 text-xs text-emerald-600 font-medium">
              100% Verified Agreements
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-50/50 to-white border-blue-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Individual DSAs</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{individualCount}</div>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Sole Proprietors & Retail Partners
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-violet-50/50 to-white border-violet-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Corporate & Entity DSAs</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100 text-violet-700">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{entityCount}</div>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Partnerships, LLPs & Pvt Ltd
            </p>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-sky-50/50 to-white border-sky-100/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Leads Mobilized</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-100 text-sky-700">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{totalLeads}</div>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Active Partner Lead Sourcing
            </p>
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="min-h-[480px]">
        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-[320px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                aria-label="Search active DSAs"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, DSA code, PAN, city..."
                value={search}
                className="pl-9 w-full"
              />
            </div>

            <Select
              aria-label="Filter by Type"
              onChange={(e) => setTypeFilter(e.target.value)}
              value={typeFilter}
              className="w-full sm:w-[170px]"
            >
              <option value="">All Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="NON_INDIVIDUAL">Entity / Corporate</option>
            </Select>

            <Select
              aria-label="Filter by Tier"
              onChange={(e) => setTierFilter(e.target.value)}
              value={tierFilter}
              className="w-full sm:w-[140px]"
            >
              <option value="">All Tiers</option>
              <option value="Bronze">Bronze</option>
              <option value="Silver">Silver</option>
              <option value="Gold">Gold</option>
              <option value="Platinum">Platinum</option>
            </Select>

            {(search || typeFilter || tierFilter) && (
              <Button
                onClick={() => {
                  setSearch("");
                  setTypeFilter("");
                  setTierFilter("");
                }}
                size="sm"
                variant="ghost"
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-semibold text-slate-800">{filteredItems.length}</span> active partners
          </div>
        </div>

        {/* Loading / Error States */}
        {listLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Loading active DSA directory...</p>
          </div>
        ) : dsaListError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-600 font-medium">{dsaListError}</p>
            <Button
              onClick={() => fetchDsas(fetchParams)}
              size="sm"
              variant="outline"
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <UserCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                {search || typeFilter || tierFilter
                  ? "No matching active DSAs found"
                  : "No Active DSAs Yet"}
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                {search || typeFilter || tierFilter
                  ? "Try adjusting your search criteria or clearing filters."
                  : "DSAs transition to Active status once their physical partnership agreement is executed following digital consent, uploaded, and verified by Branch Checker."}
              </p>
            </div>
            {!search && !typeFilter && !tierFilter && (
              <Button
                onClick={() => router.push("/dsa/management")}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                View Approval Queue
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="p-4">Partner Details</th>
                  <th className="p-4">Official DSA Code</th>
                  <th className="p-4">Type & PAN</th>
                  <th className="p-4">Operational Status</th>
                  <th className="p-4">Agreement Status</th>
                  <th className="p-4">Branch / City</th>
                  <th className="p-4">Leads / Approval</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const dsaCode =
                    typeof item.dsa_code === "object"
                      ? (item.dsa_code as any)?.code
                      : item.dsa_code || item.code;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/dsa/${item.id}`)}
                      className="cursor-pointer transition hover:bg-slate-50/80"
                    >
                      {/* Partner Details */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-900 hover:text-blue-600">
                            {item.name}
                          </span>
                          <p className="text-xs text-slate-500">
                            {item.contact_person && item.contact_person !== item.name
                              ? `Contact: ${item.contact_person} • `
                              : ""}
                            {item.mobile}
                          </p>
                          {item.email && (
                            <p className="text-[11px] text-slate-400">{item.email}</p>
                          )}
                        </div>
                      </td>

                      {/* Official DSA Code */}
                      <td className="p-4 font-mono text-xs font-bold">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {dsaCode}
                        </span>
                      </td>

                      {/* Type & PAN */}
                      <td className="p-4">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mr-1.5">
                          {item.dsa_type || "INDIVIDUAL"}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {item.pan || "N/A"}
                        </span>
                      </td>

                      {/* Operational Status */}
                      <td className="p-4">
                        <StatusBadge status="ACTIVE" />
                      </td>

                      {/* Agreement Status */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Agreement Verified
                          </span>
                          {item.agreement_approved_at && (
                            <p className="text-[11px] text-slate-500">
                              Approved: {formatDate(item.agreement_approved_at)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Branch / City */}
                      <td className="p-4 text-xs text-slate-700">
                        <p className="font-medium text-slate-900">{item.branch_name || "Main Branch"}</p>
                        <p className="text-slate-500">{item.city}, {item.state}</p>
                      </td>

                      {/* Leads / Approval */}
                      <td className="p-4 text-xs">
                        <p className="font-medium text-slate-900">
                          {item.monthly_leads || 0} leads
                        </p>
                        <p className="text-slate-500">
                          Rate: {percent(item.approval_rate || 0)}
                        </p>
                      </td>

                      {/* Actions */}
                      <td
                        className="p-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => router.push(`/dsa/${item.id}`)}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Profile
                          </Button>

                          <Button
                            onClick={() => router.push(`/dsa/${item.id}?tab=agreements`)}
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            Agreement
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
