"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  User,
  CheckCircle2,
  UploadCloud,
  FileText,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Check,
  Building,
  Briefcase,
  Users,
  Info,
  Loader2,
  ChevronDown,
  Download,
} from "lucide-react";
import { adminApi } from "@/apis/admin";
import { useMockStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardContent, DatePicker, Input, Label, Select } from "@/components/ui/primitives";
import { formatDate, generateDsaId } from "@/lib/utils";

export type OnboardingMode = "branch" | "self";
export type DsaType = "INDIVIDUAL" | "ENTITY";

interface DsaOnboardingFormProps {
  mode: OnboardingMode;
  onSuccess?: (dsa: any) => void;
}

interface Stakeholder {
  stakeholder_type: string;
  name: string;
  mobile_no: string;
  pan: string;
  aadhaar: string;
  din_dpin_no?: string;
}

interface DocDef {
  type: string;
  label: string;
  required: boolean | ((state: any) => boolean);
  requirementLabel: string;
  staffOnly?: boolean;
}

const INDIVIDUAL_DOCS: DocDef[] = [
  { type: "recent_photograph", label: "Recent photograph", required: true, requirementLabel: "Mandatory" },
  { type: "pan_card", label: "PAN Card", required: true, requirementLabel: "Mandatory" },
  { type: "aadhaar_card", label: "Aadhaar Card", required: true, requirementLabel: "Mandatory" },
  { type: "education_certificate", label: "Educational qualification certificate (highest)", required: true, requirementLabel: "Mandatory" },
  { type: "dsa_consent_dpdp", label: "DSA Consent Format (as per DPDP Act)", required: true, requirementLabel: "Mandatory" },
  { type: "visit_report", label: "Office Visit Report", required: (s) => s.mode === "branch", requirementLabel: "Mandatory", staffOnly: true },
  { type: "brief_profile", label: "Brief profile of DSA", required: false, requirementLabel: "Optional" },
  { type: "itr_returns", label: "IT Returns with computation (last 2 F.Y.)", required: false, requirementLabel: "Optional" },
  { type: "other_document", label: "Any other document", required: false, requirementLabel: "Optional" },
];

const ENTITY_DOCS: DocDef[] = [
  { type: "entity_pan_card", label: "Business Entity PAN Card", required: true, requirementLabel: "Mandatory" },
  { type: "stakeholder_photograph", label: "At least one Key Person / Partner / Director — Photograph", required: true, requirementLabel: "Mandatory" },
  { type: "stakeholder_pan_card", label: "At least one Key Person / Partner / Director — PAN Card", required: true, requirementLabel: "Mandatory" },
  { type: "stakeholder_aadhaar_card", label: "At least one Key Person / Partner / Director — Aadhaar Card", required: true, requirementLabel: "Mandatory" },
  { type: "dsa_consent_dpdp", label: "DSA Consent Format (as per DPDP Act)", required: true, requirementLabel: "Mandatory" },
  { type: "visit_report", label: "Office Visit Report", required: (s) => s.mode === "branch", requirementLabel: "Mandatory", staffOnly: true },
  { type: "brief_profile", label: "Brief profile of DSA entity", required: false, requirementLabel: "Optional" },
  { type: "itr_returns", label: "IT Returns with computation (last 2 F.Y.)", required: false, requirementLabel: "Optional" },
  { type: "other_document", label: "Any other document", required: false, requirementLabel: "Optional" },
];

const FALLBACK_EDUCATION_OPTIONS = [
  { key: "Professional Degree", label: "Professional Degree" },
  { key: "Post Graduate", label: "Post Graduate" },
  { key: "Graduate", label: "Graduate" },
  { key: "Undergraduate", label: "Undergraduate" },
  { key: "Diploma, ITI", label: "Diploma, ITI" },
  { key: "HSC & below", label: "HSC & below" },
];

const FALLBACK_STATE_OPTIONS = [
  { key: "Maharashtra", label: "Maharashtra" },
  { key: "Gujarat", label: "Gujarat" },
  { key: "Karnataka", label: "Karnataka" },
  { key: "Telangana", label: "Telangana" },
  { key: "Delhi", label: "Delhi" },
  { key: "Tamil Nadu", label: "Tamil Nadu" },
  { key: "Madhya Pradesh", label: "Madhya Pradesh" },
  { key: "Rajasthan", label: "Rajasthan" },
  { key: "Andhra Pradesh", label: "Andhra Pradesh" },
  { key: "Uttar Pradesh", label: "Uttar Pradesh" },
  { key: "West Bengal", label: "West Bengal" },
  { key: "Kerala", label: "Kerala" },
  { key: "Punjab", label: "Punjab" },
  { key: "Haryana", label: "Haryana" },
  { key: "Goa", label: "Goa" },
];

const FALLBACK_CITY_OPTIONS: Array<{ key: string; label: string; stateKey?: string }> = [
  // Maharashtra
  { key: "Mumbai", label: "Mumbai", stateKey: "MAHARASHTRA" },
  { key: "Pune", label: "Pune", stateKey: "MAHARASHTRA" },
  { key: "Nagpur", label: "Nagpur", stateKey: "MAHARASHTRA" },
  { key: "Nashik", label: "Nashik", stateKey: "MAHARASHTRA" },
  { key: "Aurangabad (Chhatrapati Sambhajinagar)", label: "Aurangabad (Chhatrapati Sambhajinagar)", stateKey: "MAHARASHTRA" },
  { key: "Thane", label: "Thane", stateKey: "MAHARASHTRA" },
  { key: "Navi Mumbai", label: "Navi Mumbai", stateKey: "MAHARASHTRA" },
  { key: "Kolhapur", label: "Kolhapur", stateKey: "MAHARASHTRA" },
  { key: "Solapur", label: "Solapur", stateKey: "MAHARASHTRA" },
  // Gujarat
  { key: "Ahmedabad", label: "Ahmedabad", stateKey: "GUJARAT" },
  { key: "Surat", label: "Surat", stateKey: "GUJARAT" },
  { key: "Vadodara", label: "Vadodara", stateKey: "GUJARAT" },
  { key: "Rajkot", label: "Rajkot", stateKey: "GUJARAT" },
  { key: "Gandhinagar", label: "Gandhinagar", stateKey: "GUJARAT" },
  // Karnataka
  { key: "Bengaluru", label: "Bengaluru", stateKey: "KARNATAKA" },
  { key: "Mysuru", label: "Mysuru", stateKey: "KARNATAKA" },
  { key: "Hubballi", label: "Hubballi", stateKey: "KARNATAKA" },
  // Telangana
  { key: "Hyderabad", label: "Hyderabad", stateKey: "TELANGANA" },
  { key: "Secunderabad", label: "Secunderabad", stateKey: "TELANGANA" },
  // Delhi
  { key: "New Delhi", label: "New Delhi", stateKey: "DELHI" },
  { key: "Delhi", label: "Delhi", stateKey: "DELHI" },
  // Tamil Nadu
  { key: "Chennai", label: "Chennai", stateKey: "TAMIL_NADU" },
  { key: "Coimbatore", label: "Coimbatore", stateKey: "TAMIL_NADU" },
  // Madhya Pradesh
  { key: "Indore", label: "Indore", stateKey: "MADHYA_PRADESH" },
  { key: "Bhopal", label: "Bhopal", stateKey: "MADHYA_PRADESH" },
  // Rajasthan
  { key: "Jaipur", label: "Jaipur", stateKey: "RAJASTHAN" },
  // Uttar Pradesh
  { key: "Lucknow", label: "Lucknow", stateKey: "UTTAR_PRADESH" },
  { key: "Kanpur", label: "Kanpur", stateKey: "UTTAR_PRADESH" },
  { key: "Noida", label: "Noida", stateKey: "UTTAR_PRADESH" },
  // West Bengal
  { key: "Kolkata", label: "Kolkata", stateKey: "WEST_BENGAL" },
  // Kerala
  { key: "Kochi", label: "Kochi", stateKey: "KERALA" },
  // Goa
  { key: "Panaji", label: "Panaji", stateKey: "GOA" },
];

