"use client";

import Link from "next/link";
import { Copy, Mail, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DetailItem, PageHeader } from "@/components/module";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Label,
  Select,
  Tabs,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { DEMO_USERS } from "@/lib/demo-identities";
import { configJourneyUrl } from "@/lib/journey-links";
import {
  buildApplicationJourney,
  createJourneyApplication,
  JourneyApplicantInput,
} from "@/lib/product-journeys";
import { useMockStore } from "@/lib/store";
import { Application, ApplicationJourney, DsaProductConfig } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface ApplicantDraft {
  aadhaar: string;
  city: string;
  customer: string;
  email: string;
  loanAmount: string;
  mobile: string;
  pan: string;
  salary: string;
}

const defaultApplicant: ApplicantDraft = {
  aadhaar: "",
  city: "",
  customer: "",
  email: "",
  loanAmount: "",
  mobile: "",
  pan: "",
  salary: "",
};

interface SellNowDraftState {
  lastLink: string;
  mode: string;
  selectedDsaId: string;
  selectedProduct: string;
  stepIndex: number;
}

type JourneyField = ApplicationJourney["fields"][number];

interface JourneyFormStep {
  fields: JourneyField[];
  label: string;
}

const sellNowDraftKey = "cosmos_sell_now_draft";

function loadSellNowDraft(): Partial<SellNowDraftState> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(sellNowDraftKey) ?? "{}") as Partial<SellNowDraftState>;
  } catch {
    localStorage.removeItem(sellNowDraftKey);
    return {};
  }
}

function borrowerDraftKey(configId: string) {
  return `cosmos_borrower_journey_${configId}`;
}

function loadBorrowerDraft(configId: string) {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(borrowerDraftKey(configId)) ?? "{}") as Partial<SellNowDraftState>;
  } catch {
    localStorage.removeItem(borrowerDraftKey(configId));
    return {};
  }
}

function toApplicant(draft: ApplicantDraft): JourneyApplicantInput {
  return {
    aadhaar: draft.aadhaar.trim(),
    city: draft.city.trim(),
    customer: draft.customer.trim(),
    email: draft.email.trim(),
    loanAmount: Number(draft.loanAmount || 0),
    mobile: draft.mobile.trim(),
    pan: draft.pan.trim().toUpperCase(),
    salary: Number(draft.salary || 0),
  };
}

function validateApplicant(draft: ApplicantDraft, requireKyc: boolean) {
  const applicant = toApplicant(draft);
  if (!applicant.customer) return "Customer name is required.";
  if (!applicant.mobile && !applicant.email) return "Enter either mobile number or email.";
  if (requireKyc && !applicant.city) return "City is required.";
  if (requireKyc && !/^[A-Z]{5}\d{4}[A-Z]$/.test(applicant.pan)) return "Enter a valid PAN.";
  if (requireKyc && !/^\d{12}$/.test(applicant.aadhaar)) return "Enter a valid 12-digit Aadhaar.";
  if (requireKyc && applicant.loanAmount <= 0) return "Enter a valid loan amount.";
  if (requireKyc && applicant.salary <= 0) return "Enter a valid income value.";
  return "";
}

function buildJourneyFormSteps(journey: ApplicationJourney): JourneyFormStep[] {
  const grouped = journey.fields.reduce<JourneyFormStep[]>((steps, item) => {
    const existing = steps.find((step) => step.label === item.group);
    if (existing) {
      existing.fields.push(item);
    } else {
      steps.push({ fields: [item], label: item.group });
    }
    return steps;
  }, []);

  while (grouped.length < 5) {
    const splitIndex = grouped.reduce((largestIndex, step, index) => {
      if (step.fields.length <= 1) return largestIndex;
      return largestIndex === -1 || step.fields.length > grouped[largestIndex].fields.length ? index : largestIndex;
    }, -1);

    if (splitIndex === -1) break;

    const step = grouped[splitIndex];
    const midpoint = Math.ceil(step.fields.length / 2);
    grouped.splice(
      splitIndex,
      1,
      { fields: step.fields.slice(0, midpoint), label: step.label },
      { fields: step.fields.slice(midpoint), label: `${step.label} Details` },
    );
  }

  return grouped;
}

