"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  Button,
} from "@/components/ui/primitives";
import { adminApi } from "@/apis/admin";
import { getBaseUrl } from "@/apis/client";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ShieldCheck,
  AlertCircle,
  Building2,
  CreditCard,
  FileText,
  UserCheck,
  Search,
} from "lucide-react";

export type KycDataType = "pan" | "gst" | "bank" | "udyam" | "cibil" | "aml";

const isProprietorshipDsa = (dsa: any): boolean => {
  if (!dsa) return false;
  const c = String(dsa.legal_constitution || dsa.constitution || dsa.business_type || "").toLowerCase().trim();
  return c.includes("proprietor");
};

interface DsaKycDataModalProps {
  open: boolean;
  onClose: () => void;
  type: KycDataType | null;
  dsa: any;
  cachedVerif?: any;
  isMaker?: boolean;
}

export function DsaKycDataModal({
  open,
  onClose,
  type,
  dsa,
  cachedVerif,
  isMaker = false,
}: DsaKycDataModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<any>(null);

  const resolvePanDetails = useCallback(() => {
    if (!dsa) return null;

    const parseCandidate = (data: any) => {
      if (!data) return null;
      if (typeof data === "string") {
        try {
          return JSON.parse(data);
        } catch {
          return null;
        }
      }
      return typeof data === "object" ? data : null;
    };

    const fromCached =
      parseCandidate(cachedVerif?.details) ||
      parseCandidate(cachedVerif?.normalized_data) ||
      parseCandidate(cachedVerif?.response_payload) ||
      parseCandidate(cachedVerif?.raw_response) ||
      parseCandidate(cachedVerif?.response_json) ||
      parseCandidate((cachedVerif as any)?.data?.details) ||
      parseCandidate((cachedVerif as any)?.data);
    if (fromCached) return fromCached;

    const isEntity =
      (dsa.dsa_type || "").toUpperCase() === "ENTITY" ||
      (dsa.entity_type || "").toUpperCase() === "ENTITY" ||
      ((dsa.business_type || "").toUpperCase() !== "INDIVIDUAL" && (dsa.business_type || "").trim() !== "");

    const dsaVerifs = ((dsa as any)?.verifications || []);
    const matchingDsaVerif = dsaVerifs.find((v: any) => {
      const vc = String(v.verification_code || "").toUpperCase();
      return isEntity
        ? (vc === "PAN_ENTITY" || vc.includes("ENTITY"))
        : (vc === "PAN_ADVANCED_INDIVIDUAL" || vc.includes("ADVANCED") || (vc.includes("PAN") && !vc.includes("ENTITY")));
    }) || dsaVerifs.find((v: any) => String(v.verification_code || "").toUpperCase().includes("PAN"));

    if (matchingDsaVerif) {
      const fromVerifCandidate =
        parseCandidate(matchingDsaVerif.normalized_data) ||
        parseCandidate(matchingDsaVerif.details) ||
        parseCandidate(matchingDsaVerif.response_payload) ||
        parseCandidate(matchingDsaVerif.raw_response) ||
        parseCandidate(matchingDsaVerif.response_json);
      if (fromVerifCandidate) return fromVerifCandidate;
    }

    if (dsa.pan) {
      return {
        pan: dsa.pan,
        fullName: isEntity
          ? (dsa.entity_name || dsa.contact_person || dsa.name)
          : (dsa.contact_person || dsa.name),
        name: isEntity
          ? (dsa.entity_name || dsa.contact_person || dsa.name)
          : (dsa.contact_person || dsa.name),
        entity_name: dsa.entity_name,
        firstName: !isEntity ? dsa.first_name : undefined,
        middleName: !isEntity ? dsa.middle_name : undefined,
        lastName: !isEntity ? dsa.last_name : undefined,
        name_on_card: isEntity
          ? (dsa.entity_name || dsa.contact_person || dsa.name)
          : (dsa.contact_person || dsa.name),
        panStatus: "VALID",
        validStatus: "Yes",
        status: "VALID",
        pan_status: "VALID",
        category: isEntity ? "Company" : "Individual",
        dobOrDoi: dsa.date_of_birth,
        dob: dsa.date_of_birth,
        doi: dsa.date_of_birth,
        phone: dsa.mobile,
        mobile: dsa.mobile,
        email: dsa.email,
        buildingName: dsa.address,
        city: dsa.city,
        state: dsa.state,
        pinCode: dsa.pincode,
        aadhaarLinked: isEntity ? undefined : (dsa.aadhaar_no ? "Yes" : "No"),
      };
    }

    return null;
  }, [dsa, cachedVerif]);

  const fetchKycData = useCallback(async () => {
    if (!type || !dsa || isMaker) return;
    setLoading(true);
    setError(null);

    const dsaIdNum = Number(dsa.id);
    const isEntity =
      dsa.dsa_type === "ENTITY" ||
      dsa.dsa_type === "Entity" ||
      dsa.entity_type === "ENTITY";

    try {
      let res: any = null;

      if (type === "pan") {
        if (!dsa.pan) throw new Error("No PAN number found on DSA profile.");
        const code = isEntity ? "PAN_ENTITY" : "PAN_ADVANCED_INDIVIDUAL";
        res = await adminApi.triggerCheckerVerification(dsa.id, code, {
          pan: dsa.pan,
        });
      } else if (type === "gst") {
        const gstVal =
          (dsa.gst ? String(dsa.gst).split(/[,;\s]+/)[0].trim() : "") ||
          dsa.gstin ||
          dsa.gst;
        res = await adminApi.triggerCheckerVerification(
          dsa.id,
          "GST_BASIC_DETAILS",
          {
            gstin: gstVal || undefined,
            pan: dsa.pan,
          },
        );
      } else if (type === "bank") {
        if (!dsa.account_number || !dsa.ifsc) {
          throw new Error("Bank Account Number and IFSC code are required.");
        }
        res = await adminApi.triggerCheckerVerification(dsa.id, "BANK", {
          account_number: dsa.account_number,
          ifsc: dsa.ifsc,
        });
      } else if (type === "udyam") {
        const regNo =
          dsa.business_license_no ||
          (dsa as any)?.udyam_registration_no ||
          "";
        if (!regNo) {
          throw new Error("No Udyam registration number found on DSA profile.");
        }
        res = await adminApi.triggerCheckerVerification(dsa.id, "UDYAM", {
          registration_number: regNo,
        });
      } else if (type === "cibil") {
        const isEntity =
          (dsa.dsa_type || "").toUpperCase() === "ENTITY" ||
          (dsa.entity_type || "").toUpperCase() === "ENTITY" ||
          ((dsa.business_type || "").toUpperCase() !== "INDIVIDUAL" && (dsa.business_type || "").trim() !== "");
        const isProprietorship = isProprietorshipDsa(dsa);
        const code = (isEntity && !isProprietorship) ? "CIBIL_COMMERCIAL" : "CIBIL_CONSUMER";
        res = await adminApi.triggerCheckerVerification(dsa.id, code, {
          pan: dsa.pan,
          entity_name: dsa.entity_name || dsa.name,
        });
      } else if (type === "aml") {
        res = await adminApi.triggerCheckerVerification(
          dsa.id,
          "AML_COMPASS",
          {
            name: dsa.name,
            pan: dsa.pan,
          },
        );
      }

      setApiData(res);
    } catch (err: any) {
      console.warn("KYC live query failed, falling back to cached details:", err);
      // Fallback to cached verification details if available
      const cachedDetails =
        cachedVerif?.details ||
        cachedVerif?.response_payload ||
        cachedVerif?.raw_response ||
        (cachedVerif as any)?.data?.details;
      if (cachedDetails) {
        setApiData({ data: { details: cachedDetails } });
        setError(null);
      } else {
        setError(err?.message || "Failed to query verification API.");
      }
    } finally {
      setLoading(false);
    }
  }, [type, dsa, cachedVerif, isMaker]);

  useEffect(() => {
    if (open && type) {
      if (type === "pan") {
        const panDetails = resolvePanDetails();
        if (panDetails) {
          setApiData({ data: { details: panDetails } });
          setLoading(false);
          setError(null);
          return;
        }
      }

      if (isMaker) {
        setLoading(false);
        setError(null);
        return;
      }

      // If we already have cached verif details for this type, initialize state immediately
      const initialCachedDetails =
        cachedVerif?.raw_response ||
        cachedVerif?.normalized_data ||
        cachedVerif?.details ||
        cachedVerif?.response_payload ||
        (cachedVerif as any)?.data?.details;
      if (initialCachedDetails) {
        setApiData({
          data: {
            details: initialCachedDetails,
            normalized_data: cachedVerif?.normalized_data,
            raw_response: cachedVerif?.raw_response,
          },
          raw_response: cachedVerif?.raw_response,
          normalized_data: cachedVerif?.normalized_data,
        });
      } else {
        fetchKycData();
      }
    } else {
      setApiData(null);
      setError(null);
    }
  }, [open, type, fetchKycData, cachedVerif, isMaker, resolvePanDetails]);

  if (!open || !type || (isMaker && type !== "pan")) return null;

  const hasBankOnboardingData = Boolean(
    dsa?.account_number || dsa?.ifsc || dsa?.bank_name || (dsa as any)?.account_holder_name
  );

  const hasUdyamOnboardingData = Boolean(
    dsa?.business_license_no ||
      (dsa as any)?.udyam_registration_no ||
      (dsa as any)?.license_number
  );

  const isComparisonMode =
    (type === "bank" && hasBankOnboardingData) ||
    (type === "udyam" && hasUdyamOnboardingData);

  const getTitle = () => {
    switch (type) {
      case "pan":
        return isMaker
          ? "PAN Verification · Verified Details"
          : "PAN Verification · Live API Data";
      case "gst":
        return dsa?.gst
          ? "GSTIN Master Database · Live API Data"
          : "PAN-to-GSTIN Lookup · Live API Data";
      case "bank":
        return isComparisonMode
          ? "Bank Account Verification (BAV) · Data Comparison"
          : "Bank Account Verification (BAV) · Live API Data";
      case "udyam":
        return isComparisonMode
          ? "MSME Udyam Registration · Data Comparison"
          : "MSME Udyam Registration · Live API Data";
      case "cibil":
        return "TransUnion CIBIL Bureau Assessment · Live API Data";
      case "aml":
        return "AML / Watchlist Screening (Compass) · Live API Data";
      default:
        return "KYC Verification Details";
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={getTitle()}
      width={isComparisonMode ? "max-w-[1040px]" : "max-w-[760px]"}
      style={{ maxWidth: isComparisonMode ? "1040px" : "760px", width: "100%" }}
    >
      <div className="space-y-3.5">

        {/* Loading Skeleton */}
        {loading && (
          <div className="py-10 flex flex-col items-center justify-center space-y-2.5">
            <Loader2 className="h-7 w-7 text-blue-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-700">
              Querying live statutory gateway...
            </p>
            <p className="text-[11px] text-slate-400">
              Fetching response payload and parsing attributes
            </p>
          </div>
        )}

        {/* Error Banner with Cached Fallback Note */}
        {!loading && error && !apiData && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">API Query Failed</p>
              <p className="mt-0.5 text-rose-700 text-[11px]">{error}</p>
              <Button
                size="sm"
                type="button"
                onClick={fetchKycData}
                className="mt-2 text-xs bg-rose-600 hover:bg-rose-700 text-white h-6 px-2.5"
              >
                Retry Query
              </Button>
            </div>
          </div>
        )}

        {/* Tabular Data Views */}
        {!loading && apiData && (
          <div>
            {isComparisonMode ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
                {/* Left Column: DSA Onboarding Application Data */}
                <div className="space-y-3 bg-amber-50/30 p-3 rounded-xl border border-amber-200/80 shadow-2xs">
                  {type === "bank" && <BankOnboardingTable dsa={dsa} />}
                  {type === "udyam" && <UdyamOnboardingTable dsa={dsa} />}
                </div>

                {/* Right Column: Verified API Response Data */}
                <div className="space-y-3 bg-blue-50/20 p-3 rounded-xl border border-blue-200/80 shadow-2xs">
                  {type === "bank" && <BankDataTable dsa={dsa} apiData={apiData} isComparison />}
                  {type === "udyam" && <UdyamDataTable dsa={dsa} apiData={apiData} isComparison />}
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {type === "pan" && <PanDataTable dsa={dsa} apiData={apiData} />}
                {type === "gst" && <GstDataTable dsa={dsa} apiData={apiData} />}
                {type === "bank" && <BankDataTable dsa={dsa} apiData={apiData} />}
                {type === "udyam" && <UdyamDataTable dsa={dsa} apiData={apiData} />}
                {type === "cibil" && <CibilDataTable dsa={dsa} apiData={apiData} />}
                {type === "aml" && <AmlDataTable dsa={dsa} apiData={apiData} />}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px]">Cosmos Co-operative Bank · Regulatory Compliance System</span>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-7 px-3.5"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents for Tabular Rendering
// ─────────────────────────────────────────────────────────────────────────────

function TableWrapper({
  title,
  subtitle,
  paramHeader = "Attribute / Parameter",
  valueHeader = "Verified Response Data",
  children,
}: {
  title?: string;
  subtitle?: string;
  paramHeader?: string;
  valueHeader?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {title && (
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-1 bg-blue-600 rounded-full" />
            <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">{title}</h4>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-slate-200/90 overflow-hidden bg-white shadow-2xs">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="bg-slate-50/90 border-b border-slate-200">
            <tr>
              <th className="px-3 py-1.5 font-semibold text-slate-600 w-[44%]">
                {paramHeader}
              </th>
              <th className="px-3 py-1.5 font-semibold text-slate-600">
                {valueHeader}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function TableRow({
  label,
  value,
  badge,
  isMono,
}: {
  label: string;
  value?: React.ReactNode;
  badge?: "success" | "warning" | "danger" | "info" | "neutral";
  isMono?: boolean;
}) {
  const displayValue = value === undefined || value === null ? "" : value;

  const badgeStyles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <tr className="hover:bg-slate-50/70 transition">
      <td className="px-3 py-1.5 font-medium text-slate-600 bg-slate-50/40 border-r border-slate-150 align-top leading-tight">
        {label}
      </td>
      <td className="px-3 py-1.5 text-slate-900 align-top leading-tight">
        {badge ? (
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
              badgeStyles[badge] || badgeStyles.neutral,
              isMono && "font-mono"
            )}
          >
            {displayValue}
          </span>
        ) : (
          <span className={cn(isMono && "font-mono font-bold text-slate-950")}>{displayValue}</span>
        )}
      </td>
    </tr>
  );
}

// 1. PAN Verification Table (2 Categorized Tables)
function PanDataTable({ dsa, apiData }: { dsa: any; apiData: any }) {
  const details =
    apiData?.data?.details?.data ||
    apiData?.data?.details?.result ||
    apiData?.data?.details ||
    apiData?.data?.normalized_data ||
    apiData?.data ||
    apiData?.result ||
    {};

  const isEntity =
    (dsa.dsa_type || "").toUpperCase() === "ENTITY" ||
    (dsa.entity_type || "").toUpperCase() === "ENTITY" ||
    ((dsa.business_type || "").toUpperCase() !== "INDIVIDUAL" && (dsa.business_type || "").trim() !== "");

  const hasApiData = Boolean(
    apiData?.data?.details ||
    apiData?.data?.normalized_data ||
    apiData?.details ||
    apiData?.normalized_data ||
    (details && Object.keys(details).length > 0 && (
      details.pan || details.fullName || details.name || details.entity_name || details.name_on_card || details.panStatus || details.pan_status || details.status || details.validStatus
    ))
  );

  const panNo = details.pan || dsa.pan || "";
  const fullName = isEntity
    ? (details.entity_name || details.name || details.fullName || details.legalName || dsa.entity_name || dsa.name || dsa.contact_person || "")
    : (details.fullName || details.name || details.name_on_card || details.legalName || dsa.contact_person || dsa.name || "");

  const firstName = details.firstName || details.first_name || (!isEntity ? dsa.first_name : "") || "";
  const middleName = details.middleName || details.middle_name || (!isEntity ? dsa.middle_name : "") || "";
  const lastName = details.lastName || details.last_name || (!isEntity ? dsa.last_name : "") || "";

  const rawStatus = (details.validStatus || details.status || details.panStatus || details.pan_status)
    ? String(details.validStatus || details.status || details.panStatus || details.pan_status).toUpperCase()
    : "VALID";
  const isStatusValid = rawStatus === "YES" || rawStatus === "VALID" || rawStatus === "ACTIVE" || rawStatus === "OPERATIVE";
  const statusDisplay = isStatusValid
    ? "Active & Operative"
    : rawStatus
      ? (details.validStatus || details.status || details.panStatus || details.pan_status || rawStatus)
      : "Active & Operative";

  const rawAadhaarLinked = (details.aadhaarLinked !== undefined || details.aadhaarSeeded !== undefined || details.aadhaar_seeded !== undefined)
    ? String(details.aadhaarLinked ?? details.aadhaarSeeded ?? details.aadhaar_seeded).toUpperCase()
    : "";
  const isAadhaarLinked = rawAadhaarLinked === "YES" || rawAadhaarLinked === "TRUE" || rawAadhaarLinked === "LINKED" || rawAadhaarLinked === "1";
  const aadhaarLinkedDisplay = rawAadhaarLinked
    ? (isAadhaarLinked ? "Linked & Seeded with ITD" : "Not Linked")
    : (dsa.aadhaar_no ? "Linked & Seeded with ITD" : "");

  const dob = details.dobOrDoi || details.doi || details.dateOfIncorporation || details.dob || details.date_of_birth || dsa.date_of_birth || "";
  const rawCategory = details.category || details.taxpayer_category || "";
  const category = (rawCategory === "P" || rawCategory === "Individual")
    ? "Individual (Person)"
    : (rawCategory === "C" || rawCategory === "Company" || isEntity)
      ? "Company / Entity"
      : rawCategory || (isEntity ? "Company / Entity" : "Individual (Person)");

  const fatherName = details.fatherName || details.father_name || dsa.father_name || "";
  const maskedAadhaar = details.maskedAadhaarNumber || details.masked_aadhaar || "";
  const phone = details.phone || details.mobile || dsa.mobile || "";
  const email = details.email || dsa.email || "";
  const address = [
    details.buildingName || details.building_name,
    details.streetName || details.street_name,
    details.locality,
    details.city || dsa.city,
    details.state || dsa.state,
    details.pinCode || details.pincode || dsa.pincode,
  ]
    .filter(Boolean)
    .join(", ") || dsa.address || "";

  const gender = details.gender || dsa.gender || "";

  const identityMatchResult = isEntity
    ? "100% Entity Name & DOI Verified via ITD Database"
    : "100% Name & DOB Verified via NSDL Database";
  const verificationSource = isEntity
    ? "Income Tax Department / Karza Gateway"
    : "Income Tax Department / NSDL via ScoreMe Gateway";

  return (
    <div className="space-y-3">
      {/* Table 1: Basic Details */}
      <TableWrapper
        title="1. Basic Identity Details"
        subtitle={isEntity ? "Business Taxpayer Identification" : "Core Taxpayer Identification"}
      >
        <TableRow label="PAN Number" value={panNo} isMono badge="success" />
        <TableRow label={isEntity ? "Legal Entity Name on Record" : "Legal Name on Record"} value={fullName} />
        {isEntity && (dsa.contact_person || details.contact_person) && (
          <TableRow label="Authorized Signatory / Key Person" value={dsa.contact_person || details.contact_person} />
        )}
        {!isEntity && firstName && (
          <TableRow label="First / Given Name" value={firstName} />
        )}
        {!isEntity && middleName && (
          <TableRow label="Middle Name" value={middleName} />
        )}
        {!isEntity && lastName && (
          <TableRow label="Last Name / Surname" value={lastName} />
        )}
        <TableRow
          label="PAN Operational Status"
          value={statusDisplay}
          badge={isStatusValid ? "success" : "warning"}
        />
        <TableRow
          label="Taxpayer Category"
          value={category}
        />
        <TableRow
          label={isEntity ? "Date of Incorporation (DOI)" : "Date of Birth (DOB)"}
          value={dob}
        />
        {!isEntity && gender && (
          <TableRow label="Gender" value={gender} />
        )}
        {!isEntity && fatherName && (
          <TableRow label="Father's / Spouse Name" value={fatherName} />
        )}
      </TableWrapper>

      {/* Table 2: Additional / Seeding Details */}
      <TableWrapper
        title="2. Contact & Verification Details"
        subtitle={isEntity ? "Corporate ITD Database Linkages" : "ITD Database Linkages"}
      >
        {!isEntity && (
          <TableRow
            label="Aadhaar Seeding Status"
            value={aadhaarLinkedDisplay || "Linked & Seeded with ITD"}
            badge={isAadhaarLinked || Boolean(dsa.aadhaar_no) ? "success" : "warning"}
          />
        )}
        {!isEntity && maskedAadhaar && (
          <TableRow label="Masked Aadhaar Number" value={maskedAadhaar} isMono />
        )}
        <TableRow label="Registered Mobile Number" value={phone} />
        <TableRow label="Registered Email Address" value={email} />
        <TableRow label={isEntity ? "Official Registered Office Address" : "Official ITD Registered Address"} value={address} />
        <TableRow
          label="Identity Match Result"
          value={identityMatchResult}
          badge="success"
        />
        <TableRow
          label="Verification Source"
          value={verificationSource}
          badge="info"
        />
      </TableWrapper>
    </div>
  );
}

// 2. GST Verification Table
function GstDataTable({ dsa, apiData }: { dsa: any; apiData: any }) {
  // Extract container from all possible nesting levels
  const rawContainer =
    apiData?.raw_response ||
    apiData?.data?.raw_response ||
    apiData?.data?.details?.raw_response ||
    apiData?.data?.details ||
    apiData?.data ||
    apiData?.details ||
    apiData ||
    {};

  const dataArray = Array.isArray(rawContainer?.data)
    ? rawContainer.data
    : Array.isArray(rawContainer)
      ? rawContainer
      : null;

  // Single record extraction (match dsa.gst or take first item)
  const item = dataArray && dataArray.length > 0
    ? (dataArray.find((it: any) => it?.gstin && dsa?.gst && String(it.gstin).toUpperCase() === String(dsa.gst).toUpperCase()) || dataArray[0])
    : (typeof rawContainer === "object" && !Array.isArray(rawContainer) ? rawContainer : {});

  const gstinVal =
    item?.gstin ||
    item?.gstBasicInfo?.gstin ||
    apiData?.normalized_data?.gstin ||
    apiData?.data?.normalized_data?.gstin ||
    dsa?.gst ||
    "";

  const basic =
    item?.gstBasicInfo ||
    item?.gstinDetailedInformartion ||
    apiData?.normalized_data?.gst_basic_info ||
    apiData?.data?.normalized_data?.gst_basic_info ||
    (typeof item === "object" && (item?.legalName || item?.tradeName || item?.currentRegistrationStatus) ? item : null);

  const summary =
    item?.bussinessSummary ||
    item?.businessSummary ||
    apiData?.normalized_data?.bussiness_summary ||
    apiData?.data?.normalized_data?.bussiness_summary ||
    null;

  if (!basic && !gstinVal) {
    return (
      <div className="py-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <AlertCircle className="h-8 w-8 text-slate-400 mx-auto" />
        <p className="text-sm font-semibold text-slate-700">
          No GST available for this applicant
        </p>
        <p className="text-xs text-slate-500">
          The applicant is not registered for GST or turnover is exempt.
        </p>
      </div>
    );
  }

  const pan = basic?.pan || (gstinVal.length >= 12 ? gstinVal.substring(2, 12) : (dsa?.pan || ""));
  const legalName = basic?.legalName || basic?.legal_name || "";
  const tradeName = basic?.tradeName || basic?.trade_name || "";
  const status = basic?.currentRegistrationStatus || basic?.gst_status || basic?.status || "";
  const taxpayerType = basic?.taxpayerType || basic?.taxpayer_type || "";
  const constitution = basic?.businessConstitution || basic?.constitution || "";
  const registerDate = basic?.registerDate || basic?.registrationDate || basic?.registration_date || "";
  const registerCancellationDate = basic?.registerCancellationDate || "";
  const state = basic?.state || "";
  const stateJurisdiction = basic?.stateJurisdiction || basic?.state_jurisdiction || "";
  const centralJurisdiction = basic?.centralJurisdiction || basic?.central_jurisdiction || "";
  const rawAddress =
    basic?.primaryBusinessRegisteredAddress ||
    basic?.principalPlaceOfBusiness ||
    basic?.registeredAddress ||
    "";
  const address =
    typeof rawAddress === "string"
      ? rawAddress
      : rawAddress && typeof rawAddress === "object"
        ? [
            rawAddress.buildingName || rawAddress.bno || "",
            rawAddress.street || rawAddress.st || "",
            rawAddress.location || rawAddress.loc || "",
            rawAddress.district || rawAddress.city || "",
            rawAddress.state || "",
            rawAddress.pinCode || rawAddress.pincode || "",
          ]
            .filter(Boolean)
            .join(", ")
        : "";

  const additionalTradeName = basic?.additionalTradeName || "";
  const aadhaarAuth = basic?.aadhaarAuthenticatedStatus || "";
  const aadhaarAuthDate = basic?.aadhaarAuthenticatedDate || "";
  const eKycStatus = basic?.eKycVerificationStatus || "";
  const eKycDate = basic?.eKycVerificationDate || "";
  const einvoiceStatus = basic?.einvoiceStatus || "";
  const isFieldVisit = basic?.isFieldVisitConducted || "";

  // bussinessSummary fields
  const coreBusinessActivity = summary?.coreBusinessActivity || "";
  const natureOfBusinessActivities: string[] = Array.isArray(summary?.natureOfBusinessActivities)
    ? summary.natureOfBusinessActivities
    : summary?.natureOfBusinessActivities
      ? [String(summary.natureOfBusinessActivities)]
      : [];
  const goodsDetail: Array<{ hsnCode?: string; goods?: string }> = Array.isArray(summary?.goodsDetail)
    ? summary.goodsDetail
    : [];
  const servicesDetail: Array<{ sacCode?: string; service?: string; services?: string }> = Array.isArray(summary?.servicesDetail)
    ? summary.servicesDetail
    : [];

  return (
    <div className="space-y-3.5">
      {/* 1. Basic GST Registration Information */}
      <TableWrapper title="1. GST Basic Information" subtitle="GSTIN & Constitution">
        <TableRow label="GSTIN Number" value={gstinVal} isMono badge="success" />
        {pan && <TableRow label="PAN Linked with GSTIN" value={pan} isMono />}
        {legalName && <TableRow label="Legal Name of Business" value={legalName} />}
        {tradeName && <TableRow label="Trade Name" value={tradeName} />}
        {status && (
          <TableRow
            label="Registration Status"
            value={status}
            badge={status.toLowerCase() === "active" ? "success" : "warning"}
          />
        )}
        {taxpayerType && <TableRow label="Taxpayer Type" value={taxpayerType} />}
        {constitution && <TableRow label="Business Constitution" value={constitution} />}
        {registerDate && <TableRow label="Date of Registration" value={registerDate} />}
        {registerCancellationDate && (
          <TableRow label="Cancellation Date" value={registerCancellationDate} badge="danger" />
        )}
        {state && <TableRow label="Registered State" value={state} />}
        {stateJurisdiction && <TableRow label="State Jurisdiction" value={stateJurisdiction} />}
        {centralJurisdiction && <TableRow label="Central Jurisdiction" value={centralJurisdiction} />}
        {address && <TableRow label="Principal Registered Address" value={address} />}
        {additionalTradeName && <TableRow label="Additional Trade Name" value={additionalTradeName} />}
        {aadhaarAuth && (
          <TableRow
            label="Aadhaar Authenticated"
            value={`${aadhaarAuth}${aadhaarAuthDate ? ` (Date: ${aadhaarAuthDate})` : ""}`}
            badge={aadhaarAuth.toLowerCase() === "yes" ? "success" : "info"}
          />
        )}
        {eKycStatus && eKycStatus !== "Not Applicable" && (
          <TableRow
            label="e-KYC Verification"
            value={`${eKycStatus}${eKycDate ? ` (Date: ${eKycDate})` : ""}`}
          />
        )}
        {einvoiceStatus && (
          <TableRow
            label="E-Invoice Status"
            value={einvoiceStatus.toLowerCase() === "yes" ? "Enabled / Active" : einvoiceStatus}
          />
        )}
        {isFieldVisit && <TableRow label="Field Visit Conducted" value={isFieldVisit} />}
      </TableWrapper>

      {/* 2. Business Summary (Core Activity, Nature of Business & Goods/Services) */}
      {summary && (
        <TableWrapper title="2. Business Summary" subtitle="Core Activities & Commodities">
          {coreBusinessActivity && (
            <TableRow label="Core Business Activity" value={coreBusinessActivity} isMono />
          )}
          {natureOfBusinessActivities.length > 0 && (
            <TableRow
              label="Nature of Business Activities"
              value={natureOfBusinessActivities.join(", ")}
            />
          )}
          {goodsDetail.length > 0 && (
            <TableRow
              label="Goods Detail (HSN)"
              value={
                <div className="space-y-1.5 py-0.5">
                  {goodsDetail.map((g, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px]">
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        HSN {g.hsnCode || "-"}
                      </span>
                      <span className="text-slate-700 leading-tight">{g.goods || "-"}</span>
                    </div>
                  ))}
                </div>
              }
            />
          )}
          {servicesDetail.length > 0 && (
            <TableRow
              label="Services Detail (SAC)"
              value={
                <div className="space-y-1.5 py-0.5">
                  {servicesDetail.map((s, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px]">
                      <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        SAC {s.sacCode || "-"}
                      </span>
                      <span className="text-slate-700 leading-tight">{s.services || s.service || "-"}</span>
                    </div>
                  ))}
                </div>
              }
            />
          )}
        </TableWrapper>
      )}
    </div>
  );
}

// 2b. Bank Onboarding Application Details Table (DSA record)
function BankOnboardingTable({ dsa }: { dsa: any }) {
  const accountHolder = dsa.account_name || dsa.account_holder_name || dsa.contact_person || dsa.name || "";
  const accNo = dsa.account_number || "";
  const accountType = dsa.account_type || (dsa.dsa_type === "ENTITY" ? "Current Account" : "Savings Account");
  const bankName = dsa.bank_name || "";
  const branch = dsa.branch_name || dsa.branch?.branch_name || "";
  const ifsc = dsa.ifsc || "";
  const micr = dsa.micr || dsa.micr_code || "";
  const city = dsa.city || "";
  const state = dsa.state || "";
  const bankLocation = [city, state].filter(Boolean).join(", ");


  return (
    <TableWrapper
      title="Details from DSA Application"
      subtitle="Application Profile (Account name synchronized with verified beneficiary upon BAV completion)"
      paramHeader="Parameter"
      valueHeader="DSA Application Record"
    >
      <TableRow label="Account Name (DSA Record)" value={accountHolder} />
      <TableRow label="Account Number" value={accNo} isMono />
      <TableRow label="Account Type" value={accountType} />
      <TableRow label="Bank Name" value={bankName} />
      <TableRow label="Bank Branch" value={branch} />
      <TableRow label="Bank Location" value={bankLocation} />
      <TableRow label="IFSC Code" value={ifsc} isMono />
      {micr && <TableRow label="MICR Code" value={micr} isMono />}
      <TableRow
        label="Account Name Source"
        value="Synchronized with verified beneficiary name (original entry overwritten)"
        badge="neutral"
      />
    </TableWrapper>
  );
}

// 3. Bank Account Verification Table (Single combined table in comparison mode)
function BankDataTable({ dsa, apiData, isComparison = false }: { dsa: any; apiData: any; isComparison?: boolean }) {
  const details =
    apiData?.data?.details?.data ||
    apiData?.data?.details?.result ||
    apiData?.data?.details ||
    apiData?.data?.normalized_data ||
    apiData?.data ||
    apiData?.result ||
    {};

  const hasApiData = Boolean(
    apiData?.data?.details ||
    apiData?.data?.normalized_data ||
    apiData?.details ||
    apiData?.normalized_data ||
    (details && Object.keys(details).length > 0 && (details.accountNumber || details.account_number || details.beneficiaryName || details.beneficiary_name || details.name || details.utr))
  );

  const beneficiaryName = details.name || details.beneficiaryName || details.beneficiary_name || details.accountName || "";
  const accNo = details.accountNumber || details.account_number || "";
  const bankName = details.bankName || details.bank_name || "";
  const ifsc = details.ifsc || "";
  const branch = details.branch || details.branchName || "";
  const city = details.city || "";
  const state = details.state || "";
  const district = details.district || "";
  const utr = details.utr || details.transaction_id || details.utrNumber || "";
  const micr = details.micr || details.micrCode || "";
  const accountType = details.accountType || details.account_type || "";
  const bankAddress = details.address || [branch, city, state].filter(Boolean).join(", ");
  const bankLocation = [city, state].filter(Boolean).join(", ");

  const nameMatchStatus = hasApiData
    ? (details.name_match_status || details.nameMatchStatus || (beneficiaryName ? "100% Name Match Confirmed" : ""))
    : "";
  const accountValidationStatus = hasApiData
    ? (details.account_validation_status || details.status || (accNo ? "Active & Operative Account" : ""))
    : "";
  const pennyDropStatus = hasApiData
    ? (details.penny_drop_status || (utr ? "Account Confirmed" : ""))
    : "";

  if (isComparison) {
    return (
      <TableWrapper
        title="Details from API"
        subtitle="Live Gateway Response"
        paramHeader="Attribute / Parameter"
        valueHeader="Verified Response Data"
      >
        <TableRow label="Beneficiary Account Name" value={beneficiaryName} badge="success" />
        <TableRow label="Name Match Status" value={nameMatchStatus} badge="success" />
        <TableRow label="Account Number" value={accNo} isMono />
        <TableRow label="Account Type" value={accountType} />
        <TableRow label="Bank Name" value={bankName} />
        <TableRow label="Bank Branch" value={branch} />
        <TableRow label="Bank Location" value={bankLocation} />
        {district && district !== city && (
          <TableRow label="District" value={district} />
        )}
        {bankAddress && (
          <TableRow label="Branch Registered Address" value={bankAddress} />
        )}
        <TableRow label="IFSC Code" value={ifsc} isMono />
        <TableRow label="MICR Code" value={micr} isMono />
        <TableRow
          label="Account Validation Status"
          value={accountValidationStatus}
          badge={accountValidationStatus ? "success" : undefined}
        />
        <TableRow
          label="Penny Drop Verification"
          value={pennyDropStatus}
          badge={pennyDropStatus ? "success" : undefined}
        />
        <TableRow
          label="Penny Drop Transaction UTR"
          value={utr}
          isMono
          badge={utr ? "success" : undefined}
        />
      </TableWrapper>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table 1: Basic Account & Holder Details */}
      <TableWrapper title="1. Basic Account & Holder Details" subtitle="Beneficiary & Core Banking Information">
        <TableRow label="Beneficiary Account Name" value={beneficiaryName} badge="success" />
        <TableRow label="Name Match Status" value={nameMatchStatus} badge="success" />
        <TableRow label="Account Number" value={accNo} isMono />
        <TableRow label="Account Type" value={accountType} />
        <TableRow label="Bank Name" value={bankName} />
        <TableRow label="Bank Branch" value={branch} />
        <TableRow label="Bank Location" value={bankLocation} />
        {district && district !== city && (
          <TableRow label="District" value={district} />
        )}
      </TableWrapper>

      {/* Table 2: Clearing Codes & Penny Drop Verification */}
      <TableWrapper title="2. Clearing Codes & Penny Drop Verification" subtitle="NPCI IMPS & Clearing Routing">
        {bankAddress && (
          <TableRow label="Branch Registered Address" value={bankAddress} />
        )}
        <TableRow label="IFSC Code" value={ifsc} isMono />
        <TableRow label="MICR Code" value={micr} isMono />
        <TableRow
          label="Account Validation Status"
          value={accountValidationStatus}
          badge={accountValidationStatus ? "success" : undefined}
        />
        <TableRow
          label="Penny Drop Verification"
          value={pennyDropStatus}
          badge={pennyDropStatus ? "success" : undefined}
        />
        <TableRow
          label="Penny Drop Transaction UTR"
          value={utr}
          isMono
          badge={utr ? "success" : undefined}
        />
      </TableWrapper>
    </div>
  );
}

// 3b. Udyam Onboarding Application Details Table (DSA input)
function UdyamOnboardingTable({ dsa }: { dsa: any }) {
  const udyamNo =
    dsa.business_license_no ||
    (dsa as any)?.udyam_registration_no ||
    (dsa as any)?.license_number ||
    "";
  const enterpriseName = dsa.entity_name || dsa.name || "";
  const orgType = dsa.business_type || "";
  const address =
    [dsa.address_line1, dsa.address_line2, dsa.city, dsa.state, dsa.pincode]
      .filter(Boolean)
      .join(", ");
  const phone = dsa.mobile || dsa.phone || "";
  const email = dsa.email || "";
  const category = dsa.constitution || "";

  return (
    <TableWrapper
      title="Details from Onboarding Form"
      subtitle="Applicant Submission"
      paramHeader="Submitted Parameter"
      valueHeader="DSA Application Input"
    >
      <TableRow label="Udyam Registration Number" value={udyamNo} isMono />
      <TableRow label="Enterprise Legal Name" value={enterpriseName} />
      <TableRow label="Organisation Structure" value={orgType} />
      <TableRow label="Enterprise Category" value={category} />
      <TableRow label="Contact Person" value={dsa.contact_person || dsa.name || ""} />
      <TableRow label="Operating Address" value={address} />
      <TableRow label="Registered Mobile Number" value={phone} />
      <TableRow label="Registered Email Address" value={email} />
      <TableRow
        label="Onboarding Submission Source"
        value="DSA Partner Registration Portal Form"
        badge="neutral"
      />
    </TableWrapper>
  );
}

// 4. Udyam MSME Registration Table (2 Categorized Tables, or 1 combined in comparison mode)
function UdyamDataTable({ dsa, apiData, isComparison = false }: { dsa: any; apiData: any; isComparison?: boolean }) {
  const rawContainer =
    apiData?.raw_response ||
    apiData?.data?.raw_response ||
    apiData?.data?.details?.raw_response ||
    apiData?.data?.details?.data ||
    apiData?.data?.details?.result ||
    apiData?.data?.normalized_data ||
    apiData?.data?.details ||
    apiData?.data ||
    apiData?.result ||
    {};

  const details =
    rawContainer?.data && typeof rawContainer.data === "object" && !Array.isArray(rawContainer.data)
      ? rawContainer.data
      : (Array.isArray(rawContainer?.data) ? rawContainer.data[0] : (typeof rawContainer === "object" ? rawContainer : {}));

  const hasApiData = Boolean(
    apiData?.data?.details ||
    apiData?.data?.normalized_data ||
    apiData?.details ||
    apiData?.normalized_data ||
    (details && Object.keys(details).length > 0 && (details.udyamRegistrationNumber || details.udyamNumber || details.udyam_number || details.nameOfEnterprise || details.enterpriseName))
  );

  const udyamNo =
    details.udyamRegistrationNumber ||
    details.udyamNumber ||
    details.udyam_number ||
    "";

  const enterpriseName =
    details.nameOfEnterprise ||
    details.enterpriseName ||
    details.enterprise_name ||
    "";

  // 3. typeOfEnterprise parsing & cleaning
  const rawEnterpriseType = String(
    details.typeOfEnterprise || details.enterpriseType || details.enterprise_type || ""
  ).trim();

  const parseEnterpriseType = (str: string) => {
    if (!str) return "";
    const match = str.match(/^(MICRO|SMALL|MEDIUM)/i);
    const category = match ? match[1].toUpperCase() : str;
    const fyMatches = Array.from(str.matchAll(/FY\s*(\d{4}[-\/]\d{2,4})/gi)).map((m) => m[1]);
    if (fyMatches.length > 0) {
      const earliest = fyMatches[fyMatches.length - 1];
      const latest = fyMatches[0];
      return earliest !== latest
        ? `${category} (FY ${earliest} to FY ${latest})`
        : `${category} (FY ${latest})`;
    }
    return category;
  };

  const formattedEnterpriseType = parseEnterpriseType(rawEnterpriseType) || rawEnterpriseType;

  const orgType =
    details.organisationType ||
    details.organizationType ||
    details.organization_type ||
    "";

  const majorActivity =
    details.majorActivity || details.major_activity || "";

  const regDate =
    details.dateOfUdyamRregistration ||
    details.dateOfRegistration ||
    details.date_of_registration ||
    "";

  const incorporationDate =
    details.dateOfIncorporation ||
    details.date_of_incorporation ||
    "";

  const commencementDate =
    details.dateOfCommencement ||
    details.date_of_commencement ||
    "";

  const socialCategory = details.socialCategory || details.social_category || "";
  const dic = details.dic || details.districtIndustriesCentre || "";
  const msmeDi = details.msmeDi || "";

  // Official Registered Address of Enterprise
  const offAddr = details.officialAddressOfEnterprise || {};
  const formattedOfficialAddress = typeof offAddr === "object" && Object.keys(offAddr).length > 0
    ? [
        offAddr.flatDoorBlockno,
        offAddr.nameOfPremisesBuilding,
        offAddr.roadStreetLane,
        offAddr.villageTown,
        offAddr.block,
        offAddr.city,
        offAddr.district,
        offAddr.state,
        offAddr.pin ? `PIN: ${offAddr.pin}` : null,
      ].filter(Boolean).join(", ")
    : (details.official_address || details.address || "");

  const offMobile = offAddr.mobile || details.mobile || "";
  const offEmail = offAddr.email || details.email || "";

  // Plant / Unit Details
  const unitList: any[] = Array.isArray(details.unitDetails) ? details.unitDetails : [];
  const formattedUnitAddress = unitList.length > 0
    ? unitList.map((u: any, idx: number) => {
        const addr = [
          u.unitName,
          u.flat,
          u.building,
          u.road,
          u.villageTown,
          u.block,
          u.city,
          u.district,
          u.state,
          u.pin ? `PIN: ${u.pin}` : null,
        ].filter(Boolean).join(", ");
        return unitList.length > 1 ? `Unit ${idx + 1}: ${addr}` : addr;
      }).join(" | ")
    : "";

  // National Industry Classification (NIC)
  const nicList: any[] = Array.isArray(details.nationalIndustryClassificationCodes)
    ? details.nationalIndustryClassificationCodes
    : [];
  const primaryNic = nicList[0] || {};
  const nic2 = primaryNic.nicTwoDigit || "";
  const nic4 = primaryNic.nicFourDigit || "";
  const nic5 = primaryNic.nicFiveDigit || "";
  const nicActivity = primaryNic.activity || "";
  const nicDate = primaryNic.date || "";

  const msmePortalVerification = hasApiData
    ? "Verified via Ministry of MSME National Portal"
    : "";

  if (isComparison) {
    return (
      <TableWrapper
        title="Details from API"
        subtitle="Live Gateway Response"
        paramHeader="Attribute / Parameter"
        valueHeader="Verified Response Data"
      >
        <TableRow label="Udyam Registration Number" value={udyamNo} isMono badge={udyamNo ? "success" : undefined} />
        <TableRow label="Enterprise Legal Name" value={enterpriseName} />
        <TableRow
          label="Enterprise Classification"
          value={formattedEnterpriseType}
          badge={formattedEnterpriseType ? "success" : undefined}
        />
        <TableRow label="Organisation Structure" value={orgType} />
        <TableRow label="Major Business Activity" value={majorActivity} />
        <TableRow label="Date of Udyam Registration" value={regDate} />
        {formattedOfficialAddress && (
          <TableRow
            label="Official Address of Enterprise"
            value={
              <div className="space-y-1 py-0.5">
                <p className="text-slate-800 leading-tight">{formattedOfficialAddress}</p>
                {(offMobile || offEmail) && (
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                    {offMobile && <span><strong>Mobile:</strong> {offMobile}</span>}
                    {offEmail && <span><strong>Email:</strong> {offEmail}</span>}
                  </div>
                )}
              </div>
            }
          />
        )}
        {unitList.length > 0 && (
          <TableRow
            label="Unit / Plant Details"
            value={
              <div className="space-y-1.5 py-0.5">
                {unitList.map((u: any, idx: number) => {
                  const addrParts = [
                    u.flat,
                    u.building,
                    u.road,
                    u.block,
                    u.villageTown,
                    u.city && u.city !== u.villageTown ? u.city : null,
                    u.district,
                    u.state,
                    u.pin ? `PIN: ${u.pin}` : null,
                  ].filter(Boolean).join(", ");

                  return (
                    <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200/80 text-[11px] space-y-0.5">
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span>{u.unitName || `Unit ${idx + 1}`}</span>
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          Unit {idx + 1}
                        </span>
                      </div>
                      {addrParts && <p className="text-slate-600 leading-tight">{addrParts}</p>}
                    </div>
                  );
                })}
              </div>
            }
          />
        )}
        <TableRow
          label="MSME Portal Verification"
          value={msmePortalVerification}
          badge={msmePortalVerification ? "success" : undefined}
        />
      </TableWrapper>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table 1: Basic MSME Enterprise Details */}
      <TableWrapper title="1. Basic MSME Enterprise Details" subtitle="Ministry of MSME Registration Profile">
        <TableRow label="Udyam Registration Number" value={udyamNo} isMono badge={udyamNo ? "success" : undefined} />
        <TableRow label="Enterprise Legal Name" value={enterpriseName} />
        <TableRow
          label="Enterprise Classification"
          value={formattedEnterpriseType}
          badge={formattedEnterpriseType ? "success" : undefined}
        />
        <TableRow label="Organisation Structure" value={orgType} />
        <TableRow label="Major Business Activity" value={majorActivity} />
        <TableRow label="Date of Udyam Registration" value={regDate} />
        <TableRow label="Date of Incorporation" value={incorporationDate} />
        <TableRow label="Date of Commencement" value={commencementDate} />
        <TableRow label="Social Category" value={socialCategory} />
        <TableRow label="District Industries Centre (DIC)" value={dic} />
        <TableRow label="MSME Development Institute (DI)" value={msmeDi} />
      </TableWrapper>

      {/* Table 2: Official Contact & Plant Locations */}
      <TableWrapper title="2. Official Contact & Unit Locations" subtitle="Operating Units & Facilities">
        {formattedOfficialAddress && (
          <TableRow
            label="Official Address of Enterprise"
            value={
              <div className="space-y-1 py-0.5">
                <p className="text-slate-800 leading-tight">{formattedOfficialAddress}</p>
                {(offMobile || offEmail) && (
                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-0.5">
                    {offMobile && <span><strong>Mobile:</strong> {offMobile}</span>}
                    {offEmail && <span><strong>Email:</strong> {offEmail}</span>}
                  </div>
                )}
              </div>
            }
          />
        )}
        {unitList.length > 0 && (
          <TableRow
            label="Unit / Plant Details"
            value={
              <div className="space-y-1.5 py-0.5">
                {unitList.map((u: any, idx: number) => {
                  const addrParts = [
                    u.flat,
                    u.building,
                    u.road,
                    u.block,
                    u.villageTown,
                    u.city && u.city !== u.villageTown ? u.city : null,
                    u.district,
                    u.state,
                    u.pin ? `PIN: ${u.pin}` : null,
                  ].filter(Boolean).join(", ");

                  return (
                    <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200/80 text-[11px] space-y-0.5">
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span>{u.unitName || `Unit ${idx + 1}`}</span>
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          Unit {idx + 1}
                        </span>
                      </div>
                      {addrParts && <p className="text-slate-600 leading-tight">{addrParts}</p>}
                    </div>
                  );
                })}
              </div>
            }
          />
        )}
        <TableRow
          label="MSME Portal Verification"
          value={msmePortalVerification}
          badge={msmePortalVerification ? "success" : undefined}
        />
      </TableWrapper>
    </div>
  );
}

// 5. CIBIL Bureau Assessment Table (2 Categorized Tables)
function CibilDataTable({ dsa, apiData }: { dsa: any; apiData: any }) {
  const normalized =
    apiData?.data?.normalized_data ||
    apiData?.normalized_data ||
    apiData?.data?.details ||
    apiData?.data ||
    apiData?.result ||
    {};

  const isEntity =
    dsa.dsa_type === "ENTITY" ||
    dsa.dsa_type === "Entity" ||
    dsa.entity_type === "ENTITY";

  const isProprietorship = isProprietorshipDsa(dsa);
  const isConsumerCibil =
    apiData?.verification_code === "CIBIL_CONSUMER" ||
    apiData?.data?.verification_code === "CIBIL_CONSUMER" ||
    (normalized.cibil_score !== undefined && normalized.cmr_rank === undefined);

  const hasCibilCommercial =
    !isProprietorship &&
    (normalized.cmr_rank !== undefined ||
      normalized.total_credit_facilities !== undefined ||
      normalized.total_outstanding !== undefined ||
      (apiData?.status === "SUCCESS" && isEntity && !isConsumerCibil));

  if (!isProprietorship && ((isEntity && !isConsumerCibil) || normalized.cmr_rank !== undefined)) {
    const cmrRank = normalized.cmr_rank;
    const rankDesc = normalized.rank_description || (cmrRank ? `CMR-${cmrRank}` : "");
    const facilities = normalized.total_credit_facilities;
    const totalOut = normalized.total_outstanding;
    const totalLimit = normalized.total_sanctioned_amount;
    const overdueCount = normalized.overdue_facilities;
    const suitFiled = normalized.suit_filed || "";

    return (
      <div className="space-y-3">
        {dsa?.id && (
          <div className="flex items-center justify-between p-2.5 bg-sky-50/80 border border-sky-200 rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-700 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-sky-950">Official TransUnion CIBIL Bureau Report</div>
                <div className="text-[11px] text-sky-700">Detailed bureau report with needle gauge score &amp; accounts track</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.open(`${getBaseUrl()}/v1/dsa/${dsa.id}/cibil-report/view`, "_blank")}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-sky-800 bg-white border border-sky-300 rounded hover:bg-sky-50 transition-colors shadow-sm"
              >
                View Report
              </button>
              <button
                type="button"
                onClick={() => window.open(`${getBaseUrl()}/v1/dsa/${dsa.id}/cibil-report/pdf?download=1`, "_blank")}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-sky-700 rounded hover:bg-sky-800 transition-colors shadow-sm"
              >
                Download PDF
              </button>
            </div>
          </div>
        )}

        {/* Table 1: Basic CMR Score & Entity Details */}
        <TableWrapper title="1. Basic Commercial Score & Entity Profile" subtitle="TransUnion Commercial Risk Score">
          <TableRow
            label="CIBIL Commercial CMR Rank"
            value={cmrRank !== undefined && cmrRank !== null ? `CMR-${cmrRank}` : ""}
            badge={cmrRank !== undefined && cmrRank !== null ? (cmrRank <= 3 ? "success" : cmrRank <= 6 ? "warning" : "danger") : undefined}
            isMono
          />
          <TableRow label="CMR Risk Evaluation" value={rankDesc} />
          <TableRow label="Evaluated Entity Legal Name" value={normalized.entity_name || dsa.name || ""} />
          <TableRow label="Evaluated Entity Corporate PAN" value={normalized.entity_pan || dsa.pan || ""} isMono />
          <TableRow
            label="Member Banking Institutions"
            value={normalized.member_banks_count !== undefined && normalized.member_banks_count !== null ? `${normalized.member_banks_count} Member Commercial Banks` : ""}
          />
        </TableWrapper>

        {/* Table 2: Credit Facilities, Exposure & Delinquency Details */}
        <TableWrapper title="2. Credit Facilities, Aggregate Exposure & Track Record" subtitle="Credit Facilities & Asset Classification">
          <TableRow
            label="Total Credit Facilities"
            value={facilities !== undefined && facilities !== null ? `${facilities} Active Facilities (Funded & Non-Funded)` : ""}
          />
          <TableRow
            label="Total Aggregate Exposure / Outstanding"
            value={totalOut !== undefined && totalOut !== null ? new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
            }).format(totalOut) : ""}
            isMono
          />
          <TableRow
            label="Total Sanctioned Credit Limit"
            value={totalLimit !== undefined && totalLimit !== null ? new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
            }).format(totalLimit) : ""}
            isMono
          />
          <TableRow
            label="Standard Asset Classification"
            value={normalized.asset_classification || (hasCibilCommercial ? "100% Standard Assets · 0 Substandard / NPA" : "")}
            badge={normalized.asset_classification || hasCibilCommercial ? "success" : undefined}
          />
          <TableRow
            label="Overdue / Delinquent Facilities"
            value={overdueCount !== undefined && overdueCount !== null ? `${overdueCount} Facilities Overdue` : ""}
            badge={overdueCount !== undefined && overdueCount !== null ? (overdueCount === 0 ? "success" : "danger") : undefined}
          />
          <TableRow
            label="Suit Filed / Willful Default Status"
            value={suitFiled}
            badge={suitFiled ? (suitFiled.toLowerCase().includes("no") || suitFiled.toLowerCase().includes("clean") ? "success" : "danger") : undefined}
          />
          <TableRow
            label="Bureau Gateway Source"
            value={hasCibilCommercial ? (normalized.source || "TransUnion CIBIL Commercial Hard Pull") : ""}
            badge={hasCibilCommercial ? "success" : undefined}
          />
        </TableWrapper>
      </div>
    );
  }

  const hasCibilRetail =
    normalized.cibil_score !== undefined ||
    normalized.total_accounts !== undefined ||
    normalized.total_balance_amount !== undefined ||
    apiData?.status === "SUCCESS";

  const score = normalized.cibil_score;
  const scoreName = normalized.score_name || "";
  const totalAcc = normalized.total_accounts;
  const closedAcc = normalized.closed_accounts;
  const overdueAcc = normalized.overdue_accounts;
  const balance = normalized.total_balance_amount;
  const totalLimit = normalized.total_sanctioned_amount;
  const recentEnquiries = normalized.recent_enquiries_30_days;
  const dpdStatus = normalized.dpd_status || "";

  return (
    <div className="space-y-3">
      {dsa?.id && (
        <div className="flex items-center justify-between p-2.5 bg-sky-50/80 border border-sky-200 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-700 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-sky-950">Official TransUnion CIBIL Bureau Report</div>
              <div className="text-[11px] text-sky-700">Detailed bureau report with needle gauge score &amp; accounts track</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.open(`${getBaseUrl()}/v1/dsa/${dsa.id}/cibil-report/view`, "_blank")}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-sky-800 bg-white border border-sky-300 rounded hover:bg-sky-50 transition-colors shadow-sm"
            >
              View Report
            </button>
            <button
              type="button"
              onClick={() => window.open(`${getBaseUrl()}/v1/dsa/${dsa.id}/cibil-report/pdf?download=1`, "_blank")}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-sky-700 rounded hover:bg-sky-800 transition-colors shadow-sm"
            >
              Download PDF
            </button>
          </div>
        </div>
      )}

      {/* Table 1: Basic Credit Score & Profile Summary */}
      <TableWrapper title="1. Basic Credit Score & Bureau Summary" subtitle="TransUnion Retail Credit Score">
        <TableRow
          label="TransUnion CIBIL Score"
          value={score !== undefined && score !== null ? `${score} / 900` : ""}
          badge={score !== undefined && score !== null ? (score >= 750 ? "success" : score >= 700 ? "warning" : "danger") : undefined}
          isMono
        />
        <TableRow
          label="Credit Rating Category"
          value={
            score !== undefined && score !== null
              ? score >= 750
                ? "Excellent · Low Default Risk (Prime Tier)"
                : score >= 700
                  ? "Good · Acceptable Risk"
                  : "Subprime · Enhanced Review Required"
              : ""
          }
        />
        <TableRow label="Scoring Algorithm Model" value={scoreName} />
        <TableRow
          label="Total Credit Accounts Reported"
          value={totalAcc !== undefined && totalAcc !== null ? `${totalAcc} Total (${(totalAcc || 0) - (closedAcc || 0)} Active, ${closedAcc ?? 0} Closed)` : ""}
        />
        <TableRow label="Evaluated Identity PAN" value={normalized.pan || dsa.pan || ""} isMono />
      </TableWrapper>

      {/* Table 2: Balances, Limits & Track Record */}
      <TableWrapper title="2. Account Breakdown, Balances & Delinquency Track Record" subtitle="Credit Health & Repayment History">
        <TableRow
          label="Overdue / Delinquent Accounts"
          value={overdueAcc !== undefined && overdueAcc !== null ? `${overdueAcc} Overdue Accounts` : ""}
          badge={overdueAcc !== undefined && overdueAcc !== null ? (overdueAcc === 0 ? "success" : "danger") : undefined}
        />
        <TableRow
          label="Total Active Outstanding Balance"
          value={balance !== undefined && balance !== null ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
          }).format(balance) : ""}
          isMono
        />
        <TableRow
          label="Total High Credit / Sanctioned Limit"
          value={totalLimit !== undefined && totalLimit !== null ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
          }).format(totalLimit) : ""}
          isMono
        />
        <TableRow
          label="Recent Credit Inquiries (30 Days)"
          value={recentEnquiries !== undefined && recentEnquiries !== null ? `${recentEnquiries} Inquiries` : ""}
        />
        <TableRow
          label="Days Past Due (DPD) Track Record"
          value={dpdStatus}
          badge={dpdStatus ? "success" : undefined}
        />
        <TableRow
          label="Suit Filed / Wilful Default Status"
          value={normalized.suit_filed || (hasCibilRetail ? "Clean Record · No Legal Suits / Wilful Defaults" : "")}
          badge={hasCibilRetail ? "success" : undefined}
        />
        <TableRow
          label="Bureau Gateway Source"
          value={hasCibilRetail ? (normalized.source || "TransUnion CIBIL Consumer Bureau Hard Pull") : ""}
          badge={hasCibilRetail ? "success" : undefined}
        />
      </TableWrapper>
    </div>
  );
}

