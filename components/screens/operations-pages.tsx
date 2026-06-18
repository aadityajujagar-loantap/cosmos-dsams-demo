"use client";

import { CheckCircle2, Eye, FileUp, GitBranch, Layers, Plus, RotateCcw, Shield, XCircle } from "lucide-react";
import { useState } from "react";

import { ActionPair, DetailGrid, DetailItem, PageHeader } from "@/components/module";
import { Column, DataTable } from "@/components/ui/data-table";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Drawer,
  Input,
  Modal,
  Select,
  StatusBadge,
} from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { DEMO_USERS } from "@/lib/demo-identities";
import { useMockStore } from "@/lib/store";
import {
  ApprovalItem,
  ApprovalStage,
  ApprovalStatus,
  BreRule,
  CibilScoreBand,
  DocumentRecord,
  DocumentType,
  GenderFilter,
  LoanSlab,
  Product,
  RuleCondition,
  RuleOperator,
  RuleStatus,
  VerificationCheck,
  VerificationStatus,
} from "@/lib/types";
import { formatDate, makeId } from "@/lib/utils";

const products: Product[] = [
  "Personal Loan",
  "Home Loan",
  "Loan Against Property",
  "Business Loan",
  "Auto Loan",
];

const ruleStatuses: RuleStatus[] = ["Active", "Inactive", "Draft"];
const verificationStatuses: VerificationStatus[] = ["Pending", "In Progress", "Verified", "Failed"];
const documentTypes: DocumentType[] = ["PAN", "Aadhaar", "Salary Slip", "Bank Statement", "Photograph"];
const approvalStages: ApprovalStage[] = ["Maker", "Checker", "Risk Review", "Final Approval"];
const approvalStatuses: ApprovalStatus[] = ["Pending", "Approved", "Rejected", "Returned"];

const ruleFields: FieldConfig<BreRule>[] = [
  { label: "Rule name", name: "ruleName", required: true },
  { label: "Rule code", name: "ruleCode", required: true },
  { label: "Product", name: "product", options: products, required: true, type: "select" },
  { label: "Priority", name: "priority", required: true, type: "number" },
  { label: "Status", name: "status", options: ruleStatuses, required: true, type: "select" },
  { label: "Outcome", name: "outcome", required: true },
];

const verificationFields: FieldConfig<VerificationCheck>[] = [
  { label: "Application ID", name: "applicationId", required: true },
  { label: "Customer", name: "customer", required: true },
  { label: "Type", name: "type", options: ["KYC", "Address", "Employment", "Bank"], required: true, type: "select" },
  { label: "Status", name: "status", options: verificationStatuses, required: true, type: "select" },
  { label: "Assigned to", name: "assignedTo", required: true },
  { label: "Due date", name: "dueDate", required: true, type: "date" },
  { label: "Evidence", name: "evidence", required: true },
];

const documentFields: FieldConfig<DocumentRecord>[] = [
  { label: "Owner", name: "ownerName", required: true },
  { label: "Type", name: "type", options: documentTypes, required: true, type: "select" },
  { label: "File name", name: "fileName", required: true },
  { label: "Status", name: "status", options: verificationStatuses, required: true, type: "select" },
  { label: "Remarks", name: "remarks", required: true },
];

const approvalFields: FieldConfig<ApprovalItem>[] = [
  { label: "Application ID", name: "applicationId", required: true },
  { label: "Customer", name: "customer", required: true },
  { label: "Stage", name: "stage", options: approvalStages, required: true, type: "select" },
  { label: "Status", name: "status", options: approvalStatuses, required: true, type: "select" },
  { label: "Approver", name: "approver", required: true },
];

function newRule(value: Partial<BreRule>, conditions: RuleCondition[], operator: RuleOperator): BreRule {
  return {
    conditions,
    id: makeId("rule"),
    operator,
    outcome: String(value.outcome ?? "Route to risk"),
    priority: Number(value.priority ?? 1),
    product: (value.product as Product) || "Personal Loan",
    ruleCode: String(value.ruleCode ?? `BRE-${Date.now().toString().slice(-4)}`),
    ruleName: String(value.ruleName ?? "New rule"),
    status: (value.status as RuleStatus) || "Draft",
    updatedAt: new Date().toISOString(),
  };
}