function findMissingJourneyField(journey: ApplicationJourney, fieldValues: Record<string, string>) {
  const steps = buildJourneyFormSteps(journey);
  for (const [stepIndex, step] of steps.entries()) {
    const missing = step.fields.find((item) => !(fieldValues[item.id] ?? "").trim());
    if (missing) return { field: missing, stepIndex };
  }
  return null;
}

function ApplicantFields({
  draft,
  onChange,
  requireKyc,
}: {
  draft: ApplicantDraft;
  onChange: (patch: Partial<ApplicantDraft>) => void;
  requireKyc: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field>
        <Label htmlFor="journeyCustomer">Customer name</Label>
        <Input id="journeyCustomer" onChange={(event) => onChange({ customer: event.target.value })} value={draft.customer} />
      </Field>
      <Field>
        <Label htmlFor="journeyCity">City</Label>
        <Input id="journeyCity" onChange={(event) => onChange({ city: event.target.value })} value={draft.city} />
      </Field>
      <Field>
        <Label htmlFor="journeyMobile">Mobile</Label>
        <Input id="journeyMobile" onChange={(event) => onChange({ mobile: event.target.value })} value={draft.mobile} />
      </Field>
      <Field>
        <Label htmlFor="journeyEmail">Email</Label>
        <Input id="journeyEmail" onChange={(event) => onChange({ email: event.target.value })} type="email" value={draft.email} />
      </Field>
      {requireKyc ? (
        <>
          <Field>
            <Label htmlFor="journeyPan">PAN</Label>
            <Input id="journeyPan" onChange={(event) => onChange({ pan: event.target.value.toUpperCase() })} value={draft.pan} />
          </Field>
          <Field>
            <Label htmlFor="journeyAadhaar">Aadhaar</Label>
            <Input id="journeyAadhaar" maxLength={12} onChange={(event) => onChange({ aadhaar: event.target.value })} value={draft.aadhaar} />
          </Field>
          <Field>
            <Label htmlFor="journeyAmount">Loan amount</Label>
            <Input id="journeyAmount" onChange={(event) => onChange({ loanAmount: event.target.value })} type="number" value={draft.loanAmount} />
          </Field>
          <Field>
            <Label htmlFor="journeySalary">Income / salary</Label>
            <Input id="journeySalary" onChange={(event) => onChange({ salary: event.target.value })} type="number" value={draft.salary} />
          </Field>
        </>
      ) : null}
    </div>
  );
}