const DEFAULT_BUSINESS_LICENSE_OPTIONS = [
  { key: "SHOP_ACT", label: "Shop Act" },
  { key: "GST", label: "GST" },
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
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectedLabels = useMemo(() => {
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
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm transition hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[38px]"
      >
        <div className="flex flex-wrap items-center gap-1.5 overflow-hidden text-left">
          {selectedKeys.length === 0 ? (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                {selectedKeys.length} selected
              </span>
              <span className="truncate text-slate-700 font-medium max-w-[180px] sm:max-w-[260px]">
                {selectedLabels.join(", ")}
              </span>
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
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
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-slate-500 hover:text-rose-600 font-medium transition-colors"
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

const getDraftKey = (mode: string) => `cosmos_dsa_onboarding_v2_${mode}`;

function base64ToFile(base64: string, filename: string): File {
  try {
    const arr = base64.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "application/octet-stream";
    const bstr = atob(arr[1] || "");
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch {
    return new File([], filename, { type: "application/octet-stream" });
  }
}

function parseUploadedDocs(rawDocs: any): Record<string, { file: File; base64: string; name: string; size: string }> {
  if (!rawDocs || typeof rawDocs !== "object") return {};
  const result: Record<string, { file: File; base64: string; name: string; size: string }> = {};
  for (const [key, val] of Object.entries(rawDocs as Record<string, any>)) {
    if (val && typeof val === "object" && val.base64 && val.name) {
      result[key] = {
        file: base64ToFile(val.base64, val.name),
        base64: val.base64,
        name: val.name,
        size: val.size || "Attached",
      };
    }
  }
  return result;
}

function readDraft(mode: string): any {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(getDraftKey(mode)) || localStorage.getItem(getDraftKey(mode));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function DsaOnboardingForm({ mode, onSuccess }: DsaOnboardingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { createItem, currentUser } = useMockStore();

  const [isMounted, setIsMounted] = useState<boolean>(false);

  const [step, setStep] = useState<number>(1);
  const [dsaType, setDsaType] = useState<DsaType>("INDIVIDUAL");
  const [branches, setBranches] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedDsa, setSubmittedDsa] = useState<any | null>(null);
  const [createdDsaId, setCreatedDsaId] = useState<number | string | null>(null);

  // Self-Onboarding OTP verification state
  const [branchId, setBranchId] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpVerified, setOtpVerified] = useState<boolean>(mode === "branch");
  const [otpValue, setOtpValue] = useState<string>("");
  const [otpReferenceId, setOtpReferenceId] = useState<string>("");
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // Form Fields - Individual
  const [firstName, setFirstName] = useState<string>("");
  const [middleName, setMiddleName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [dateOfBirth, setDateOfBirth] = useState<string>(""); // ISO YYYY-MM-DD for payload
  const [displayDob, setDisplayDob] = useState<string>("");   // DD/MM/YYYY for display
  const [aadhaarNo, setAadhaarNo] = useState<string>("");
  const [isAadhaarFocused, setIsAadhaarFocused] = useState<boolean>(false);
  const [educationQualification, setEducationQualification] = useState<string>("");
  const [educationOptions, setEducationOptions] = useState<{ key: string; label: string }[]>(FALLBACK_EDUCATION_OPTIONS);
  const [loadingEducation, setLoadingEducation] = useState<boolean>(false);

  // Form Fields - Entity
  const [entityName, setEntityName] = useState<string>("");
  const [constitution, setConstitution] = useState<string>("");
  const [natureOfBusiness, setNatureOfBusiness] = useState<string>("");
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([
    {
      stakeholder_type: "",
      name: "",
      mobile_no: "",
      pan: "",
      aadhaar: "",
      din_dpin_no: "",
    },
  ]);

  // Common Identity / Contact
  const [pan, setPan] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");
  const [contactPerson, setContactPerson] = useState<string>("");
  const [gstApplicable, setGstApplicable] = useState<boolean>(false);
  const [gstNumber, setGstNumber] = useState<string>("");
  const [experienceYears, setExperienceYears] = useState<string>("0");
  const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
  const [businessLicenseOptions, setBusinessLicenseOptions] = useState<Array<{ key: string; label: string }>>(DEFAULT_BUSINESS_LICENSE_OPTIONS);
  const hasExperience = experienceYears !== "0" && experienceYears !== "";
  const hasLicense = selectedLicenses.length > 0;

  // Address Details
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [stateName, setStateName] = useState<string>("");
  const [pincode, setPincode] = useState<string>("");
  const [isOfficeSameAsResidence, setIsOfficeSameAsResidence] = useState<boolean>(true);
  const [officeAddress, setOfficeAddress] = useState<string>("");
  const [officeCity, setOfficeCity] = useState<string>("");
  const [officeStateName, setOfficeStateName] = useState<string>("");
  const [officePincode, setOfficePincode] = useState<string>("");
  const [businessPremisesOwnership, setBusinessPremisesOwnership] = useState<"" | "Owned" | "Rented">("");
  const [stateOptions, setStateOptions] = useState<Array<{ key: string; label: string }>>(FALLBACK_STATE_OPTIONS);
  const [cityOptions, setCityOptions] = useState<Array<{ key: string; label: string; stateKey?: string }>>(FALLBACK_CITY_OPTIONS);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  // Banking Details
  const [bankName, setBankName] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState<string>("");
  const [accountType, setAccountType] = useState<string>("");
  const [ifsc, setIfsc] = useState<string>("");

  // References
  const [reference1Name, setReference1Name] = useState<string>("");
  const [reference1Contact, setReference1Contact] = useState<string>("");
  const [reference2Name, setReference2Name] = useState<string>("");
  const [reference2Contact, setReference2Contact] = useState<string>("");

  // Documents State
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { file: File; base64: string; name: string; size: string }>>({});
  const [visitReportRemarks, setVisitReportRemarks] = useState<string>("");

  // Declaration
  const [declarationAgreed, setDeclarationAgreed] = useState<boolean>(false);

  // Mark client mount to eliminate hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch branches on mount and guarantee valid selection
  useEffect(() => {
    let mounted = true;
    adminApi.getBranchesDropdown()
      .then((res: any) => {
        const list = res?.data ?? res ?? [];
        if (mounted && Array.isArray(list) && list.length > 0) {
          setBranches(list);
          setBranchId((curr) => {
            if (curr && list.some((b: any) => String(b.id ?? b.branch_id) === String(curr))) {
              return curr;
            }
            return String(list[0].id ?? list[0].branch_id ?? "1");
          });
        }
      })
      .catch(() => {
        if (mounted) {
          const fallback = [
            { id: 1, branch_name: "Main Branch", branch_code: "BR001" },
          ];
          setBranches(fallback);
          setBranchId((curr) => curr || "1");
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch education qualifications from master values API
  useEffect(() => {
    let mounted = true;
    setLoadingEducation(true);
    adminApi
      .getMasterValuesDropdown("education")
      .then((res: any) => {
        if (!mounted) return;
        const items = Array.isArray(res) ? res : res?.data || [];
        if (items.length > 0) {
          setEducationOptions(
            items.map((item: any) => ({
              key: item.meta_value || item.meta_key,
              label: item.meta_value || item.meta_key,
            }))
          );
        }
      })
      .catch(() => {
        // Retain fallback options
      })
      .finally(() => {
        if (mounted) setLoadingEducation(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch states and cities from master values API
  useEffect(() => {
    let mounted = true;
    setLoadingStates(true);
    adminApi
      .getMasterValuesDropdown("state")
      .then((res: any) => {
        if (!mounted) return;
        const items = Array.isArray(res) ? res : res?.data || [];
        if (items.length > 0) {
          setStateOptions(
            items.map((item: any) => ({
              key: item.meta_value || item.meta_key,
              label: item.meta_value || item.meta_key,
            }))
          );
        }
      })
      .catch(() => {
        // Retain fallback state options
      })
      .finally(() => {
        if (mounted) setLoadingStates(false);
      });

    setLoadingCities(true);
    adminApi
      .getMasterValuesDropdown("city")
      .then((res: any) => {
        if (!mounted) return;
        const items = Array.isArray(res) ? res : res?.data || [];
        if (items.length > 0) {
          setCityOptions(
            items.map((item: any) => {
              const metaKey = String(item.meta_key || "");
              const statePrefix = metaKey.includes(":") ? metaKey.split(":")[0] : "";
              return {
                key: item.meta_value || item.meta_key,
                label: item.meta_value || item.meta_key,
                stateKey: statePrefix,
              };
            })
          );
        }
      })
      .catch(() => {
        // Retain fallback city options
      })
      .finally(() => {
        if (mounted) setLoadingCities(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // State-wise filtered city options for Residence Address
  const stateCodeForResidence = useMemo(() => {
    if (!stateName) return "";
    return stateName.toUpperCase().replace(/[\s-]+/g, "_");
  }, [stateName]);

  const availableResidenceCities = useMemo(() => {
    if (!stateCodeForResidence) return [];
    return cityOptions.filter((c) => c.stateKey === stateCodeForResidence);
  }, [stateCodeForResidence, cityOptions]);

  const resolvedResidenceCityOptions = useMemo(() => {
    if (city && !availableResidenceCities.some((o) => o.key === city)) {
      return [{ key: city, label: city, stateKey: stateCodeForResidence }, ...availableResidenceCities];
    }
    return availableResidenceCities;
  }, [city, availableResidenceCities, stateCodeForResidence]);

  const handleStateChange = (newState: string) => {
    setStateName(newState);
    if (!newState) {
      setCity("");
      return;
    }
    const newCode = newState.toUpperCase().replace(/[\s-]+/g, "_");
    const matchingCities = cityOptions.filter((c) => c.stateKey === newCode);
    if (city && matchingCities.length > 0 && !matchingCities.some((c) => c.key === city)) {
      setCity("");
    }
  };

  // State-wise filtered city options for Office Address
  const stateCodeForOffice = useMemo(() => {
    if (!officeStateName) return "";
    return officeStateName.toUpperCase().replace(/[\s-]+/g, "_");
  }, [officeStateName]);

  const availableOfficeCities = useMemo(() => {
    if (!stateCodeForOffice) return [];
    return cityOptions.filter((c) => c.stateKey === stateCodeForOffice);
  }, [stateCodeForOffice, cityOptions]);

  const resolvedOfficeCityOptions = useMemo(() => {
    if (officeCity && !availableOfficeCities.some((o) => o.key === officeCity)) {
      return [{ key: officeCity, label: officeCity, stateKey: stateCodeForOffice }, ...availableOfficeCities];
    }
    return availableOfficeCities;
  }, [officeCity, availableOfficeCities, stateCodeForOffice]);

  const handleOfficeStateChange = (newState: string) => {
    setOfficeStateName(newState);
    if (!newState) {
      setOfficeCity("");
      return;
    }
    const newCode = newState.toUpperCase().replace(/[\s-]+/g, "_");
    const matchingCities = cityOptions.filter((c) => c.stateKey === newCode);
    if (officeCity && matchingCities.length > 0 && !matchingCities.some((c) => c.key === officeCity)) {
      setOfficeCity("");
    }
  };

  const resolvedStateOptions = useMemo(() => {
    if (stateName && !stateOptions.some((o) => o.key === stateName)) {
      return [{ key: stateName, label: stateName }, ...stateOptions];
    }
    return stateOptions;
  }, [stateName, stateOptions]);

  const resolvedOfficeStateOptions = useMemo(() => {
    if (officeStateName && !stateOptions.some((o) => o.key === officeStateName)) {
      return [{ key: officeStateName, label: officeStateName }, ...stateOptions];
    }
    return stateOptions;
  }, [officeStateName, stateOptions]);

  // Keep office address in sync when "Keep same as residential" toggle is active
  useEffect(() => {
    if (isOfficeSameAsResidence) {
      setOfficeAddress(address);
      setOfficeStateName(stateName);
      setOfficeCity(city);
      setOfficePincode(pincode);
    }
  }, [isOfficeSameAsResidence, address, stateName, city, pincode]);

  const getAadhaarDisplayValue = () => {
    if (isAadhaarFocused) return aadhaarNo;
    const clean = aadhaarNo.replace(/\D/g, "");
    if (!clean) return "";
    if (clean.length === 12) {
      return `XXXX-XXXX-${clean.slice(8)}`;
    }
    if (clean.length > 8) {
      return `XXXX-XXXX-${clean.slice(8)}`;
    }
    if (clean.length > 4) {
      return `XXXX-${clean.slice(4)}`;
    }
    return "XXXX-XXXX-XXXX";
  };

  // Ensure branchId always resolves to a valid existing branch
  useEffect(() => {
    if (branches.length > 0) {
      const exists = branches.some((b: any) => String(b.id ?? b.branch_id) === String(branchId));
      if (!exists) {
        setBranchId(String(branches[0].id ?? branches[0].branch_id ?? "1"));
      }
    }
  }, [branches, branchId]);

  // Keep contact person updated for Individual DSA
  useEffect(() => {
    if (dsaType === "INDIVIDUAL") {
      const full = [firstName, lastName].filter(Boolean).join(" ");
      if (full) setContactPerson(full);
    }
  }, [firstName, lastName, dsaType]);

  // Restore draft state from sessionStorage or localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem(getDraftKey(mode)) || localStorage.getItem(getDraftKey(mode));
      if (saved) {
        const data = JSON.parse(saved);
        if (data.submittedDsa) {
          setSubmittedDsa(data.submittedDsa);
          return;
        }
        if (data.createdDsaId) setCreatedDsaId(data.createdDsaId);
        if (data.step) setStep(data.step);
        if (data.dsaType) setDsaType(data.dsaType);
        if (data.branchId) setBranchId(data.branchId);
        if (data.otpSent !== undefined) setOtpSent(Boolean(data.otpSent));
        if (data.otpVerified !== undefined) setOtpVerified(Boolean(data.otpVerified));
        if (data.uploadedDocs) setUploadedDocs(parseUploadedDocs(data.uploadedDocs));
        if (data.firstName !== undefined) setFirstName(data.firstName);
        if (data.middleName !== undefined) setMiddleName(data.middleName);
        if (data.lastName !== undefined) setLastName(data.lastName);
        if (data.dateOfBirth !== undefined) {
          setDateOfBirth(data.dateOfBirth);
          if (data.dateOfBirth) {
            const parts = data.dateOfBirth.split("-");
            if (parts.length === 3) setDisplayDob(`${parts[2]}/${parts[1]}/${parts[0]}`);
          }
        }
        if (data.aadhaarNo !== undefined) setAadhaarNo(data.aadhaarNo);
        if (data.educationQualification !== undefined) setEducationQualification(data.educationQualification);
        if (data.entityName !== undefined) setEntityName(data.entityName);
        if (data.constitution !== undefined) setConstitution(data.constitution);
        if (data.natureOfBusiness !== undefined) setNatureOfBusiness(data.natureOfBusiness);
        if (data.stakeholders) setStakeholders(data.stakeholders);
        if (data.pan !== undefined) setPan(data.pan);
        if (data.email !== undefined) setEmail(data.email);
        if (data.mobile !== undefined) setMobile(data.mobile);
        if (data.contactPerson !== undefined) setContactPerson(data.contactPerson);
        if (data.gstApplicable !== undefined) setGstApplicable(data.gstApplicable);
        if (data.gstNumber !== undefined) setGstNumber(data.gstNumber);
        if (data.experienceYears !== undefined) {
          setExperienceYears(String(data.experienceYears));
        } else if (data.hasExperience !== undefined) {
          setExperienceYears(data.hasExperience ? "1" : "0");
        }
        if (Array.isArray(data.selectedLicenses)) {
          setSelectedLicenses(
            data.selectedLicenses
              .map((k: string) => {
                if (k === "SHOP_ACT_LICENSE") return "SHOP_ACT";
                if (k === "UDYAM_REGISTRATION") return "UDYAM";
                return k;
              })
              .filter((k: string) => ["SHOP_ACT", "GST", "UDYAM"].includes(k))
          );
        } else if (data.hasLicense !== undefined) {
          setSelectedLicenses(data.hasLicense ? ["SHOP_ACT"] : []);
        }
        if (data.address !== undefined) setAddress(data.address);
        if (data.city !== undefined) setCity(data.city);
        if (data.stateName !== undefined) setStateName(data.stateName);
        if (data.pincode !== undefined) setPincode(data.pincode);
        if (data.isOfficeSameAsResidence !== undefined) {
          setIsOfficeSameAsResidence(data.isOfficeSameAsResidence);
        } else if (data.hasCurrentAddress !== undefined) {
          setIsOfficeSameAsResidence(!data.hasCurrentAddress);
        }
        if (data.officeAddress !== undefined) setOfficeAddress(data.officeAddress);
        else if (data.currentAddress !== undefined) setOfficeAddress(data.currentAddress);
        if (data.officeCity !== undefined) setOfficeCity(data.officeCity);
        else if (data.currentCity !== undefined) setOfficeCity(data.currentCity);
        if (data.officeStateName !== undefined) setOfficeStateName(data.officeStateName);
        else if (data.currentStateName !== undefined) setOfficeStateName(data.currentStateName);
        if (data.officePincode !== undefined) setOfficePincode(data.officePincode);
        else if (data.currentPincode !== undefined) setOfficePincode(data.currentPincode);
        if (data.businessPremisesOwnership !== undefined) setBusinessPremisesOwnership(data.businessPremisesOwnership);
        if (data.bankName !== undefined) setBankName(data.bankName);
        if (data.accountName !== undefined) setAccountName(data.accountName);
        if (data.accountNumber !== undefined) setAccountNumber(data.accountNumber);
        if (data.confirmAccountNumber !== undefined) setConfirmAccountNumber(data.confirmAccountNumber);
        if (data.accountType !== undefined) setAccountType(data.accountType);
        if (data.ifsc !== undefined) setIfsc(data.ifsc);
        if (data.reference1Name !== undefined) setReference1Name(data.reference1Name);
        if (data.reference1Contact !== undefined) setReference1Contact(data.reference1Contact);
        if (data.reference2Name !== undefined) setReference2Name(data.reference2Name);
        if (data.reference2Contact !== undefined) setReference2Contact(data.reference2Contact);
        if (data.visitReportRemarks !== undefined) setVisitReportRemarks(data.visitReportRemarks);
        if (data.declarationAgreed !== undefined) setDeclarationAgreed(data.declarationAgreed);
      }
    } catch (e) {
      console.warn("Failed to load onboarding draft:", e);
    }
  }, [mode]);

  const clearDraft = () => {
    setCreatedDsaId(null);
    if (typeof window !== "undefined") {
      const key = getDraftKey(mode);
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn("Failed to clear draft:", e);
      }
    }
  };

  // Persist draft state to localStorage & sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = getDraftKey(mode);
      if (submittedDsa) {
        const payload = JSON.stringify({ submittedDsa });
        localStorage.setItem(key, payload);
        sessionStorage.setItem(key, payload);
      } else {
        const serializedDocs: Record<string, { base64: string; name: string; size: string }> = {};
        for (const [docKey, docVal] of Object.entries(uploadedDocs)) {
          if (docVal && docVal.base64) {
            serializedDocs[docKey] = {
              base64: docVal.base64,
              name: docVal.name,
              size: docVal.size,
            };
          }
        }

        const draft = {
          createdDsaId,
          step,
          dsaType,
          branchId,
          otpSent,
          otpVerified,
          uploadedDocs: serializedDocs,
          firstName,
          middleName,
          lastName,
          dateOfBirth,
          aadhaarNo,
          educationQualification,
          entityName,
          constitution,
          natureOfBusiness,
          stakeholders,
          pan,
          email,
          mobile,
          contactPerson,
          gstApplicable,
          gstNumber,
          hasExperience,
          hasLicense,
          experienceYears,
          selectedLicenses,
          address,
          city,
          stateName,
          pincode,
          isOfficeSameAsResidence,
          officeAddress,
          officeCity,
          officeStateName,
          officePincode,
          businessPremisesOwnership,
          bankName,
          accountName,
          accountNumber,
          confirmAccountNumber,
          accountType,
          ifsc,
          reference1Name,
          reference1Contact,
          reference2Name,
          reference2Contact,
          visitReportRemarks,
          declarationAgreed,
        };
        const payload = JSON.stringify(draft);
        try {
          sessionStorage.setItem(key, payload);
          localStorage.setItem(key, payload);
        } catch (storageErr) {
          // Fallback if base64 causes storage quota exceeded
          try {
            const trimmed = { ...draft, uploadedDocs: {} };
            const fallback = JSON.stringify(trimmed);
            sessionStorage.setItem(key, fallback);
            localStorage.setItem(key, fallback);
          } catch {
            // Ignore if storage is completely full
          }
        }
      }
    } catch (e) {
      console.warn("Failed to save onboarding draft:", e);
    }
  }, [
    mode,
    submittedDsa,
    step,
    dsaType,
    branchId,
    otpSent,
    otpVerified,
    uploadedDocs,
    firstName,
    middleName,
    lastName,
    dateOfBirth,
    aadhaarNo,
    educationQualification,
    entityName,
    constitution,
    natureOfBusiness,
    stakeholders,
    pan,
    email,
    mobile,
    contactPerson,
    gstApplicable,
    gstNumber,
    hasExperience,
    hasLicense,
    address,
    city,
    stateName,
    pincode,
    isOfficeSameAsResidence,
    officeAddress,
    officeCity,
    officeStateName,
    officePincode,
    businessPremisesOwnership,
    bankName,
    accountName,
    accountNumber,
    confirmAccountNumber,
    accountType,
    ifsc,
    reference1Name,
    reference1Contact,
    reference2Name,
    reference2Contact,
    visitReportRemarks,
    declarationAgreed,
    createdDsaId,
  ]);

  // Prevent accidental navigation during onboarding
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittedDsa && (step > 1 || Boolean(pan || firstName || entityName))) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submittedDsa, step, pan, firstName, entityName]);

  const docEvaluationState = {
    mode,
    dsaType,
    constitution,
    business_premises_ownership: businessPremisesOwnership,
    gst_applicable: gstApplicable,
    has_experience: hasExperience,
    has_license: hasLicense,
  };

  const currentDocList = useMemo(() => {
    const baseList = (dsaType === "INDIVIDUAL" ? INDIVIDUAL_DOCS : ENTITY_DOCS).filter((d) => {
      if (
        d.type === "experience_certificate" ||
        d.type === "business_license" ||
        d.type === "rent_agreement" ||
        d.type === "dsa_consent_dpdp" ||
        d.type === "gst_certificate" ||
        d.type === "board_resolution"
      )
        return false;
      if (d.staffOnly || d.type === "visit_report") {
        if (mode !== "branch") return false;
        const roleStr = String(currentUser?.role || "");
        if (roleStr === "DSA Partner" || roleStr === "Customer" || roleStr.includes("Checker")) return false;
      }
      return true;
    });

    const dynamicDocs: DocDef[] = [];

    // Prior experience / empanelment certificate: populates only when experience is selected > 0
    if (experienceYears !== "0" && experienceYears !== "") {
      dynamicDocs.push({
        type: "experience_certificate",
        label: `Experience certificates / empanelment letters from Banks / FIs (${experienceYears} yrs)`,
        required: true,
        requirementLabel: "Mandatory",
      });
    }

    // GST Certificate: populates only when user selected GST details (GST Applicable Yes, or GST Number, or GST checked in business licenses)
    const hasGst = Boolean(gstApplicable) || Boolean(gstNumber) || selectedLicenses.some((k) => k.toUpperCase() === "GST");
    if (hasGst) {
      dynamicDocs.push({
        type: "gst_certificate",
        label: "GST Certificate",
        required: true,
        requirementLabel: "Mandatory",
      });
    }

    // Dynamic business licenses selected from dropdown with checkboxes (excluding duplicate GST)
    selectedLicenses.forEach((licKey) => {
      if (licKey.toUpperCase() === "GST") {
        return;
      }
      const opt = businessLicenseOptions.find((o) => o.key === licKey);
      const licLabel = opt?.label || licKey;
      dynamicDocs.push({
        type: `business_license_${licKey.toLowerCase()}`,
        label: `Registered Business Proof — ${licLabel}`,
        required: true,
        requirementLabel: "Mandatory",
      });
    });

    // Board Resolution for Entity: populates only when constitution requires it
    if (dsaType === "ENTITY" && ["LLP", "Pvt Ltd", "Public Ltd", "Trust", "Co-op Society"].includes(constitution)) {
      dynamicDocs.push({
        type: "board_resolution",
        label: "Board Resolution — LLP / Pvt. Ltd. / Public Ltd. / Trust / Society",
        required: true,
        requirementLabel: "Mandatory",
      });
    }

    // Insert dynamic business & experience documents before optional documents (IT returns, Other docs)
    let list = [...baseList];
    const insertIdx = list.findIndex((d) => d.type === "itr_returns" || d.type === "other_document");
    if (insertIdx !== -1) {
      list.splice(insertIdx, 0, ...dynamicDocs);
    } else {
      list.push(...dynamicDocs);
    }

    // Dynamic Rental Proof / Rent Agreement: populates only when premises are rented
    if (businessPremisesOwnership === "Rented") {
      const otherDocIdx = list.findIndex((d) => d.type === "other_document");
      const rentalDoc: DocDef = {
        type: "rent_agreement",
        label: "Rental Proof / Rent Agreement",
        required: true,
        requirementLabel: "Mandatory",
      };
      if (otherDocIdx !== -1) {
        list.splice(otherDocIdx, 0, rentalDoc);
      } else {
        list.push(rentalDoc);
      }
    }

    return list;
  }, [
    dsaType,
    mode,
    currentUser?.role,
    experienceYears,
    selectedLicenses,
    businessLicenseOptions,
    businessPremisesOwnership,
    gstApplicable,
    gstNumber,
    constitution,
  ]);

  const isDocRequired = (doc: DocDef) => {
    if (typeof doc.required === "function") {
      return doc.required(docEvaluationState);
    }
    return Boolean(doc.required);
  };

  const handleFileUpload = (docType: string, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum allowed file size is 2MB.",
        variant: "warning",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const sizeKb = (file.size / 1024).toFixed(1) + " KB";
      setUploadedDocs((prev) => ({
        ...prev,
        [docType]: {
          file,
          base64,
          name: file.name,
          size: sizeKb,
        },
      }));
      toast({
        title: "Document attached",
        description: `${file.name} ready for upload.`,
        variant: "success",
      });
    };
    reader.readAsDataURL(file);
  };

  const removeDoc = (docType: string) => {
    setUploadedDocs((prev) => {
      const copy = { ...prev };
      delete copy[docType];
      return copy;
    });
  };

  const handleSendOtp = async () => {
    if (!mobile || mobile.replace(/\D/g, "").length !== 10) {
      toast({ title: "Mobile Required", description: "Enter valid 10-digit mobile number.", variant: "warning" });
      return;
    }
    const selectedBranch = branches.find((b) => String(b.id ?? b.branch_id) === String(branchId)) || branches[0];
    const validBranchId = selectedBranch ? Number(selectedBranch.id ?? selectedBranch.branch_id) : (Number(branchId) || 1);

    setIsSendingOtp(true);
    try {
      const res: any = await adminApi.sendSelfOnboardingOtp({ mobile, branch_id: validBranchId });
      setOtpSent(true);
      setOtpValue("");
      const refId = res?.data?.reference_id || res?.reference_id;
      if (refId) setOtpReferenceId(refId);
      const note = res?.data?.note || res?.note;
      toast({
        title: "OTP Sent",
        description: res?.message ? `${res.message}${note ? ` (${note})` : ""}` : `OTP sent to ${mobile}.`,
        variant: "success",
      });
    } catch (err: any) {
      setOtpSent(false);
      setOtpValue("");
      setOtpReferenceId("");
      const msg = err?.data?.message || err?.message || "Failed to send OTP.";
      toast({
        title: "Cannot Send OTP",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmedOtp = otpValue.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter 6-digit OTP.", variant: "warning" });
      return;
    }
    const selectedBranch = branches.find((b) => String(b.id ?? b.branch_id) === String(branchId)) || branches[0];
    const validBranchId = selectedBranch ? Number(selectedBranch.id ?? selectedBranch.branch_id) : (Number(branchId) || 1);

    setIsVerifyingOtp(true);
    try {
      const res: any = await adminApi.verifySelfOnboardingOtp({
        mobile,
        otp: trimmedOtp,
        reference_id: otpReferenceId || undefined,
        branch_id: validBranchId,
        dsa_type: dsaType,
      });
      setOtpVerified(true);
      toast({
        title: "Mobile Verified",
        description: res?.message || "Mobile number successfully verified.",
        variant: "success",
      });
    } catch (err: any) {
      setOtpVerified(false);
      const msg = err?.data?.message || err?.message || "Verification failed. Please check OTP and try again.";
      toast({
        title: "Verification Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleAddStakeholder = () => {
    setStakeholders((prev) => [
      ...prev,
      { stakeholder_type: "", name: "", mobile_no: "", pan: "", aadhaar: "", din_dpin_no: "" },
    ]);
  };

  const handleRemoveStakeholder = (idx: number) => {
    if (stakeholders.length <= 1) {
      toast({ title: "At least one stakeholder required", variant: "warning" });
      return;
    }
    setStakeholders((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateStakeholder = (idx: number, key: keyof Stakeholder, val: string) => {
    setStakeholders((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: val };
      return copy;
    });
  };

  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (mode === "self" && !otpVerified) {
        toast({ title: "OTP Verification Required", description: "Please verify mobile number before proceeding.", variant: "warning" });
        return false;
      }
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
      if (!pan || !panRegex.test(pan.trim())) {
        toast({ title: "Valid PAN Required", description: "Valid 10-character PAN format (e.g. ABCDE1234F) is mandatory.", variant: "warning" });
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        toast({ title: "Valid Email Required", description: "Valid email address is mandatory.", variant: "warning" });
        return false;
      }
      if (!mobile || mobile.replace(/\D/g, "").length !== 10) {
        toast({ title: "Valid Mobile Required", description: "10-digit mobile number is mandatory.", variant: "warning" });
        return false;
      }

      if (dsaType === "INDIVIDUAL") {
        if (!firstName.trim() || !lastName.trim()) {
          toast({ title: "Name Required", description: "First and Last name are mandatory.", variant: "warning" });
          return false;
        }
        if (!dateOfBirth) {
          toast({ title: "Date of Birth Required", description: "Please enter date of birth.", variant: "warning" });
          return false;
        }
        if (!educationQualification) {
          toast({ title: "Qualification Required", description: "Please select highest educational qualification.", variant: "warning" });
          return false;
        }
        const cleanAadhaar = aadhaarNo.replace(/\D/g, "");
        if (!cleanAadhaar) {
          toast({ title: "Aadhaar Required", description: "Aadhaar number is mandatory.", variant: "warning" });
          return false;
        }
        if (cleanAadhaar.length !== 12) {
          toast({ title: "Invalid Aadhaar", description: "Aadhaar number must be exactly 12 digits.", variant: "warning" });
          return false;
        }
      } else {
        if (!entityName.trim()) {
          toast({ title: "Entity Name Required", description: "Please enter registered entity name.", variant: "warning" });
          return false;
        }
        if (!constitution.trim()) {
          toast({ title: "Constitution Required", description: "Please select constitution of business.", variant: "warning" });
          return false;
        }
        if (!natureOfBusiness.trim()) {
          toast({ title: "Nature of Business Required", description: "Please enter nature of business.", variant: "warning" });
          return false;
        }
        if (!contactPerson.trim()) {
          toast({ title: "Contact Person Required", description: "Key contact person name is mandatory.", variant: "warning" });
          return false;
        }
        if (gstApplicable && (!gstNumber || gstNumber.trim().length < 15)) {
          toast({ title: "GST Number Required", description: "Valid 15-character GSTIN is mandatory.", variant: "warning" });
          return false;
        }
      }
      return true;
    }

    if (currentStep === 2) {
      if (!address.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
        toast({ title: "Residence Address Required", description: "Complete residence address, city, state, and pincode are mandatory.", variant: "warning" });
        return false;
      }
      if (pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
        toast({ title: "Residence Pincode Invalid", description: "Residence pincode must be exactly 6 digits.", variant: "warning" });
        return false;
      }
      if (!isOfficeSameAsResidence) {
        if (!officeAddress.trim() || !officeCity.trim() || !officeStateName.trim() || !officePincode.trim()) {
          toast({ title: "Office Address Required", description: "Complete office address, city, state, and pincode are mandatory when distinct.", variant: "warning" });
          return false;
        }
        if (officePincode.trim().length !== 6 || !/^\d{6}$/.test(officePincode.trim())) {
          toast({ title: "Office Pincode Invalid", description: "Office address pincode must be exactly 6 digits.", variant: "warning" });
          return false;
        }
      }
      if (!businessPremisesOwnership) {
        toast({ title: "Premises Ownership Required", description: "Please select business premises ownership.", variant: "warning" });
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (!bankName.trim() || !accountName.trim() || !accountNumber.trim() || !accountType || !ifsc.trim()) {
        toast({ title: "Bank Details Required", description: "All bank account details including account type are mandatory.", variant: "warning" });
        return false;
      }
      if (accountNumber.trim().length < 9) {
        toast({ title: "Invalid Account Number", description: "Bank account number must be at least 9 digits.", variant: "warning" });
        return false;
      }
      if (accountNumber !== confirmAccountNumber) {
        toast({ title: "Account Numbers Mismatch", description: "Account number and confirmation do not match.", variant: "warning" });
        return false;
      }
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
      if (!ifscRegex.test(ifsc.trim())) {
        toast({ title: "Invalid IFSC Code", description: "Enter a valid 11-character IFSC code (e.g. COSB0000001).", variant: "warning" });
        return false;
      }
      return true;
    }

    if (currentStep === 4) {
      if (!reference1Name.trim() || !reference1Contact.trim() || !reference2Name.trim() || !reference2Contact.trim()) {
        toast({ title: "Two References Required", description: "Both reference persons with valid mobile numbers are mandatory.", variant: "warning" });
        return false;
      }
      if (reference1Contact.replace(/\D/g, "").length !== 10 || reference2Contact.replace(/\D/g, "").length !== 10) {
        toast({ title: "Invalid Reference Mobile", description: "Both references must have 10-digit mobile numbers.", variant: "warning" });
        return false;
      }
      if (reference1Contact.replace(/\D/g, "") === reference2Contact.replace(/\D/g, "")) {
        toast({ title: "Duplicate Reference Contact", description: "Reference 1 and Reference 2 cannot have the same mobile number.", variant: "warning" });
        return false;
      }
      if (dsaType === "ENTITY") {
        for (let i = 0; i < stakeholders.length; i++) {
          const s = stakeholders[i];
          if (!s.stakeholder_type.trim() || !s.name.trim() || !s.pan.trim() || !s.mobile_no.trim()) {
            toast({
              title: `Stakeholder ${i + 1} Incomplete`,
              description: "Role, Name, PAN, and Mobile are mandatory for each key person.",
              variant: "warning",
            });
            return false;
          }
          const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
          if (!panRegex.test(s.pan.trim())) {
            toast({
              title: `Stakeholder ${i + 1} Invalid PAN`,
              description: "Enter a valid 10-character PAN format for stakeholder.",
              variant: "warning",
            });
            return false;
          }
          if (s.mobile_no.replace(/\D/g, "").length !== 10) {
            toast({
              title: `Stakeholder ${i + 1} Invalid Mobile`,
              description: "Enter a valid 10-digit mobile number for stakeholder.",
              variant: "warning",
            });
            return false;
          }
          if (s.aadhaar && s.aadhaar.replace(/\D/g, "").length !== 12) {
            toast({
              title: `Stakeholder ${i + 1} Invalid Aadhaar`,
              description: "Aadhaar number must be 12 digits.",
              variant: "warning",
            });
            return false;
          }
        }
      }
      return true;
    }

    if (currentStep === 5) {
      const missing = currentDocList
        .filter((d) => isDocRequired(d) && !uploadedDocs[d.type])
        .map((d) => d.label);

      if (!uploadedDocs["dsa_consent_dpdp"]) {
        missing.push("DSA Consent Form (signed)");
      }

      if (missing.length > 0) {
        toast({
          title: "Mandatory Documents Missing",
          description: `Please attach: ${missing.slice(0, 2).join(", ")}${missing.length > 2 ? ` and ${missing.length - 2} more` : ""}`,
          variant: "warning",
        });
        return false;
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 6));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!uploadedDocs["dsa_consent_dpdp"]) {
      toast({
        title: "DSA Consent Form Required",
        description: "Please download, sign, and upload the DSA Consent Form before submitting.",
        variant: "warning",
      });
      setStep(5);
      return;
    }

    setIsSubmitting(true);

    const selectedBranch = branches.find((b) => String(b.id ?? b.branch_id) === String(branchId)) || branches[0];
    const validBranchId = selectedBranch ? Number(selectedBranch.id ?? selectedBranch.branch_id) : (Number(branchId) || 1);

    // Base payload — fields required by both DsaBranchSubmitRequest & DsaSelfSubmitRequest
    const payload: any = {
      ...(createdDsaId ? { dsa_id: Number(createdDsaId) || createdDsaId } : {}),
      dsa_type: dsaType,
      branch_id: validBranchId,
      pan: pan.toUpperCase(),
      email,
      mobile,
      contact_person: contactPerson || undefined,
      address,
      city,
      state: stateName,
      pincode,
      office_address_different: !isOfficeSameAsResidence,
      office_address_line_1: isOfficeSameAsResidence ? address : officeAddress,
      office_city: isOfficeSameAsResidence ? city : officeCity,
      office_state: isOfficeSameAsResidence ? stateName : officeStateName,
      office_pincode: isOfficeSameAsResidence ? pincode : officePincode,
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      account_type: accountType,
      ifsc: ifsc.toUpperCase(),
      reference_1_name: reference1Name,
      reference_1_contact_no: reference1Contact,
      reference_2_name: reference2Name,
      reference_2_contact_no: reference2Contact,
    };

    // Type-specific fields — only send what belongs to the chosen DSA type
    if (dsaType === "INDIVIDUAL") {
      payload.first_name = firstName;
      if (middleName) payload.middle_name = middleName;
      payload.last_name = lastName;
      payload.date_of_birth = dateOfBirth;
      payload.education_qualification = educationQualification;
      payload.aadhaar_no = aadhaarNo.replace(/\D/g, "");
    } else {
      payload.entity_name = entityName;
      payload.constitution = constitution;
      payload.nature_of_business = natureOfBusiness;
      payload.stakeholders = stakeholders.map((s) => ({
        stakeholder_type: s.stakeholder_type,
        name: s.name,
        mobile_no: s.mobile_no,
        pan: s.pan.toUpperCase(),
        aadhaar: s.aadhaar || undefined,
        din_dpin_no: s.din_dpin_no || undefined,
      }));
    }

    try {
      let resultDsa: any = null;
      let dsaId: number | string = "";

      if (mode === "self") {
        const res = await adminApi.submitSelfOnboarding(payload);
        resultDsa = res?.data ?? res;
        dsaId = resultDsa?.id || resultDsa?.dsa_code || createdDsaId || generateDsaId();
      } else {
        const res = await adminApi.submitBranchOnboarding(payload);
        resultDsa = res?.data ?? res;
        dsaId = resultDsa?.id || resultDsa?.dsa_code || createdDsaId || generateDsaId();
      }

      if (resultDsa?.id) {
        setCreatedDsaId(resultDsa.id);
      }

      const docEntries = Object.entries(uploadedDocs);
      for (const [docType, docData] of docEntries) {
        try {
          if (docType === "visit_report" && mode === "branch") {
            await adminApi.uploadDsaVisitReport(dsaId, docData.file, visitReportRemarks);
          } else {
            await adminApi.uploadDsaDocument(dsaId, {
              document_type: docType,
              document_base64: docData.base64,
              file_name: docData.name,
              remarks: "Attached during onboarding",
            });
          }
        } catch (uploadErr: any) {
          console.error(`Doc upload failure for ${docType}:`, uploadErr);
          const docDef = currentDocList.find((d) => d.type === docType);
          const docLabel = docDef?.label || docData.name || docType;
          const errorMsg =
            uploadErr?.data?.message ||
            uploadErr?.message ||
            (typeof uploadErr === "string" ? uploadErr : "Document upload failed");

          toast({
            title: `Upload Failed: ${docLabel}`,
            description: `${errorMsg}. Application submission stopped. Please review your documents and try again.`,
            variant: "destructive",
          });

          // Stop immediately and fallback to Step 5 (Document Upload)
          setStep(5);
          window.scrollTo({ top: 0, behavior: "smooth" });
          setIsSubmitting(false);
          return;
        }
      }

      // Verify document checklist after uploads
      try {
        const checklistRes = await adminApi.getDsaDocumentChecklist(dsaId);
        const checklist = checklistRes?.data ?? checklistRes;
        if (checklist && checklist.is_complete === false && checklist.missing_mandatory_count > 0) {
          const missing = (checklist.missing_mandatory_documents ?? []).filter((docName: string) => {
            if (mode === "self" && docName.toLowerCase().includes("visit report")) return false;
            return true;
          });
          if (missing.length > 0) {
            toast({
              title: "Mandatory Documents Missing",
              description: `Verification check: ${missing.length} document(s) missing: ${missing.slice(0, 2).join(", ")}${missing.length > 2 ? ` and ${missing.length - 2} more` : ""}. Please attach required documents before completing submission.`,
              variant: "destructive",
            });
            setStep(5);
            window.scrollTo({ top: 0, behavior: "smooth" });
            setIsSubmitting(false);
            return;
          }
        }
      } catch (checklistErr: any) {
        console.warn("Checklist verification notice:", checklistErr);
      }

      const applicantName = dsaType === "INDIVIDUAL" ? `${firstName} ${lastName}`.trim() : entityName;
      const newDsaRecord = {
        id: String(dsaId || Date.now()),
        code: String(resultDsa?.dsa_code || resultDsa?.code || `DSA-2026-${Math.floor(10000 + Math.random() * 90000)}`),
        name: applicantName,
        businessType: dsaType === "INDIVIDUAL" ? "Individual" : constitution,
        city,
        state: stateName,
        pincode,
        contactPerson: contactPerson || applicantName,
        email,
        mobile,
        pan: pan.toUpperCase(),
        status: "Submitted",
        onboarding_status: "SUBMITTED",
        operational_status: "PENDING_VERIFICATION",
        current_approval_level: 1,
        tier: "Bronze",
        onboardingDate: new Date().toISOString(),
        manager: currentUser?.name || "Branch Maker",
        branchId: validBranchId,
        created_by_user_id: currentUser?.id,
        bank: {
          bankName,
          accountName,
          accountNumber,
          ifsc: ifsc.toUpperCase(),
        },
        address,
        dsa_type: dsaType,
        documents: Object.keys(uploadedDocs).map((t) => ({
          document_type: t,
          status: "Pending",
          file_name: uploadedDocs[t]?.name || "Document",
        })),
      };

      try {
        createItem("dsas", newDsaRecord as any);
      } catch (storeErr) {
        console.warn("Local store sync warning:", storeErr);
      }

      clearDraft();
      setSubmittedDsa(resultDsa || newDsaRecord);
      toast({
        title: "Application Submitted Successfully",
        description: `DSA record created with code ${newDsaRecord.code}. Sent to verification queue.`,
        variant: "success",
      });

      if (onSuccess) {
        onSuccess(resultDsa || newDsaRecord);
      }
    } catch (err: any) {
      console.warn("Backend submit error:", err);

      let errorMessage =
        err?.data?.message ||
        err?.message ||
        (typeof err === "string" ? err : "Failed to submit DSA application. Please check the details and try again.");

      if (err?.data?.errors && typeof err.data.errors === "object") {
        const errorList = Object.values(err.data.errors).flat().join(" ");
        if (errorList) errorMessage = errorList;
      }

      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) {
    return (
      <div className="mx-auto max-w-5xl py-12 px-4 sm:px-6">
        <div className="h-64 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-xs text-slate-500 font-medium">Loading onboarding application...</span>
          </div>
        </div>
      </div>
    );
  }

  if (submittedDsa) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center w-full min-h-[calc(100vh-10rem)] p-4 sm:p-6 my-auto">
        <Card className="w-full max-w-2xl border-emerald-200 bg-white shadow-xl overflow-hidden text-center mx-auto">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 py-8 px-6 text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Application Submitted Successfully!</h2>
            <p className="mt-2 text-emerald-100 text-sm">
              {mode === "branch"
                ? "The DSA registration has been routed directly to the Branch Maker verification queue."
                : "Thank you for registering. A verification link has been sent to your email."}
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold uppercase text-slate-500">DSA Reference Code</span>
                <span className="font-mono text-base font-bold text-blue-700">
                  {submittedDsa.code || submittedDsa.dsa_code || "DSA-2026-PENDING"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Applicant / Entity</span>
                <span className="font-semibold text-slate-900">{submittedDsa.name || entityName || `${firstName} ${lastName}`}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">DSA Type</span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                  {dsaType}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Queue Status</span>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  Pending Maker Review
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Documents Attached</span>
                <span className="font-semibold text-emerald-700">{Object.keys(uploadedDocs).length} files</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              {mode === "branch" ? (
                <>
                  <Button
                    onClick={() => {
                      clearDraft();
                      router.push("/dsa/management");
                    }}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    View DSA Management Queue
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearDraft();
                      setSubmittedDsa(null);
                      setStep(1);
                      setUploadedDocs({});
                      setFirstName("");
                      setLastName("");
                      setMiddleName("");
                      setPan("");
                      setEmail("");
                      setMobile("");
                      setAadhaarNo("");
                      setDateOfBirth("");
                      setEntityName("");
                      setAddress("");
                      setCity("");
                      setStateName("");
                      setPincode("");
                      setBankName("");
                      setAccountName("");
                      setAccountNumber("");
                      setConfirmAccountNumber("");
                      setAccountType("");
                      setIfsc("");
                      setReference1Name("");
                      setReference1Contact("");
                      setReference2Name("");
                      setReference2Contact("");
                      setDeclarationAgreed(false);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Onboard Another DSA
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    clearDraft();
                    router.push("/login");
                  }}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Return to Login
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-6 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Direct Selling Agent (DSA) Onboarding
        </h1>
        {mode === "branch" && (
          <Link
            href="/dsa/management"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to DSA Queue
          </Link>
        )}
      </div>

      {/* Stepper Progress Bar */}
      <div className="mb-8">
        <div className="hidden sm:grid sm:grid-cols-6 gap-2">
          {[
            { id: 1, name: "DSA Type & Identity", desc: "Type & Contact" },
            { id: 2, name: "Address & Premises", desc: "Location Details" },
            { id: 3, name: "Bank Details", desc: "Payout Account" },
            { id: 4, name: "References", desc: dsaType === "ENTITY" ? "Refs & Key Persons" : "Two References" },
            { id: 5, name: "Document Uploads", desc: "Checklist Matrix" },
            { id: 6, name: "Review & Submit", desc: "DPDP Declaration" },
          ].map((s) => {
            const isDone = s.id < step;
            const isCurrent = s.id === step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (isDone) setStep(s.id);
                }}
                disabled={!isDone && !isCurrent}
                className={`flex flex-col text-left border-t-4 pt-2.5 transition-colors ${
                  isDone
                    ? "border-blue-600 text-blue-900 cursor-pointer"
                    : isCurrent
                    ? "border-blue-600 text-blue-900 font-bold"
                    : "border-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                    isDone ? "bg-blue-600 text-white" : isCurrent ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600"
                  }`}>
                    {isDone ? "✓" : s.id}
                  </span>
                  <span className="text-xs font-semibold">{s.name}</span>
                </div>
                {/* <span className="text-[11px] text-slate-500 mt-0.5 truncate">{s.desc}</span> */}
              </button>
            );
          })}
        </div>

        {/* Mobile Stepper */}
        <div className="sm:hidden flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
          <span className="font-semibold text-slate-700">
            Step {step} of 6: {[
              "DSA Type & Identity",
              "Address & Premises",
              "Bank Details",
              "References",
              "Document Uploads",
              "Review & Submit",
            ][step - 1]}
          </span>
          <span className="text-blue-600 font-bold">{Math.round((step / 6) * 100)}%</span>
        </div>
      </div>

      {/* Main Form Body */}
      <Card className="border-slate-200 shadow-md bg-white">
        <CardContent className="p-6 sm:p-8">
          {/* STEP 1: DSA TYPE & IDENTITY */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 1: Select DSA Type & Basic Information</h3>
              </div>

              {/* DSA Type Radio Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setDsaType("INDIVIDUAL")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3.5 ${
                    dsaType === "INDIVIDUAL"
                      ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg ${dsaType === "INDIVIDUAL" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">Individual DSA</h4>
                      {dsaType === "INDIVIDUAL" && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Single professional applicant operating under personal PAN and credentials.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setDsaType("ENTITY")}
                  className={`cursor-pointer rounded-xl border p-4 transition-all flex items-start gap-3.5 ${
                    dsaType === "ENTITY"
                      ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className={`p-2.5 rounded-lg ${dsaType === "ENTITY" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">Entity / Corporate DSA</h4>
                      {dsaType === "ENTITY" && <Check className="h-4 w-4 text-blue-600" />}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Proprietorship, Sole Proprietorship, Partnership, LLP, Pvt Ltd, Public Ltd, Trust, or Co-operative Society.
                    </p>
                  </div>
                </div>
              </div>

              {/* Branch Selection (Public Self-Onboarding) */}
              {mode === "self" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <Building className="h-4 w-4 text-blue-600" />
                    Target Branch & Mobile Verification
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="branch_id" className="text-xs font-semibold">Select Home Branch *</Label>
                      <Select
                        id="branch_id"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        className="mt-1"
                      >
                        {branches.map((b, idx) => {
                          const val = String(b.id ?? b.branch_id ?? idx + 1);
                          return (
                            <option key={val} value={val}>
                              {`${b.branch_name} (${b.branch_code || "BR00"})`}
                            </option>
                          );
                        })}
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="self_mobile" className="text-xs font-semibold">Applicant Mobile Number *</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          id="self_mobile"
                          value={mobile}
                          onChange={(e) => {
                            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                            setOtpSent(false);
                            setOtpVerified(false);
                            setOtpValue("");
                            setOtpReferenceId("");
                          }}
                          placeholder="Enter 10-digit mobile"
                          disabled={otpVerified}
                          maxLength={10}
                        />
                        {!otpVerified && (
                          <Button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={isSendingOtp || mobile.length !== 10}
                            className="text-xs whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {isSendingOtp ? "Sending..." : otpSent ? "Resend" : "Send OTP"}
                          </Button>
                        )}
                        {otpVerified && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                              <Check className="h-3.5 w-3.5" /> Verified
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setOtpVerified(false);
                                setOtpSent(false);
                                setOtpValue("");
                                setOtpReferenceId("");
                              }}
                              className="text-[11px] text-blue-600 hover:underline font-medium whitespace-nowrap"
                            >
                              Change
                            </button>
                          </div>
                        )}
                      </div>

                      {otpSent && !otpVerified && (
                        <div className="mt-3 flex items-center gap-2">
                          <Input
                            value={otpValue}
                            onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="Enter 6-digit OTP"
                            maxLength={6}
                            className="font-mono text-sm"
                          />
                          <Button
                            type="button"
                            onClick={handleVerifyOtp}
                            disabled={isVerifyingOtp || otpValue.length !== 6}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                          >
                            {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* INDIVIDUAL FORM FIELDS */}
              {dsaType === "INDIVIDUAL" && (
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <User className="h-4 w-4 text-blue-600" />
                    Individual Personal Details
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="first_name" className="text-xs font-semibold">First Name *</Label>
                      <Input
                        id="first_name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Ramesh"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="middle_name" className="text-xs font-semibold">Middle Name (Optional)</Label>
                      <Input
                        id="middle_name"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="e.g. Kumar"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name" className="text-xs font-semibold">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Sharma"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="date_of_birth" className="text-xs font-semibold">Date of Birth * (DD/MM/YYYY)</Label>
                      <DatePicker
                        id="date_of_birth"
                        value={dateOfBirth}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDateOfBirth(v);
                          if (v) {
                            const parts = v.split("-");
                            if (parts.length === 3) setDisplayDob(`${parts[2]}/${parts[1]}/${parts[0]}`);
                          } else {
                            setDisplayDob("");
                          }
                        }}
                        max={new Date().toISOString().slice(0, 10)}
                        placeholder="DD/MM/YYYY"
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="pan" className="text-xs font-semibold">Individual PAN *</Label>
                      <Input
                        id="pan"
                        value={pan}
                        onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
                        placeholder="ABCDE1234F"
                        className="mt-1 font-mono uppercase"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <Label htmlFor="aadhaar_no" className="text-xs font-semibold">Aadhaar Number * (12 digits)</Label>
                      <Input
                        id="aadhaar_no"
                        value={getAadhaarDisplayValue()}
                        onFocus={() => setIsAadhaarFocused(true)}
                        onBlur={() => setIsAadhaarFocused(false)}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isAadhaarFocused) {
                            setAadhaarNo(val.replace(/\D/g, "").slice(0, 12));
                          } else {
                            const digits = val.replace(/\D/g, "");
                            if (digits.length === 12) setAadhaarNo(digits);
                          }
                        }}
                        placeholder={isAadhaarFocused ? "Enter 12-digit Aadhaar" : "XXXX-XXXX-XXXX"}
                        className="mt-1 font-mono tracking-wider"
                        maxLength={isAadhaarFocused ? 12 : 14}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {mode === "branch" && (
                      <div>
                        <Label htmlFor="branch_mobile" className="text-xs font-semibold">Mobile Number *</Label>
                        <Input
                          id="branch_mobile"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9876543210"
                          className="mt-1 font-mono"
                          maxLength={10}
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="email" className="text-xs font-semibold">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ramesh.sharma@example.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="education" className="text-xs font-semibold">Highest Educational Qualification *</Label>
                      <Select
                        id="education"
                        value={educationQualification}
                        onChange={(e) => setEducationQualification(e.target.value)}
                        className="mt-1"
                      >
                        <option value="">{loadingEducation ? "Loading qualifications..." : "Select Qualification"}</option>
                        {educationOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                        {educationQualification && !educationOptions.some((o) => o.key === educationQualification) && (
                          <option value={educationQualification}>{educationQualification}</option>
                        )}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <Label htmlFor="experience_years" className="text-xs font-semibold text-slate-700">
                        Applicant Prior Experience / Empanelment with other Banks/FIs
                      </Label>
                      <Select
                        id="experience_years"
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(e.target.value)}
                        className="mt-1"
                      >
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="3+">3+</option>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Registered Business Proof
                      </Label>
                      <div className="mt-1">
                        <CheckboxDropdown
                          id="individual_business_licenses"
                          placeholder="Business Proof (Shop Act / GST / Udyam)"
                          options={businessLicenseOptions}
                          selectedKeys={selectedLicenses}
                          onChange={setSelectedLicenses}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ENTITY FORM FIELDS */}
              {dsaType === "ENTITY" && (
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    Corporate / Business Entity Details
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="entity_name" className="text-xs font-semibold">Entity Legal Name *</Label>
                      <Input
                        id="entity_name"
                        value={entityName}
                        onChange={(e) => setEntityName(e.target.value)}
                        placeholder="e.g. Apex Financial Solutions Pvt Ltd"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="constitution" className="text-xs font-semibold">Constitution of Business *</Label>
                      <Select
                        id="constitution"
                        value={constitution}
                        onChange={(e) => setConstitution(e.target.value)}
                        className="mt-1"
                      >
                        <option value="">Select Constitution</option>
                        <option value="Proprietorship">Proprietorship</option>
                        <option value="Partnership">Partnership Firm</option>
                        <option value="LLP">Limited Liability Partnership (LLP)</option>
                        <option value="Pvt Ltd">Private Limited Company</option>
                        <option value="Public Ltd">Public Limited Company</option>
                        <option value="Trust">Trust</option>
                        <option value="Co-op Society">Co-operative Society</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="nature_of_business" className="text-xs font-semibold">Nature of Business *</Label>
                      <Input
                        id="nature_of_business"
                        value={natureOfBusiness}
                        onChange={(e) => setNatureOfBusiness(e.target.value)}
                        placeholder="Loan Distribution & Financial Services"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="entity_pan" className="text-xs font-semibold">Business Entity PAN *</Label>
                      <Input
                        id="entity_pan"
                        value={pan}
                        onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
                        placeholder="FGHIJ5678K"
                        className="mt-1 font-mono uppercase"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact_person" className="text-xs font-semibold">Key Contact Person Name *</Label>
                      <Input
                        id="contact_person"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="e.g. Vikram Malhotra"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mode === "branch" && (
                      <div>
                        <Label htmlFor="entity_mobile" className="text-xs font-semibold">Official Contact Mobile *</Label>
                        <Input
                          id="entity_mobile"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="9899988877"
                          className="mt-1 font-mono"
                          maxLength={10}
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="entity_email" className="text-xs font-semibold">Official Contact Email *</Label>
                      <Input
                        id="entity_email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="info@apexfin.com"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* GST & License Toggles */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-800">GST Registration Applicable?</span>
                        <p className="text-[11px] text-slate-500">If registered under GST, certificate upload is mandatory.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium">
                          <input
                            type="radio"
                            name="gst_applicable"
                            checked={gstApplicable}
                            onChange={() => setGstApplicable(true)}
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium">
                          <input
                            type="radio"
                            name="gst_applicable"
                            checked={!gstApplicable}
                            onChange={() => setGstApplicable(false)}
                          />
                          No
                        </label>
                      </div>
                    </div>

                    {gstApplicable && (
                      <div className="pt-2">
                        <Label htmlFor="gst_number" className="text-xs font-semibold">GSTIN / GST Number *</Label>
                        <Input
                          id="gst_number"
                          value={gstNumber}
                          onChange={(e) => setGstNumber(e.target.value.toUpperCase().slice(0, 15))}
                          placeholder="27FGHIJ5678K1Z5"
                          className="mt-1 font-mono uppercase max-w-sm"
                          maxLength={15}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div>
                        <Label htmlFor="entity_experience_years" className="text-xs font-semibold text-slate-700">
                          Entity Prior Experience / Empanelment Letters
                        </Label>
                        <Select
                          id="entity_experience_years"
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(e.target.value)}
                          className="mt-1"
                        >
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="3+">3+</option>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-slate-700">
                          Entity Registered Business Proof
                        </Label>
                        <div className="mt-1">
                          <CheckboxDropdown
                            id="entity_business_licenses"
                            placeholder="Business Proof (Shop Act / GST / Udyam)"
                            options={businessLicenseOptions}
                            selectedKeys={selectedLicenses}
                            onChange={setSelectedLicenses}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ADDRESS & PREMISES */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-900">Step 2: Business & Registered Address Details</h3>
              <div className="space-y-4">
                {/* Residence Address Section */}
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="address" className="text-xs font-semibold text-slate-700">Residence Address *</Label>
                    <textarea
                      id="address"
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="House/Flat No., Building, Street, Landmark"
                      className="mt-1 w-full rounded-md border border-slate-300 p-2.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="state" className="text-xs font-semibold text-slate-700">State *</Label>
                      <Select
                        id="state"
                        value={stateName}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="mt-1"
                        disabled={loadingStates}
                      >
                        <option value="">{loadingStates ? "Loading states..." : "Select State"}</option>
                        {resolvedStateOptions.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="city" className="text-xs font-semibold text-slate-700">City *</Label>
                      <Select
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="mt-1"
                        disabled={!stateName || loadingCities}
                      >
                        <option value="">
                          {!stateName
                            ? "Select State first"
                            : loadingCities
                            ? "Loading cities..."
                            : "Select City"}
                        </option>
                        {resolvedResidenceCityOptions.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="pincode" className="text-xs font-semibold text-slate-700">Pincode (6 digits) *</Label>
                      <Input
                        id="pincode"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="400001"
                        className="mt-1 font-mono"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>

                {/* Office Address Section */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Office Address</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Business premises and registered office location details
                    </p>
                  </div>

                  {/* Office Address Fields (Collapsed when toggled same as residential) */}
                  {!isOfficeSameAsResidence ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="office_address" className="text-xs font-semibold text-slate-700">Office Address *</Label>
                        <textarea
                          id="office_address"
                          rows={3}
                          value={officeAddress}
                          onChange={(e) => setOfficeAddress(e.target.value)}
                          placeholder="House/Flat No., Building, Street, Landmark"
                          className="mt-1 w-full rounded-md border border-slate-300 p-2.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="office_state" className="text-xs font-semibold text-slate-700">State *</Label>
                          <Select
                            id="office_state"
                            value={officeStateName}
                            onChange={(e) => handleOfficeStateChange(e.target.value)}
                            className="mt-1"
                            disabled={loadingStates}
                          >
                            <option value="">{loadingStates ? "Loading states..." : "Select State"}</option>
                            {resolvedOfficeStateOptions.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="office_city" className="text-xs font-semibold text-slate-700">City *</Label>
                          <Select
                            id="office_city"
                            value={officeCity}
                            onChange={(e) => setOfficeCity(e.target.value)}
                            className="mt-1"
                            disabled={!officeStateName || loadingCities}
                          >
                            <option value="">
                              {!officeStateName
                                ? "Select State first"
                                : loadingCities
                                ? "Loading cities..."
                                : "Select City"}
                            </option>
                            {resolvedOfficeCityOptions.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="office_pincode" className="text-xs font-semibold text-slate-700">Pincode (6 digits) *</Label>
                          <Input
                            id="office_pincode"
                            value={officePincode}
                            onChange={(e) => setOfficePincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="411001"
                            className="mt-1 font-mono"
                            maxLength={6}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50/90 border border-blue-200 px-3 py-2 text-xs text-blue-800">
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <span>Residential address is used as office address.</span>
                    </div>
                  )}

                  {/* Toggle Button: Keep same as residential */}
                  <div className={`flex items-center justify-between ${!isOfficeSameAsResidence ? "pt-3 border-t border-slate-200" : ""}`}>
                    <div>
                      <span className="text-xs font-bold text-slate-800">Keep same as residential</span>
                      <p className="text-[11px] text-slate-500">
                        {isOfficeSameAsResidence
                          ? "Office address is synced with residential address"
                          : "Toggle to automatically use residential address for office"}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOfficeSameAsResidence}
                      onClick={() => {
                        const next = !isOfficeSameAsResidence;
                        setIsOfficeSameAsResidence(next);
                        if (next) {
                          setOfficeAddress(address);
                          setOfficeStateName(stateName);
                          setOfficeCity(city);
                          setOfficePincode(pincode);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                        isOfficeSameAsResidence ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isOfficeSameAsResidence ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Premises Ownership */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <span className="text-xs font-bold text-slate-800">Business Premises Ownership *</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    If rented, a valid Rent Agreement document is mandatory at Step 5.
                  </p>

                  <div className="mt-3 flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="ownership"
                        checked={businessPremisesOwnership === "Owned"}
                        onChange={() => {
                          setBusinessPremisesOwnership("Owned");
                          if (uploadedDocs["rent_agreement"]) {
                            removeDoc("rent_agreement");
                          }
                        }}
                      />
                      <span>Self Owned Premises</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="radio"
                        name="ownership"
                        checked={businessPremisesOwnership === "Rented"}
                        onChange={() => setBusinessPremisesOwnership("Rented")}
                      />
                      <span className="text-blue-700">Rented / Leased Premises (Rent Agreement required)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: BANK DETAILS */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900">Step 3: Bank Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bank_name" className="text-xs font-semibold">Bank Name *</Label>
                  <Input
                    id="bank_name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. The Cosmos Co-operative Bank Ltd."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="account_name" className="text-xs font-semibold">Account Holder Name *</Label>
                  <Input
                    id="account_name"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Exact name as in bank records"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_number" className="text-xs font-semibold">Account Number *</Label>
                  <Input
                    id="account_number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 50100012345678"
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm_account_number" className="text-xs font-semibold">Confirm Account Number *</Label>
                  <Input
                    id="confirm_account_number"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="Re-enter account number"
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_type" className="text-xs font-semibold">Account Type *</Label>
                  <Select
                    id="account_type"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="mt-1"
                  >
                    <option value="">Select Account Type</option>
                    <option value="Current">Current Account (Recommended for DSA)</option>
                    <option value="Savings">Savings Account</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ifsc" className="text-xs font-semibold">IFSC Code *</Label>
                  <Input
                    id="ifsc"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))}
                    placeholder="e.g. COSB0000001"
                    className="mt-1 font-mono uppercase"
                    maxLength={11}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: REFERENCES & STAKEHOLDERS */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 4: References & Entity Stakeholders</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Provide two independent references and key stakeholders for verification.
                </p>
              </div>

              {/* Two References Section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-blue-600" />
                  Two Independent References (Mandatory)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ref1_name" className="text-xs font-semibold">Reference 1: Full Name *</Label>
                    <Input
                      id="ref1_name"
                      value={reference1Name}
                      onChange={(e) => setReference1Name(e.target.value)}
                      placeholder="e.g. Suresh Patel"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ref1_contact" className="text-xs font-semibold">Reference 1: Contact Number *</Label>
                    <Input
                      id="ref1_contact"
                      value={reference1Contact}
                      onChange={(e) => setReference1Contact(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9811122233"
                      className="mt-1 font-mono"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ref2_name" className="text-xs font-semibold">Reference 2: Full Name *</Label>
                    <Input
                      id="ref2_name"
                      value={reference2Name}
                      onChange={(e) => setReference2Name(e.target.value)}
                      placeholder="e.g. Amit Sharma"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ref2_contact" className="text-xs font-semibold">Reference 2: Contact Number *</Label>
                    <Input
                      id="ref2_contact"
                      value={reference2Contact}
                      onChange={(e) => setReference2Contact(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9822233344"
                      className="mt-1 font-mono"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* Stakeholders Section (Entity DSA Only) */}
              {dsaType === "ENTITY" && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4 text-blue-600" />
                        Key Persons / Partners / Directors (At least 1 Mandatory)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Enter stakeholder details. In Step 5, you must upload photograph, PAN and Aadhaar for at least one key person.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddStakeholder}
                      variant="outline"
                      className="text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Stakeholder
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {stakeholders.map((s, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm relative">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                          <span className="text-xs font-bold text-slate-800">Stakeholder #{idx + 1}</span>
                          {stakeholders.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveStakeholder(idx)}
                              className="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-[11px] font-semibold">Role / Designation *</Label>
                            <Select
                              value={s.stakeholder_type}
                              onChange={(e) => handleUpdateStakeholder(idx, "stakeholder_type", e.target.value)}
                              className="mt-1 text-xs"
                            >
                              <option value="">Select Role</option>
                              <option value="Director">Director</option>
                              <option value="Partner">Partner</option>
                              <option value="Proprietor">Proprietor</option>
                              <option value="Managing Trustee">Managing Trustee</option>
                              <option value="Authorized Signatory">Authorized Signatory</option>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[11px] font-semibold">Full Name *</Label>
                            <Input
                              value={s.name}
                              onChange={(e) => handleUpdateStakeholder(idx, "name", e.target.value)}
                              placeholder="e.g. Vikram Malhotra"
                              className="mt-1 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] font-semibold">Mobile Number *</Label>
                            <Input
                              value={s.mobile_no}
                              onChange={(e) => handleUpdateStakeholder(idx, "mobile_no", e.target.value.replace(/\D/g, "").slice(0, 10))}
                              placeholder="9899988877"
                              className="mt-1 text-xs font-mono"
                              maxLength={10}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                          <div>
                            <Label className="text-[11px] font-semibold">Individual PAN *</Label>
                            <Input
                              value={s.pan}
                              onChange={(e) => handleUpdateStakeholder(idx, "pan", e.target.value.toUpperCase().slice(0, 10))}
                              placeholder="ABCDE1111A"
                              className="mt-1 text-xs font-mono uppercase"
                              maxLength={10}
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] font-semibold">Aadhaar Number *</Label>
                            <Input
                              value={s.aadhaar}
                              onChange={(e) => handleUpdateStakeholder(idx, "aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))}
                              placeholder="999988887777"
                              className="mt-1 text-xs font-mono"
                              maxLength={12}
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] font-semibold">DIN / DPIN Number (Optional)</Label>
                            <Input
                              value={s.din_dpin_no || ""}
                              onChange={(e) => handleUpdateStakeholder(idx, "din_dpin_no", e.target.value)}
                              placeholder="01234567"
                              className="mt-1 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: DOCUMENT UPLOAD CHECKLIST */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Step 5: {dsaType === "INDIVIDUAL" ? "Individual DSA" : "Entity DSA"} — Document Checklist
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Attach verified documents (Max 2MB per file, PDF/JPG/PNG). All mandatory documents marked below are required to submit.
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                    Attached: {currentDocList.filter((d) => Boolean(uploadedDocs[d.type])).length} / {currentDocList.length}
                  </span>
                </div>
              </div>

              {/* Office Visit Report note for Bank staff */}
              {mode === "branch" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Bank Staff Requirement:</span> Office Visit Report is mandatory for branch onboarding.
                    Enter verification remarks below and upload signed visit report.
                  </div>
                </div>
              )}

              {/* Document Items Matrix */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-100/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-700 grid grid-cols-12 gap-3">
                  <span className="col-span-5 sm:col-span-6">Document Name</span>
                  <span className="col-span-3 sm:col-span-3">Status / Rule</span>
                  <span className="col-span-4 sm:col-span-3 text-right">Action / Upload</span>
                </div>

                {currentDocList.map((doc) => {
                  const required = isDocRequired(doc);
                  const attached = uploadedDocs[doc.type];

                  return (
                    <div
                      key={doc.type}
                      className={`px-4 py-3.5 text-xs grid grid-cols-12 gap-3 items-center transition-colors ${
                        attached ? "bg-emerald-50/30" : "bg-white hover:bg-slate-50/50"
                      }`}
                    >
                      {/* Document Label */}
                      <div className="col-span-5 sm:col-span-6">
                        <div className="flex items-center gap-2">
                          <FileText className={`h-4 w-4 flex-shrink-0 ${attached ? "text-emerald-600" : "text-slate-400"}`} />
                          <span className="font-semibold text-slate-800">{doc.label}</span>
                        </div>
                        {attached && (
                          <span className="text-[11px] text-emerald-700 font-medium ml-6 block">
                            ✓ {attached.name} ({attached.size})
                          </span>
                        )}
                      </div>

                      {/* Requirement Badge */}
                      <div className="col-span-3 sm:col-span-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            required
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {required ? "Mandatory" : "Optional"}
                        </span>
                      </div>

                      {/* File Upload Button / Remove Button */}
                      <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-2">
                        {attached ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Attached
                            </span>
                            <button
                              type="button"
                              onClick={() => removeDoc(doc.type)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50"
                              title="Remove file"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-colors">
                            <UploadCloud className="h-3.5 w-3.5 text-blue-600" />
                            <span>Attach</span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleFileUpload(doc.type, f);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 16. DSA Consent Form Download & Signed Upload */}
              <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-200/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm flex-shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">16. DSA Consent Form</h4>
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          Mandatory
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Consent format as per Digital Personal Data Protection (DPDP) Act
                      </p>
                    </div>
                  </div>

                  {/* Download option */}
                  <a
                    href="/documents/Cosmos_Bank_DSA_Consent_Form.pdf"
                    download="Cosmos_Bank_DSA_Consent_Form.pdf"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50 hover:border-blue-400 transition-colors w-fit"
                  >
                    <Download className="h-3.5 w-3.5 text-blue-600" />
                    <span>Download Consent Form</span>
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-700">Instructions:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                      <li>Download the official DSA Consent Form template.</li>
                      <li>Review, sign, and date the form.</li>
                      <li>Upload the signed copy here (Supports Image & PDF).</li>
                    </ol>
                  </div>

                  {/* Upload area */}
                  <div className="flex flex-col sm:items-end justify-center">
                    {uploadedDocs["dsa_consent_dpdp"] ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/80 w-full sm:w-auto">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-xs font-semibold text-emerald-900 truncate max-w-[200px]">
                            {uploadedDocs["dsa_consent_dpdp"].name}
                          </p>
                          <p className="text-[10px] text-emerald-700">
                            Signed document attached ({uploadedDocs["dsa_consent_dpdp"].size})
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDoc("dsa_consent_dpdp")}
                          className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-100 transition-colors ml-2"
                          title="Remove signed consent form"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full sm:w-auto text-left sm:text-right">
                        <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors">
                          <UploadCloud className="h-4 w-4" />
                          <span>Upload Signed Form</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload("dsa_consent_dpdp", f);
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Supported formats: PDF, JPG, JPEG, PNG (Max 2MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Remarks for Bank Staff Visit Report */}
              {mode === "branch" && uploadedDocs["visit_report"] && (
                <div className="pt-2">
                  <Label htmlFor="visit_remarks" className="text-xs font-semibold">Office Visit Report Remarks</Label>
                  <Input
                    id="visit_remarks"
                    value={visitReportRemarks}
                    onChange={(e) => setVisitReportRemarks(e.target.value)}
                    placeholder="e.g. Physical premises verified by Branch Maker on site."
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 6: REVIEW & FINAL SUBMISSION */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 6: Review Application & Declaration</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and verify all application details and uploaded documents before submission.
                </p>
              </div>

              {/* Review Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Identity Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800 uppercase tracking-wide">Identity & Profile</span>
                    <span className="font-bold text-blue-600">{dsaType}</span>
                  </div>
                  <div className="space-y-1 pt-1 text-slate-700">
                    {dsaType === "INDIVIDUAL" ? (
                      <>
                        <p><span className="text-slate-500">Applicant:</span> <span className="font-semibold">{firstName} {middleName} {lastName}</span></p>
                        <p><span className="text-slate-500">DOB:</span> {formatDate(dateOfBirth)}</p>
                        <p><span className="text-slate-500">Highest Qualification:</span> {educationQualification}</p>
                        <p><span className="text-slate-500">Aadhaar:</span> {aadhaarNo ? `XXXX-XXXX-${aadhaarNo.slice(-4)}` : "N/A"}</p>
                      </>
                    ) : (
                      <>
                        <p><span className="text-slate-500">Entity:</span> <span className="font-semibold">{entityName}</span></p>
                        <p><span className="text-slate-500">Constitution:</span> {constitution}</p>
                        <p><span className="text-slate-500">Nature of Business:</span> {natureOfBusiness}</p>
                        <p><span className="text-slate-500">Contact Person:</span> {contactPerson}</p>
                        {gstApplicable && <p><span className="text-slate-500">GSTIN:</span> {gstNumber}</p>}
                      </>
                    )}
                    <p><span className="text-slate-500">PAN:</span> <span className="font-mono font-semibold">{pan}</span></p>
                    <p><span className="text-slate-500">Mobile:</span> {mobile}</p>
                    <p><span className="text-slate-500">Email:</span> {email}</p>
                    <p><span className="text-slate-500">Prior Experience:</span> <span className="font-semibold">{experienceYears === "0" ? "0 (No prior experience)" : `${experienceYears} yrs`}</span></p>
                    <p><span className="text-slate-500">Business Licenses:</span> <span className="font-semibold">{selectedLicenses.length > 0 ? selectedLicenses.map((k) => businessLicenseOptions.find((o) => o.key === k)?.label || k).join(", ") : "None"}</span></p>
                  </div>
                </div>

                {/* Bank Details Summary */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800 uppercase tracking-wide">Bank Details</span>
                    <span className="font-bold text-emerald-600">{accountType}</span>
                  </div>
                  <div className="space-y-1 pt-1 text-slate-700">
                    <p><span className="text-slate-500">Bank:</span> {bankName}</p>
                    <p><span className="text-slate-500">Account Name:</span> {accountName}</p>
                    <p><span className="text-slate-500">Account No:</span> <span className="font-mono font-semibold">{accountNumber}</span></p>
                    <p><span className="text-slate-500">IFSC Code:</span> <span className="font-mono font-semibold">{ifsc}</span></p>
                    <p><span className="text-slate-500">Premises:</span> {businessPremisesOwnership}</p>
                    <p><span className="text-slate-500">Residence Address:</span> {address ? `${address}, ${city}, ${stateName} - ${pincode}` : `${city}, ${stateName} - ${pincode}`}</p>
                    <p>
                      <span className="text-slate-500">Office Address:</span>{" "}
                      {isOfficeSameAsResidence
                        ? "Same as Residence Address"
                        : `${officeAddress}, ${officeCity}, ${officeStateName} - ${officePincode}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* References & Docs Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wide block border-b border-slate-200 pb-2">
                    References
                  </span>
                  <div className="space-y-1 pt-1 text-slate-700">
                    <p><span className="text-slate-500">Ref 1:</span> {reference1Name} ({reference1Contact})</p>
                    <p><span className="text-slate-500">Ref 2:</span> {reference2Name} ({reference2Contact})</p>
                    {dsaType === "ENTITY" && (
                      <p className="pt-1 text-blue-700 font-semibold">
                        {stakeholders.length} Key Person(s) / Stakeholder(s) Added
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <span className="font-bold text-slate-800 uppercase tracking-wide block border-b border-slate-200 pb-2">
                    Documents Prepared ({Object.keys(uploadedDocs).length} files)
                  </span>
                  <ul className="space-y-1 pt-1 text-slate-700">
                    {Object.entries(uploadedDocs).map(([key, item]) => (
                      <li key={key} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 truncate max-w-[180px]">{item.name}</span>
                        <span className="text-emerald-700 font-semibold">Uploaded</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* DPDP Act Declaration Box */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {uploadedDocs["dsa_consent_dpdp"] ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Info className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div className="text-xs text-slate-800 leading-relaxed space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-blue-900">
                        DSA Consent & Declaration (Under Digital Personal Data Protection Act)
                      </span>
                      {uploadedDocs["dsa_consent_dpdp"] ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓ Signed Consent Form Uploaded ({uploadedDocs["dsa_consent_dpdp"].name})
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
                          Signed Form Pending Upload in Step 5
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600">
                      I/We hereby declare that all information and documents furnished above are true, complete, and authentic.
                      I/We grant express consent to The Cosmos Co-operative Bank Ltd. to verify details, conduct due diligence,
                      and process my personal and business data strictly for empanelment, origination, and regulatory compliance as formalized in the attached signed DSA consent document.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
                className="gap-1.5 text-xs font-semibold"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            ) : <div />}

            {step < 6 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !uploadedDocs["dsa_consent_dpdp"]}
                className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  "Submit DSA Application"
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
