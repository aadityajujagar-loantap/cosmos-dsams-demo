"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeIndianRupee,
  Check,
  ClipboardList,
  FileText,
  Plus,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { FormEvent, useState } from "react";

import { KpiCard } from "@/components/charts";
import { ActionPair, DetailGrid, DetailItem, PageHeader } from "@/components/module";
import { Column, DataTable } from "@/components/ui/data-table";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Drawer,
  Field,
  Input,
  Label,
  Modal,
  Select,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { useMockStore } from "@/lib/store";
import { BusinessType, Dsa, DsaStatus } from "@/lib/types";
import { formatCurrency, formatDate, makeId, percent } from "@/lib/utils";

const businessTypes: BusinessType[] = [
  "Sole Proprietor",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
];

const dsaStatuses: DsaStatus[] = [
  "Draft",
  "Submitted",
  "KYC Pending",
  "Active",
  "Suspended",
  "Rejected",
];

const dsaFields: FieldConfig<Dsa>[] = [
  { label: "DSA name", name: "name", required: true },
  { label: "Business type", name: "businessType", options: businessTypes, required: true, type: "select" },
  { label: "PAN", name: "pan", required: true },
  { label: "GST", name: "gst", required: true },
  { label: "Contact person", name: "contactPerson", required: true },
  { label: "Mobile", name: "mobile", required: true },
  { label: "Email", name: "email", required: true, type: "email" },
  { label: "City", name: "city", required: true },
  { label: "State", name: "state", required: true },
  { label: "Pincode", name: "pincode", required: true },
  { label: "Status", name: "status", options: dsaStatuses, required: true, type: "select" },
  { label: "Manager", name: "manager", required: true },
];

const initialOnboardingForm = {
  accountName: "",
  accountNumber: "",
  address: "",
  bankName: "",
  businessType: "Private Limited",
  city: "",
  code: "",
  contactPerson: "",
  email: "",
  gst: "",
  ifsc: "",
  mobile: "",
  name: "",
  pan: "",
  pincode: "",
  state: "",
  status: "Submitted",
};

function newDsaFromForm(form: Partial<Dsa>): Dsa {
  const id = makeId("dsa");
  return {
    address: String(form.address ?? "New partner office"),
    approvalRate: 0,
    bank: {
      accountName: String(form.name ?? "New DSA"),
      accountNumber: "0000000000",
      bankName: "Cosmos Bank",
      ifsc: "CBIN000000",
    },
    businessType: (form.businessType as BusinessType) || "Private Limited",
    city: String(form.city ?? ""),
    code: `DSA-${Date.now().toString().slice(-5)}`,
    commissionEarned: 0,
    contactPerson: String(form.contactPerson ?? ""),
    documents: [],
    email: String(form.email ?? ""),
    gst: String(form.gst ?? ""),
    id,
    manager: String(form.manager ?? "Aditi Rao"),
    mobile: String(form.mobile ?? ""),
    monthlyLeads: 0,
    name: String(form.name ?? "New DSA"),
    onboardingDate: new Date().toISOString(),
    pan: String(form.pan ?? ""),
    pincode: String(form.pincode ?? ""),
    riskRating: "Low",
    state: String(form.state ?? ""),
    status: (form.status as DsaStatus) || "Submitted",
    tier: "Bronze",
  };
}

