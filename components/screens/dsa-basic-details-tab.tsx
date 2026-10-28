"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Phone,
  CreditCard,
  MapPin,
  Briefcase,
  BadgeIndianRupee,
  Users,
  FileText,
  ShieldCheck,
  Check,
  Pencil,
  X,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { Button, Input, Label, Select, StatusBadge } from "@/components/ui/primitives";
import { cn, formatDate } from "@/lib/utils";

const BUSINESS_LICENSE_OPTIONS = [
  { key: "SHOP_ACT", label: "Shop Act" },
  { key: "UDYAM", label: "Udyam" },
];

function CheckboxDropdown({
  id,
  options,
  selectedKeys,
  onChange,
  placeholder = "Select Business License(s)",
  className,
}: {
  id?: string;
  options: { key: string; label: string }[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleToggle = (key: string) => {
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter((k) => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.key));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const selectedLabels = React.useMemo(() => {
    return selectedKeys
      .map((k) => options.find((o) => o.key === k)?.label || k)
      .filter(Boolean);
  }, [selectedKeys, options]);

  return (
    <div className={`relative w-full ${className || ""}`} ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 disabled:pointer-events-none disabled:bg-slate-50"
      >
        <div className="flex items-center gap-1.5 overflow-hidden text-left truncate">
          {selectedKeys.length === 0 ? (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 shrink-0">
                {selectedKeys.length} selected
              </span>
              <span className="truncate text-slate-700 font-medium max-w-[180px] sm:max-w-[260px]">
                {selectedLabels.join(", ")}
              </span>
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5">
          <div className="flex items-center justify-between pb-2 px-1 border-b border-slate-100 text-[11px]">
            <span className="font-semibold text-slate-600">
              {selectedKeys.length} of {options.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-1.5 max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {options.map((opt) => {
              const isChecked = selectedKeys.includes(opt.key);
              return (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-blue-50 text-blue-900 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggle(opt.key)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="flex-1 select-none leading-tight">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-3.5 sm:grid-cols-2", className)}>{children}</div>;
}

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-slate-50/60 border border-slate-200/70 px-4 py-3 hover:bg-slate-50/90 hover:border-slate-300/80 transition-all",
        className,
      )}
    >
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-xs sm:text-sm font-semibold text-slate-800 break-words leading-relaxed">
        {value || "—"}
      </div>
    </div>
  );
}

function SectionBlock({
  icon: Icon,
  iconColor = "text-blue-600",
  title,
  action,
  children,
}: {
  icon?: any;
  iconColor?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />}
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            {title}
          </h4>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
import { getDsaDisplayStatus } from "./dsa-pages";
import type { BranchOption } from "@/types/dsa";
import { maskAadhaar } from "@/lib/mask-aadhaar";

/**
 * Read-only display of an Aadhaar number. Always masked to the last 4 digits —
 * this is static text, so the full value must never reach the DOM.
 */
function formatAadhaarNumber(val?: string): string {
  return maskAadhaar(val);
}

export type DetailBlockKey =
  | "sourcing"
  | "applicant"
  | "contact"
  | "statutory"
  | "branch"
  | "address"
  | "bank"
  | "references"
  | "stakeholders"
  | "associate_concerns";

export interface SupportingFile {
  document_type: string;
  file: File;
  label: string;
}

/**
 * Doc-linked edit fields: changing these values requires a supporting
 * document upload so the checker can verify the new value.
 * key = formData field, value = { document_type, label }.
 */
export const DOC_LINKED_FIELDS: Record<string, { document_type: string; label: string }> = {
  education_qualification: { document_type: "education_certificate", label: "Educational Qualification Certificate" },
  aadhaar_no: { document_type: "aadhaar_card", label: "Aadhaar Card" },
  pan: { document_type: "pan_card", label: "PAN Card" },
  gst: { document_type: "gst_certificate", label: "GST Certificate" },
  udyam_no: { document_type: "business_license_udyam", label: "Udyam Registration Certificate" },
  shop_act_no: { document_type: "business_license_shop_act", label: "Shop Act License" },
  experience_years: { document_type: "experience_certificate", label: "Experience Certificate" },
  applicant_prior_experience: { document_type: "brief_profile", label: "Brief Profile / Experience Proof" },
};

/** True when the field value differs from the stored DSA value. */
export function isFieldChanged(field: string, formValue: any, dsa: any): boolean {
  const norm = (v: any) => String(v ?? "").trim();
  const dsaVal =
    field === "aadhaar_no"
      ? dsa.aadhaar_no || dsa.aadhaar || ""
      : field === "gst"
        ? dsa.gst || ""
        : dsa[field] ?? "";
  return norm(formValue) !== norm(dsaVal);
}

function SupportingDocInput({
  field,
  file,
  onPick,
  onClear,
}: {
  field: string;
  file?: File | null;
  onPick: (f: File | null) => void;
  onClear: () => void;
}) {
  const linked = DOC_LINKED_FIELDS[field];
  if (!linked) return null;
  return (
    <div className="mt-2 rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-2.5">
      <Label className="text-[11px] font-semibold text-amber-800 mb-1 block">
        Supporting document required — {linked.label} *
      </Label>
      {file ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700 truncate">{file.name}</span>
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-rose-600 hover:underline shrink-0"
          >
            Remove
          </button>
        </div>
      ) : (
        <Input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="text-xs h-8 bg-white"
        />
      )}
    </div>
  );
}

function cleanLicenseValue(val?: string | null): string | null {
  if (!val || typeof val !== "string") return null;
  const parts = val
    .split(",")
    .map((p) => p.replace(/^(shop\s*act|udyam)\s*:\s*/i, "").trim())
    .filter((p) => Boolean(p) && p !== "Standard Regulatory Compliance");
  return parts.length > 0 ? parts.join(", ") : null;
}

interface DsaBasicDetailsTabProps {
  dsa: any;
  canEdit: boolean;
  branches: BranchOption[];
  onSaveBlock: (blockKey: DetailBlockKey, payload: Record<string, any>, supportingFiles?: SupportingFile[]) => Promise<boolean>;
  loading?: boolean;
  isVisitReportUploaded?: boolean;
}

export function DsaBasicDetailsTab({
  dsa,
  canEdit,
  branches,
  onSaveBlock,
  loading = false,
  isVisitReportUploaded = false,
}: DsaBasicDetailsTabProps) {
  const [activeEditBlock, setActiveEditBlock] = useState<DetailBlockKey | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingBlock, setSavingBlock] = useState<DetailBlockKey | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<Record<string, File | null>>({});
  const [isAadhaarFieldFocused, setIsAadhaarFieldFocused] = useState(false);

  const isEntity = dsa.dsa_type === "NON_INDIVIDUAL" || dsa.dsa_type === "ENTITY";

  // Sync first_name + last_name -> contact_person for Individual DSAs
  useEffect(() => {
    if (!isEntity && activeEditBlock === "applicant") {
      const fn = formData.first_name?.trim() || "";
      const ln = formData.last_name?.trim() || "";
      if (fn || ln) {
        const newContact = [fn, ln].filter(Boolean).join(" ");
        if (formData.contact_person !== newContact) {
          setFormData((prev) => ({ ...prev, contact_person: newContact }));
        }
      }
    }
  }, [formData.first_name, formData.last_name, isEntity, activeEditBlock]);

  // Sync age <-> date_of_birth for Individual DSAs
  useEffect(() => {
    if (!isEntity && activeEditBlock === "applicant") {
      const dob = formData.date_of_birth;
      const age = formData.age;
      const today = new Date();
      
      if (dob && !age) {
        // DOB changed, calculate age
        const birthDate = new Date(dob);
        let calcAge = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          calcAge--;
        }
        if (calcAge >= 0 && calcAge < 120 && String(calcAge) !== String(formData.age)) {
          setFormData((prev) => ({ ...prev, age: String(calcAge) }));
        }
      } else if (age && !dob) {
        // Age changed, calculate DOB (approximate - Jan 1 of birth year)
        const ageNum = parseInt(age, 10);
        if (!isNaN(ageNum) && ageNum >= 18 && ageNum <= 100) {
          const birthYear = today.getFullYear() - ageNum;
          const newDob = `${birthYear}-01-01`;
          if (formData.date_of_birth !== newDob) {
            setFormData((prev) => ({ ...prev, date_of_birth: newDob }));
          }
        }
      }
    }
  }, [formData.date_of_birth, formData.age, isEntity, activeEditBlock]);

  const pickSupportingFile = (field: string, f: File | null) =>
    setSupportingFiles((prev) => ({ ...prev, [field]: f }));
  const clearSupportingFile = (field: string) =>
    setSupportingFiles((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

  /** Doc-linked fields in this block whose value changed and need a file. */
  const changedDocFields = (block: DetailBlockKey): string[] => {
    const fieldsByBlock: Record<string, string[]> = {
      applicant: ["education_qualification", "aadhaar_no"],
      statutory: ["pan", "gst", "udyam_no", "shop_act_no", "experience_years", "applicant_prior_experience"],
    };
    return (fieldsByBlock[block] || []).filter((f) => {
      if (f === "gst") {
        const isApp = Boolean(formData.gst_applicable);
        if (!isApp) return false;
        const gstVal = String(formData.gst || "").trim();
        if (!gstVal) return false;
        const wasApp = Boolean(dsa?.gst_applicable);
        return !wasApp || isFieldChanged("gst", formData.gst, dsa);
      }
      if (f === "experience_years") {
        const expNum = Number(formData.experience_years);
        const hasExp = !isNaN(expNum) && expNum > 0;
        if (!hasExp) return false;
        const hadExp = dsa?.experience_years !== undefined && dsa?.experience_years !== null && Number(dsa.experience_years) > 0;
        return !hadExp || isFieldChanged("experience_years", formData.experience_years, dsa);
      }
      if (f === "applicant_prior_experience") {
        const expVal = String(formData.applicant_prior_experience || "").trim().toLowerCase();
        const hasExp = expVal !== "" && !expVal.includes("fresher") && !expVal.includes("no prior");
        if (!hasExp) return false;
        return isFieldChanged("applicant_prior_experience", formData.applicant_prior_experience, dsa);
      }
      if (f === "udyam_no" || f === "shop_act_no") {
        const val = String(formData[f] || "").trim();
        if (!val) return false;
        const selLicenses: string[] = formData.selectedLicenses || [];
        const requiredKey = f === "udyam_no" ? "UDYAM" : "SHOP_ACT";
        if (!selLicenses.includes(requiredKey)) return false;
        return isFieldChanged(f, formData[f], dsa);
      }
      if (!String(formData[f] || "").trim()) {
        return false;
      }
      return isFieldChanged(f, formData[f], dsa);
    });
  };

  // Initialize block form data when entering edit mode
  const startEditing = (block: DetailBlockKey) => {
    setActiveEditBlock(block);
    setErrors({});
    setSupportingFiles({});

    switch (block) {
      case "sourcing":
        setFormData({
          dsa_type: dsa.dsa_type || (isEntity ? "ENTITY" : "INDIVIDUAL"),
          submission_mode: dsa.submission_mode || "BRANCH",
        });
        break;

      case "applicant":
        setFormData({
          applicant_title: dsa.applicant_title || "",
          first_name: dsa.first_name || "",
          middle_name: dsa.middle_name || "",
          last_name: dsa.last_name || "",
          entity_name: dsa.entity_name || dsa.name || "",
          contact_person: dsa.contact_person || "",
          constitution: dsa.constitution || "",
          business_type: dsa.business_type || "",
          nature_of_business: dsa.nature_of_business || "",
          registration_no_llpin_cin: dsa.registration_no_llpin_cin || "",
          date_of_birth: dsa.date_of_birth
            ? String(dsa.date_of_birth).substring(0, 10)
            : dsa.dob || dsa.doi || dsa.date_of_incorporation
              ? String(dsa.dob || dsa.doi || dsa.date_of_incorporation).substring(0, 10)
              : "",
          age: dsa.age || "",
          education_qualification: dsa.education_qualification || "",
          aadhaar_no: dsa.aadhaar_no || dsa.aadhaar || "",
        });
        break;

      case "contact":
        setFormData({
          mobile: dsa.mobile || "",
          email: dsa.email || "",
          landline_no: dsa.landline_no || "",
          office_mobile_no: dsa.office_mobile_no || dsa.key_person_contact_no || "",
          contact_person: dsa.contact_person || "",
          website: dsa.website || "",
        });
        break;

      case "statutory": {
        const proofStr = String(
          dsa.registered_business_proof || dsa.business_license_type || ""
        ).toUpperCase();
        const initialSelectedLicenses: string[] = [];
        if (
          proofStr.includes("SHOP") ||
          Boolean(cleanLicenseValue(dsa.shop_act_no))
        ) {
          initialSelectedLicenses.push("SHOP_ACT");
        }
        if (
          proofStr.includes("UDYAM") ||
          Boolean(cleanLicenseValue(dsa.udyam_no))
        ) {
          initialSelectedLicenses.push("UDYAM");
        }

        setFormData({
          pan: dsa.pan || "",
          gst_applicable: Boolean(dsa.gst_applicable),
          gst: dsa.gst || "",
          selectedLicenses: initialSelectedLicenses,
          registered_business_proof:
            dsa.registered_business_proof ||
            initialSelectedLicenses
              .map((k) => (k === "SHOP_ACT" ? "Shop Act" : "Udyam"))
              .join(","),
          applicant_prior_experience: dsa.applicant_prior_experience || "",
          experience_years:
            dsa.experience_years !== undefined && dsa.experience_years !== null
              ? String(dsa.experience_years)
              : "",
          udyam_no: cleanLicenseValue(dsa.udyam_no) || "",
          shop_act_no: cleanLicenseValue(dsa.shop_act_no) || "",
          business_premises_ownership: dsa.business_premises_ownership || "",
        });
        break;
      }

      case "branch":
        setFormData({
          branch_id: dsa.branch_id || (dsa.branch?.id ? String(dsa.branch.id) : ""),
        });
        break;

      case "address":
        setFormData({
          address: dsa.address || "",
          city: dsa.city || "",
          state: dsa.state || "",
          pincode: dsa.pincode || "",
          business_premises_ownership: dsa.business_premises_ownership || "",
          office_address_different: Boolean(dsa.office_address_different),
          office_address_line_1: dsa.office_address_line_1 || "",
          office_city: dsa.office_city || "",
          office_state: dsa.office_state || "",
          office_pincode: dsa.office_pincode || "",
        });
        break;

      case "bank":
        setFormData({
          bank_name: dsa.bank_name || "",
          account_name: dsa.account_name || dsa.name || "",
          account_number: dsa.account_number || "",
          account_type: dsa.account_type || "",
          ifsc: dsa.ifsc || "",
          last_fy_net_sales: dsa.last_fy_net_sales || "",
          last_fy_net_profit_after_tax: dsa.last_fy_net_profit_after_tax || "",
        });
        break;

      case "references":
        setFormData({
          reference_1_name: dsa.reference_1_name || "",
          reference_1_contact_no: dsa.reference_1_contact_no || "",
          reference_2_name: dsa.reference_2_name || "",
          reference_2_contact_no: dsa.reference_2_contact_no || "",
        });
        break;

      case "stakeholders":
        setFormData({
          stakeholders: Array.isArray(dsa.stakeholders) && dsa.stakeholders.length > 0
            ? dsa.stakeholders.map((sh: any) => ({
                name: sh.name || "",
                stakeholder_type: sh.stakeholder_type || "",
                mobile_no: sh.mobile_no || "",
                pan_no: sh.pan || sh.pan_no || "",
                qualification: sh.qualification || "",
                din_dpin_no: sh.din_dpin_no || sh.aadhaar || "",
              }))
            : [
                {
                  name: "",
                  stakeholder_type: "",
                  mobile_no: "",
                  pan_no: "",
                  qualification: "",
                  din_dpin_no: "",
                },
              ],
        });
        break;

      case "associate_concerns":
        setFormData({
          associate_concerns: Array.isArray(dsa.associate_concerns) && dsa.associate_concerns.length > 0
            ? dsa.associate_concerns.map((ac: any) => ({
                associate_name: ac.name || ac.associate_name || ac.entity_name || "",
                associate_nature_of_business: ac.nature_of_business || ac.associate_nature_of_business || ac.activity || "",
                associate_constitution: ac.relationship || ac.associate_constitution || "",
                associate_key_person_details: ac.bank_name || ac.associate_key_person_details || "",
              }))
            : [
                {
                  associate_name: "",
                  associate_nature_of_business: "",
                  associate_constitution: "",
                  associate_key_person_details: "",
                },
              ],
        });
        break;
    }
  };

  const cancelEditing = () => {
    setActiveEditBlock(null);
    setFormData({});
    setErrors({});
    setSupportingFiles({});
    setIsAadhaarFieldFocused(false);
  };

  const handleDobChange = (val: string) => {
    const next: Record<string, any> = { date_of_birth: val };
    if (val) {
      const birthDate = new Date(val);
      const today = new Date();
      let ageCalc = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        ageCalc--;
      }
      if (ageCalc >= 0 && ageCalc < 120) {
        next.age = ageCalc;
      }
    }
    setFormData((prev) => ({ ...prev, ...next }));
  };

  const validateBlock = (block: DetailBlockKey): boolean => {
    const errs: Record<string, string> = {};

    if (block === "applicant") {
      if (isEntity) {
        if (!formData.entity_name?.trim() && !dsa.entity_name) errs.entity_name = "Entity Name is required";
        if (!formData.contact_person?.trim()) errs.contact_person = "Contact Person is required";
      } else {
        if (!formData.first_name?.trim() && !dsa.first_name) errs.first_name = "First Name is required";
        if (!formData.last_name?.trim() && !dsa.last_name) errs.last_name = "Last Name is required";
        if (formData.aadhaar_no && !/^[0-9Xx* -]{4,14}$/.test(formData.aadhaar_no.trim())) {
          errs.aadhaar_no = "Invalid Aadhaar format";
        }
      }
    }

    if (block === "contact") {
      if (!formData.mobile?.trim()) {
        errs.mobile = "Mobile Number is required";
      } else if (!/^\d{10}$/.test(formData.mobile.replace(/\D/g, ""))) {
        errs.mobile = "Mobile must be 10 digits";
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        errs.email = "Invalid email format";
      }
    }

    if (block === "statutory") {
      if (formData.pan) {
        const cleanPan = formData.pan.trim().toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
          errs.pan = "PAN format must be ABCDE1234F";
        }
      }
      if (formData.gst_applicable && !formData.gst?.trim()) {
        errs.gst = "GSTIN is required when GST is applicable";
      }
      const selLicenses: string[] = formData.selectedLicenses || [];
      if (selLicenses.includes("SHOP_ACT") && !formData.shop_act_no?.trim()) {
        errs.shop_act_no = "Shop Act license number is required when selected";
      }
      if (selLicenses.includes("UDYAM") && !formData.udyam_no?.trim()) {
        errs.udyam_no = "Udyam registration number is required when selected";
      }
    }

    if (block === "address") {
      if (!formData.address?.trim()) errs.address = "Address is required";
      if (!formData.city?.trim()) errs.city = "City is required";
      if (!formData.state?.trim()) errs.state = "State is required";
      if (formData.pincode && !/^\d{6}$/.test(formData.pincode.trim())) {
        errs.pincode = "Pincode must be 6 digits";
      }
      if (formData.office_address_different && formData.office_pincode && !/^\d{6}$/.test(formData.office_pincode.trim())) {
        errs.office_pincode = "Office pincode must be 6 digits";
      }
    }

    if (block === "bank") {
      if (!formData.bank_name?.trim()) errs.bank_name = "Bank name is required";
      if (!formData.account_name?.trim()) errs.account_name = "Account name is required";
      if (!formData.account_number?.trim()) errs.account_number = "Account number is required";
      if (formData.ifsc) {
        const cleanIfsc = formData.ifsc.trim().toUpperCase();
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
          errs.ifsc = "IFSC must follow standard format (e.g. COSB0000123)";
        }
      }
    }

    if (block === "references") {
      if (formData.reference_1_contact_no && !/^\d{10}$/.test(formData.reference_1_contact_no.replace(/\D/g, ""))) {
        errs.reference_1_contact_no = "Phone must be 10 digits";
      }
      if (formData.reference_2_contact_no && !/^\d{10}$/.test(formData.reference_2_contact_no.replace(/\D/g, ""))) {
        errs.reference_2_contact_no = "Phone must be 10 digits";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveEditing = async (block: DetailBlockKey) => {
    if (!validateBlock(block)) return;

    // Doc-linked fields that changed require their supporting document.
    const changed = changedDocFields(block);
    const missing = changed.filter((f) => !supportingFiles[f]);
    if (missing.length > 0) {
      const labels = missing.map((f) => DOC_LINKED_FIELDS[f].label).join(", ");
      setErrors((prev) => ({
        ...prev,
        _supporting: `Upload supporting document(s) for the changed field(s): ${labels}.`,
      }));
      return;
    }

    setSavingBlock(block);
    try {
      const payload: Record<string, any> = { ...formData };

      // Format fields
      if (payload.pan) payload.pan = payload.pan.trim().toUpperCase();
      if (payload.ifsc) payload.ifsc = payload.ifsc.trim().toUpperCase();
      if (payload.email) payload.email = payload.email.trim();
      if (payload.mobile) payload.mobile = payload.mobile.replace(/\D/g, "");

      if (block === "applicant") {
        if (!isEntity) {
          payload.name = [payload.applicant_title, payload.first_name, payload.middle_name, payload.last_name]
            .filter(Boolean)
            .join(" ");
          // Explicitly include individual fields so backend updates them and UI reflects changes
          payload.contact_person = [payload.first_name, payload.last_name].filter(Boolean).join(" ");
        } else {
          payload.name = payload.entity_name;
        }
      }

      if (payload.aadhaar_no && (payload.aadhaar_no.includes("X") || payload.aadhaar_no.includes("*"))) {
        delete payload.aadhaar_no;
      }

      if (block === "branch" && payload.branch_id) {
        payload.branch_id = Number(payload.branch_id);
      }

      if (block === "statutory") {
        if (!payload.gst_applicable) {
          payload.gst = "";
        }
        const selLicenses: string[] = payload.selectedLicenses || [];
        if (!selLicenses.includes("SHOP_ACT")) {
          payload.shop_act_no = "";
        }
        if (!selLicenses.includes("UDYAM")) {
          payload.udyam_no = "";
        }
        payload.registered_business_proof = selLicenses
          .map((k: string) => (k === "SHOP_ACT" ? "Shop Act" : "Udyam"))
          .join(",");
        payload.business_license_no = [
          selLicenses.includes("SHOP_ACT") ? payload.shop_act_no : null,
          selLicenses.includes("UDYAM") ? payload.udyam_no : null,
        ]
          .filter(Boolean)
          .join(", ");
        delete payload.selectedLicenses;
        if (payload.experience_years !== undefined) {
          payload.experience_years = payload.experience_years ? String(payload.experience_years) : "0";
        }
      }

      if (block === "address" && isEntity) {
        payload.office_address_line_1 = payload.address;
        payload.office_city = payload.city;
        payload.office_state = payload.state;
        payload.office_pincode = payload.pincode;
        payload.office_address_different = false;
      }

      const files: SupportingFile[] = changed.map((f) => ({
        document_type: DOC_LINKED_FIELDS[f].document_type,
        file: supportingFiles[f]!,
        label: DOC_LINKED_FIELDS[f].label,
      }));
      const success = await onSaveBlock(block, payload, files);
      if (success) {
        setActiveEditBlock(null);
        setFormData({});
        setErrors({});
        setSupportingFiles({});
        setIsAadhaarFieldFocused(false);
      }
    } finally {
      setSavingBlock(null);
    }
  };

  // Header button renderer with dynamic toggle: Edit vs Cancel + Save
  const renderHeaderAction = (block: DetailBlockKey) => {
    if (!canEdit) return null;

    const isCurrentEditing = activeEditBlock === block;
    const isSaving = savingBlock === block;

    if (isCurrentEditing) {
      return (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={cancelEditing}
            disabled={isSaving}
            className="h-7 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 gap-1 rounded-md"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={() => saveEditing(block)}
            disabled={isSaving}
            className="h-7 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs rounded-md transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Save
              </>
            )}
          </Button>
          </div>
          {errors._supporting ? (
            <p className="text-amber-700 text-[11px] font-medium">{errors._supporting}</p>
          ) : null}
        </div>
      );
    }

    return (
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => startEditing(block)}
        disabled={savingBlock !== null}
        className="h-7 px-2.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5 border border-blue-200/80 shadow-2xs rounded-md transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
    );
  };

  // Section 5 Branch resolution
  const selectedBranchId = formData.branch_id || dsa.branch_id || dsa.branch?.id;
  const currentBranchOption = branches.find((b) => String(b.id) === String(selectedBranchId));

  return (
    <div className="space-y-6 sm:space-y-7 pt-1">
      {/* ─────────────────────────────────────────────────────────────
          Section 1: Application & Sourcing Journey Overview
         ───────────────────────────────────────────────────────────── */}
      <SectionBlock
        icon={FileText}
        iconColor="text-blue-600"
        title="Application Overview"
        action={renderHeaderAction("sourcing")}
      >
        {activeEditBlock === "sourcing" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  DSA Partner Type
                </Label>
                <Select
                  value={formData.dsa_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dsa_type: e.target.value }))}
                  className="w-full text-sm font-semibold"
                >
                  <option value="INDIVIDUAL">Individual DSA</option>
                  <option value="ENTITY">Non-Individual (Entity / Firm)</option>
                </Select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Defines whether the applicant is an Individual or a Corporate Entity / Firm.
                </p>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Sourcing Journey Mode
                </Label>
                <div className="text-sm font-semibold text-slate-900">
                  {formData.submission_mode === "BRANCH"
                    ? "Branch Assisted Sourcing"
                    : formData.submission_mode === "SELF"
                      ? "Self-Onboarding (Online Portal)"
                      : formData.submission_mode || "Branch Sourced"}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  This value is set during onboarding and cannot be changed.
                </p>
              </div>

              <DetailItem
                label="Application Reference No"
                value={<span className="font-mono font-semibold text-slate-900">{dsa.code || `DSA-${dsa.id}`}</span>}
              />
              <DetailItem
                label="Lifecycle Status"
                value={<StatusBadge status={getDsaDisplayStatus(dsa)} />}
              />
            </div>
          </div>
        ) : (
          <DetailGrid>
            <DetailItem
              label="Application Reference No"
              value={<span className="font-mono font-semibold text-slate-900">{dsa.code || `DSA-${dsa.id}`}</span>}
            />
            <DetailItem
              label="Official Partner Code"
              value={
                (typeof dsa.dsa_code === "object" ? dsa.dsa_code?.code : dsa.dsa_code) ? (
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {typeof dsa.dsa_code === "object" ? dsa.dsa_code?.code : dsa.dsa_code}
                  </span>
                ) : (
                  <span className="text-slate-400 italic text-xs">
                    Generated upon final sanction &amp; activation
                  </span>
                )
              }
            />
            <DetailItem
              label="DSA Partner Type"
              value={
                dsa.dsa_type === "NON_INDIVIDUAL" || dsa.dsa_type === "ENTITY"
                  ? "Non-Individual (Entity / Firm)"
                  : "Individual DSA"
              }
            />
            <DetailItem
              label="Sourcing Journey Mode"
              value={
                dsa.submission_mode === "BRANCH"
                  ? "Branch Assisted Sourcing"
                  : dsa.submission_mode === "SELF"
                    ? "Self-Onboarding (Online Portal)"
                    : (dsa.submission_mode || "Branch Sourced")
              }
            />
            <DetailItem
              label="Application Submission Date"
              value={
                dsa.onboarding_date
                  ? formatDate(dsa.onboarding_date)
                  : dsa.created_at
                    ? formatDate(dsa.created_at)
                    : "—"
              }
            />
            <DetailItem
              label="Lifecycle Status"
              value={<StatusBadge status={getDsaDisplayStatus(dsa)} />}
            />
          </DetailGrid>
        )}
      </SectionBlock>

      {/* ─────────────────────────────────────────────────────────────
          Section 2: Applicant & Business Profile
         ───────────────────────────────────────────────────────────── */}
      <SectionBlock
        icon={Building2}
        iconColor="text-indigo-600"
        title="Business Details"
        action={renderHeaderAction("applicant")}
      >

        {activeEditBlock === "applicant" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-4">
            {!isEntity ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Title</Label>
                  <Input
                    value={formData.applicant_title || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">First Name</Label>
                  <Input
                    value={formData.first_name || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    placeholder="First name"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Middle Name</Label>
                  <Input
                    value={formData.middle_name || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    placeholder="Middle name"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Last Name</Label>
                  <Input
                    value={formData.last_name || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    placeholder="Last name"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Date of Birth (DOB)</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Age (Years)</Label>
                  <Input
                    type="number"
                    value={formData.age || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    placeholder="Age"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Qualification</Label>
                  <Select
                    value={formData.education_qualification || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, education_qualification: e.target.value }))}
                  >
                    <option value="">Select Qualification</option>
                    <option value="Graduate">Graduate</option>
                    <option value="Post Graduate">Post Graduate</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Professional (CA/CS/CFA)">Professional (CA/CS/CFA)</option>
                    <option value="Other">Other</option>
                  </Select>
                  {isFieldChanged("education_qualification", formData.education_qualification, dsa) && (
                    <SupportingDocInput
                      field="education_qualification"
                      file={supportingFiles.education_qualification}
                      onPick={(f) => pickSupportingFile("education_qualification", f)}
                      onClear={() => clearSupportingFile("education_qualification")}
                    />
                  )}
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                    Aadhaar (12 Digits)
                  </Label>
                  <Input
                    value={maskAadhaar(formData.aadhaar_no || dsa.aadhaar_no || dsa.aadhaar)}
                    readOnly
                    disabled
                    title="Aadhaar cannot be edited."
                    placeholder="12 digit Aadhaar"
                    className="font-mono bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(() => {
                  const isSoleProp = Boolean((formData.constitution || dsa?.constitution || "").toLowerCase().includes("proprietor"));
                  return (
                    <div className={`rounded-md border p-3 shadow-2xs sm:col-span-2 ${isSoleProp ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50/70"}`}>
                      <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Entity / Firm Name</Label>
                      <Input
                        value={formData.entity_name || ""}
                        disabled={!isSoleProp}
                        readOnly={!isSoleProp}
                        onChange={(e) => setFormData((prev) => ({ ...prev, entity_name: e.target.value }))}
                        className={isSoleProp ? "bg-white text-slate-800 border-slate-200" : "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"}
                        placeholder="Registered business or firm name"
                      />
                    </div>
                  );
                })()}

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Primary Contact Person *</Label>
                  <Input
                    value={formData.contact_person || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="Key executive / Authorized signatory"
                  />
                  {errors.contact_person && <p className="text-red-500 text-xs mt-1">{errors.contact_person}</p>}
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Legal Constitution</Label>
                  <Select
                    value={formData.constitution || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, constitution: e.target.value }))}
                  >
                    <option value="">Select Constitution</option>
                    <option value="Private Limited">Private Limited Company</option>
                    <option value="Public Limited">Public Limited Company</option>
                    <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                    <option value="Partnership Firm">Partnership Firm</option>
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                    <option value="Trust / Society">Trust / Society</option>
                  </Select>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">CIN / LLPIN / Registration Number</Label>
                  <Input
                    value={formData.registration_no_llpin_cin || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, registration_no_llpin_cin: e.target.value }))}
                    placeholder="e.g. U72900MH2021PTC123456"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Nature of Business</Label>
                  <Input
                    value={formData.nature_of_business || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nature_of_business: e.target.value }))}
                    placeholder="Direct Selling Agent / Retail Loan Sourcing"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Incorporation Date (DOB / DOI)</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Vintage / Age (Years)</Label>
                  <Input
                    type="number"
                    value={formData.age || ""}
                    disabled
                    readOnly
                    className="bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                    placeholder="Years in business"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <DetailGrid>
            <DetailItem
              label={isEntity ? "Registered Entity / Firm Name" : "Applicant Full Name"}
              value={
                dsa.entity_name ||
                [dsa.applicant_title, dsa.first_name, dsa.middle_name, dsa.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                dsa.name ||
                "—"
              }
            />
            <DetailItem
              label="Primary Contact Person"
              value={
                dsa.contact_person ||
                [dsa.first_name, dsa.last_name].filter(Boolean).join(" ") ||
                dsa.name ||
                "—"
              }
            />
            <DetailItem
              label="Legal Constitution"
              value={
                isEntity
                  ? (dsa.business_type || dsa.constitution || "—")
                  : "Individual"
              }
            />
            <DetailItem
              label="Business Type / Category"
              value={
                isEntity
                  ? (dsa.business_type || "—")
                  : (dsa.constitution || "—")
              }
            />
            <DetailItem
              label="Nature of Business"
              value={
                dsa.nature_of_business ||
                "Direct Selling Agent / Financial Intermediary"
              }
            />
            <DetailItem
              label={isEntity ? "Incorporation Date / Age (DOI)" : "Date of Birth / Age (DOB)"}
              value={
                (dsa.date_of_birth || dsa.dob || dsa.doi || dsa.date_of_incorporation)
                  ? `${formatDate(dsa.date_of_birth || dsa.dob || dsa.doi || dsa.date_of_incorporation)}${dsa.age ? ` (${dsa.age} yrs)` : ""}`
                  : dsa.age
                    ? `${dsa.age} years`
                    : "—"
              }
            />
            {!isEntity && (
              <DetailItem
                label="Educational Qualification"
                value={dsa.education_qualification || "—"}
              />
            )}
            {isEntity ? (
              dsa.registration_no_llpin_cin ? (
                <DetailItem
                  label="CIN / LLPIN / Registration Number"
                  value={<span className="font-mono">{dsa.registration_no_llpin_cin}</span>}
                />
              ) : null
            ) : (
              <DetailItem
                label="Aadhaar Number"
                value={
                  (dsa.aadhaar_no || dsa.aadhaar) ? (
                    <span className="font-mono">{formatAadhaarNumber(dsa.aadhaar_no || dsa.aadhaar)}</span>
                  ) : (
                    "Verified via Identity Document"
                  )
                }
              />
            )}
          </DetailGrid>
        )}
      </SectionBlock>

      {/* ─────────────────────────────────────────────────────────────
          Section 3: Contact & Communication Channels
         ───────────────────────────────────────────────────────────── */}
      <SectionBlock
        icon={Phone}
        iconColor="text-emerald-600"
        title="Contacts"
        action={renderHeaderAction("contact")}
      >

        {activeEditBlock === "contact" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Registered Mobile Number *
                </Label>
                <Input
                  value={formData.mobile || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mobile: e.target.value }))}
                  placeholder="10 digit mobile"
                  maxLength={10}
                />
                {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Registered Email Address
                </Label>
                <Input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Alternate / Landline Contact
                </Label>
                <Input
                  value={formData.landline_no || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, landline_no: e.target.value }))}
                  placeholder="e.g. 020-25530000"
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Office / Sourcing Mobile
                </Label>
                <Input
                  value={formData.office_mobile_no || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, office_mobile_no: e.target.value }))}
                  placeholder="Office mobile number"
                  maxLength={10}
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-2">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Website / Web Portal
                </Label>
                <Input
                  value={formData.website || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>
        ) : (
          <DetailGrid>
            <DetailItem
              label="Registered Mobile Number"
              value={
                <div className="flex items-center gap-2">
                  <span>{dsa.mobile}</span>
                  {dsa.mobile_verified_at ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <Check className="h-3 w-3" /> OTP Verified
                    </span>
                  ) : null}
                </div>
              }
            />
            <DetailItem
              label="Registered Email Address"
              value={
                <div className="flex items-center gap-2">
                  <span>{dsa.email}</span>
                  {dsa.email_verified_at ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <Check className="h-3 w-3" /> Verified
                    </span>
                  ) : null}
                </div>
              }
            />
            <DetailItem
              label="Alternate / Landline Contact"
              value={dsa.landline_no || dsa.office_landline_no || "—"}
            />
            <DetailItem
              label="Office / Sourcing Mobile"
              value={
                dsa.office_mobile_no ||
                dsa.key_person_contact_no ||
                dsa.mobile ||
                "—"
              }
            />
            {dsa.website ? (
              <DetailItem
                className="sm:col-span-2"
                label="Website / Portal"
                value={
                  <a
                    href={
                      dsa.website.startsWith("http")
                        ? dsa.website
                        : `https://${dsa.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {dsa.website}
                  </a>
                }
              />
            ) : null}
          </DetailGrid>
        )}
      </SectionBlock>

      {/* ─────────────────────────────────────────────────────────────
          Section 4: Statutory, Tax & Licensing Details
         ───────────────────────────────────────────────────────────── */}
      <SectionBlock
        icon={CreditCard}
        iconColor="text-amber-600"
        title="License Details"
        action={renderHeaderAction("statutory")}
      >

        {activeEditBlock === "statutory" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Permanent Account Number (PAN)
                </Label>
                <Input
                  value={formData.pan || ""}
                  onChange={(e) => {
                    if (Boolean(dsa.pan)) return;
                    setFormData((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }));
                  }}
                  readOnly={Boolean(dsa.pan)}
                  disabled={Boolean(dsa.pan)}
                  title={Boolean(dsa.pan) ? "PAN was verified during onboarding and cannot be edited." : undefined}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className={
                    Boolean(dsa.pan)
                      ? "font-mono uppercase font-bold bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "font-mono uppercase font-bold"
                  }
                />
                {errors.pan && <p className="text-red-500 text-xs mt-1">{errors.pan}</p>}
                {!Boolean(dsa.pan) && isFieldChanged("pan", formData.pan, dsa) && (
                  <SupportingDocInput
                    field="pan"
                    file={supportingFiles.pan}
                    onPick={(f) => pickSupportingFile("pan", f)}
                    onClear={() => clearSupportingFile("pan")}
                  />
                )}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  GST Registration Status
                </Label>
                <Select
                  value={formData.gst_applicable ? "YES" : "NO"}
                  onChange={(e) => {
                    const isApp = e.target.value === "YES";
                    if (!isApp) {
                      clearSupportingFile("gst");
                    }
                    setFormData((prev) => ({
                      ...prev,
                      gst_applicable: isApp,
                      gst: isApp ? prev.gst : "",
                    }));
                  }}
                  className="w-full text-sm font-semibold"
                >
                  <option value="NO">Exempt / Not Applicable</option>
                  <option value="YES">Applicable (Registered)</option>
                </Select>
              </div>

              {formData.gst_applicable ? (
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                    GSTIN (15 Digits) *
                  </Label>
                  <Input
                    value={formData.gst || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gst: e.target.value.toUpperCase() }))}
                    placeholder="27ABCDE1234F1Z5"
                    maxLength={15}
                    className="font-mono uppercase font-bold"
                  />
                  {errors.gst && <p className="text-red-500 text-xs mt-1">{errors.gst}</p>}
                  {(!dsa?.gst_applicable || isFieldChanged("gst", formData.gst, dsa)) && (
                    <SupportingDocInput
                      field="gst"
                      file={supportingFiles.gst}
                      onPick={(f) => pickSupportingFile("gst", f)}
                      onClear={() => clearSupportingFile("gst")}
                    />
                  )}
                </div>
              ) : null}

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Registered Business Proof
                </Label>
                <CheckboxDropdown
                  id="maker_registered_business_proof"
                  placeholder="Select Business Proof (Shop Act / Udyam)"
                  options={BUSINESS_LICENSE_OPTIONS}
                  selectedKeys={formData.selectedLicenses || []}
                  onChange={(keys) => {
                    setFormData((prev: Record<string, any>) => ({
                      ...prev,
                      selectedLicenses: keys,
                      registered_business_proof: keys
                        .map((k: string) => (k === "SHOP_ACT" ? "Shop Act" : "Udyam"))
                        .join(","),
                      ...(keys.includes("SHOP_ACT") ? {} : { shop_act_no: "" }),
                      ...(keys.includes("UDYAM") ? {} : { udyam_no: "" }),
                    }));
                    if (!keys.includes("SHOP_ACT")) {
                      clearSupportingFile("shop_act_no");
                    }
                    if (!keys.includes("UDYAM")) {
                      clearSupportingFile("udyam_no");
                    }
                  }}
                />
              </div>

              {(formData.selectedLicenses || []).includes("UDYAM") && (
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                    Udyam Registration Number *
                  </Label>
                  <Input
                    value={formData.udyam_no || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, udyam_no: e.target.value.toUpperCase() }))}
                    placeholder="UDYAM-XX-00-0000000"
                    className="font-mono uppercase"
                  />
                  {errors.udyam_no && <p className="text-red-500 text-xs mt-1">{errors.udyam_no}</p>}
                  {(!dsa?.udyam_no || isFieldChanged("udyam_no", formData.udyam_no, dsa)) && (
                    <SupportingDocInput
                      field="udyam_no"
                      file={supportingFiles.udyam_no}
                      onPick={(f) => pickSupportingFile("udyam_no", f)}
                      onClear={() => clearSupportingFile("udyam_no")}
                    />
                  )}
                </div>
              )}

              {(formData.selectedLicenses || []).includes("SHOP_ACT") && (
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                    Shop Act License / Reg Number *
                  </Label>
                  <Input
                    value={formData.shop_act_no || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, shop_act_no: e.target.value.toUpperCase() }))}
                    placeholder="Shop Act Number"
                    className="font-mono uppercase"
                  />
                  {errors.shop_act_no && <p className="text-red-500 text-xs mt-1">{errors.shop_act_no}</p>}
                  {(!dsa?.shop_act_no || isFieldChanged("shop_act_no", formData.shop_act_no, dsa)) && (
                    <SupportingDocInput
                      field="shop_act_no"
                      file={supportingFiles.shop_act_no}
                      onPick={(f) => pickSupportingFile("shop_act_no", f)}
                      onClear={() => clearSupportingFile("shop_act_no")}
                    />
                  )}
                </div>
              )}

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Sourcing / Financial Experience
                </Label>
                <Input
                  value={formData.applicant_prior_experience || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const lower = val.trim().toLowerCase();
                    if (!val.trim() || lower.includes("fresher") || lower.includes("no prior")) {
                      clearSupportingFile("applicant_prior_experience");
                    }
                    setFormData((prev) => ({ ...prev, applicant_prior_experience: val }));
                  }}
                  placeholder="e.g. Retail loan sourcing, DSA empanelment"
                />
                {Boolean(
                  formData.applicant_prior_experience &&
                  !/fresher|no prior/i.test(formData.applicant_prior_experience) &&
                  isFieldChanged("applicant_prior_experience", formData.applicant_prior_experience, dsa)
                ) && (
                  <SupportingDocInput
                    field="applicant_prior_experience"
                    file={supportingFiles.applicant_prior_experience}
                    onPick={(f) => pickSupportingFile("applicant_prior_experience", f)}
                    onClear={() => clearSupportingFile("applicant_prior_experience")}
                  />
                )}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Experience (Years)
                </Label>
                <Input
                  type="number"
                  value={formData.experience_years || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = Number(val);
                    if (isNaN(num) || num <= 0) {
                      clearSupportingFile("experience_years");
                    }
                    setFormData((prev) => ({ ...prev, experience_years: val }));
                  }}
                  placeholder="Years"
                />
                {Number(formData.experience_years) > 0 &&
                  (!dsa?.experience_years || Number(dsa.experience_years) <= 0 || isFieldChanged("experience_years", formData.experience_years, dsa)) && (
                  <SupportingDocInput
                    field="experience_years"
                    file={supportingFiles.experience_years}
                    onPick={(f) => pickSupportingFile("experience_years", f)}
                    onClear={() => clearSupportingFile("experience_years")}
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <DetailGrid>
            <DetailItem
              label="Permanent Account Number (PAN)"
              value={<span className="font-mono font-bold text-slate-900">{dsa.pan}</span>}
            />
            <DetailItem
              label="GST Registration Status"
              value={
                dsa.gst_applicable ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Check className="h-3 w-3" /> Applicable (Registered)
                  </span>
                ) : (
                  <span className="text-slate-600 text-xs font-medium">Exempt / Not Applicable</span>
                )
              }
            />
            <DetailItem
              label="GSTIN"
              value={
                dsa.gst_applicable && dsa.gst ? (
                  <span className="font-mono font-bold text-slate-900">{dsa.gst}</span>
                ) : dsa.gst_applicable ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    <FileText className="h-3 w-3 text-blue-600" /> Registered (Certificate On File)
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs">Not Applicable (Exempt Turnover)</span>
                )
              }
            />
            <DetailItem
              label="Registered Business Proof / License"
              value={
                (() => {
                  const proofs = (dsa.registered_business_proof || dsa.business_license_type || "")
                    .split(",")
                    .map((p: string) => p.trim())
                    .filter(Boolean);
                  if (proofs.length === 0) return "—";
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {proofs.map((proof: string, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200"
                        >
                          {proof === "GST" ? "GST Certificate" : proof === "Udyam" ? "Udyam Registration" : proof}
                        </span>
                      ))}
                    </div>
                  );
                })()
              }
            />
            <DetailItem
              label="Financial / Sourcing Experience"
              value={(() => {
                const expYears = dsa.experience_years !== undefined && dsa.experience_years !== null ? Number(dsa.experience_years) : null;
                const hasExpYears = expYears !== null && expYears >= 0;
                const priorExp = dsa.applicant_prior_experience?.trim();
                
                if (priorExp) {
                  return (
                    <div>
                      <span className="font-semibold text-slate-900">{priorExp}</span>
                      {hasExpYears && expYears > 0 && !priorExp.includes(String(expYears)) ? (
                        <span className="text-slate-500 text-xs ml-1.5">({expYears} yrs)</span>
                      ) : null}
                    </div>
                  );
                }
                if (hasExpYears) {
                  return `${expYears} Years`;
                }
                if (dsa.empanelment_since_year) {
                  return `Empanelled since ${dsa.empanelment_since_year}`;
                }
                return "New Partner Empanelment";
              })()}
            />
            <DetailItem
              label="Statutory Registration / License No"
              value={
                [cleanLicenseValue(dsa.udyam_no), cleanLicenseValue(dsa.shop_act_no)]
                  .filter(Boolean)
                  .join(", ") ||
                cleanLicenseValue(dsa.business_license_no) ||
                (dsa.registered_business_proof ? `Registered Proofs on File (${dsa.registered_business_proof.split(",").join(", ")})` : null) ||
                dsa.registration_no_llpin_cin ||
                "—"
              }
            />
            {cleanLicenseValue(dsa.udyam_no) ? (
              <DetailItem
                label="Udyam Registration Number"
                value={<span className="font-mono font-semibold text-slate-900">{cleanLicenseValue(dsa.udyam_no)}</span>}
              />
            ) : null}
            {cleanLicenseValue(dsa.shop_act_no) ? (
              <DetailItem
                label="Shop Act License / Reg. Number"
                value={<span className="font-mono font-semibold text-slate-900">{cleanLicenseValue(dsa.shop_act_no)}</span>}
              />
            ) : null}
          </DetailGrid>
        )}
      </SectionBlock>

      {/* ─────────────────────────────────────────────────────────────
          Section 5: Branch & Operating Territory
         ───────────────────────────────────────────────────────────── */}
      <SectionBlock
        icon={MapPin}
        iconColor="text-rose-600"
        title="Branch Details"
        action={renderHeaderAction("branch")}
      >

        {activeEditBlock === "branch" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-2">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Designated Sourcing Branch
                </Label>
                <Select
                  value={formData.branch_id || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, branch_id: e.target.value }))}
                  className="w-full text-sm font-semibold"
                >
                  <option value="">Select designated branch...</option>
                  {branches.map((b) => (
                    <option key={b.id || b.branch_code} value={b.id}>
                      {b.branch_name} {b.branch_code ? `(${b.branch_code})` : ""}
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Assigns the managing branch for this DSA application and all sourced proposals.
                </p>
              </div>

              <DetailItem
                label="Selected Branch Code"
                value={
                  currentBranchOption?.branch_code ||
                  dsa.branch?.branch_code ||
                  dsa.branch_code ||
                  "—"
                }
              />
              <DetailItem
                label="Region / Sub-Region Territory"
                value={
                  currentBranchOption?.sub_region_code ||
                  dsa.branch?.sub_region_code ||
                  dsa.subregion_id ||
                  "—"
                }
              />
            </div>
          </div>
        ) : (
          <DetailGrid>
            <DetailItem
              label="Designated Sourcing Branch"
              value={
                dsa.branch?.branch_name ||
                dsa.branch_name ||
                "—"
              }
            />
            <DetailItem
              label="Branch Code"
              value={dsa.branch?.branch_code || dsa.branch_code || "—"}
            />
            <DetailItem
              label="Region / Sub-Region Territory"
              value={
                dsa.branch?.sub_region_code ||
                dsa.subregion_id ||
                "—"
              }
            />
            <DetailItem
              label="Branch Sourcing Officer"
              value={dsa.manager || "—"}
            />
          </DetailGrid>
        )}
      </SectionBlock>

      {/* ─────────────────────────────────────────────────────────────
          Section 6: Address & Operating Premises
         ───────────────────────────────────────────────────────────── */}
      <SectionBlock
        icon={Briefcase}
        iconColor="text-purple-600"
        title="Address Details"
        action={renderHeaderAction("address")}
      >

        {activeEditBlock === "address" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                {isEntity ? "Office Address" : "Registered / Residential Address"}
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-4">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                    {isEntity ? "Office Street Address *" : "Street Address *"}
                  </Label>
                  <Input
                    value={formData.address || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder={isEntity ? "Office / Building / Street address" : "Flat / Building / Street address"}
                  />
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">City *</Label>
                  <Input
                    value={formData.city || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">State *</Label>
                  <Input
                    value={formData.state || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                  />
                  {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Pincode *</Label>
                  <Input
                    value={formData.pincode || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
                    placeholder="6 digit PIN"
                    maxLength={6}
                  />
                  {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-200">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Premises Ownership
                </Label>
                <Select
                  value={formData.business_premises_ownership || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, business_premises_ownership: e.target.value }))}
                >
                  <option value="">Select Premises Ownership</option>
                  <option value="Self Owned">Self Owned</option>
                  <option value="Rented / Leased Premises">Rented / Leased Premises</option>
                </Select>
              </div>

              {!isEntity && (
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs flex flex-col justify-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.office_address_different)}
                      onChange={(e) => setFormData((prev) => ({ ...prev, office_address_different: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Separate Commercial Office Address (Different from Residence)
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-1 pl-6">
                    Check if operating from a distinct commercial office location.
                  </p>
                </div>
              )}
            </div>

            {!isEntity && formData.office_address_different ? (
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Office / Commercial Operating Premises Address
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-4">
                    <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Office Street Address</Label>
                    <Input
                      value={formData.office_address_line_1 || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, office_address_line_1: e.target.value }))}
                      placeholder="Office building / Suite / Street address"
                    />
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-2">
                    <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Office City</Label>
                    <Input
                      value={formData.office_city || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, office_city: e.target.value }))}
                      placeholder="Office city"
                    />
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                    <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Office State</Label>
                    <Input
                      value={formData.office_state || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, office_state: e.target.value }))}
                      placeholder="Office state"
                    />
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                    <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Office Pincode</Label>
                    <Input
                      value={formData.office_pincode || ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, office_pincode: e.target.value }))}
                      placeholder="6 digit PIN"
                      maxLength={6}
                    />
                    {errors.office_pincode && <p className="text-red-500 text-xs mt-1">{errors.office_pincode}</p>}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <DetailGrid>
            {isEntity ? (
              <>
                <DetailItem
                  label="Office Address"
                  value={`${dsa.office_address_line_1 || dsa.address || "—"}, ${dsa.office_city || dsa.city || ""}, ${dsa.office_state || dsa.state || ""} ${dsa.office_pincode || dsa.pincode || ""}`.replace(/^,\s*/, "")}
                />
                <DetailItem
                  label="Office Location &amp; Pincode"
                  value={`${dsa.office_city || dsa.city || "—"}, ${dsa.office_state || dsa.state || "—"} - ${dsa.office_pincode || dsa.pincode || "—"}`}
                />
                <DetailItem
                  label="Business Premises Ownership"
                  value={<span className="font-semibold text-slate-900">{dsa.business_premises_ownership || "—"}</span>}
                />
                <DetailItem
                  label="Operating Premises Status"
                  value={
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Corporate / Commercial Office
                    </span>
                  }
                />
              </>
            ) : (
              <>
                <DetailItem
                  label="Registered / Residential Address"
                  value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`}
                />
                <DetailItem
                  label="Office / Operating Premises Address"
                  value={
                    dsa.office_address_different && dsa.office_address_line_1
                      ? `${dsa.office_address_line_1}, ${dsa.office_city || dsa.city}, ${dsa.office_state || dsa.state} ${dsa.office_pincode || dsa.pincode}`
                      : `Same as Registered Address (${dsa.address}, ${dsa.city})`
                  }
                />
                <DetailItem
                  label="Residential Location &amp; Pincode"
                  value={`${dsa.city}, ${dsa.state} - ${dsa.pincode}`}
                />
                <DetailItem
                  label="Office Location &amp; Pincode"
                  value={
                    dsa.office_address_different && dsa.office_city
                      ? `${dsa.office_city}, ${dsa.office_state || dsa.state} - ${dsa.office_pincode || dsa.pincode}`
                      : `${dsa.city}, ${dsa.state} - ${dsa.pincode} (Same as Residence)`
                  }
                />
                <DetailItem
                  label="Business Premises Ownership"
                  value={<span className="font-semibold text-slate-900">{dsa.business_premises_ownership || "—"}</span>}
                />
                <DetailItem
                  label="Operating Premises Status"
                  value={
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {dsa.office_address_different ? "Separate Commercial Office" : "Operating from Registered Residence"}
                    </span>
                  }
                />
              </>
            )}
          </DetailGrid>
        )}
      </SectionBlock>

      {/* ─────────────────────────────────────────────────────────────
          Section 7: Settlement & Bank Account Details
         ───────────────────────────────────────────────────────────── */}
      <SectionBlock
        icon={BadgeIndianRupee}
        iconColor="text-emerald-600"
        title="Bank Account Details"
        action={renderHeaderAction("bank")}
      >

        {activeEditBlock === "bank" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Settlement Bank Name *</Label>
                <Input
                  value={formData.bank_name || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="e.g. Cosmos Co-operative Bank"
                />
                {errors.bank_name && <p className="text-red-500 text-xs mt-1">{errors.bank_name}</p>}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Beneficiary Account Name *</Label>
                <Input
                  value={formData.account_name || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, account_name: e.target.value }))}
                  placeholder="Name as per bank records"
                />
                {errors.account_name && <p className="text-red-500 text-xs mt-1">{errors.account_name}</p>}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Bank Account Number *</Label>
                <Input
                  value={formData.account_number || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, account_number: e.target.value }))}
                  placeholder="Account number"
                  className="font-mono font-semibold"
                />
                {errors.account_number && <p className="text-red-500 text-xs mt-1">{errors.account_number}</p>}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Account Type</Label>
                <Select
                  value={formData.account_type || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, account_type: e.target.value }))}
                >
                  <option value="">Select Account Type</option>
                  <option value="Savings">Savings Account</option>
                  <option value="Current">Current Account</option>
                  <option value="Overdraft">Overdraft Account</option>
                  <option value="Cash Credit">Cash Credit</option>
                </Select>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">IFSC Code (11 Chars)</Label>
                <Input
                  value={formData.ifsc || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, ifsc: e.target.value.toUpperCase() }))}
                  placeholder="COSB0000012"
                  maxLength={11}
                  className="font-mono uppercase font-bold"
                />
                {errors.ifsc && <p className="text-red-500 text-xs mt-1">{errors.ifsc}</p>}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Last FY Net Sales (₹ Lakhs)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.last_fy_net_sales || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, last_fy_net_sales: e.target.value }))}
                  placeholder="Net Sales in Lakhs"
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Last FY PAT (₹ Lakhs)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.last_fy_net_profit_after_tax || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, last_fy_net_profit_after_tax: e.target.value }))}
                  placeholder="Net Profit after tax in Lakhs"
                />
              </div>
            </div>
          </div>
        ) : (
          <DetailGrid>
            <DetailItem
              label="Settlement Bank Name"
              value={dsa.bank_name || "—"}
            />
            <DetailItem
              label="Beneficiary Account Name"
              value={dsa.account_name || dsa.name}
            />
            <DetailItem
              label="Bank Account Number"
              value={<span className="font-mono font-semibold text-slate-900">{dsa.account_number}</span>}
            />
            <DetailItem
              label="Account Type"
              value={dsa.account_type || "—"}
            />
            <DetailItem
              label="IFSC Code"
              value={<span className="font-mono font-bold text-slate-900">{dsa.ifsc}</span>}
            />
            <DetailItem
              label="Disbursement &amp; Payout Routing"
              value={
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Check className="h-3 w-3" /> Direct Bank Transfer (NEFT/RTGS)
                </span>
              }
            />
            {dsa.last_fy_net_sales ? (
              <DetailItem
                label="Last FY Net Sales"
                value={`₹ ${dsa.last_fy_net_sales} Lakhs`}
              />
            ) : null}
            {dsa.last_fy_net_profit_after_tax ? (
              <DetailItem
                label="Last FY Net Profit (PAT)"
                value={`₹ ${dsa.last_fy_net_profit_after_tax} Lakhs`}
              />
            ) : null}
          </DetailGrid>
        )}
      </SectionBlock>

      {/* ─────────────────────────────────────────────────────────────
          Section 8: Professional References
         ───────────────────────────────────────────────────────────── */}
      {!isEntity && (dsa.reference_1_name || dsa.reference_2_name || canEdit) && (
        <SectionBlock
          icon={Users}
          iconColor="text-cyan-600"
          title="References"
          action={renderHeaderAction("references")}
        >

          {activeEditBlock === "references" ? (
            <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Primary Reference Name</Label>
                  <Input
                    value={formData.reference_1_name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reference_1_name: e.target.value }))}
                    placeholder="Full name of reference 1"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Primary Reference Phone</Label>
                  <Input
                    value={formData.reference_1_contact_no || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reference_1_contact_no: e.target.value }))}
                    placeholder="10 digit phone"
                    maxLength={10}
                  />
                  {errors.reference_1_contact_no && <p className="text-red-500 text-xs mt-1">{errors.reference_1_contact_no}</p>}
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Secondary Reference Name</Label>
                  <Input
                    value={formData.reference_2_name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reference_2_name: e.target.value }))}
                    placeholder="Full name of reference 2"
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Secondary Reference Phone</Label>
                  <Input
                    value={formData.reference_2_contact_no || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reference_2_contact_no: e.target.value }))}
                    placeholder="10 digit phone"
                    maxLength={10}
                  />
                  {errors.reference_2_contact_no && <p className="text-red-500 text-xs mt-1">{errors.reference_2_contact_no}</p>}
                </div>
              </div>
            </div>
          ) : (
            <DetailGrid>
              <DetailItem
                label="Primary Reference"
                value={
                  dsa.reference_1_name ? (
                    <div>
                      <p className="font-semibold text-slate-900">{dsa.reference_1_name}</p>
                      {dsa.reference_1_contact_no ? (
                        <p className="text-xs text-slate-500 mt-0.5">Phone: {dsa.reference_1_contact_no}</p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-xs">Not provided</span>
                  )
                }
              />
              <DetailItem
                label="Secondary Reference"
                value={
                  dsa.reference_2_name ? (
                    <div>
                      <p className="font-semibold text-slate-900">{dsa.reference_2_name}</p>
                      {dsa.reference_2_contact_no ? (
                        <p className="text-xs text-slate-500 mt-0.5">Phone: {dsa.reference_2_contact_no}</p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-xs">Not provided</span>
                  )
                }
              />
            </DetailGrid>
          )}
        </SectionBlock>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Section 9: Entity Stakeholders / Partners
         ───────────────────────────────────────────────────────────── */}
      {isEntity && Array.isArray(dsa.stakeholders) && dsa.stakeholders.length > 0 && (
        <SectionBlock
          icon={Users}
          iconColor="text-indigo-600"
          title={`Entity Stakeholders (${dsa.stakeholders.length})`}
          action={renderHeaderAction("stakeholders")}
        >

          {activeEditBlock === "stakeholders" ? (
            <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Stakeholder Name <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5">Role / Designation</th>
                      <th className="p-2.5">Mobile</th>
                      <th className="p-2.5">PAN</th>
                      <th className="p-2.5">Aadhaar / DIN</th>
                      <th className="p-2.5 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(formData.stakeholders || []).map((sh: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2">
                          <Input
                            value={sh.name || ""}
                            onChange={(e) => {
                              const list = [...formData.stakeholders];
                              list[idx] = { ...list[idx], name: e.target.value };
                              setFormData((prev) => ({ ...prev, stakeholders: list }));
                            }}
                            placeholder="Full Name"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Select
                            value={sh.stakeholder_type || ""}
                            onChange={(e) => {
                              const list = [...formData.stakeholders];
                              list[idx] = { ...list[idx], stakeholder_type: e.target.value };
                              setFormData((prev) => ({ ...prev, stakeholders: list }));
                            }}
                            className="h-8 text-xs"
                          >
                            <option value="">Select Role</option>
                            <option value="Director">Director</option>
                            <option value="Partner / Director">Partner / Director</option>
                            <option value="Managing Partner">Managing Partner</option>
                            <option value="Promoter">Promoter</option>
                            <option value="Shareholder">Shareholder</option>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            value={sh.mobile_no || ""}
                            onChange={(e) => {
                              const list = [...formData.stakeholders];
                              list[idx] = { ...list[idx], mobile_no: e.target.value };
                              setFormData((prev) => ({ ...prev, stakeholders: list }));
                            }}
                            placeholder="10 digit mobile"
                            maxLength={10}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={sh.pan_no || ""}
                            onChange={(e) => {
                              const list = [...formData.stakeholders];
                              list[idx] = { ...list[idx], pan_no: e.target.value.toUpperCase() };
                              setFormData((prev) => ({ ...prev, stakeholders: list }));
                            }}
                            placeholder="PAN"
                            maxLength={10}
                            className="h-8 text-xs font-mono uppercase"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={sh.din_dpin_no || ""}
                            onChange={(e) => {
                              const list = [...formData.stakeholders];
                              list[idx] = { ...list[idx], din_dpin_no: e.target.value };
                              setFormData((prev) => ({ ...prev, stakeholders: list }));
                            }}
                            placeholder="DIN / Aadhaar"
                            className="h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => {
                              const list = formData.stakeholders.filter((_: any, i: number) => i !== idx);
                              setFormData((prev) => ({ ...prev, stakeholders: list }));
                            }}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    const list = [...(formData.stakeholders || [])];
                    list.push({
                      name: "",
                      stakeholder_type: "",
                      mobile_no: "",
                      pan_no: "",
                      qualification: "",
                      din_dpin_no: "",
                    });
                    setFormData((prev) => ({ ...prev, stakeholders: list }));
                  }}
                  className="h-7 px-2.5 text-xs text-blue-600 hover:bg-blue-50 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Stakeholder
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Stakeholder Name</th>
                    <th className="p-2.5">Role / Designation</th>
                    <th className="p-2.5">Mobile</th>
                    <th className="p-2.5">PAN</th>
                    <th className="p-2.5">Aadhaar / DIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.isArray(dsa.stakeholders) && dsa.stakeholders.length > 0 ? (
                    dsa.stakeholders.map((sh: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-semibold text-slate-900">{sh.name}</td>
                        <td className="p-2.5 text-slate-600">{sh.stakeholder_type || "—"}</td>
                        <td className="p-2.5 text-slate-600">{sh.mobile_no || "—"}</td>
                        <td className="p-2.5 font-mono text-slate-700">{sh.pan || sh.pan_no || "—"}</td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {maskAadhaar(sh.din_dpin_no || sh.aadhaar) || "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                        No stakeholders recorded yet. Click Edit to add partners/directors.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </SectionBlock>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Section 10: Associate Concerns & Sister Entities
         ───────────────────────────────────────────────────────────── */}
      {isEntity && (
        <SectionBlock
          icon={Building2}
          iconColor="text-slate-600"
          title={`Associate Entities (${dsa.associate_concerns?.length || 0})`}
          action={renderHeaderAction("associate_concerns")}
        >

          {activeEditBlock === "associate_concerns" ? (
            <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Concern / Entity Name</th>
                      <th className="p-2.5">Nature of Activity</th>
                      <th className="p-2.5">Relationship</th>
                      <th className="p-2.5">Bank / Branch</th>
                      <th className="p-2.5 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(formData.associate_concerns || []).map((ac: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2">
                          <Input
                            value={ac.associate_name || ""}
                            onChange={(e) => {
                              const list = [...formData.associate_concerns];
                              list[idx] = { ...list[idx], associate_name: e.target.value };
                              setFormData((prev) => ({ ...prev, associate_concerns: list }));
                            }}
                            placeholder="Associate Entity Name"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={ac.associate_nature_of_business || ""}
                            onChange={(e) => {
                              const list = [...formData.associate_concerns];
                              list[idx] = { ...list[idx], associate_nature_of_business: e.target.value };
                              setFormData((prev) => ({ ...prev, associate_concerns: list }));
                            }}
                            placeholder="Nature of activity"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={ac.associate_constitution || ""}
                            onChange={(e) => {
                              const list = [...formData.associate_concerns];
                              list[idx] = { ...list[idx], associate_constitution: e.target.value };
                              setFormData((prev) => ({ ...prev, associate_concerns: list }));
                            }}
                            placeholder="Relationship"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={ac.associate_key_person_details || ""}
                            onChange={(e) => {
                              const list = [...formData.associate_concerns];
                              list[idx] = { ...list[idx], associate_key_person_details: e.target.value };
                              setFormData((prev) => ({ ...prev, associate_concerns: list }));
                            }}
                            placeholder="Bank / Branch"
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => {
                              const list = formData.associate_concerns.filter((_: any, i: number) => i !== idx);
                              setFormData((prev) => ({ ...prev, associate_concerns: list }));
                            }}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    const list = [...(formData.associate_concerns || [])];
                    list.push({
                      associate_name: "",
                      associate_nature_of_business: "",
                      associate_constitution: "",
                      associate_key_person_details: "",
                    });
                    setFormData((prev) => ({ ...prev, associate_concerns: list }));
                  }}
                  className="h-7 px-2.5 text-xs text-blue-600 hover:bg-blue-50 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Concern
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Concern / Entity Name</th>
                    <th className="p-2.5">Nature of Activity</th>
                    <th className="p-2.5">Relationship</th>
                    <th className="p-2.5">Bank / Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.isArray(dsa.associate_concerns) && dsa.associate_concerns.length > 0 ? (
                    dsa.associate_concerns.map((ac: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="p-2.5 font-semibold text-slate-900">{ac.name || ac.associate_name || ac.entity_name || "—"}</td>
                        <td className="p-2.5 text-slate-600">{ac.nature_of_business || ac.associate_nature_of_business || ac.activity || "—"}</td>
                        <td className="p-2.5 text-slate-600">{ac.relationship || ac.associate_constitution || "—"}</td>
                        <td className="p-2.5 text-slate-600">{ac.bank_name || ac.associate_key_person_details || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                        No associate concerns recorded yet. Click Edit to add sister concerns.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </SectionBlock>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Section 11: Field Verification & Physical Visit Summary
         ───────────────────────────────────────────────────────────── */}
      {(dsa.visit_conducted_by || dsa.visit_conducted_at || dsa.visit_report_remarks) && (
        <SectionBlock
          icon={ShieldCheck}
          iconColor="text-emerald-600"
          title="Physical Visit"
        >
          <DetailGrid>
            <DetailItem
              label="Inspecting Officer"
              value={dsa.visit_conducted_by || "Branch Maker"}
            />
            <DetailItem
              label="Visit Execution Date"
              value={dsa.visit_conducted_at ? formatDate(dsa.visit_conducted_at) : "—"}
            />
            <DetailItem
              label="Visit Report Document Status"
              value={
                isVisitReportUploaded
                  ? "Physical Visit Report Attached"
                  : "Upload Pending"
              }
            />
            <DetailItem
              label="Inspection Remarks &amp; Observations"
              value={
                dsa.visit_report_remarks ||
                "Physical premises and business operations verified as per policy."
              }
            />
          </DetailGrid>
        </SectionBlock>
      )}
    </div>
  );
}