function RuleBuilder({
  conditions,
  operator,
  setConditions,
  setOperator,
}: {
  conditions: RuleCondition[];
  operator: RuleOperator;
  setConditions: (conditions: RuleCondition[]) => void;
  setOperator: (operator: RuleOperator) => void;
}) {
  function update(id: string, patch: Partial<RuleCondition>) {
    setConditions(conditions.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">Visual rule builder</p>
          <p className="text-sm text-slate-500">Compose nested conditions for eligibility routing.</p>
        </div>
        <Select className="w-28" onChange={(event) => setOperator(event.target.value as RuleOperator)} value={operator}>
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </Select>
      </div>
      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-[1fr_120px_1fr_auto]" key={condition.id}>
            <Input onChange={(event) => update(condition.id, { field: event.target.value })} placeholder="Field" value={condition.field} />
            <Select onChange={(event) => update(condition.id, { operator: event.target.value as RuleCondition["operator"] })} value={condition.operator}>
              {[">", ">=", "<", "<=", "=", "contains"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Input onChange={(event) => update(condition.id, { value: event.target.value })} placeholder="Value" value={condition.value} />
            <Button
              disabled={conditions.length === 1}
              onClick={() => setConditions(conditions.filter((item) => item.id !== condition.id))}
              type="button"
              variant="ghost"
            >
              Remove
            </Button>
            {index < conditions.length - 1 ? <Badge className="md:col-span-4" tone="blue">{operator}</Badge> : null}
          </div>
        ))}
      </div>
      <Button
        className="mt-3"
        onClick={() =>
          setConditions([
            ...conditions,
            { field: "Credit Score", id: makeId("cond"), operator: ">=", value: "700" },
          ])
        }
        type="button"
        variant="secondary"
      >
        <Plus className="h-4 w-4" />
        Add condition
      </Button>
    </div>
  );
}

const cibilBands: CibilScoreBand[] = ["Above 800", "751-800", "700-750", "Below 700"];
const genderOptions: GenderFilter[] = ["All", "Male", "Female"];

