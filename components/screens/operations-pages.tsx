"use client";

import { Fragment, useState } from "react";
import { Layers, Plus, Shield } from "lucide-react";

import { ActionPair, PageHeader } from "@/components/module";
import { Button, Modal } from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { DEMO_USERS } from "@/lib/demo-identities";
import { useMockStore } from "@/lib/store";
import { CibilScoreBand, GenderFilter, LoanSlab, Product } from "@/lib/types";
import { makeId } from "@/lib/utils";

const products: Product[] = [
  "Personal Loan",
  "Home Loan",
  "Loan Against Property",
  "Business Loan",
  "Auto Loan",
];

const cibilBands: CibilScoreBand[] = ["Above 800", "751-800", "700-750", "Below 700"];
const genderOptions: GenderFilter[] = ["All", "Male", "Female"];

const cibilBandStyle: Record<CibilScoreBand, { pill: string; dot: string }> = {
  "Above 800": { dot: "bg-emerald-500", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-100" },
  "751-800": { dot: "bg-sky-500", pill: "border-sky-200 bg-sky-50 text-sky-700 ring-sky-100" },
  "700-750": { dot: "bg-amber-500", pill: "border-amber-200 bg-amber-50 text-amber-700 ring-amber-100" },
  "Below 700": { dot: "bg-rose-500", pill: "border-rose-200 bg-rose-50 text-rose-700 ring-rose-100" },
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

function formatLoanAmount(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(0)} Lakhs`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function SlabsTab() {
  const { createItem, deleteItem, store, updateItem, currentUser } = useMockStore();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LoanSlab | null>(null);
  const [productFilter, setProductFilter] = useState("");
  const [bandFilter, setBandFilter] = useState("");

  const canEdit = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";
  const rows = store.loanSlabs.filter(
    (slab) => (!productFilter || slab.product === productFilter) && (!bandFilter || slab.cibilScoreBand === bandFilter),
  );
  const grouped = rows.reduce<Record<string, LoanSlab[]>>((acc, slab) => {
    const key = `${slab.product}|||${slab.schemeName}`;
    acc[key] = [...(acc[key] ?? []), slab];
    return acc;
  }, {});

  function handleCreate(value: Partial<LoanSlab>) {
    createItem("loanSlabs", {
      cibilScoreBand: (value.cibilScoreBand as CibilScoreBand) || "700-750",
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name ?? DEMO_USERS.admin.name,
      gender: (value.gender as GenderFilter) || "All",
      id: makeId("slab"),
      maxLoanAmount: Number(value.maxLoanAmount ?? 5000000),
      maxLoanPeriodMonths: Number(value.maxLoanPeriodMonths ?? 240),
      product: (value.product as Product) || "Home Loan",
      roiFixed: Number(value.roiFixed ?? 9.5),
      roiFloating: Number(value.roiFloating ?? 8.5),
      schemeName: String(value.schemeName ?? "New Scheme"),
    });
    setCreating(false);
  }

  function handleEdit(value: Partial<LoanSlab>) {
    if (!editing) return;
    updateItem("loanSlabs", editing.id, {
      ...value,
      maxLoanAmount: Number(value.maxLoanAmount ?? editing.maxLoanAmount),
      maxLoanPeriodMonths: Number(value.maxLoanPeriodMonths ?? editing.maxLoanPeriodMonths),
      roiFixed: Number(value.roiFixed ?? editing.roiFixed),
      roiFloating: Number(value.roiFloating ?? editing.roiFloating),
    });
    setEditing(null);
  }

  return (
    <div>
      {!canEdit ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <Shield className="h-4 w-4 shrink-0" />
          <span>
            Read-only — contact a <strong>DSA Manager</strong> or <strong>DSA Credit</strong> to modify slabs.
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(event) => setProductFilter(event.target.value)}
            value={productFilter}
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(event) => setBandFilter(event.target.value)}
            value={bandFilter}
          >
            <option value="">All CIBIL bands</option>
            {cibilBands.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </select>
        </div>
        {canEdit ? (
          <Button id="add-slab-btn" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Add Slab
          </Button>
        ) : null}
      </div>

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
                {canEdit ? <th className="px-4 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(grouped).map(([groupKey, slabs]) => {
                const [productName, schemeName] = groupKey.split("|||");
                return (
                  <Fragment key={groupKey}>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-1.5" colSpan={canEdit ? 8 : 7}>
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
                        <tr className="transition-colors hover:bg-slate-50/70" key={slab.id}>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{slab.schemeName}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{formatLoanAmount(slab.maxLoanAmount)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${style.pill}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              {slab.cibilScoreBand}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{slab.gender}</td>
                          <td className="px-4 py-2.5 font-semibold tabular-nums text-blue-600">{slab.roiFloating.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 font-semibold tabular-nums text-indigo-600">{slab.roiFixed.toFixed(2)}%</td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{slab.maxLoanPeriodMonths} mo</td>
                          {canEdit ? (
                            <td className="px-4 py-2.5 text-right">
                              <ActionPair onDelete={() => deleteItem("loanSlabs", slab.id)} onEdit={() => setEditing(slab)} />
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal onClose={() => setCreating(false)} open={creating} title="Add new slab" width="max-w-2xl">
        <RecordForm<LoanSlab>
          fields={slabFormFields}
          initialValue={{ cibilScoreBand: "700-750", gender: "All", maxLoanPeriodMonths: 240, product: "Home Loan" }}
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
