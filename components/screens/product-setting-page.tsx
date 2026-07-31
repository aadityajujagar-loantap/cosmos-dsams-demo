"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMockStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/module";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Label,
  Select,
  Input,
} from "@/components/ui/primitives";
import { Copy, Plus, Trash2, UploadCloud, Check, Landmark, Image as ImageIcon, FileCheck, AlertCircle } from "lucide-react";
import { formatCurrency, makeId } from "@/lib/utils";
import { DEMO_USERS } from "@/lib/demo-identities";
import { journeyUrl } from "@/lib/journey-links";
import { Product, ProductCommissionRange } from "@/lib/types";

const loanProducts: Product[] = ["Home Loan", "Personal Loan", "Loan Against Property", "Business Loan", "Auto Loan"];

// Required documents per product and borrower type
const REQUIRED_DOCS: Record<string, { salaried: string[]; selfEmployed: string[] }> = {
  "Home Loan": {
    salaried: ["PAN Card", "Aadhaar Card", "Last 3 months salary slips", "6-month bank statement", "Form 16 / ITR (2 years)", "Property documents", "Sale agreement / NOC"],
    selfEmployed: ["PAN Card", "Aadhaar Card", "Business registration proof", "GST returns (2 years)", "ITR with P&L (2 years)", "12-month bank statement", "Property documents", "Sale agreement"],
  },
  "Personal Loan": {
    salaried: ["PAN Card", "Aadhaar Card", "Last 2 months salary slips", "3-month bank statement", "Employment letter"],
    selfEmployed: ["PAN Card", "Aadhaar Card", "Business registration proof", "ITR (1 year)", "6-month bank statement"],
  },
  "Loan Against Property": {
    salaried: ["PAN Card", "Aadhaar Card", "Last 3 months salary slips", "6-month bank statement", "Property title deed", "Encumbrance certificate", "Building plan approval"],
    selfEmployed: ["PAN Card", "Aadhaar Card", "ITR with balance sheet (2 years)", "12-month bank statement", "Property title deed", "Encumbrance certificate"],
  },
  "Business Loan": {
    salaried: ["PAN Card", "Aadhaar Card", "Salary slips (3 months)", "Bank statement (3 months)", "Employment proof"],
    selfEmployed: ["PAN Card", "Aadhaar Card", "Business registration / GSTIN", "ITR with P&L (2 years)", "12-month bank statement", "Business vintage proof"],
  },
  "Auto Loan": {
    salaried: ["PAN Card", "Aadhaar Card", "Salary slips (2 months)", "Bank statement (3 months)", "Vehicle proforma invoice"],
    selfEmployed: ["PAN Card", "Aadhaar Card", "ITR (1 year)", "6-month bank statement", "Vehicle proforma invoice"],
  },
};

function productDefaults(product: string) {
  if (product === "Personal Loan") return { code: "PL", url: "personalloan" };
  if (product === "Loan Against Property") return { code: "LAP", url: "lap" };
  if (product === "Business Loan") return { code: "BL", url: "businessloan" };
  if (product === "Auto Loan") return { code: "AL", url: "autoloan" };
  return { code: "HL", url: "homeloan" };
}

