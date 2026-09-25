"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Search,
  Copy,
  Check,
  Send,
  HelpCircle,
  FileCheck,
  XCircle,
  Banknote,
  Share2,
  Filter,
  Eye,
  RefreshCw,
  Building2,
  User,
  Layers,
  FileText,
} from "lucide-react";
import {
  fetchLeads,
  fetchLeadById,
  createLead,
  generateShareableToken,
  fetchMakerQueue,
  forwardToChecker,
  raiseLeadQuery,
  respondLeadQuery,
  sanctionLead,
  rejectLead,
  disburseLead,
  fetchLeadReports,
  sendLeadOtp,
  verifyLeadOtp,
  LeadData,
  LeadFacility,
} from "@/apis/lead";
import { fetchLoanProducts, fetchLoanTypesByProduct, getMasterValues, verifyPanAdvance, fetchBranchesDropdown } from "@/apis/admin";
import { PageHeader } from "@/components/module";
import { Button, Card, CardContent, CardHeader, Modal, StatusBadge, Tabs } from "@/components/ui/primitives";
import { useMockStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export function LeadManagementScreen() {
  const { currentUser } = useMockStore();
  const { toast } = useToast();

  const userRole = (currentUser?.role || (currentUser as any)?.role_name || "").toLowerCase();
  const isDsa = userRole === "dsa" || (userRole.includes("dsa") && !userRole.includes("maker") && !userRole.includes("checker") && !userRole.includes("admin"));
  const isBankUser = !isDsa;

  const [activeTab, setActiveTab] = useState("all-leads");
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [makerQueue, setMakerQueue] = useState<LeadData[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);

  // Selected lead for detail/action
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);

  // Form states
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Master Data
  const [products, setProducts] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [occupationTypes, setOccupationTypes] = useState<any[]>([]);
  const [deviationTypes, setDeviationTypes] = useState<any[]>([]);

  // PAN Verification State
  const [verifyingPan, setVerifyingPan] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panMessage, setPanMessage] = useState<string | null>(null);

  // Mobile OTP State
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpReferenceId, setOtpReferenceId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState<Partial<LeadData>>({
    constitution: "Individual",
    pincode: "400001",
    city: "Mumbai",
    state: "Maharashtra",
    Branch_id: "",
    title: "MR",
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "MALE",
    dob: "",
    age: undefined,
    address: "",
    mobile: "",
    email: "",
    employment_type: "",
    occupation_type: "",
    employer_business_name: "",
    avg_gross_monthly_income: undefined,
    avg_net_monthly_income: undefined,
    existing_monthly_repayment_obligation: undefined,
    entity_name: "",
    doi: "",
    business_address: "",
    pan_no: "",
    loan_product_id: undefined,
    loan_type_id: undefined,
    loan_amount_required: 100000,
    loan_period_months: 12,
  });

  // Action Form States
  const [queryText, setQueryText] = useState("");
  const [queryType, setQueryType] = useState("clarification");
  const [responseText, setResponseText] = useState("");
  const [activeQueryId, setActiveQueryId] = useState<number | null>(null);

  const [sanctionAmount, setSanctionAmount] = useState<number>(0);
  const [sanctionLetterNo, setSanctionLetterNo] = useState("");
  const [sanctionRemarks, setSanctionRemarks] = useState("");

  const [rejectionReason, setRejectionReason] = useState("");

  // Disbursement multi-facility state
  const [facilities, setFacilities] = useState<LeadFacility[]>([
    { facility_type: "term_loan", sanctioned_amount: 0, disbursed_amount: 0, loan_account_no: "", has_deviation: false, deviation_type: "" }
  ]);
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split("T")[0]);

  // Load initial data
  const loadAllData = async () => {
    try {
      setLoading(true);
      const [leadsRes, makerRes, reportsRes, prodRes, branchRes, titleRes, genderRes, empRes, occRes, devRes] = await Promise.all([
        fetchLeads({ search, status: statusFilter }),
        fetchMakerQueue(),
        fetchLeadReports(),
        fetchLoanProducts(),
        fetchBranchesDropdown(),
        getMasterValues({ group: "title" }),
        getMasterValues({ group: "gender" }),
        getMasterValues({ group: "employment_type" }),
        getMasterValues({ group: "occupation_type" }),
        getMasterValues({ group: "deviation_type" }),
      ]);

      const items = leadsRes?.data?.items || [];
      setLeads(items);

      const mqItems = makerRes?.data?.items || [];
      setMakerQueue(mqItems);

      setReports(reportsRes?.data || null);

      const prods = prodRes?.data?.data || prodRes?.data || prodRes || [];
      setProducts(Array.isArray(prods) ? prods : []);

      const branchItems = branchRes?.data || branchRes || [];
      setBranches(Array.isArray(branchItems) ? branchItems : []);

      setTitles(Array.isArray(titleRes?.data || titleRes) ? (titleRes?.data || titleRes) : []);
      setGenders(Array.isArray(genderRes?.data || genderRes) ? (genderRes?.data || genderRes) : []);
      setEmploymentTypes(Array.isArray(empRes?.data || empRes) ? (empRes?.data || empRes) : []);
      setOccupationTypes(Array.isArray(occRes?.data || occRes) ? (occRes?.data || occRes) : []);
      setDeviationTypes(Array.isArray(devRes?.data || devRes) ? (devRes?.data || devRes) : []);
    } catch (err: any) {
      console.error("Failed to fetch lead data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const mobile = (createForm.mobile || "").trim();
    if (!mobile || mobile.length !== 10) {
      setOtpMessage("Enter a valid 10-digit mobile number");
      return;
    }
    try {
      setSendingOtp(true);
      setOtpMessage(null);
      const res = await sendLeadOtp(mobile);
      if (res?.status === "success") {
        setOtpSent(true);
        setOtpReferenceId(res.data?.reference_id || "mock-ref-id");
        setOtpMessage(`OTP sent! (Dev Mock OTP: ${res.data?.mock_otp || "123456"})`);
      } else {
        setOtpMessage(res?.message || "Failed to send OTP");
      }
    } catch (err: any) {
      setOtpMessage(err?.response?.data?.message || err?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpReferenceId || !otpCode || otpCode.length !== 6) {
      setOtpMessage("Enter 6-digit OTP code");
      return;
    }
    try {
      setVerifyingOtp(true);
      setOtpMessage(null);
      const res = await verifyLeadOtp(otpReferenceId, otpCode);
      if (res?.status === "success") {
        setOtpVerified(true);
        setOtpMessage("✓ Mobile OTP Verified successfully.");
      } else {
        setOtpMessage(res?.message || "Invalid OTP entered");
      }
    } catch (err: any) {
      setOtpMessage(err?.response?.data?.message || err?.message || "OTP verification failed");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleVerifyPan = async () => {
    const pan = (createForm.pan_no || "").trim().toUpperCase();
    if (!pan || pan.length !== 10) {
      setPanMessage("Enter a valid 10-character PAN number");
      setPanVerified(false);
      return;
    }

    try {
      setVerifyingPan(true);
      setPanMessage(null);
      const res = await verifyPanAdvance(pan);
      const detailsData = res?.data?.details?.data || res?.data?.details || res?.data || {};
      const statusSuccess = res?.success || res?.data?.status === "SUCCESS";

      if (statusSuccess) {
        setPanVerified(true);
        setPanMessage("✓ PAN verified successfully. Details pre-filled below.");

        const firstName = detailsData.firstName || detailsData.first_name || "";
        const middleName = detailsData.middleName || detailsData.middle_name || "";
        const lastName = detailsData.lastName || detailsData.last_name || "";
        const fullName = detailsData.fullName || detailsData.name || `${firstName} ${middleName} ${lastName}`.trim();

        let formattedDate = "";
        const rawDob = detailsData.dobOrDoi || detailsData.dob || detailsData.doi;
        if (rawDob) {
          const d = new Date(rawDob);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split("T")[0];
          } else {
            formattedDate = rawDob;
          }
        }

        let genderVal = (detailsData.gender || "MALE").toUpperCase();
        if (genderVal.startsWith("M")) genderVal = "MALE";
        else if (genderVal.startsWith("F")) genderVal = "FEMALE";
        else if (genderVal.startsWith("T")) genderVal = "TRANSGENDER";

        const addrParts = [
          detailsData.buildingName,
          detailsData.streetName,
          detailsData.locality,
          detailsData.city,
          detailsData.state,
          detailsData.pinCode,
        ].filter(Boolean);
        const fullAddress = addrParts.join(", ") || detailsData.address || "";

        const cityName = detailsData.city || "Mumbai";
        const stateName = detailsData.state || "Maharashtra";
        const pinCodeVal = detailsData.pinCode || detailsData.pincode || "400001";

        setCreateForm((prev) => ({
          ...prev,
          pan_no: pan,
          first_name: firstName || prev.first_name,
          middle_name: middleName || prev.middle_name,
          last_name: lastName || prev.last_name,
          entity_name: fullName || prev.entity_name,
          dob: formattedDate || prev.dob,
          doi: formattedDate || prev.doi,
          gender: genderVal || prev.gender,
          address: fullAddress || prev.address,
          business_address: fullAddress || prev.business_address,
          city: cityName,
          state: stateName,
          pincode: pinCodeVal,
        }));
      } else {
        setPanVerified(false);
        setPanMessage(res?.message || "PAN verification returned invalid status");
      }
    } catch (err: any) {
      setPanVerified(false);
      setPanMessage(err?.response?.data?.message || err?.message || "PAN verification failed");
    } finally {
      setVerifyingPan(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [search, statusFilter]);

  const handleProductChange = async (productId: number) => {
    setCreateForm((prev) => ({ ...prev, loan_product_id: productId, loan_type_id: undefined }));
    if (!productId) {
      setLoanTypes([]);
      return;
    }
    try {
      const res = await fetchLoanTypesByProduct(productId);
      const types = res?.data || res || [];
      setLoanTypes(Array.isArray(types) ? types : []);
    } catch (err) {
      console.error("Failed to fetch loan types", err);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.loan_product_id || !createForm.loan_type_id) {
      toast({ title: "Error", description: "Please select Loan Product & Type", variant: "error" });
      return;
    }
    try {
      const res = await createLead(createForm as LeadData);
      if (res?.status === "success") {
        toast({ title: "Success", description: "Lead created successfully", variant: "success" });
        setIsCreateModalOpen(false);
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.message || err?.message, variant: "error" });
    }
  };

  const handleGenerateLink = async () => {
    try {
      const res = await generateShareableToken();
      if (res?.status === "success") {
        setShareableUrl(res.data.shareable_url);
        setIsShareModalOpen(true);
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to generate link", variant: "error" });
    }
  };

  const handleViewDetail = async (id: number | string) => {
    try {
      const res = await fetchLeadById(id);
      if (res?.status === "success") {
        setSelectedLead(res.data);
        setIsDetailModalOpen(true);
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to fetch lead details", variant: "error" });
    }
  };

  const handleForwardToChecker = async (leadId: number | string) => {
    try {
      const res = await forwardToChecker(leadId, "Maker verified details");
      if (res?.status === "success") {
        toast({ title: "Success", description: "Lead forwarded to Checker", variant: "success" });
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to forward lead", variant: "error" });
    }
  };

  const handleRaiseQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !queryText) return;
    try {
      const res = await raiseLeadQuery(selectedLead.id!, { query_text: queryText, query_type: queryType });
      if (res?.status === "success") {
        toast({ title: "Success", description: "Query raised successfully", variant: "success" });
        setIsQueryModalOpen(false);
        setQueryText("");
        handleViewDetail(selectedLead.id!);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleRespondQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQueryId || !responseText) return;
    try {
      const res = await respondLeadQuery(activeQueryId, responseText);
      if (res?.status === "success") {
        toast({ title: "Success", description: "Query response submitted", variant: "success" });
        setResponseText("");
        setActiveQueryId(null);
        if (selectedLead) handleViewDetail(selectedLead.id!);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleSanctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const res = await sanctionLead(selectedLead.id!, {
        sanction_amount: sanctionAmount,
        sanction_letter_no: sanctionLetterNo,
        remarks: sanctionRemarks,
      });
      if (res?.status === "success") {
        toast({ title: "Success", description: "Lead sanctioned successfully", variant: "success" });
        setIsSanctionModalOpen(false);
        handleViewDetail(selectedLead.id!);
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !rejectionReason) return;
    try {
      const res = await rejectLead(selectedLead.id!, rejectionReason);
      if (res?.status === "success") {
        toast({ title: "Success", description: "Lead rejected", variant: "success" });
        setIsRejectModalOpen(false);
        setRejectionReason("");
        handleViewDetail(selectedLead.id!);
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const openDisbursementModal = (lead: LeadData) => {
    setSelectedLead(lead);
    const sancAmt = lead.sanction_amount || lead.loan_amount_required || 0;
    setFacilities([
      {
        facility_type: "term_loan",
        sanctioned_amount: sancAmt,
        disbursed_amount: sancAmt,
        loan_account_no: "",
        has_deviation: false,
        deviation_type: "",
      },
    ]);
    setIsDisburseModalOpen(true);
  };

  const handleAddFacility = () => {
    setFacilities((prev) => [
      ...prev,
      { facility_type: "cash_credit", sanctioned_amount: 0, disbursed_amount: 0, loan_account_no: "", has_deviation: false, deviation_type: "" },
    ]);
  };

  const handleRemoveFacility = (index: number) => {
    setFacilities((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const totalDisbursed = facilities.reduce((sum, f) => sum + Number(f.disbursed_amount || 0), 0);
      const res = await disburseLead(selectedLead.id!, {
        disbursed_amount: totalDisbursed,
        disbursement_date: disbursementDate,
        facilities: facilities,
      });
      if (res?.status === "success") {
        toast({ title: "Success", description: "Loan disbursed successfully", variant: "success" });
        setIsDisburseModalOpen(false);
        handleViewDetail(selectedLead.id!);
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <div className="flex gap-2">
            <Button onClick={handleGenerateLink} variant="outline" type="button">
              <Share2 className="h-4 w-4 mr-2 text-emerald-600" />
              Customer Link
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)} type="button">
              <Plus className="h-4 w-4 mr-2" />
              New Lead
            </Button>
          </div>
        }
        description=" "
        eyebrow="Lead Management"
        title="Lead Management"
      />

      {/* KPI Cards */}
      {reports && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Leads Created</p>
                <p className="text-2xl font-bold text-white mt-1">{reports.total_leads || 0}</p>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                <Layers className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Maker Queue (New)</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{makerQueue.length}</p>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                <FileCheck className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Sanctioned</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">
                  {leads.filter((l) => l.status === "SANCTIONED").length}
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <Banknote className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Disbursed</p>
                <p className="text-2xl font-bold text-indigo-400 mt-1">
                  {leads.filter((l) => l.status === "DISBURSED").length}
                </p>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Check className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <Tabs
          onChange={setActiveTab}
          tabs={
            isBankUser
              ? [
                  { label: `All Leads (${leads.length})`, value: "all-leads" },
                  { label: `Bank Maker Queue (${makerQueue.length})`, value: "maker-queue" },
                ]
              : [{ label: `My Leads (${leads.length})`, value: "all-leads" }]
          }
          value={activeTab}
        />

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => loadAllData()}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Applicant / Ref ID</th>
                  <th className="py-3 px-4">Constitution</th>
                  <th className="py-3 px-4">Product & Type</th>
                  <th className="py-3 px-4">Required Amount</th>
                  <th className="py-3 px-4">Channel / Creator</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(activeTab === "all-leads" ? leads : makerQueue).map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{lead.CustName || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.entity_name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{lead.application_id || lead.lead_uuid?.slice(0, 13)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${lead.constitution === 'Individual' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {lead.constitution}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-800">{lead.product?.name || "Loan Product"}</p>
                      <p className="text-slate-400 text-[11px]">{lead.loan_type?.name || lead.loanType?.name || "Standard"}</p>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {formatCurrency(Number(lead.loan_amount_required || 0))}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="capitalize font-semibold">{lead.created_by_type || "dsa"}</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={lead.status || "NEW"} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewDetail(lead.id!)}>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                      {isBankUser && lead.status === "NEW" && (
                        <Button size="sm" onClick={() => handleForwardToChecker(lead.id!)}>
                          Forward →
                        </Button>
                      )}
                      {isBankUser && lead.status === "SANCTIONED" && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDisbursementModal(lead)}>
                          Disburse
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Share Link Modal */}
      <Modal open={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Customer Self-Fill Shareable Link">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Share this link with your customer to let them complete their loan details directly online.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareableUrl || ""}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800"
            />
            <Button
              onClick={() => {
                if (shareableUrl) {
                  navigator.clipboard.writeText(shareableUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Lead Modal */}
      <Modal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Lead" width="max-w-3xl">
        <form onSubmit={handleCreateLead} className="space-y-4 text-xs">

          {/* STEP 1: Customer Basic Information */}
          <div className="bg-slate-50 p-3 rounded-lg border space-y-2">
            <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">1. Customer Basic Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Branch *</label>
                <select
                  value={createForm.Branch_id || ""}
                  onChange={(e) => setCreateForm({ ...createForm, Branch_id: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-white"
                >
                  <option value="">-- Select Branch --</option>
                  {branches.map((b) => (
                    <option key={b.branch_code || b.id} value={b.branch_code || b.id}>
                      {b.branch_name || b.name} ({b.branch_code || b.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Constitution *</label>
                <select
                  value={createForm.constitution}
                  onChange={(e) => setCreateForm({ ...createForm, constitution: e.target.value as any })}
                  className="w-full border rounded-lg p-2 bg-white font-medium"
                >
                  <option value="Individual">Individual</option>
                  <option value="Proprietory">Proprietory</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Limited Liability Partnership">Limited Liability Partnership</option>
                  <option value="Pvt. Ltd. Company">Pvt. Ltd. Company</option>
                  <option value="Public Ltd. Company">Public Ltd. Company</option>
                  <option value="Charitable Trust">Charitable Trust</option>
                  <option value="Co-op. Society">Co-op. Society</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-600 mb-1">Pincode *</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. 400001"
                  value={createForm.pincode || ""}
                  onChange={(e) => setCreateForm({ ...createForm, pincode: e.target.value })}
                  className="w-full border rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">City *</label>
                <input
                  type="text"
                  required
                  placeholder="City"
                  value={createForm.city || ""}
                  onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">State *</label>
                <input
                  type="text"
                  required
                  placeholder="State"
                  value={createForm.state || ""}
                  onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>
            </div>
          </div>

          {/* STEP 2: PAN Verification FIRST before Name/Address/DOB */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 space-y-2">
            <label className="block text-emerald-900 font-bold">
              {createForm.constitution === "Individual" ? "Individual PAN Number *" : "Entity PAN Number *"}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={10}
                placeholder="ABCDE1234F"
                value={createForm.pan_no}
                onChange={(e) => {
                  setCreateForm({ ...createForm, pan_no: e.target.value.toUpperCase() });
                  setPanVerified(false);
                  setPanMessage(null);
                }}
                className="flex-1 border border-emerald-300 rounded-lg p-2 uppercase font-mono font-semibold"
              />
              <Button
                type="button"
                disabled={verifyingPan || (createForm.pan_no || "").length !== 10}
                onClick={handleVerifyPan}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
              >
                {verifyingPan ? "Verifying..." : "Verify PAN & Auto-fill"}
              </Button>
            </div>
            {panMessage && (
              <p className={`text-[11px] mt-1 ${panVerified ? "text-emerald-700 font-bold" : "text-amber-700 font-medium"}`}>
                {panMessage}
              </p>
            )}
          </div>

          {/* STEP 3: Contact Details & Mobile OTP Verification */}
          <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
            <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Contact & Mobile OTP</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Mobile Number *</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    disabled={otpVerified}
                    value={createForm.mobile}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, mobile: e.target.value });
                      setOtpSent(false);
                      setOtpVerified(false);
                    }}
                    className="flex-1 border rounded-lg p-2 bg-white disabled:opacity-60"
                  />
                  {!otpVerified && (
                    <Button
                      type="button"
                      disabled={sendingOtp || (createForm.mobile || "").length !== 10}
                      onClick={handleSendOtp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] px-2.5 py-1.5"
                    >
                      {sendingOtp ? "Sending..." : "Send OTP"}
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">E-Mail ID *</label>
                <input
                  type="email"
                  required
                  placeholder="email@domain.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full border rounded-lg p-2 bg-white"
                />
              </div>
            </div>

            {otpSent && !otpVerified && (
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6-digit OTP (e.g. 123456)"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="flex-1 border rounded-lg p-2 font-mono text-center bg-white"
                />
                <Button
                  type="button"
                  disabled={verifyingOtp || otpCode.length !== 6}
                  onClick={handleVerifyOtp}
                  className="bg-emerald-600 text-white font-bold"
                >
                  {verifyingOtp ? "Verifying..." : "Verify OTP"}
                </Button>
              </div>
            )}

            {otpVerified && (
              <div className="bg-emerald-100 text-emerald-800 p-1.5 rounded text-[11px] font-bold">
                ✓ Mobile Number Verified with OTP
              </div>
            )}

            {otpMessage && !otpVerified && (
              <p className="text-[11px] text-amber-700">{otpMessage}</p>
            )}
          </div>

          {/* STEP 4: Applicant / Entity Details */}
          {createForm.constitution === "Individual" ? (
            <div className="space-y-3 border-t pt-3">
              <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Applicant Personal Information</p>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1">Title *</label>
                  <select
                    value={createForm.title || "MR"}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  >
                    {titles.map((t: any) => (
                      <option key={t.meta_key || t.id} value={t.meta_key || t.meta_value}>{t.meta_value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.first_name || ""}
                    onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={createForm.middle_name || ""}
                    onChange={(e) => setCreateForm({ ...createForm, middle_name: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.last_name || ""}
                    onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Gender *</label>
                  <select
                    value={createForm.gender || "MALE"}
                    onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  >
                    {genders.map((g: any) => (
                      <option key={g.meta_key || g.id} value={g.meta_key || g.meta_value}>{g.meta_value}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Date of Birth (DOB) *</label>
                  <input
                    type="date"
                    required
                    value={createForm.dob || ""}
                    onChange={(e) => {
                      const dobVal = e.target.value;
                      let ageVal = undefined;
                      if (dobVal) {
                        const d = new Date(dobVal);
                        if (!isNaN(d.getTime())) {
                          const today = new Date();
                          ageVal = today.getFullYear() - d.getFullYear();
                          const m = today.getMonth() - d.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
                            ageVal--;
                          }
                        }
                      }
                      setCreateForm({ ...createForm, dob: dobVal, age: ageVal });
                    }}
                    className="w-full border rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Age (Calculated)</label>
                  <div className="w-full border rounded-lg p-2 bg-slate-100 font-mono font-bold text-slate-700">
                    {createForm.age !== undefined ? `${createForm.age} Yrs` : "--"}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Residential Address *</label>
                <input
                  type="text"
                  required
                  placeholder="Full residential address..."
                  value={createForm.address || ""}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Employment Type *</label>
                  <select
                    required
                    value={createForm.employment_type || ""}
                    onChange={(e) => setCreateForm({ ...createForm, employment_type: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  >
                    <option value="">-- Choose Employment --</option>
                    {employmentTypes.map((item: any) => (
                      <option key={item.meta_key || item.id} value={item.meta_key || item.meta_value}>{item.meta_value}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Occupation Type *</label>
                  <select
                    required
                    value={createForm.occupation_type || ""}
                    onChange={(e) => setCreateForm({ ...createForm, occupation_type: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  >
                    <option value="">-- Choose Occupation --</option>
                    {occupationTypes.map((item: any) => (
                      <option key={item.meta_key || item.id} value={item.meta_key || item.meta_value}>{item.meta_value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Employer / Business Entity Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Company / Employer name"
                  value={createForm.employer_business_name || ""}
                  onChange={(e) => setCreateForm({ ...createForm, employer_business_name: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1">Avg Gross Monthly Income *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.avg_gross_monthly_income || ""}
                    onChange={(e) => setCreateForm({ ...createForm, avg_gross_monthly_income: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Avg Net Monthly Income *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.avg_net_monthly_income || ""}
                    onChange={(e) => setCreateForm({ ...createForm, avg_net_monthly_income: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Monthly Obligation *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.existing_monthly_repayment_obligation || ""}
                    onChange={(e) => setCreateForm({ ...createForm, existing_monthly_repayment_obligation: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 border-t pt-3">
              <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Entity Details (Non-Individual)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Entity Name *</label>
                  <input
                    type="text"
                    required
                    value={createForm.entity_name || ""}
                    onChange={(e) => setCreateForm({ ...createForm, entity_name: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Date of Incorporation (DOI) *</label>
                  <input
                    type="date"
                    required
                    value={createForm.doi || ""}
                    onChange={(e) => setCreateForm({ ...createForm, doi: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Business Address *</label>
                <input
                  type="text"
                  required
                  placeholder="Full office address..."
                  value={createForm.business_address || ""}
                  onChange={(e) => setCreateForm({ ...createForm, business_address: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1">Name of Prop / Partner / Director *</label>
                  <input
                    type="text"
                    required
                    placeholder="Key promoter name..."
                    value={createForm.proprietor_partner_director_name || ""}
                    onChange={(e) => setCreateForm({ ...createForm, proprietor_partner_director_name: e.target.value })}
                    className="w-full border rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Annual Gross Sales Turnover Last FY (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.annual_gross_turnover_last_fy || ""}
                    onChange={(e) => setCreateForm({ ...createForm, annual_gross_turnover_last_fy: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1">Avg Annual Gross Income (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.avg_annual_gross_income || ""}
                    onChange={(e) => setCreateForm({ ...createForm, avg_annual_gross_income: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Avg Annual Net Income (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.avg_annual_net_income || ""}
                    onChange={(e) => setCreateForm({ ...createForm, avg_annual_net_income: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Existing Monthly Obligation (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={createForm.existing_monthly_repayment_obligation || ""}
                    onChange={(e) => setCreateForm({ ...createForm, existing_monthly_repayment_obligation: Number(e.target.value) })}
                    className="w-full border rounded-lg p-2 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Loan Requirements */}
          <div className="space-y-3 border-t pt-3">
            <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Loan Product & Type</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Loan Product *</label>
                <select
                  required
                  value={createForm.loan_product_id || ""}
                  onChange={(e) => handleProductChange(Number(e.target.value))}
                  className="w-full border rounded-lg p-2 bg-white"
                >
                  <option value="">-- Choose Product --</option>
                  {products
                    .filter((p) => {
                      if (createForm.constitution !== "Individual") {
                        const nameLower = (p.name || p.product_name || "").toLowerCase();
                        if (nameLower.includes("home loan") || nameLower.includes("education loan")) {
                          return false;
                        }
                      }
                      return true;
                    })
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.name || p.product_name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Loan Type *</label>
                <select
                  required
                  disabled={!createForm.loan_product_id}
                  value={createForm.loan_type_id || ""}
                  onChange={(e) => setCreateForm({ ...createForm, loan_type_id: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2 bg-white disabled:opacity-50"
                >
                  <option value="">-- Choose Type --</option>
                  {loanTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name || t.type_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Required Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={createForm.loan_amount_required}
                  onChange={(e) => setCreateForm({ ...createForm, loan_amount_required: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Tenure (Months) *</label>
                <input
                  type="number"
                  required
                  value={createForm.loan_period_months}
                  onChange={(e) => setCreateForm({ ...createForm, loan_period_months: Number(e.target.value) })}
                  className="w-full border rounded-lg p-2 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Lead</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {selectedLead && (
        <Modal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Lead Workstation: ${selectedLead.CustName || selectedLead.lead_uuid}`} width="max-w-3xl">
          <div className="space-y-6 text-xs">
            {/* Lead Summary */}
            <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border">
              <div>
                <p className="text-slate-400">Application Reference</p>
                <p className="font-mono font-bold text-slate-900">{selectedLead.application_id || selectedLead.lead_uuid}</p>
              </div>
              <div>
                <p className="text-slate-400">Status</p>
                <StatusBadge status={selectedLead.status || "NEW"} />
              </div>
              <div>
                <p className="text-slate-400">Required Amount</p>
                <p className="font-mono font-bold text-slate-900">{formatCurrency(Number(selectedLead.loan_amount_required || 0))}</p>
              </div>
            </div>

            {/* Action Toolbar - Sanction/Reject/Disburse restricted to Bank users */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => setIsQueryModalOpen(true)}>
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                Raise Query
              </Button>
              {isBankUser && (
                <>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                    setSanctionAmount(selectedLead.loan_amount_required || 0);
                    setIsSanctionModalOpen(true);
                  }}>
                    <FileCheck className="h-3.5 w-3.5 mr-1" />
                    Sanction
                  </Button>
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setIsRejectModalOpen(true)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Reject
                  </Button>
                  {selectedLead.status === "SANCTIONED" && (
                    <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => openDisbursementModal(selectedLead)}>
                      <Banknote className="h-3.5 w-3.5 mr-1" />
                      Manual Disburse
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* Queries Thread */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-bold text-slate-800">Queries & Communication Thread</h4>
              {selectedLead.queries && selectedLead.queries.length > 0 ? (
                selectedLead.queries.map((q) => (
                  <div key={q.id} className="p-3 bg-slate-50 border rounded-lg space-y-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-amber-600 uppercase">Type: {q.query_type}</span>
                      <StatusBadge status={q.status} />
                    </div>
                    <p className="text-slate-800">Q: {q.query_text}</p>
                    {q.response_text ? (
                      <p className="text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-100 font-medium">
                        A: {q.response_text}
                      </p>
                    ) : (
                      <div className="pt-2 flex gap-2">
                        <input
                          type="text"
                          placeholder="Type query response..."
                          className="flex-1 border rounded px-2 py-1"
                          onChange={(e) => setResponseText(e.target.value)}
                        />
                        <Button size="sm" onClick={(e) => {
                          setActiveQueryId(q.id);
                          handleRespondQuerySubmit(e);
                        }}>
                          Respond
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-400 italic">No queries raised on this lead.</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Query Modal */}
      <Modal open={isQueryModalOpen} onClose={() => setIsQueryModalOpen(false)} title="Raise Query on Lead">
        <form onSubmit={handleRaiseQuerySubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Query Type</label>
            <select value={queryType} onChange={(e) => setQueryType(e.target.value)} className="w-full border rounded p-2">
              <option value="clarification">Clarification</option>
              <option value="document">Document Missing</option>
              <option value="deviation">Deviation Query</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Query Text *</label>
            <textarea
              required
              rows={3}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="w-full border rounded p-2"
              placeholder="Enter detailed query..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsQueryModalOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Query</Button>
          </div>
        </form>
      </Modal>

      {/* Sanction Modal */}
      <Modal open={isSanctionModalOpen} onClose={() => setIsSanctionModalOpen(false)} title="Sanction Lead">
        <form onSubmit={handleSanctionSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Sanction Amount (₹) *</label>
            <input
              type="number"
              required
              value={sanctionAmount}
              onChange={(e) => setSanctionAmount(Number(e.target.value))}
              className="w-full border rounded p-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Sanction Letter Number</label>
            <input
              type="text"
              placeholder="e.g. SL-2026-9081"
              value={sanctionLetterNo}
              onChange={(e) => setSanctionLetterNo(e.target.value)}
              className="w-full border rounded p-2 font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Sanction Remarks</label>
            <textarea
              rows={2}
              value={sanctionRemarks}
              onChange={(e) => setSanctionRemarks(e.target.value)}
              className="w-full border rounded p-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsSanctionModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 text-white">Confirm Sanction</Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal open={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Lead">
        <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Rejection Reason *</label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full border rounded p-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-red-600 text-white">Reject Lead</Button>
          </div>
        </form>
      </Modal>

      {/* Manual Disbursement & Multi-facility Modal */}
      <Modal open={isDisburseModalOpen} onClose={() => setIsDisburseModalOpen(false)} title="Manual Disbursement & Multi-Facility Mapping" width="max-w-3xl">
        <form onSubmit={handleDisburseSubmit} className="space-y-4 text-xs">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border">
            <div>
              <p className="font-semibold text-slate-800">Date of Disbursement</p>
              <input
                type="date"
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
                className="border rounded px-2 py-1 mt-1"
              />
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleAddFacility}>
              + Add Facility Account
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-800">Facility Breakdown & Deviation Capture</h4>
            {facilities.map((fac, idx) => (
              <div key={idx} className="p-3 border rounded-xl bg-white space-y-3 relative">
                {facilities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFacility(idx)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold"
                  >
                    ✕ Remove
                  </button>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Facility Type *</label>
                    <select
                      value={fac.facility_type}
                      onChange={(e) => {
                        const updated = [...facilities];
                        updated[idx].facility_type = e.target.value;
                        setFacilities(updated);
                      }}
                      className="w-full border rounded p-1.5"
                    >
                      <option value="term_loan">Term Loan</option>
                      <option value="cash_credit">Cash Credit (CC)</option>
                      <option value="overdraft">Overdraft (OD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Disbursed Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      value={fac.disbursed_amount}
                      onChange={(e) => {
                        const updated = [...facilities];
                        updated[idx].disbursed_amount = Number(e.target.value);
                        setFacilities(updated);
                      }}
                      className="w-full border rounded p-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Loan Account No.</label>
                    <input
                      type="text"
                      placeholder="CBS Account No."
                      value={fac.loan_account_no}
                      onChange={(e) => {
                        const updated = [...facilities];
                        updated[idx].loan_account_no = e.target.value;
                        setFacilities(updated);
                      }}
                      className="w-full border rounded p-1.5 font-mono"
                    />
                  </div>
                </div>

                {/* Deviation capture */}
                <div className="flex items-center gap-4 bg-amber-50/50 p-2 rounded border border-amber-100">
                  <label className="flex items-center gap-1.5 text-amber-900 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fac.has_deviation}
                      onChange={(e) => {
                        const updated = [...facilities];
                        updated[idx].has_deviation = e.target.checked;
                        setFacilities(updated);
                      }}
                    />
                    Has Deviation?
                  </label>
                  {fac.has_deviation && (
                    <select
                      value={fac.deviation_type || ""}
                      onChange={(e) => {
                        const updated = [...facilities];
                        updated[idx].deviation_type = e.target.value;
                        setFacilities(updated);
                      }}
                      className="flex-1 border rounded p-1 bg-white"
                    >
                      <option value="">-- Choose Deviation Type --</option>
                      {deviationTypes.map((d: any) => (
                        <option key={d.meta_key || d.id} value={d.meta_value || d.meta_key}>
                          {d.meta_value}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsDisburseModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 text-white">Confirm Disbursement</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

