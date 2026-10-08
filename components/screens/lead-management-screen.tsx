"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
  ChevronDown,
  X,
  AlertTriangle,
  MoreHorizontal,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  ArrowUpDown,
  ExternalLink,
  Link2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  ChevronRight,
  ChevronLeft,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Briefcase,
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
import { fetchLoanProducts, fetchLoanTypesByProduct, getMasterValues, verifyPanAdvance, fetchBranchesDropdown, fetchDsasDropdown } from "@/apis/admin";
import { PageHeader } from "@/components/module";
import { Button, Card, CardContent, CardHeader, Modal, StatusBadge, Tabs, Input, Select, Label } from "@/components/ui/primitives";
import { useMockStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate, parseDobToIso, calculateAgeFromDob, cn, formatStatusLabel } from "@/lib/utils";
import { getLoanPurposeOptionsFromApi } from "@/lib/loan-purpose";

function SearchableDsaSelect({
  dsaList,
  selectedCode,
  onSelect,
  onOpenChange,
}: {
  dsaList: any[];
  selectedCode: string;
  onSelect: (code: string) => void;
  onOpenChange?: (isOpen: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedDsa = dsaList.find((d) => d.dsa_code === selectedCode);

  const filteredList = dsaList.filter((dsa) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (dsa.dsa_code || "").toLowerCase().includes(q) ||
      (dsa.name || "").toLowerCase().includes(q) ||
      (dsa.label || "").toLowerCase().includes(q) ||
      (dsa.mobile || "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onOpenChange]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          onOpenChange?.(next);
        }}
        className={`w-full h-10 border rounded-lg px-3.5 text-sm font-medium cursor-pointer transition-all flex items-center justify-between bg-white shadow-2xs ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
            : selectedCode
            ? "border-blue-400 text-slate-900 bg-blue-50/20 font-bold"
            : "border-slate-200 text-slate-500 hover:border-slate-300"
        }`}
      >
        <span className="truncate">
          {selectedDsa
            ? selectedDsa.label || `${selectedDsa.name} (${selectedDsa.dsa_code})`
            : "-- Search / Select DSA Partner --"}
        </span>
        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {selectedCode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect("");
              }}
              className="p-0.5 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-blue-600" : ""}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200/90 rounded-2xl shadow-xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-blue-500" />
            <input
              type="text"
              autoFocus
              placeholder="Search by DSA Code, Name, or Mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 divide-y divide-slate-100/60 pr-1">
            {filteredList.length === 0 ? (
              <div className="p-3 text-center text-slate-400 text-[11px] font-medium">
                No matching DSA partner found
              </div>
            ) : (
              filteredList.map((dsa) => {
                const isSelected = dsa.dsa_code === selectedCode;
                return (
                  <div
                    key={dsa.id || dsa.dsa_code}
                    onClick={() => {
                      onSelect(dsa.dsa_code);
                      setIsOpen(false);
                      setSearchQuery("");
                      onOpenChange?.(false);
                    }}
                    className={`p-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-bold border border-blue-200/80"
                        : "hover:bg-slate-50 text-slate-800 font-medium"
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-900">{dsa.name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">{dsa.dsa_code}</span>
                        {dsa.mobile && <span>📱 {dsa.mobile}</span>}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadDetailItem({
  label,
  value,
  className,
  subvalue,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  subvalue?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-slate-50/70 border border-slate-200/70 px-3.5 py-2.5 transition-colors hover:bg-slate-50/90",
        className
      )}
    >
      <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </p>
      <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-900 break-words leading-relaxed">
        {value || "—"}
      </div>
      {subvalue && <div className="mt-1">{subvalue}</div>}
    </div>
  );
}

function LeadSectionBlock({
  icon: Icon,
  iconColor = "text-blue-600",
  iconBg = "bg-blue-50 border-blue-200/80",
  title,
  action,
  children,
  className,
}: {
  icon?: any;
  iconColor?: string;
  iconBg?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-3.5", className)}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className={cn("p-1.5 rounded-lg border flex items-center justify-center shrink-0", iconBg, iconColor)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {title}
          </h4>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

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
  const [applicationNoFilter, setApplicationNoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");

  // Pagination state (default 10)
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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
  const [submittingLead, setSubmittingLead] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);
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

  // Confirmation Modal state for branch user status actions
  const [confirmActionModal, setConfirmActionModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: "blue" | "emerald" | "red" | "amber";
    onConfirm: () => void;
  } | null>(null);

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = "Yes, Proceed",
    variant: "blue" | "emerald" | "red" | "amber" = "blue"
  ) => {
    setConfirmActionModal({
      open: true,
      title,
      message,
      confirmLabel,
      variant,
      onConfirm,
    });
  };

  const [showRawJson, setShowRawJson] = useState(false);

  // Form states
  const [shareableUrl, setShareableUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedShareDsaCode, setSelectedShareDsaCode] = useState<string>("");
  const [selectedShareProductId, setSelectedShareProductId] = useState<number | undefined>(undefined);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Master Data
  const [products, setProducts] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [occupationTypes, setOccupationTypes] = useState<any[]>([]);
  const [activeOccupationTypes, setActiveOccupationTypes] = useState<any[]>([]);
  const [deviationTypes, setDeviationTypes] = useState<any[]>([]);
  const [loanPurposes, setLoanPurposes] = useState<any[]>([]);
  const [dsaList, setDsaList] = useState<any[]>([]);
  const [constitutions, setConstitutions] = useState<any[]>([]);

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
    DSACode: "",
    dsa_code: "",
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
    loan_purpose: "",
    loan_amount_required: 0,
    loan_period_months: 0,
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

  // Separate static master data loading (fetches ONCE)
  const [masterLoaded, setMasterLoaded] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);

  const loadStaticMasterData = async () => {
    if (masterLoaded || masterLoading) return;
    try {
      setMasterLoading(true);
      const [prodRes, branchRes, titleRes, genderRes, empRes, occRes, devRes, purpRes, dsaRes, constRes] = await Promise.all([
        fetchLoanProducts(),
        fetchBranchesDropdown(),
        getMasterValues({ group: "title" }),
        getMasterValues({ group: "gender" }),
        getMasterValues({ group: "employment_type" }),
        getMasterValues({ group: "occupation_type" }),
        getMasterValues({ group: "deviation_type" }),
        getMasterValues({ group: "loan_purpose" }),
        fetchDsasDropdown(),
        getMasterValues({ group: "constitution" }),
      ]);

      const prods = prodRes?.data?.data || prodRes?.data || prodRes || [];
      setProducts(Array.isArray(prods) ? prods : []);

      const branchItems = branchRes?.data || branchRes || [];
      setBranches(Array.isArray(branchItems) ? branchItems : []);

      setTitles(Array.isArray(titleRes?.data || titleRes) ? (titleRes?.data || titleRes) : []);
      setGenders(Array.isArray(genderRes?.data || genderRes) ? (genderRes?.data || genderRes) : []);
      setEmploymentTypes(Array.isArray(empRes?.data || empRes) ? (empRes?.data || empRes) : []);
      setOccupationTypes(Array.isArray(occRes?.data || occRes) ? (occRes?.data || occRes) : []);
      setDeviationTypes(Array.isArray(devRes?.data || devRes) ? (devRes?.data || devRes) : []);
      setLoanPurposes(Array.isArray(purpRes?.data || purpRes) ? (purpRes?.data || purpRes) : []);

      const dsaItems = dsaRes?.data || dsaRes || [];
      setDsaList(Array.isArray(dsaItems) ? dsaItems : []);

      const constItems = constRes?.data || constRes || [];
      setConstitutions(Array.isArray(constItems) ? constItems : []);

      setMasterLoaded(true);
    } catch (err) {
      console.error("Failed to load static master data:", err);
    } finally {
      setMasterLoading(false);
    }
  };

  // Fast Lead Data Loader (fetches ONLY active view data on pagination, filters & tab changes)
  const loadLeadDataOnly = async (page = currentPage, limit = perPage) => {
    try {
      setLoading(true);
      const queryParams: Record<string, any> = {
        page: page,
        per_page: limit,
      };

      if (search.trim()) queryParams.search = search.trim();
      if (applicationNoFilter.trim()) queryParams.application_no = applicationNoFilter.trim();
      if (statusFilter && statusFilter !== "ALL") queryParams.status = statusFilter;
      if (fromDateFilter) queryParams.from_date = fromDateFilter;
      if (toDateFilter) queryParams.to_date = toDateFilter;

      if (activeTab === "maker-queue" && isBankUser) {
        const makerRes = await fetchMakerQueue(queryParams);
        const mqItems = makerRes?.data?.items || [];
        setMakerQueue(mqItems);
      } else {
        const leadsRes = await fetchLeads(queryParams);
        const items = leadsRes?.data?.items || [];
        setLeads(items);

        if (leadsRes?.data?.pagination) {
          setTotalLeadsCount(leadsRes.data.pagination.total || items.length);
          setTotalPages(leadsRes.data.pagination.total_pages || 1);
        } else {
          setTotalLeadsCount(items.length);
          setTotalPages(1);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch lead data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setApplicationNoFilter("");
    setStatusFilter("ALL");
    setFromDateFilter("");
    setToDateFilter("");
    setCurrentPage(1);
    loadLeadDataOnly(1, perPage);
  };
const setFilters = (newFilters: {
    fromDate: string;
    toDate: string;
    applicationNo: string;
    status: string;
    search: string;
  }) => {
    setFromDateFilter(newFilters.fromDate);
    setToDateFilter(newFilters.toDate);
    setApplicationNoFilter(newFilters.applicationNo);
    setStatusFilter(newFilters.status);
    setSearch(newFilters.search);
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
        setOtpMessage(`OTP sent!`);
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
          formattedDate = parseDobToIso(String(rawDob));
        }
        const calculatedAge = calculateAgeFromDob(formattedDate);

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
          age: calculatedAge ?? calculateAgeFromDob(prev.dob),
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

  // Lazy load master dropdown data ONCE when Create, Edit, Disburse, or Share modal opens
  useEffect(() => {
    if (isCreateModalOpen || isEditModalOpen || isDisburseModalOpen || isShareModalOpen) {
      loadStaticMasterData();
    }
  }, [isCreateModalOpen, isEditModalOpen, isDisburseModalOpen, isShareModalOpen]);

  // Load leads data on pagination, filter, or tab change
  useEffect(() => {
    loadLeadDataOnly(currentPage, perPage);
  }, [currentPage, perPage, activeTab]);

  // Dynamically load mapped occupation types whenever employment_type changes
  useEffect(() => {
    const empType = createForm.employment_type;
    if (!empType) {
      setActiveOccupationTypes([]);
      if (createForm.occupation_type) {
        setCreateForm((prev) => ({ ...prev, occupation_type: "" }));
      }
      return;
    }

    getMasterValues({ group: "occupation_type", employment_type: empType })
      .then((res) => {
        const list = Array.isArray(res?.data || res) ? (res?.data || res) : [];
        setActiveOccupationTypes(list);
        setCreateForm((prev) => {
          if (!prev.occupation_type) return prev;
          const match = list.some((item: any) => item.meta_key === prev.occupation_type || item.meta_value === prev.occupation_type);
          return match ? prev : { ...prev, occupation_type: "" };
        });
      })
      .catch((err) => {
        console.error("Failed to fetch mapped occupations:", err);
      });
  }, [createForm.employment_type]);

  // Synchronize calculated age whenever createForm.dob changes
  useEffect(() => {
    const computedAge = calculateAgeFromDob(createForm.dob);
    setCreateForm((prev) => {
      if (prev.age === computedAge) return prev;
      return { ...prev, age: computedAge };
    });
  }, [createForm.dob]);

  const handleProductChange = async (productId: number) => {
    const pid = productId ? Number(productId) : undefined;
    setCreateForm((prev) => ({ ...prev, loan_product_id: pid, loan_type_id: undefined }));
    if (!pid) {
      setLoanTypes([]);
      return;
    }
    try {
      const res = await fetchLoanTypesByProduct(pid);
      const types = res?.data || res || [];
      setLoanTypes(Array.isArray(types) ? types : []);
    } catch (err) {
      console.error("Failed to fetch loan types", err);
    }
  };

  const handleCreateLead = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBankUser && !((createForm as any).DSACode || (createForm as any).dsa_code)) {
      toast({ title: "Validation Error", description: "Please select a DSA Partner / DSA Code", variant: "error" });
      return;
    }
    if (!createForm.Branch_id) {
      toast({ title: "Validation Error", description: "Please select a branch location", variant: "error" });
      return;
    }
    if (!createForm.pincode || (createForm.pincode || "").length !== 6) {
      toast({ title: "Validation Error", description: "Please enter a valid 6-digit Pincode", variant: "error" });
      return;
    }
    if (!createForm.pan_no || (createForm.pan_no || "").length !== 10) {
      toast({ title: "Validation Error", description: "Please enter a valid 10-character PAN number", variant: "error" });
      return;
    }
    if (!createForm.mobile || (createForm.mobile || "").length !== 10) {
      toast({ title: "Validation Error", description: "Please enter a valid 10-digit mobile number", variant: "error" });
      return;
    }
    if (createForm.constitution === "Individual") {
      if (!createForm.first_name?.trim()) {
        toast({ title: "Validation Error", description: "Please enter applicant first name", variant: "error" });
        return;
      }
      if (!createForm.last_name?.trim()) {
        toast({ title: "Validation Error", description: "Please enter applicant last name", variant: "error" });
        return;
      }
      if (!createForm.dob) {
        toast({ title: "Validation Error", description: "Please select date of birth", variant: "error" });
        return;
      }
      if (!createForm.address?.trim()) {
        toast({ title: "Validation Error", description: "Please enter residential address", variant: "error" });
        return;
      }
      if (!createForm.employment_type) {
        toast({ title: "Validation Error", description: "Please select employment type", variant: "error" });
        return;
      }
    } else {
      if (!createForm.entity_name?.trim()) {
        toast({ title: "Validation Error", description: "Please enter legal entity name", variant: "error" });
        return;
      }
      if (!createForm.doi) {
        toast({ title: "Validation Error", description: "Please enter date of incorporation", variant: "error" });
        return;
      }
      if (!createForm.business_address?.trim()) {
        toast({ title: "Validation Error", description: "Please enter registered business address", variant: "error" });
        return;
      }
    }
    if (!createForm.loan_product_id || !createForm.loan_type_id) {
      toast({ title: "Validation Error", description: "Please select Loan Product & Type", variant: "error" });
      return;
    }
    if (!createForm.loan_purpose) {
      toast({ title: "Validation Error", description: "Please select loan purpose", variant: "error" });
      return;
    }
    if (!createForm.loan_amount_required || Number(createForm.loan_amount_required) < 1000) {
      toast({ title: "Validation Error", description: "Please enter valid loan amount (min ₹1,000)", variant: "error" });
      return;
    }

    try {
      setSubmittingLead(true);
      const res = await createLead(createForm as LeadData);
      if (res?.status === "success") {
        toast({ title: "Success", description: "Lead created successfully", variant: "success" });
        setIsCreateModalOpen(false);
        loadLeadDataOnly();
      }
    } catch (err: any) {
      const serverData = err?.response?.data;
      let errorMsg = serverData?.message || err?.message || "Failed to submit lead.";
      if (serverData?.errors && typeof serverData.errors === 'object') {
        const fieldErrors = Object.values(serverData.errors).flat().join(" ");
        if (fieldErrors) {
          errorMsg = `${errorMsg} ${fieldErrors}`;
        }
      }
      toast({ title: "Error", description: errorMsg, variant: "error" });
    } finally {
      setSubmittingLead(false);
    }
  };

  const handleOpenShareModal = () => {
    setShareableUrl(null);
    setSelectedShareDsaCode("");
    setSelectedShareProductId(undefined);
    setIsShareModalOpen(true);
    loadStaticMasterData();
  };

  const handleGenerateLink = async (dsaCodeToUse?: string) => {
    const code = dsaCodeToUse || selectedShareDsaCode;
    if (isBankUser && !code) {
      toast({ title: "Validation Error", description: "Please select a DSA Partner / DSA Code", variant: "error" });
      return;
    }

    try {
      setGeneratingLink(true);
      const params: any = {};
      if (code) params.dsa_code = code;
      if (selectedShareProductId) params.loan_product_id = selectedShareProductId;
      const res = await generateShareableToken(Object.keys(params).length > 0 ? params : undefined);
      if (res?.status === "success") {
        setShareableUrl(res.data.shareable_url);
        setIsShareModalOpen(true);
      } else {
        toast({ title: "Error", description: res?.message || "Failed to generate link", variant: "error" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.response?.data?.message || err?.message || "Failed to generate link", variant: "error" });
    } finally {
      setGeneratingLink(false);
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

  const executeForwardToChecker = async (leadId: number | string) => {
    try {
      const res = await forwardToChecker(leadId, "Maker verified details");
      if (res?.status === "success") {
        toast({ title: "Success", description: "Lead forwarded to Checker", variant: "success" });
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to forward lead", variant: "error" });
    }
  };

  const handleForwardToChecker = (leadId: number | string) => {
    confirmAction(
      "Forward Lead to Checker",
      "Do you want to perform this action? Forward this lead to Bank Checker for approval?",
      () => executeForwardToChecker(leadId),
      "Yes, Forward Lead",
      "blue"
    );
  };

  const handleRaiseQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !queryText) return;
    confirmAction(
      "Raise Query on Lead",
      `Do you want to perform this action? Raise ${queryType} query on application ${selectedLead.application_id || selectedLead.lead_uuid}?`,
      async () => {
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
      },
      "Yes, Submit Query",
      "amber"
    );
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

  const executeSanctionSubmit = async () => {
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
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleSanctionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    confirmAction(
      "Sanction Lead Application",
      `Do you want to perform this action? Sanction loan amount of ₹${sanctionAmount.toLocaleString("en-IN")} for lead ${selectedLead.application_id || selectedLead.lead_uuid}?`,
      executeSanctionSubmit,
      "Yes, Sanction Lead",
      "emerald"
    );
  };

  const executeRejectSubmit = async () => {
    if (!selectedLead || !rejectionReason) return;
    try {
      const res = await rejectLead(selectedLead.id!, rejectionReason);
      if (res?.status === "success") {
        toast({ title: "Success", description: "Lead rejected", variant: "success" });
        setIsRejectModalOpen(false);
        setRejectionReason("");
        handleViewDetail(selectedLead.id!);
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !rejectionReason) return;
    confirmAction(
      "Reject Lead Application",
      `Do you want to perform this action? Reject lead ${selectedLead.application_id || selectedLead.lead_uuid}?`,
      executeRejectSubmit,
      "Yes, Reject Lead",
      "red"
    );
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

  const executeDisburseSubmit = async () => {
    if (!selectedLead) return;
    try {
      const res = await disburseLead(selectedLead.id!, {
        disbursed_amount: Number(disbursedAmount),
        disbursement_date: disbursementDate,
        loan_account_no: loanAccountNo.trim(),
        has_deviation: hasDeviation === "Yes",
        deviation_type: hasDeviation === "Yes" ? deviationType : null,
      });
      if (res?.status === "success") {
        toast({ title: "Success", description: "Loan disbursed successfully", variant: "success" });
        setIsDisburseModalOpen(false);
        handleViewDetail(selectedLead.id!);
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleDisburseSubmit = (e: React.FormEvent) => {
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

    confirmAction(
      "Confirm Loan Disbursement",
      `Do you want to perform this action? Mark lead as Disbursed with Loan Account No. ${acct}?`,
      executeDisburseSubmit,
      "Yes, Confirm Disbursement",
      "emerald"
    );
  };

  const executeProcessLead = async (leadId: number) => {
    try {
      const res = await forwardToChecker(leadId, "Processed by Bank Maker");
      if (res?.status === "success") {
        toast({ title: "Lead Processed", description: "Lead transitioned to IN_PROCESS status.", variant: "success" });
        handleViewDetail(leadId);
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleProcessLead = (leadId: number) => {
    confirmAction(
      "Process Lead Application",
      "Do you want to perform this action? Transition lead status to IN_PROCESS?",
      () => executeProcessLead(leadId),
      "Yes, Process Lead",
      "blue"
    );
  };

  const executeCancelSubmit = async () => {
    if (!selectedLead || !cancellationReason) return;
    try {
      const res = await cancelLead(selectedLead.id!, cancellationReason);
      if (res?.status === "success") {
        toast({ title: "Lead Cancelled", description: "Lead status updated to CANCELLED.", variant: "success" });
        setIsCancelModalOpen(false);
        setCancellationReason("");
        handleViewDetail(selectedLead.id!);
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !cancellationReason) return;
    confirmAction(
      "Cancel Lead Application",
      `Do you want to perform this action? Cancel lead ${selectedLead.application_id || selectedLead.lead_uuid}?`,
      executeCancelSubmit,
      "Yes, Cancel Lead",
      "red"
    );
  };

  const executeUpdateStatusSubmit = async () => {
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
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  const handleUpdateStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !targetStatus) return;
    confirmAction(
      "Update Lead Status",
      `Do you want to perform this action? Update status of lead ${selectedLead.application_id || selectedLead.lead_uuid} to ${targetStatus}?`,
      executeUpdateStatusSubmit,
      "Yes, Update Status",
      "blue"
    );
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
      dob: parseDobToIso(lead.dob || (lead as any).date_of_birth),
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
      doi: parseDobToIso(lead.doi || (lead as any).date_of_incorporation),
      business_address: lead.business_address || "",
      proprietor_partner_director_name: lead.proprietor_partner_director_name || "",
      annual_gross_turnover_last_fy: lead.annual_gross_turnover_last_fy,
      loan_product_id: lead.loan_product_id,
      loan_type_id: lead.loan_type_id || lead.loan_scheme_id,
      loan_purpose: lead.loan_purpose || "",
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
        loadLeadDataOnly();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Lead Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track, manage, and process loan lead applications</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenShareModal} variant="outline" type="button" className="gap-2">
            <Share2 className="h-4 w-4 text-emerald-600" />
            <span>Customer Link</span>
          </Button>
          <Button
            onClick={() => {
              setIsCreateModalOpen(true);
              loadStaticMasterData();
            }}
            type="button"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Lead</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {reports && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Leads"
            value={reports.total_leads || 0}
            icon={<Layers className="h-5 w-5" />}
            iconBg="bg-blue-500/10 text-blue-500"
            trend={reports.total_leads > 0 ? "+12% vs last month" : null}
          />
          <KpiCard
            label={isBankUser ? "Maker Queue" : "My Leads"}
            value={isBankUser ? makerQueue.length : reports.total_leads || 0}
            icon={<FileCheck className="h-5 w-5" />}
            iconBg="bg-amber-500/10 text-amber-500"
            trend={isBankUser && makerQueue.length > 0 ? `${makerQueue.length} pending review` : null}
          />
          <KpiCard
            label="Sanctioned"
            value={leads.filter((l) => l.status === "SANCTIONED").length}
            icon={<Banknote className="h-5 w-5" />}
            iconBg="bg-emerald-500/10 text-emerald-500"
            trend="+8% vs last month"
          />
          <KpiCard
            label="Disbursed"
            value={leads.filter((l) => l.status === "DISBURSED").length}
            icon={<CheckCircle2 className="h-5 w-5" />}
            iconBg="bg-indigo-500/10 text-indigo-500"
            trend="+5% vs last month"
          />
        </div>
      )}

      {/* Tabs Bar - Branch Users Only */}
      {isBankUser && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm gap-3">
          <Tabs
            onChange={(tab) => {
              setActiveTab(tab);
              setCurrentPage(1);
              loadLeadDataOnly(1, perPage);
            }}
            tabs={[
              { label: `All Leads`, value: "all-leads" },
              { label: `Maker Queue`, value: "maker-queue", dot: makerQueue.length > 0 },
            ]}
            value={activeTab}
          />
        </div>
      )}

      {/* Filter Bar - Always Visible Professional Toolbar */}
      <FilterBar
        onReset={handleResetFilters}
        onApply={() => { setCurrentPage(1); loadLeadDataOnly(1, perPage); }}
        filters={{
          fromDate: fromDateFilter,
          toDate: toDateFilter,
          applicationNo: applicationNoFilter,
          status: statusFilter,
          search: search,
        }}
        onChange={setFilters}
        hasActiveFilters={!!(fromDateFilter || toDateFilter || applicationNoFilter || statusFilter !== "ALL" || search)}
      />

      {/* Table Content */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/90 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 sm:px-5">Applicant / Ref ID</th>
                <th className="py-3.5 px-4">Constitution</th>
                <th className="py-3.5 px-4">Product & Type</th>
                <th className="py-3.5 px-4">Required Amount</th>
                <th className="py-3.5 px-4">Channel / Creator</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 sm:px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <Loader2 className="h-7 w-7 text-blue-600 animate-spin mb-3" />
                      <p className="text-xs font-medium text-slate-500">Loading lead applications...</p>
                    </div>
                  </td>
                </tr>
              ) : (activeTab === "all-leads" ? leads : makerQueue).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                        <FileText className="h-6 w-6 stroke-[1.5]" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">No lead applications found</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                        {!!(fromDateFilter || toDateFilter || applicationNoFilter || statusFilter !== "ALL" || search)
                          ? "No leads match your active filters or search terms. Try clearing or adjusting them."
                          : "No lead applications have been created yet."}
                      </p>
                      {!!(fromDateFilter || toDateFilter || applicationNoFilter || statusFilter !== "ALL" || search) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-4 h-8 text-xs font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 gap-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Reset Filters
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                (activeTab === "all-leads" ? leads : makerQueue).map((lead) => {
                  const applicantName = lead.CustName || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.entity_name || "Applicant";
                  const refId = lead.application_id || lead.lead_uuid?.slice(0, 13) || "—";

                  const normStatus = getNormalizedStatus(lead.status);
                  const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
                    NEW: { label: lead.status || "NEW", bg: "bg-sky-50/80", text: "text-sky-700", border: "border-sky-200/80", dot: "bg-sky-500" },
                    IN_PROCESS: { label: lead.status || "IN PROCESS", bg: "bg-amber-50/80", text: "text-amber-700", border: "border-amber-200/80", dot: "bg-amber-500" },
                    QUERY: { label: lead.status || "QUERY", bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200/80", dot: "bg-purple-500" },
                    SANCTIONED: { label: lead.status || "SANCTIONED", bg: "bg-emerald-50/80", text: "text-emerald-700", border: "border-emerald-200/80", dot: "bg-emerald-500" },
                    DISBURSED: { label: lead.status || "DISBURSED", bg: "bg-teal-50/80", text: "text-teal-700", border: "border-teal-200/80", dot: "bg-teal-500" },
                    REJECTED: { label: lead.status || "REJECTED", bg: "bg-rose-50/80", text: "text-rose-700", border: "border-rose-200/80", dot: "bg-rose-500" },
                    CANCELLED: { label: lead.status || "CANCELLED", bg: "bg-slate-100/80", text: "text-slate-600", border: "border-slate-200/80", dot: "bg-slate-400" },
                  };
                  const sc = statusConfig[normStatus] || { label: lead.status || "NEW", bg: "bg-slate-100/80", text: "text-slate-700", border: "border-slate-200/80", dot: "bg-slate-400" };

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Applicant / Ref ID */}
                      <td className="py-3.5 px-4 sm:px-5">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(lead.id!)}
                          className="font-bold text-slate-900 text-xs sm:text-sm hover:text-blue-600 transition-colors truncate block text-left leading-snug"
                        >
                          {applicantName}
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-400">#</span>
                          <span className="text-[11px] font-mono text-slate-500 font-medium tracking-tight">
                            {refId}
                          </span>
                        </div>
                      </td>

                      {/* Constitution */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border",
                            lead.constitution?.toLowerCase() === "individual"
                              ? "bg-blue-50/70 border-blue-200/80 text-blue-700"
                              : "bg-purple-50/70 border-purple-200/80 text-purple-700"
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              lead.constitution?.toLowerCase() === "individual" ? "bg-blue-500" : "bg-purple-500"
                            )}
                          />
                          {lead.constitution || "Individual"}
                        </span>
                      </td>

                      {/* Product & Type */}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900 text-xs leading-snug">
                          {lead.product?.name || "Loan Product"}
                        </p>
                        <p className="text-slate-500 text-[11px] mt-0.5 font-medium">
                          {lead.loan_type?.name || lead.loanType?.name || "Standard"}
                        </p>
                      </td>

                      {/* Required Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                          {formatCurrency(Number(lead.loan_amount_required || 0))}
                        </span>
                      </td>

                      {/* Channel / Creator */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100/80 text-slate-700 border border-slate-200/70">
                          {lead.created_by_type?.toLowerCase() === "dsa" ? (
                            <Building2 className="h-3 w-3 text-slate-500" />
                          ) : lead.created_by_type?.toLowerCase() === "branch" ? (
                            <Briefcase className="h-3 w-3 text-slate-500" />
                          ) : (
                            <User className="h-3 w-3 text-slate-500" />
                          )}
                          <span className="capitalize font-semibold">{lead.created_by_type || "DSA"}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border uppercase", sc.bg, sc.text, sc.border)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                          {sc.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetail(lead.id!)}
                            className="h-8 px-3 text-xs font-semibold rounded-lg border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 shadow-2xs gap-1.5 transition-all"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            <span>View</span>
                          </Button>
                          {isBankUser && lead.status === "NEW" && (
                            <Button
                              size="sm"
                              onClick={() => handleForwardToChecker(lead.id!)}
                              className="h-8 px-3 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5 transition-all"
                            >
                              <span>Forward</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isBankUser && lead.status === "SANCTIONED" && (
                            <Button
                              size="sm"
                              className="h-8 px-3 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5 transition-all"
                              onClick={() => openDisbursementModal(lead)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Disburse</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls (Default 10) */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-4 sm:px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/50 text-xs gap-3.5">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-600">
            <span className="font-medium">
              Showing <strong className="font-bold text-slate-900">{totalLeadsCount === 0 ? 0 : (currentPage - 1) * perPage + 1}</strong> to{" "}
              <strong className="font-bold text-slate-900">{Math.min(currentPage * perPage, totalLeadsCount)}</strong> of{" "}
              <strong className="font-bold text-slate-900">{totalLeadsCount}</strong> leads
            </span>

            <span className="text-slate-300 hidden sm:inline">•</span>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Per page:</span>
              <Select
                value={String(perPage)}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-20"
                buttonClassName="h-8 text-xs font-bold px-2.5 rounded-lg"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              className="h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white shadow-2xs gap-1 transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
              <span className="text-slate-400 font-normal mr-1">Page</span>
              <span className="text-blue-600 font-bold">{currentPage}</span>
              <span className="text-slate-300 mx-1.5">/</span>
              <span className="text-slate-700 font-bold">{totalPages || 1}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              className="h-8 px-2.5 sm:px-3 text-xs font-semibold rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white shadow-2xs gap-1 transition-all"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Share Link Modal — Premium Revamp */}
      <Modal
        open={isShareModalOpen}
        onClose={() => {
          setIsShareModalOpen(false);
          setIsShareDropdownOpen(false);
        }}
        title="Generate Customer Link"
        width="max-w-lg"
        className="overflow-visible"
        bodyClassName={cn("overflow-visible transition-[padding] duration-200", isShareDropdownOpen ? "pb-52" : "pb-0")}
      >
        <div className="-mt-2 -mx-1 space-y-0">

          <div className="space-y-4">
            {/* DSA Selector for Branch User */}
            {isBankUser && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">DSA Partner</p>
                    <p className="text-[11px] text-slate-500">Select the partner this link is generated for</p>
                  </div>
                  <span className="ml-auto text-[10px] font-semibold text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-full">Required</span>
                </div>
                <SearchableDsaSelect
                  dsaList={dsaList}
                  selectedCode={selectedShareDsaCode}
                  onSelect={(code) => {
                    setSelectedShareDsaCode(code);
                    setShareableUrl(null);
                  }}
                  onOpenChange={setIsShareDropdownOpen}
                />
                <p className="text-[11px] text-blue-700 font-medium flex items-center gap-1.5 mt-2">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Submissions are tied to the selected DSA's empanelment code.
                </p>
              </div>
            )}

            {/* Pre-select Loan Product */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-lg">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Loan Product *</p>
                </div>
              </div>
              <Select
                value={selectedShareProductId ? String(selectedShareProductId) : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedShareProductId(val ? Number(val) : undefined);
                  setShareableUrl(null);
                }}
                onOpenChange={setIsShareDropdownOpen}
                className="w-full text-xs sm:text-sm h-9 bg-white"
              >
                <option value="">-- Any Loan Product (Customer Selects) --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || p.product_name}</option>
                ))}
              </Select>
            </div>

            {/* Generate Button */}
            {!shareableUrl && (
              <Button
                type="button"
                disabled={generatingLink || (isBankUser && !selectedShareDsaCode) || !selectedShareProductId}
                onClick={() => handleGenerateLink(selectedShareDsaCode)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl h-11 text-sm shadow-md shadow-blue-600/20 disabled:opacity-50 gap-2.5"
              >
                {generatingLink ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating secure link...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    {isBankUser ? "Generate Customer Link" : "Generate My Customer Link"}
                  </>
                )}
              </Button>
            )}

            {/* Success State */}
            {shareableUrl && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Link Ready</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" /> 30d
                  </span>
                </div>

                {/* URL Row */}
                <div className="flex gap-2 items-center bg-white border border-emerald-200 rounded-xl px-3 py-2 shadow-xs">
                  <span className="flex-1 text-[11px] font-mono text-slate-700 truncate">{shareableUrl}</span>
                  <Button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareableUrl);
                      toast({ title: "Copied!", description: "Customer link copied to clipboard", variant: "success" });
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg h-8 px-4 text-xs gap-1.5 shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>


                <button
                  type="button"
                  onClick={() => setShareableUrl(null)}
                  className="w-full text-[12px] font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl py-2 transition-colors"
                >
                  ↺ Generate a New Link
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Create Lead Modal (Scrollable, Perfectly Aligned) */}
      <Modal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Lead Application"
        description=""
        width="max-w-4xl"
      >
        {masterLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shadow-xs">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900">Setting Up Application Form</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Fetching branch locations, loan products, and system configurations...
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateLead} className="space-y-5">
            <div className="space-y-5">
              {/* 1. Branch Location & Constitution */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl flex items-center justify-center">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Branch Location & Constitution
                      </h4>
                    </div>
                  </div>
                </div>

                  {isBankUser && (
                    <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                      <Label className="block text-blue-950 font-semibold text-xs mb-1.5 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-blue-700" />
                        Select DSA Partner <span className="text-rose-500 font-bold">*</span>
                      </Label>
                      <SearchableDsaSelect
                        dsaList={dsaList}
                        selectedCode={(createForm as any).DSACode || (createForm as any).dsa_code || ""}
                        onSelect={(code) => setCreateForm({ ...createForm, DSACode: code, dsa_code: code } as any)}
                      />
                    </div>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col">
                    <div className="h-5 flex items-center">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        Branch Location <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Select
                      searchable
                      searchPlaceholder="Search branch name or code..."
                      value={createForm.Branch_id || ""}
                      onChange={(e) => setCreateForm({ ...createForm, Branch_id: e.target.value })}
                      className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                    >
                      <option value="">-- Choose Branch Location --</option>
                      {branches.map((b) => (
                        <option key={b.branch_code || b.id} value={b.branch_code || b.id}>
                          {b.branch_name || b.name} ({b.branch_code || b.code})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col">
                    <div className="h-5 flex items-center">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        Constitution Type <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Select
                      value={createForm.constitution || "Individual"}
                      onChange={(e) => setCreateForm({ ...createForm, constitution: e.target.value as any })}
                      className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                    >
                      {constitutions.length > 0 ? (
                        constitutions.map((c: any) => (
                          <option key={c.meta_key || c.id} value={c.meta_key || c.meta_value}>
                            {c.meta_value}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Individual">Individual</option>
                          <option value="Proprietory">Proprietory Firm</option>
                          <option value="Partnership">Partnership Firm</option>
                          <option value="Limited Liability Partnership">Limited Liability Partnership (LLP)</option>
                          <option value="Pvt. Ltd. Company">Pvt. Ltd. Company</option>
                          <option value="Public Ltd. Company">Public Ltd. Company</option>
                          <option value="Charitable Trust">Charitable Trust</option>
                          <option value="Co-op. Society">Co-op. Society</option>
                        </>
                      )}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                  <div className="flex flex-col">
                    <div className="h-5 flex items-center">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        Pincode <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="e.g. 400001"
                      value={createForm.pincode || ""}
                      onChange={(e) => setCreateForm({ ...createForm, pincode: e.target.value.replace(/\D/g, "") })}
                      className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="h-5 flex items-center">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        City <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Input
                      type="text"
                      required
                      placeholder="City"
                      value={createForm.city || ""}
                      onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                      className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="h-5 flex items-center">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        State <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Input
                      type="text"
                      required
                      placeholder="State"
                      value={createForm.state || ""}
                      onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                      className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Identity & Contact Verification */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl flex items-center justify-center">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Identity & Contact Verification
                      </h4>
                    </div>
                  </div>
                </div>

                {/* PAN Verification Widget */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-100/70 pb-3">
                    <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">PAN Authentication</span>
                    {panVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {formatStatusLabel("PAN Verified")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                    <div className="flex-1 flex flex-col">
                      <div className="h-5 flex items-center">
                        <Label className="text-xs font-bold text-slate-700 leading-none">
                          PAN Number <span className="text-rose-500 font-bold">*</span>
                        </Label>
                      </div>
                      <div className="relative mt-1.5">
                        <Input
                          type="text"
                          required
                          maxLength={10}
                          placeholder="ABCDE1234F"
                          value={createForm.pan_no || ""}
                          onChange={(e) => {
                            setCreateForm({ ...createForm, pan_no: e.target.value.toUpperCase() });
                            setPanVerified(false);
                            setPanMessage(null);
                          }}
                          className="font-mono uppercase tracking-wider text-xs sm:text-sm h-9 bg-white pr-8"
                        />
                        {panVerified && (
                          <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      disabled={verifyingPan || (createForm.pan_no || "").length !== 10}
                      onClick={handleVerifyPan}
                      className={cn(
                        "h-9 px-4 text-xs font-semibold shrink-0 gap-1.5 shadow-xs transition-all",
                        panVerified
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      )}
                    >
                      {verifyingPan ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying...
                        </>
                      ) : (
                        <>
                          <FileCheck className="h-3.5 w-3.5" /> {panVerified ? "Re-verify PAN" : "Verify & Auto-fill"}
                        </>
                      )}
                    </Button>
                  </div>
                  {panMessage && (
                    <div className={cn(
                      "text-xs p-2.5 rounded-lg border flex items-center gap-2",
                      panVerified ? "text-emerald-800 bg-emerald-50 border-emerald-200" : "text-amber-800 bg-amber-50 border-amber-200"
                    )}>
                      {panVerified ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                      <span>{panMessage}</span>
                    </div>
                  )}
                </div>

                {/* Mobile & Contact Widget */}
                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-blue-100/70 pb-3">
                    <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">Contact & Mobile Verification</span>
                    {otpVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {formatStatusLabel("Mobile Verified")}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 items-start">
                    <div className="flex flex-col">
                      <div className="h-5 flex items-center">
                        <Label className="text-xs font-bold text-slate-700 leading-none">
                          Mobile Number <span className="text-rose-500 font-bold">*</span>
                        </Label>
                      </div>
                      <div className="flex gap-2.5 mt-1.5">
                        <Input
                          type="text"
                          required
                          maxLength={10}
                          disabled={otpVerified}
                          placeholder="10-digit mobile"
                          value={createForm.mobile || ""}
                          onChange={(e) => {
                            setCreateForm({ ...createForm, mobile: e.target.value.replace(/\D/g, "") });
                            setOtpSent(false);
                            setOtpVerified(false);
                          }}
                          className="flex-1 font-mono text-xs sm:text-sm h-9 bg-white disabled:opacity-60"
                        />
                        {!otpVerified && (
                          <Button
                            type="button"
                            disabled={sendingOtp || (createForm.mobile || "").length !== 10}
                            onClick={handleSendOtp}
                            className="h-9 px-3.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0"
                          >
                            {sendingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send OTP"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="h-5 flex items-center">
                        <Label className="text-xs font-bold text-slate-700 leading-none">
                          Email Address
                        </Label>
                      </div>
                      <Input
                        type="email"
                        placeholder="applicant@domain.com"
                        value={createForm.email || ""}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                      />
                    </div>
                  </div>

                  {otpSent && !otpVerified && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 items-center">
                      <div className="flex gap-2.5">
                        <Input
                          type="text"
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                          className="flex-1 font-mono text-center tracking-widest text-xs sm:text-sm h-9 bg-white"
                        />
                        <Button
                          type="button"
                          disabled={verifyingOtp || otpCode.length !== 6}
                          onClick={handleVerifyOtp}
                          className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md shrink-0 shadow-2xs"
                        >
                          {verifyingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify OTP"}
                        </Button>
                      </div>
                      {otpMessage ? (
                        <div className="flex items-center">
                          <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg inline-flex items-center">
                            {otpMessage}
                          </span>
                        </div>
                      ) : (
                        <div />
                      )}
                    </div>
                  )}
                  {!otpSent && otpMessage && !otpVerified && (
                    <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      {otpMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* 3. Applicant Profile Details */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        {createForm.constitution === "Individual" ? "Applicant Demographics & Financials" : "Entity Demographics & Turnover"}
                      </h4>
                    </div>
                  </div>
                </div>

                {createForm.constitution === "Individual" ? (
                  <div className="space-y-5">
                    {/* Individual Demographics */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Applicant Demographics</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Title <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Select
                            value={createForm.title || "MR"}
                            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          >
                            {titles.map((t: any) => (
                              <option key={t.meta_key || t.id} value={t.meta_key || t.meta_value}>{t.meta_value}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              First Name <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="text"
                            required
                            placeholder="First Name"
                            value={createForm.first_name || ""}
                            onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Middle Name
                            </Label>
                          </div>
                          <Input
                            type="text"
                            placeholder="Middle Name"
                            value={createForm.middle_name || ""}
                            onChange={(e) => setCreateForm({ ...createForm, middle_name: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Last Name <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="text"
                            required
                            placeholder="Last Name"
                            value={createForm.last_name || ""}
                            onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Gender <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Select
                            value={createForm.gender || "MALE"}
                            onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          >
                            {genders.map((g: any) => (
                              <option key={g.meta_key || g.id} value={g.meta_key || g.meta_value}>{g.meta_value}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Date of Birth <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="date"
                            required
                            value={createForm.dob || ""}
                            onChange={(e) => {
                              const dobVal = e.target.value;
                              const ageVal = calculateAgeFromDob(dobVal);
                              setCreateForm((prev) => ({ ...prev, dob: dobVal, age: ageVal }));
                            }}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Age
                            </Label>
                          </div>
                          {(() => {
                            const displayedAge = createForm.age ?? calculateAgeFromDob(createForm.dob);
                            return (
                              <div className="mt-1.5 h-9 border border-slate-200 rounded-md px-3 bg-white font-mono text-slate-700 flex items-center justify-between text-xs sm:text-sm">
                                <span>{displayedAge !== undefined ? `${displayedAge} Years` : "--"}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="h-5 flex items-center">
                          <Label className="text-xs font-bold text-slate-700 leading-none">
                            Residential Address <span className="text-rose-500 font-bold">*</span>
                          </Label>
                        </div>
                        <Input
                          type="text"
                          required
                          placeholder="Complete residential flat/house, street address..."
                          value={createForm.address || ""}
                          onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                          className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                        />
                      </div>
                    </div>

                    {/* Employment & Financials */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Employment & Financial Profile</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Employment Type <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Select
                            required
                            value={createForm.employment_type || ""}
                            onChange={(e) => setCreateForm({ ...createForm, employment_type: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          >
                            <option value="">-- Choose Employment --</option>
                            {employmentTypes.map((item: any) => (
                              <option key={item.meta_key || item.id} value={item.meta_key || item.meta_value}>{item.meta_value}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Occupation Type <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Select
                            required
                            disabled={!createForm.employment_type}
                            value={createForm.occupation_type || ""}
                            onChange={(e) => setCreateForm({ ...createForm, occupation_type: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white disabled:opacity-50"
                          >
                            <option value="">
                              {!createForm.employment_type ? "-- Choose Employment First --" : "-- Choose Occupation --"}
                            </option>
                            {activeOccupationTypes.map((item: any) => (
                              <option key={item.meta_key || item.id} value={item.meta_key || item.meta_value}>{item.meta_value}</option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="h-5 flex items-center">
                          <Label className="text-xs font-bold text-slate-700 leading-none">
                            Employer / Business Entity Name <span className="text-rose-500 font-bold">*</span>
                          </Label>
                        </div>
                        <Input
                          type="text"
                          required
                          placeholder="Current company / organization name"
                          value={createForm.employer_business_name || ""}
                          onChange={(e) => setCreateForm({ ...createForm, employer_business_name: e.target.value })}
                          className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Gross Monthly Income (₹) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="number"
                            required
                            min={0}
                            placeholder="50000"
                            value={createForm.avg_gross_monthly_income || ""}
                            onChange={(e) => setCreateForm({ ...createForm, avg_gross_monthly_income: Number(e.target.value) })}
                            className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Net Monthly Income (₹) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="number"
                            required
                            min={0}
                            placeholder="42000"
                            value={createForm.avg_net_monthly_income || ""}
                            onChange={(e) => setCreateForm({ ...createForm, avg_net_monthly_income: Number(e.target.value) })}
                            className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Existing Monthly Obligation (₹) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="number"
                            required
                            min={0}
                            placeholder="0"
                            value={createForm.existing_monthly_repayment_obligation || ""}
                            onChange={(e) => setCreateForm({ ...createForm, existing_monthly_repayment_obligation: Number(e.target.value) })}
                            className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Non-Individual Entity Details */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Entity Information</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Registered Entity Name <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="text"
                            required
                            placeholder="Legal company or firm name"
                            value={createForm.entity_name || ""}
                            onChange={(e) => setCreateForm({ ...createForm, entity_name: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Date of Incorporation (DOI) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="date"
                            required
                            value={createForm.doi || ""}
                            onChange={(e) => setCreateForm({ ...createForm, doi: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="h-5 flex items-center">
                          <Label className="text-xs font-bold text-slate-700 leading-none">
                            Registered Business Address <span className="text-rose-500 font-bold">*</span>
                          </Label>
                        </div>
                        <Input
                          type="text"
                          required
                          placeholder="Complete registered corporate office address..."
                          value={createForm.business_address || ""}
                          onChange={(e) => setCreateForm({ ...createForm, business_address: e.target.value })}
                          className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Key Promoter / Director Name <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="text"
                            required
                            placeholder="Managing partner / director name"
                            value={createForm.proprietor_partner_director_name || ""}
                            onChange={(e) => setCreateForm({ ...createForm, proprietor_partner_director_name: e.target.value })}
                            className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Annual Sales Turnover (₹) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="number"
                            required
                            min={0}
                            placeholder="Annual turnover"
                            value={createForm.annual_gross_turnover_last_fy || ""}
                            onChange={(e) => setCreateForm({ ...createForm, annual_gross_turnover_last_fy: Number(e.target.value) })}
                            className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Annual Gross Income (₹) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="number"
                            required
                            min={0}
                            value={createForm.avg_annual_gross_income || ""}
                            onChange={(e) => setCreateForm({ ...createForm, avg_annual_gross_income: Number(e.target.value) })}
                            className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Annual Net Income (₹) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="number"
                            required
                            min={0}
                            value={createForm.avg_annual_net_income || ""}
                            onChange={(e) => setCreateForm({ ...createForm, avg_annual_net_income: Number(e.target.value) })}
                            className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <div className="h-5 flex items-center">
                            <Label className="text-xs font-bold text-slate-700 leading-none">
                              Monthly Obligation (₹) <span className="text-rose-500 font-bold">*</span>
                            </Label>
                          </div>
                          <Input
                            type="number"
                            required
                            min={0}
                            value={createForm.existing_monthly_repayment_obligation || ""}
                            onChange={(e) => setCreateForm({ ...createForm, existing_monthly_repayment_obligation: Number(e.target.value) })}
                            className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Loan Facility Requirements */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl flex items-center justify-center">
                      <Banknote className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Loan Facility & Requirements
                      </h4>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col">
                    <div className="h-5 flex items-center">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        Loan Product <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Select
                      required
                      value={createForm.loan_product_id !== undefined && createForm.loan_product_id !== null ? String(createForm.loan_product_id) : ""}
                      onChange={(e) => handleProductChange(Number(e.target.value))}
                      className="mt-1.5 text-xs sm:text-sm h-9 bg-white"
                    >
                      <option value="">-- Choose Loan Product --</option>
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
                    </Select>
                  </div>

                  <div className="flex flex-col">
                    <div className="h-5 flex items-center">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        Loan Type <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Select
                      required
                      disabled={!createForm.loan_product_id}
                      value={createForm.loan_type_id !== undefined && createForm.loan_type_id !== null ? String(createForm.loan_type_id) : ""}
                      onChange={(e) => setCreateForm({ ...createForm, loan_type_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="mt-1.5 text-xs sm:text-sm h-9 bg-white disabled:opacity-50"
                    >
                      <option value="">-- Choose Loan Type --</option>
                      {loanTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name || t.type_name}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="h-5 flex items-center">
                    <Label className="text-xs font-bold text-slate-700 leading-none">
                      Loan Purpose <span className="text-rose-500 font-bold">*</span>
                    </Label>
                  </div>
                  <Select
                    required
                    disabled={!createForm.loan_product_id}
                    value={createForm.loan_purpose || ""}
                    onChange={(e) => setCreateForm({ ...createForm, loan_purpose: e.target.value })}
                    className="mt-1.5 text-xs sm:text-sm h-9 bg-white disabled:opacity-50"
                  >
                    <option value="">-- Choose Loan Purpose --</option>
                    {getLoanPurposeOptionsFromApi(
                      loanPurposes,
                      products.find((p) => Number(p.id) === Number(createForm.loan_product_id))?.name ||
                      products.find((p) => Number(p.id) === Number(createForm.loan_product_id))?.product_name,
                      loanTypes.find((t) => Number(t.id) === Number(createForm.loan_type_id))?.name ||
                      loanTypes.find((t) => Number(t.id) === Number(createForm.loan_type_id))?.type_name
                    ).map((purp, idx) => (
                      <option key={idx} value={purp}>{purp}</option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col">
                    <div className="h-5 flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        Required Amount (₹) <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Input
                      type="number"
                      required
                      min={1000}
                      placeholder="100000"
                      value={createForm.loan_amount_required || ""}
                      onChange={(e) => setCreateForm({ ...createForm, loan_amount_required: Number(e.target.value) })}
                      className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                    />
                  </div>

                  <div className="flex flex-col">
                    <div className="h-5 flex items-center justify-between">
                      <Label className="text-xs font-bold text-slate-700 leading-none">
                        Tenure (Months) <span className="text-rose-500 font-bold">*</span>
                      </Label>
                    </div>
                    <Input
                      type="number"
                      required
                      min={1}
                      max={360}
                      placeholder="12"
                      value={createForm.loan_period_months || ""}
                      onChange={(e) => setCreateForm({ ...createForm, loan_period_months: Number(e.target.value) })}
                      className="mt-1.5 font-mono text-xs sm:text-sm h-9 bg-white"
                    />
                  </div>
                </div>
              </div>

                {/* Lead Summary Overview Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-xs font-semibold text-slate-900">Application Summary Preview</span>
                    <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      {createForm.constitution || "Individual"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    {/* <div>
                      <p className="text-[11px] text-slate-500">Applicant</p>
                      <p className="font-semibold text-slate-800 truncate">
                        {createForm.constitution === "Individual"
                          ? `${createForm.title || "Mr."} ${createForm.first_name || ""} ${createForm.last_name || ""}`.trim() || "--"
                          : createForm.entity_name || "--"}
                      </p>
                    </div> */}
                    <div>
                      <p className="text-[11px] text-slate-500">Branch Location</p>
                      <p className="font-semibold text-slate-800 truncate">
                        {branches.find((b) => (b.branch_code || b.id) == createForm.Branch_id)?.branch_name ||
                          createForm.Branch_id ||
                          "--"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Requested Amount</p>
                      <p className="font-semibold text-blue-700 font-mono">
                        {formatCurrency(Number(createForm.loan_amount_required || 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Loan Tenure</p>
                      <p className="font-semibold text-slate-800">
                        {createForm.loan_period_months || 0} Months
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1.5">
                      {panVerified ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                      PAN: <span className="font-mono font-medium">{createForm.pan_no || "Pending"}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {otpVerified ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <div className="h-2 w-2 rounded-full bg-slate-300" />}
                      Mobile: <span className="font-mono font-medium">{createForm.mobile || "Pending"}</span>
                    </span>
                  </div>
                </div>
              </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs font-medium rounded-lg px-4 py-2"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={submittingLead}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg px-6 py-2 shadow-sm gap-2"
              >
                {submittingLead ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating Lead...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Create Lead Application
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Detail Modal */}
      {selectedLead && (
        <Modal
          open={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Lead Details: ${selectedLead.CustName || selectedLead.lead_uuid}`}
          description={``}
          width="max-w-4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Quick Header Summary */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {selectedLead.CustName || `${selectedLead.first_name || ""} ${selectedLead.last_name || ""}`.trim() || selectedLead.lead_uuid}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                    {selectedLead.constitution || "Individual"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                    REF: {selectedLead.application_id || selectedLead.lead_uuid}
                  </span>
                  <StatusBadge status={selectedLead.status || "NEW"} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-slate-50/80 border border-slate-200/60 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Required Amount</p>
                  <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {formatCurrency(Number(selectedLead.loan_amount_required || 0))}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50/80 border border-slate-200/60 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Product & Type</p>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5 truncate" title={`${selectedLead.product?.name || "Loan"} • ${selectedLead.loan_type?.name || selectedLead.loanType?.name || "Standard"}`}>
                    {selectedLead.product?.name || "Loan"} • {selectedLead.loan_type?.name || selectedLead.loanType?.name || "Standard"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50/80 border border-slate-200/60 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sourcing Partner</p>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5 truncate" title={selectedLead.dsa?.entity_name || selectedLead.dsa?.name || selectedLead.DSACode || "DSA Partner"}>
                    {selectedLead.dsa?.entity_name || selectedLead.dsa?.name || "DSA Partner"}
                    <span className="font-mono text-slate-500 text-[10px] ml-1">
                      ({selectedLead.DSACode || selectedLead.dsa_code || selectedLead.dsa?.dsa_code || selectedLead.dsa?.code || "N/A"})
                    </span>
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50/80 border border-slate-200/60 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Branch Location</p>
                  <p className="font-semibold text-slate-800 text-xs mt-0.5 truncate">
                    {selectedLead.branch?.branch_name || selectedLead.Branch_id || "BR001"}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Toolbar */}
            {(() => {
              const normStatus = getNormalizedStatus(selectedLead.status);
              return (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="flex flex-wrap items-center gap-2">
                    {(isBankMaker || isBankUser) && normStatus === "NEW" && (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs" onClick={() => handleProcessLead(selectedLead.id!)}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Process Lead
                      </Button>
                    )}

                    {isBankUser && !["DISBURSED", "REJECTED", "CANCELLED"].includes(normStatus) && (
                      <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-semibold" onClick={() => setIsQueryModalOpen(true)}>
                        <HelpCircle className="h-3.5 w-3.5 mr-1 text-amber-600" />
                        Raise Query
                      </Button>
                    )}

                    {isBankChecker && normStatus === "IN_PROCESS" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs" onClick={() => {
                        setSanctionAmount(selectedLead.loan_amount_required || 0);
                        setIsSanctionModalOpen(true);
                      }}>
                        <FileCheck className="h-3.5 w-3.5 mr-1" />
                        Sanction Lead
                      </Button>
                    )}

                    {isBankChecker && normStatus === "SANCTIONED" && (
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs" onClick={() => openDisbursementModal(selectedLead)}>
                        <Banknote className="h-3.5 w-3.5 mr-1" />
                        Disburse Lead
                      </Button>
                    )}

                    {isDsa && normStatus === "QUERY" && (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs" onClick={() => {
                        const el = document.getElementById("query-thread-section");
                        if (el) el.scrollIntoView({ behavior: "smooth" });
                      }}>
                        <HelpCircle className="h-3.5 w-3.5 mr-1" />
                        Respond to Query
                      </Button>
                    )}

                    {!["DISBURSED", "REJECTED", "CANCELLED"].includes(normStatus) && (
                      <Button size="sm" variant="outline" className="text-slate-700 border-slate-300 hover:bg-slate-100 text-xs font-medium" onClick={() => handleOpenEditModal(selectedLead)}>
                        <Edit3 className="h-3.5 w-3.5 mr-1 text-slate-500" />
                        Edit Lead
                      </Button>
                    )}

                    {(isBankChecker || isDsa) && !isBankMaker && !["DISBURSED", "REJECTED", "CANCELLED"].includes(normStatus) && (
                      <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium" onClick={() => setIsRejectModalOpen(true)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    )}

                    {!["DISBURSED", "REJECTED", "CANCELLED"].includes(normStatus) && (
                      <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium" onClick={() => setIsCancelModalOpen(true)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>

                  <Button size="sm" variant="outline" onClick={() => setShowRawJson(!showRawJson)} className="text-slate-600 border-slate-300 hover:bg-white text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    {showRawJson ? "Hide API Log" : "API Log"}
                  </Button>
                </div>
              );
            })()}

            {/* RAW API VERIFICATION JSON PAYLOAD PANEL */}
            {showRawJson && (
              <div className="bg-slate-950 text-slate-200 p-4 rounded-xl font-mono text-[11px] border border-slate-800 space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider">API Audit Logs</span>
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

            {/* SECTION 1: Sourcing & Branch Information */}
            <LeadSectionBlock icon={Building2} title="Sourcing & Branch Information">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <LeadDetailItem label="Branch Location" value={selectedLead.branch?.branch_name || selectedLead.Branch_id || "BR001"} />
                <LeadDetailItem label="DSA Partner Code" value={selectedLead.DSACode || (selectedLead as any).dsa_code || selectedLead.dsa?.dsa_code || "N/A"} />
                <LeadDetailItem label="City & State" value={`${selectedLead.city || "—"}, ${selectedLead.state || "—"}`} />
                <LeadDetailItem label="Pincode" value={selectedLead.pincode || "—"} />
              </div>
            </LeadSectionBlock>

            {/* SECTION 2: Identity & Contact Verification */}
            <LeadSectionBlock
              icon={CheckCircle2}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50 border-emerald-200/80"
              title="Identity & Contact Verification"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <LeadDetailItem
                  label="PAN Number"
                  value={<span className="font-mono uppercase font-bold tracking-wider">{selectedLead.pan_no || "N/A"}</span>}
                  subvalue={
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      <Check className="h-2.5 w-2.5" /> {formatStatusLabel("PAN Verified")}
                    </span>
                  }
                />
                <LeadDetailItem
                  label="Mobile Number"
                  value={<span className="font-mono">{selectedLead.mobile || "N/A"}</span>}
                  subvalue={
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      <Check className="h-2.5 w-2.5" /> {formatStatusLabel("OTP Verified")}
                    </span>
                  }
                />
                <LeadDetailItem
                  label="Email Address"
                  value={<span className="truncate block" title={selectedLead.email}>{selectedLead.email || "N/A"}</span>}
                />
              </div>
            </LeadSectionBlock>

            {/* SECTION 3: Applicant Profile */}
            {selectedLead.constitution === "Individual" || !selectedLead.constitution ? (
              <LeadSectionBlock icon={User} title="Individual Applicant Profile">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <LeadDetailItem
                    label="Applicant Name"
                    value={selectedLead.CustName || `${selectedLead.title || ""} ${selectedLead.first_name || ""} ${selectedLead.middle_name || ""} ${selectedLead.last_name || ""}`.trim()}
                  />
                  <LeadDetailItem label="Gender" value={selectedLead.gender || "MALE"} />
                  <LeadDetailItem label="Date of Birth" value={selectedLead.dob ? formatDate(selectedLead.dob) : "N/A"} />
                  <LeadDetailItem label="Age" value={selectedLead.age !== undefined ? `${selectedLead.age} Years` : "N/A"} />
                  <LeadDetailItem className="sm:col-span-2" label="Residential Address" value={selectedLead.address || "N/A"} />
                  <LeadDetailItem label="Employer / Business Name" value={selectedLead.employer_business_name || "N/A"} />
                  <LeadDetailItem label="Employment Type" value={selectedLead.employment_type || "Salaried"} />
                  <LeadDetailItem
                    label="Gross Monthly Income"
                    value={<span className="font-mono font-bold text-emerald-600">{formatCurrency(Number(selectedLead.avg_gross_monthly_income || 0))}</span>}
                  />
                  <LeadDetailItem
                    label="Net Monthly Income"
                    value={<span className="font-mono font-bold text-emerald-600">{formatCurrency(Number(selectedLead.avg_net_monthly_income || 0))}</span>}
                  />
                  <LeadDetailItem
                    className="sm:col-span-2"
                    label="Monthly Obligation"
                    value={<span className="font-mono font-bold text-amber-600">{formatCurrency(Number(selectedLead.existing_monthly_repayment_obligation || 0))}</span>}
                  />
                </div>
              </LeadSectionBlock>
            ) : (
              <LeadSectionBlock
                icon={Building2}
                iconColor="text-purple-600"
                iconBg="bg-purple-50 border-purple-200/80"
                title="Business Entity Profile"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <LeadDetailItem label="Entity Name" value={selectedLead.entity_name || selectedLead.CustName || "N/A"} />
                  <LeadDetailItem label="Date of Incorporation" value={selectedLead.doi ? formatDate(selectedLead.doi) : "N/A"} />
                  <LeadDetailItem label="Promoter / Director" value={selectedLead.proprietor_partner_director_name || "N/A"} />
                  <LeadDetailItem label="Business Address" value={selectedLead.business_address || "N/A"} />
                  <LeadDetailItem
                    label="Annual Turnover (Last FY)"
                    value={<span className="font-mono font-bold text-indigo-600">{formatCurrency(Number(selectedLead.annual_gross_turnover_last_fy || 0))}</span>}
                  />
                  <LeadDetailItem
                    label="Avg Annual Gross Income"
                    value={<span className="font-mono font-bold text-emerald-600">{formatCurrency(Number(selectedLead.avg_annual_gross_income || 0))}</span>}
                  />
                  <LeadDetailItem
                    label="Avg Annual Net Income"
                    value={<span className="font-mono font-bold text-emerald-600">{formatCurrency(Number(selectedLead.avg_annual_net_income || 0))}</span>}
                  />
                  <LeadDetailItem
                    label="Monthly Obligation"
                    value={<span className="font-mono font-bold text-amber-600">{formatCurrency(Number(selectedLead.existing_monthly_repayment_obligation || 0))}</span>}
                  />
                </div>
              </LeadSectionBlock>
            )}

            {/* SECTION 4: Loan Requirements */}
            <LeadSectionBlock icon={CreditCard} title="Loan Requirements">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <LeadDetailItem label="Loan Product" value={selectedLead.product?.name || "Loan Product"} />
                <LeadDetailItem label="Loan Type" value={selectedLead.loan_type?.name || selectedLead.loanType?.name || "Standard"} />
                <LeadDetailItem
                  label="Required Amount"
                  value={<span className="font-mono font-bold text-slate-900">{formatCurrency(Number(selectedLead.loan_amount_required || 0))}</span>}
                />
                <LeadDetailItem
                  label="Tenure"
                  value={<span className="font-mono">{selectedLead.loan_period_months} Months</span>}
                />
                <LeadDetailItem className="sm:col-span-4" label="Loan Purpose" value={selectedLead.loan_purpose || "Not Specified"} />
              </div>

              {selectedLead.application_link && selectedLead.application_link !== "NA" && (
                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Customer Self-Fill Portal Link</p>
                    <p className="font-mono text-xs text-blue-700 truncate mt-0.5 select-all">{selectedLead.application_link}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200 text-xs shrink-0 font-medium"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLead.application_link!);
                      toast({ title: "Copied!", description: "Portal link copied to clipboard.", variant: "success" });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy Link
                  </Button>
                </div>
              )}
            </LeadSectionBlock>

            {/* SECTION 5: Sanction & Disbursement Summary */}
            {(selectedLead.sanction_amount || selectedLead.disbursed_amount || (selectedLead.facilities && selectedLead.facilities.length > 0)) && (
              <LeadSectionBlock
                icon={FileCheck}
                iconColor="text-indigo-600"
                iconBg="bg-indigo-50 border-indigo-200/80"
                title="Sanction & Disbursement Summary"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <LeadDetailItem
                    label="Sanction Amount"
                    value={<span className="font-mono font-bold text-emerald-600">{formatCurrency(Number(selectedLead.sanction_amount || 0))}</span>}
                  />
                  <LeadDetailItem label="Sanction Letter No" value={<span className="font-mono">{selectedLead.sanction_letter_no || "N/A"}</span>} />
                  <LeadDetailItem
                    label="Total Disbursed"
                    value={<span className="font-mono font-bold text-indigo-700">{formatCurrency(Number(selectedLead.disbursed_amount || 0))}</span>}
                  />
                  <LeadDetailItem label="Disbursement Date" value={selectedLead.disbursement_date ? formatDate(selectedLead.disbursement_date) : "N/A"} />
                </div>

                {selectedLead.facilities && selectedLead.facilities.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">Disbursed Facility Breakdown</p>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full bg-white text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">Facility Type</th>
                            <th className="p-2.5">Sanctioned</th>
                            <th className="p-2.5">Disbursed</th>
                            <th className="p-2.5">Account No.</th>
                            <th className="p-2.5">Deviation</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {selectedLead.facilities.map((f, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-2.5 uppercase">{f.facility_type}</td>
                              <td className="p-2.5 font-mono">{formatCurrency(Number(f.sanctioned_amount || 0))}</td>
                              <td className="p-2.5 font-mono font-bold text-indigo-700">{formatCurrency(Number(f.disbursed_amount || 0))}</td>
                              <td className="p-2.5 font-mono text-slate-600">{f.loan_account_no || "N/A"}</td>
                              <td className="p-2.5">
                                {f.has_deviation ? (
                                  <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold text-[10px]">
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
                  </div>
                )}
              </LeadSectionBlock>
            )}

            {/* SECTION 6: Queries & Communication */}
            <LeadSectionBlock
              icon={HelpCircle}
              iconColor="text-amber-600"
              iconBg="bg-amber-50 border-amber-200/80"
              title="Queries & Communication"
            >
              <div id="query-thread-section" className="space-y-3">
                {selectedLead.queries && selectedLead.queries.length > 0 ? (
                  selectedLead.queries.map((q) => (
                    <div key={q.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-amber-700 uppercase tracking-wide text-[11px] font-bold">Type: {q.query_type}</span>
                        <StatusBadge status={q.status} />
                      </div>
                      <p className="text-xs text-slate-800 font-medium">Q: {q.query_text}</p>
                      {q.response_text ? (
                        <p className="text-xs text-emerald-800 bg-emerald-50/80 p-2.5 rounded-md border border-emerald-200 font-medium">
                          A: {q.response_text}
                        </p>
                      ) : (
                        <div className="pt-1 flex gap-2">
                          <input
                            type="text"
                            placeholder="Type query response..."
                            className="flex-1 border border-slate-200 rounded-md px-2.5 py-1 text-xs bg-white focus:outline-blue-500"
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
                  <p className="text-xs text-slate-400 italic py-1">No queries raised on this lead.</p>
                )}
              </div>
            </LeadSectionBlock>

            {/* SECTION 7: Status Audit Trail */}
            <LeadSectionBlock icon={Clock} title="Status Audit Trail">
              {selectedLead.status_histories && selectedLead.status_histories.length > 0 ? (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Date & Time</th>
                        <th className="p-2.5">Old Status</th>
                        <th className="p-2.5">New Status</th>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5">Remarks / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedLead.status_histories.map((sh, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-mono text-slate-600 text-[11px]">{new Date(sh.created_at).toLocaleString()}</td>
                          <td className="p-2.5"><StatusBadge status={sh.old_status || "INITIAL"} /></td>
                          <td className="p-2.5"><StatusBadge status={sh.new_status} /></td>
                          <td className="p-2.5 font-bold uppercase text-purple-700 text-[11px]">{sh.action_by_type || "SYSTEM"}</td>
                          <td className="p-2.5 text-slate-700">{sh.remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-1">No status history recorded yet.</p>
              )}
            </LeadSectionBlock>
          </div>
        </Modal>
      )}

      {/* Query Modal */}
      <Modal open={isQueryModalOpen} onClose={() => setIsQueryModalOpen(false)} title="Raise Query on Lead">
        <form onSubmit={handleRaiseQuerySubmit} className="space-y-4 text-sm">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/70 text-amber-900">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
              <HelpCircle className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm sm:text-base text-amber-950">Raise Application Query</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Query Type
            </label>
            <Select
              value={queryType}
              onChange={(e) => setQueryType(e.target.value)}
              buttonClassName="focus:border-amber-500 focus:ring-amber-500/20"
            >
              <option value="clarification">Clarification</option>
              <option value="document">Document Missing</option>
              <option value="deviation">Deviation Query</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Query Text *
            </label>
            <textarea
              required
              rows={3}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none min-h-[96px]"
              placeholder="Enter detailed query description or missing document requirements..."
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsQueryModalOpen(false)}
              className="h-10 px-4.5 text-sm font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-2"
            >
              <Send className="h-4 w-4" />
              <span>Submit Query</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sanction Modal */}
      <Modal open={isSanctionModalOpen} onClose={() => setIsSanctionModalOpen(false)} title="Sanction Lead Application">
        <form onSubmit={handleSanctionSubmit} className="space-y-4 text-sm">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 text-emerald-900">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
              <Banknote className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm sm:text-base text-emerald-950">Sanction Approval</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Sanction Amount (₹) *
              </label>
              <input
                type="number"
                required
                value={sanctionAmount}
                onChange={(e) => setSanctionAmount(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Sanction Letter Number
              </label>
              <input
                type="text"
                placeholder="e.g. SL-2026-9081"
                value={sanctionLetterNo}
                onChange={(e) => setSanctionLetterNo(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Sanction Remarks
            </label>
            <textarea
              rows={2}
              value={sanctionRemarks}
              onChange={(e) => setSanctionRemarks(e.target.value)}
              placeholder="Add optional sanction notes or credit committee conditions..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSanctionModalOpen(false)}
              className="h-10 px-4.5 text-sm font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirm Sanction</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal open={isRejectModalOpen} onClose={() => setIsRejectModalOpen(false)} title="Reject Lead Application">
        <form onSubmit={handleRejectSubmit} className="space-y-4 text-sm">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-900">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0">
              <XCircle className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm sm:text-base text-rose-950">Reject Application</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Rejection Reason *
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter detailed reason for rejection (e.g. CIBIL score below policy cutoff, fraud flag, documentation mismatch)..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none min-h-[96px]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRejectModalOpen(false)}
              className="h-10 px-4.5 text-sm font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs gap-2"
            >
              <XCircle className="h-4 w-4" />
              <span>Reject Lead</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manual Disbursement Modal */}
      <Modal open={isDisburseModalOpen} onClose={() => setIsDisburseModalOpen(false)} title="Mark Lead Disbursement" width="max-w-xl" className="overflow-visible\">
        <form onSubmit={handleDisburseSubmit} className="space-y-4 text-sm">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/70 text-emerald-900">
            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
              <Banknote className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm sm:text-base text-emerald-950">Loan Disbursement Confirmation</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Disbursement Date *
              </label>
              <input
                type="date"
                required
                value={disbursementDate}
                onChange={(e) => setDisbursementDate(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Disbursed Amount (₹) *
              </label>
              <input
                type="number"
                required
                min={1}
                value={disbursedAmount}
                onChange={(e) => setDisbursedAmount(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Loan Account No. * (Numeric, min 8 digits)
            </label>
            <input
              type="text"
              required
              placeholder="Enter Loan Account Number (e.g. 10023456789)"
              value={loanAccountNo}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setLoanAccountNo(val);
                if (val.length >= 8) {
                  setLoanAccountError(null);
                }
              }}
              className={cn(
                "w-full h-10 rounded-lg border bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs transition-all",
                loanAccountError
                  ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  : "border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              )}
            />
            {loanAccountError && <p className="text-rose-600 font-semibold text-xs mt-1.5">{loanAccountError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 p-4 rounded-xl border border-amber-200/80">
            <div>
              <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
                Sanctioned with deviation? *
              </label>
              <Select
                value={hasDeviation}
                onChange={(e) => {
                  setHasDeviation(e.target.value);
                  if (e.target.value === "No") setDeviationType("");
                }}
                buttonClassName="border-amber-200 focus:border-amber-500 focus:ring-amber-500/20"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </Select>
            </div>

            {hasDeviation === "Yes" && (
              <div>
                <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-2">
                  Deviation Type *
                </label>
                <Select
                  value={deviationType}
                  required={hasDeviation === "Yes"}
                  onChange={(e) => setDeviationType(e.target.value)}
                  buttonClassName="border-amber-200 focus:border-amber-500 focus:ring-amber-500/20"
                >
                  <option value="">-- Select Deviation Type --</option>
                  <option value="Non-Financial">Non-Financial</option>
                  <option value="Allowed Financial">Allowed Financial</option>
                  <option value="Not-allowed Financial">Not-allowed Financial</option>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDisburseModalOpen(false)}
              className="h-10 px-4.5 text-sm font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirm Disbursement</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Lead Modal */}
      <Modal open={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Lead Application">
        <form onSubmit={handleCancelSubmit} className="space-y-4 text-sm">
          <div className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/70 text-rose-900">
            <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="font-bold text-sm sm:text-base text-rose-950">Cancel Lead Application</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Cancellation Reason *
            </label>
            <textarea
              required
              rows={3}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Enter reason for cancelling this lead (e.g. Customer requested withdrawal, duplicate application)..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3.5 text-sm text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all resize-none min-h-[96px]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
              className="h-10 px-4.5 text-sm font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Back
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Confirm Cancellation</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Lead Information Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Lead Information: ${selectedLead?.CustName || selectedLead?.lead_uuid}`}
        width="max-w-2xl"
        bodyClassName={masterLoading ? "overflow-hidden" : ""}
      >
        {masterLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shadow-xs">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Loading Lead Configuration</h3>
              <p className="text-xs text-slate-500 mt-1">Please wait while configuration options are loaded...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleEditSubmit} className="relative space-y-4 text-sm">
          {editForm.constitution === "Individual" ? (
            /* Individual Edit Fields */
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/70">
                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-600 shrink-0">
                  <User className="h-4.5 w-4.5" />
                </div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs sm:text-sm">
                  Individual Applicant Details
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.first_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={editForm.middle_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.last_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={editForm.mobile || ""}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Date of Birth (DOB)
                  </label>
                  <input
                    type="date"
                    value={editForm.dob ? parseDobToIso(editForm.dob) : ""}
                    onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Residential Address
                </label>
                <textarea
                  rows={2}
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Enter full street address, apartment/flat number..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none min-h-[64px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Employment Type
                  </label>
                  <input
                    type="text"
                    value={editForm.employment_type || ""}
                    onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="SALARIED / SELF_EMPLOYED"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Gross Monthly Income (₹)
                  </label>
                  <input
                    type="number"
                    value={editForm.avg_gross_monthly_income || ""}
                    onChange={(e) => setEditForm({ ...editForm, avg_gross_monthly_income: Number(e.target.value) })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Net Monthly Income (₹)
                  </label>
                  <input
                    type="number"
                    value={editForm.avg_net_monthly_income || ""}
                    onChange={(e) => setEditForm({ ...editForm, avg_net_monthly_income: Number(e.target.value) })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Non-Individual Edit Fields */
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/70">
                <div className="p-2 rounded-lg bg-purple-50 border border-purple-200/80 text-purple-600 shrink-0">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs sm:text-sm">
                  Non-Individual Entity Details
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Entity Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.entity_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, entity_name: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Proprietor / Partner / Director
                  </label>
                  <input
                    type="text"
                    value={editForm.proprietor_partner_director_name || ""}
                    onChange={(e) => setEditForm({ ...editForm, proprietor_partner_director_name: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={editForm.mobile || ""}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Date of Incorporation (DOI)
                  </label>
                  <input
                    type="date"
                    value={editForm.doi ? parseDobToIso(editForm.doi) : ""}
                    onChange={(e) => setEditForm({ ...editForm, doi: e.target.value })}
                    className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Registered Business Address
                </label>
                <textarea
                  rows={2}
                  value={editForm.business_address || ""}
                  onChange={(e) => setEditForm({ ...editForm, business_address: e.target.value })}
                  placeholder="Enter registered corporate office or operating business address..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none min-h-[64px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Annual Gross Turnover (₹)
                </label>
                <input
                  type="number"
                  value={editForm.annual_gross_turnover_last_fy || ""}
                  onChange={(e) => setEditForm({ ...editForm, annual_gross_turnover_last_fy: Number(e.target.value) })}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Loan Requirement Edit Fields */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200/70">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-600 shrink-0">
                <Banknote className="h-4.5 w-4.5" />
              </div>
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-xs sm:text-sm">
                Loan Requirement Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Loan Amount Required (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={editForm.loan_amount_required || ""}
                  onChange={(e) => setEditForm({ ...editForm, loan_amount_required: Number(e.target.value) })}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Loan Period (Months) *
                </label>
                <input
                  type="number"
                  required
                  value={editForm.loan_period_months || ""}
                  onChange={(e) => setEditForm({ ...editForm, loan_period_months: Number(e.target.value) })}
                  className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-bold font-mono text-slate-900 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Loan Purpose
                </label>
                <Select
                  value={editForm.loan_purpose || ""}
                  onChange={(e) => setEditForm({ ...editForm, loan_purpose: e.target.value })}
                >
                  <option value="">-- Select Purpose --</option>
                  {getLoanPurposeOptionsFromApi(
                    loanPurposes,
                    selectedLead?.product?.name,
                    selectedLead?.loan_type?.name || selectedLead?.loanType?.name
                  ).map((purp, idx) => (
                    <option key={idx} value={purp}>{purp}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              className="h-10 px-4.5 text-sm font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-2"
            >
              <Check className="h-4 w-4" />
              <span>Save Lead Changes</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>

      {/* Confirmation Modal for Branch/Bank User Status Actions */}
      {confirmActionModal && (
        <Modal
          open={confirmActionModal.open}
          onClose={() => setConfirmActionModal(null)}
          title={confirmActionModal.title || "Confirm Action"}
        >
          <div className="space-y-4 text-slate-800 text-xs py-1">
            <div
              className={cn(
                "flex items-start gap-3.5 p-4 rounded-xl border transition-all",
                confirmActionModal.variant === "emerald"
                  ? "bg-emerald-50/70 border-emerald-200/90"
                  : confirmActionModal.variant === "red"
                  ? "bg-rose-50/70 border-rose-200/90"
                  : confirmActionModal.variant === "amber"
                  ? "bg-amber-50/70 border-amber-200/90"
                  : "bg-blue-50/70 border-blue-200/90"
              )}
            >
              <div
                className={cn(
                  "p-2 rounded-xl shrink-0 border shadow-2xs",
                  confirmActionModal.variant === "emerald"
                    ? "bg-emerald-100/80 text-emerald-700 border-emerald-200"
                    : confirmActionModal.variant === "red"
                    ? "bg-rose-100/80 text-rose-700 border-rose-200"
                    : confirmActionModal.variant === "amber"
                    ? "bg-amber-100/80 text-amber-700 border-amber-200"
                    : "bg-blue-100/80 text-blue-700 border-blue-200"
                )}
              >
                {confirmActionModal.variant === "emerald" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : confirmActionModal.variant === "red" ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : confirmActionModal.variant === "amber" ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <h4
                  className={cn(
                    "font-bold text-sm",
                    confirmActionModal.variant === "emerald"
                      ? "text-emerald-950"
                      : confirmActionModal.variant === "red"
                      ? "text-rose-950"
                      : confirmActionModal.variant === "amber"
                      ? "text-amber-950"
                      : "text-blue-950"
                  )}
                >
                  {confirmActionModal.title || "Action Confirmation"}
                </h4>
                <p
                  className={cn(
                    "mt-1 text-xs font-medium leading-relaxed",
                    confirmActionModal.variant === "emerald"
                      ? "text-emerald-800"
                      : confirmActionModal.variant === "red"
                      ? "text-rose-800"
                      : confirmActionModal.variant === "amber"
                      ? "text-amber-800"
                      : "text-blue-800"
                  )}
                >
                  {confirmActionModal.message || "Do you want to perform this action?"}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmActionModal(null)}
                className="h-9 px-4 text-xs font-semibold rounded-lg border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs"
              >
                No, Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const action = confirmActionModal.onConfirm;
                  setConfirmActionModal(null);
                  action();
                }}
                className={cn(
                  "h-9 px-4 text-xs font-semibold rounded-lg text-white shadow-xs transition-all gap-1.5",
                  confirmActionModal.variant === "emerald"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : confirmActionModal.variant === "red"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirmActionModal.variant === "amber"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                <span>{confirmActionModal.confirmLabel || "Yes, Proceed"}</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
// ============================================================================
// Helper Components
// ============================================================================

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: string | null;
}

function KpiCard({ label, value, icon, iconBg, trend }: KpiCardProps) {
  return (
    <Card className="bg-white border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-950 mt-1">{value}</p>
          {trend && <p className="text-xs text-emerald-600 font-medium mt-1">{trend}</p>}
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
interface FilterBarFilters {
  fromDate: string;
  toDate: string;
  applicationNo: string;
  status: string;
  search: string;
}

interface FilterBarProps {
  onReset: () => void;
  onApply: () => void;
  filters: FilterBarFilters;
  onChange: (filters: FilterBarFilters) => void;
  hasActiveFilters: boolean;
}

function FilterBar({ onReset, onApply, filters, onChange, hasActiveFilters }: FilterBarProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-3.5 sm:p-4 space-y-3">
      {/* Filter Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
        {/* Search */}
        <div className="lg:col-span-3">
          <Label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Search
          </Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Name, Mobile, PAN..."
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") onApply();
              }}
              className="w-full !pl-10 pr-8 h-9 text-xs sm:text-sm bg-slate-50/50 hover:bg-white focus:bg-white transition-colors"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: "" })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Application ID */}
        <div className="lg:col-span-2">
          <Label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Application ID
          </Label>
          <Input
            type="text"
            placeholder="APP / Ref No."
            value={filters.applicationNo}
            onChange={(e) => onChange({ ...filters, applicationNo: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onApply();
            }}
            className="w-full h-9 font-mono text-xs sm:text-sm bg-slate-50/50 hover:bg-white focus:bg-white transition-colors"
          />
        </div>

        {/* Status */}
        <div className="lg:col-span-3">
          <Label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Filter Status
          </Label>
          <Select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            className="w-full h-9 text-xs sm:text-sm bg-slate-50/50 hover:bg-white focus:bg-white transition-colors"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New Lead / In Maker Queue</option>
            <option value="IN_PROCESS">In Process</option>
            <option value="QUERY">Query Raised</option>
            <option value="SANCTIONED">Sanctioned</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>

        {/* From Date */}
        <div className="lg:col-span-2">
          <Label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            From Date
          </Label>
          <Input
            type="date"
            value={filters.fromDate}
            onChange={(e) => onChange({ ...filters, fromDate: e.target.value })}
            className="w-full h-9 text-xs bg-slate-50/50 hover:bg-white focus:bg-white transition-colors"
          />
        </div>

        {/* To Date */}
        <div className="lg:col-span-2">
          <Label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            To Date
          </Label>
          <Input
            type="date"
            value={filters.toDate}
            onChange={(e) => onChange({ ...filters, toDate: e.target.value })}
            className="w-full h-9 text-xs bg-slate-50/50 hover:bg-white focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Filter Bottom Bar: Active Indicators & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              Active Filters Applied
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium">
              Filter leads by search, ID, status or date range
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-8 text-xs px-3 border-slate-200 hover:bg-slate-50 text-slate-600 font-medium"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Reset Filters
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={onApply}
            className="h-8 text-xs px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
          >
            <Search className="h-3 w-3 mr-1.5" />
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
interface LeadsTableProps {
  leads: any[];
  isLoading: boolean;
  onViewDetail: (id: number) => void;
  onEdit: (lead: any) => void;
  onForwardToChecker: (id: number) => void;
  onRaiseQuery: (lead: any) => void;
  onSanction: (lead: any) => void;
  onReject: (lead: any) => void;
  onDisburse: (lead: any) => void;
  onCancel: (lead: any) => void;
  onUpdateStatus: (id: number, status: string) => void;
  currentUser: any;
  isBankUser: boolean;
}

function LeadsTable({ leads, isLoading, onViewDetail, onEdit, onForwardToChecker, onRaiseQuery, onSanction, onReject, onDisburse, onCancel, onUpdateStatus, currentUser, isBankUser }: LeadsTableProps) {
  const getStatusActions = (lead: any) => {
    const actions = [];
    if (isBankUser) {
      if (lead.status === "NEW") {
        actions.push(
          <Button key="forward" size="sm" variant="outline" onClick={() => onForwardToChecker(lead.id)}>
            <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
            Forward
          </Button>
        );
      }
      if (lead.status === "IN_PROCESS" || lead.status === "QUERY") {
        actions.push(
          <Button key="query" size="sm" variant="outline" onClick={() => onRaiseQuery(lead)}>
            <HelpCircle className="h-3.5 w-3.5 mr-1" />
            Query
          </Button>
        );
      }
      if (lead.status === "SANCTIONED") {
        actions.push(
          <Button key="disburse" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onDisburse(lead)}>
            <Banknote className="h-3.5 w-3.5 mr-1" />
            Disburse
          </Button>
        );
      }
      if (["NEW", "IN_PROCESS", "QUERY"].includes(lead.status)) {
        actions.push(
          <Button key="reject" size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50 border-rose-200" onClick={() => onReject(lead)}>
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Reject
          </Button>
        );
      }
    } else {
      // DSA user actions
      if (lead.status === "NEW") {
        actions.push(
          <Button key="edit" size="sm" variant="outline" onClick={() => onEdit(lead)}>
            <Edit3 className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
        );
      }
    }
    return actions;
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
        <p className="text-slate-500">Loading leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="p-8 text-center">
        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">No leads found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-xs">
          <tr>
            <th className="py-3 px-4">Applicant</th>
            <th className="py-3 px-4">Ref ID</th>
            <th className="py-3 px-4">Constitution</th>
            <th className="py-3 px-4">Product / Type</th>
            <th className="py-3 px-4">Amount</th>
            <th className="py-3 px-4">Channel</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="py-3 px-4">
                <p className="font-medium text-slate-900">{lead.CustName || `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.entity_name}</p>
              </td>
              <td className="py-3 px-4">
                <p className="text-[11px] font-mono text-slate-500">{lead.application_id || lead.lead_uuid?.slice(0, 13)}</p>
              </td>
              <td className="py-3 px-4">
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                  lead.constitution === "Individual"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-purple-50 text-purple-700"
                )}>
                  {lead.constitution}
                </span>
              </td>
              <td className="py-3 px-4">
                <p className="text-slate-800 truncate max-w-xs">{lead.product?.name || "Loan Product"}</p>
                <p className="text-slate-400 text-[11px] truncate max-w-xs">{lead.loan_type?.name || lead.loanType?.name || "Standard"}</p>
              </td>
              <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                {lead.loan_amount_required ? `₹${Number(lead.loan_amount_required).toLocaleString("en-IN")}` : "—"}
              </td>
              <td className="py-3 px-4 text-slate-600 capitalize">
                {lead.created_by_type || "dsa"}
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={lead.status || "NEW"} />
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => onViewDetail(lead.id)} className="text-slate-500 hover:text-slate-700">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {getStatusActions(lead)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 bg-slate-50/50 text-sm gap-3">
      <div className="flex items-center gap-4 text-slate-600">
        <span>Page <strong className="text-slate-900">{currentPage}</strong> of <strong className="text-slate-900">{totalPages}</strong></span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-180" />
        </Button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }
          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? "primary" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="min-w-[36px]"
            >
              {pageNum}
            </Button>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}


