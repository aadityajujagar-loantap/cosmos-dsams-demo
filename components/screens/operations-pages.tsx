"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Layers, Plus, Shield } from "lucide-react";

import { ActionPair, PageHeader } from "@/components/module";
import { Button, Modal } from "@/components/ui/primitives";
import { FieldConfig, RecordForm } from "@/components/ui/record-form";
import { adminApi } from "@/apis/admin";
import { useToast } from "@/components/ui/toast";
import { DEMO_USERS } from "@/lib/demo-identities";
import { useMockStore } from "@/lib/store";
import { CibilScoreBand, GenderFilter, LoanSlab, Product } from "@/lib/types";
import { makeId } from "@/lib/utils";

const cibilBands: CibilScoreBand[] = ["Above 800", "751-800", "700-750", "Below 700"];
const genderOptions: GenderFilter[] = ["All", "Male", "Female"];

const cibilBandStyle: Record<CibilScoreBand, { pill: string; dot: string }> = {
  "Above 800": { dot: "bg-emerald-500", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-100" },
  "751-800": { dot: "bg-sky-500", pill: "border-sky-200 bg-sky-50 text-sky-700 ring-sky-100" },
  "700-750": { dot: "bg-amber-500", pill: "border-amber-200 bg-amber-50 text-amber-700 ring-amber-100" },
  "Below 700": { dot: "bg-rose-500", pill: "border-rose-200 bg-rose-50 text-rose-700 ring-rose-100" },
};

function formatLoanAmount(amount: number) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(0)} Lakhs`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function SlabsTab() {
  const [slabsList, setSlabsList] = useState<LoanSlab[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LoanSlab | null>(null);
  const [productFilter, setProductFilter] = useState("");
  const [bandFilter, setBandFilter] = useState("");

  const { store, currentUser } = useMockStore();
  const { toast } = useToast();

  const mapCibilToScoreBand = (band: string) => {
    if (band === "Above 800") return { operator: "gt" as const, value1: 800, value2: null, label: "> 800" };
    if (band === "751-800") return { operator: "between" as const, value1: 751, value2: 800, label: "751-800" };
    if (band === "700-750") return { operator: "between" as const, value1: 700, value2: 750, label: "700-750" };
    return { operator: "lt" as const, value1: 700, value2: null, label: "< 700" };
  };

  const mapBackendSlabToFrontend = (slab: any, schemeName: string, productName: string): LoanSlab => {
    const scoreBandLabel = slab.score_band?.label || slab.score_band_label || "700-750";
    let cibilBand: CibilScoreBand = "700-750";
    if (scoreBandLabel.includes("800") && (scoreBandLabel.includes(">") || scoreBandLabel.includes("Above"))) {
      cibilBand = "Above 800";
    } else if (scoreBandLabel.includes("751")) {
      cibilBand = "751-800";
    } else if (scoreBandLabel.includes("700")) {
      cibilBand = "700-750";
    } else {
      cibilBand = "Below 700";
    }

    return {
      id: String(slab.id),
      schemeName: schemeName,
      product: productName as any,
      maxLoanAmount: (slab.max_loan_amount_val || 0) * 100000,
      cibilScoreBand: cibilBand,
      gender: slab.gender === "Both" ? "All" : slab.gender,
      roiFloating: Number(slab.roi_floating_pct || 0),
      roiFixed: Number(slab.roi_fixed_pct || 0),
      maxLoanPeriodMonths: Number(slab.max_period_months || 0),
      createdAt: slab.created_at || new Date().toISOString(),
      createdBy: slab.created_by_name || "System",
    };
  };

  const loadSlabs = useCallback(async () => {
    setLoading(true);
    try {
      const prodRes = await adminApi.getProductsList();
      setProducts(prodRes.data);
      
      const response = await adminApi.getAllProductSlabs();
      const productsWithSlabs = response.data || [];
      const allSlabs: LoanSlab[] = [];

      productsWithSlabs.forEach((prod: any) => {
        const schemesData = prod.schemes || [];
        schemesData.forEach((sch: any) => {
          const slabsData = sch.slabs || [];
          slabsData.forEach((sl: any) => {
            allSlabs.push(mapBackendSlabToFrontend(sl, sch.name, prod.name));
          });
        });
      });

      setSlabsList(allSlabs);
    } catch (e) {
      console.error("Failed to load products/slabs:", e);
      toast({
        title: "Load Failed",
        description: "Failed to load product configurations.",
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSlabs();
  }, [loadSlabs]);

  const canEdit = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";
  const rows = slabsList.filter(
    (slab) => (!productFilter || slab.product === productFilter) && (!bandFilter || slab.cibilScoreBand === bandFilter),
  );
  const grouped = rows.reduce<Record<string, LoanSlab[]>>((acc, slab) => {
    const key = `${slab.product}|||${slab.schemeName}`;
    acc[key] = [...(acc[key] ?? []), slab];
    return acc;
  }, {});

  async function handleCreate(value: Partial<LoanSlab>) {
    try {
      const prodObj = products.find(p => p.name === value.product);
      if (!prodObj) {
        toast({ title: "Error", description: `Product ${value.product} not found in database.`, variant: "warning" });
        return;
      }

      const schemeRes = await adminApi.getSchemes(prodObj.id);
      let schemeObj = schemeRes.data.find(s => s.name === value.schemeName);
      if (!schemeObj) {
        schemeObj = await adminApi.createScheme(prodObj.id, {
          name: value.schemeName,
          maker_comment: "Auto-created scheme during slab addition."
        }).then(r => r.data);
      }

      if (!schemeObj) {
        toast({ title: "Error", description: "Failed to resolve or create loan scheme.", variant: "warning" });
        return;
      }

      await adminApi.createSchemeSlab(schemeObj.id, {
        slab_label: `Upto Rs. ${Number(value.maxLoanAmount) / 100000} Lakhs`,
        max_loan_amount: `Rs. ${Number(value.maxLoanAmount) / 100000} Lakhs`,
        max_loan_amount_val: Number(value.maxLoanAmount) / 100000,
        score_band: mapCibilToScoreBand(value.cibilScoreBand || "700-750"),
        gender: value.gender === "All" ? "Both" : value.gender as any,
        roi_floating_pct: Number(value.roiFloating),
        roi_fixed_pct: Number(value.roiFixed),
        max_period_months: Number(value.maxLoanPeriodMonths),
        maker_comment: "Adding scheme slab from admin panel."
      });

      toast({
        title: "Submitted to Checker",
        description: "Slab creation request submitted successfully for approval.",
        variant: "success",
      });
      loadSlabs();
      setCreating(false);
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit slab creation request.",
        variant: "warning",
      });
    }
  }

  async function handleEdit(value: Partial<LoanSlab>) {
    if (!editing) return;
    try {
      await adminApi.updateSchemeSlab(Number(editing.id), {
        slab_label: `Upto Rs. ${Number(value.maxLoanAmount) / 100000} Lakhs`,
        max_loan_amount: `Rs. ${Number(value.maxLoanAmount) / 100000} Lakhs`,
        max_loan_amount_val: Number(value.maxLoanAmount) / 100000,
        score_band: mapCibilToScoreBand(value.cibilScoreBand || "700-750"),
        gender: value.gender === "All" ? "Both" : value.gender as any,
        roi_floating_pct: Number(value.roiFloating),
        roi_fixed_pct: Number(value.roiFixed),
        max_period_months: Number(value.maxLoanPeriodMonths),
        maker_comment: "Updating scheme slab from admin panel."
      });

      toast({
        title: "Submitted to Checker",
        description: "Slab update request submitted successfully for approval.",
        variant: "success",
      });
      loadSlabs();
      setEditing(null);
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit slab update request.",
        variant: "warning",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await adminApi.deleteSchemeSlab(Number(id));
      toast({
        title: "Submitted to Checker",
        description: "Slab deletion request submitted successfully for approval.",
        variant: "success",
      });
      loadSlabs();
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit slab delete request.",
        variant: "warning",
      });
    }
  }

  const dynamicSlabFormFields: FieldConfig<LoanSlab>[] = [
    { label: "Scheme name", name: "schemeName", required: true },
    {
      label: "Product",
      name: "product",
      options: products.length
        ? products.map((p) => p.name)
        : ["Home Loan", "Personal Loan", "Loan Against Property", "Business Loan", "Auto Loan"],
      required: true,
      type: "select",
    },
    { label: "Max loan amount (₹)", name: "maxLoanAmount", required: true, type: "number" },
    { label: "CIBIL / Equifax score band", name: "cibilScoreBand", options: cibilBands, required: true, type: "select" },
    { label: "Gender", name: "gender", options: genderOptions, required: true, type: "select" },
    { label: "ROI Floating (%)", name: "roiFloating", required: true, type: "number" },
    { label: "ROI Fixed (%)", name: "roiFixed", required: true, type: "number" },
    { label: "Max loan period (months)", name: "maxLoanPeriodMonths", required: true, type: "number" },
  ];

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
              <option key={product.id} value={product.name}>
                {product.name}
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

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
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
                              <ActionPair onDelete={() => handleDelete(slab.id)} onEdit={() => setEditing(slab)} />
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
          fields={dynamicSlabFormFields}
          initialValue={{ cibilScoreBand: "700-750", gender: "All", maxLoanPeriodMonths: 240, product: "Home Loan" }}
          onCancel={() => setCreating(false)}
          onSubmit={handleCreate}
          submitLabel="Add slab"
        />
      </Modal>
      <Modal onClose={() => setEditing(null)} open={Boolean(editing)} title="Edit slab" width="max-w-2xl">
        {editing ? (
          <RecordForm<LoanSlab>
            fields={dynamicSlabFormFields}
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

function ProductsTab() {
  const [productsList, setProductsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [creatingScheme, setCreatingScheme] = useState(false);

  const { store, currentUser } = useMockStore();
  const { toast } = useToast();

  const loadProductsAndSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const prodRes = await adminApi.getProducts();
      const prodsWithSchemes = [];
      for (const prod of prodRes.data) {
        try {
          const schemeRes = await adminApi.getSchemes(prod.id);
          prodsWithSchemes.push({
            ...prod,
            schemes: schemeRes.data || [],
          });
        } catch (e) {
          prodsWithSchemes.push({
            ...prod,
            schemes: [],
          });
        }
      }
      setProductsList(prodsWithSchemes);
    } catch (e) {
      console.error("Failed to load products/schemes:", e);
      toast({
        title: "Load Failed",
        description: "Failed to load loan products list.",
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProductsAndSchemes();
  }, [loadProductsAndSchemes]);

  const productFormFields: FieldConfig<any>[] = [
    { label: "Product Name", name: "name", required: true },
    { label: "Min Age (Salaried)", name: "min_age_salaried", required: true, type: "number" },
    { label: "Max Age (Salaried)", name: "max_age_salaried", required: true, type: "number" },
    { label: "Min Age (Self-Employed)", name: "min_age_self_emp", required: true, type: "number" },
    { label: "Max Age (Self-Employed)", name: "max_age_self_emp", required: true, type: "number" },
    { label: "Submission Notes / Remark", name: "maker_comment", required: false },
  ];

  const schemeFormFields: FieldConfig<any>[] = [
    {
      label: "Select Product",
      name: "productName",
      options: productsList.map(p => p.name),
      required: true,
      type: "select"
    },
    { label: "Scheme Name", name: "name", required: true },
    { label: "Submission Notes / Remark", name: "maker_comment", required: false },
  ];

  async function handleCreateProduct(value: any) {
    try {
      await adminApi.createProduct({
        name: value.name,
        min_age_salaried: Number(value.min_age_salaried || 21),
        max_age_salaried: Number(value.max_age_salaried || 60),
        min_age_self_emp: Number(value.min_age_self_emp || 25),
        max_age_self_emp: Number(value.max_age_self_emp || 65),
        maker_comment: value.maker_comment || "Creating loan product from administration dashboard."
      });

      toast({
        title: "Submitted to Checker",
        description: "Loan product creation request submitted successfully for approval.",
        variant: "success",
      });
      loadProductsAndSchemes();
      setCreatingProduct(false);
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit product creation request.",
        variant: "warning",
      });
    }
  }

  async function handleCreateScheme(value: any) {
    try {
      const selectedProd = productsList.find(p => p.name === value.productName);
      if (!selectedProd) {
        toast({ title: "Error", description: "Product not found.", variant: "warning" });
        return;
      }

      await adminApi.createScheme(selectedProd.id, {
        name: value.name,
        maker_comment: value.maker_comment || "Creating scheme from administration dashboard."
      });

      toast({
        title: "Submitted to Checker",
        description: "Scheme creation request submitted successfully for approval.",
        variant: "success",
      });
      loadProductsAndSchemes();
      setCreatingScheme(false);
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit scheme creation request.",
        variant: "warning",
      });
    }
  }

  const canEdit = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";

  return (
    <div>
      {!canEdit ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <Shield className="h-4 w-4 shrink-0" />
          <span>
            Read-only — contact a <strong>DSA Manager</strong> or <strong>DSA Credit</strong> to add products or schemes.
          </span>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2 justify-end">
        {canEdit ? (
          <>
            <Button id="add-product-btn" onClick={() => setCreatingProduct(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Loan Product
            </Button>
            <Button id="add-scheme-btn" onClick={() => setCreatingScheme(true)} variant="secondary">
              <Plus className="h-4 w-4 mr-1" /> Add Scheme
            </Button>
          </>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : productsList.length === 0 ? (
        <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
          <div className="text-center">
            <Layers className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-600">No products configured yet.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {productsList.map((prod) => (
            <div key={prod.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{prod.name}</h4>
                  <span className="text-[10px] text-slate-400">ID: {prod.id}</span>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                  prod.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : prod.status === "pending_approval"
                    ? "bg-amber-50 text-amber-700 border border-amber-100"
                    : "bg-slate-50 text-slate-700 border border-slate-100"
                }`}>
                  {prod.status || "active"}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Salaried Sourcing:</span>
                  <span className="font-semibold text-slate-700">{prod.min_age_salaried}-{prod.max_age_salaried} yrs</span>
                </div>
                <div className="flex justify-between">
                  <span>Self-Employed Sourcing:</span>
                  <span className="font-semibold text-slate-700">{prod.min_age_self_emp}-{prod.max_age_self_emp} yrs</span>
                </div>
              </div>

              <div className="space-y-2">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Configured Schemes</h5>
                {prod.schemes && prod.schemes.length > 0 ? (
                  <ul className="space-y-1.5">
                    {prod.schemes.map((sch: any) => (
                      <li key={sch.id} className="flex justify-between items-center bg-slate-50/60 rounded px-2.5 py-1 text-xs border border-slate-100">
                        <span className="font-medium text-slate-700">{sch.name}</span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {sch.status || "active"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs italic text-slate-400">No schemes configured.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      <Modal onClose={() => setCreatingProduct(false)} open={creatingProduct} title="Add New Loan Product" width="max-w-2xl">
        <RecordForm
          fields={productFormFields}
          initialValue={{ min_age_salaried: 21, max_age_salaried: 60, min_age_self_emp: 25, max_age_self_emp: 65 }}
          onCancel={() => setCreatingProduct(false)}
          onSubmit={handleCreateProduct}
          submitLabel="Create Product"
        />
      </Modal>

      {/* Add Scheme Modal */}
      <Modal onClose={() => setCreatingScheme(false)} open={creatingScheme} title="Add New Loan Scheme" width="max-w-2xl">
        <RecordForm
          fields={schemeFormFields}
          initialValue={{}}
          onCancel={() => setCreatingScheme(false)}
          onSubmit={handleCreateScheme}
          submitLabel="Create Scheme"
        />
      </Modal>
    </div>
  );
}

export function BreRulesPage() {
  const [activeTab, setActiveTab] = useState<"slabs" | "products">("slabs");

  return (
    <div className="space-y-6">
      <PageHeader
        description="Configure scheme-wise ROI slab configuration and manage loan products."
        eyebrow="Business rule engine"
        title="BRE Configuration"
      />

      <div className="border-b border-slate-200">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("slabs")}
            className={`border-b-2 py-3 text-sm font-medium transition-all ${
              activeTab === "slabs"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            ROI Slabs
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`border-b-2 py-3 text-sm font-medium transition-all ${
              activeTab === "products"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            Products & Schemes
          </button>
        </nav>
      </div>

      <div>
        {activeTab === "slabs" ? <SlabsTab /> : <ProductsTab />}
      </div>
    </div>
  );
}
