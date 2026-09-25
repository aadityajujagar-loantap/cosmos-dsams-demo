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
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, Modal, Input, Label, Select } from "@/components/ui/primitives";
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

interface DsaDetailEditModalProps {
  open: boolean;
  block: DetailBlockKey | null;
  dsa: any;
  branches: BranchOption[];
  onClose: () => void;
  onSave: (payload: any) => Promise<boolean>;
  loading?: boolean;
}

export function DsaDetailEditModal({
  open,
  block,
  dsa,
  branches,
  onClose,
  onSave,
  loading = false,
}: DsaDetailEditModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form data when modal opens or block changes
  useEffect(() => {
    if (!open || !dsa || !block) {
      setFormData({});
      setErrors({});
      return;
    }

    const isEntity = dsa.dsa_type === "NON_INDIVIDUAL" || dsa.dsa_type === "ENTITY";

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
          nature_of_business: dsa.nature_of_business || "Direct Selling Agent / Retail Loan Sourcing",
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
          registered_business_proof: dsa.registered_business_proof || "Shop Act, Udyam Registration",
          business_license_type: dsa.business_license_type || "",
          business_license_no: dsa.business_license_no || "",
          udyam_no: dsa.udyam_no || "",
          shop_act_no: dsa.shop_act_no || "",
          applicant_prior_experience: dsa.applicant_prior_experience || "",
          experience_years: dsa.experience_years || "",
        });
        break;

      case "branch":
        setFormData({
          branch_id: dsa.branch_id || (dsa.branch?.id ?? ""),
          manager: dsa.manager || "",
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
          office_landline_no: dsa.office_landline_no || "",
          office_mobile_no: dsa.office_mobile_no || "",
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
            ? dsa.stakeholders.map((s: any) => ({
                name: s.name || "",
                stakeholder_type: s.stakeholder_type || "Partner / Director",
                mobile_no: s.mobile_no || "",
                pan_no: s.pan_no || s.pan || "",
                qualification: s.qualification || "",
                date_of_birth: s.date_of_birth ? s.date_of_birth.substring(0, 10) : "",
                email_id: s.email_id || "",
                address: s.address || "",
                is_active_or_key: s.is_active_or_key ?? true,
              }))
            : [
                {
                  name: "",
                  stakeholder_type: "Partner / Director",
                  mobile_no: "",
                  pan_no: "",
                  qualification: "Graduate",
                  date_of_birth: "",
                  email_id: "",
                  address: "",
                  is_active_or_key: true,
                },
              ],
        });
        break;

      case "associate_concerns":
        setFormData({
          associate_concerns: Array.isArray(dsa.associate_concerns) && dsa.associate_concerns.length > 0
            ? dsa.associate_concerns.map((a: any) => ({
                associate_name: a.associate_name || a.name || a.entity_name || "",
                associate_nature_of_business: a.associate_nature_of_business || a.nature_of_business || "",
                associate_constitution: a.associate_constitution || a.constitution || "Partnership",
                associate_address: a.associate_address || a.address || "",
                associate_establishment_year: a.associate_establishment_year || a.establishment_year || "",
                associate_key_person_details: a.associate_key_person_details || "",
              }))
            : [
                {
                  associate_name: "",
                  associate_nature_of_business: "",
                  associate_constitution: "Partnership",
                  associate_address: "",
                  associate_establishment_year: "",
                  associate_key_person_details: "",
                },
              ],
        });
        break;
    }
  }, [open, block, dsa]);

  if (!open || !block || !dsa) return null;

  const isEntity = dsa.dsa_type === "NON_INDIVIDUAL" || dsa.dsa_type === "ENTITY";

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      // Auto-calculate age if date_of_birth changes
      if (field === "date_of_birth" && value) {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age > 0) next.age = age;
        }
      }

      return next;
    });

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (block === "applicant") {
      if (!isEntity) {
        if (!formData.first_name?.trim()) errs.first_name = "First name is required";
        if (!formData.last_name?.trim()) errs.last_name = "Last name is required";
        if (formData.aadhaar_no && !/^\d{12}$/.test(formData.aadhaar_no.replace(/\s+/g, ""))) {
          errs.aadhaar_no = "Aadhaar must be 12 digits";
        }
      } else {
        if (!formData.entity_name?.trim()) errs.entity_name = "Entity name is required";
      }
    }

    if (block === "contact") {
      if (!formData.mobile?.trim()) {
        errs.mobile = "Mobile number is required";
      } else if (!/^\d{10}$/.test(formData.mobile.replace(/\D/g, ""))) {
        errs.mobile = "Mobile must be a valid 10-digit number";
      }

      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        errs.email = "Invalid email address format";
      }
    }

    if (block === "statutory") {
      if (formData.pan) {
        const cleanPan = formData.pan.trim().toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
          errs.pan = "PAN must follow standard format (e.g. ABCDE1234F)";
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
          errs.ifsc = "IFSC must follow standard format (e.g. IDFC0000123)";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Record<string, any> = { ...formData };

    // Format fields
    if (payload.pan) payload.pan = payload.pan.trim().toUpperCase();
    if (payload.ifsc) payload.ifsc = payload.ifsc.trim().toUpperCase();
    if (payload.email) payload.email = payload.email.trim();
    if (payload.mobile) payload.mobile = payload.mobile.replace(/\D/g, "");

    // For applicant block, sync name field
    if (block === "applicant") {
      if (!isEntity) {
        payload.name = [payload.applicant_title, payload.first_name, payload.middle_name, payload.last_name]
          .filter(Boolean)
          .join(" ");
      } else {
        payload.name = payload.entity_name;
      }
    }

    await onSave(payload);
  };

  // Helper for stakeholder row changes
  const handleStakeholderChange = (index: number, field: string, val: any) => {
    const list = [...(formData.stakeholders || [])];
    list[index] = { ...list[index], [field]: val };
    setFormData((prev) => ({ ...prev, stakeholders: list }));
  };

  const addStakeholder = () => {
    const list = [...(formData.stakeholders || [])];
    list.push({
      name: "",
      stakeholder_type: "Partner / Director",
      mobile_no: "",
      pan_no: "",
      qualification: "Graduate",
      date_of_birth: "",
      email_id: "",
      address: "",
      is_active_or_key: true,
    });
    setFormData((prev) => ({ ...prev, stakeholders: list }));
  };

  const removeStakeholder = (index: number) => {
    const list = [...(formData.stakeholders || [])].filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, stakeholders: list }));
  };

  // Helper for associate concerns
  const handleAssociateChange = (index: number, field: string, val: any) => {
    const list = [...(formData.associate_concerns || [])];
    list[index] = { ...list[index], [field]: val };
    setFormData((prev) => ({ ...prev, associate_concerns: list }));
  };

  const addAssociate = () => {
    const list = [...(formData.associate_concerns || [])];
    list.push({
      associate_name: "",
      associate_nature_of_business: "",
      associate_constitution: "Partnership",
      associate_address: "",
      associate_establishment_year: "",
      associate_key_person_details: "",
    });
    setFormData((prev) => ({ ...prev, associate_concerns: list }));
  };

  const removeAssociate = (index: number) => {
    const list = [...(formData.associate_concerns || [])].filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, associate_concerns: list }));
  };

  const getTitleAndIcon = () => {
    switch (block) {
      case "sourcing":
        return { title: "Edit Sourcing & Application Journey", icon: <FileText className="h-5 w-5 text-blue-600" /> };
      case "applicant":
        return { title: "Edit Applicant & Business Profile", icon: <Building2 className="h-5 w-5 text-indigo-600" /> };
      case "contact":
        return { title: "Edit Contact & Communication Channels", icon: <Phone className="h-5 w-5 text-emerald-600" /> };
      case "statutory":
        return { title: "Edit Statutory, Tax & Licensing Details", icon: <CreditCard className="h-5 w-5 text-amber-600" /> };
      case "branch":
        return { title: "Edit Branch & Territory Mapping", icon: <MapPin className="h-5 w-5 text-rose-600" /> };
      case "address":
        return { title: "Edit Address & Operating Premises", icon: <Briefcase className="h-5 w-5 text-purple-600" /> };
      case "bank":
        return { title: "Edit Settlement & Bank Account Details", icon: <BadgeIndianRupee className="h-5 w-5 text-emerald-600" /> };
      case "references":
        return { title: "Edit Professional References", icon: <Users className="h-5 w-5 text-cyan-600" /> };
      case "stakeholders":
        return { title: "Edit Entity Stakeholders, Partners & Directors", icon: <Users className="h-5 w-5 text-indigo-600" /> };
      case "associate_concerns":
        return { title: "Edit Associate Concerns & Sister Entities", icon: <Building2 className="h-5 w-5 text-slate-600" /> };
    }
  };

  const { title } = getTitleAndIcon();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description="Update fields precisely. Changes persist to the authoritative database."
      width={block === "stakeholders" || block === "associate_concerns" || block === "address" ? "max-w-3xl" : "max-w-xl"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SOURCING BLOCK */}
        {block === "sourcing" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dsa_type">DSA Partner Type</Label>
              <Select
                id="dsa_type"
                value={formData.dsa_type || "INDIVIDUAL"}
                onChange={(e) => handleChange("dsa_type", e.target.value)}
              >
                <option value="INDIVIDUAL">Individual DSA</option>
                <option value="ENTITY">Non-Individual (Entity / Firm)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="submission_mode">Sourcing Journey Mode</Label>
              <Select
                id="submission_mode"
                value={formData.submission_mode || "BRANCH"}
                onChange={(e) => handleChange("submission_mode", e.target.value)}
              >
                <option value="BRANCH">Branch Assisted Sourcing</option>
                <option value="SELF">Self-Onboarding (Online Portal)</option>
              </Select>
            </div>
          </div>
        )}

        {/* APPLICANT PROFILE BLOCK */}
        {block === "applicant" && (
          <div className="space-y-4">
            {!isEntity ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-1">
                    <Label htmlFor="applicant_title">Title</Label>
                    <Select
                      id="applicant_title"
                      value={formData.applicant_title || "Mr."}
                      onChange={(e) => handleChange("applicant_title", e.target.value)}
                    >
                      <option value="Mr.">Mr.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Dr.">Dr.</option>
                    </Select>
                  </div>
                  <div className="sm:col-span-1">
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name || ""}
                      onChange={(e) => handleChange("first_name", e.target.value)}
                    />
                    {errors.first_name && <p className="text-xs text-rose-600 mt-1">{errors.first_name}</p>}
                  </div>
                  <div className="sm:col-span-1">
                    <Label htmlFor="middle_name">Middle Name</Label>
                    <Input
                      id="middle_name"
                      value={formData.middle_name || ""}
                      onChange={(e) => handleChange("middle_name", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name || ""}
                      onChange={(e) => handleChange("last_name", e.target.value)}
                    />
                    {errors.last_name && <p className="text-xs text-rose-600 mt-1">{errors.last_name}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth || ""}
                      onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age (Calculated)</Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age || ""}
                      onChange={(e) => handleChange("age", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="education_qualification">Educational Qualification</Label>
                    <Select
                      id="education_qualification"
                      value={formData.education_qualification || "Graduate"}
                      onChange={(e) => handleChange("education_qualification", e.target.value)}
                    >
                      <option value="10th / Secondary">10th / Secondary</option>
                      <option value="12th / Higher Secondary">12th / Higher Secondary</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Graduate">Graduate</option>
                      <option value="Post Graduate">Post Graduate</option>
                      <option value="Professional (CA/CS/CWA/LLB/MBA)">Professional (CA/CS/CWA/LLB/MBA)</option>
                      <option value="Doctorate / PhD">Doctorate / PhD</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="aadhaar_no">Aadhaar Number (12 digits)</Label>
                    <Input
                      id="aadhaar_no"
                      maxLength={12}
                      placeholder="12 digit Aadhaar"
                      value={formData.aadhaar_no || ""}
                      onChange={(e) => handleChange("aadhaar_no", e.target.value)}
                    />
                    {errors.aadhaar_no && <p className="text-xs text-rose-600 mt-1">{errors.aadhaar_no}</p>}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="entity_name">Registered Entity / Firm Name *</Label>
                  <Input
                    id="entity_name"
                    value={formData.entity_name || ""}
                    onChange={(e) => handleChange("entity_name", e.target.value)}
                  />
                  {errors.entity_name && <p className="text-xs text-rose-600 mt-1">{errors.entity_name}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_person">Primary Contact Person</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person || ""}
                      onChange={(e) => handleChange("contact_person", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="registration_no_llpin_cin">CIN / LLPIN / Reg. Number</Label>
                    <Input
                      id="registration_no_llpin_cin"
                      value={formData.registration_no_llpin_cin || ""}
                      onChange={(e) => handleChange("registration_no_llpin_cin", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date_of_birth">Date of Incorporation</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth || ""}
                      onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Vintage / Operating Years</Label>
                    <Input
                      id="age"
                      type="number"
                      value={formData.age || ""}
                      onChange={(e) => handleChange("age", e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="constitution">Legal Constitution</Label>
                <Select
                  id="constitution"
                  value={formData.constitution || "Individual / Sole Proprietorship"}
                  onChange={(e) => handleChange("constitution", e.target.value)}
                >
                  <option value="Individual / Sole Proprietorship">Individual / Sole Proprietorship</option>
                  <option value="Sole Proprietorship">Sole Proprietorship</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Private Limited">Private Limited</option>
                  <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                  <option value="Public Limited">Public Limited</option>
                  <option value="Trust / Society">Trust / Society</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="business_type">Business Type / Category</Label>
                <Input
                  id="business_type"
                  value={formData.business_type || ""}
                  onChange={(e) => handleChange("business_type", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="nature_of_business">Nature of Business</Label>
              <Input
                id="nature_of_business"
                value={formData.nature_of_business || ""}
                onChange={(e) => handleChange("nature_of_business", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* CONTACT BLOCK */}
        {block === "contact" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mobile">Registered Mobile Number *</Label>
                <Input
                  id="mobile"
                  maxLength={10}
                  placeholder="10-digit number"
                  value={formData.mobile || ""}
                  onChange={(e) => handleChange("mobile", e.target.value)}
                />
                {errors.mobile && <p className="text-xs text-rose-600 mt-1">{errors.mobile}</p>}
              </div>
              <div>
                <Label htmlFor="email">Registered Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="landline_no">Alternate / Landline Contact</Label>
                <Input
                  id="landline_no"
                  placeholder="020-xxxxxxxx"
                  value={formData.landline_no || ""}
                  onChange={(e) => handleChange("landline_no", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="office_mobile_no">Office / Sourcing Mobile</Label>
                <Input
                  id="office_mobile_no"
                  placeholder="10-digit number"
                  value={formData.office_mobile_no || ""}
                  onChange={(e) => handleChange("office_mobile_no", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_person">Key Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person || ""}
                  onChange={(e) => handleChange("contact_person", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="website">Website / Corporate Portal</Label>
                <Input
                  id="website"
                  placeholder="https://..."
                  value={formData.website || ""}
                  onChange={(e) => handleChange("website", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* STATUTORY BLOCK */}
        {block === "statutory" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pan">Permanent Account Number (PAN) *</Label>
                <Input
                  id="pan"
                  maxLength={10}
                  className="font-mono uppercase"
                  placeholder="ABCDE1234F"
                  value={formData.pan || ""}
                  onChange={(e) => handleChange("pan", e.target.value.toUpperCase())}
                />
                {errors.pan && <p className="text-xs text-rose-600 mt-1">{errors.pan}</p>}
              </div>
              <div>
                <Label htmlFor="gst_applicable">GST Registration Status</Label>
                <Select
                  id="gst_applicable"
                  value={formData.gst_applicable ? "true" : "false"}
                  onChange={(e) => handleChange("gst_applicable", e.target.value === "true")}
                >
                  <option value="false">Exempt / Not Applicable</option>
                  <option value="true">Applicable (Registered)</option>
                </Select>
              </div>
            </div>

            {formData.gst_applicable && (
              <div>
                <Label htmlFor="gst">GSTIN (15 Digits) *</Label>
                <Input
                  id="gst"
                  maxLength={15}
                  className="font-mono uppercase"
                  placeholder="27ABCDE1234F1Z5"
                  value={formData.gst || ""}
                  onChange={(e) => handleChange("gst", e.target.value.toUpperCase())}
                />
                {errors.gst && <p className="text-xs text-rose-600 mt-1">{errors.gst}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="udyam_no">Udyam Registration Number</Label>
                <Input
                  id="udyam_no"
                  placeholder="UDYAM-XX-00-0000000"
                  value={formData.udyam_no || ""}
                  onChange={(e) => handleChange("udyam_no", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="shop_act_no">Shop Act License / Reg. Number</Label>
                <Input
                  id="shop_act_no"
                  placeholder="Shop Act Number"
                  value={formData.shop_act_no || ""}
                  onChange={(e) => handleChange("shop_act_no", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="registered_business_proof">Registered Business Proof(s)</Label>
              <Input
                id="registered_business_proof"
                placeholder="e.g. Shop Act, Udyam Registration, GST Certificate"
                value={formData.registered_business_proof || ""}
                onChange={(e) => handleChange("registered_business_proof", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="applicant_prior_experience">Financial / Sourcing Experience Description</Label>
                <Input
                  id="applicant_prior_experience"
                  placeholder="e.g. 5 years loan DSA experience"
                  value={formData.applicant_prior_experience || ""}
                  onChange={(e) => handleChange("applicant_prior_experience", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="experience_years">Experience in Years</Label>
                <Input
                  id="experience_years"
                  type="number"
                  placeholder="e.g. 5"
                  value={formData.experience_years || ""}
                  onChange={(e) => handleChange("experience_years", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* BRANCH MAPPING BLOCK */}
        {block === "branch" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="branch_id">Designated Sourcing Branch *</Label>
              <Select
                id="branch_id"
                value={String(formData.branch_id || "")}
                onChange={(e) => handleChange("branch_id", Number(e.target.value))}
              >
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b.id || b.branch_code} value={b.id || b.branch_code}>
                    {b.branch_name} ({b.branch_code})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="manager">Branch Sourcing Officer / Manager</Label>
              <Input
                id="manager"
                value={formData.manager || ""}
                onChange={(e) => handleChange("manager", e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ADDRESS BLOCK */}
        {block === "address" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="address">Registered / Residential Address *</Label>
              <Input
                id="address"
                placeholder="Flat / Building, Road, Area"
                value={formData.address || ""}
                onChange={(e) => handleChange("address", e.target.value)}
              />
              {errors.address && <p className="text-xs text-rose-600 mt-1">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city || ""}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
                {errors.city && <p className="text-xs text-rose-600 mt-1">{errors.city}</p>}
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state || ""}
                  onChange={(e) => handleChange("state", e.target.value)}
                />
                {errors.state && <p className="text-xs text-rose-600 mt-1">{errors.state}</p>}
              </div>
              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  maxLength={6}
                  placeholder="400001"
                  value={formData.pincode || ""}
                  onChange={(e) => handleChange("pincode", e.target.value)}
                />
                {errors.pincode && <p className="text-xs text-rose-600 mt-1">{errors.pincode}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="business_premises_ownership">Business Premises Ownership</Label>
              <Select
                id="business_premises_ownership"
                value={formData.business_premises_ownership || "Self Owned"}
                onChange={(e) => handleChange("business_premises_ownership", e.target.value)}
              >
                <option value="Self Owned">Self Owned</option>
                <option value="Rented / Leased Premises">Rented / Leased Premises</option>
              </Select>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  checked={Boolean(formData.office_address_different)}
                  onChange={(e) => handleChange("office_address_different", e.target.checked)}
                />
                <span className="text-xs font-semibold text-slate-800">
                  Separate Commercial Office / Operating Address
                </span>
              </label>
            </div>

            {formData.office_address_different && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <Label htmlFor="office_address_line_1">Office Address Line</Label>
                  <Input
                    id="office_address_line_1"
                    placeholder="Office premise address"
                    value={formData.office_address_line_1 || ""}
                    onChange={(e) => handleChange("office_address_line_1", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="office_city">Office City</Label>
                    <Input
                      id="office_city"
                      value={formData.office_city || ""}
                      onChange={(e) => handleChange("office_city", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="office_state">Office State</Label>
                    <Input
                      id="office_state"
                      value={formData.office_state || ""}
                      onChange={(e) => handleChange("office_state", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="office_pincode">Office Pincode</Label>
                    <Input
                      id="office_pincode"
                      maxLength={6}
                      value={formData.office_pincode || ""}
                      onChange={(e) => handleChange("office_pincode", e.target.value)}
                    />
                    {errors.office_pincode && <p className="text-xs text-rose-600 mt-1">{errors.office_pincode}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BANK DETAILS BLOCK */}
        {block === "bank" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bank_name">Settlement Bank Name *</Label>
                <Input
                  id="bank_name"
                  placeholder="Cosmos Bank"
                  value={formData.bank_name || ""}
                  onChange={(e) => handleChange("bank_name", e.target.value)}
                />
                {errors.bank_name && <p className="text-xs text-rose-600 mt-1">{errors.bank_name}</p>}
              </div>
              <div>
                <Label htmlFor="account_name">Beneficiary Account Name *</Label>
                <Input
                  id="account_name"
                  value={formData.account_name || ""}
                  onChange={(e) => handleChange("account_name", e.target.value)}
                />
                {errors.account_name && <p className="text-xs text-rose-600 mt-1">{errors.account_name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label htmlFor="account_number">Bank Account Number *</Label>
                <Input
                  id="account_number"
                  className="font-mono"
                  value={formData.account_number || ""}
                  onChange={(e) => handleChange("account_number", e.target.value)}
                />
                {errors.account_number && <p className="text-xs text-rose-600 mt-1">{errors.account_number}</p>}
              </div>
              <div>
                <Label htmlFor="account_type">Account Type</Label>
                <Select
                  id="account_type"
                  value={formData.account_type || "Savings"}
                  onChange={(e) => handleChange("account_type", e.target.value)}
                >
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                  <option value="Overdraft">Overdraft</option>
                  <option value="Cash Credit">Cash Credit</option>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="ifsc">IFSC Code (11 Digits) *</Label>
              <Input
                id="ifsc"
                maxLength={11}
                className="font-mono uppercase"
                placeholder="COSB0000001"
                value={formData.ifsc || ""}
                onChange={(e) => handleChange("ifsc", e.target.value.toUpperCase())}
              />
              {errors.ifsc && <p className="text-xs text-rose-600 mt-1">{errors.ifsc}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <Label htmlFor="last_fy_net_sales">Last FY Net Sales / Turnover (₹)</Label>
                <Input
                  id="last_fy_net_sales"
                  type="number"
                  placeholder="Turnover in ₹"
                  value={formData.last_fy_net_sales || ""}
                  onChange={(e) => handleChange("last_fy_net_sales", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="last_fy_net_profit_after_tax">Last FY Net Profit (PAT) (₹)</Label>
                <Input
                  id="last_fy_net_profit_after_tax"
                  type="number"
                  placeholder="PAT in ₹"
                  value={formData.last_fy_net_profit_after_tax || ""}
                  onChange={(e) => handleChange("last_fy_net_profit_after_tax", e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* REFERENCES BLOCK */}
        {block === "references" && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <h5 className="text-xs font-bold text-slate-700 uppercase">Primary Reference</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="reference_1_name">Contact Person / Name</Label>
                  <Input
                    id="reference_1_name"
                    value={formData.reference_1_name || ""}
                    onChange={(e) => handleChange("reference_1_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reference_1_contact_no">Contact Number (10 digits)</Label>
                  <Input
                    id="reference_1_contact_no"
                    maxLength={10}
                    value={formData.reference_1_contact_no || ""}
                    onChange={(e) => handleChange("reference_1_contact_no", e.target.value)}
                  />
                  {errors.reference_1_contact_no && (
                    <p className="text-xs text-rose-600 mt-1">{errors.reference_1_contact_no}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <h5 className="text-xs font-bold text-slate-700 uppercase">Secondary Reference</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="reference_2_name">Contact Person / Name</Label>
                  <Input
                    id="reference_2_name"
                    value={formData.reference_2_name || ""}
                    onChange={(e) => handleChange("reference_2_name", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reference_2_contact_no">Contact Number (10 digits)</Label>
                  <Input
                    id="reference_2_contact_no"
                    maxLength={10}
                    value={formData.reference_2_contact_no || ""}
                    onChange={(e) => handleChange("reference_2_contact_no", e.target.value)}
                  />
                  {errors.reference_2_contact_no && (
                    <p className="text-xs text-rose-600 mt-1">{errors.reference_2_contact_no}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAKEHOLDERS BLOCK */}
        {block === "stakeholders" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Configure directors, partners, or proprietors for this entity.
              </span>
              <Button type="button" size="sm" variant="outline" onClick={addStakeholder} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Stakeholder
              </Button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {(formData.stakeholders || []).map((stk: any, i: number) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Stakeholder #{i + 1}</span>
                    {(formData.stakeholders || []).length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeStakeholder(i)}
                        className="h-6 w-6 text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Full Name *</Label>
                      <Input
                        value={stk.name || ""}
                        onChange={(e) => handleStakeholderChange(i, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Designation / Role</Label>
                      <Select
                        value={stk.stakeholder_type || "Partner / Director"}
                        onChange={(e) => handleStakeholderChange(i, "stakeholder_type", e.target.value)}
                      >
                        <option value="Partner / Director">Partner / Director</option>
                        <option value="Director">Director</option>
                        <option value="Partner">Partner</option>
                        <option value="Proprietor">Proprietor</option>
                        <option value="Managing Director">Managing Director</option>
                        <option value="Authorized Signatory">Authorized Signatory</option>
                        <option value="Key Person">Key Person</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Mobile Number</Label>
                      <Input
                        maxLength={10}
                        value={stk.mobile_no || ""}
                        onChange={(e) => handleStakeholderChange(i, "mobile_no", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>PAN Number</Label>
                      <Input
                        maxLength={10}
                        className="font-mono uppercase"
                        value={stk.pan_no || ""}
                        onChange={(e) => handleStakeholderChange(i, "pan_no", e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <Label>Date of Birth</Label>
                      <Input
                        type="date"
                        value={stk.date_of_birth || ""}
                        onChange={(e) => handleStakeholderChange(i, "date_of_birth", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Email ID</Label>
                      <Input
                        type="email"
                        value={stk.email_id || ""}
                        onChange={(e) => handleStakeholderChange(i, "email_id", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ASSOCIATE CONCERNS BLOCK */}
        {block === "associate_concerns" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Sister entities, group firms, or associated businesses.
              </span>
              <Button type="button" size="sm" variant="outline" onClick={addAssociate} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Associate
              </Button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {(formData.associate_concerns || []).map((asc: any, i: number) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Associate #{i + 1}</span>
                    {(formData.associate_concerns || []).length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeAssociate(i)}
                        className="h-6 w-6 text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Concern / Entity Name *</Label>
                      <Input
                        value={asc.associate_name || ""}
                        onChange={(e) => handleAssociateChange(i, "associate_name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Constitution</Label>
                      <Select
                        value={asc.associate_constitution || "Partnership"}
                        onChange={(e) => handleAssociateChange(i, "associate_constitution", e.target.value)}
                      >
                        <option value="Partnership">Partnership</option>
                        <option value="Private Limited">Private Limited</option>
                        <option value="Sole Proprietorship">Sole Proprietorship</option>
                        <option value="LLP">LLP</option>
                        <option value="Public Limited">Public Limited</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Nature of Business</Label>
                      <Input
                        value={asc.associate_nature_of_business || ""}
                        onChange={(e) => handleAssociateChange(i, "associate_nature_of_business", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Establishment Year</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 2018"
                        value={asc.associate_establishment_year || ""}
                        onChange={(e) => handleAssociateChange(i, "associate_establishment_year", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Address / Operating Location</Label>
                    <Input
                      value={asc.associate_address || ""}
                      onChange={(e) => handleAssociateChange(i, "associate_address", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