export function DsaOnboardingPage() {
  const { createItem } = useMockStore();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...initialOnboardingForm });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const steps = ["Business", "KYC", "Bank", "Review"];

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate(currentStep = step) {
    const requiredByStep = [
      ["code", "name", "businessType", "contactPerson", "mobile", "email"],
      ["pan", "gst", "address", "city", "state", "pincode"],
      ["accountName", "accountNumber", "bankName", "ifsc"],
      [],
    ];
    const nextErrors: Record<string, string> = {};
    requiredByStep[currentStep].forEach((field) => {
      if (!form[field as keyof typeof form]) nextErrors[field] = "Required";
    });
    if (currentStep === 0 && form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) {
      nextErrors.mobile = "Enter a valid 10 digit Indian mobile number";
    }
    if (currentStep === 0 && form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      nextErrors.email = "Enter a valid email";
    }
    if (currentStep === 1 && form.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan)) {
      nextErrors.pan = "PAN format should be ABCDE1234F";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function next() {
    if (validate()) setStep((current) => Math.min(steps.length - 1, current + 1));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate(0) || !validate(1) || !validate(2)) return;
    const id = makeId("dsa");
    createItem("dsas", {
      address: form.address,
      approvalRate: 0,
      bank: {
        accountName: form.accountName,
        accountNumber: form.accountNumber,
        bankName: form.bankName,
        ifsc: form.ifsc,
      },
      businessType: form.businessType as BusinessType,
      city: form.city,
      code: form.code,
      commissionEarned: 0,
      contactPerson: form.contactPerson,
      documents: [],
      email: form.email,
      gst: form.gst,
      id,
      manager: "Aditi Rao",
      mobile: form.mobile,
      monthlyLeads: 0,
      name: form.name,
      onboardingDate: new Date().toISOString(),
      pan: form.pan,
      pincode: form.pincode,
      riskRating: "Low",
      state: form.state,
      status: "Submitted",
      tier: "Bronze",
    });
    setSubmitted(true);
    setStep(3);
  }

  function resetOnboarding() {
    setErrors({});
    setForm({ ...initialOnboardingForm });
    setStep(0);
    setSubmitted(false);
  }

  const renderField = (
    key: keyof typeof form,
    label: string,
    props?: { options?: string[]; type?: string },
  ) => (
    <Field>
      <Label htmlFor={key}>{label}</Label>
      {props?.options ? (
        <Select id={key} onChange={(event) => update(key, event.target.value)} value={form[key]}>
          {props.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      ) : (
        <Input id={key} onChange={(event) => update(key, event.target.value)} type={props?.type ?? "text"} value={form[key]} />
      )}
      {errors[key] ? <p className="text-xs font-medium text-rose-600">{errors[key]}</p> : null}
    </Field>
  );

  return (
    <div>
      <PageHeader
        description="Capture partner business details, validate KYC identity, collect settlement banking, and review the onboarding packet before submission."
        eyebrow="DSA onboarding"
        title="Create DSA"
      />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="space-y-4">
            {steps.map((item, index) => (
              <div className="flex gap-3" key={item}>
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${
                    index <= step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {index < step ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{item}</p>
                  <p className="text-xs text-slate-500">
                    {["Partner profile", "PAN/GST/address", "Payout account", "Final submission"][index]}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">{steps[step]} details</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit}>
              {step === 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {renderField("code", "DSA code")}
                  {renderField("name", "Legal business name")}
                  {renderField("businessType", "Business type", { options: businessTypes })}
                  {renderField("contactPerson", "Contact person")}
                  {renderField("mobile", "Mobile")}
                  {renderField("email", "Email", { type: "email" })}
                </div>
              ) : null}
              {step === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {renderField("pan", "PAN")}
                  {renderField("gst", "GST")}
                  <div className="md:col-span-2">{renderField("address", "Address")}</div>
                  {renderField("city", "City")}
                  {renderField("state", "State")}
                  {renderField("pincode", "Pincode")}
                </div>
              ) : null}
              {step === 2 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {renderField("accountName", "Account name")}
                  {renderField("accountNumber", "Account number")}
                  {renderField("bankName", "Bank name")}
                  {renderField("ifsc", "IFSC")}
                </div>
              ) : null}
              {step === 3 ? (
                <div className="space-y-5">
                  {submitted ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <p className="font-semibold text-emerald-950">Onboarding submitted</p>
                      <p className="mt-1 text-sm text-emerald-700">
                        The partner record is now available in DSA Management with Submitted status.
                      </p>
                    </div>
                  ) : null}
                  <DetailGrid>
                    {Object.entries({
                      "DSA Code": form.code,
                      "Business Name": form.name,
                      "Business Type": form.businessType,
                      PAN: form.pan,
                      GST: form.gst,
                      Contact: `${form.contactPerson} · ${form.mobile}`,
                      Email: form.email,
                      Address: `${form.address}, ${form.city}, ${form.state} ${form.pincode}`,
                      Bank: `${form.bankName} · ${form.ifsc}`,
                      Status: "Submitted",
                    }).map(([label, value]) => (
                      <DetailItem key={label} label={label} value={value || "Not captured"} />
                    ))}
                  </DetailGrid>
                </div>
              ) : null}

              <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
                {submitted ? (
                  <>
                    <Button onClick={resetOnboarding} type="button" variant="secondary">
                      Onboard another
                    </Button>
                    <Link href="/dsa/management">
                      <Button type="button">View DSA management</Button>
                    </Link>
                  </>
                ) : (
                  <Button disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button" variant="secondary">
                    Back
                  </Button>
                )}
                {!submitted && step < 3 ? (
                  <Button onClick={next} type="button">
                    Continue
                  </Button>
                ) : !submitted ? (
                  <Button type="submit">
                    <Plus className="h-4 w-4" />
                    Submit onboarding
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DsaManagementPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Dsa | null>(null);
  const [editing, setEditing] = useState<Dsa | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = status ? store.dsas.filter((item) => item.status === status) : store.dsas;

  const columns: Column<Dsa>[] = [
    {
      cell: (item) => (
        <div>
          <Link className="font-semibold text-blue-700 hover:underline" href={`/dsa/${item.id}`}>
            {item.name}
          </Link>
          <p className="text-xs text-slate-500">{item.code}</p>
        </div>
      ),
      header: "Partner",
      key: "name",
      sortable: true,
      sortValue: (item) => item.name,
    },
    { cell: (item) => item.businessType, header: "Business type", key: "businessType" },
    { cell: (item) => item.city, header: "City", key: "city", sortable: true, sortValue: (item) => item.city },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => <Badge>{item.tier}</Badge>, header: "Tier", key: "tier" },
    { cell: (item) => percent(item.approvalRate), header: "Approval", key: "approvalRate", sortable: true, sortValue: (item) => item.approvalRate },
    { cell: (item) => formatCurrency(item.commissionEarned), header: "Commission", key: "commissionEarned", sortable: true, sortValue: (item) => item.commissionEarned },
  ];

  return (
    <div>
      <PageHeader
        action={
          <Button onClick={() => setCreating(true)} type="button">
            <Plus className="h-4 w-4" />
            New DSA
          </Button>
        }
        description="Manage partner records, commercial readiness, KYC status, risk posture, and activation lifecycle."
        eyebrow="Partner network"
        title="DSA Management"
      />
      <DataTable
        actions={(item) => (
          <ActionPair
            onDelete={() => deleteItem("dsas", item.id)}
            onEdit={() => setEditing(item)}
            onView={() => setSelected(item)}
          />
        )}
        columns={columns}
        emptyAction={<Button onClick={() => setCreating(true)}>Create DSA</Button>}
        filters={[{ label: "status", onChange: setStatus, options: dsaStatuses, value: status }]}
        items={rows}
        searchKeys={["name", "code", "pan", "mobile", "email", "city"]}
      />

      <Drawer
        description={selected ? `${selected.code} · ${selected.city}, ${selected.state}` : undefined}
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={selected?.name ?? "DSA"}
      >
        {selected ? (
          <div className="space-y-5">
            <DetailGrid>
              <DetailItem label="PAN" value={selected.pan} />
              <DetailItem label="GST" value={selected.gst} />
              <DetailItem label="Contact" value={`${selected.contactPerson} · ${selected.mobile}`} />
              <DetailItem label="Email" value={selected.email} />
              <DetailItem label="Status" value={<StatusBadge status={selected.status} />} />
              <DetailItem label="Onboarded" value={formatDate(selected.onboardingDate)} />
              <DetailItem label="Monthly leads" value={selected.monthlyLeads} />
              <DetailItem label="Commission" value={formatCurrency(selected.commissionEarned)} />
            </DetailGrid>
            <Link href={`/dsa/${selected.id}`}>
              <Button className="w-full" type="button">
                Open full profile
              </Button>
            </Link>
          </div>
        ) : null}
      </Drawer>

      <Modal onClose={() => setCreating(false)} open={creating} title="Create DSA">
        <RecordForm<Dsa>
          fields={dsaFields}
          initialValue={{ businessType: "Private Limited", manager: "Aditi Rao", status: "Submitted" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("dsas", newDsaFromForm(value));
            setCreating(false);
          }}
          submitLabel="Create DSA"
        />
      </Modal>

      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit DSA">
        {editing ? (
          <RecordForm<Dsa>
            fields={dsaFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("dsas", editing.id, value);
              setEditing(null);
            }}
            submitLabel="Save DSA"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function DsaProfilePage({ id }: { id: string }) {
  const { store } = useMockStore();
  const [tab, setTab] = useState("overview");
  const dsa = store.dsas.find((item) => item.id === id) ?? store.dsas[0];
  const applications = store.applications.filter((item) => item.dsaId === dsa.id);
  const commissions = store.commissions.filter((item) => item.dsaId === dsa.id);
  const leads = store.leads.filter((item) => item.dsaId === dsa.id);
  const audit = store.auditLogs.slice(0, 8);

  const commissionTotal = commissions.reduce((sum, item) => sum + item.payout, 0);
  const approvedApplications = applications.filter(
    (item) => item.status === "Approved" || item.status === "Disbursed",
  ).length;

  return (
    <div>
      <Link className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700" href="/dsa/management">
        <ArrowLeft className="h-4 w-4" />
        Back to DSA management
      </Link>
      <PageHeader
        action={<StatusBadge status={dsa.status} />}
        description={`${dsa.code} · ${dsa.businessType} · managed by ${dsa.manager}`}
        eyebrow="DSA profile"
        title={dsa.name}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard change="+6.2%" icon={TrendingUp} label="Approval rate" tone="green" value={percent(dsa.approvalRate)} />
        <KpiCard change="+11.0%" icon={ClipboardList} label="Monthly leads" value={String(dsa.monthlyLeads)} />
        <KpiCard change="+8.4%" icon={BadgeIndianRupee} label="Commission" tone="slate" value={formatCurrency(commissionTotal || dsa.commissionEarned)} />
        <KpiCard change="-1.8%" icon={ShieldCheck} label="Risk rating" tone="amber" value={dsa.riskRating} />
      </div>

      <div className="mt-6">
        <Tabs
          onChange={setTab}
          tabs={[
            { label: "Basic Info", value: "overview" },
            { label: "KYC", value: "kyc" },
            { label: "Documents", value: "documents" },
            { label: "Performance Metrics", value: "performance" },
            { label: "Applications", value: "apps" },
            { label: "Commission", value: "commission" },
            { label: "Audit Timeline", value: "audit" },
          ]}
          value={tab}
        />
      </div>

      <Card className="mt-4">
        <CardContent>
          {tab === "overview" ? (
            <DetailGrid>
              <DetailItem label="Contact person" value={dsa.contactPerson} />
              <DetailItem label="Mobile" value={dsa.mobile} />
              <DetailItem label="Email" value={dsa.email} />
              <DetailItem label="Address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
              <DetailItem label="Bank" value={`${dsa.bank.bankName} · ${dsa.bank.ifsc}`} />
              <DetailItem label="Tier" value={dsa.tier} />
            </DetailGrid>
          ) : null}
          {tab === "kyc" ? (
            <DetailGrid>
              <DetailItem label="PAN" value={dsa.pan} />
              <DetailItem label="GST" value={dsa.gst} />
              <DetailItem label="Business type" value={dsa.businessType} />
              <DetailItem label="Risk rating" value={<StatusBadge status={dsa.riskRating} />} />
              <DetailItem label="KYC readiness" value={<StatusBadge status={dsa.status === "KYC Pending" ? "Pending" : "Verified"} />} />
              <DetailItem label="Registered address" value={`${dsa.address}, ${dsa.city}, ${dsa.state} ${dsa.pincode}`} />
            </DetailGrid>
          ) : null}
          {tab === "documents" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {dsa.documents.map((doc) => (
                <div className="rounded-lg border border-slate-200 p-4" key={doc.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{doc.type}</p>
                      <p className="text-sm text-slate-500">{doc.fileName}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
              ))}
              {dsa.documents.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded for this partner.</p>
              ) : null}
            </div>
          ) : null}
          {tab === "performance" ? (
            <DetailGrid>
              <DetailItem label="Leads sourced" value={leads.length} />
              <DetailItem label="Applications sourced" value={applications.length} />
              <DetailItem label="Approved or disbursed" value={approvedApplications} />
              <DetailItem label="Approval rate" value={percent(dsa.approvalRate)} />
              <DetailItem label="Monthly lead target" value={dsa.monthlyLeads} />
              <DetailItem label="Commission earned" value={formatCurrency(commissionTotal || dsa.commissionEarned)} />
            </DetailGrid>
          ) : null}
          {tab === "apps" ? (
            <div className="space-y-3">
              {applications.length ? (
                applications.map((app) => (
                  <Link
                    className="flex items-center justify-between rounded-md border border-slate-100 p-3 hover:bg-slate-50"
                    href={`/applications/${app.id}`}
                    key={app.id}
                  >
                    <div>
                      <p className="font-semibold text-slate-950">{app.applicationId}</p>
                      <p className="text-sm text-slate-500">{app.customer} · {formatCurrency(app.loanAmount)}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-500">No applications sourced by this DSA yet.</p>
              )}
            </div>
          ) : null}
          {tab === "commission" ? (
            <div className="space-y-3">
              {commissions.map((commission) => (
                <div className="grid gap-3 rounded-md border border-slate-100 p-3 md:grid-cols-4" key={commission.id}>
                  <DetailItem label="Month" value={commission.month} />
                  <DetailItem label="Product" value={commission.product} />
                  <DetailItem label="Disbursed" value={formatCurrency(commission.disbursedAmount)} />
                  <DetailItem label="Payout" value={formatCurrency(commission.payout)} />
                </div>
              ))}
            </div>
          ) : null}
          {tab === "audit" ? (
            <div className="space-y-3">
              {audit.map((item) => (
                <div className="flex gap-3 rounded-md border border-slate-100 p-3" key={item.id}>
                  <FileText className="mt-0.5 h-4 w-4 text-blue-600" />
                  <div>
                    <p className="font-medium text-slate-950">{item.action}</p>
                    <p className="text-sm text-slate-500">{item.actor} · {formatDate(item.at)} · {item.ipAddress}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
