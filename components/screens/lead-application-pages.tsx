"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardCheck,
  FileText,
  GitCompare,
  Kanban,
  ListFilter,
  Plus,
  Search,
  UploadCloud,
  ShieldAlert,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

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
  Textarea,
} from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { DEMO_USERS } from "@/lib/demo-identities";
import { buildApplicationJourney } from "@/lib/product-journeys";
import { useMockStore } from "@/lib/store";
import {
  Application,
  DeviationApproverRole,
  ApplicationStage,
  ApplicationStatus,
  DocumentRecord,
  Lead,
  LeadStatus,
  Product,
  VerificationStatus,
} from "@/lib/types";
import { formatCurrency, formatDate, makeId } from "@/lib/utils";

const CUSTOMER_DSA_DISPLAY_NAME = "Cosmos DSA";

const products: Product[] = [
  "Personal Loan",
  "Home Loan",
  "Loan Against Property",
  "Business Loan",
  "Auto Loan",
];

const leadStatuses: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "In Progress",
  "Converted",
  "Lost",
];

const applicationStages: ApplicationStage[] = [
  "Lead Capture",
  "Document Review",
  "BRE Check",
  "Credit Underwriting",
  "Risk Review",
  "Approval",
  "Disbursal",
];

const applicationStatuses: ApplicationStatus[] = [
  "Draft",
  "In Review",
  "Approved",
  "Rejected",
  "Disbursed",
  "On Hold",
];

const verificationStatuses: VerificationStatus[] = ["Pending", "In Progress", "Verified", "Failed"];
const riskBands = ["Low risk (0-64)", "Medium risk (65-78)", "High risk (79+)"];
const deviationApproverRoles: DeviationApproverRole[] = ["Branch User", "DSA Credit", "DSA Manager"];

function riskBand(score: number) {
  if (score > 78) return "High risk (79+)";
  if (score > 64) return "Medium risk (65-78)";
  return "Low risk (0-64)";
}

function getDeviationApproverRole(role?: string): DeviationApproverRole | null {
  return deviationApproverRoles.includes(role as DeviationApproverRole)
    ? (role as DeviationApproverRole)
    : null;
}

function containsDeviationText(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("deviation") || normalized.includes("special-case") || normalized.includes("exception review");
}

const leadFields: FieldConfig<Lead>[] = [
  { label: "Customer", name: "customer", required: true },
  { label: "Mobile", name: "mobile", required: true },
  { label: "Email", name: "email", required: true, type: "email" },
  { label: "City", name: "city", required: true },
  { label: "Source", name: "source", options: ["Referral", "Branch", "Website", "DSA Campaign", "Partner"], type: "select" },
  { label: "Product", name: "product", options: products, required: true, type: "select" },
  { label: "Amount", name: "amount", required: true, type: "number" },
  { label: "Status", name: "status", options: leadStatuses, required: true, type: "select" },
  { label: "Owner", name: "owner", required: true },
  { label: "Next action", name: "nextAction", required: true },
];

function newLead(value: Partial<Lead>, dsaId: string, dsaName: string): Lead {
  return {
    amount: Number(value.amount ?? 250000),
    city: String(value.city ?? ""),
    createdAt: new Date().toISOString(),
    customer: String(value.customer ?? "New Customer"),
    dsaId,
    dsaName,
    email: String(value.email ?? ""),
    id: makeId("lead"),
    leadId: `LD-${Date.now().toString().slice(-5)}`,
    mobile: String(value.mobile ?? ""),
    nextAction: String(value.nextAction ?? "Call back"),
    owner: String(value.owner ?? DEMO_USERS.admin.name),
    product: (value.product as Product) || "Personal Loan",
    source: (value.source as Lead["source"]) || "DSA Campaign",
    status: (value.status as LeadStatus) || "New",
  };
}

