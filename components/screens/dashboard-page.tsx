"use client";

import {
  Activity,
  BadgeIndianRupee,
  Building2,
  ClipboardCheck,
  FileWarning,
  Users,
  Check,
  X,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Briefcase,
  TrendingUp,
  Coins,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";

import { BarChartCard, KpiCard, PieChartCard, TrendCard } from "@/components/charts";
import { PageHeader } from "@/components/module";
import {
  Card,
  CardContent,
  CardHeader,
  StatusBadge,
  Button,
  Modal,
  Input,
  Label,
  Select,
} from "@/components/ui/primitives";
import { useMockStore } from "@/lib/store";
import { compactNumber, formatCurrency, formatDate, makeId } from "@/lib/utils";
import { Application, Product, Lead } from "@/lib/types";

export function DashboardPage() {
  const { store, currentUser, updateItem, createItem } = useMockStore();

  // State for Customer Loan Application Modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyStep, setApplyStep] = useState(1);
  const [loanProduct, setLoanProduct] = useState<Product>("Personal Loan");
  const [loanAmount, setLoanAmount] = useState("500000");
  const [loanSalary, setLoanSalary] = useState("50000");
  const [customerCity, setCustomerCity] = useState("Mumbai");
  const [customerPan, setCustomerPan] = useState("");
  const [customerAadhaar, setCustomerAadhaar] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [sourcingPartner, setSourcingPartner] = useState("dsa-direct");

  // ----------------------------------------------------
  // 1. DSA MANAGER (SUPER ADMIN) CALCULATIONS & RENDER
  // ----------------------------------------------------
  const stats = useMemo(() => {
    const activeDsas = store.dsas.filter((item) => item.status === "Active").length;
    const approved = store.applications.filter((item) => item.status === "Approved" || item.status === "Disbursed");
    const totalPayout = store.commissions.reduce((sum, item) => sum + item.payout, 0);
    const riskQueue = store.applications.filter((item) => item.riskScore > 78 || item.status === "On Hold").length;
    return { activeDsas, approved: approved.length, riskQueue, totalPayout };
  }, [store]);

  const pendingDsas = useMemo(() => {
    return store.dsas.filter((item) => item.status === "Submitted" || item.status === "KYC Pending");
  }, [store.dsas]);

  const monthlyOnboarding = [
    { name: "Jan", value: 7 },
    { name: "Feb", value: 11 },
    { name: "Mar", value: 8 },
    { name: "Apr", value: 14 },
    { name: "May", value: 10 },
    { name: "Jun", value: 6 },
  ];

  const applicationTrend = [
    { name: "Jan", value: 36 },
    { name: "Feb", value: 44 },
    { name: "Mar", value: 52 },
    { name: "Apr", value: 49 },
    { name: "May", value: 61 },
    { name: "Jun", value: 58 },
  ];

  const funnel = [
    { name: "Leads", value: store.leads.length },
    { name: "Qualified", value: store.leads.filter((item) => item.status === "Qualified").length + 42 },
    { name: "Applications", value: store.applications.length },
    { name: "Approved", value: stats.approved },
    { name: "Disbursed", value: store.applications.filter((item) => item.status === "Disbursed").length },
  ];

  const handleVerifyDsa = (id: string, approve: boolean) => {
    updateItem("dsas", id, { status: approve ? "Active" : "Rejected" });
  };

  // ----------------------------------------------------
  // 2. DSA PARTNER CALCULATIONS
  // ----------------------------------------------------
  const partnerStats = useMemo(() => {
    if (!currentUser) return { leadsCount: 0, appsCount: 0, commissionTotal: 0, agentsCount: 0 };
    
    const isPartnerMock = currentUser.name === "dsa" || currentUser.name === "8888888888" || currentUser.name === "TCP Estate Co.";
    const partnerLeads = store.leads.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name ||
      (isPartnerMock && (item.dsaName === "TCP Estate Co." || item.dsaId === "DSA-10001"))
    );
    const partnerApps = store.applications.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name ||
      (isPartnerMock && (item.dsaName === "TCP Estate Co." || item.dsaId === "DSA-10001"))
    );
    const partnerCommissions = store.commissions.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name ||
      (isPartnerMock && (item.dsaName === "TCP Estate Co." || item.dsaId === "DSA-10001"))
    );
    const commissionTotal = partnerCommissions.reduce((sum, item) => sum + item.payout, 0);
    const agentsCount = store.dsas.filter((item) => 
      item.manager === currentUser.name || 
      (isPartnerMock && item.manager === "TCP Estate Co.")
    ).length;

    return {
      leadsCount: partnerLeads.length,
      appsCount: partnerApps.length,
      commissionTotal,
      agentsCount,
    };
  }, [store, currentUser]);

  const partnerAgents = useMemo(() => {
    if (!currentUser) return [];
    const isPartnerMock = currentUser.name === "dsa" || currentUser.name === "8888888888" || currentUser.name === "TCP Estate Co.";
    return store.dsas.filter((item) => 
      item.manager === currentUser.name || 
      (isPartnerMock && item.manager === "TCP Estate Co.")
    );
  }, [store.dsas, currentUser]);

  const partnerLeadTrend = [
    { name: "Jan", value: 4 },
    { name: "Feb", value: 7 },
    { name: "Mar", value: 12 },
    { name: "Apr", value: 9 },
    { name: "May", value: 15 },
    { name: "Jun", value: partnerStats.leadsCount || 18 },
  ];

  // ----------------------------------------------------
  // 3. CUSTOMER CALCULATIONS & JOURNEY FORM SUBMISSION
  // ----------------------------------------------------
  const customerApps = useMemo(() => {
    if (!currentUser) return [];
    const isCustomerMock = currentUser.name === "user" || currentUser.name === "7777777777" || currentUser.name === "Amit Kumar";
    return store.applications.filter((item) => 
      item.customer === currentUser.name || 
      (isCustomerMock && item.customer === "Amit Kumar")
    );
  }, [store.applications, currentUser]);

  const customerStats = useMemo(() => {
    const active = customerApps.filter(
      (item) => item.status !== "Approved" && item.status !== "Disbursed" && item.status !== "Rejected"
    ).length;
    const disbursed = customerApps.filter((item) => item.status === "Disbursed").length;
    const totalBorrowed = customerApps
      .filter((item) => item.status === "Disbursed")
      .reduce((sum, item) => sum + item.loanAmount, 0);

    return { active, disbursed, totalBorrowed };
  }, [customerApps]);

  const handleSimulateUpload = (docName: string) => {
    setUploadedDocs((prev) => [...prev, docName]);
  };

  const handleApplySubmit = () => {
    if (!currentUser) return;
    const errors: Record<string, string> = {};
    if (!customerPan || !/^[A-Z]{5}\d{4}[A-Z]$/.test(customerPan.toUpperCase())) {
      errors.pan = "Enter a valid PAN card (e.g. ABCDE1234F)";
    }
    if (!customerAadhaar || !/^\d{12}$/.test(customerAadhaar)) {
      errors.aadhaar = "Enter a valid 12-digit Aadhaar number";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const appAmount = Number(loanAmount);
    const salary = Number(loanSalary);
    const panVal = customerPan.toUpperCase();

    const selectedDsa = store.dsas.find((item) => item.id === sourcingPartner);
    const dsaId = selectedDsa ? selectedDsa.id : "dsa-direct";
    const dsaName = selectedDsa ? selectedDsa.name : "Cosmos Bank";

    // Create lead record
    const leadId = makeId("lead");
    const lCode = `LD-${Math.floor(10000 + Math.random() * 90000)}`;
    const newLeadItem: Lead = {
      id: leadId,
      leadId: lCode,
      customer: currentUser.name,
      mobile: currentUser.mobile || "7777777777",
      email: currentUser.email || "customer@example.com",
      city: customerCity,
      source: selectedDsa ? "Partner" : "Website",
      product: loanProduct,
      amount: appAmount,
      status: "New",
      dsaId: dsaId,
      dsaName: dsaName,
      owner: "System Auto Desk",
      createdAt: new Date().toISOString(),
      nextAction: "BRE Underwriting Check",
    };

    // Create application record
    const appId = makeId("app");
    const aCode = `APP-${Math.floor(10000 + Math.random() * 90000)}`;
    const newAppItem: Application = {
      id: appId,
      applicationId: aCode,
      customer: currentUser.name,
      mobile: currentUser.mobile || "7777777777",
      email: currentUser.email || "customer@example.com",
      pan: panVal,
      aadhaar: `XXXX-XXXX-${customerAadhaar.slice(-4)}`,
      city: customerCity,
      dsaId: dsaId,
      dsaName: dsaName,
      product: loanProduct,
      loanAmount: appAmount,
      status: "In Review",
      stage: "BRE Check",
      riskScore: 48,
      creditScore: 742,
      salary: salary,
      createdAt: new Date().toISOString(),
      decisionSummary: `Successfully submitted via customer direct portal. Sourced by ${dsaName}. Queued for automated BRE rule scoring.`,
      notes: [`Customer applied directly, assigning lead sourcing to ${dsaName}.`],
      timeline: [
        {
          id: makeId("tl"),
          title: "Application Created",
          note: `Form submitted directly by the borrower, assigned to ${dsaName}.`,
          actor: currentUser.name,
          at: new Date().toISOString(),
        },
        {
          id: makeId("tl"),
          title: "Auto KYC Verified",
          note: "PAN and Aadhaar validation checked against dummy bureau database.",
          actor: "Cosmos Auto Desk",
          at: new Date().toISOString(),
        },
      ],
      verificationStatus: "In Progress",
    };

    createItem("leads", newLeadItem);
    createItem("applications", newAppItem);

    // Reset Form
    setApplyStep(4); // Success Receipt
  };

  const resetForm = () => {
    setApplyStep(1);
    setCustomerPan("");
    setCustomerAadhaar("");
    setUploadedDocs([]);
    setFormErrors({});
    setSourcingPartner("dsa-direct");
    setApplyModalOpen(false);
  };

  // If no user context, return loading or access state handled by app shell redirect
  if (!currentUser) return null;

  // ----------------------------------------------------
  // VIEW RENDERER BASED ON USER ROLE
  // ----------------------------------------------------
  if (currentUser.role === "DSA Manager") {
    // --------------------------------------------------
    // RENDER: SUPER ADMIN / DSA MANAGER
    // --------------------------------------------------
    return (
      <div>
        <PageHeader
          description="Command center for partner onboarding, lead velocity, underwriting health, verification queues, and payout exposure."
          eyebrow="Portfolio cockpit"
          title="Dashboard"
        />

        {/* Verification Alert Banner */}
        {pendingDsas.length > 0 && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800">
                <Clock className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">DSAs Pending Approval</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  There are {pendingDsas.length} Direct Selling Agents waiting for KYC & business review verification.
                </p>
              </div>
            </div>
            <Link href="#verification-queue">
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold shrink-0">
                Review Queue
              </Button>
            </Link>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard change="+12.4%" icon={Building2} label="Active DSAs" tone="blue" value={String(stats.activeDsas)} />
          <KpiCard change="+9.1%" icon={ClipboardCheck} label="Approved applications" tone="green" value={String(stats.approved)} />
          <KpiCard change="-3.6%" icon={FileWarning} label="Risk queue" tone="amber" value={String(stats.riskQueue)} />
          <KpiCard change="+18.2%" icon={BadgeIndianRupee} label="Payout exposure" tone="slate" value={compactNumber(stats.totalPayout)} />
        </div>

        {/* Onboarding & Sourcing trends */}
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <TrendCard
            data={monthlyOnboarding}
            dataKey="value"
            subtitle="New partner onboarding over the current fiscal window"
            title="Monthly onboarding trend"
            type="area"
          />
          <TrendCard
            data={applicationTrend}
            dataKey="value"
            subtitle="Application volume across DSA-sourced products"
            title="Application trend"
          />
        </div>

        {/* Dynamic Verification Queue section */}
        <div id="verification-queue" className="mt-6 scroll-mt-20">
          <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Pending DSA Verification Queue</h2>
                <p className="text-xs text-slate-500 mt-0.5">Verify and onboard submitted partners instantly</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {pendingDsas.length} awaiting
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {pendingDsas.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="p-4 pl-6">Partner Details</th>
                        <th className="p-4">Contact</th>
                        <th className="p-4">City</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingDsas.map((dsa) => (
                        <tr key={dsa.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-4 pl-6">
                            <div className="font-semibold text-slate-800">{dsa.name}</div>
                            <div className="text-xs text-slate-500">{dsa.code} · {dsa.businessType}</div>
                          </td>
                          <td className="p-4 text-xs text-slate-600">
                            <div>{dsa.email}</div>
                            <div>{dsa.mobile}</div>
                          </td>
                          <td className="p-4 text-slate-700 font-medium">{dsa.city}</td>
                          <td className="p-4">
                            <StatusBadge status={dsa.status} />
                          </td>
                          <td className="p-4 text-right pr-6">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleVerifyDsa(dsa.id, true)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition shadow-sm"
                                title="Approve & Activate"
                              >
                                <Check className="h-4.5 w-4.5" />
                              </button>
                              <button
                                onClick={() => handleVerifyDsa(dsa.id, false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition shadow-sm"
                                title="Reject Partner"
                              >
                                <X className="h-4.5 w-4.5" />
                              </button>
                              <Link href={`/dsa/${dsa.id}`}>
                                <button className="inline-flex h-8 px-2.5 items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
                                  View profile
                                </button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Verification Queue is Empty!</p>
                  <p className="text-xs text-slate-400 mt-0.5">All onboarded partners have been processed.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <PieChartCard data={funnel} dataKey="value" subtitle="Lead-to-disbursal stage breakdown" title="Approval mix" />
          <BarChartCard
            data={store.commissions.slice(0, 6).map((item) => ({
              name: item.month.split(" ")[0],
              value: Math.round(item.payout / 1000),
            }))}
            dataKey="value"
            subtitle="Payouts in thousands across recent monthly batches"
            title="Commission run-rate"
          />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardContent>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Recent activity</h2>
                  <p className="text-sm text-slate-500">Audit events generated by workflows and users</p>
                </div>
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div className="space-y-3">
                {store.auditLogs.slice(0, 6).map((log) => (
                  <div className="flex items-start gap-3 rounded-md border border-slate-100 p-3" key={log.id}>
                    <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-950">{log.action}</p>
                      <p className="text-xs text-slate-500">
                        {log.actor} · {log.entity} · {formatDate(log.at)}
                      </p>
                    </div>
                    <StatusBadge status={log.severity} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Operational queues</h2>
                  <p className="text-sm text-slate-500">Work waiting for ownership today</p>
                </div>
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="space-y-3">
                {[
                  ["KYC pending DSAs", store.dsas.filter((item) => item.status === "KYC Pending").length],
                  ["Verification checks", store.verificationChecks.filter((item) => item.status !== "Verified").length],
                  ["Pending approvals", store.approvals.filter((item) => item.status === "Pending").length],
                  ["Unread notifications", store.notifications.filter((item) => item.status === "Unread").length],
                ].map(([label, value]) => (
                  <div className="flex items-center justify-between rounded-md bg-slate-50 p-3" key={label}>
                    <span className="text-sm text-slate-600">{label}</span>
                    <span className="text-lg font-semibold text-slate-950">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-950">Projected commission liability</p>
                <p className="mt-1 text-2xl font-semibold text-blue-700">{formatCurrency(stats.totalPayout)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } else if (currentUser.role === "DSA Partner") {
    // --------------------------------------------------
    // RENDER: DSA PARTNER / MANAGER
    // --------------------------------------------------
    return (
      <div>
        <PageHeader
          description="Access your sourced applicant status, track sub-agents under your network, and check real-time payouts."
          eyebrow="Direct Selling Channel"
          title={`Partner Portal: ${currentUser.name}`}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard change="+8.2%" icon={Briefcase} label="My Sourced Leads" tone="blue" value={String(partnerStats.leadsCount)} />
          <KpiCard change="+12.0%" icon={ClipboardCheck} label="Active Applications" tone="green" value={String(partnerStats.appsCount)} />
          <KpiCard change="+14.5%" icon={Coins} label="My Commission Earnings" tone="slate" value={formatCurrency(partnerStats.commissionTotal)} />
          <KpiCard change="+2" icon={Users} label="My Sub-Agent Network" tone="amber" value={String(partnerStats.agentsCount)} />
        </div>

        {/* Sourcing Trend & Quick Actions */}
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <TrendCard
              data={partnerLeadTrend}
              dataKey="value"
              subtitle="Sourced leads performance over the last 6 months"
              title="Sourced Lead Sprints"
              type="line"
            />
          </div>

          <Card className="shadow-md h-full flex flex-col justify-between">
            <CardHeader className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Partner Quick Desk</h2>
              <p className="text-xs text-slate-500 mt-0.5">Core operations for direct selling</p>
            </CardHeader>
            <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-center">
              <Link href="/dsa/onboarding" className="block">
                <button className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2">
                  <Building2 className="h-4.5 w-4.5" />
                  Onboard Sub-Agent
                </button>
              </Link>
              <Link href="/leads" className="block">
                <button className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2">
                  <Plus className="h-4.5 w-4.5" />
                  Submit New Lead
                </button>
              </Link>
              <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed border border-slate-100 mt-2">
                <strong className="text-slate-800">Note:</strong> Newly onboarded sub-agents will remain in <strong className="text-amber-600">Submitted</strong> status until verified by the Cosmos DSA Manager.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sub-Agent Network Directory */}
        <div className="mt-6">
          <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">My Agent Network Directory</h2>
                <p className="text-xs text-slate-500 mt-0.5">Sub-agents onboarded and managed by your business</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {partnerAgents.length} Agents
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {partnerAgents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="p-4 pl-6">Agent Name</th>
                        <th className="p-4">Agent Code</th>
                        <th className="p-4">Email ID</th>
                        <th className="p-4">Onboarded</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right pr-6">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-4 pl-6 font-semibold text-slate-800">{agent.name}</td>
                          <td className="p-4 text-slate-600 font-mono text-xs">{agent.code}</td>
                          <td className="p-4 text-slate-600 text-xs">{agent.email}</td>
                          <td className="p-4 text-slate-500 text-xs">{formatDate(agent.onboardingDate)}</td>
                          <td className="p-4">
                            <StatusBadge status={agent.status} />
                          </td>
                          <td className="p-4 text-right pr-6">
                            <Link href={`/dsa/${agent.id}`}>
                              <button className="inline-flex h-8 px-3 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                                Open Profile
                              </button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No Sub-Agents Sourced Yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click &quot;Onboard Sub-Agent&quot; to begin building your team.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } else {
    // --------------------------------------------------
    // RENDER: CUSTOMER / USER
    // --------------------------------------------------
    return (
      <div>
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-lg mb-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-500 rounded-full blur-3xl opacity-20" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500 rounded-full blur-3xl opacity-10" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 px-3 py-1 text-xs font-bold tracking-wider uppercase text-blue-300">
                <Sparkles className="h-3.5 w-3.5" /> Cosmos Borrow Desk
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Welcome back, {currentUser.name}
              </h1>
              <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
                Apply for personal, business, or housing loans directly with instant scoring and transparent stage tracking.
              </p>
            </div>
            <button
              onClick={() => {
                setApplyStep(1);
                setApplyModalOpen(true);
              }}
              className="h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-black tracking-wide shadow-md shadow-amber-500/20 hover:shadow-lg transition flex items-center justify-center gap-2 border-none self-start md:self-auto"
            >
              Apply for a New Loan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Customer KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard change="Active" icon={Clock} label="Active Requests" tone="amber" value={String(customerStats.active)} />
          <KpiCard change="Disbursed" icon={ClipboardCheck} label="Closed / Active Loans" tone="green" value={String(customerStats.disbursed)} />
          <KpiCard change="Total Sourced" icon={BadgeIndianRupee} label="Total Loan Volume" tone="slate" value={formatCurrency(customerStats.totalBorrowed)} />
        </div>

        {/* Active Application Stage Tracker */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]">
          <Card className="shadow-md">
            <CardHeader className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">My Applications & Active Status Trackers</h2>
              <p className="text-xs text-slate-500 mt-0.5">Follow the real-time processing milestones of your submissions</p>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {customerApps.length > 0 ? (
                customerApps.map((app) => {
                  // Define stages for customer
                  const stages = ["Lead Sourced", "Documents uploaded", "BRE Rules Check", "Credit Desk Review", "Final Decision"];
                  let activeIdx = 0;
                  if (app.stage === "Lead Capture") activeIdx = 0;
                  else if (app.stage === "Document Review") activeIdx = 1;
                  else if (app.stage === "BRE Check") activeIdx = 2;
                  else if (app.stage === "Credit Underwriting" || app.stage === "Risk Review") activeIdx = 3;
                  else if (app.stage === "Approval" || app.stage === "Disbursal") activeIdx = 4;

                  return (
                    <div key={app.id} className="p-5 rounded-xl border border-slate-200 bg-white space-y-4 hover:shadow-sm transition">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-400">{app.applicationId}</span>
                          <h3 className="text-sm font-bold text-slate-800 mt-0.5">{app.product}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-semibold">{formatCurrency(app.loanAmount)}</span>
                          <StatusBadge status={app.status} />
                        </div>
                      </div>

                      {/* Visual Horizontal Timeline */}
                      <div className="relative pt-2">
                        <div className="absolute top-[17px] left-4 right-4 h-1 bg-slate-100 z-0 rounded-full" />
                        <div
                          className="absolute top-[17px] left-4 h-1 bg-blue-600 z-0 rounded-full transition-all duration-300"
                          style={{ width: `${(activeIdx / (stages.length - 1)) * 100}%` }}
                        />

                        <div className="relative z-10 flex justify-between items-center">
                          {stages.map((st, i) => {
                            const isDone = i < activeIdx;
                            const isCurrent = i === activeIdx;
                            return (
                              <div key={st} className="flex flex-col items-center flex-1">
                                <div
                                  className={`h-8 w-8 rounded-full border-2 grid place-items-center text-[10px] font-bold transition-all ${
                                    isDone
                                      ? "bg-blue-600 border-blue-600 text-white"
                                      : isCurrent
                                        ? "bg-white border-blue-600 text-blue-600 scale-110 shadow-md"
                                        : "bg-white border-slate-200 text-slate-400"
                                  }`}
                                >
                                  {isDone ? <Check className="h-4 w-4" /> : i + 1}
                                </div>
                                <span
                                  className={`text-[9px] font-black tracking-tight mt-1.5 text-center hidden md:block ${
                                    isCurrent ? "text-blue-600 font-bold" : "text-slate-400"
                                  }`}
                                >
                                  {st}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Status Note card */}
                      <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2 border border-slate-100">
                        <Activity className="h-4.5 w-4.5 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <strong className="text-slate-700">Latest update:</strong> {app.decisionSummary}
                          <span className="block text-[10px] text-slate-400 mt-1 font-medium">Updated: {formatDate(app.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No active applications found</p>
                  <p className="text-xs text-slate-400 mt-0.5">Click &quot;Apply for a New Loan&quot; above to submit your first application.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Loan Offer Desk */}
          <div className="space-y-4">
            <Card className="shadow-md bg-white overflow-hidden border border-slate-200">
              <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-4 text-white">
                <h3 className="font-bold text-sm tracking-wide uppercase">Cosmos Pre-Approved Rates</h3>
                <p className="text-xs text-blue-200 mt-0.5">Customized for {currentUser.name}</p>
              </div>
              <CardContent className="p-4 space-y-4">
                {[
                  { name: "Personal Loan", rate: "10.49% p.a.", tenure: "Up to 5 yrs" },
                  { name: "Housing Loan", rate: "8.75% p.a.", tenure: "Up to 30 yrs" },
                  { name: "Vehicle Loan", rate: "9.25% p.a.", tenure: "Up to 7 yrs" },
                ].map((offer) => (
                  <div key={offer.name} className="flex justify-between items-center rounded-xl bg-slate-50/70 p-3 border border-slate-100 hover:bg-slate-50 transition">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{offer.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Tenure: {offer.tenure}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-emerald-600">{offer.rate}</span>
                      <button
                        onClick={() => {
                          setLoanProduct(offer.name as Product);
                          setApplyStep(1);
                          setApplyModalOpen(true);
                        }}
                        className="block text-[10px] text-blue-600 font-bold hover:underline mt-1"
                      >
                        Apply Now
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="shadow-md">
              <CardHeader className="border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Frequently Asked Questions</h3>
              </CardHeader>
              <CardContent className="p-4 text-xs text-slate-500 space-y-3 leading-relaxed">
                <div>
                  <strong className="text-slate-700 block">How long does decisioning take?</strong>
                  Our Automated BRE rule engine checks bureau and identity factors in under 5 minutes to deliver a provisional approval.
                </div>
                <div>
                  <strong className="text-slate-700 block">What documents are needed?</strong>
                  Standard PAN and Aadhaar copies are mandatory, along with the latest 3-month salary statement.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CUSTOMER LOAN APPLICATION MODAL */}
        <Modal
          description="Submit details and upload credentials for instant scoring."
          onClose={resetForm}
          open={applyModalOpen}
          title="Apply for Loan Journey"
          width="max-w-xl"
        >
          {/* Timeline Steps Indicator */}
          {applyStep < 4 && (
            <div className="flex items-center justify-between max-w-sm mx-auto mb-6">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold transition ${
                      stepNum <= applyStep
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {stepNum}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 ml-1">
                    {["Details", "KYC", "Upload"][stepNum - 1]}
                  </span>
                  {stepNum < 3 && <ChevronRight className="h-4 w-4 text-slate-300 mx-auto" />}
                </div>
              ))}
            </div>
          )}

          {applyStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">Loan Product Specifications</h3>
              <div className="grid gap-4">
                <Field>
                  <Label htmlFor="loanProduct">Choose Product Type</Label>
                  <Select id="loanProduct" onChange={(e) => setLoanProduct(e.target.value as Product)} value={loanProduct}>
                    {["Personal Loan", "Home Loan", "Loan Against Property", "Business Loan", "Auto Loan"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label htmlFor="sourcingPartner">Choose Sourcing Channel (Bank / DSA Partner)</Label>
                  <Select id="sourcingPartner" onChange={(e) => setSourcingPartner(e.target.value)} value={sourcingPartner}>
                    <option value="dsa-direct">Cosmos Bank (Direct)</option>
                    {store.dsas.filter((d) => d.status === "Active").map((dsa) => (
                      <option key={dsa.id} value={dsa.id}>{dsa.name} ({dsa.code})</option>
                    ))}
                  </Select>
                </Field>
                <Field>
                  <Label htmlFor="loanAmount">Requested Amount (INR)</Label>
                  <Input id="loanAmount" type="number" onChange={(e) => setLoanAmount(e.target.value)} value={loanAmount} />
                </Field>
                <Field>
                  <Label htmlFor="loanSalary">Net Monthly Salary (INR)</Label>
                  <Input id="loanSalary" type="number" onChange={(e) => setLoanSalary(e.target.value)} value={loanSalary} />
                </Field>
              </div>
              <div className="pt-4 flex justify-end">
                <Button onClick={() => setApplyStep(2)} type="button">Continue</Button>
              </div>
            </div>
          )}

          {applyStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">KYC Verification Details</h3>
              <div className="grid gap-4">
                <Field>
                  <Label htmlFor="customerPan">PAN Card Number</Label>
                  <Input
                    id="customerPan"
                    placeholder="ABCDE1234F"
                    onChange={(e) => {
                      setCustomerPan(e.target.value);
                      setFormErrors({});
                    }}
                    value={customerPan}
                  />
                  {formErrors.pan && <p className="text-xs font-semibold text-rose-600 mt-1">{formErrors.pan}</p>}
                </Field>
                <Field>
                  <Label htmlFor="customerAadhaar">12-Digit Aadhaar Card</Label>
                  <Input
                    id="customerAadhaar"
                    maxLength={12}
                    placeholder="123456789012"
                    onChange={(e) => {
                      setCustomerAadhaar(e.target.value);
                      setFormErrors({});
                    }}
                    value={customerAadhaar}
                  />
                  {formErrors.aadhaar && <p className="text-xs font-semibold text-rose-600 mt-1">{formErrors.aadhaar}</p>}
                </Field>
                <Field>
                  <Label htmlFor="customerCity">City of Residence</Label>
                  <Input id="customerCity" onChange={(e) => setCustomerCity(e.target.value)} value={customerCity} />
                </Field>
              </div>
              <div className="pt-4 flex justify-between">
                <Button onClick={() => setApplyStep(1)} variant="secondary" type="button">Back</Button>
                <Button onClick={() => setApplyStep(3)} type="button">Continue</Button>
              </div>
            </div>
          )}

          {applyStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b pb-2 uppercase tracking-wider">Upload Credentials</h3>
              <p className="text-xs text-slate-500">Provide document proofs to complete identity assessment.</p>

              <div className="grid gap-3">
                {["PAN Card Proof", "Aadhaar Card Proof", "Latest 3-Month Salary Slip"].map((docName) => {
                  const uploaded = uploadedDocs.includes(docName);
                  return (
                    <div key={docName} className={`flex items-center justify-between rounded-xl border border-dashed p-4 transition-all duration-200 ${
                      uploaded
                        ? "border-emerald-300 bg-emerald-50/20"
                        : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                    }`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">{docName}</p>
                        {uploaded ? (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">File Uploaded successfully!</p>
                        ) : (
                          <p className="text-[10px] text-slate-400">Acceptable formats: PDF, JPG, PNG.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSimulateUpload(docName)}
                        className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                          uploaded ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                        }`}
                      >
                        {uploaded ? <Check className="h-4.5 w-4.5" /> : <UploadCloud className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between">
                <Button onClick={() => setApplyStep(2)} variant="secondary" type="button">Back</Button>
                <Button onClick={handleApplySubmit} type="button">Submit Application</Button>
              </div>
            </div>
          )}

          {applyStep === 4 && (
            <div className="flex flex-col items-center text-center p-6 space-y-5">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm shadow-emerald-50">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-emerald-700 tracking-tight">Application Sourced!</h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                  Your loan application has been registered successfully. The Automated Business Rules Engine (BRE) is evaluating your profile.
                </p>
              </div>
              <Button onClick={resetForm} type="button" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 w-full rounded-lg shadow-sm mt-4">
                Done
              </Button>
            </div>
          )}
        </Modal>
      </div>
    );
  }
}

// Wrapper for Form Fields
function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}
