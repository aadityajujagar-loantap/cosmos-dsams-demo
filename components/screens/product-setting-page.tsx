"use client";

import { useState, useEffect } from "react";
import { useMockStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/module";
import {
  Button,
  Card,
  CardContent,
  Field,
  Label,
  Select,
  Input,
} from "@/components/ui/primitives";
import { Plus, Trash2, UploadCloud, Check, Landmark, Image as ImageIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface CommissionRange {
  id: string;
  min: number;
  max: number;
  effectiveDate: string;
  endDate: string;
  frequency: string;
  rate: number;
}

export function ProductSettingPage() {
  const { store, createItem } = useMockStore();
  const { toast } = useToast();

  const [product, setProduct] = useState<string>("Home Loan");
  const [partner, setPartner] = useState<string>("dsa-direct");
  const [commissionType, setCommissionType] = useState<string>("Percentage-based");

  // Add range inputs
  const [rangeId, setRangeId] = useState<string>("HL_Commission_01");
  const [minRange, setMinRange] = useState<string>("1000000");
  const [maxRange, setMaxRange] = useState<string>("3000000");
  const [effectiveDate, setEffectiveDate] = useState<string>("1998-02-03");
  const [endDate, setEndDate] = useState<string>("2028-02-03");
  const [frequency, setFrequency] = useState<string>("Monthly");
  const [rate, setRate] = useState<string>("0.52");

  // Prepopulated ranges
  const [ranges, setRanges] = useState<CommissionRange[]>([
    {
      id: "HL_Commission_01",
      min: 1000000,
      max: 3000000,
      effectiveDate: "1998-02-03",
      endDate: "2028-02-03",
      frequency: "Monthly",
      rate: 0.52,
    },
  ]);

  // URL state
  const [loanUrl, setLoanUrl] = useState<string>(
    "https://digiloans.bankofmaharashtra.in/apply/homeloan?bom"
  );

  // Marketing banner state
  const [bannerName, setBannerName] = useState<string>("home_loan_banner.png");
  const [hasBanner, setHasBanner] = useState<boolean>(true);

  // Update defaults when product changes
  useEffect(() => {
    let code = "HL";
    let url = "homeloan";
    if (product === "Personal Loan") {
      code = "PL";
      url = "personalloan";
    } else if (product === "Loan Against Property") {
      code = "LAP";
      url = "lap";
    } else if (product === "Business Loan") {
      code = "BL";
      url = "businessloan";
    } else if (product === "Auto Loan") {
      code = "AL";
      url = "autoloan";
    }

    setRangeId(`${code}_Commission_${(ranges.length + 1).toString().padStart(2, "0")}`);
    setLoanUrl(`https://digiloans.bankofmaharashtra.in/apply/${url}?bom`);
    setBannerName(`${url}_banner.png`);
  }, [product, ranges.length]);

  const handleAddRange = () => {
    if (!rangeId.trim()) {
      toast({
        title: "Validation Error",
        description: "Commission ID is required",
        variant: "destructive",
      });
      return;
    }

    const minVal = parseFloat(minRange);
    const maxVal = parseFloat(maxRange);
    const rateVal = parseFloat(rate);

    if (isNaN(minVal) || isNaN(maxVal) || minVal < 0 || maxVal <= minVal) {
      toast({
        title: "Validation Error",
        description: "Please enter valid minimum and maximum disbursement ranges.",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(rateVal) || rateVal < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid commission rate.",
        variant: "destructive",
      });
      return;
    }

    const newRange: CommissionRange = {
      id: rangeId,
      min: minVal,
      max: maxVal,
      effectiveDate,
      endDate,
      frequency,
      rate: rateVal,
    };

    setRanges([...ranges, newRange]);
    toast({
      title: "Range Added",
      description: `Commission range ${rangeId} added successfully to product list.`,
      variant: "success",
    });

    // Reset range ID for next one
    const code = product === "Personal Loan" ? "PL" : product === "Home Loan" ? "HL" : product === "Loan Against Property" ? "LAP" : product === "Business Loan" ? "BL" : "AL";
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
    // Save to audit logs
    const partnerName = partner === "dsa-direct" 
      ? "Cosmos Bank (Direct)" 
      : store.dsas.find(d => d.id === partner)?.name || "Partner";

    createItem("auditLogs", {
      id: `audit-${Date.now()}`,
      at: new Date().toISOString(),
      actor: "DSA Manager",
      action: `Configured commission for ${product} (${partnerName})`,
      entity: "Settings",
      severity: "Info",
      ipAddress: "10.24.0.91",
    });

    toast({
      title: "Configuration Saved",
      description: `Successfully configured ${ranges.length} commission ranges for ${product} assigned to ${partnerName}.`,
      variant: "success",
    });
  };

  const activeDsas = store.dsas.filter((d) => d.status === "Active" || d.status === "Submitted" || d.status === "KYC Pending");

  // Generate a beautiful, premium visual representation of a loan banner based on selection
  const renderBannerPreview = () => {
    if (!hasBanner) {
      return (
        <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl p-8 bg-slate-50 text-slate-400 h-52">
          <ImageIcon className="h-10 w-10 mb-2 stroke-1" />
          <p className="text-xs font-semibold">No active banner image</p>
          <p className="text-[10px] text-slate-400 mt-1">Upload a banner image to showcase on the loan portal</p>
        </div>
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
      bgClass = "from-amber-500 to-orange-600";
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

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        {/* Left Column - Configure Commission Form */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Configure Commission of Loan Product</h3>
                <p className="text-xs text-slate-500 mt-1">Select the loan type, assign a partner channel, and configure payout rules.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <Label htmlFor="loanProductSelect">Loan Product Name *</Label>
                  <Select
                    id="loanProductSelect"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                  >
                    {["Home Loan", "Personal Loan", "Loan Against Property", "Business Loan", "Auto Loan"].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </Field>

                <Field>
                  <Label htmlFor="partnerSelect">Choose Bank / DSA Partner *</Label>
                  <Select
                    id="partnerSelect"
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                  >
                    <option value="dsa-direct">Cosmos Bank (Direct)</option>
                    {activeDsas.map((dsa) => (
                      <option key={dsa.id} value={dsa.id}>
                        {dsa.name} ({dsa.code})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field>
                  <Label htmlFor="commissionTypeSelect">Commission Type *</Label>
                  <Select
                    id="commissionTypeSelect"
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value)}
                  >
                    <option value="Percentage-based">Percentage-based</option>
                    <option value="Fixed-fee">Fixed-fee flat rate</option>
                    <option value="Tiered">Tiered Slab-based</option>
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

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <Field className="sm:col-span-2">
                    <Label htmlFor="rangeIdInput">Loan Commission ID</Label>
                    <Input
                      id="rangeIdInput"
                      value={rangeId}
                      onChange={(e) => setRangeId(e.target.value)}
                      placeholder="e.g. HL_Commission_01"
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="minRangeInput">Min Disbursement (INR)</Label>
                    <Input
                      id="minRangeInput"
                      type="number"
                      value={minRange}
                      onChange={(e) => setMinRange(e.target.value)}
                      placeholder="e.g. 1000000"
                    />
                  </Field>

                  <Field>
                    <Label htmlFor="maxRangeInput">Max Disbursement (INR)</Label>
                    <Input
                      id="maxRangeInput"
                      type="number"
                      value={maxRange}
                      onChange={(e) => setMaxRange(e.target.value)}
                      placeholder="e.g. 3000000"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
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
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="One-time">One-time</option>
                    </Select>
                  </Field>

                  <Field>
                    <Label htmlFor="rateInput">
                      {commissionType === "Fixed-fee" ? "Incentive Rate (INR)" : "Commission Rate (%)"}
                    </Label>
                    <Input
                      id="rateInput"
                      type="number"
                      step="0.01"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      placeholder="e.g. 0.52"
                    />
                  </Field>
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
                        <th className="px-4 py-2 text-right">
                          {commissionType === "Fixed-fee" ? "Payout" : "Rate"}
                        </th>
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
                            {commissionType === "Fixed-fee" ? formatCurrency(r.rate) : `${r.rate}%`}
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
                          <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                            No commission ranges added yet. Please use the form above to add a range.
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
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 px-6 flex items-center gap-2"
                >
                  <Check className="h-5 w-5" /> Configure Loan Product Commission
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Marketing Banner and URL */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5 space-y-5">
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
                    setHasBanner(true);
                    toast({
                      title: "Banner Uploaded",
                      description: `Mock file '${bannerName}' uploaded and processed successfully.`,
                      variant: "success",
                    });
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs py-2 h-auto flex items-center justify-center gap-1.5"
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
                <Input
                  id="loanUrlInput"
                  value={loanUrl}
                  onChange={(e) => setLoanUrl(e.target.value)}
                  placeholder="https://..."
                />
              </Field>

              <p className="text-[10px] text-slate-400">
                Ensure this URL points to a secure bank subdomain (e.g. bankofmaharashtra.in) with valid sourcing codes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
