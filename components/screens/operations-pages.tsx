"use client";

import { CheckCircle2, Eye, FileUp, GitBranch, Plus, RotateCcw, XCircle } from "lucide-react";
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
import { useMockStore } from "@/lib/store";
import {
  ApprovalItem,
  ApprovalStage,
  ApprovalStatus,
  BreRule,
  DocumentRecord,
  DocumentType,
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

export function BreRulesPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BreRule | null>(null);
  const [conditions, setConditions] = useState<RuleCondition[]>([
    { field: "Age", id: "new-cond-1", operator: ">", value: "21" },
    { field: "Salary", id: "new-cond-2", operator: ">", value: "25000" },
  ]);
  const [operator, setOperator] = useState<RuleOperator>("AND");

  const columns: Column<BreRule>[] = [
    { cell: (item) => <span className="font-semibold text-slate-950">{item.ruleName}</span>, header: "Rule", key: "ruleName", sortable: true, sortValue: (item) => item.ruleName },
    { cell: (item) => item.ruleCode, header: "Code", key: "ruleCode" },
    { cell: (item) => item.product, header: "Product", key: "product" },
    { cell: (item) => item.priority, header: "Priority", key: "priority", sortable: true, sortValue: (item) => item.priority },
    { cell: (item) => <StatusBadge status={item.status} />, header: "Status", key: "status" },
    { cell: (item) => `${item.operator} · ${item.conditions.length} conditions`, header: "Builder", key: "builder" },
  ];

  return (
    <div>
      <PageHeader
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New Rule</Button>}
        description="Configure product eligibility logic with priority, status, and a nested visual rule builder."
        eyebrow="Business rule engine"
        title="BRE Configuration"
      />
      <DataTable
        actions={(item) => <ActionPair onDelete={() => deleteItem("breRules", item.id)} onEdit={() => setEditing(item)} />}
        columns={columns}
        items={store.breRules}
        searchKeys={["ruleName", "ruleCode", "product", "outcome"]}
      />
      <Modal onClose={() => setCreating(false)} open={creating} title="Create BRE rule" width="max-w-4xl">
        <RuleBuilder conditions={conditions} operator={operator} setConditions={setConditions} setOperator={setOperator} />
        <RecordForm<BreRule>
          fields={ruleFields}
          initialValue={{ outcome: "Route to risk", product: "Personal Loan", status: "Draft" }}
          onCancel={() => setCreating(false)}
          onSubmit={(value) => {
            createItem("breRules", newRule(value, conditions, operator));
            setCreating(false);
          }}
          submitLabel="Create rule"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit BRE rule" width="max-w-4xl">
        {editing ? (
          <>
            <RuleBuilder
              conditions={editing.conditions}
              operator={editing.operator}
              setConditions={(next) => setEditing({ ...editing, conditions: next })}
              setOperator={(next) => setEditing({ ...editing, operator: next })}
            />
            <RecordForm<BreRule>
              fields={ruleFields}
              initialValue={editing}
              onCancel={() => setEditing(null)}
              onSubmit={(value) => {
                updateItem("breRules", editing.id, {
                  ...value,
                  conditions: editing.conditions,
                  operator: editing.operator,
                  priority: Number(value.priority ?? editing.priority),
                  updatedAt: new Date().toISOString(),
                });
                setEditing(null);
              }}
              submitLabel="Save rule"
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}

export function VerificationPage() {
  const { createItem, deleteItem, store, updateItem } = useMockStore();
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
              assignedTo: String(value.assignedTo ?? "Aditi Rao"),
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
  const { createItem, deleteItem, store, updateItem } = useMockStore();
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
        actor: "Aditi Rao",
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
              approver: String(value.approver ?? "Aditi Rao"),
              customer: String(value.customer ?? "Customer"),
              history: [
                {
                  actor: "Aditi Rao",
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