function JourneyStepper({
  fieldValues,
  journey,
  onFieldChange,
  onSubmit,
  stepIndex,
  onStepChange,
}: {
  fieldValues: Record<string, string>;
  journey: ApplicationJourney;
  onFieldChange: (id: string, value: string) => void;
  onSubmit: () => void;
  stepIndex: number;
  onStepChange: (value: number) => void;
}) {
  const steps = buildJourneyFormSteps(journey);
  const safeStepIndex = Math.max(0, Math.min(stepIndex, Math.max(steps.length - 1, 0)));
  const activeStep = steps[safeStepIndex] ?? steps[0];
  const fields = activeStep?.fields ?? [];
  const isLastStep = safeStepIndex >= steps.length - 1;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {steps.map((step, index) => (
          <button
            className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition ${
              index === safeStepIndex
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : index < safeStepIndex
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500"
            }`}
            key={`${step.label}-${index}`}
            onClick={() => onStepChange(index)}
            type="button"
          >
            <span className="block text-[10px] uppercase tracking-wide">Step {index + 1}</span>
            {step.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((item) => (
          <Field key={item.id}>
            <Label htmlFor={`journey-${item.id}`}>{item.label}</Label>
            <Input
              id={`journey-${item.id}`}
              onChange={(event) => onFieldChange(item.id, event.target.value)}
              placeholder={`Enter ${item.label.toLowerCase()}`}
              value={fieldValues[item.id] ?? ""}
            />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <Button
          disabled={safeStepIndex === 0}
          onClick={() => onStepChange(Math.max(0, safeStepIndex - 1))}
          type="button"
          variant="secondary"
        >
          Back
        </Button>
        {isLastStep ? (
          <Button onClick={onSubmit} type="button">
            <Send className="h-4 w-4" />
            Submit Journey
          </Button>
        ) : (
          <Button onClick={() => onStepChange(Math.min(steps.length - 1, safeStepIndex + 1))} type="button">
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function JourneySelection({
  configs,
  lockDsa,
  onDsaChange,
  onProductChange,
  selectedDsaId,
  selectedProduct,
}: {
  configs: DsaProductConfig[];
  lockDsa?: boolean;
  onDsaChange: (value: string) => void;
  onProductChange: (value: string) => void;
  selectedDsaId: string;
  selectedProduct: string;
}) {
  const dsaOptions = Array.from(new Map(configs.map((config) => [config.dsaId, config])).values());
  const productOptions = configs.filter((config) => config.dsaId === selectedDsaId);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field>
        <Label htmlFor="sellNowDsa">DSA partner</Label>
        <Select disabled={lockDsa} id="sellNowDsa" onChange={(event) => onDsaChange(event.target.value)} value={selectedDsaId}>
          <option value="">Select DSA</option>
          {dsaOptions.map((config) => (
            <option key={config.dsaId} value={config.dsaId}>
              {config.dsaName} ({config.dsaCode})
            </option>
          ))}
        </Select>
      </Field>
      <Field>
        <Label htmlFor="sellNowProduct">Journey / product</Label>
        <Select id="sellNowProduct" onChange={(event) => onProductChange(event.target.value)} value={selectedProduct}>
          <option value="">Select journey</option>
          {productOptions.map((config) => (
            <option key={config.id} value={config.product}>
              {config.product} Journey
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function SellNowPage() {
  const { createItem, currentUser, store } = useMockStore();
  const { toast } = useToast();
  const [selectedDsaId, setSelectedDsaId] = useState(() => loadSellNowDraft().selectedDsaId ?? "");
  const [selectedProduct, setSelectedProduct] = useState(() => loadSellNowDraft().selectedProduct ?? "");
  const [mode, setMode] = useState(() => loadSellNowDraft().mode ?? "send");
  const [applicant, setApplicant] = useState<ApplicantDraft>(defaultApplicant);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [lastLink, setLastLink] = useState(() => loadSellNowDraft().lastLink ?? "");
  const [stepIndex, setStepIndex] = useState(() => loadSellNowDraft().stepIndex ?? 0);
  const [createdApplication, setCreatedApplication] = useState<Application | null>(null);

  const activeConfigs = useMemo(
    () =>
      store.dsaProductConfigs
        .filter((config) => config.status === "Active")
        .filter((config) => currentUser?.role !== "DSA Partner" || config.dsaId === currentUser.id)
        .sort((left, right) => left.dsaName.localeCompare(right.dsaName) || left.product.localeCompare(right.product)),
    [currentUser, store.dsaProductConfigs],
  );

  const effectiveDsaId =
    selectedDsaId && activeConfigs.some((config) => config.dsaId === selectedDsaId)
      ? selectedDsaId
      : activeConfigs[0]?.dsaId ?? "";
  const productsForDsa = activeConfigs.filter((config) => config.dsaId === effectiveDsaId);
  const effectiveProduct =
    selectedProduct && productsForDsa.some((config) => config.product === selectedProduct)
      ? selectedProduct
      : productsForDsa[0]?.product ?? "";
  const effectiveConfig = activeConfigs.find(
    (config) => config.dsaId === effectiveDsaId && config.product === effectiveProduct,
  );

  const journey = effectiveConfig
    ? buildApplicationJourney(effectiveConfig.product, effectiveConfig.id.length + effectiveConfig.dsaCode.length, {
        city: applicant.city,
        customer: applicant.customer || "Customer",
        loanAmount: Number(applicant.loanAmount || 0),
        salary: Number(applicant.salary || 0),
      })
    : null;

  const shareLink =
    effectiveConfig ? configJourneyUrl(effectiveConfig) : "";

  useEffect(() => {
    localStorage.setItem(
      sellNowDraftKey,
      JSON.stringify({
        lastLink,
        mode,
        selectedDsaId: effectiveDsaId,
        selectedProduct: effectiveProduct,
        stepIndex,
      }),
    );
  }, [effectiveDsaId, effectiveProduct, lastLink, mode, stepIndex]);

  async function copyLink(value: string) {
    if (!value) {
      toast({ title: "No link available", description: "Select a configured journey first.", variant: "warning" });
      return;
    }
    await navigator.clipboard.writeText(value);
    toast({ title: "Link copied", description: "Journey link copied to clipboard.", variant: "success" });
  }

  function sendJourney(channel: "Email" | "SMS") {
    if (!effectiveConfig) {
      toast({ title: "Select journey", description: "Choose a DSA and product journey first.", variant: "warning" });
      return;
    }
    if (currentUser?.role === "DSA Partner" && channel === "Email") {
      toast({ title: "SMS only", description: "DSA admins can send customer journey links by SMS.", variant: "warning" });
      return;
    }
    const error = validateApplicant(applicant, false);
    if (error) {
      toast({ title: "Missing recipient", description: error, variant: "warning" });
      return;
    }
    if (channel === "Email" && !applicant.email.trim()) {
      toast({ title: "Email required", description: "Enter customer email to send the journey link.", variant: "warning" });
      return;
    }
    if (channel === "SMS" && !applicant.mobile.trim()) {
      toast({ title: "Mobile required", description: "Enter customer mobile to send the journey link.", variant: "warning" });
      return;
    }
    setLastLink(shareLink);
    toast({
      title: `${channel} queued`,
      description: `${effectiveConfig.product} journey link prepared for ${applicant.customer}.`,
      variant: "success",
    });
  }

  function createAssistedApplication() {
    if (!effectiveConfig) {
      toast({ title: "Select journey", description: "Choose a DSA and product journey first.", variant: "warning" });
      return;
    }
    const error = validateApplicant(applicant, true);
    if (error) {
      toast({ title: "Check journey details", description: error, variant: "warning" });
      return;
    }
    const missingField = journey ? findMissingJourneyField(journey, fieldValues) : null;
    if (missingField) {
      setStepIndex(missingField.stepIndex);
      toast({
        title: "Complete journey",
        description: `${missingField.field.label} is required before submission.`,
        variant: "warning",
      });
      return;
    }

    const nextApplication = createJourneyApplication({
      actor: currentUser?.name ?? DEMO_USERS.admin.name,
      applicant: toApplicant(applicant),
      dsaId: effectiveConfig.dsaId,
      dsaName: effectiveConfig.dsaName,
      fieldValues,
      product: effectiveConfig.product,
      source: "Assisted",
    });

    createItem("applications", nextApplication);
    setCreatedApplication(nextApplication);
    setApplicant(defaultApplicant);
    setFieldValues({});
    setStepIndex(0);
    toast({
      title: "Application created",
      description: `${nextApplication.applicationId} is now visible in Applications.`,
      variant: "success",
    });
  }

  if (currentUser?.role !== "DSA Manager" && currentUser?.role !== "DSA Partner") {
    return (
      <EmptyState
        description="This workspace is available to the admin and DSA journey desks."
        title="Sell Now is restricted"
      />
    );
  }

  return (
    <div>
      <PageHeader
        description="Choose an approved DSA product journey, send it to a customer, or complete the same journey on the customer's behalf."
        eyebrow="Journeys"
        title="Sell Now"
      />

      {activeConfigs.length ? (
        <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-slate-950">Journey selection</h2>
              </CardHeader>
              <CardContent className="space-y-5">
                <JourneySelection
                  configs={activeConfigs}
                  lockDsa={currentUser.role === "DSA Partner"}
                  onDsaChange={(value) => {
                    setSelectedDsaId(value);
                    setSelectedProduct("");
                    setFieldValues({});
                    setCreatedApplication(null);
                    setLastLink("");
                    setStepIndex(0);
                  }}
                  onProductChange={(value) => {
                    setSelectedProduct(value);
                    setFieldValues({});
                    setCreatedApplication(null);
                    setLastLink("");
                    setStepIndex(0);
                  }}
                  selectedDsaId={effectiveDsaId}
                  selectedProduct={effectiveProduct}
                />
                {effectiveConfig ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <DetailItem label="DSA code" value={effectiveConfig.dsaCode} />
                    <DetailItem label="Configured product" value={effectiveConfig.product} />
                    <DetailItem label="Commission type" value={effectiveConfig.commissionType} />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Journey action</h2>
                  {effectiveConfig ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {effectiveConfig.dsaName} - {effectiveConfig.product}
                    </p>
                  ) : null}
                </div>
                <Tabs
                  onChange={setMode}
                  tabs={[
                    { label: "Send Link", value: "send" },
                    { label: "Fill on Behalf", value: "assist" },
                  ]}
                  value={mode}
                />
              </CardHeader>
              <CardContent className="space-y-5">
                <ApplicantFields
                  draft={applicant}
                  onChange={(patch) => setApplicant((current) => ({ ...current, ...patch }))}
                  requireKyc={mode === "assist"}
                />

                {mode === "send" ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Journey link</p>
                          <p className="mt-1 break-all text-sm font-medium text-slate-950">{shareLink || "Select a journey"}</p>
                        </div>
                        <Button onClick={() => copyLink(shareLink)} type="button" variant="outline">
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {currentUser.role === "DSA Manager" ? (
                        <Button onClick={() => sendJourney("Email")} type="button" variant="outline">
                          <Mail className="h-4 w-4" />
                          Send Email
                        </Button>
                      ) : null}
                      <Button onClick={() => sendJourney("SMS")} type="button">
                        <MessageSquare className="h-4 w-4" />
                        Send SMS
                      </Button>
                    </div>
                    {lastLink ? (
                      <div className="flex flex-col gap-3 rounded-md bg-emerald-50 p-3 text-sm font-medium text-emerald-700 md:flex-row md:items-center md:justify-between">
                        <span className="break-all">Journey link ready: {lastLink}</span>
                        <Button onClick={() => copyLink(lastLink)} type="button" variant="outline">
                          <Copy className="h-4 w-4" />
                          Copy Link
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {journey ? (
                      <JourneyStepper
                        fieldValues={fieldValues}
                        journey={journey}
                        onFieldChange={(id, value) => setFieldValues((current) => ({ ...current, [id]: value }))}
                        onStepChange={setStepIndex}
                        onSubmit={createAssistedApplication}
                        stepIndex={stepIndex}
                      />
                    ) : null}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {createdApplication ? (
                        <Link href={`/applications/${createdApplication.id}`}>
                          <Button type="button" variant="outline">
                            Open {createdApplication.applicationId}
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {effectiveConfig ? (
              <Card>
                <CardHeader>
                  <h2 className="text-base font-semibold text-slate-950">Configured payout</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {effectiveConfig.ranges.map((range) => (
                    <div className="rounded-md border border-slate-100 p-3" key={range.id}>
                      <p className="font-semibold text-slate-950">{range.id}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCurrency(range.min)} - {formatCurrency(range.max)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{range.rate}% - {range.frequency}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
        </div>
      ) : (
        <EmptyState
          action={
            currentUser.role === "DSA Manager" ? (
              <Link href="/dsa/product-setting">
                <Button type="button">Open Product Setting</Button>
              </Link>
            ) : undefined
          }
          description={
            currentUser.role === "DSA Partner"
              ? "No active products are configured for your DSA yet."
              : "Configure at least one active DSA product before starting a journey."
          }
          title="No journeys configured"
        />
      )}
    </div>
  );
}

export function BorrowerJourneyPage({ configId }: { configId: string }) {
  const { createItem, store } = useMockStore();
  const { toast } = useToast();
  const [applicant, setApplicant] = useState<ApplicantDraft>(defaultApplicant);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [stepIndex, setStepIndex] = useState(() => loadBorrowerDraft(configId).stepIndex ?? 0);
  const [createdApplication, setCreatedApplication] = useState<Application | null>(null);
  const config = store.dsaProductConfigs.find((item) => item.id === configId && item.status === "Active");

  const journey = config
    ? buildApplicationJourney(config.product, config.id.length + config.dsaCode.length, {
        city: applicant.city,
        customer: applicant.customer || "Customer",
        loanAmount: Number(applicant.loanAmount || 0),
        salary: Number(applicant.salary || 0),
      })
    : null;

  useEffect(() => {
    localStorage.setItem(
      borrowerDraftKey(configId),
      JSON.stringify({
        stepIndex,
      }),
    );
  }, [configId, stepIndex]);

  function submitSelfServeJourney() {
    if (!config) return;
    const error = validateApplicant(applicant, true);
    if (error) {
      toast({ title: "Check journey details", description: error, variant: "warning" });
      return;
    }
    const missingField = journey ? findMissingJourneyField(journey, fieldValues) : null;
    if (missingField) {
      setStepIndex(missingField.stepIndex);
      toast({
        title: "Complete journey",
        description: `${missingField.field.label} is required before submission.`,
        variant: "warning",
      });
      return;
    }
    const nextApplication = createJourneyApplication({
      actor: applicant.customer || "Customer",
      applicant: toApplicant(applicant),
      dsaId: config.dsaId,
      dsaName: config.dsaName,
      fieldValues,
      product: config.product,
      source: "Self Serve",
    });
    createItem("applications", nextApplication);
    setApplicant(defaultApplicant);
    setFieldValues({});
    setStepIndex(0);
    setCreatedApplication(nextApplication);
    toast({
      title: "Journey submitted",
      description: `${nextApplication.applicationId} has been created.`,
      variant: "success",
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <main className="mx-auto max-w-5xl">
        {config && journey ? (
          <div>
            <PageHeader
              description={`${config.dsaName} - ${config.product}`}
              eyebrow="Digital journey"
              title={journey.name}
            />
            {createdApplication ? (
              <Card>
                <CardContent className="space-y-4 text-center">
                  <Send className="mx-auto h-10 w-10 text-emerald-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-slate-950">Journey submitted</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Application {createdApplication.applicationId} is now queued with Cosmos Bank.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <h2 className="text-base font-semibold text-slate-950">Applicant details</h2>
                  </CardHeader>
                  <CardContent>
                    <ApplicantFields
                      draft={applicant}
                      onChange={(patch) => setApplicant((current) => ({ ...current, ...patch }))}
                      requireKyc
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <h2 className="text-base font-semibold text-slate-950">Product journey</h2>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <JourneyStepper
                      fieldValues={fieldValues}
                      journey={journey}
                      onFieldChange={(id, value) => setFieldValues((current) => ({ ...current, [id]: value }))}
                      onStepChange={setStepIndex}
                      onSubmit={submitSelfServeJourney}
                      stepIndex={stepIndex}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            description="This journey link is no longer active."
            title="Journey unavailable"
          />
        )}
      </main>
    </div>
  );
}
