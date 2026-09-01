"use client";

import {
  Activity,
  BadgeIndianRupee,
  Building2,
  ClipboardCheck,
  FileWarning,
  Users,
  Check,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Briefcase,
  Coins,
  Clock,
  Sparkles,
  ChevronRight,
  Trophy,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { BarChartCard, KpiCard, PieChartCard, TrendCard } from "@/components/charts";
import { PageHeader } from "@/components/module";
import { OnHoldDsaDocuments } from "@/components/screens/on-hold-dsa-documents";
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
  Tabs,
} from "@/components/ui/primitives";
import { useMockStore } from "@/lib/store";
import { buildApplicationDeviation, evaluateBreDeviation } from "@/lib/bre";
import { buildApplicationJourney } from "@/lib/product-journeys";
import { getActiveProductConfigs, getUniqueProductConfigs, resolveProductConfig } from "@/lib/product-configs";
import { compactNumber, formatCurrency, formatDate, makeId } from "@/lib/utils";
import { Application, Product, Lead } from "@/lib/types";
import { adminApi } from "@/apis/admin";
import type { ActivityLog } from "@/types/activityLog";

const CUSTOMER_DSA_DISPLAY_NAME = "Assigned DSA";

export function DashboardPage() {
  const { store, currentUser, createItem } = useMockStore();

  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    async function loadRecentLogs() {
      try {
        const response = await adminApi.getActivityLogs({ per_page: 6 });
        setRecentLogs(response.data);
      } catch (err) {
        console.error("Failed to load recent activity logs on dashboard:", err);
      } finally {
        setLogsLoading(false);
      }
    }
    loadRecentLogs();
  }, []);

  // State for Customer Loan Application Modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyStep, setApplyStep] = useState(1);
  const [loanProduct, setLoanProduct] = useState<Product | "">("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanSalary, setLoanSalary] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPan, setCustomerPan] = useState("");
  const [customerAadhaar, setCustomerAadhaar] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [sourcingPartner, setSourcingPartner] = useState("");
  const [managerView, setManagerView] = useState<"overview" | "verificationQueue" | "onHoldQueue">("overview");

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
    if (currentUser?.role === "DSA Credit") {
      return store.dsas.filter(
        (item) => item.status === "Pending Credit Approval" || item.status === "KYC Pending",
      );
    }
    if (currentUser?.role === "DSA Manager") {
      return store.dsas.filter(
        (item) =>
          item.status === "Submitted" ||
          item.status === "Pending Branch Approval" ||
          item.status === "Pending BRH Approval" ||
          item.status === "KYC Pending" ||
          item.status === "Pending Credit Approval",
      );
    }
    return [];
  }, [currentUser?.role, store.dsas]);

  const onHoldDsas = useMemo(() => {
    if (currentUser?.role === "Branch User") {
      return store.dsas
        .filter((item) => item.status === "On Hold" && item.manager === currentUser.name)
        .sort((left, right) => right.onboardingDate.localeCompare(left.onboardingDate));
    }
    if (currentUser?.role === "DSA Credit" || currentUser?.role === "DSA Manager") {
      return store.dsas
        .filter((item) => item.status === "On Hold")
        .sort((left, right) => right.onboardingDate.localeCompare(left.onboardingDate));
    }
    return [];
  }, [currentUser, store.dsas]);

  const branchDsas = useMemo(() => {
    if (currentUser?.role !== "Branch User") return [];
    return store.dsas
      .filter((item) => item.manager === currentUser.name)
      .sort((left, right) => right.onboardingDate.localeCompare(left.onboardingDate));
  }, [currentUser, store.dsas]);

  const branchStats = useMemo(
    () => ({
      active: branchDsas.filter((item) => item.status === "Active").length,
      blacklisted: branchDsas.filter((item) => item.status === "Blacklisted").length,
      onHold: branchDsas.filter((item) => item.status === "On Hold").length,
      pendingCredit: branchDsas.filter(
        (item) =>
          item.status === "Pending Branch Approval" ||
          item.status === "Pending BRH Approval" ||
          item.status === "Pending Credit Approval",
      ).length,
      total: branchDsas.length,
    }),
    [branchDsas],
  );

  const funnel = useMemo(() => {
    const isDsaPartner = currentUser?.role === "DSA Partner";
    const partnerLeads = isDsaPartner
      ? store.leads.filter((item) => item.dsaId === currentUser?.id || item.dsaName === currentUser?.name)
      : store.leads;
    const partnerApps = isDsaPartner
      ? store.applications.filter((item) => item.dsaId === currentUser?.id || item.dsaName === currentUser?.name)
      : store.applications;
    
    const approved = partnerApps.filter((item) => item.status === "Approved" || item.status === "Disbursed");
    
    return [
      { name: "Leads", value: partnerLeads.length },
      { name: "Qualified", value: partnerLeads.filter((item) => item.status === "Qualified").length },
      { name: "Applications", value: partnerApps.length },
      { name: "Approved", value: approved.length },
      { name: "Disbursed", value: partnerApps.filter((item) => item.status === "Disbursed").length },
    ];
  }, [store.leads, store.applications, currentUser, stats.approved]);

  // ----------------------------------------------------
  // RECOVERY ANALYTICS STATE & COMPUTATIONS
  // ----------------------------------------------------
  // All months that appear in recovery data (ordered)
  const allRecoveryMonths = useMemo(() => {
    const order = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthSet = Array.from(new Set(store.dsaRecovery.map((r) => r.month)));
    return monthSet.sort((a, b) => {
      const [aM, aY] = a.split(" ");
      const [bM, bY] = b.split(" ");
      return Number(aY) - Number(bY) || order.indexOf(aM) - order.indexOf(bM);
    });
  }, [store.dsaRecovery]);

  // Converts "Jan 2026" → "2026-01" (HTML input[type=month] value)
  function monthLabelToInputVal(label: string) {
    const ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const [m, y] = label.split(" ");
    return `${y}-${String(ORDER.indexOf(m) + 1).padStart(2, "0")}`;
  }
  // Converts "2026-01" → "Jan 2026"
  function inputValToMonthLabel(val: string) {
    const ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const [y, m] = val.split("-");
    return `${ORDER[Number(m) - 1]} ${y}`;
  }

  const recoveryMonthMin = allRecoveryMonths.length > 0 ? monthLabelToInputVal(allRecoveryMonths[0]) : "2026-01";
  const recoveryMonthMax = allRecoveryMonths.length > 0 ? monthLabelToInputVal(allRecoveryMonths[allRecoveryMonths.length - 1]) : "2026-12";

  // Default: first 5 months of available data (from = earliest, to = 5th or last)
  const [fromMonth, setFromMonth] = useState<string>(() => recoveryMonthMin);
  const [toMonth, setToMonth] = useState<string>(() => {
    if (allRecoveryMonths.length === 0) return "2026-05";
    return monthLabelToInputVal(allRecoveryMonths[Math.min(4, allRecoveryMonths.length - 1)]);
  });
  const [recoveryTab, setRecoveryTab] = useState("panindia");

  // Filter allRecoveryMonths to only those within [fromMonth, toMonth]
  const selectedMonths = useMemo(() => {
    return allRecoveryMonths.filter((label) => {
      const v = monthLabelToInputVal(label);
      return v >= fromMonth && v <= toMonth;
    });
  }, [allRecoveryMonths, fromMonth, toMonth]);


  // All recovery records for the selected window
  const windowedRecovery = useMemo(
    () => store.dsaRecovery.filter((r) => selectedMonths.includes(r.month)),
    [store.dsaRecovery, selectedMonths]
  );

  // PAN India monthly totals for trend chart
  const panIndiaTrend = useMemo(
    () =>
      selectedMonths.map((month) => {
        const rows = windowedRecovery.filter((r) => r.month === month);
        return {
          name: month.split(" ")[0],
          recovered: rows.reduce((s, r) => s + r.recoveredAmount, 0),
          target: rows.reduce((s, r) => s + r.targetAmount, 0),
          invoice: rows.reduce((s, r) => s + r.invoiceAmount, 0),
          cases: rows.reduce((s, r) => s + r.totalCases, 0),
          billing: Math.round(rows.reduce((s, r) => s + r.totalBilling, 0) / 100000),
        };
      }),
    [windowedRecovery, selectedMonths]
  );

  // Top performing DSAs by total recovered in selected window
  const topDSAs = useMemo(() => {
    const byDsa: Record<string, { name: string; recovered: number; cases: number; invoiced: number; npa: number }> = {};
    for (const r of windowedRecovery) {
      if (!byDsa[r.dsaId]) byDsa[r.dsaId] = { name: r.dsaName, recovered: 0, cases: 0, invoiced: 0, npa: 0 };
      byDsa[r.dsaId].recovered += r.recoveredAmount;
      byDsa[r.dsaId].cases += r.totalCases;
      byDsa[r.dsaId].invoiced += r.invoiceAmount;
      byDsa[r.dsaId].npa += r.npaCases;
    }
    return Object.entries(byDsa)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.recovered - a.recovered)
      .slice(0, 8);
  }, [windowedRecovery]);

  // Zone-wise totals per month for grouped chart
  const zoneTrend = useMemo(() => {
    const zones = Array.from(new Set(store.dsaRecovery.map((r) => r.zone)));
    return selectedMonths.map((month) => {
      const entry: Record<string, string | number> = { name: month.split(" ")[0] };
      for (const z of zones) {
        entry[z] = store.dsaRecovery
          .filter((r) => r.month === month && r.zone === z)
          .reduce((s, r) => s + r.recoveredAmount, 0);
      }
      return entry;
    });
  }, [store.dsaRecovery, selectedMonths]);

  const zoneNames = useMemo(
    () => Array.from(new Set(store.dsaRecovery.map((r) => r.zone))),
    [store.dsaRecovery]
  );

  // Individual DSA rows: aggregate across selected window per DSA
  const individualDSARows = useMemo(() => {
    const byDsa: Record<string, {
      name: string; zone: string;
      cases: number; billing: number; recovered: number;
      pending: number; npa: number; carryIn: number; carryOut: number; invoice: number;
    }> = {};
    for (const r of windowedRecovery) {
      if (!byDsa[r.dsaId]) {
        byDsa[r.dsaId] = {
          name: r.dsaName, zone: r.zone,
          cases: 0, billing: 0, recovered: 0, pending: 0, npa: 0,
          carryIn: 0, carryOut: 0, invoice: 0,
        };
      }
      byDsa[r.dsaId].cases += r.totalCases;
      byDsa[r.dsaId].billing += r.totalBilling;
      byDsa[r.dsaId].recovered += r.recoveredAmount;
      byDsa[r.dsaId].pending += r.pendingAmount;
      byDsa[r.dsaId].npa += r.npaCases;
      byDsa[r.dsaId].carryIn += r.carryForwardIn;
      byDsa[r.dsaId].carryOut += r.carryForwardOut;
      byDsa[r.dsaId].invoice += r.invoiceAmount;
    }
    return Object.values(byDsa).sort((a, b) => b.recovered - a.recovered);
  }, [windowedRecovery]);


  // ----------------------------------------------------
  // 2. DSA PARTNER CALCULATIONS
  // ----------------------------------------------------
  const partnerStats = useMemo(() => {
    if (!currentUser) return { leadsCount: 0, appsCount: 0, commissionTotal: 0, agentsCount: 0 };
    
    const partnerLeads = store.leads.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name
    );
    const partnerApps = store.applications.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name
    );
    const partnerCommissions = store.commissions.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name
    );
    const commissionTotal = partnerCommissions.reduce((sum, item) => sum + item.payout, 0);
    const agentsCount = store.users.filter(
      (item) => item.role === "DSA Agent" && item.dsaId === currentUser.id,
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
    return store.users
      .filter((item) => item.role === "DSA Agent" && item.dsaId === currentUser.id)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [store.users, currentUser]);

  const partnerProductConfigs = useMemo(() => {
    if (!currentUser) return [];
    return store.dsaProductConfigs
      .filter((config) => config.status === "Active" && config.dsaId === currentUser.id)
      .sort((left, right) => left.product.localeCompare(right.product));
  }, [currentUser, store.dsaProductConfigs]);

  const partnerLeadTrend = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((name) => ({
    name,
    value: name === "Jun" ? partnerStats.leadsCount : 0,
  }));

  // ----------------------------------------------------
  // 3. CUSTOMER CALCULATIONS & JOURNEY FORM SUBMISSION
  // ----------------------------------------------------
  const customerApps = useMemo(() => {
    if (!currentUser) return [];
    return store.applications.filter((item) => item.customer === currentUser.name);
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

  const customerJourneyConfigs = useMemo(
    () => getActiveProductConfigs(store),
    [store],
  );
  const customerProductOptions = useMemo(
    () => getUniqueProductConfigs(customerJourneyConfigs),
    [customerJourneyConfigs],
  );
  const selectedCustomerConfig = useMemo(
    () => resolveProductConfig(customerJourneyConfigs, loanProduct, sourcingPartner),
    [customerJourneyConfigs, loanProduct, sourcingPartner],
  );

  const handleSimulateUpload = (docName: string) => {
    setUploadedDocs((prev) => [...prev, docName]);
  };

  const handleApplySubmit = () => {
    if (!currentUser) return;
    const errors: Record<string, string> = {};
    if (!selectedCustomerConfig) {
      errors.product = "Choose an active configured loan product.";
    }
    if (!customerCity.trim()) {
      errors.city = "Enter city of residence.";
    }
    if (Number(loanAmount || 0) <= 0) {
      errors.amount = "Enter a valid requested amount.";
    }
    if (Number(loanSalary || 0) <= 0) {
      errors.salary = "Enter a valid monthly income.";
    }
    if (!customerPan || !/^[A-Z]{5}\d{4}[A-Z]$/.test(customerPan.toUpperCase())) {
      errors.pan = "Enter a valid PAN card (e.g. ABCDE1234F)";
    }
    if (!customerAadhaar || !/^\d{12}$/.test(customerAadhaar)) {
      errors.aadhaar = "Enter a valid 12-digit Aadhaar number";
    }
    if (Object.keys(errors).length > 0 || !selectedCustomerConfig) {
      setFormErrors(errors);
      return;
    }

    const appAmount = Number(loanAmount);
    const salary = Number(loanSalary);
    const panVal = customerPan.toUpperCase();

    const dsaId = selectedCustomerConfig.dsaId;
    const dsaName = CUSTOMER_DSA_DISPLAY_NAME;
    const product = selectedCustomerConfig.product;

    // Create lead record
    const leadId = makeId("lead");
    const lCode = `LD-${leadId.slice(-5).toUpperCase()}`;
    const newLeadItem: Lead = {
      id: leadId,
      leadId: lCode,
      customer: currentUser.name,
      mobile: currentUser.mobile || "7777777777",
      email: currentUser.email || "customer@example.com",
      city: customerCity,
      source: "Partner",
      product,
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
    const aCode = `APP-${appId.slice(-5).toUpperCase()}`;
    const journeySeed = appId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const createdAt = new Date().toISOString();
    const amountPressure = appAmount / Math.max(salary, 1);
    const creditScore = Math.round(Math.max(560, Math.min(820, 740 + (salary / 10000) * 3 - amountPressure * 4)));
    const riskScore = Math.round(
      Math.max(
        35,
        Math.min(94, 62 + amountPressure / 2 + (creditScore < 700 ? (700 - creditScore) / 5 : -(creditScore - 700) / 20)),
      ),
    );
    const breDeviation = evaluateBreDeviation({
      creditScore,
      loanAmount: appAmount,
      product,
      riskScore,
      salary,
    });
    const deviation = breDeviation.required
      ? buildApplicationDeviation({
          actor: "Cosmos Auto BRE",
          reasons: breDeviation.reasons,
          requestedAt: createdAt,
        })
      : null;
    const applicationStatus: Application["status"] = deviation ? "On Hold" : "In Review";
    const applicationStage: Application["stage"] = deviation ? "Risk Review" : "BRE Check";
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
      product,
      loanAmount: appAmount,
      ...(deviation ? { deviation } : {}),
      journey: buildApplicationJourney(product, journeySeed, {
        city: customerCity,
        customer: currentUser.name,
        loanAmount: appAmount,
        salary,
      }),
      status: applicationStatus,
      stage: applicationStage,
      riskScore,
      creditScore,
      salary: salary,
      createdAt,
      decisionSummary: deviation
        ? `Submitted via customer direct portal and sourced by ${dsaName}. BRE deviation raised because ${breDeviation.reasons.join(" ")} Pending approval by Branch, BRH, DSA Credit, or Super Admin.`
        : `Successfully submitted via customer direct portal. Sourced by ${dsaName}. Queued for automated BRE rule scoring.`,
      notes: [
        `Customer applied directly, assigning lead sourcing to ${dsaName}.`,
        ...(deviation ? [`Deviation pending: ${breDeviation.reasons.join(" ")}`] : []),
      ],
      timeline: [
        {
          id: makeId("tl"),
          title: "Application Created",
          note: `Form submitted directly by the borrower, assigned to ${dsaName}.`,
          actor: currentUser.name,
          at: createdAt,
        },
        ...(deviation
          ? [
              {
                id: makeId("tl"),
                title: "BRE Deviation Raised",
                note: `Special-case approval required: ${breDeviation.reasons.join(" ")}`,
                actor: "Cosmos Auto BRE",
                at: createdAt,
              },
            ]
          : []),
        {
          id: makeId("tl"),
          title: "Verification Pending",
          note: "Customer documents are pending upload and verification.",
          actor: "Cosmos Auto Desk",
          at: createdAt,
        },
      ],
      verificationStatus: "Pending",
    };

    createItem("leads", newLeadItem);
    createItem("applications", newAppItem);

    setLoanAmount("");
    setLoanSalary("");
    setCustomerCity("");
    setCustomerPan("");
    setCustomerAadhaar("");
    setUploadedDocs([]);
    setFormErrors({});
    setApplyStep(4); // Success Receipt
  };

  const resetForm = () => {
    setApplyStep(1);
    setLoanProduct("");
    setLoanAmount("");
    setLoanSalary("");
    setCustomerCity("");
    setCustomerPan("");
    setCustomerAadhaar("");
    setUploadedDocs([]);
    setFormErrors({});
    setSourcingPartner("");
    setApplyModalOpen(false);
  };

  // If no user context, return loading or access state handled by app shell redirect
  if (!currentUser) return null;

  // ----------------------------------------------------
  // VIEW RENDERER BASED ON USER ROLE
  // ----------------------------------------------------
  if (currentUser.role === "DSA Manager" || currentUser.role === "DSA Credit") {
    // --------------------------------------------------
    // RENDER: SUPER ADMIN / DSA MANAGER
    // --------------------------------------------------
    if (managerView === "verificationQueue") {
      return (
        <div>
          <PageHeader
            description={
              currentUser.role === "DSA Credit"
                ? "Review Branch-submitted DSA records and complete credit approval from the full partner profile."
                : "Review submitted DSA records before making activation or rejection decisions from the full partner profile."
            }
            eyebrow={currentUser.role === "DSA Credit" ? "Credit approval cockpit" : "Portfolio cockpit"}
            title="Dashboard"
          />

          <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <Button onClick={() => setManagerView("overview")} size="sm" type="button" variant="ghost">
              Overview
            </Button>
            <Button onClick={() => setManagerView("verificationQueue")} size="sm" type="button" variant="secondary">
              Verification Queue
              <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                {pendingDsas.length}
              </span>
            </Button>
            <Button onClick={() => setManagerView("onHoldQueue")} size="sm" type="button" variant="ghost">
              On-Hold Queue
              <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                {onHoldDsas.length}
              </span>
            </Button>
          </div>

          <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {currentUser.role === "DSA Credit" ? "Pending DSA Credit Approval Queue" : "Pending DSA Verification Queue"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentUser.role === "DSA Credit"
                    ? "Open each Branch-submitted profile, review KYC, documents, bank details, and business information, then approve or reject from the profile page."
                    : "Open each profile, verify KYC, documents, bank details, and business information, then approve or reject from the profile page."}
                </p>
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
                        <th className="p-4 pl-6">Partner</th>
                        <th className="p-4">Contact</th>
                        <th className="p-4">City</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right pr-6">Profile Review</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pendingDsas.map((dsa) => (
                        <tr key={dsa.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-4 pl-6">
                            <div className="font-semibold text-slate-800">{dsa.name}</div>
                            <div className="text-xs text-slate-500">{dsa.businessType}</div>
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-600">{dsa.code}</td>
                          <td className="p-4 text-xs text-slate-600">
                            <div>{dsa.email}</div>
                            <div>{dsa.mobile}</div>
                          </td>
                          <td className="p-4 text-slate-700 font-medium">{dsa.city}</td>
                          <td className="p-4">
                            <StatusBadge status={dsa.status} />
                          </td>
                          <td className="p-4 text-right pr-6">
                            <Link href={`/dsa/${dsa.id}`}>
                              <Button size="sm" type="button" variant="outline">
                                View full profile
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Verification queue is empty.</p>
                  <p className="text-xs text-slate-400 mt-0.5">All onboarded partners have been processed.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (managerView === "onHoldQueue") {
      return (
        <div>
          <PageHeader
            description="Upload missing mandatory DSA documents before moving the partner back into approval review."
            eyebrow={currentUser.role === "DSA Credit" ? "Credit approval cockpit" : "Portfolio cockpit"}
            title="Dashboard"
          />

          <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <Button onClick={() => setManagerView("overview")} size="sm" type="button" variant="ghost">
              Overview
            </Button>
            <Button onClick={() => setManagerView("verificationQueue")} size="sm" type="button" variant="ghost">
              Verification Queue
              <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                {pendingDsas.length}
              </span>
            </Button>
            <Button onClick={() => setManagerView("onHoldQueue")} size="sm" type="button" variant="secondary">
              On-Hold Queue
              <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                {onHoldDsas.length}
              </span>
            </Button>
          </div>

          <OnHoldDsaDocuments
            description="Upload remaining documents here. Once completed, the DSA moves back to approval review."
            dsas={onHoldDsas}
            emptyDescription="No DSAs are currently waiting for missing documents."
            title="On-Hold DSA Document Queue"
          />
        </div>
      );
    }

    return (
      <div>
        <PageHeader
          description={
            currentUser.role === "DSA Credit"
              ? "Credit desk command center for Branch-submitted DSA approvals, underwriting health, and payout exposure."
              : "Command center for partner onboarding, lead velocity, underwriting health, verification queues, and payout exposure."
          }
          eyebrow={currentUser.role === "DSA Credit" ? "Credit approval cockpit" : "Portfolio cockpit"}
          title="Dashboard"
        />

        <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <Button onClick={() => setManagerView("overview")} size="sm" type="button" variant="secondary">
            Overview
          </Button>
          <Button onClick={() => setManagerView("verificationQueue")} size="sm" type="button" variant="ghost">
            Verification Queue
            <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
              {pendingDsas.length}
            </span>
          </Button>
          <Button onClick={() => setManagerView("onHoldQueue")} size="sm" type="button" variant="ghost">
            On-Hold Queue
            <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
              {onHoldDsas.length}
            </span>
          </Button>
        </div>

        {/* Verification Alert Banner */}
        {pendingDsas.length > 0 && (
          <div className="mb-6 rounded-xl bg-sky-50 border border-sky-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-800">
                <Clock className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  {currentUser.role === "DSA Credit" ? "Branch DSAs Pending Credit Approval" : "DSAs Pending Approval"}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  {currentUser.role === "DSA Credit"
                    ? `There are ${pendingDsas.length} Branch-submitted Direct Selling Agents waiting for DSA Credit approval.`
                    : `There are ${pendingDsas.length} Direct Selling Agents waiting for KYC & business review verification.`}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setManagerView("verificationQueue")}
              size="sm"
              className="bg-blue-700 hover:bg-blue-800 text-white font-bold shrink-0"
              type="button"
            >
              Review Queue
            </Button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard change="+12.4%" icon={Building2} label="Active DSAs" tone="blue" value={String(stats.activeDsas)} />
          <KpiCard change="+9.1%" icon={ClipboardCheck} label="Approved applications" tone="green" value={String(stats.approved)} />
          <KpiCard change="+18.2%" icon={BadgeIndianRupee} label="Payout exposure" tone="slate" value={compactNumber(stats.totalPayout)} />
        </div>

        {/* ── DSA RECOVERY ANALYTICS SECTION ────────────────────────── */}
        <div className="mt-8">
          {/* Section header + month-window dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                DSA Recovery Analytics
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Total recovery performance for the selected date range</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">From:</span>
                <input
                  type="month"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  min="2020-01"
                  max="2030-12"
                  value={fromMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val > toMonth) {
                      setToMonth(val);
                    }
                    setFromMonth(val);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">To:</span>
                <input
                  type="month"
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  min="2020-01"
                  max="2030-12"
                  value={toMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val < fromMonth) {
                      setFromMonth(val);
                    }
                    setToMonth(val);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Carry-forward info badge */}
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Carry-Forward Invoice Logic:</strong> If a DSA recovers less than their target (e.g. ₹8,000 of ₹10,000), the ₹2,000 shortfall is deducted from the next month&apos;s invoice. So if they recover ₹20,000 next month, the invoice raised is ₹18,000.
            </span>
          </div>

          {/* Analytics tabs + Top DSAs leaderboard side-by-side */}
          <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
            {/* Left: tabbed analytics */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <Tabs
                  onChange={setRecoveryTab}
                  tabs={[
                    { label: "PAN India", value: "panindia" },
                    { label: "Individual DSA", value: "individual" },
                    { label: "Zone-wise", value: "zone" },
                  ]}
                  value={recoveryTab}
                />
              </CardHeader>
              <CardContent className="pt-4">
                {/* PAN India tab */}
                {recoveryTab === "panindia" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="p-3 pl-4">Month</th>
                            <th className="p-3 text-right">Target</th>
                            <th className="p-3 text-right">Recovered</th>
                            <th className="p-3 text-right">Invoice Generated</th>
                            <th className="p-3 text-right">Cases</th>
                            <th className="p-3 pr-4 text-right">Billing (₹L)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {panIndiaTrend.map((row) => {
                            const achievedPct = row.target > 0 ? Math.round((row.recovered / row.target) * 100) : 0;
                            const isUnder = row.recovered < row.target;
                            return (
                              <tr key={row.name} className="hover:bg-slate-50/50 transition">
                                <td className="p-3 pl-4 font-semibold text-slate-800">{row.name}</td>
                                <td className="p-3 text-right text-slate-600">{compactNumber(row.target)}</td>
                                <td className="p-3 text-right">
                                  <span className={`font-bold ${isUnder ? "text-rose-600" : "text-emerald-600"}`}>
                                    {compactNumber(row.recovered)}
                                  </span>
                                  <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isUnder ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                                    {achievedPct}%
                                  </span>
                                </td>
                                <td className="p-3 text-right font-medium text-blue-700">{compactNumber(row.invoice)}</td>
                                <td className="p-3 text-right text-slate-600">{row.cases}</td>
                                <td className="p-3 pr-4 text-right text-slate-600">₹{row.billing}L</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                            <td className="p-3 pl-4">TOTAL</td>
                            <td className="p-3 text-right">{compactNumber(panIndiaTrend.reduce((s, r) => s + r.target, 0))}</td>
                            <td className="p-3 text-right">{compactNumber(panIndiaTrend.reduce((s, r) => s + r.recovered, 0))}</td>
                            <td className="p-3 text-right text-blue-700">{compactNumber(panIndiaTrend.reduce((s, r) => s + r.invoice, 0))}</td>
                            <td className="p-3 text-right">{panIndiaTrend.reduce((s, r) => s + r.cases, 0)}</td>
                            <td className="p-3 pr-4 text-right">₹{panIndiaTrend.reduce((s, r) => s + r.billing, 0)}L</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <TrendCard
                      data={panIndiaTrend.map((r) => ({ name: r.name, value: Math.round(r.recovered / 100000) }))}
                      dataKey="value"
                      subtitle="Total recovery in ₹ Lakhs across all DSAs for selected months"
                      title="PAN India Recovery Trend (₹L)"
                      type="area"
                    />
                  </div>
                )}

                {/* Individual DSA tab */}
                {recoveryTab === "individual" && (
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="p-3 pl-4">DSA Name</th>
                          <th className="p-3">Zone</th>
                          <th className="p-3 text-right">Cases</th>
                          <th className="p-3 text-right">Billing</th>
                          <th className="p-3 text-right">Recovered</th>
                          <th className="p-3 text-right">Pending</th>
                          <th className="p-3 text-right">NPA</th>
                          <th className="p-3 text-right">Carry-Fwd</th>
                          <th className="p-3 pr-4 text-right">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {individualDSARows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="p-3 pl-4">
                              <span className="font-semibold text-slate-800 text-xs line-clamp-1">{row.name}</span>
                            </td>
                            <td className="p-3 text-xs text-slate-500">{row.zone}</td>
                            <td className="p-3 text-right text-slate-600 text-xs">{row.cases}</td>
                            <td className="p-3 text-right text-slate-600 text-xs">{compactNumber(row.billing)}</td>
                            <td className="p-3 text-right font-semibold text-emerald-700 text-xs">{compactNumber(row.recovered)}</td>
                            <td className="p-3 text-right text-rose-500 text-xs">{compactNumber(row.pending)}</td>
                            <td className="p-3 text-right text-xs">
                              <span className={`font-bold ${row.npa > 0 ? "text-rose-600" : "text-slate-400"}`}>{row.npa}</span>
                            </td>
                            <td className="p-3 text-right text-amber-600 text-xs font-medium">{compactNumber(row.carryOut)}</td>
                            <td className="p-3 pr-4 text-right font-bold text-blue-700 text-xs">{compactNumber(row.invoice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Zone-wise tab */}
                {recoveryTab === "zone" && (
                  <div className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <th className="p-3 pl-4">Month</th>
                            {zoneNames.map((z) => (
                              <th key={z} className="p-3 text-right">{z}</th>
                            ))}
                            <th className="p-3 pr-4 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {zoneTrend.map((row) => {
                            const rowTotal = zoneNames.reduce((s, z) => s + (Number(row[z]) || 0), 0);
                            return (
                              <tr key={String(row.name)} className="hover:bg-slate-50/50 transition">
                                <td className="p-3 pl-4 font-semibold text-slate-800">{String(row.name)}</td>
                                {zoneNames.map((z) => (
                                  <td key={z} className="p-3 text-right text-xs text-slate-600">
                                    {compactNumber(Number(row[z]) || 0)}
                                  </td>
                                ))}
                                <td className="p-3 pr-4 text-right font-bold text-blue-700 text-xs">{compactNumber(rowTotal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <BarChartCard
                      data={zoneTrend.map((r) => ({
                        name: String(r.name),
                        value: zoneNames.reduce((s, z) => s + (Number(r[z]) || 0), 0) / 100000,
                      }))}
                      dataKey="value"
                      subtitle="Total recovery (₹L) across all zones for selected months"
                      title="Zone-wise Recovery (₹L)"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: Top Performing DSAs */}
            <Card className="shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Top Performing DSAs
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Ranked by total recovery in selected window</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {topDSAs.map((dsa, idx) => (
                    <div key={dsa.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                        idx === 0 ? "bg-amber-100 text-amber-700" :
                        idx === 1 ? "bg-slate-100 text-slate-600" :
                        idx === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-slate-50 text-slate-500"
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{dsa.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {dsa.cases} cases · NPA: {dsa.npa}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-emerald-700">{compactNumber(dsa.recovered)}</p>
                        <p className="text-[10px] text-blue-600">inv: {compactNumber(dsa.invoiced)}</p>
                      </div>
                    </div>
                  ))}
                  {topDSAs.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-slate-500">No recovery data for this window.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recovery Invoice Trend + Cases charts */}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <TrendCard
              data={panIndiaTrend.map((r) => ({ name: r.name, value: Math.round(r.invoice / 100000) }))}
              dataKey="value"
              subtitle="Invoice amount generated (₹L) across all DSAs in selected period"
              title="DSA Invoice Generation Trend (₹L)"
              type="line"
            />
            <BarChartCard
              data={panIndiaTrend.map((r) => ({ name: r.name, value: r.cases }))}
              dataKey="value"
              subtitle="Total cases handled across all DSAs for each month"
              title="Month-wise Total Cases"
            />
          </div>
        </div>

        {/* Approval mix + Commission run-rate */}
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
                {logsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <span className="h-5 w-5 animate-spin rounded-full border-b-2 border-blue-600" />
                  </div>
                ) : recentLogs.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">No activity logs recorded.</p>
                ) : (
                  recentLogs.map((log) => (
                    <div className="flex items-start gap-3 rounded-md border border-slate-100 p-3" key={log.id}>
                      <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-950 capitalize">{log.action.replace(/_/g, " ")}</p>
                        <p className="text-xs text-slate-500">
                          {log.user?.name || "System"} · {(log.group ?? "").replace(/_/g, " ")} · {formatDate(log.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={log.status_code >= 400 ? "Warning" : "Info"} />
                    </div>
                  ))
                )}
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
                  [
                    currentUser.role === "DSA Credit" ? "Pending credit approvals" : "KYC pending DSAs",
                    currentUser.role === "DSA Credit"
                      ? store.dsas.filter(
                          (item) =>
                            item.status === "Pending Credit Approval" ||
                            item.status === "Submitted" ||
                            item.status === "KYC Pending",
                        ).length
                      : store.dsas.filter(
                          (item) =>
                            item.status === "KYC Pending" ||
                            item.status === "Submitted" ||
                            item.status === "Pending Credit Approval",
                        ).length,
                  ],
                  ["On-hold DSAs", store.dsas.filter((item) => item.status === "On Hold").length],
                  ["Verification checks", store.verificationChecks.filter((item) => item.status !== "Verified").length],
                  ["Pending approvals", store.approvals.filter((item) => item.status === "Pending").length],
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
  } else if (currentUser.role === "Branch User") {
    return (
      <div>
        <PageHeader
          description="Onboard DSAs from the branch and track the internal approval handoff to DSA Credit."
          eyebrow="Branch DSA desk"
          title={`Branch Dashboard: ${currentUser.name}`}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard change="Submitted" icon={Building2} label="Branch onboarded" tone="blue" value={String(branchStats.total)} />
          <KpiCard change="Credit queue" icon={Clock} label="Pending Credit" tone="amber" value={String(branchStats.pendingCredit)} />
          <KpiCard change="Docs hold" icon={FileWarning} label="On-Hold DSAs" tone="amber" value={String(branchStats.onHold)} />
          <KpiCard change="Approved" icon={CheckCircle2} label="Activated DSAs" tone="green" value={String(branchStats.active)} />
          <KpiCard change="Restricted" icon={FileWarning} label="Blacklisted" tone="slate" value={String(branchStats.blacklisted)} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
          <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Branch DSA onboarding tracker</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Credit decisions update here as DSA Credit reviews each submitted profile.
                </p>
              </div>
              <Link href="/dsa/onboarding">
                <Button size="sm" type="button">
                  Onboard DSA
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {branchDsas.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="p-4 pl-6">Partner</th>
                        <th className="p-4">Submitted</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right pr-6">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {branchDsas.slice(0, 8).map((dsa) => (
                        <tr key={dsa.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-4 pl-6">
                            <div className="font-semibold text-slate-800">{dsa.name}</div>
                            <div className="text-xs text-slate-500">{dsa.businessType}</div>
                          </td>
                          <td className="p-4 font-mono text-xs text-slate-600">{dsa.code}</td>
                          <td className="p-4 text-xs text-slate-500">{formatDate(dsa.onboardingDate)}</td>
                          <td className="p-4">
                            <StatusBadge status={dsa.status} />
                          </td>
                          <td className="p-4 text-right pr-6">
                            <Link href={`/dsa/${dsa.id}`}>
                              <Button size="sm" type="button" variant="outline">
                                Open
                              </Button>
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
                  <p className="text-sm font-semibold text-slate-700">No DSAs submitted from this branch yet.</p>
                  <p className="text-xs text-slate-400 mt-0.5">Use Onboard DSA to submit the first profile to DSA Credit.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Internal handoff</h2>
              <p className="text-xs text-slate-500 mt-0.5">Branch submissions remain inactive until DSA Credit approves them.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-sky-50 p-4">
                <p className="text-sm font-semibold text-blue-950">Current credit queue</p>
                <p className="mt-1 text-2xl font-semibold text-blue-700">{branchStats.pendingCredit}</p>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <p className="rounded-md border border-slate-100 p-3">1. Branch submits onboarding details and documents.</p>
                <p className="rounded-md border border-slate-100 p-3">2. DSA Credit receives a workflow notification and reviews the profile.</p>
                <p className="rounded-md border border-slate-100 p-3">3. Approved DSAs become active and appear in product and journey dropdowns.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <OnHoldDsaDocuments
            description="Upload remaining documents for branch-submitted DSAs. They stay On Hold until all missing files are uploaded."
            dsas={onHoldDsas}
            emptyDescription="No branch DSAs are currently on hold."
            maxRows={6}
            title="Branch On-Hold DSA Documents"
          />
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
          <KpiCard change="+2" icon={Users} label="My Agent Network" tone="amber" value={String(partnerStats.agentsCount)} />
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
              <h2 className="text-base font-bold text-slate-900">Available Product Journeys</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live products configured for your DSA ID</p>
            </CardHeader>
            <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-center">
              {partnerProductConfigs.length ? (
                <div className="space-y-2">
                  {partnerProductConfigs.map((config) => (
                    <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3" key={config.id}>
                      <p className="text-sm font-bold text-blue-950">{config.product}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-blue-700">{config.dsaCode} - {config.commissionType}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
                  No active product journeys are configured for your DSA yet.
                </div>
              )}
              <Link href="/sell-now" className="block">
                <button className="w-full h-12 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2">
                  <ArrowRight className="h-4.5 w-4.5" />
                  Fill or Send Journey
                </button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Agent Network Directory */}
        <div className="mt-6">
          <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Manage My Network</h2>
                <p className="text-xs text-slate-500 mt-0.5">Agents onboarded and managed by your DSA account</p>
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
                        <th className="p-4">Email ID</th>
                        <th className="p-4">Last login</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right pr-6">Profile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partnerAgents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-slate-50/40 transition">
                          <td className="p-4 pl-6 font-semibold text-slate-800">{agent.name}</td>
                          <td className="p-4 text-slate-600 text-xs">{agent.email}</td>
                          <td className="p-4 text-slate-500 text-xs">{formatDate(agent.lastLogin)}</td>
                          <td className="p-4">
                            <StatusBadge status={agent.status} />
                          </td>
                          <td className="p-4 text-right pr-6">
                            <Link href="/dsa/management">
                              <button className="inline-flex h-8 px-3 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
                                Manage
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
                  <p className="text-sm font-semibold text-slate-700">No Agents Yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">Agents linked to your DSA will appear here.</p>
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
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-sky-500 rounded-full blur-3xl opacity-10" />

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
              className="h-12 px-6 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-black tracking-wide shadow-md shadow-blue-700/20 hover:shadow-lg transition flex items-center justify-center gap-2 border-none self-start md:self-auto"
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
                  const visibleDecisionSummary = app.deviation?.required
                    ? "Application is under manual credit review. The credit desk will update the final decision after review."
                    : app.decisionSummary;

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
                          <strong className="text-slate-700">Latest update:</strong> {visibleDecisionSummary}
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
                {customerJourneyConfigs.slice(0, 3).map((offer) => (
                  <div key={offer.id} className="flex justify-between items-center rounded-xl bg-slate-50/70 p-3 border border-slate-100 hover:bg-slate-50 transition">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{offer.product}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{CUSTOMER_DSA_DISPLAY_NAME}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-blue-700">{offer.commissionType}</span>
                      <button
                        onClick={() => {
                          setSourcingPartner(offer.dsaId);
                          setLoanProduct(offer.product);
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
                {customerJourneyConfigs.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                    No DSA product journeys are active yet.
                  </div>
                ) : null}
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
                  <Label htmlFor="loanProduct">Choose Loan Product</Label>
                  <Select
                    id="loanProduct"
                    onChange={(e) => {
                      setLoanProduct(e.target.value as Product | "");
                      setFormErrors({});
                    }}
                    value={loanProduct}
                  >
                    <option value="">Select product</option>
                    {customerProductOptions.map((config) => (
                      <option key={config.product} value={config.product}>{config.product}</option>
                    ))}
                  </Select>
                  {formErrors.product && <p className="text-xs font-semibold text-rose-600 mt-1">{formErrors.product}</p>}
                </Field>
                <Field>
                  <Label htmlFor="loanAmount">Requested Amount (INR)</Label>
                  <Input id="loanAmount" type="number" onChange={(e) => setLoanAmount(e.target.value)} value={loanAmount} />
                  {formErrors.amount && <p className="text-xs font-semibold text-rose-600 mt-1">{formErrors.amount}</p>}
                </Field>
                <Field>
                  <Label htmlFor="loanSalary">Net Monthly Salary (INR)</Label>
                  <Input id="loanSalary" type="number" onChange={(e) => setLoanSalary(e.target.value)} value={loanSalary} />
                  {formErrors.salary && <p className="text-xs font-semibold text-rose-600 mt-1">{formErrors.salary}</p>}
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
                  {formErrors.city && <p className="text-xs font-semibold text-rose-600 mt-1">{formErrors.city}</p>}
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
