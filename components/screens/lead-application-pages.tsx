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
import { useMockStore } from "@/lib/store";
import {
  Application,
  ApplicationStage,
  ApplicationStatus,
  Lead,
  LeadStatus,
  Product,
} from "@/lib/types";
import { formatCurrency, formatDate, makeId } from "@/lib/utils";

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

const applicationFields: FieldConfig<Application>[] = [
  { label: "Customer", name: "customer", required: true },
  { label: "Mobile", name: "mobile", required: true },
  { label: "Email", name: "email", required: true, type: "email" },
  { label: "PAN", name: "pan", required: true },
  { label: "Aadhaar", name: "aadhaar", required: true },
  { label: "Product", name: "product", options: products, required: true, type: "select" },
  { label: "Loan amount", name: "loanAmount", required: true, type: "number" },
  { label: "Stage", name: "stage", options: applicationStages, required: true, type: "select" },
  { label: "Status", name: "status", options: applicationStatuses, required: true, type: "select" },
  { label: "Risk score", name: "riskScore", required: true, type: "number" },
  { label: "Credit score", name: "creditScore", required: true, type: "number" },
  { label: "Salary", name: "salary", required: true, type: "number" },
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
    owner: String(value.owner ?? "Aditi Rao"),
    product: (value.product as Product) || "Personal Loan",
    source: (value.source as Lead["source"]) || "DSA Campaign",
    status: (value.status as LeadStatus) || "New",
  };
}

function newApplication(value: Partial<Application>, dsaId: string, dsaName: string): Application {
  return {
    aadhaar: String(value.aadhaar ?? ""),
    applicationId: `APP-${Date.now().toString().slice(-5)}`,
    city: String(value.city ?? "Mumbai"),
    createdAt: new Date().toISOString(),
    creditScore: Number(value.creditScore ?? 700),
    customer: String(value.customer ?? "New Customer"),
    decisionSummary: "New application created from frontend mock workflow.",
    dsaId,
    dsaName,
    email: String(value.email ?? ""),
    id: makeId("app"),
    loanAmount: Number(value.loanAmount ?? 500000),
    mobile: String(value.mobile ?? ""),
    notes: ["Application created in demo workspace."],
    pan: String(value.pan ?? ""),
    product: (value.product as Product) || "Personal Loan",
    riskScore: Number(value.riskScore ?? 64),
    salary: Number(value.salary ?? 45000),
    stage: (value.stage as ApplicationStage) || "Lead Capture",
    status: (value.status as ApplicationStatus) || "Draft",
    timeline: [
      {
        actor: "Aditi Rao",
        at: new Date().toISOString(),
        id: makeId("tl"),
        note: "Application initiated through frontend CRUD.",
        title: "Application created",
      },
    ],
    verificationStatus: "Pending",
  };
}