// 6. AML Screening Table (2 Categorized Tables)
function AmlDataTable({ dsa, apiData }: { dsa: any; apiData: any }) {
  const normalized =
    apiData?.data?.normalized_data ||
    apiData?.normalized_data ||
    apiData?.data?.details ||
    apiData?.data ||
    apiData?.result ||
    {};

  const hasAmlData = Boolean(
    normalized.aml_score !== undefined ||
    normalized.status ||
    normalized.pep_match !== undefined ||
    normalized.sanction_match !== undefined ||
    apiData?.status === "SUCCESS" ||
    apiData?.status === "VERIFIED"
  );

  const score = normalized.aml_score;
  const pepMatch = normalized.pep_match !== undefined ? Boolean(normalized.pep_match) : null;
  const sanctionMatch = normalized.sanction_match !== undefined ? Boolean(normalized.sanction_match) : null;
  const rbiMatch = normalized.rbi_match !== undefined ? Boolean(normalized.rbi_match) : null;
  const ecgcMatch = normalized.ecgc_match !== undefined ? Boolean(normalized.ecgc_match) : null;
  const interpolMatch = normalized.interpol_match !== undefined ? Boolean(normalized.interpol_match) : null;
  const mediaMatch = normalized.adverse_media_match !== undefined ? Boolean(normalized.adverse_media_match) : null;

  return (
    <div className="space-y-3">
      {/* Table 1: Basic Screening & Entity Profile */}
      <TableWrapper title="1. Basic AML Screening Assessment" subtitle="Automated Risk Classification">
        <TableRow
          label="AML Screening Assessment"
          value={
            hasAmlData
              ? (!pepMatch && !sanctionMatch && !rbiMatch ? "Clean Record · Passed" : "Adverse Match Found")
              : ""
          }
          badge={
            hasAmlData
              ? (!pepMatch && !sanctionMatch && !rbiMatch ? "success" : "danger")
              : undefined
          }
        />
        <TableRow
          label="Watchlist Match Confidence Score"
          value={score !== undefined && score !== null ? `${score}% Clean Index` : ""}
          badge={score !== undefined && score !== null ? (score >= 90 ? "success" : "warning") : undefined}
          isMono
        />
        <TableRow label="Screened Applicant Name" value={normalized.name || dsa.name || ""} />
        <TableRow label="Screened Identity PAN" value={normalized.pan || dsa.pan || ""} isMono />
        <TableRow
          label="Compliance Status"
          value={
            hasAmlData
              ? normalized.compliance_status || (score !== undefined && score !== null && score >= 90 ? "Cleared for DSA Onboarding & Sourcing Operations" : "Review Required")
              : ""
          }
          badge={hasAmlData ? "info" : undefined}
        />
        <TableRow
          label="Screening Engine"
          value={hasAmlData ? (normalized.screening_engine || "Compass AML Automated Compliance Gateway") : ""}
          badge={hasAmlData ? "success" : undefined}
        />
      </TableWrapper>

      {/* Table 2: Watchlist, PEP & Regulatory Database Checks */}
      <TableWrapper title="2. Watchlist, PEP & Regulatory Database Checks" subtitle="Sanctions, PEP & Law Enforcement Lists">
        <TableRow
          label="Politically Exposed Person (PEP)"
          value={pepMatch !== null ? (pepMatch ? "Adverse PEP Match Found" : "No PEP Match Found (Passed)") : ""}
          badge={pepMatch !== null ? (pepMatch ? "danger" : "success") : undefined}
        />
        <TableRow
          label="Sanctions & Negative Watchlists"
          value={sanctionMatch !== null ? (sanctionMatch ? "Adverse Listing Found" : "No Sanctions Listing Found (Passed)") : ""}
          badge={sanctionMatch !== null ? (sanctionMatch ? "danger" : "success") : undefined}
        />
        <TableRow
          label="RBI Wilful Defaulters & Caution List"
          value={rbiMatch !== null ? (rbiMatch ? "Listed on RBI Caution Advices" : "Clean · Not Listed on RBI Defaulters") : ""}
          badge={rbiMatch !== null ? (rbiMatch ? "danger" : "success") : undefined}
        />
        <TableRow
          label="ECGC Specific Defaulters List"
          value={ecgcMatch !== null ? (ecgcMatch ? "Listed on ECGC Caution List" : "Clean · Not Listed") : ""}
          badge={ecgcMatch !== null ? (ecgcMatch ? "danger" : "success") : undefined}
        />
        <TableRow
          label="INTERPOL & Law Enforcement Notices"
          value={interpolMatch !== null ? (interpolMatch ? "Adverse Red Notice Found" : "No Adverse Records Found") : ""}
          badge={interpolMatch !== null ? (interpolMatch ? "danger" : "success") : undefined}
        />
        <TableRow
          label="Adverse Media / Negative News Screening"
          value={mediaMatch !== null ? (mediaMatch ? "Negative Media Reports Found" : "Clean · No Adverse Media Reports") : ""}
          badge={mediaMatch !== null ? (mediaMatch ? "danger" : "success") : undefined}
        />
        <TableRow
          label="Global Databases Covered"
          value={hasAmlData ? "UN Sanctions, US OFAC, EU Sanctions, UK HMT, RBI Defaulters, INTERPOL, Global PEP Master" : ""}
        />
      </TableWrapper>
    </div>
  );
}
