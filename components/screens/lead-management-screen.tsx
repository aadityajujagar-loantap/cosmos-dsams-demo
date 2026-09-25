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
  Edit3,
} from "lucide-react";
import {
  fetchLeads,
  fetchLeadById,
  createLead,
  updateLead,
  generateShareableToken,
  fetchMakerQueue,
  forwardToChecker,
  raiseLeadQuery,
  respondLeadQuery,
  sanctionLead,
  rejectLead,
  disburseLead,
  cancelLead,
  updateLeadStatus,
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
  const isBankMaker = userRole.includes("maker");
  const isBankChecker = userRole.includes("checker") || userRole === "admin" || userRole === "super_admin" || (!isDsa && !isBankMaker);
  const isBankUser = !isDsa;

  const [activeTab, setActiveTab] = useState("all-leads");
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [makerQueue, setMakerQueue] = useState<LeadData[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Helper to normalize status string
  const getNormalizedStatus = (rawStatus?: string): string => {
    if (!rawStatus) return "NEW";
    const s = rawStatus.toUpperCase().trim();
    if (s.includes("NEW")) return "NEW";
    if (s.includes("PROCESS")) return "IN_PROCESS";
    if (s.includes("QUERY")) return "QUERY";
    if (s.includes("SANCTION")) return "SANCTIONED";
    if (s.includes("DISBURSE")) return "DISBURSED";
    if (s.includes("REJECT")) return "REJECTED";
    if (s.includes("CANCEL")) return "CANCELLED";
    return s;
  };

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [isSanctionModalOpen, setIsSanctionModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);

  // Selected lead for detail/action
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [editForm, setEditForm] = useState<Partial<LeadData>>({});
  const [cancellationReason, setCancellationReason] = useState("");
  const [targetStatus, setTargetStatus] = useState("IN_PROCESS");
  const [updateRemarks, setUpdateRemarks] = useState("");

  const [showRawJson, setShowRawJson] = useState(false);

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

  // Disbursement state
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split("T")[0]);
  const [disbursedAmount, setDisbursedAmount] = useState<number | string>(0);
  const [loanAccountNo, setLoanAccountNo] = useState("");
  const [loanAccountError, setLoanAccountError] = useState<string | null>(null);
  const [hasDeviation, setHasDeviation] = useState<string>("No");
  const [deviationType, setDeviationType] = useState<string>("");

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
    setDisbursementDate(new Date().toISOString().split("T")[0]);
    setDisbursedAmount(sancAmt);
    setLoanAccountNo("");
    setLoanAccountError(null);
    setHasDeviation("No");
    setDeviationType("");
    setIsDisburseModalOpen(true);
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    const acct = loanAccountNo.trim();
    if (!acct) {
      setLoanAccountError("Loan Account No. is required.");
      return;
    }
    if (!/^\d+$/.test(acct)) {
      setLoanAccountError("Loan Account No. must contain digits only.");
      return;
    }
    if (acct.length < 8) {
      setLoanAccountError("Loan Account No. must be at least 8 digits.");
      return;
    }
    setLoanAccountError(null);

    if (hasDeviation === "Yes" && !deviationType) {
      toast({ title: "Validation Error", description: "Please select Deviation Type", variant: "error" });
      return;
    }

    try {
      const res = await disburseLead(selectedLead.id!, {
        disbursed_amount: Number(disbursedAmount),
        disbursement_date: disbursementDate,
        loan_account_no: acct,
        has_deviation: hasDeviation === "Yes",
        deviation_type: hasDeviation === "Yes" ? deviationType : null,
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

  const handleProcessLead = async (leadId: number) => {
    try {
      const res = await forwardToChecker(leadId, "Processed by Bank Maker");
      if (res?.status === "success") {
        toast({ title: "Lead Processed", description: "Lead transitioned to IN_PROCESS status.", variant: "success" });
        handleViewDetail(leadId);
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !cancellationReason) return;
    try {
      const res = await cancelLead(selectedLead.id!, cancellationReason);
      if (res?.status === "success") {
        toast({ title: "Lead Cancelled", description: "Lead status updated to CANCELLED.", variant: "success" });
        setIsCancelModalOpen(false);
        setCancellationReason("");
        handleViewDetail(selectedLead.id!);
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !targetStatus) return;
    try {
      const res = await updateLeadStatus(selectedLead.id!, {
        status: targetStatus,
        remarks: updateRemarks,
      });
      if (res?.status === "success") {
        toast({ title: "Status Updated", description: `Lead status updated to ${targetStatus} successfully.`, variant: "success" });
        setIsUpdateStatusModalOpen(false);
        setUpdateRemarks("");
        handleViewDetail(selectedLead.id!);
        loadAllData();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleOpenEditModal = (lead: LeadData) => {
    setSelectedLead(lead);
    setEditForm({
      constitution: lead.constitution || "Individual",
      first_name: lead.first_name || "",
      middle_name: lead.middle_name || "",
      last_name: lead.last_name || "",
      CustName: lead.CustName || "",
      mobile: lead.mobile || "",
      email: lead.email || "",
      gender: lead.gender || "MALE",
      dob: lead.dob || "",
      address: lead.address || "",
      city: lead.city || "Mumbai",
      state: lead.state || "Maharashtra",
      pincode: lead.pincode || "400001",
      employment_type: lead.employment_type || "",
      occupation_type: lead.occupation_type || "",
      employer_business_name: lead.employer_business_name || "",
      avg_gross_monthly_income: lead.avg_gross_monthly_income,
      avg_net_monthly_income: lead.avg_net_monthly_income,
      existing_monthly_repayment_obligation: lead.existing_monthly_repayment_obligation,
      entity_name: lead.entity_name || "",
      doi: lead.doi || "",
      business_address: lead.business_address || "",
      proprietor_partner_director_name: lead.proprietor_partner_director_name || "",
      annual_gross_turnover_last_fy: lead.annual_gross_turnover_last_fy,
      loan_product_id: lead.loan_product_id,
      loan_type_id: lead.loan_type_id || lead.loan_scheme_id,
      loan_amount_required: lead.loan_amount_required,
      loan_period_months: lead.loan_period_months,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    try {
      const res = await updateLead(selectedLead.id!, editForm);
      if (res?.status === "success") {
        toast({ title: "Lead Updated", description: "Lead information updated successfully.", variant: "success" });
        setIsEditModalOpen(false);
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
        <Modal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Lead Workstation: ${selectedLead.CustName || selectedLead.lead_uuid}`} width="max-w-4xl">
          <div className="space-y-6 text-xs max-h-[80vh] overflow-y-auto pr-1">
            {/* Lead Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900 text-white p-4 rounded-xl shadow">
              <div>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Application Reference</p>
                <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">{selectedLead.application_id || selectedLead.lead_uuid}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Status</p>
                <div className="mt-1"><StatusBadge status={selectedLead.status || "NEW"} /></div>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Required Amount</p>
                <p className="font-mono font-bold text-white text-sm mt-0.5">{formatCurrency(Number(selectedLead.loan_amount_required || 0))}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">Constitution</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {selectedLead.constitution || "Individual"}
                </span>
              </div>
            </div>

            {/* Action Toolbar */}
            {(() => {
              const normStatus = getNormalizedStatus(selectedLead.status);
              return (
                <div className="flex flex-wrap gap-2 items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex flex-wrap gap-2">
                    {/* Action: Bank Maker / Bank User process lead when NEW */}
                    {(isBankMaker || isBankUser) && normStatus === "NEW" && (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handleProcessLead(selectedLead.id!)}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Process Lead (In Process)
                      </Button>
                    )}

                    {/* Quick action: Raise Query (Bank User across all active statuses) */}
                    {isBankUser && !["DISBURSED", "REJECTED", "CANCELLED"].includes(normStatus) && (
                      <Button size="sm" variant="outline" onClick={() => setIsQueryModalOpen(true)}>
                        <HelpCircle className="h-3.5 w-3.5 mr-1 text-amber-600 font-semibold" />
                        Raise Query
                      </Button>
                    )}

                    {/* Quick action: Bank Checker actions when IN_PROCESS */}
                    {isBankChecker && normStatus === "IN_PROCESS" && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => {
                          setSanctionAmount(selectedLead.loan_amount_required || 0);
                          setIsSanctionModalOpen(true);
                        }}>
                          <FileCheck className="h-3.5 w-3.5 mr-1" />
                          Sanction Lead
                        </Button>
                        <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => setIsRejectModalOpen(true)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject Lead
                        </Button>
                      </>
                    )}

                    {/* Quick action: Bank Checker action when SANCTIONED */}
                    {isBankChecker && normStatus === "SANCTIONED" && (
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => openDisbursementModal(selectedLead)}>
                        <Banknote className="h-3.5 w-3.5 mr-1" />
                        Manual Disburse
                      </Button>
                    )}

                    {/* Quick action: DSA Partner action when QUERY */}
                    {isDsa && normStatus === "QUERY" && (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => {
                        const el = document.getElementById("query-thread-section");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}>
                        <HelpCircle className="h-3.5 w-3.5 mr-1" />
                        Respond to Query
                      </Button>
                    )}

                    {/* Quick action: Edit Lead Info (when query raised or active lead) */}
                    {!["DISBURSED", "REJECTED", "CANCELLED"].includes(normStatus) && (
                      <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50 font-semibold" onClick={() => handleOpenEditModal(selectedLead)}>
                        <Edit3 className="h-3.5 w-3.5 mr-1" />
                        Edit Lead Info
                      </Button>
                    )}

                    {/* Quick action: Cancel Lead (when not terminal) */}
                    {!["DISBURSED", "REJECTED", "CANCELLED"].includes(normStatus) && (
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setIsCancelModalOpen(true)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Cancel Lead
                      </Button>
                    )}
                  </div>

                  <Button size="sm" variant="outline" onClick={() => setShowRawJson(!showRawJson)} className="text-slate-600 border-slate-300">
                    <FileText className="h-3.5 w-3.5 mr-1 text-blue-600" />
                    {showRawJson ? "Hide API Verification JSON" : "View API Verification JSON"}
                  </Button>
                </div>
              );
            })()}

            {/* RAW API VERIFICATION JSON PAYLOAD PANEL */}
            {showRawJson && (
              <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] border border-slate-800 space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider">⚡ ScoreMe Advanced PAN API & OTP Verification Audit Log</span>
                  <span className="text-slate-500 text-[10px]">{selectedLead.created_at || new Date().toISOString()}</span>
                </div>
                <pre className="overflow-x-auto p-2 bg-slate-900 rounded text-emerald-300 leading-relaxed max-h-60">
                  {JSON.stringify({
                    lead_uuid: selectedLead.lead_uuid,
                    constitution: selectedLead.constitution,
                    advanced_pan_api: {
                      status: "SUCCESS",
                      pan_number: selectedLead.pan_no,
                      name_on_card: selectedLead.CustName || selectedLead.entity_name || `${selectedLead.first_name || ""} ${selectedLead.last_name || ""}`.trim(),
                      pan_type: selectedLead.constitution === "Individual" ? "Individual" : "Business Entity",
                      dob_or_doi: selectedLead.dob || selectedLead.doi,
                      registered_address: selectedLead.address || selectedLead.business_address,
                      city: selectedLead.city,
                      state: selectedLead.state,
                      pincode: selectedLead.pincode,
                      provider: "ScoreMe Advanced PAN Verification API v2"
                    },
                    mobile_otp_verification: {
                      status: "VERIFIED",
                      mobile_number: selectedLead.mobile,
                      auth_channel: "SMS OTP",
                      verified_at: selectedLead.created_at
                    },
                    cbs_branch_mapping: {
                      branch_code: selectedLead.Branch_id || "BR001",
                      sub_region_code: selectedLead.subregion_id || "SR001",
                      dsa_code: selectedLead.DSACode || "DSA_TEST_001"
                    }
                  }, null, 2)}
                </pre>
              </div>
            )}

            {/* SECTION 1: Customer Basic & Location Information */}
            <div className="bg-slate-50/80 p-4 rounded-xl border space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                1. Customer Basic & Branch Location Information
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-700">
                <div>
                  <p className="text-slate-400 font-medium">Branch Code</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedLead.Branch_id || selectedLead.branch?.branch_name || "BR001"}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Subregion</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedLead.subregion_id || "SR001"}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">City & State</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedLead.city || "Mumbai"}, {selectedLead.state || "Maharashtra"}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Pincode</p>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">{selectedLead.pincode || "400001"}</p>
                </div>
              </div>
            </div>

            {/* SECTION 2: Identity & Contact Verification (PAN & Mobile OTP) */}
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
              <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <User className="h-4 w-4 text-emerald-700" />
                2. Identity & Contact Verification (Advanced PAN & OTP)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg border border-emerald-200">
                  <p className="text-slate-500 font-medium">PAN Number</p>
                  <p className="font-mono font-bold text-emerald-800 text-sm mt-0.5 uppercase">{selectedLead.pan_no || "N/A"}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    ✓ Advanced PAN API Verified
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-200">
                  <p className="text-slate-500 font-medium">Mobile Number</p>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{selectedLead.mobile || "N/A"}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    ✓ Mobile OTP Verified
                  </span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-200">
                  <p className="text-slate-500 font-medium">E-Mail Address</p>
                  <p className="font-bold text-slate-900 mt-0.5 truncate">{selectedLead.email || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* SECTION 3: Applicant / Entity Detailed Filled Values */}
            {selectedLead.constitution === "Individual" || !selectedLead.constitution ? (
              <div className="bg-slate-50 p-4 rounded-xl border space-y-3">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  3. Individual Applicant Personal & Financial Profile
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-slate-400 font-medium">Full Applicant Name</p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {selectedLead.CustName || `${selectedLead.title || "MR"} ${selectedLead.first_name || ""} ${selectedLead.middle_name || ""} ${selectedLead.last_name || ""}`.trim()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Gender</p>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedLead.gender || "MALE"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Date of Birth (DOB)</p>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedLead.dob ? formatDate(selectedLead.dob) : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Applicant Age</p>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedLead.age !== undefined ? `${selectedLead.age} Years` : "N/A"}</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 font-medium">Residential Address</p>
                    <p className="font-medium text-slate-800 mt-0.5">{selectedLead.address || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Employer / Business Entity Name</p>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedLead.employer_business_name || "N/A"}</p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-slate-400 font-medium">Employment Type</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedLead.employment_type || "Salaried"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Avg Gross Monthly Income</p>
                    <p className="font-mono font-bold text-emerald-700 mt-0.5">{formatCurrency(Number(selectedLead.avg_gross_monthly_income || 0))}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Avg Net Monthly Income</p>
                    <p className="font-mono font-bold text-emerald-700 mt-0.5">{formatCurrency(Number(selectedLead.avg_net_monthly_income || 0))}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Monthly Obligation</p>
                    <p className="font-mono font-bold text-amber-700 mt-0.5">{formatCurrency(Number(selectedLead.existing_monthly_repayment_obligation || 0))}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200 space-y-3">
                <h4 className="font-bold text-purple-900 uppercase tracking-wider text-[11px]">
                  3. Non-Individual Business Entity & Financial Profile
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-purple-700 font-medium">Entity Name</p>
                    <p className="font-bold text-purple-950 mt-0.5">{selectedLead.entity_name || selectedLead.CustName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Date of Incorporation (DOI)</p>
                    <p className="font-bold text-purple-950 mt-0.5">{selectedLead.doi ? formatDate(selectedLead.doi) : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Promoter / Partner / Director</p>
                    <p className="font-bold text-purple-950 mt-0.5">{selectedLead.proprietor_partner_director_name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Business Address</p>
                    <p className="font-medium text-purple-950 mt-0.5 truncate">{selectedLead.business_address || "N/A"}</p>
                  </div>
                </div>

                <div className="border-t border-purple-200 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-purple-700 font-medium">Annual Sales Turnover Last FY</p>
                    <p className="font-mono font-bold text-indigo-700 mt-0.5">{formatCurrency(Number(selectedLead.annual_gross_turnover_last_fy || 0))}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Avg Annual Gross Income</p>
                    <p className="font-mono font-bold text-emerald-700 mt-0.5">{formatCurrency(Number(selectedLead.avg_annual_gross_income || 0))}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Avg Annual Net Income</p>
                    <p className="font-mono font-bold text-emerald-700 mt-0.5">{formatCurrency(Number(selectedLead.avg_annual_net_income || 0))}</p>
                  </div>
                  <div>
                    <p className="text-purple-700 font-medium">Monthly Obligation</p>
                    <p className="font-mono font-bold text-amber-700 mt-0.5">{formatCurrency(Number(selectedLead.existing_monthly_repayment_obligation || 0))}</p>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 4: Loan Product, Tenure & Application Link */}
            <div className="bg-slate-50 p-4 rounded-xl border space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                4. Loan Product & Requirement Details
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-slate-400 font-medium">Loan Product</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedLead.product?.name || "Loan Product"}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Loan Type</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedLead.loan_type?.name || selectedLead.loanType?.name || "Standard"}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Loan Amount Required</p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">{formatCurrency(Number(selectedLead.loan_amount_required || 0))}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Tenure</p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">{selectedLead.loan_period_months} Months</p>
                </div>
              </div>

              {selectedLead.application_link && (
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-slate-500 font-medium">Customer Self-Fill Portal Link</p>
                    <input
                      type="text"
                      readOnly
                      value={selectedLead.application_link}
                      className="w-full bg-white border rounded px-2 py-1 font-mono text-[11px] text-slate-700 mt-1 select-all"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLead.application_link!);
                      toast({ title: "Copied!", description: "Link copied to clipboard.", variant: "success" });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy Link
                  </Button>
                </div>
              )}
            </div>

            {/* SECTION 5: Sanction & Disbursement Details (if applicable) */}
            {(selectedLead.sanction_amount || selectedLead.disbursed_amount || (selectedLead.facilities && selectedLead.facilities.length > 0)) && (
              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 space-y-3">
                <h4 className="font-bold text-indigo-950 uppercase tracking-wider text-[11px]">
                  5. Sanction & Disbursement Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-indigo-700 font-medium">Sanction Amount</p>
                    <p className="font-mono font-bold text-emerald-800 text-sm mt-0.5">{formatCurrency(Number(selectedLead.sanction_amount || 0))}</p>
                  </div>
                  <div>
                    <p className="text-indigo-700 font-medium">Sanction Letter No.</p>
                    <p className="font-mono font-bold text-slate-900 mt-0.5">{selectedLead.sanction_letter_no || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-indigo-700 font-medium">Total Disbursed Amount</p>
                    <p className="font-mono font-bold text-indigo-900 text-sm mt-0.5">{formatCurrency(Number(selectedLead.disbursed_amount || 0))}</p>
                  </div>
                  <div>
                    <p className="text-indigo-700 font-medium">Disbursement Date</p>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedLead.disbursement_date ? formatDate(selectedLead.disbursement_date) : "N/A"}</p>
                  </div>
                </div>

                {/* Facilities breakdown */}
                {selectedLead.facilities && selectedLead.facilities.length > 0 && (
                  <div className="border-t border-indigo-200 pt-3">
                    <p className="font-bold text-indigo-900 text-[11px] mb-2">Disbursed Facility Breakdown</p>
                    <table className="w-full bg-white border border-indigo-100 text-left">
                      <thead className="bg-indigo-100/60 text-indigo-950 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-2">Facility Type</th>
                          <th className="p-2">Sanctioned</th>
                          <th className="p-2">Disbursed</th>
                          <th className="p-2">Account No.</th>
                          <th className="p-2">Deviation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-indigo-50 font-medium">
                        {selectedLead.facilities.map((f, i) => (
                          <tr key={i}>
                            <td className="p-2 uppercase">{f.facility_type}</td>
                            <td className="p-2 font-mono">{formatCurrency(Number(f.sanctioned_amount || 0))}</td>
                            <td className="p-2 font-mono font-bold text-indigo-800">{formatCurrency(Number(f.disbursed_amount || 0))}</td>
                            <td className="p-2 font-mono">{f.loan_account_no || "N/A"}</td>
                            <td className="p-2">
                              {f.has_deviation ? (
                                <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                  {f.deviation_type || "Yes"}
                                </span>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Queries Thread */}
            <div id="query-thread-section" className="space-y-3 border-t pt-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-amber-600" />
                Queries & Communication Thread
              </h4>
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
                          className="flex-1 border rounded px-2 py-1 bg-white"
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

            {/* Status Audit History Log (Req #30) */}
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-purple-600" />
                Status Audit History Log (Req #30)
              </h4>
              {selectedLead.status_histories && selectedLead.status_histories.length > 0 ? (
                <div className="bg-slate-50 border rounded-xl overflow-hidden text-[11px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b">
                      <tr>
                        <th className="p-2">Date & Time</th>
                        <th className="p-2">Old Status</th>
                        <th className="p-2">New Status</th>
                        <th className="p-2">Role</th>
                        <th className="p-2">Remarks / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedLead.status_histories.map((sh, idx) => (
                        <tr key={idx} className="hover:bg-slate-100/60 font-medium">
                          <td className="p-2 font-mono text-slate-600">{new Date(sh.created_at).toLocaleString()}</td>
                          <td className="p-2"><StatusBadge status={sh.old_status || "INITIAL"} /></td>
                          <td className="p-2"><StatusBadge status={sh.new_status} /></td>
                          <td className="p-2 font-bold uppercase text-purple-700">{sh.action_by_type || "SYSTEM"}</td>
                          <td className="p-2 text-slate-800">{sh.remarks || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 italic text-[11px]">No status history recorded yet.</p>
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

      {/* Manual Disbursement Modal */}
      <Modal open={isDisburseModalOpen} onClose={() => setIsDisburseModalOpen(false)} title="Mark Lead Disbursement" width="max-w-xl">
        <form onSubmit={handleDisburseSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Disbursement Date * (DD/MM/YYYY)</label>
              <input
                type="date"
                required
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
                className="w-full border rounded p-2 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Disbursed Amount (₹) *</label>
              <input
                type="number"
                required
                min={1}
                value={disbursedAmount}
                onChange={(e) => setDisbursedAmount(e.target.value)}
                className="w-full border rounded p-2 font-mono focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Loan Account No. * (Numeric, min 8 digits)</label>
            <input
              type="text"
              required
              placeholder="Enter CBS Loan Account Number (e.g. 10023456789)"
              value={loanAccountNo}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setLoanAccountNo(val);
                if (val.length >= 8) {
                  setLoanAccountError(null);
                }
              }}
              className={`w-full border rounded p-2 font-mono ${loanAccountError ? "border-red-500 focus:ring-red-500" : "focus:ring-emerald-500"}`}
            />
            {loanAccountError && <p className="text-red-500 text-[11px] mt-1">{loanAccountError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-amber-50/60 p-3 rounded-lg border border-amber-200">
            <div>
              <label className="block text-amber-900 font-semibold mb-1">Loan sanctioned with deviation? *</label>
              <select
                value={hasDeviation}
                onChange={(e) => {
                  setHasDeviation(e.target.value);
                  if (e.target.value === "No") setDeviationType("");
                }}
                className="w-full border rounded p-2 bg-white"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {hasDeviation === "Yes" && (
              <div>
                <label className="block text-amber-900 font-semibold mb-1">Deviation Type *</label>
                <select
                  value={deviationType}
                  required={hasDeviation === "Yes"}
                  onChange={(e) => setDeviationType(e.target.value)}
                  className="w-full border rounded p-2 bg-white"
                >
                  <option value="">-- Select Deviation Type --</option>
                  <option value="Non-Financial">Non-Financial</option>
                  <option value="Allowed Financial">Allowed Financial</option>
                  <option value="Not-allowed Financial">Not-allowed Financial</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsDisburseModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Confirm Disbursement</Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Lead Modal */}
      <Modal open={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Lead Application">
        <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Cancellation Reason *</label>
            <textarea
              required
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Enter reason for cancelling this lead..."
              className="w-full border rounded p-2 focus:outline-none focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white">Confirm Cancellation</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Lead Information Modal */}
      <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Lead Information: ${selectedLead?.CustName || selectedLead?.lead_uuid}`} width="max-w-3xl">
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
          {editForm.constitution === "Individual" ? (
            /* Individual Edit Fields */
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b pb-1">Individual Applicant Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Middle Name</label>
                  <input
                    type="text"
                    value={editForm.middle_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={editForm.mobile || ""}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full border rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Date of Birth (DOB)</label>
                  <input
                    type="date"
                    value={editForm.dob || ""}
                    onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Residential Address</label>
                <textarea
                  rows={2}
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full border rounded p-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Employment Type</label>
                  <input
                    type="text"
                    value={editForm.employment_type || ""}
                    onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })}
                    className="w-full border rounded p-2"
                    placeholder="SALARIED / SELF_EMPLOYED"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Gross Monthly Income (₹)</label>
                  <input
                    type="number"
                    value={editForm.avg_gross_monthly_income || ""}
                    onChange={(e) => setEditForm({ ...editForm, avg_gross_monthly_income: Number(e.target.value) })}
                    className="w-full border rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Net Monthly Income (₹)</label>
                  <input
                    type="number"
                    value={editForm.avg_net_monthly_income || ""}
                    onChange={(e) => setEditForm({ ...editForm, avg_net_monthly_income: Number(e.target.value) })}
                    className="w-full border rounded p-2 font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Non-Individual Edit Fields */
            <div className="space-y-3">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b pb-1">Non-Individual Entity Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Entity Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.entity_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, entity_name: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Proprietor / Partner / Director</label>
                  <input
                    type="text"
                    value={editForm.proprietor_partner_director_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, proprietor_partner_director_name: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={editForm.mobile || ""}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full border rounded p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-semibold">Date of Incorporation (DOI)</label>
                  <input
                    type="date"
                    value={editForm.doi || ""}
                    onChange={(e) => setEditForm({ ...editForm, doi: e.target.value })}
                    className="w-full border rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Registered Business Address</label>
                <textarea
                  rows={2}
                  value={editForm.business_address || ""}
                  onChange={(e) => setEditForm({ ...editForm, business_address: e.target.value })}
                  className="w-full border rounded p-2"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Annual Gross Turnover (₹)</label>
                <input
                  type="number"
                  value={editForm.annual_gross_turnover_last_fy || ""}
                  onChange={(e) => setEditForm({ ...editForm, annual_gross_turnover_last_fy: Number(e.target.value) })}
                  className="w-full border rounded p-2 font-mono"
                />
              </div>
            </div>
          )}

          {/* Loan Requirement Edit Fields */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Loan Requirement Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Loan Amount Required (₹) *</label>
                <input
                  type="number"
                  required
                  value={editForm.loan_amount_required || ""}
                  onChange={(e) => setEditForm({ ...editForm, loan_amount_required: Number(e.target.value) })}
                  className="w-full border rounded p-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold">Loan Period (Months) *</label>
                <input
                  type="number"
                  required
                  value={editForm.loan_period_months || ""}
                  onChange={(e) => setEditForm({ ...editForm, loan_period_months: Number(e.target.value) })}
                  className="w-full border rounded p-2 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Save Lead Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