export function ProductSettingPage() {
  const { store, createItem, updateItem, currentUser } = useMockStore();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | "">("");
  const [partner, setPartner] = useState<string>("");
  const [scheme, setScheme] = useState<string>("");
  const [borrowerType, setBorrowerType] = useState<"salaried" | "selfEmployed">("salaried");

  // Add range inputs
  const [rangeId, setRangeId] = useState<string>("");
  const [minRange, setMinRange] = useState<string>("");
  const [maxRange, setMaxRange] = useState<string>("");
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [frequency, setFrequency] = useState<string>("");
  const [commissionAmount, setCommissionAmount] = useState<string>("");

  const [ranges, setRanges] = useState<ProductCommissionRange[]>([]);

  const [draftConfigId, setDraftConfigId] = useState<string>(() => makeId("dsa-product"));

  // Marketing banner state
  const [bannerName, setBannerName] = useState<string>("");
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string>("");
  const [hasBanner, setHasBanner] = useState<boolean>(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    };
  }, [bannerPreviewUrl]);

  useEffect(() => {
    if (product && partner) {
      const config = store.dsaProductConfigs.find(
        (c) => c.dsaId === partner && c.product === product,
      );
      if (config) {
        setRanges(config.ranges || []);
        const slab = store.loanSlabs.find(s => s.product === product);
        setScheme(slab?.schemeName || "");
        if (config.bannerName) {
          setBannerName(config.bannerName);
          setHasBanner(true);
        } else {
          setHasBanner(false);
          setBannerName("");
        }
      } else {
        setRanges([]);
        setScheme("");
        setHasBanner(false);
        setBannerName("");
      }
    } else {
      setRanges([]);
      setScheme("");
      setHasBanner(false);
      setBannerName("");
    }
  }, [product, partner, store.dsaProductConfigs, store.loanSlabs]);

  const canConfigureProducts = currentUser?.role === "DSA Manager" || currentUser?.role === "DSA Credit";

  if (!canConfigureProducts) {
    return (
      <EmptyState
        description="Only DSA Manager and DSA Credit users can configure products. DSA admins see live approved products in Sell Now."
        title="Product setup is restricted"
      />
    );
  }

  const handleProductChange = (nextProduct: Product | "") => {
    if (!nextProduct) {
      setProduct("");
      setScheme("");
      setRangeId("");
      setBannerName("");
      return;
    }
    const { code, url } = productDefaults(nextProduct);
    setProduct(nextProduct);
    setScheme(""); // reset scheme when product changes
    setRangeId((current) => current || `${code}_Commission_${(ranges.length + 1).toString().padStart(2, "0")}`);
    setBannerName((current) => current || `${url}_banner.png`);
  };

  // Schemes available for the selected product (derived from loan slabs)
  const schemesForProduct = product
    ? [...new Set(store.loanSlabs.filter((s) => s.product === product).map((s) => s.schemeName))]
    : [];

  const handleAddRange = () => {
    if (!rangeId.trim()) {
      toast({
        title: "Validation Error",
        description: "Commission ID is required",
        variant: "warning",
      });
      return;
    }

    const minVal = parseFloat(minRange);
    const maxVal = parseFloat(maxRange);
    const amountVal = parseFloat(commissionAmount);

    if (isNaN(minVal) || isNaN(maxVal) || minVal < 0 || maxVal <= minVal) {
      toast({
        title: "Validation Error",
        description: "Please enter valid minimum and maximum disbursement ranges.",
        variant: "warning",
      });
      return;
    }

    if (isNaN(amountVal) || amountVal <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid commission amount.",
        variant: "warning",
      });
      return;
    }

    if (!effectiveDate || !endDate || !frequency) {
      toast({
        title: "Validation Error",
        description: "Effective date, end date, and commission frequency are required.",
        variant: "warning",
      });
      return;
    }

    const bankRateEquivalent = Math.min((amountVal / maxVal) * 100, 0.75);
    const newRange: ProductCommissionRange = {
      commissionAmount: amountVal,
      id: rangeId,
      min: minVal,
      max: maxVal,
      effectiveDate,
      endDate,
      frequency,
      growthRequired: true,
      rate: Number(bankRateEquivalent.toFixed(2)),
    };

    setRanges([...ranges, newRange]);
    toast({
      title: "Range Added",
      description: `Commission range ${rangeId} added successfully to product list.`,
      variant: "success",
    });

    // Reset range ID for next one
    const { code } = productDefaults(product || "Home Loan");
    setRangeId(`${code}_Commission_${(ranges.length + 2).toString().padStart(2, "0")}`);
  };

  const handleRemoveRange = (id: string) => {
    setRanges(ranges.filter((r) => r.id !== id));
    toast({
      title: "Range Removed",
      description: `Commission range ${id} was removed.`,
      variant: "success",
    });
  };

  const handleConfigureCommission = () => {
    if (!product) {
      toast({
        title: "Select Product",
        description: "Choose a loan product before saving this configuration.",
        variant: "warning",
      });
      return;
    }

    if (!scheme) {
      toast({
        title: "Select Scheme",
        description: "Choose a scheme for this product before saving.",
        variant: "warning",
      });
      return;
    }

    const selectedDsa = store.dsas.find((dsa) => dsa.id === partner && dsa.status === "Active");
    if (!selectedDsa) {
      toast({
        title: "Select Active DSA",
        description: "Choose an approved DSA partner before applying a product configuration.",
        variant: "warning",
      });
      return;
    }

    if (ranges.length === 0) {
      toast({
        title: "Add Commission Range",
        description: "Add at least one commission range before saving this product.",
        variant: "warning",
      });
      return;
    }

    const existingConfig = store.dsaProductConfigs.find(
      (config) => config.dsaId === selectedDsa.id && config.product === product,
    );
    const configId = existingConfig?.id ?? draftConfigId;
    const landingEndpoint = journeyUrl(configId);
    const payload = {
      bannerName: hasBanner ? bannerName : undefined,
      commissionType: "Percentage-based" as const,
      configuredAt: new Date().toISOString(),
      configuredBy: currentUser?.name ?? DEMO_USERS.admin.name,
      dsaCode: selectedDsa.code,
      dsaId: selectedDsa.id,
      dsaName: selectedDsa.name,
      loanUrl: landingEndpoint,
      product,
      ranges,
      status: "Active" as const,
    };

    if (existingConfig) {
      updateItem("dsaProductConfigs", existingConfig.id, payload);
    } else {
      createItem("dsaProductConfigs", {
        id: configId,
        ...payload,
      });
      setDraftConfigId(makeId("dsa-product"));
    }

    createItem("auditLogs", {
      id: `audit-${Date.now()}`,
      at: new Date().toISOString(),
      actor: currentUser?.name ?? DEMO_USERS.admin.name,
      action: `Configured ${product} for ${selectedDsa.name}`,
      entity: "Settings",
      severity: "Info",
      ipAddress: "10.24.0.91",
    });

    toast({
      title: "Configuration Saved",
      description: `${product} is now available for ${selectedDsa.name}.`,
      variant: "success",
    });
  };

  const activeDsas = store.dsas.filter((d) => d.status === "Active");
  const selectedDsa = store.dsas.find((dsa) => dsa.id === partner);
  const productCommissions = store.commissions.filter((commission) => commission.dsaId === partner && commission.product === product);
  const latestDisbursement = productCommissions[0]?.disbursedAmount ?? 0;
  const previousDisbursement = productCommissions[1]?.disbursedAmount ?? 0;
  const growthEligible = latestDisbursement > previousDisbursement;
  const selectedConfig = product && partner
    ? store.dsaProductConfigs.find((config) => config.dsaId === partner && config.product === product)
    : undefined;
  const activeEndpoint = product && partner ? journeyUrl(selectedConfig?.id ?? draftConfigId) : "";

  const copyEndpoint = async () => {
    if (!activeEndpoint) {
      toast({
        title: "Select Product",
        description: "Choose a DSA partner and product first.",
        variant: "warning",
      });
      return;
    }
    await navigator.clipboard.writeText(activeEndpoint);
    toast({
      title: "Link Copied",
      description: "Landing page endpoint copied to clipboard.",
      variant: "success",
    });
  };

  const handleBannerFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
    setBannerName(file.name);
    setBannerPreviewUrl(URL.createObjectURL(file));
    setHasBanner(true);
    event.target.value = "";
    toast({
      title: "Banner Selected",
      description: `${file.name} is ready for this product journey.`,
      variant: "success",
    });
  };

  // Generate a beautiful, premium visual representation of a loan banner based on selection
  const renderBannerPreview = () => {
    if (!hasBanner) {
      return (
        <button
          className="flex h-52 w-full flex-col items-center justify-center rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-blue-500 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          onClick={() => bannerInputRef.current?.click()}
          type="button"
        >
          <ImageIcon className="h-10 w-10 mb-2 stroke-1" />
          <p className="text-xs font-semibold">No active banner image</p>
          <p className="text-[10px] text-blue-400 mt-1">Click to choose a custom picture</p>
        </button>
      );
    }

    if (bannerPreviewUrl) {
      return (
        <button
          className="relative h-52 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left shadow-sm"
          onClick={() => bannerInputRef.current?.click()}
          type="button"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={bannerName || "Uploaded banner"} className="h-full w-full object-cover" src={bannerPreviewUrl} />
          <span className="absolute inset-x-0 bottom-0 bg-slate-950/70 px-4 py-2 text-xs font-semibold text-white">
            {bannerName || "Custom banner"} - click to replace
          </span>
        </button>
      );
    }

    let bgClass = "from-indigo-600 to-blue-700";
    let tag = "FLEXIBLE RATE";
    let title = "PERSONAL LOANS";
    let perk1 = "Instant Approvals";
    let perk2 = "Zero Collateral Needed";

    if (product === "Home Loan") {
      bgClass = "from-pink-500 to-rose-600";
      tag = "YOUR DREAM HOME";
      title = "HOME LOANS";
      perk1 = "Zero Processing Fees";
      perk2 = "Instant Sanctions";
    } else if (product === "Loan Against Property") {
      bgClass = "from-sky-500 to-blue-800";
      tag = "UNLOCK PROPERTY VALUE";
      title = "PROPERTY LOANS";
      perk1 = "LTV up to 75%";
      perk2 = "Longer Tenures";
    } else if (product === "Business Loan") {
      bgClass = "from-emerald-500 to-teal-600";
      tag = "GROW YOUR BUSINESS";
      title = "BUSINESS LOANS";
      perk1 = "Competitive Rates";
      perk2 = "Minimal Documentation";
    } else if (product === "Auto Loan") {
      bgClass = "from-violet-500 to-purple-600";
      tag = "DRIVE YOUR DREAM";
      title = "AUTO LOANS";
      perk1 = "Funding up to 90%";
      perk2 = "Quick Disbursals";
    }

    return (
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${bgClass} text-white p-5 shadow-lg h-52 flex flex-col justify-between`}>
        {/* Decorative Circles */}
        <div className="absolute right-0 top-0 -mr-6 -mt-6 h-28 w-28 rounded-full bg-white/10 blur-md" />
        <div className="absolute right-12 bottom-4 h-16 w-16 rounded-full bg-white/10 blur-sm" />
        
        <div>
          <span className="inline-block bg-white/20 backdrop-blur-md text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase mb-2">
            {tag}
          </span>
          <h4 className="text-xl font-extrabold tracking-tight leading-tight">{title}</h4>
          <p className="text-[10px] text-white/80 mt-1">Get your financing done from the comfort of home</p>
        </div>

        <div className="space-y-1 text-left">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/95">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {perk1}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/95">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {perk2}
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 text-[9px] text-white/70">
          <span>COSMOS PARTNER NETWORK</span>
          <span className="font-bold">0% Downpayment Option</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Configure dynamic commission rates, incentive structures, and marketing banners for specific loan products and sourcing partners."
        eyebrow="System Configuration"
        title="Product Setting"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Left Column - Configure Commission Form */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Configure Commission of Loan Product</h3>
                <p className="text-xs text-slate-500 mt-1">Select the loan type, assign a partner channel, and configure payout rules.</p>
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="loanProductSelect">Loan Product Name *</Label>
                  <Select
                    id="loanProductSelect"
                    value={product}
                    onChange={(e) => handleProductChange(e.target.value as Product | "")}
                  >
                    <option value="">Select product</option>
                    {loanProducts.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </Field>

                <Field>
                  <Label htmlFor="schemeSelect">Scheme *</Label>
                  <Select
                    id="schemeSelect"
                    value={scheme}
                    onChange={(e) => setScheme(e.target.value)}
                    disabled={!product}
                  >
                    <option value="">{product ? "Select scheme" : "Select product first"}</option>
                    {schemesForProduct.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </Field>

                <Field className="sm:col-span-2">
                  <Label htmlFor="partnerSelect">Choose Bank / DSA Partner *</Label>
                  <Select
                    id="partnerSelect"
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                  >
                    <option value="">Select active DSA</option>
                    {activeDsas.map((dsa) => (
                      <option key={dsa.id} value={dsa.id}>
                        {dsa.name} ({dsa.code})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {/* Add Commission Range Sub-card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Add Loan Commission Range-1
                  </span>
                  <Landmark className="h-4 w-4 text-blue-600" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <Field className="sm:col-span-2 md:col-span-1">
                    <Label htmlFor="rangeIdInput">Commission ID</Label>
                    <Input
                      id="rangeIdInput"
                      value={rangeId}
                      onChange={(e) => setRangeId(e.target.value)}
                      placeholder="e.g. HL_Commission_01"
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="minRangeInput">Min Disbursement (₹)</Label>
                    <Input
                      id="minRangeInput"
                      type="number"
                      value={minRange}
                      onChange={(e) => setMinRange(e.target.value)}
                      placeholder="e.g. 1000000"
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="maxRangeInput">Max Disbursement (₹)</Label>
                    <Input
                      id="maxRangeInput"
                      type="number"
                      value={maxRange}
                      onChange={(e) => setMaxRange(e.target.value)}
                      placeholder="e.g. 3000000"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <Field>
                    <Label htmlFor="effectiveDateInput">Effective Date</Label>
                    <Input
                      id="effectiveDateInput"
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="endDateInput">End Date</Label>
                    <Input
                      id="endDateInput"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="frequencySelect">Commission Frequency</Label>
                    <Select
                      id="frequencySelect"
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                    >
                      <option value="">Select frequency</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="One-time">One-time</option>
                    </Select>
                  </Field>

                  <Field>
                    <Label htmlFor="commissionAmountInput">Commission Amount (₹)</Label>
                    <Input
                      id="commissionAmountInput"
                      type="number"
                      value={commissionAmount}
                      onChange={(e) => setCommissionAmount(e.target.value)}
                      placeholder="e.g. 5000"
                    />
                  </Field>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
                  Commission is stored as a fixed amount and is payable only when the selected DSA&apos;s current disbursement is higher than the previous month.
                  {selectedDsa ? (
                    <span className="mt-1 block">
                      {selectedDsa.name}: current {formatCurrency(latestDisbursement)} vs previous {formatCurrency(previousDisbursement)} - {growthEligible ? "eligible on growth" : "not eligible until growth improves"}.
                    </span>
                  ) : null}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleAddRange}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> ADD
                  </Button>
                </div>
              </div>

              {/* Commission Ranges List Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Configured Commission Ranges</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 font-semibold uppercase text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Disbursement Range</th>
                        <th className="px-4 py-2 text-center">Dates</th>
                        <th className="px-4 py-2 text-center">Frequency</th>
                        <th className="px-4 py-2 text-right">Commission Amount</th>
                        <th className="px-4 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ranges.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-900">{r.id}</td>
                          <td className="px-4 py-3">
                            {formatCurrency(r.min)} - {formatCurrency(r.max)}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {r.effectiveDate} to {r.endDate}
                          </td>
                          <td className="px-4 py-3 text-center">{r.frequency}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-700">
                            {formatCurrency(r.commissionAmount ?? Math.round((r.max * r.rate) / 100))}
                            <span className="block text-[10px] font-medium text-slate-400">Bank eq. {r.rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRange(r.id)}
                              className="text-rose-600 hover:text-rose-700 transition"
                            >
                              <Trash2 className="h-4 w-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {ranges.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-xs">
                            No ranges yet — use the form above to add one.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Configure Commission Action */}
              <div className="flex justify-end border-t border-slate-100 pt-5">
                <Button
                  onClick={handleConfigureCommission}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold h-11 px-6 flex items-center gap-2"
                >
                  <Check className="h-5 w-5" /> Configure Loan Product Commission Amount
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Marketing Banner and URL */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 space-y-5">
              <input
                accept="image/*"
                className="hidden"
                onChange={handleBannerFile}
                ref={bannerInputRef}
                type="file"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 uppercase tracking-wider">
                  Add Loan Product Banner
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configure the promotional asset that will display in the borrower journey.</p>
              </div>

              {/* Image Preview Area */}
              {renderBannerPreview()}

              {/* Upload/Remove Action Area */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setHasBanner(false);
                    if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl);
                    setBannerPreviewUrl("");
                    setBannerName("");
                    toast({
                      title: "Banner Removed",
                      description: "Promotional marketing banner cleared.",
                      variant: "success",
                    });
                  }}
                  disabled={!hasBanner}
                  className="flex-1 text-slate-600 hover:text-rose-600 text-xs py-2 h-auto"
                >
                  Remove
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    bannerInputRef.current?.click();
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-2 h-auto flex items-center justify-center gap-1.5"
                >
                  <UploadCloud className="h-4 w-4" /> Upload
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 uppercase tracking-wider">
                  Set Loan Product URL
                </h3>
                <p className="text-xs text-slate-500 mt-1">Configure the official bank endpoint where digital journeys originate.</p>
              </div>

              <Field>
                <Label htmlFor="loanUrlInput">Landing Page Endpoint</Label>
                <div className="flex gap-2">
                  <Input
                    id="loanUrlInput"
                    readOnly
                    value={activeEndpoint}
                    placeholder="Select DSA and product to generate journey link"
                  />
                  <Button onClick={copyEndpoint} size="icon" type="button" variant="outline">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </Field>

              <p className="text-[10px] text-slate-400">
                This is the same journey link used by Sell Now for customer self-serve submissions.
              </p>
            </CardContent>
          </Card>

          {/* Required Documents Card */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Required Documents</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Documents required for this product &amp; borrower type.</p>
                </div>
                <FileCheck className="h-4 w-4 text-blue-600" />
              </div>

              {/* Borrower type toggle */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBorrowerType("salaried")}
                  className={`flex-1 py-2 transition-colors ${
                    borrowerType === "salaried"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Salaried
                </button>
                <button
                  type="button"
                  onClick={() => setBorrowerType("selfEmployed")}
                  className={`flex-1 py-2 transition-colors ${
                    borrowerType === "selfEmployed"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Self-Employed
                </button>
              </div>

              {product ? (
                <ul className="space-y-2">
                  {(REQUIRED_DOCS[product]?.[borrowerType] ?? []).map((doc, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      {doc}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-slate-400">
                  <AlertCircle className="h-8 w-8 stroke-1" />
                  <p className="text-xs text-center">Select a product above to see required documents.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