export function LeadsPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [view, setView] = useState("table");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);

  const rows = status ? store.leads.filter((item) => item.status === status) : store.leads;
  const defaultDsa = store.dsas[0];

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
          <Button onClick={() => setCreating(true)} type="button">
            <Plus className="h-4 w-4" />
            New Lead
          </Button>
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
          initialValue={{ owner: "Aditi Rao", product: "Personal Loan", source: "DSA Campaign", status: "New" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("leads", newLead(value, defaultDsa.id, defaultDsa.name));
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
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const rows = status ? store.applications.filter((item) => item.status === status) : store.applications;
  const defaultDsa = store.dsas[0];

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
    { cell: (item) => item.dsaName, header: "DSA", key: "dsaName" },
    { cell: (item) => item.product, header: "Product", key: "product" },
    { cell: (item) => formatCurrency(item.loanAmount), header: "Loan amount", key: "loanAmount", sortable: true, sortValue: (item) => item.loanAmount },
    { cell: (item) => item.stage, header: "Stage", key: "stage" },
    { cell: (item) => <Badge tone={item.riskScore > 78 ? "rose" : item.riskScore > 65 ? "amber" : "green"}>{item.riskScore}</Badge>, header: "Risk", key: "riskScore", sortable: true, sortValue: (item) => item.riskScore },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
  ];

  return (
    <div>
      <PageHeader
        action={
          <Button onClick={() => setCreating(true)} type="button">
            <Plus className="h-4 w-4" />
            New Application
          </Button>
        }
        description="Control application status, stage ownership, risk score, DSA linkage, and underwriting movement."
        eyebrow="Loan operations"
        title="Loan Application Management"
      />
      <DataTable
        actions={(item) => (
          <ActionPair
            onDelete={() => deleteItem("applications", item.id)}
            onEdit={() => setEditing(item)}
            onView={() => window.location.assign(`/applications/${item.id}`)}
          />
        )}
        columns={columns}
        filters={[{ label: "status", onChange: setStatus, options: applicationStatuses, value: status }]}
        items={rows}
        searchKeys={["applicationId", "customer", "pan", "aadhaar", "mobile", "dsaName"]}
      />

      <Modal onClose={() => setCreating(false)} open={creating} title="Create application">
        <RecordForm<Application>
          fields={applicationFields}
          initialValue={{ product: "Personal Loan", stage: "Lead Capture", status: "Draft", verificationStatus: "Pending" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("applications", newApplication(value, defaultDsa.id, defaultDsa.name));
            setCreating(false);
          }}
          submitLabel="Create application"
        />
      </Modal>

      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit application">
        {editing ? (
          <RecordForm<Application>
            fields={applicationFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("applications", editing.id, {
                ...value,
                creditScore: Number(value.creditScore ?? editing.creditScore),
                loanAmount: Number(value.loanAmount ?? editing.loanAmount),
                riskScore: Number(value.riskScore ?? editing.riskScore),
                salary: Number(value.salary ?? editing.salary),
              });
              setEditing(null);
            }}
            submitLabel="Save application"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function ApplicationDetailPage({ id }: { id: string }) {
  const { store, updateItem } = useMockStore();
  const application = store.applications.find((item) => item.id === id) ?? store.applications[0];
  const [note, setNote] = useState("");
  const documents = store.documents.filter((item) => item.applicationId === application.id);
  const checks = store.verificationChecks.filter((item) => item.applicationId === application.applicationId);

  function addNote() {
    if (!note.trim()) return;
    updateItem("applications", application.id, {
      notes: [note.trim(), ...application.notes],
      timeline: [
        {
          actor: "Aditi Rao",
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard change="+2.3%" icon={ClipboardCheck} label="Credit score" tone="green" value={String(application.creditScore)} />
        <KpiCard change="-4.1%" icon={ShieldAlert} label="Risk score" tone="amber" value={String(application.riskScore)} />
        <KpiCard change="+8.7%" icon={FileText} label="Documents" value={String(documents.length)} />
        <KpiCard change="+1.2%" icon={GitCompare} label="Verification" tone="slate" value={application.verificationStatus} />
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
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">DSA Information</h2>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailItem label="DSA" value={application.dsaName} />
                <DetailItem label="Stage" value={application.stage} />
                <DetailItem label="Verification" value={<StatusBadge status={application.verificationStatus} />} />
                <DetailItem label="Decision summary" value={application.decisionSummary} />
              </DetailGrid>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-slate-950">Documents</h2>
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
              <Textarea onChange={(event) => setNote(event.target.value)} placeholder="Add credit, ops, or risk note" value={note} />
              <Button className="w-full" onClick={addNote} type="button">
                Add note
              </Button>
              {application.notes.map((item) => (
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
              {application.timeline.map((item) => (
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
        description="Search applicants and DSA-sourced records across PAN, Aadhaar, mobile, and email to identify duplicates, similar applications, and risk indicators."
        eyebrow="Risk controls"
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
                  <Badge tone={item.riskScore > 78 ? "rose" : "amber"}>Risk {item.riskScore}</Badge>
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
              <h2 className="text-base font-semibold text-slate-950">Risk indicators</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Shared DSA", similar.length],
                ["High risk scores", results.filter((item) => item.riskScore > 78).length],
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
