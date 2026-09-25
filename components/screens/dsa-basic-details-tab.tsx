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
} from "lucide-react";
import { Button, Input, Label, Select, StatusBadge } from "@/components/ui/primitives";
import { DetailGrid, DetailItem } from "@/components/module";
import { formatDate } from "@/lib/utils";
import { getDsaDisplayStatus } from "./dsa-pages";
import type { BranchOption } from "@/types/dsa";

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

interface DsaBasicDetailsTabProps {
  dsa: any;
  canEdit: boolean;
  branches: BranchOption[];
  onSaveBlock: (blockKey: DetailBlockKey, payload: Record<string, any>) => Promise<boolean>;
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

  const isEntity = dsa.dsa_type === "NON_INDIVIDUAL" || dsa.dsa_type === "ENTITY";

  // Initialize block form data when entering edit mode
  const startEditing = (block: DetailBlockKey) => {
    setActiveEditBlock(block);
    setErrors({});

    switch (block) {
      case "sourcing":
        setFormData({
          dsa_type: dsa.dsa_type || (isEntity ? "ENTITY" : "INDIVIDUAL"),
          submission_mode: dsa.submission_mode || "BRANCH",
        });
        break;

      case "applicant":
        setFormData({
          applicant_title: dsa.applicant_title || "Mr.",
          first_name: dsa.first_name || "",
          middle_name: dsa.middle_name || "",
          last_name: dsa.last_name || "",
          entity_name: dsa.entity_name || dsa.name || "",
          contact_person: dsa.contact_person || "",
          constitution:
            dsa.constitution ||
            (isEntity ? "Private Limited" : "Individual / Sole Proprietorship"),
          business_type:
            dsa.business_type || (isEntity ? "Corporate" : "Sole Proprietorship"),
          nature_of_business:
            dsa.nature_of_business || "Direct Selling Agent / Retail Loan Sourcing",
          registration_no_llpin_cin: dsa.registration_no_llpin_cin || "",
          date_of_birth: dsa.date_of_birth ? dsa.date_of_birth.substring(0, 10) : "",
          age: dsa.age || "",
          education_qualification: dsa.education_qualification || "Graduate",
          aadhaar_no: dsa.aadhaar_no || "",
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

      case "statutory":
        setFormData({
          pan: dsa.pan || "",
          gst_applicable: Boolean(dsa.gst_applicable),
          gst: dsa.gst || "",
          registered_business_proof: dsa.registered_business_proof || "",
          applicant_prior_experience: dsa.applicant_prior_experience || "",
          experience_years:
            dsa.experience_years !== undefined && dsa.experience_years !== null
              ? String(dsa.experience_years)
              : "",
          udyam_no: dsa.udyam_no || "",
          shop_act_no: dsa.shop_act_no || "",
          business_premises_ownership: dsa.business_premises_ownership || "Self Owned",
        });
        break;

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
          business_premises_ownership: dsa.business_premises_ownership || "Self Owned",
          office_address_different: Boolean(dsa.office_address_different),
          office_address_line_1: dsa.office_address_line_1 || "",
          office_city: dsa.office_city || "",
          office_state: dsa.office_state || "",
          office_pincode: dsa.office_pincode || "",
        });
        break;

      case "bank":
        setFormData({
          bank_name: dsa.bank_name || "Cosmos Co-operative Bank",
          account_name: dsa.account_name || dsa.name || "",
          account_number: dsa.account_number || "",
          account_type: dsa.account_type || "Savings",
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
                stakeholder_type: sh.stakeholder_type || "Partner / Director",
                mobile_no: sh.mobile_no || "",
                pan_no: sh.pan || sh.pan_no || "",
                qualification: sh.qualification || "",
                din_dpin_no: sh.din_dpin_no || sh.aadhaar || "",
              }))
            : [
                {
                  name: "",
                  stakeholder_type: "Partner / Director",
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
                associate_constitution: ac.relationship || ac.associate_constitution || "Associate Concern",
                associate_key_person_details: ac.bank_name || ac.associate_key_person_details || "",
              }))
            : [
                {
                  associate_name: "",
                  associate_nature_of_business: "",
                  associate_constitution: "Associate Concern",
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
        if (!formData.entity_name?.trim()) errs.entity_name = "Entity Name is required";
        if (!formData.contact_person?.trim()) errs.contact_person = "Contact Person is required";
      } else {
        if (!formData.first_name?.trim()) errs.first_name = "First Name is required";
        if (!formData.last_name?.trim()) errs.last_name = "Last Name is required";
        if (formData.aadhaar_no && !/^\d{12}$/.test(formData.aadhaar_no.replace(/\s/g, ""))) {
          errs.aadhaar_no = "Aadhaar must be exactly 12 digits";
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
          errs.ifsc = "IFSC format must be IDFC0000123";
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
        } else {
          payload.name = payload.entity_name;
        }
      }

      if (block === "branch" && payload.branch_id) {
        payload.branch_id = Number(payload.branch_id);
      }

      if (block === "statutory" && payload.experience_years !== undefined) {
        payload.experience_years = payload.experience_years ? String(payload.experience_years) : null;
      }

      const success = await onSaveBlock(block, payload);
      if (success) {
        setActiveEditBlock(null);
        setFormData({});
        setErrors({});
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
    <div className="space-y-8 pt-2">
      {/* ─────────────────────────────────────────────────────────────
          Section 1: Application & Sourcing Journey Overview
         ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Application &amp; Sourcing Journey Overview
            </h4>
          </div>
          {renderHeaderAction("sourcing")}
        </div>

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
                <Select
                  value={formData.submission_mode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, submission_mode: e.target.value }))}
                  className="w-full text-sm font-semibold"
                >
                  <option value="BRANCH">Branch Assisted Sourcing</option>
                  <option value="SELF">Self-Onboarding (Online Portal)</option>
                </Select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Channels: Branch sourcing or customer self-service onboarding.
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
                dsa.dsa_code ? (
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {dsa.dsa_code}
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
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Section 2: Applicant & Business Profile
         ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Applicant &amp; Business Profile
            </h4>
          </div>
          {renderHeaderAction("applicant")}
        </div>

        {activeEditBlock === "applicant" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-4">
            {!isEntity ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Title</Label>
                  <Select
                    value={formData.applicant_title || "Mr."}
                    onChange={(e) => setFormData((prev) => ({ ...prev, applicant_title: e.target.value }))}
                  >
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                  </Select>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">First Name *</Label>
                  <Input
                    value={formData.first_name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="First name"
                  />
                  {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Middle Name</Label>
                  <Input
                    value={formData.middle_name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, middle_name: e.target.value }))}
                    placeholder="Middle name"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Last Name *</Label>
                  <Input
                    value={formData.last_name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Last name"
                  />
                  {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth || ""}
                    onChange={(e) => handleDobChange(e.target.value)}
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Age (Years)</Label>
                  <Input
                    type="number"
                    value={formData.age || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                    placeholder="Age"
                  />
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Qualification</Label>
                  <Select
                    value={formData.education_qualification || "Graduate"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, education_qualification: e.target.value }))}
                  >
                    <option value="Graduate">Graduate</option>
                    <option value="Post Graduate">Post Graduate</option>
                    <option value="Undergraduate">Undergraduate</option>
                    <option value="Professional (CA/CS/CFA)">Professional (CA/CS/CFA)</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Aadhaar (12 Digits)</Label>
                  <Input
                    value={formData.aadhaar_no || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, aadhaar_no: e.target.value }))}
                    placeholder="12 digit Aadhaar"
                    maxLength={12}
                  />
                  {errors.aadhaar_no && <p className="text-red-500 text-xs mt-1">{errors.aadhaar_no}</p>}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-2">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Entity / Firm Name *</Label>
                  <Input
                    value={formData.entity_name || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, entity_name: e.target.value }))}
                    placeholder="Registered business or firm name"
                  />
                  {errors.entity_name && <p className="text-red-500 text-xs mt-1">{errors.entity_name}</p>}
                </div>

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
                    value={formData.constitution || "Private Limited"}
                    onChange={(e) => setFormData((prev) => ({ ...prev, constitution: e.target.value }))}
                  >
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

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Incorporation Date</Label>
                  <Input
                    type="date"
                    value={formData.date_of_birth || ""}
                    onChange={(e) => handleDobChange(e.target.value)}
                  />
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Vintage / Age (Years)</Label>
                  <Input
                    type="number"
                    value={formData.age || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
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
                dsa.constitution ||
                (!isEntity
                  ? "Individual / Sole Proprietorship"
                  : "Commercial Entity")
              }
            />
            <DetailItem
              label="Business Type / Category"
              value={
                dsa.business_type ||
                dsa.constitution ||
                "Sole Proprietorship"
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
              label={isEntity ? "Incorporation Date / Age" : "Date of Birth / Age"}
              value={
                dsa.date_of_birth
                  ? `${formatDate(dsa.date_of_birth)}${dsa.age ? ` (${dsa.age} yrs)` : ""}`
                  : dsa.age
                    ? `${dsa.age} years`
                    : "—"
              }
            />
            <DetailItem
              label="Educational Qualification"
              value={dsa.education_qualification || "Graduate"}
            />
            <DetailItem
              label={dsa.registration_no_llpin_cin ? "CIN / LLPIN / Registration Number" : "Aadhaar Number"}
              value={
                dsa.registration_no_llpin_cin ? (
                  <span className="font-mono">{dsa.registration_no_llpin_cin}</span>
                ) : dsa.aadhaar_no ? (
                  dsa.aadhaar_no.length >= 4
                    ? `•••• •••• ${dsa.aadhaar_no.slice(-4)}`
                    : dsa.aadhaar_no
                ) : (
                  "Verified via Identity Document"
                )
              }
            />
            {dsa.registration_no_llpin_cin && dsa.aadhaar_no ? (
              <DetailItem
                label="Aadhaar Number"
                value={
                  dsa.aadhaar_no.length >= 4
                    ? `•••• •••• ${dsa.aadhaar_no.slice(-4)}`
                    : dsa.aadhaar_no
                }
              />
            ) : null}
          </DetailGrid>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Section 3: Contact & Communication Channels
         ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Contact &amp; Communication Channels
            </h4>
          </div>
          {renderHeaderAction("contact")}
        </div>

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
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Section 4: Statutory, Tax & Licensing Details
         ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Statutory, Tax &amp; Licensing Details
            </h4>
          </div>
          {renderHeaderAction("statutory")}
        </div>

        {activeEditBlock === "statutory" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Permanent Account Number (PAN)
                </Label>
                <Input
                  value={formData.pan || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="font-mono uppercase font-bold"
                />
                {errors.pan && <p className="text-red-500 text-xs mt-1">{errors.pan}</p>}
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  GST Registration Status
                </Label>
                <Select
                  value={formData.gst_applicable ? "YES" : "NO"}
                  onChange={(e) => {
                    const isApp = e.target.value === "YES";
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
                </div>
              ) : null}

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Registered Business Proof
                </Label>
                <Input
                  value={formData.registered_business_proof || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, registered_business_proof: e.target.value }))}
                  placeholder="e.g. Shop Act, Udyam Registration"
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Udyam Registration Number
                </Label>
                <Input
                  value={formData.udyam_no || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, udyam_no: e.target.value }))}
                  placeholder="UDYAM-XX-00-0000000"
                  className="font-mono"
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Shop Act License / Reg Number
                </Label>
                <Input
                  value={formData.shop_act_no || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, shop_act_no: e.target.value }))}
                  placeholder="Shop Act Number"
                  className="font-mono"
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Sourcing / Financial Experience
                </Label>
                <Input
                  value={formData.applicant_prior_experience || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, applicant_prior_experience: e.target.value }))}
                  placeholder="e.g. Retail loan sourcing, DSA empanelment"
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">
                  Experience (Years)
                </Label>
                <Input
                  type="number"
                  value={formData.experience_years || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, experience_years: e.target.value }))}
                  placeholder="Years"
                />
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
                dsa.gst ? (
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
                  if (proofs.length === 0) return "Shop & Establishment / MSME";
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
              value={
                dsa.applicant_prior_experience ? (
                  <div>
                    <span className="font-semibold text-slate-900">{dsa.applicant_prior_experience}</span>
                    {dsa.experience_years && dsa.experience_years !== "0" && !dsa.applicant_prior_experience.includes(String(dsa.experience_years)) ? (
                      <span className="text-slate-500 text-xs ml-1.5">({dsa.experience_years} yrs)</span>
                    ) : null}
                  </div>
                ) : dsa.experience_years ? (
                  `${dsa.experience_years} Years`
                ) : dsa.empanelment_since_year ? (
                  `Empanelled since ${dsa.empanelment_since_year}`
                ) : (
                  "New Partner Empanelment"
                )
              }
            />
            <DetailItem
              label="Statutory Registration / License No"
              value={
                [
                  dsa.udyam_no ? `Udyam: ${dsa.udyam_no}` : null,
                  dsa.shop_act_no ? `Shop Act: ${dsa.shop_act_no}` : null,
                ].filter(Boolean).join(", ") ||
                dsa.business_license_no ||
                (dsa.registered_business_proof ? `Registered Proofs on File (${dsa.registered_business_proof.split(",").join(", ")})` : null) ||
                dsa.registration_no_llpin_cin ||
                "Standard Regulatory Compliance"
              }
            />
            {dsa.udyam_no ? (
              <DetailItem
                label="Udyam Registration Number"
                value={<span className="font-mono font-semibold text-slate-900">{dsa.udyam_no}</span>}
              />
            ) : null}
            {dsa.shop_act_no ? (
              <DetailItem
                label="Shop Act License / Reg. Number"
                value={<span className="font-mono font-semibold text-slate-900">{dsa.shop_act_no}</span>}
              />
            ) : null}
          </DetailGrid>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Section 5: Branch & Operating Territory
         ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-rose-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Branch &amp; Territory Mapping
            </h4>
          </div>
          {renderHeaderAction("branch")}
        </div>

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
                  "COSMOS-BR"
                }
              />
              <DetailItem
                label="Region / Sub-Region Territory"
                value={
                  currentBranchOption?.sub_region_code ||
                  dsa.branch?.sub_region_code ||
                  dsa.subregion_id ||
                  "Pune Sub-Region"
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
                (dsa.branchId === 2 ? "Deccan Branch" : "Main Branch")
              }
            />
            <DetailItem
              label="Branch Code"
              value={dsa.branch?.branch_code || dsa.branch_code || "COSMOS-BR"}
            />
            <DetailItem
              label="Region / Sub-Region Territory"
              value={
                dsa.branch?.sub_region_code ||
                dsa.subregion_id ||
                "Pune Sub-Region"
              }
            />
            <DetailItem
              label="Branch Sourcing Officer"
              value={dsa.manager || "Branch Operations"}
            />
          </DetailGrid>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Section 6: Address & Operating Premises
         ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-purple-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Address &amp; Operating Premises
            </h4>
          </div>
          {renderHeaderAction("address")}
        </div>

        {activeEditBlock === "address" ? (
          <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-4">
            <div>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Registered / Residential Address
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-white p-3 shadow-2xs sm:col-span-4">
                  <Label className="text-xs font-semibold uppercase text-slate-500 mb-1.5 block">Street Address *</Label>
                  <Input
                    value={formData.address || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Flat / Building / Street address"
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
                  value={formData.business_premises_ownership || "Self Owned"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, business_premises_ownership: e.target.value }))}
                >
                  <option value="Self Owned">Self Owned</option>
                  <option value="Rented / Leased Premises">Rented / Leased Premises</option>
                </Select>
              </div>

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
            </div>

            {formData.office_address_different ? (
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
              value={<span className="font-semibold text-slate-900">{dsa.business_premises_ownership || "Self Owned"}</span>}
            />
            <DetailItem
              label="Operating Premises Status"
              value={
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {dsa.office_address_different ? "Separate Commercial Office" : "Operating from Registered Residence"}
                </span>
              }
            />
          </DetailGrid>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Section 7: Settlement & Bank Account Details
         ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
          <div className="flex items-center gap-2">
            <BadgeIndianRupee className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Settlement &amp; Bank Account Details
            </h4>
          </div>
          {renderHeaderAction("bank")}
        </div>

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
                  value={formData.account_type || "Savings"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, account_type: e.target.value }))}
                >
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
              value={dsa.bank_name || "Cosmos Co-operative Bank"}
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
              value={dsa.account_type || "Savings"}
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
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Section 8: Professional References
         ───────────────────────────────────────────────────────────── */}
      {(dsa.reference_1_name || dsa.reference_2_name || canEdit) && (
        <div>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Professional References
              </h4>
            </div>
            {renderHeaderAction("references")}
          </div>

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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Section 9: Entity Stakeholders / Partners
         ───────────────────────────────────────────────────────────── */}
      {(isEntity || (Array.isArray(dsa.stakeholders) && dsa.stakeholders.length > 0) || canEdit) && (
        <div>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Entity Stakeholders, Partners &amp; Directors ({dsa.stakeholders?.length || 0})
              </h4>
            </div>
            {renderHeaderAction("stakeholders")}
          </div>

          {activeEditBlock === "stakeholders" ? (
            <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Stakeholder Name *</th>
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
                            value={sh.stakeholder_type || "Partner / Director"}
                            onChange={(e) => {
                              const list = [...formData.stakeholders];
                              list[idx] = { ...list[idx], stakeholder_type: e.target.value };
                              setFormData((prev) => ({ ...prev, stakeholders: list }));
                            }}
                            className="h-8 text-xs"
                          >
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
                      stakeholder_type: "Partner / Director",
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
                        <td className="p-2.5 text-slate-600">{sh.stakeholder_type || "Partner / Director"}</td>
                        <td className="p-2.5 text-slate-600">{sh.mobile_no || "—"}</td>
                        <td className="p-2.5 font-mono text-slate-700">{sh.pan || sh.pan_no || "—"}</td>
                        <td className="p-2.5 font-mono text-slate-600">{sh.din_dpin_no || sh.aadhaar || "—"}</td>
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Section 10: Associate Concerns & Sister Entities
         ───────────────────────────────────────────────────────────── */}
      {(isEntity || (Array.isArray(dsa.associate_concerns) && dsa.associate_concerns.length > 0) || canEdit) && (
        <div>
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-150">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Associate Concerns &amp; Sister Entities ({dsa.associate_concerns?.length || 0})
              </h4>
            </div>
            {renderHeaderAction("associate_concerns")}
          </div>

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
                      associate_constitution: "Associate Concern",
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
                        <td className="p-2.5 text-slate-600">{ac.relationship || ac.associate_constitution || "Associate Concern"}</td>
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          Section 11: Field Verification & Physical Visit Summary
         ───────────────────────────────────────────────────────────── */}
      {(dsa.visit_conducted_by || dsa.visit_conducted_at || dsa.visit_report_remarks) && (
        <div>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-150">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Field Verification &amp; Physical Visit Summary
            </h4>
          </div>
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
        </div>
      )}
    </div>
  );
}
