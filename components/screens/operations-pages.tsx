"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Layers, Plus, Shield, Edit, Trash2, AlertCircle, TrendingUp, Users, Calendar, Check, Send, X } from "lucide-react";

import { ActionPair, PageHeader } from "@/components/module";
import { Button, Modal, Select } from "@/components/ui/primitives";
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
  const [productFilter, setProductFilter] = useState("");
  const [bandFilter, setBandFilter] = useState("");

  // Modal and form states
  const [creating, setCreating] = useState(false);
  const [modalProductId, setModalProductId] = useState("");
  const [modalSchemeId, setModalSchemeId] = useState("");
  const [schemes, setSchemes] = useState<any[]>([]);
  const [slabLabel, setSlabLabel] = useState("");
  const [maxLoanAmount, setMaxLoanAmount] = useState("");
  const [scoreBand, setScoreBand] = useState("NA");
  const [gender, setGender] = useState("All");
  const [maxPeriodMonths, setMaxPeriodMonths] = useState("");
  const [roiFloating, setRoiFloating] = useState("");
  const [roiFixed, setRoiFixed] = useState("");
  const [ltvPct, setLtvPct] = useState("");
  const [foirPct, setFoirPct] = useState("");
  const [makerComment, setMakerComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { currentUser } = useMockStore();
  const { toast } = useToast();

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
      const prodRes = await adminApi.getProducts();
      setProducts(prodRes.data || []);
      
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

  // Load schemes under selected product in modal
  useEffect(() => {
    if (modalProductId) {
      adminApi.getSchemes(Number(modalProductId)).then((res) => {
        setSchemes(res.data || []);
        setModalSchemeId("");
      });
    } else {
      setSchemes([]);
      setModalSchemeId("");
    }
  }, [modalProductId]);

  const canEdit = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";

  const rows = slabsList.filter(
    (slab) => (!productFilter || slab.product === productFilter) && (!bandFilter || slab.cibilScoreBand === bandFilter),
  );
  const grouped = rows.reduce<Record<string, LoanSlab[]>>((acc, slab) => {
    const key = `${slab.product}|||${slab.schemeName}`;
    acc[key] = [...(acc[key] ?? []), slab];
    return acc;
  }, {});

  const handleCreateSlab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSchemeId || !slabLabel || !maxLoanAmount) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const mapCibilToScoreBandObj = (band: string) => {
        if (band === "Above 800") return { operator: "gt" as const, value1: 800, value2: null, label: "> 800" };
        if (band === "751 - 800") return { operator: "between" as const, value1: 751, value2: 800, label: "751-800" };
        if (band === "700 - 750") return { operator: "between" as const, value1: 700, value2: 750, label: "700-750" };
        if (band === "Below 700") return { operator: "lt" as const, value1: 700, value2: null, label: "< 700" };
        return { operator: "NA" as const, value1: null, value2: null, label: "NA" };
      };

      const payload = {
        slab_label: slabLabel,
        max_loan_amount: `Rs. ${Number(maxLoanAmount) / 100000} Lakhs`,
        max_loan_amount_val: Number(maxLoanAmount) / 100000,
        score_band: mapCibilToScoreBandObj(scoreBand),
        location: "india" as const,
        gender: (gender === "All" ? "Both" : gender) as any,
        roi_floating_pct: roiFloating ? Number(roiFloating) : null,
        roi_fixed_pct: roiFixed ? Number(roiFixed) : null,
        max_period_months: maxPeriodMonths ? Number(maxPeriodMonths) : null,
        ltv_pct: ltvPct ? Number(ltvPct) : null,
        foir_pct: foirPct ? Number(foirPct) : null,
        maker_comment: makerComment || "Creating new slab entry",
      };

      await adminApi.createSchemeSlab(Number(modalSchemeId), payload);

      toast({
        title: "Submitted to Checker",
        description: "Slab entry creation request submitted successfully for approval.",
        variant: "success",
      });

      setCreating(false);
      resetForm();
      loadSlabs();
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit slab creation request.",
        variant: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setModalProductId("");
    setModalSchemeId("");
    setSlabLabel("");
    setMaxLoanAmount("");
    setScoreBand("NA");
    setGender("All");
    setMaxPeriodMonths("");
    setRoiFloating("");
    setRoiFixed("");
    setLtvPct("");
    setFoirPct("");
    setMakerComment("");
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Select
            className="w-44"
            onChange={(event) => setProductFilter(event.target.value)}
            value={productFilter}
          >
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.name}>
                {product.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-44"
            onChange={(event) => setBandFilter(event.target.value)}
            value={bandFilter}
          >
            <option value="">All CIBIL bands</option>
            {cibilBands.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </Select>
        </div>

        {canEdit && (
          <Button id="add-slab-btn" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Add Slab
          </Button>
        )}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(grouped).map(([groupKey, slabs]) => {
                const [productName, schemeName] = groupKey.split("|||");
                return (
                  <Fragment key={groupKey}>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-1.5" colSpan={7}>
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

      {/* Add New Slab Entry Custom Dialog Modal Overlay */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm">
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-[#1a2744] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-white/10 rounded">
                  <Plus className="h-4.5 w-4.5 text-white" />
                </span>
                <span className="font-bold text-base tracking-wide">Add New Slab Entry</span>
              </div>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="text-white/80 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateSlab} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Row 1: Product, Scheme, Slab Label */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Product *</label>
                  <select
                    value={modalProductId}
                    onChange={(e) => setModalProductId(e.target.value)}
                    required
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  >
                    <option value="">-- Select Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Scheme *</label>
                  <select
                    value={modalSchemeId}
                    onChange={(e) => setModalSchemeId(e.target.value)}
                    required
                    disabled={!modalProductId}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 disabled:bg-slate-50 font-medium"
                  >
                    <option value="">-- Select Scheme --</option>
                    {schemes.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Loan Amt. Slab Label *</label>
                  <input
                    type="text"
                    value={slabLabel}
                    onChange={(e) => setSlabLabel(e.target.value)}
                    required
                    placeholder="e.g. Upto Rs. 35 Lakhs"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Max Loan Amount */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Max Loan Amount *</label>
                  <input
                    type="number"
                    value={maxLoanAmount}
                    onChange={(e) => setMaxLoanAmount(e.target.value)}
                    required
                    placeholder="e.g. Rs. 3500000"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Row 3: Score Band, Gender, Max Period */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Score Band</label>
                  <select
                    value={scoreBand}
                    onChange={(e) => setScoreBand(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  >
                    <option value="NA">NA</option>
                    <option value="Above 800">Above 800</option>
                    <option value="751 - 800">751 - 800</option>
                    <option value="700 - 750">700 - 750</option>
                    <option value="Below 700">Below 700</option>
                  </select>
                  <span className="text-[10px] text-slate-400 italic mt-0.5 block">
                    e.g. &gt; 750 | Between 700 - 750 | NA
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  >
                    <option value="All">All</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Transgender">Transgender</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Max Loan Period (Months)</label>
                  <input
                    type="number"
                    value={maxPeriodMonths}
                    onChange={(e) => setMaxPeriodMonths(e.target.value)}
                    placeholder="e.g. 84"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Row 4: ROI Floating, ROI Fixed, LTV, FOIR */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">ROI Floating (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={roiFloating}
                    onChange={(e) => setRoiFloating(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">ROI Fixed (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={roiFixed}
                    onChange={(e) => setRoiFixed(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">LTV (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ltvPct}
                    onChange={(e) => setLtvPct(e.target.value)}
                    placeholder="e.g. 80"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">FOIR (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={foirPct}
                    onChange={(e) => setFoirPct(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                  />
                </div>
              </div>

              {/* Row 5: Maker Comment */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Edit className="h-3.5 w-3.5" /> Maker Comment (max 500)
                </label>
                <textarea
                  value={makerComment}
                  onChange={(e) => setMakerComment(e.target.value)}
                  maxLength={500}
                  placeholder="Enter maker comment..."
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-medium"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-md text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-md shadow-sm transition disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Save & Send for Approval
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductTypeTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);

  // Product Form states
  const [prodName, setProdName] = useState("");
  const [prodMinAgeSalaried, setProdMinAgeSalaried] = useState("18");
  const [prodMaxAgeSalaried, setProdMaxAgeSalaried] = useState("58");
  const [prodMinAgeSelfEmp, setProdMinAgeSelfEmp] = useState("18");
  const [prodMaxAgeSelfEmp, setProdMaxAgeSelfEmp] = useState("65");
  const [prodMakerComment, setProdMakerComment] = useState("");

  // Scheme Form states
  const [editingScheme, setEditingScheme] = useState<any | null>(null);
  const [schemeProductId, setSchemeProductId] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [schemeMakerComment, setSchemeMakerComment] = useState("");

  // Scheme List filter
  const [filterProductId, setFilterProductId] = useState("");
  const [schemesList, setSchemesList] = useState<any[]>([]);
  const [schemesLoading, setSchemesLoading] = useState(false);

  const { currentUser } = useMockStore();
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const res = await adminApi.getProducts();
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Load Failed",
        description: "Failed to load loan products.",
        variant: "warning",
      });
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

  const loadSchemes = useCallback(async (productId: number) => {
    setSchemesLoading(true);
    try {
      const res = await adminApi.getSchemes(productId);
      setSchemesList(res.data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Load Failed",
        description: "Failed to load schemes.",
        variant: "warning",
      });
    } finally {
      setSchemesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (filterProductId) {
      loadSchemes(Number(filterProductId));
    } else {
      setSchemesList([]);
    }
  }, [filterProductId, loadSchemes]);

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdName("");
    setProdMinAgeSalaried("18");
    setProdMaxAgeSalaried("58");
    setProdMinAgeSelfEmp("18");
    setProdMaxAgeSelfEmp("65");
    setProdMakerComment("");
  };

  const handleEditProduct = (prod: any) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdMinAgeSalaried(String(prod.min_age_salaried ?? 18));
    setProdMaxAgeSalaried(String(prod.max_age_salaried ?? 58));
    setProdMinAgeSelfEmp(String(prod.min_age_self_emp ?? 18));
    setProdMaxAgeSelfEmp(String(prod.max_age_self_emp ?? 65));
    setProdMakerComment("");
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await adminApi.deleteProduct(id);
      toast({
        title: "Submitted to Checker",
        description: "Product deletion request submitted successfully.",
        variant: "success",
      });
      loadProducts();
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit product deletion request.",
        variant: "warning",
      });
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      toast({ title: "Validation Error", description: "Product name is required.", variant: "warning" });
      return;
    }

    try {
      const payload = {
        name: prodName,
        min_age_salaried: Number(prodMinAgeSalaried || 18),
        max_age_salaried: Number(prodMaxAgeSalaried || 58),
        min_age_self_emp: Number(prodMinAgeSelfEmp || 18),
        max_age_self_emp: Number(prodMaxAgeSelfEmp || 65),
        maker_comment: prodMakerComment || "Saving product from admin portal",
      };

      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, payload);
        toast({ title: "Submitted to Checker", description: "Product update request submitted successfully.", variant: "success" });
      } else {
        await adminApi.createProduct(payload);
        toast({ title: "Submitted to Checker", description: "Product creation request submitted successfully.", variant: "success" });
      }

      resetProductForm();
      loadProducts();
    } catch (err) {
      toast({ title: "Action Failed", description: "Failed to save product request.", variant: "warning" });
    }
  };

  const resetSchemeForm = () => {
    setEditingScheme(null);
    setSchemeName("");
    setSchemeMakerComment("");
  };

  const handleEditScheme = (sch: any) => {
    setEditingScheme(sch);
    setSchemeProductId(String(sch.loan_product_id));
    setSchemeName(sch.name);
    setSchemeMakerComment("");
  };

  const handleDeleteScheme = async (id: number) => {
    if (!confirm("Are you sure you want to delete this scheme?")) return;
    try {
      await adminApi.deleteScheme(id);
      toast({
        title: "Submitted to Checker",
        description: "Scheme deletion request submitted successfully.",
        variant: "success",
      });
      if (filterProductId) {
        loadSchemes(Number(filterProductId));
      }
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to submit scheme deletion request.",
        variant: "warning",
      });
    }
  };

  const handleSaveScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schemeProductId) {
      toast({ title: "Validation Error", description: "Please select a product first.", variant: "warning" });
      return;
    }
    if (!schemeName.trim()) {
      toast({ title: "Validation Error", description: "Scheme name is required.", variant: "warning" });
      return;
    }

    try {
      const payload = {
        name: schemeName,
        maker_comment: schemeMakerComment || "Saving scheme from admin portal",
      };

      if (editingScheme) {
        await adminApi.updateScheme(editingScheme.id, payload);
        toast({ title: "Submitted to Checker", description: "Scheme update request submitted successfully.", variant: "success" });
      } else {
        await adminApi.createScheme(Number(schemeProductId), payload);
        toast({ title: "Submitted to Checker", description: "Scheme creation request submitted successfully.", variant: "success" });
      }

      resetSchemeForm();
      loadProducts();
      if (filterProductId && Number(filterProductId) === Number(schemeProductId)) {
        loadSchemes(Number(filterProductId));
      }
    } catch (err) {
      toast({ title: "Action Failed", description: "Failed to save scheme request.", variant: "warning" });
    }
  };

  const canEdit = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Forms */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Loan Product Details Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#1a2744] px-5 py-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wide text-sm">Loan Product Details</span>
              <span className="bg-blue-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Section 1</span>
            </div>
            {canEdit && (
              <button
                onClick={resetProductForm}
                className="flex items-center gap-1 text-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold px-3 py-1.5 rounded transition"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add New Product
              </button>
            )}
          </div>
          <div className="p-6">
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Edit className="h-3.5 w-3.5" />
                {editingProduct ? `Edit Product: ${editingProduct.name}` : "New Product"}
              </h4>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Home Loan, Personal Loan..."
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Min Age - Salaried (Yrs.)</label>
                  <input
                    type="number"
                    value={prodMinAgeSalaried}
                    onChange={(e) => setProdMinAgeSalaried(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Max Age - Salaried (Yrs.)</label>
                  <input
                    type="number"
                    value={prodMaxAgeSalaried}
                    onChange={(e) => setProdMaxAgeSalaried(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Min Age - Self Employed (Yrs.)</label>
                  <input
                    type="number"
                    value={prodMinAgeSelfEmp}
                    onChange={(e) => setProdMinAgeSelfEmp(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Max Age - Self Employed (Yrs.)</label>
                  <input
                    type="number"
                    value={prodMaxAgeSelfEmp}
                    onChange={(e) => setProdMaxAgeSelfEmp(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-600">Maker Comment</label>
                  <span className="text-[10px] text-slate-400">{prodMakerComment.length} / 500</span>
                </div>
                <textarea
                  placeholder="Enter maker comment..."
                  maxLength={500}
                  value={prodMakerComment}
                  onChange={(e) => setProdMakerComment(e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>

              {canEdit && (
                <div className="flex justify-end gap-2 pt-2">
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-md hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-sm transition"
                  >
                    Save Product
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Schemes under this Product Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#1a2744] px-5 py-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wide text-sm">Schemes under this Product</span>
              <span className="bg-blue-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded">Section 2</span>
            </div>
            {canEdit && (
              <button
                onClick={resetSchemeForm}
                className="flex items-center gap-1 text-xs bg-blue-700 hover:bg-blue-800 text-white font-semibold px-3 py-1.5 rounded transition"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add New Scheme
              </button>
            )}
          </div>
          <div className="p-6">
            <form onSubmit={handleSaveScheme} className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Edit className="h-3.5 w-3.5" />
                {editingScheme ? `Edit Scheme: ${editingScheme.name}` : "New Scheme"}
              </h4>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Select Product *</label>
                <select
                  value={schemeProductId}
                  onChange={(e) => setSchemeProductId(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="">-- Select a Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Scheme Name *</label>
                <input
                  type="text"
                  placeholder={schemeProductId ? "e.g. Star Home Loan" : "Please select a product first"}
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                  disabled={!canEdit || !schemeProductId}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-600">Maker Comment</label>
                  <span className="text-[10px] text-slate-400">{schemeMakerComment.length} / 500</span>
                </div>
                <textarea
                  placeholder={schemeProductId ? "Enter maker comment..." : "Please select a product first"}
                  maxLength={500}
                  value={schemeMakerComment}
                  onChange={(e) => setSchemeMakerComment(e.target.value)}
                  disabled={!canEdit || !schemeProductId}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>

              {canEdit && (
                <div className="flex justify-end gap-2 pt-2">
                  {editingScheme && (
                    <button
                      type="button"
                      onClick={resetSchemeForm}
                      className="px-4 py-2 text-sm font-semibold border border-slate-200 rounded-md hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!schemeProductId}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-sm transition disabled:opacity-50 disabled:pointer-events-none"
                  >
                    Update Scheme
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

      </div>

      {/* Right Column: Tables */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Product List Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#1a2744] px-5 py-4 flex justify-between items-center text-white">
            <span className="font-bold tracking-wide text-sm">Product List</span>
          </div>
          <div className="p-4">
            {productsLoading ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No products found.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-600 border-b border-slate-100">
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Product Name</th>
                      {canEdit && <th className="px-4 py-2.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((prod, idx) => (
                      <tr key={prod.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-500 font-medium">#{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{prod.name}</td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <ActionPair
                              onEdit={() => handleEditProduct(prod)}
                              onDelete={() => handleDeleteProduct(prod.id)}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Scheme List Card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-[#1a2744] px-5 py-4 flex justify-between items-center text-white">
            <span className="font-bold tracking-wide text-sm">Scheme List</span>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Filter by Product</label>
              <select
                value={filterProductId}
                onChange={(e) => setFilterProductId(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {!filterProductId ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                <AlertCircle className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Please select a product from the filter above</p>
              </div>
            ) : schemesLoading ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : schemesList.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No schemes configured for this product.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-600 border-b border-slate-100">
                      <th className="px-4 py-2.5">ID</th>
                      <th className="px-4 py-2.5">Scheme Name</th>
                      {canEdit && <th className="px-4 py-2.5 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schemesList.map((sch, idx) => (
                      <tr key={sch.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-500 font-medium">#{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{sch.name}</td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <ActionPair
                              onEdit={() => handleEditScheme(sch)}
                              onDelete={() => handleDeleteScheme(sch.id)}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function SchemeParametersTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingParams, setLoadingParams] = useState(false);
  const [saving, setSaving] = useState(false);

  // Parameter states (values in raw Rupees and months/percentages)
  const [minLoanAmount, setMinLoanAmount] = useState("");
  const [maxLoanAmount, setMaxLoanAmount] = useState("");
  const [minPeriodMonths, setMinPeriodMonths] = useState("");
  const [maxPeriodMonths, setMaxPeriodMonths] = useState("");
  const [roiLabel, setRoiLabel] = useState("Floating");
  const [ltvLabel, setLtvLabel] = useState("");
  const [foirIncomeRangeLabel, setFoirIncomeRangeLabel] = useState("");
  const [foirDeviationPct, setFoirDeviationPct] = useState("");
  const [makerComment, setMakerComment] = useState("");
  const [roiSlabs, setRoiSlabs] = useState<any[]>([]);

  // LTV & FOIR Slabs local states (amounts in raw Rupees)
  const [ltvSlabs, setLtvSlabs] = useState<any[]>([]);
  const [foirSlabs, setFoirSlabs] = useState<any[]>([]);

  const { currentUser } = useMockStore();
  const { toast } = useToast();

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getProducts();
      setProducts(res.data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: "Load Failed",
        description: "Failed to load products list.",
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Load schemes when product selection changes
  useEffect(() => {
    if (selectedProductId) {
      adminApi.getSchemes(Number(selectedProductId)).then((res) => {
        setSchemes(res.data || []);
        setSelectedSchemeId("");
        resetParamForm();
      });
    } else {
      setSchemes([]);
      setSelectedSchemeId("");
      resetParamForm();
    }
  }, [selectedProductId]);

  // Load parameters when scheme selection changes
  useEffect(() => {
    if (selectedSchemeId) {
      setLoadingParams(true);
      adminApi.getSchemeParameters(Number(selectedSchemeId))
        .then((res) => {
          const params = res.data;
          if (params) {
            setMinLoanAmount(String(params.min_loan_amount ? Math.round(params.min_loan_amount * 100000) : ""));
            setMaxLoanAmount(String(params.max_loan_amount ? Math.round(params.max_loan_amount * 100000) : ""));
            setMinPeriodMonths(String(params.min_period_months ?? ""));
            setMaxPeriodMonths(String(params.max_period_months ?? ""));
            setRoiLabel(params.roi_label ?? "Floating");
            setLtvLabel(params.ltv_label ?? "");
            setFoirIncomeRangeLabel(params.foir_income_range_label ?? "");
            setFoirDeviationPct(String(params.foir_deviation_pct ?? ""));
            setRoiSlabs(params.roi_slabs || []);

            // Ltv Slabs map: amount_lakhs to Rupees
            const mappedLtv = (params.ltv_slabs || []).map((slab: any) => ({
              range_type: slab.range_type || "upto",
              amount: slab.amount_lakhs ? Math.round(slab.amount_lakhs * 100000) : "",
              min_margin_pct: slab.min_margin_pct ?? "",
            }));
            setLtvSlabs(mappedLtv);

            // Foir Slabs map: income_lakhs to Rupees
            const mappedFoir = (params.foir_slabs || []).map((slab: any) => ({
              range_type: slab.range_type || "upto",
              income: slab.income_lakhs ? Math.round(slab.income_lakhs * 100000) : "",
              max_foir_pct: slab.max_foir_pct ?? "",
            }));
            setFoirSlabs(mappedFoir);
          } else {
            resetParamForm();
          }
        })
        .catch(() => {
          resetParamForm();
        })
        .finally(() => {
          setLoadingParams(false);
        });
    } else {
      resetParamForm();
    }
  }, [selectedSchemeId]);

  const resetParamForm = () => {
    setMinLoanAmount("");
    setMaxLoanAmount("");
    setMinPeriodMonths("");
    setMaxPeriodMonths("");
    setRoiLabel("Floating");
    setLtvLabel("");
    setLtvSlabs([]);
    setFoirIncomeRangeLabel("");
    setFoirSlabs([]);
    setFoirDeviationPct("");
    setMakerComment("");
    setRoiSlabs([]);
  };

  const handleAddLtvSlab = () => {
    setLtvSlabs([
      ...ltvSlabs,
      { range_type: "upto", amount: "", min_margin_pct: "" }
    ]);
  };

  const handleRemoveLtvSlab = (index: number) => {
    setLtvSlabs(ltvSlabs.filter((_, i) => i !== index));
  };

  const handleUpdateLtvSlab = (index: number, key: string, value: any) => {
    const updated = [...ltvSlabs];
    updated[index] = { ...updated[index], [key]: value };
    setLtvSlabs(updated);
  };

  const handleAddFoirSlab = () => {
    setFoirSlabs([
      ...foirSlabs,
      { range_type: "upto", income: "", max_foir_pct: "" }
    ]);
  };

  const handleRemoveFoirSlab = (index: number) => {
    setFoirSlabs(foirSlabs.filter((_, i) => i !== index));
  };

  const handleUpdateFoirSlab = (index: number, key: string, value: any) => {
    const updated = [...foirSlabs];
    updated[index] = { ...updated[index], [key]: value };
    setFoirSlabs(updated);
  };

  const handleSaveParameters = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchemeId) return;

    setSaving(true);
    try {
      const mappedLtvSlabs = ltvSlabs.map((slab, index) => ({
        slab_order: index + 1,
        range_type: slab.range_type,
        amount_lakhs: Number(slab.amount || 0) / 100000,
        min_margin_pct: Number(slab.min_margin_pct || 0),
      }));

      const mappedFoirSlabs = foirSlabs.map((slab, index) => ({
        slab_order: index + 1,
        range_type: slab.range_type,
        income_lakhs: Number(slab.income || 0) / 100000,
        max_foir_pct: Number(slab.max_foir_pct || 0),
      }));

      await adminApi.upsertSchemeParameters(Number(selectedSchemeId), {
        min_loan_amount: Number(minLoanAmount || 0) / 100000,
        max_loan_amount: Number(maxLoanAmount || 0) / 100000,
        min_period_months: Number(minPeriodMonths || 0),
        max_period_months: Number(maxPeriodMonths || 0),
        roi_label: roiLabel,
        ltv_label: ltvLabel,
        foir_income_range_label: foirIncomeRangeLabel,
        foir_deviation_pct: Number(foirDeviationPct || 0),
        roi_slabs: roiSlabs,
        ltv_slabs: mappedLtvSlabs,
        foir_slabs: mappedFoirSlabs,
        maker_comment: makerComment || "Saving scheme parameters configuration",
      });

      toast({
        title: "Submitted to Checker",
        description: "Scheme parameters configuration request submitted successfully for approval.",
        variant: "success",
      });
      setMakerComment("");
    } catch (err) {
      toast({
        title: "Action Failed",
        description: "Failed to save scheme parameters.",
        variant: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  const canEdit = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";

  return (
    <div className="space-y-6">
      {/* Select Scheme Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-[#1a2744] px-5 py-4 text-white">
          <span className="font-bold tracking-wide text-sm flex items-center gap-2">
            <Layers className="h-4 w-4" /> Select Scheme
          </span>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Select Product *</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a Product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600">Select Scheme *</label>
            <select
              value={selectedSchemeId}
              onChange={(e) => setSelectedSchemeId(e.target.value)}
              disabled={!selectedProductId}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              <option value="">-- Select a Scheme --</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selectedSchemeId ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">Please select a product and scheme to configure parameters.</p>
        </div>
      ) : loadingParams ? (
        <div className="flex justify-center py-12">
          <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : (
        <form onSubmit={handleSaveParameters} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column Cards */}
            <div className="space-y-6">
              
              {/* Loan Amount Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-[#1a2744] px-5 py-3 text-white flex items-center justify-between">
                  <span className="font-bold tracking-wide text-xs flex items-center gap-1.5">
                    <span className="font-semibold text-sm">₹</span> Loan Amount
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Min Loan Amt *</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        value={minLoanAmount}
                        onChange={(e) => setMinLoanAmount(e.target.value)}
                        disabled={!canEdit}
                        placeholder="e.g. 25000"
                        className="pl-7 pr-3 py-2 w-full rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Max Loan Amt *</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-400 text-sm">₹</span>
                      <input
                        type="number"
                        value={maxLoanAmount}
                        onChange={(e) => setMaxLoanAmount(e.target.value)}
                        disabled={!canEdit}
                        placeholder="e.g. 2500000"
                        className="pl-7 pr-3 py-2 w-full rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Loan Period Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-[#1a2744] px-5 py-3 text-white flex items-center justify-between">
                  <span className="font-bold tracking-wide text-xs flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> Loan Period
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Min. Period (Months) *</label>
                    <input
                      type="number"
                      value={minPeriodMonths}
                      onChange={(e) => setMinPeriodMonths(e.target.value)}
                      disabled={!canEdit}
                      placeholder="e.g. 6"
                      className="px-3 py-2 w-full rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">Max. Period (Months) *</label>
                    <input
                      type="number"
                      value={maxPeriodMonths}
                      onChange={(e) => setMaxPeriodMonths(e.target.value)}
                      disabled={!canEdit}
                      placeholder="e.g. 60"
                      className="px-3 py-2 w-full rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column Cards */}
            <div className="space-y-6">
              
              {/* LTV Slabs Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-[#1a2744] px-5 py-3 text-white flex items-center justify-between">
                  <span className="font-bold tracking-wide text-xs flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" /> LTV (Loan to Value)
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">LTV Label</label>
                    <input
                      type="text"
                      value={ltvLabel}
                      onChange={(e) => setLtvLabel(e.target.value)}
                      disabled={!canEdit}
                      placeholder="e.g. N/A or LTV %"
                      className="px-3 py-2 w-full rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 text-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-extrabold text-slate-700 block mt-2">LTV Slabs</span>
                    
                    {ltvSlabs.length === 0 ? (
                      <p className="text-xs italic text-slate-400 py-2">No LTV slabs configured.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <th className="py-2 w-12 text-center">Slab</th>
                              <th className="py-2">Loan Amt. Range</th>
                              <th className="py-2 w-28">Min. Margin (%)</th>
                              <th className="py-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ltvSlabs.map((slab, index) => (
                              <tr key={index} className="align-middle">
                                <td className="py-2 text-center font-semibold text-slate-500">{index + 1}</td>
                                <td className="py-2 pr-4">
                                  <div className="flex items-center w-full">
                                    <select
                                      value={slab.range_type}
                                      onChange={(e) => handleUpdateLtvSlab(index, 'range_type', e.target.value)}
                                      disabled={!canEdit}
                                      className="rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 h-9 focus:outline-none"
                                    >
                                      <option value="upto">upto &nbsp; ₹</option>
                                      <option value="above">above &nbsp; ₹</option>
                                    </select>
                                    <input
                                      type="number"
                                      value={slab.amount}
                                      onChange={(e) => handleUpdateLtvSlab(index, 'amount', e.target.value)}
                                      disabled={!canEdit}
                                      placeholder="e.g. 2500000"
                                      className="flex-1 rounded-r-md border border-slate-200 px-3 py-2 text-xs h-9 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                    />
                                  </div>
                                </td>
                                <td className="py-2">
                                  <div className="relative flex items-center">
                                    <input
                                      type="number"
                                      value={slab.min_margin_pct}
                                      onChange={(e) => handleUpdateLtvSlab(index, 'min_margin_pct', e.target.value)}
                                      disabled={!canEdit}
                                      placeholder="0"
                                      className="pr-8 pl-3 py-2 w-full rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium text-right"
                                    />
                                    <span className="absolute right-3 text-slate-400 text-xs">%</span>
                                  </div>
                                </td>
                                <td className="py-2 text-center">
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLtvSlab(index)}
                                      className="text-slate-400 hover:text-red-500 transition"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleAddLtvSlab}
                        className="w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-slate-200 hover:border-blue-400 rounded-md text-slate-600 hover:text-blue-600 text-[11px] font-bold hover:bg-slate-50 transition mt-2"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Slab
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* FOIR Slabs Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-[#1a2744] px-5 py-3 text-white flex items-center justify-between">
                  <span className="font-bold tracking-wide text-xs flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> FOIR (Fixed Obligation to Income Ratio)
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600">FOIR Income Range Label</label>
                    <input
                      type="text"
                      value={foirIncomeRangeLabel}
                      onChange={(e) => setFoirIncomeRangeLabel(e.target.value)}
                      disabled={!canEdit}
                      placeholder="e.g. Monthly Salary"
                      className="px-3 py-2 w-full rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 text-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-extrabold text-slate-700 block mt-2">FOIR Slabs (variable income range & FOIR%)</span>
                    
                    {foirSlabs.length === 0 ? (
                      <p className="text-xs italic text-slate-400 py-2">No FOIR slabs configured.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <th className="py-2 w-12 text-center">Slab</th>
                              <th className="py-2">Net Monthly Income Range</th>
                              <th className="py-2 w-28">Max FOIR (%)</th>
                              <th className="py-2 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {foirSlabs.map((slab, index) => (
                              <tr key={index} className="align-middle">
                                <td className="py-2 text-center font-semibold text-slate-500">{index + 1}</td>
                                <td className="py-2 pr-4">
                                  <div className="flex items-center w-full">
                                    <select
                                      value={slab.range_type}
                                      onChange={(e) => handleUpdateFoirSlab(index, 'range_type', e.target.value)}
                                      disabled={!canEdit}
                                      className="rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600 h-9 focus:outline-none"
                                    >
                                      <option value="upto">upto &nbsp; ₹</option>
                                      <option value="above">above &nbsp; ₹</option>
                                    </select>
                                    <input
                                      type="number"
                                      value={slab.income}
                                      onChange={(e) => handleUpdateFoirSlab(index, 'income', e.target.value)}
                                      disabled={!canEdit}
                                      placeholder="e.g. 25000"
                                      className="flex-1 rounded-r-md border border-slate-200 px-3 py-2 text-xs h-9 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                    />
                                  </div>
                                </td>
                                <td className="py-2">
                                  <div className="relative flex items-center">
                                    <input
                                      type="number"
                                      value={slab.max_foir_pct}
                                      onChange={(e) => handleUpdateFoirSlab(index, 'max_foir_pct', e.target.value)}
                                      disabled={!canEdit}
                                      placeholder="0"
                                      className="pr-8 pl-3 py-2 w-full rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-medium text-right"
                                    />
                                    <span className="absolute right-3 text-slate-400 text-xs">%</span>
                                  </div>
                                </td>
                                <td className="py-2 text-center">
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveFoirSlab(index)}
                                      className="text-slate-400 hover:text-red-500 transition"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={handleAddFoirSlab}
                        className="w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-slate-200 hover:border-blue-400 rounded-md text-slate-600 hover:text-blue-600 text-[11px] font-bold hover:bg-slate-50 transition mt-2"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Slab
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
                    <label className="text-xs font-bold text-slate-600">FOIR Deviation (%)</label>
                    <div className="relative flex items-center w-36">
                      <input
                        type="number"
                        value={foirDeviationPct}
                        onChange={(e) => setFoirDeviationPct(e.target.value)}
                        disabled={!canEdit}
                        placeholder="e.g. 65"
                        className="pr-8 pl-3 py-2 w-full rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 font-semibold text-right"
                      />
                      <span className="absolute right-3 text-slate-400 text-sm">%</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          <div className="space-y-1 mt-6">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-600">Maker Comment</label>
              <span className="text-[10px] text-slate-400">{makerComment.length} / 500</span>
            </div>
            <textarea
              placeholder="Enter maker comment for review..."
              maxLength={500}
              value={makerComment}
              onChange={(e) => setMakerComment(e.target.value)}
              disabled={!canEdit}
              rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          {canEdit && (
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-md shadow-sm transition disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Save Scheme Parameters
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export function BreRulesPage() {
  const [activeTab, setActiveTab] = useState<"product_type" | "scheme_params" | "slab_config">("product_type");

  return (
    <div className="space-y-6">
      <PageHeader
        description="Loan Product Configuration & Scheme Management"
        eyebrow="Business rule engine"
        title="Product Admin Portal"
      />

      <div className="border-b border-slate-200">
        <nav className="flex space-x-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("product_type")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-all ${
              activeTab === "product_type"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
              activeTab === "product_type" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
            }`}>
              1
            </span>
            PRODUCT TYPE
          </button>
          <button
            onClick={() => setActiveTab("scheme_params")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-all ${
              activeTab === "scheme_params"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
              activeTab === "scheme_params" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
            }`}>
              2
            </span>
            SCHEME PARAMETERS
          </button>
          <button
            onClick={() => setActiveTab("slab_config")}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition-all ${
              activeTab === "slab_config"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
              activeTab === "slab_config" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
            }`}>
              3
            </span>
            SLAB CONFIGURATION
          </button>
        </nav>
      </div>

      <div className="pt-2">
        {activeTab === "product_type" && <ProductTypeTab />}
        {activeTab === "scheme_params" && <SchemeParametersTab />}
        {activeTab === "slab_config" && <SlabsTab />}
      </div>
    </div>
  );
}