export function LeadsPage() {
  const { createItem, deleteItem, store, updateItem, currentUser } = useMockStore();
  const [view, setView] = useState("table");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);

  let rows = status ? store.leads.filter((item) => item.status === status) : store.leads;
  if (currentUser?.role === "Customer") {
    rows = rows.filter((item) => item.customer === currentUser.name);
  } else if (currentUser?.role === "DSA Partner") {
    rows = rows.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name
    );
  }
  const defaultDsa = store.dsas.find((d) => d.status === "Active") || store.dsas[0];

  const columns: Column<Lead>[] = [
    {
      cell: (item) => (
        <div>
          <p className="font-semibold text-slate-950">{item.customer}</p>
          <p className="text-xs text-slate-500">{item.leadId}</p>
        </div>
      ),
      header: "Lead",
      key: "customer",
      sortable: true,
      sortValue: (item) => item.customer,
    },
    { cell: (item) => item.product, header: "Product", key: "product" },
    { cell: (item) => formatCurrency(item.amount), header: "Amount", key: "amount", sortable: true, sortValue: (item) => item.amount },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => item.dsaName, header: "DSA", key: "dsaName" },
    { cell: (item) => item.nextAction, header: "Next action", key: "nextAction" },
  ];

  return (
    <div>
      <PageHeader
        action={
          currentUser?.role !== "Customer" ? (
            <Button onClick={() => setCreating(true)} type="button">
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          ) : undefined
        }
        description="Track lead capture, qualification, DSA ownership, next actions, and conversion movement."
        eyebrow="Lead pipeline"
        title="Lead Management"
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs onChange={setView} tabs={[{ label: "Table", value: "table" }, { label: "Kanban", value: "kanban" }]} value={view} />
        <Select className="w-48" onChange={(event) => setStatus(event.target.value)} value={status}>
          <option value="">All statuses</option>
          {leadStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>

      {view === "table" ? (
        <DataTable
          actions={(item) => (
            <ActionPair
              onDelete={() => deleteItem("leads", item.id)}
              onEdit={() => setEditing(item)}
              onView={() => setSelected(item)}
            />
          )}
          columns={columns}
          filters={[{ label: "status", onChange: setStatus, options: leadStatuses, value: status }]}
          items={rows}
          searchKeys={["customer", "leadId", "mobile", "email", "dsaName", "city"]}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-6">
          {leadStatuses.map((kanbanStatus) => (
            <Card className="min-h-96" key={kanbanStatus}>
              <CardHeader className="flex-row items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-950">{kanbanStatus}</h2>
                <Badge>{rows.filter((item) => item.status === kanbanStatus).length}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {rows
                  .filter((item) => item.status === kanbanStatus)
                  .slice(0, 8)
                  .map((lead) => (
                    <button
                      className="w-full rounded-md border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      type="button"
                    >
                      <p className="text-sm font-semibold text-slate-950">{lead.customer}</p>
                      <p className="mt-1 text-xs text-slate-500">{lead.product} · {formatCurrency(lead.amount)}</p>
                      <p className="mt-2 text-xs text-slate-500">{lead.dsaName}</p>
                    </button>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Drawer onClose={() => setSelected(null)} open={Boolean(selected)} title={selected?.customer ?? "Lead"}>
        {selected ? (
          <DetailGrid>
            <DetailItem label="Lead ID" value={selected.leadId} />
            <DetailItem label="Status" value={<StatusBadge status={selected.status} />} />
            <DetailItem label="Product" value={selected.product} />
            <DetailItem label="Amount" value={formatCurrency(selected.amount)} />
            <DetailItem label="DSA" value={selected.dsaName} />
            <DetailItem label="Next action" value={selected.nextAction} />
          </DetailGrid>
        ) : null}
      </Drawer>

      <Modal onClose={() => setCreating(false)} open={creating} title="Create lead">
        <RecordForm<Lead>
          fields={leadFields}
          initialValue={{
            owner: currentUser?.name ?? DEMO_USERS.admin.name,
            product: "Personal Loan",
            source: "DSA Campaign",
            status: "New",
          }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            const dsaId = currentUser?.role === "DSA Partner" ? (currentUser.id || defaultDsa.id) : defaultDsa.id;
            const dsaName = currentUser?.role === "DSA Partner" ? currentUser.name : defaultDsa.name;
            createItem("leads", newLead(value, dsaId, dsaName));
            setCreating(false);
          }}
          submitLabel="Create lead"
        />
      </Modal>

      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit lead">
        {editing ? (
          <RecordForm<Lead>
            fields={leadFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("leads", editing.id, { ...value, amount: Number(value.amount ?? editing.amount) });
              setEditing(null);
            }}
            submitLabel="Save lead"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function ApplicationsPage() {
  const { deleteItem, store, currentUser } = useMockStore();
  const [status, setStatus] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [dsaTypeFilter, setDsaTypeFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [verificationFilter, setVerificationFilter] = useState("");

  const dsaById = useMemo(() => new Map(store.dsas.map((dsa) => [dsa.id, dsa])), [store.dsas]);
  const dsaTypes = useMemo(
    () => Array.from(new Set(store.dsas.map((dsa) => dsa.businessType))).sort(),
    [store.dsas],
  );

  let rows = store.applications;
  if (currentUser?.role === "Customer") {
    rows = rows.filter((item) => item.customer === currentUser.name);
  } else if (currentUser?.role === "DSA Partner") {
    rows = rows.filter((item) => 
      item.dsaId === currentUser.id || 
      item.dsaName === currentUser.name
    );
  }

  rows = rows.filter((item) => {
    const dsaType = dsaById.get(item.dsaId)?.businessType ?? "Direct";
    return (
      (!productFilter || item.product === productFilter) &&
      (!dsaTypeFilter || dsaType === dsaTypeFilter) &&
      (!stageFilter || item.stage === stageFilter) &&
      (!status || item.status === status) &&
      (!riskFilter || riskBand(item.riskScore) === riskFilter) &&
      (!verificationFilter || item.verificationStatus === verificationFilter)
    );
  });

  const canSeeDeviation = Boolean(getDeviationApproverRole(currentUser?.role));
  const columns: Column<Application>[] = [
    {
      cell: (item) => (
        <div>
          <Link className="font-semibold text-blue-700 hover:underline" href={`/applications/${item.id}`}>
            {item.applicationId}
          </Link>
          <p className="text-xs text-slate-500">{item.customer}</p>
        </div>
      ),
      header: "Application",
      key: "applicationId",
      sortable: true,
      sortValue: (item) => item.applicationId,
    },
    {
      cell: (item) => {
        const dsa = dsaById.get(item.dsaId);
        return (
          <div>
            <p className="font-medium text-slate-900">{currentUser?.role === "Customer" ? CUSTOMER_DSA_DISPLAY_NAME : item.dsaName}</p>
            <p className="text-xs text-slate-500">{dsa?.businessType ?? "Direct"}{dsa?.tier ? ` · ${dsa.tier}` : ""}</p>
          </div>
        );
      },
      header: "DSA / Type",
      key: "dsaName",
      sortable: true,
      sortValue: (item) => `${dsaById.get(item.dsaId)?.businessType ?? "Direct"}-${currentUser?.role === "Customer" ? CUSTOMER_DSA_DISPLAY_NAME : item.dsaName}`,
    },
    { cell: (item) => item.product, header: "Product", key: "product", sortable: true, sortValue: (item) => item.product },
    { cell: (item) => formatCurrency(item.loanAmount), header: "Loan amount", key: "loanAmount", sortable: true, sortValue: (item) => item.loanAmount },
    { cell: (item) => item.stage, header: "Stage", key: "stage", sortable: true, sortValue: (item) => item.stage },
  ];

  if (canSeeDeviation) {
    columns.push({
      cell: (item) =>
        item.deviation?.required ? (
          <StatusBadge status={`Deviation ${item.deviation.status}`} />
        ) : (
          <span className="text-xs font-medium text-slate-400">Standard</span>
        ),
      header: "Deviation",
      key: "deviation",
      sortable: true,
      sortValue: (item) => item.deviation?.status ?? "Standard",
    });
  }

  columns.push({ cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status", sortable: true, sortValue: (item) => item.status });

  return (
    <div>
      <PageHeader
        description="Review journey-created applications by product, DSA type, stage, and underwriting status."
        eyebrow="Loan operations"
        title="Loan Application Management"
      />
      <DataTable
        actions={(item) => (
          <ActionPair
            onDelete={() => deleteItem("applications", item.id)}
            onView={() => window.location.assign(`/applications/${item.id}`)}
          />
        )}
        columns={columns}
        filters={[
          { label: "product", onChange: setProductFilter, options: products, value: productFilter },
          { label: "DSA type", onChange: setDsaTypeFilter, options: dsaTypes, value: dsaTypeFilter },
          { label: "stage", onChange: setStageFilter, options: applicationStages, value: stageFilter },
          { label: "status", onChange: setStatus, options: applicationStatuses, value: status },
          { label: "verification", onChange: setVerificationFilter, options: verificationStatuses, value: verificationFilter },
        ]}
        items={rows}
        searchKeys={["applicationId", "customer", "pan", "aadhaar", "mobile", "dsaName", "product", "stage", "verificationStatus"]}
      />
    </div>
  );
}

export function ApplicationDetailPage({ id }: { id: string }) {
  const { createItem, store, updateItem, currentUser } = useMockStore();
  const application = store.applications.find((item) => item.id === id) ?? store.applications[0];
  const [note, setNote] = useState("");
  const [isDeviationModalOpen, setIsDeviationModalOpen] = useState(false);
  const [deviationInboxText, setDeviationInboxText] = useState("");
  const [deviationInboxError, setDeviationInboxError] = useState("");
  const documents = store.documents.filter((item) => item.applicationId === application.id);
  const isCustomerApplication = currentUser?.role === "Customer" && application.customer === currentUser.name;
  const visibleDsaName = currentUser?.role === "Customer" ? CUSTOMER_DSA_DISPLAY_NAME : application.dsaName;
  const visibleVerificationStatus = isCustomerApplication && documents.length === 0 ? "Pending" : application.verificationStatus;
  const checks = store.verificationChecks.filter((item) => item.applicationId === application.applicationId);
  const journeySeed = Number(application.applicationId.replace(/\D/g, "")) || 1;
  const journey = application.journey ?? buildApplicationJourney(application.product, journeySeed, application);
  const deviationApproverRole = getDeviationApproverRole(currentUser?.role);
  const canSeeDeviation = Boolean(deviationApproverRole && application.deviation?.required);
  const canResolveDeviation = Boolean(
    canSeeDeviation &&
      application.deviation?.required &&
      application.deviation.status === "Pending",
  );
  const visibleDecisionSummary =
    application.deviation?.required && !canSeeDeviation
      ? "Application is under manual credit review. The credit desk will update the final decision after review."
      : application.decisionSummary;
  const visibleNotes = canSeeDeviation
    ? application.notes
    : application.notes.filter((item) => !containsDeviationText(item));
  const visibleTimeline = canSeeDeviation
    ? application.timeline
    : application.timeline.filter((item) => !containsDeviationText(`${item.title} ${item.note}`));

  function uploadCustomerDocument(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !isCustomerApplication) return;

    const now = new Date().toISOString();
    const documentId = makeId("doc");
    const nextDocument: DocumentRecord = {
      applicationId: application.id,
      documentId: `DOC-${documentId.slice(-5).toUpperCase()}`,
      fileName: file.name,
      id: documentId,
      ownerName: application.customer,
      remarks: "Uploaded by customer. Pending verification by Cosmos operations.",
      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
      status: "Pending",
      type: "Bank Statement",
      uploadedAt: now,
    };

    createItem("documents", nextDocument);
    updateItem("applications", application.id, {
      notes: [`Customer uploaded ${file.name}. Verification pending.`, ...application.notes],
      timeline: [
        {
          actor: currentUser?.name ?? application.customer,
          at: now,
          id: makeId("tl"),
          note: `${file.name} uploaded and queued for document verification.`,
          title: "Document uploaded",
        },
        ...application.timeline,
      ],
      verificationStatus: "Pending",
    });
  }
  function addNote() {
    if (!note.trim()) return;
    updateItem("applications", application.id, {
      notes: [note.trim(), ...application.notes],
      timeline: [
        {
          actor: currentUser?.name ?? DEMO_USERS.admin.name,
          at: new Date().toISOString(),
          id: makeId("tl"),
          note: note.trim(),
          title: "Note added",
        },
        ...application.timeline,
      ],
    });
    setNote("");
  }

  function getDeviationInboxNote() {
    const trimmed = deviationInboxText.trim();
    if (!trimmed) {
      setDeviationInboxError("Add review information before submitting this deviation case.");
      return null;
    }
    return trimmed;
  }

  function submitDeviationNote() {
    if (!application.deviation?.required || !deviationApproverRole) return;
    const inboxNote = getDeviationInboxNote();
    if (!inboxNote) return;

    const actor = currentUser?.name ?? DEMO_USERS.admin.name;
    const now = new Date().toISOString();
    const noteText = `Deviation inbox update by ${actor}: ${inboxNote}`;

    updateItem("applications", application.id, {
      deviation: {
        ...application.deviation,
        remarks: inboxNote,
      },
      notes: [noteText, ...application.notes],
      timeline: [
        {
          actor,
          at: now,
          id: makeId("tl"),
          note: inboxNote,
          title: "Deviation inbox updated",
        },
        ...application.timeline,
      ],
    });
    setDeviationInboxText("");
    setDeviationInboxError("");
  }

  function resolveDeviation(resolution: "Approved" | "Rejected") {
    if (!application.deviation?.required || !deviationApproverRole) return;
    const inboxNote = getDeviationInboxNote();
    if (!inboxNote) return;

    const actor = currentUser?.name ?? DEMO_USERS.admin.name;
    const now = new Date().toISOString();
    const approved = resolution === "Approved";
    const nextStatus: Application["status"] = approved ? "Approved" : "Rejected";
    const nextStage: Application["stage"] = approved ? "Approval" : "Risk Review";
    const note = approved
      ? `Deviation approved by ${actor}. Application approved. Reviewer note: ${inboxNote}`
      : `Deviation rejected by ${actor}. Application rejected under exception review. Reviewer note: ${inboxNote}`;

    updateItem("applications", application.id, {
      decisionSummary: note,
      deviation: {
        ...application.deviation,
        ...(approved
          ? {
              approvedAt: now,
              approvedBy: actor,
              approvedByRole: deviationApproverRole,
            }
          : {
              rejectedAt: now,
              rejectedBy: actor,
              rejectedByRole: deviationApproverRole,
            }),
        remarks: inboxNote,
        status: resolution,
      },
      notes: [note, ...application.notes],
      stage: nextStage,
      status: nextStatus,
      timeline: [
        {
          actor,
          at: now,
          id: makeId("tl"),
          note,
          title: `Deviation ${resolution}`,
        },
        ...application.timeline,
      ],
      verificationStatus: approved ? "Verified" : "Failed",
    });
    setDeviationInboxText("");
    setDeviationInboxError("");
    setIsDeviationModalOpen(false);
  }

  return (
    <div>
      <Link className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700" href="/applications">
        <ArrowLeft className="h-4 w-4" />
        Back to applications
      </Link>
      <PageHeader
        action={<StatusBadge status={application.status} />}
        description={`${application.customer} · ${application.product} · ${formatCurrency(application.loanAmount)}`}
        eyebrow="Application detail"
        title={application.applicationId}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard change="+8.7%" icon={FileText} label="Documents" value={String(documents.length)} />
        <KpiCard change="+1.2%" icon={GitCompare} label="Verification" tone="slate" value={visibleVerificationStatus} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">Applicant</h2>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailItem label="Customer" value={application.customer} />
                <DetailItem label="Mobile" value={application.mobile} />
                <DetailItem label="Email" value={application.email} />
                <DetailItem label="PAN" value={application.pan} />
                <DetailItem label="Aadhaar" value={application.aadhaar} />
                <DetailItem label="Salary" value={formatCurrency(application.salary)} />
              </DetailGrid>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{journey.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{journey.journeyId} - {journey.channel}</p>
              </div>
              <Badge tone="blue">{journey.currentStep}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {journey.completedSteps.map((step) => (
                  <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700" key={step}>
                    {step}
                  </div>
                ))}
              </div>
              <DetailGrid>
                {journey.fields.map((item) => (
                  <DetailItem key={item.id} label={`${item.group} - ${item.label}`} value={item.value} />
                ))}
              </DetailGrid>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">DSA Information</h2>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailItem label="DSA" value={visibleDsaName} />
                <DetailItem label="Stage" value={application.stage} />
                <DetailItem label="Verification" value={<StatusBadge status={visibleVerificationStatus} />} />
                <DetailItem label="Decision summary" value={visibleDecisionSummary} />
              </DetailGrid>
            </CardContent>
          </Card>
          {canSeeDeviation ? (
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Deviation Review</h2>
                  <p className="mt-1 text-xs text-slate-500">Open the reviewer inbox to view and act on this case.</p>
                </div>
                <StatusBadge status={`Deviation ${application.deviation?.status ?? "Pending"}`} />
              </CardHeader>
              <CardContent>
                <Button onClick={() => setIsDeviationModalOpen(true)} type="button">
                  Open Deviation Inbox
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-950">Documents</h2>
              {isCustomerApplication ? (
                <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 transition hover:bg-slate-50">
                  <UploadCloud className="h-3.5 w-3.5" />
                  Upload
                  <Input accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={uploadCustomerDocument} type="file" />
                </label>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {documents.map((doc) => (
                <div className="rounded-md border border-slate-100 p-3" key={doc.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{doc.type}</p>
                      <p className="text-xs text-slate-500">{doc.fileName}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
              ))}
              {documents.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-2">
                  No documents uploaded yet. Upload PAN, income, or bank documents to start verification.
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">Verification Status</h2>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {checks.map((check) => (
                <DetailItem key={check.id} label={`${check.type} · ${check.assignedTo}`} value={<StatusBadge status={check.status} />} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">Notes</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea onChange={(event) => setNote(event.target.value)} placeholder="Add credit or ops note" value={note} />
              <Button className="w-full" onClick={addNote} type="button">
                Add note
              </Button>
              {visibleNotes.map((item) => (
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600" key={item}>
                  {item}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">Timeline</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibleTimeline.map((item) => (
                <div className="border-l-2 border-blue-100 pl-3" key={item.id}>
                  <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.actor} · {formatDate(item.at)}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <Modal
        onClose={() => {
          setIsDeviationModalOpen(false);
          setDeviationInboxError("");
        }}
        open={isDeviationModalOpen && canSeeDeviation}
        title="Deviation Inbox"
        width="max-w-2xl"
      >
        {application.deviation?.required && canSeeDeviation ? (
          <div className="space-y-4">
            <DetailGrid>
              <DetailItem label="Application" value={application.applicationId} />
              <DetailItem label="Applicant" value={application.customer} />
              <DetailItem label="Product" value={application.product} />
              <DetailItem label="Status" value={<StatusBadge status={`Deviation ${application.deviation.status}`} />} />
              <DetailItem label="Requested by" value={application.deviation.requestedBy} />
              <DetailItem label="Requested on" value={formatDate(application.deviation.requestedAt)} />
            </DetailGrid>
            <div className="rounded-md border border-sky-100 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-blue-950">Deviation reasons</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-blue-800">
                {application.deviation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            {application.deviation.remarks ? (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Latest inbox note:</span> {application.deviation.remarks}
              </div>
            ) : null}
            <Field>
              <Label htmlFor="deviationInboxText">Inbox note / reason</Label>
              <Textarea
                id="deviationInboxText"
                onChange={(event) => {
                  setDeviationInboxText(event.target.value);
                  setDeviationInboxError("");
                }}
                placeholder="Add deviation justification, branch observation, compensating factor, or rejection reason"
                rows={5}
                value={deviationInboxText}
              />
              {deviationInboxError ? <p className="text-xs font-medium text-rose-600">{deviationInboxError}</p> : null}
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={submitDeviationNote} type="button" variant="secondary">
                Submit Note
              </Button>
              {canResolveDeviation ? (
                <>
                  <Button onClick={() => resolveDeviation("Rejected")} type="button" variant="danger">
                    Reject Application
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => resolveDeviation("Approved")}
                    type="button"
                  >
                    Approve Application
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export function DedupePage() {
  const { store } = useMockStore();
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("PAN");

  function search(event: FormEvent) {
    event.preventDefault();
    setQuery(draftQuery);
  }

  const results = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return store.applications.slice(0, 5);
    return store.applications.filter((item) => {
      const value =
        mode === "PAN"
          ? item.pan
          : mode === "Aadhaar"
            ? item.aadhaar
            : mode === "Mobile"
              ? item.mobile
              : item.email;
      return value.toLowerCase().includes(normalized);
    });
  }, [mode, query, store.applications]);

  const similar = store.applications
    .filter((item) => results.some((result) => result.dsaId === item.dsaId) && !results.some((result) => result.id === item.id))
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        description="Search applicants and DSA-sourced records across PAN, Aadhaar, mobile, and email to identify duplicates and similar applications."
        eyebrow="Dedupe controls"
        title="DSA & Dedupe View"
      />
      <Card>
        <CardContent>
          <form className="grid gap-4 lg:grid-cols-[200px_1fr_auto]" onSubmit={search}>
            <Field>
              <Label>Search by</Label>
              <Select onChange={(event) => setMode(event.target.value)} value={mode}>
                {["PAN", "Aadhaar", "Mobile", "Email"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Identifier</Label>
              <Input onChange={(event) => setDraftQuery(event.target.value)} placeholder="Enter PAN, Aadhaar, mobile, or email" value={draftQuery} />
            </Field>
            <div className="flex items-end">
              <Button type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <ListFilter className="h-4 w-4 text-blue-600" />
              Matching records
            </h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((item) => (
              <div className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[1fr_auto]" key={item.id}>
                <div>
                  <Link className="font-semibold text-blue-700 hover:underline" href={`/applications/${item.id}`}>
                    {item.applicationId} · {item.customer}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.pan} · {item.aadhaar} · {item.mobile} · {item.email}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">DSA: {item.dsaName}</p>
                </div>
                 <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
            {results.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
                No records matched this {mode.toLowerCase()} identifier.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">Dedupe indicators</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Shared DSA", similar.length],
                ["Same city cluster", results.filter((item) => item.city === results[0]?.city).length],
                ["Open review holds", results.filter((item) => item.status === "On Hold").length],
              ].map(([label, value]) => (
                <div className="flex items-center justify-between rounded-md bg-slate-50 p-3" key={label}>
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="text-lg font-semibold text-slate-950">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <Kanban className="h-4 w-4 text-blue-600" />
                Similar applications
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {similar.map((item) => (
                <Link className="block rounded-md border border-slate-100 p-3 hover:bg-slate-50" href={`/applications/${item.id}`} key={item.id}>
                  <p className="font-medium text-slate-950">{item.customer}</p>
                  <p className="text-sm text-slate-500">{item.applicationId} · {item.product}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