const cibilBandStyle: Record<CibilScoreBand, { pill: string; row: string; dot: string }> = {
  "Above 800": { pill: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100", row: "hover:bg-emerald-50/30", dot: "bg-emerald-500" },
  "751-800":   { pill: "bg-sky-50 text-sky-700 border-sky-200 ring-sky-100",             row: "hover:bg-sky-50/30",     dot: "bg-sky-500" },
  "700-750":   { pill: "bg-amber-50 text-amber-700 border-amber-200 ring-amber-100",     row: "hover:bg-amber-50/30",  dot: "bg-amber-500" },
  "Below 700": { pill: "bg-rose-50 text-rose-700 border-rose-200 ring-rose-100",         row: "hover:bg-rose-50/30",   dot: "bg-rose-500" },
};

const productEmoji: Record<string, string> = {
  "Home Loan": "🏠",
  "Loan Against Property": "🏢",
  "Personal Loan": "👤",
  "Business Loan": "💼",
  "Auto Loan": "🚗",
};

const slabFormFields: FieldConfig<LoanSlab>[] = [
  { label: "Scheme name", name: "schemeName", required: true },
  { label: "Product", name: "product", options: products, required: true, type: "select" },
  { label: "Max loan amount (₹)", name: "maxLoanAmount", required: true, type: "number" },
  { label: "CIBIL / Equifax score band", name: "cibilScoreBand", options: cibilBands, required: true, type: "select" },
  { label: "Gender", name: "gender", options: genderOptions, required: true, type: "select" },
  { label: "ROI Floating (%)", name: "roiFloating", required: true, type: "number" },
  { label: "ROI Fixed (%)", name: "roiFixed", required: true, type: "number" },
  { label: "Max loan period (months)", name: "maxLoanPeriodMonths", required: true, type: "number" },
];

function formatLoanAmount(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(0)} Lakhs`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function RoiBar({ value, min, max, color }: { value: number; min: number; max: number; color: string }) {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className={`w-11 text-right text-sm font-bold tabular-nums ${color}`}>{value.toFixed(2)}%</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color.replace("text-", "bg-")} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SlabsTab() {
  const { createItem, deleteItem, store, updateItem, currentUser } = useMockStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LoanSlab | null>(null);
  const [productFilter, setProductFilter] = useState<string>("");
  const [bandFilter, setBandFilter] = useState<string>("");

  const canEdit = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";

  const rows = store.loanSlabs.filter(
    (s) =>
      (!productFilter || s.product === productFilter) &&
      (!bandFilter || s.cibilScoreBand === bandFilter),
  );

  const grouped = rows.reduce<Record<string, LoanSlab[]>>((acc, slab) => {
    const key = `${slab.product}|||${slab.schemeName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(slab);
    return acc;
  }, {});

  function handleCreate(value: Partial<LoanSlab>) {
    createItem("loanSlabs", {
      id: makeId("slab"),
      schemeName: String(value.schemeName ?? "New Scheme"),
      product: (value.product as Product) || "Home Loan",
      maxLoanAmount: Number(value.maxLoanAmount ?? 5000000),
      cibilScoreBand: (value.cibilScoreBand as CibilScoreBand) || "700-750",
      gender: (value.gender as GenderFilter) || "All",
      roiFloating: Number(value.roiFloating ?? 8.5),
      roiFixed: Number(value.roiFixed ?? 9.5),
      maxLoanPeriodMonths: Number(value.maxLoanPeriodMonths ?? 240),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name ?? DEMO_USERS.admin.name,
    });
    setCreating(false);
  }

  function handleEdit(value: Partial<LoanSlab>) {
    if (!editing) return;
    updateItem("loanSlabs", editing.id, {
      ...value,
      maxLoanAmount: Number(value.maxLoanAmount ?? editing.maxLoanAmount),
      roiFloating: Number(value.roiFloating ?? editing.roiFloating),
      roiFixed: Number(value.roiFixed ?? editing.roiFixed),
      maxLoanPeriodMonths: Number(value.maxLoanPeriodMonths ?? editing.maxLoanPeriodMonths),
    });
    setEditing(null);
  }

  return (
    <div>
      {/* Read-only notice */}
      {!canEdit && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <Shield className="h-4 w-4 shrink-0" />
          <span>Read-only — contact a <strong>DSA Manager</strong> or <strong>DSA Credit</strong> to modify slabs.</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <option value="">All products</option>
            {products.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={bandFilter}
            onChange={(e) => setBandFilter(e.target.value)}
          >
            <option value="">All CIBIL bands</option>
            {cibilBands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)} id="add-slab-btn">
            <Plus className="h-4 w-4" />Add Slab
          </Button>
        )}
      </div>

      {/* Grouped table */}
      {Object.keys(grouped).length === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <div className="text-center">
            <Layers className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">No slabs match the current filter</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#1a2744] text-left text-xs font-semibold uppercase tracking-wide text-white">
                <th className="px-4 py-3">Scheme / Product</th>
                <th className="px-4 py-3">Max Loan</th>
                <th className="px-4 py-3">CIBIL Band</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3 text-orange-300">ROI Float.</th>
                <th className="px-4 py-3 text-orange-300">ROI Fixed</th>
                <th className="px-4 py-3">Max Tenure</th>
                {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(grouped).map(([groupKey, slabs]) => {
                const [productName, schemeName] = groupKey.split("|||");
                return (
                  <>
                    <tr key={`h-${groupKey}`} className="bg-slate-50">
                      <td colSpan={canEdit ? 8 : 7} className="px-4 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <Layers className="h-3 w-3 text-blue-500" />
                          {schemeName}
                          <span className="font-normal text-slate-400">— {productName}</span>
                        </span>
                      </td>
                    </tr>
                    {slabs.map((slab) => {
                      const style = cibilBandStyle[slab.cibilScoreBand];
                      return (
                        <tr key={slab.id} className="transition-colors hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 text-slate-500 text-xs">{slab.schemeName}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{formatLoanAmount(slab.maxLoanAmount)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${style.pill}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              {slab.cibilScoreBand}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{slab.gender}</td>
                          <td className="px-4 py-2.5 font-semibold text-blue-600 tabular-nums">{slab.roiFloating.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 font-semibold text-indigo-600 tabular-nums">{slab.roiFixed.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{slab.maxLoanPeriodMonths} mo</td>
                          {canEdit && (
                            <td className="px-4 py-2.5 text-right">
                              <ActionPair onDelete={() => deleteItem("loanSlabs", slab.id)} onEdit={() => setEditing(slab)} />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal onClose={() => setCreating(false)} open={creating} title="Add new slab" width="max-w-2xl">
        <RecordForm<LoanSlab>
          fields={slabFormFields}
          initialValue={{ product: "Home Loan", cibilScoreBand: "700-750", gender: "All", maxLoanPeriodMonths: 240 }}
          onCancel={() => setCreating(false)}
          onSubmit={handleCreate}
          submitLabel="Add slab"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit slab" width="max-w-2xl">
        {editing ? (
          <RecordForm<LoanSlab>
            fields={slabFormFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={handleEdit}
            submitLabel="Save slab"
          />
        ) : null}
      </Modal>
    </div>
  );
}


export function BreRulesPage() {
  return (
    <div>
      <PageHeader
        description="Configure scheme-wise ROI slab configuration for loan products."
        eyebrow="Business rule engine"
        title="BRE Configuration"
      />
      <SlabsTab />
    </div>
  );
}


export function VerificationPage() {
  const { createItem, deleteItem, store, updateItem, currentUser } = useMockStore();
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<VerificationCheck | null>(null);
  const [creating, setCreating] = useState(false);
  const rows = status ? store.verificationChecks.filter((item) => item.status === status) : store.verificationChecks;

  const columns: Column<VerificationCheck>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.checkId}</span>, header: "Check", key: "checkId" },
    { cell: (item) => item.applicationId, header: "Application", key: "applicationId" },
    { cell: (item) => item.customer, header: "Customer", key: "customer", sortable: true, sortValue: (item) => item.customer },
    { cell: (item) => item.type, header: "Type", key: "type" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => item.assignedTo, header: "Owner", key: "assignedTo" },
    { cell: (item) => formatDate(item.dueDate), header: "Due", key: "dueDate" },
  ];

  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New Check</Button>}
        description="Manage KYC, address, employment, and bank checks with evidence tracking and status ownership."
        eyebrow="Operations"
        title="Verification Center"
      />
      <DataTable
        actions={(item) => <ActionPair onDelete={() => deleteItem("verificationChecks", item.id)} onEdit={() => setEditing(item)} />}
        columns={columns}
        filters={[{ label: "status", onChange: setStatus, options: verificationStatuses, value: status }]}
        items={rows}
        searchKeys={["checkId", "applicationId", "customer", "assignedTo", "evidence"]}
      />
      <Modal onClose={() => setCreating(false)} open={creating} title="Create verification check">
        <RecordForm<VerificationCheck>
          fields={verificationFields}
          initialValue={{ status: "Pending", type: "KYC" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("verificationChecks", {
              applicationId: String(value.applicationId ?? ""),
              assignedTo: String(value.assignedTo ?? currentUser?.name ?? DEMO_USERS.admin.name),
              checkId: `VER-${Date.now().toString().slice(-5)}`,
              customer: String(value.customer ?? "Customer"),
              dueDate: String(value.dueDate ?? new Date().toISOString()),
              evidence: String(value.evidence ?? ""),
              id: makeId("ver"),
              status: (value.status as VerificationStatus) || "Pending",
              type: (value.type as VerificationCheck["type"]) || "KYC",
            });
            setCreating(false);
          }}
          submitLabel="Create check"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit verification check">
        {editing ? (
          <RecordForm<VerificationCheck>
            fields={verificationFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("verificationChecks", editing.id, value);
              setEditing(null);
            }}
            submitLabel="Save check"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function DocumentsPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [preview, setPreview] = useState<DocumentRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DocumentRecord | null>(null);

  const columns: Column<DocumentRecord>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.documentId}</span>, header: "Document", key: "documentId" },
    { cell: (item) => item.ownerName, header: "Owner", key: "ownerName", sortable: true, sortValue: (item) => item.ownerName },
    { cell: (item) => item.type, header: "Type", key: "type" },
    { cell: (item) => item.fileName, header: "File", key: "fileName" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => formatDate(item.uploadedAt), header: "Uploaded", key: "uploadedAt" },
  ];

  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><FileUp className="h-4 w-4" />Upload Simulation</Button>}
        description="Simulate upload, preview document packages, update statuses, and track operational remarks."
        eyebrow="Operations"
        title="Document Management"
      />
      <DataTable
        actions={(item) => (
          <ActionPair
            onDelete={() => deleteItem("documents", item.id)}
            onEdit={() => setEditing(item)}
            onView={() => setPreview(item)}
          />
        )}
        columns={columns}
        items={store.documents}
        searchKeys={["documentId", "ownerName", "fileName", "remarks", "type"]}
      />
      <Modal onClose={() => setPreview(null)} open={Boolean(preview)} title="Document preview">
        {preview ? (
          <div className="space-y-4">
            <div className="grid min-h-80 place-items-center rounded-lg border border-slate-200 bg-slate-50">
              <div className="text-center">
                <Eye className="mx-auto h-10 w-10 text-blue-600" />
                <p className="mt-3 font-semibold text-slate-950">{preview.fileName}</p>
                <p className="text-sm text-slate-500">Simulated secure preview · {preview.size}</p>
              </div>
            </div>
            <DetailGrid>
              <DetailItem label="Owner" value={preview.ownerName} />
              <DetailItem label="Type" value={preview.type} />
              <DetailItem label="Status" value={<StatusBadge status={preview.status} />} />
              <DetailItem label="Remarks" value={preview.remarks} />
            </DetailGrid>
          </div>
        ) : null}
      </Modal>
      <Modal onClose={() => setCreating(false)} open={creating} title="Upload document">
        <RecordForm<DocumentRecord>
          fields={documentFields}
          initialValue={{ fileName: "customer-document.pdf", status: "Pending", type: "PAN" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("documents", {
              documentId: `DOC-${Date.now().toString().slice(-5)}`,
              fileName: String(value.fileName ?? "document.pdf"),
              id: makeId("doc"),
              ownerName: String(value.ownerName ?? "Customer"),
              remarks: String(value.remarks ?? "Uploaded through simulation"),
              size: "248 KB",
              status: (value.status as VerificationStatus) || "Pending",
              type: (value.type as DocumentType) || "PAN",
              uploadedAt: new Date().toISOString(),
            });
            setCreating(false);
          }}
          submitLabel="Upload"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit document">
        {editing ? (
          <RecordForm<DocumentRecord>
            fields={documentFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("documents", editing.id, value);
              setEditing(null);
            }}
            submitLabel="Save document"
          />
        ) : null}
      </Modal>
    </div>
  );
}

export function ApprovalWorkflowPage() {
  const { createItem, deleteItem, store, updateItem, currentUser } = useMockStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ApprovalItem | null>(null);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);

  function applyDecision(decision: "approve" | "return" | "reject") {
    if (!selected) return;
    const stageIndex = approvalStages.indexOf(selected.stage);
    const nextStage =
      decision === "approve"
        ? approvalStages[Math.min(approvalStages.length - 1, stageIndex + 1)]
        : decision === "return"
          ? approvalStages[Math.max(0, stageIndex - 1)]
          : selected.stage;
    const status: ApprovalStatus =
      decision === "reject"
        ? "Rejected"
        : decision === "return"
          ? "Returned"
          : stageIndex === approvalStages.length - 1
            ? "Approved"
            : "Pending";
    const updatedAt = new Date().toISOString();
    const history = [
      {
        actor: currentUser?.name ?? DEMO_USERS.admin.name,
        at: updatedAt,
        id: makeId("tl"),
        note:
          decision === "approve"
            ? stageIndex === approvalStages.length - 1
              ? "Final approval completed."
              : `Approved and advanced to ${nextStage}.`
            : decision === "return"
              ? `Returned to ${nextStage} for clarification.`
              : "Workflow rejected after review.",
        title:
          decision === "approve"
            ? "Stage approved"
            : decision === "return"
              ? "Workflow returned"
              : "Workflow rejected",
      },
      ...selected.history,
    ];
    const patch = { history, stage: nextStage, status, updatedAt };
    updateItem("approvals", selected.id, patch);
    setSelected({ ...selected, ...patch });
  }

  const columns: Column<ApprovalItem>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.workflowId}</span>, header: "Workflow", key: "workflowId" },
    { cell: (item) => item.applicationId, header: "Application", key: "applicationId" },
    { cell: (item) => item.customer, header: "Customer", key: "customer" },
    { cell: (item) => item.stage, header: "Stage", key: "stage" },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => item.approver, header: "Approver", key: "approver" },
    { cell: (item) => formatDate(item.updatedAt), header: "Updated", key: "updatedAt" },
  ];

  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New Workflow</Button>}
        description="Run maker-checker-risk-final approval decisions with history, stage actions, and workflow visibility."
        eyebrow="Operations"
        title="Approval Workflow"
      />
      <Card className="mb-6">
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            {approvalStages.map((stage, index) => (
              <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4" key={stage}>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-sm font-semibold text-white">{index + 1}</span>
                  <div>
                    <p className="font-semibold text-slate-950">{stage}</p>
                    <p className="text-xs text-slate-500">{store.approvals.filter((item) => item.stage === stage).length} workflows</p>
                  </div>
                </div>
                {index < approvalStages.length - 1 ? <GitBranch className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-300 md:block" /> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <DataTable
        actions={(item) => (
          <ActionPair
            onDelete={() => deleteItem("approvals", item.id)}
            onEdit={() => setEditing(item)}
            onView={() => setSelected(item)}
          />
        )}
        columns={columns}
        items={store.approvals}
        searchKeys={["workflowId", "applicationId", "customer", "approver", "stage"]}
      />
      <Drawer
        description={selected ? `${selected.applicationId} · ${selected.customer}` : undefined}
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title={selected?.workflowId ?? "Approval workflow"}
      >
        {selected ? (
          <div className="space-y-5">
            <DetailGrid>
              <DetailItem label="Stage" value={selected.stage} />
              <DetailItem label="Status" value={<StatusBadge status={selected.status} />} />
              <DetailItem label="Approver" value={selected.approver} />
              <DetailItem label="Updated" value={formatDate(selected.updatedAt)} />
            </DetailGrid>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button onClick={() => applyDecision("approve")} type="button">
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button onClick={() => applyDecision("return")} type="button" variant="secondary">
                <RotateCcw className="h-4 w-4" />
                Return
              </Button>
              <Button onClick={() => applyDecision("reject")} type="button" variant="danger">
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-950">Workflow history</h3>
              <div className="space-y-3">
                {selected.history.map((item) => (
                  <div className="border-l-2 border-blue-100 pl-3" key={item.id}>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.actor} · {formatDate(item.at)}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
      <Modal onClose={() => setCreating(false)} open={creating} title="Create workflow">
        <RecordForm<ApprovalItem>
          fields={approvalFields}
          initialValue={{ stage: "Maker", status: "Pending" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("approvals", {
              applicationId: String(value.applicationId ?? ""),
              approver: String(value.approver ?? currentUser?.name ?? DEMO_USERS.admin.name),
              customer: String(value.customer ?? "Customer"),
              history: [
                {
                  actor: currentUser?.name ?? DEMO_USERS.admin.name,
                  at: new Date().toISOString(),
                  id: makeId("tl"),
                  note: "Workflow created.",
                  title: "Workflow initiated",
                },
              ],
              id: makeId("approval"),
              stage: (value.stage as ApprovalStage) || "Maker",
              status: (value.status as ApprovalStatus) || "Pending",
              updatedAt: new Date().toISOString(),
              workflowId: `WF-${Date.now().toString().slice(-5)}`,
            });
            setCreating(false);
          }}
          submitLabel="Create workflow"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit workflow">
        {editing ? (
          <RecordForm<ApprovalItem>
            fields={approvalFields}
            initialValue={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(value) => {
              updateItem("approvals", editing.id, {
                ...value,
                updatedAt: new Date().toISOString(),
              });
              setEditing(null);
            }}
            submitLabel="Save workflow"
          />
        ) : null}
      </Modal>
    </div>
  );
}
