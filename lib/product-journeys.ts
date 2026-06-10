import type { Application, ApplicationJourney, Product } from "@/lib/types";
import { makeId } from "@/lib/utils";

type JourneySeed = Pick<Application, "city" | "customer" | "loanAmount" | "salary">;

export interface JourneyApplicantInput {
  customer: string;
  mobile: string;
  email: string;
  city: string;
  pan: string;
  aadhaar: string;
  loanAmount: number;
  salary: number;
}

const productSteps: Record<Product, string[]> = {
  "Personal Loan": ["Eligibility", "Employment", "Income", "Documents", "BRE", "Offer"],
  "Home Loan": ["Property", "Applicant", "Income", "Legal", "Valuation", "Sanction"],
  "Loan Against Property": ["Property", "Ownership", "Income", "Valuation", "Legal", "Sanction"],
  "Business Loan": ["Business Profile", "Turnover", "Banking", "GST", "Risk", "Offer"],
  "Auto Loan": ["Vehicle", "Dealer", "Applicant", "Income", "Documents", "Disbursal"],
};

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function money(value: number): string {
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

function field(id: string, label: string, value: string, group: string) {
  return { group, id, label, value };
}

function productSlug(product: string) {
  return product.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function defaultSeed(seed: number): JourneySeed {
  return {
    city: pick(["Mumbai", "Pune", "Bengaluru", "Delhi", "Hyderabad"], seed),
    customer: `Journey Applicant ${seed + 1}`,
    loanAmount: 450000 + ((seed * 137000) % 4200000),
    salary: 32000 + ((seed * 4100) % 160000),
  };
}

function fieldsForProduct(product: Product, seed: number, application: JourneySeed) {
  if (product === "Personal Loan") {
    return [
      field("employmentType", "Employment Type", pick(["Salaried", "Self-employed Professional", "Government Employee"], seed), "Employment"),
      field("employerName", "Employer Name", pick(["Tata Consultancy Services", "Infosys", "HDFC Life", "Bajaj Finance"], seed + 1), "Employment"),
      field("employmentTenure", "Current Employment Tenure", `${1 + (seed % 8)} years`, "Employment"),
      field("netMonthlyIncome", "Net Monthly Income", money(application.salary), "Income"),
      field("existingEmi", "Existing Monthly EMI", money(application.salary * (0.12 + (seed % 4) * 0.04)), "Income"),
      field("foir", "FOIR", `${32 + (seed % 24)}%`, "Income"),
      field("bureauScoreBand", "Bureau Score Band", pick(["Prime", "Near prime", "Thin file", "New to credit"], seed + 4), "Credit"),
      field("loanPurpose", "Loan Purpose", pick(["Debt consolidation", "Medical expense", "Education", "Home renovation"], seed + 2), "Loan"),
      field("salaryAccountBank", "Salary Account Bank", pick(["Bank of Maharashtra", "HDFC Bank", "ICICI Bank", "Axis Bank"], seed + 3), "Banking"),
      field("preferredTenure", "Preferred Tenure", `${24 + (seed % 36)} months`, "Loan"),
      field("emiDate", "Preferred EMI Date", pick(["5th", "7th", "10th", "15th"], seed + 5), "Repayment"),
    ];
  }

  if (product === "Home Loan") {
    return [
      field("propertyType", "Property Type", pick(["Ready-to-move Apartment", "Under Construction", "Independent House", "Resale Flat"], seed), "Property"),
      field("propertyCity", "Property City", application.city, "Property"),
      field("propertyUsage", "Property Usage", pick(["Self occupied", "Let out", "Investment", "Family residence"], seed + 3), "Property"),
      field("builderName", "Builder / Seller Name", pick(["Prestige Group", "Godrej Properties", "Lodha", "Individual Seller"], seed + 4), "Property"),
      field("agreementValue", "Agreement Value", money(application.loanAmount * 1.28), "Property"),
      field("ownContribution", "Own Contribution", money(application.loanAmount * 0.22), "Funding"),
      field("reraStatus", "RERA Status", pick(["Registered", "Builder exemption", "Resale not applicable"], seed + 1), "Legal"),
      field("legalStatus", "Legal Review Status", pick(["Clear title", "Pending chain documents", "Society NOC pending", "Builder docs under review"], seed + 5), "Legal"),
      field("valuationStatus", "Valuation Status", pick(["Desktop valuation", "Physical valuation scheduled", "Valuation complete"], seed + 6), "Valuation"),
      field("requestedTenure", "Requested Tenure", `${15 + (seed % 11)} years`, "Loan"),
      field("coApplicantIncome", "Co-applicant Income", money(application.salary * (0.45 + (seed % 3) * 0.2)), "Income"),
    ];
  }

  if (product === "Loan Against Property") {
    return [
      field("collateralType", "Collateral Type", pick(["Residential Property", "Commercial Shop", "Industrial Unit", "Mixed-use Property"], seed), "Collateral"),
      field("ownership", "Ownership", pick(["Self-owned", "Joint ownership", "Family-owned with NOC"], seed + 1), "Collateral"),
      field("propertyAge", "Property Age", `${3 + (seed % 22)} years`, "Collateral"),
      field("builtUpArea", "Built-up Area", `${650 + (seed % 1800)} sq ft`, "Collateral"),
      field("marketValue", "Market Value", money(application.loanAmount * 1.85), "Valuation"),
      field("requestedLtv", "Requested LTV", `${48 + (seed % 18)}%`, "Valuation"),
      field("valuationAgency", "Valuation Agency", pick(["Internal valuer", "Knight Frank", "CBRE", "Local empanelled valuer"], seed + 4), "Valuation"),
      field("existingMortgage", "Existing Mortgage", pick(["No existing mortgage", "Takeover from another bank", "Top-up on existing facility"], seed + 2), "Banking"),
      field("titleDocument", "Title Document Status", pick(["Original title available", "Registered sale deed", "Partition deed", "Gift deed"], seed + 5), "Legal"),
      field("usage", "End Use", pick(["Business expansion", "Working capital", "Education", "Property renovation"], seed + 3), "Loan"),
      field("occupancy", "Occupancy", pick(["Owner occupied", "Tenant occupied", "Vacant", "Business occupied"], seed + 6), "Collateral"),
    ];
  }

  if (product === "Business Loan") {
    return [
      field("constitution", "Business Constitution", pick(["Proprietorship", "Partnership", "Private Limited", "LLP"], seed), "Business"),
      field("businessVintage", "Business Vintage", `${2 + (seed % 9)} years`, "Business"),
      field("annualTurnover", "Annual Turnover", money(application.loanAmount * (5 + (seed % 4))), "Financials"),
      field("profitAfterTax", "Profit After Tax", money(application.loanAmount * (0.55 + (seed % 4) * 0.12)), "Financials"),
      field("gstFiling", "GST Filing Status", pick(["Regular monthly filer", "Quarterly filer", "Composition scheme"], seed + 1), "Compliance"),
      field("udyamStatus", "Udyam Registration", pick(["Registered", "Applied", "Not applicable", "Pending update"], seed + 3), "Compliance"),
      field("averageBankCredits", "Average Monthly Bank Credits", money(application.loanAmount * 0.82), "Banking"),
      field("industry", "Industry", pick(["Retail trading", "Manufacturing", "Services", "Food and hospitality"], seed + 2), "Business"),
      field("facilityType", "Facility Type", pick(["Term loan", "Working capital", "Cash credit", "Invoice financing"], seed + 4), "Loan"),
      field("collateralOffered", "Collateral Offered", pick(["Unsecured", "Residential property", "Stock and receivables", "FD lien"], seed + 5), "Security"),
      field("bankingVintage", "Banking Vintage", `${1 + (seed % 6)} years`, "Banking"),
    ];
  }

  return [
    field("vehicleType", "Vehicle Type", pick(["New car", "Used car", "Commercial vehicle", "Two wheeler"], seed), "Vehicle"),
    field("makeModel", "Make / Model", pick(["Maruti Baleno", "Hyundai Creta", "Tata Nexon EV", "Honda Activa", "Ashok Leyland Dost"], seed + 4), "Vehicle"),
    field("dealer", "Dealer", pick(["Kothari Wheels", "Sai Service", "PPS Motors", "Landmark Cars"], seed + 1), "Vehicle"),
    field("exShowroomPrice", "Ex-showroom Price", money(application.loanAmount * 1.14), "Vehicle"),
    field("onRoadPrice", "On-road Price", money(application.loanAmount * 1.24), "Vehicle"),
    field("downPayment", "Down Payment", money(application.loanAmount * 0.16), "Funding"),
    field("fuelType", "Fuel Type", pick(["Petrol", "Diesel", "CNG", "Electric"], seed + 2), "Vehicle"),
    field("insurance", "Insurance Option", pick(["Bundled comprehensive", "Customer arranged", "Dealer bundled"], seed + 3), "Documents"),
    field("registrationCity", "Registration City", application.city, "Vehicle"),
    field("vehicleUse", "Vehicle Use", pick(["Personal", "Commercial passenger", "Commercial goods", "Fleet addition"], seed + 5), "Vehicle"),
    field("requestedTenure", "Requested Tenure", `${36 + (seed % 49)} months`, "Loan"),
  ];
}

export function buildApplicationJourney(
  product: Product,
  seed: number,
  application?: Partial<JourneySeed>,
): ApplicationJourney {
  const base = { ...defaultSeed(seed), ...application };
  const steps = productSteps[product] ?? ["Eligibility", "Details", "Documents", "Review", "Offer"];
  const completedCount = Math.min(steps.length, Math.max(5, 2 + (Math.abs(seed) % steps.length)));

  return {
    channel: pick(["DSA Digital Journey", "Assisted Partner Journey", "Borrower Self-serve Journey"], seed),
    completedSteps: steps.slice(0, completedCount),
    currentStep: steps[completedCount - 1] ?? steps[0],
    fields: fieldsForProduct(product, seed, base),
    journeyId: `JR-${productSlug(product)}-${String(seed + 1).padStart(4, "0")}`,
    name: `${product} Journey`,
    product,
  };
}

export function createJourneyApplication({
  actor,
  applicant,
  dsaId,
  dsaName,
  fieldValues = {},
  product,
  source,
}: {
  actor: string;
  applicant: JourneyApplicantInput;
  dsaId: string;
  dsaName: string;
  fieldValues?: Record<string, string>;
  product: Product;
  source: "Assisted" | "Self Serve";
}): Application {
  const seed = Date.now() % 10000;
  const journey = buildApplicationJourney(product, seed, {
    city: applicant.city,
    customer: applicant.customer,
    loanAmount: applicant.loanAmount,
    salary: applicant.salary,
  });
  const creditScore = 630 + (seed % 170);
  const riskScore = Math.max(
    32,
    Math.min(91, 82 - Math.floor((creditScore - 600) / 12) + Math.round(applicant.loanAmount / 1000000)),
  );

  return {
    aadhaar: applicant.aadhaar.length >= 4 ? `XXXX-XXXX-${applicant.aadhaar.slice(-4)}` : applicant.aadhaar,
    applicationId: `APP-J${String(Date.now()).slice(-6)}`,
    city: applicant.city,
    createdAt: new Date().toISOString(),
    creditScore,
    customer: applicant.customer,
    decisionSummary: `${product} journey submitted through ${source === "Assisted" ? "assisted Sell Now" : "customer self-serve journey"} for ${dsaName}. Queued for BRE and verification review.`,
    dsaId,
    dsaName,
    email: applicant.email,
    id: makeId("app"),
    journey: {
      ...journey,
      channel: source === "Assisted" ? "Assisted Sell Now Journey" : "Borrower Self-serve Journey",
      currentStep: "BRE",
      fields: journey.fields.map((item) => ({
        ...item,
        value: fieldValues[item.id]?.trim() ?? "",
      })),
    },
    loanAmount: applicant.loanAmount,
    mobile: applicant.mobile,
    notes: [
      `${source === "Assisted" ? "Admin filled" : "Customer submitted"} full ${product} journey.`,
      `Sourced by ${dsaName}.`,
    ],
    pan: applicant.pan.toUpperCase(),
    product,
    riskScore,
    salary: applicant.salary,
    stage: "BRE Check",
    status: "In Review",
    timeline: [
      {
        actor,
        at: new Date().toISOString(),
        id: makeId("tl"),
        note: `${product} journey completed with product-specific details.`,
        title: "Journey submitted",
      },
      {
        actor: "Cosmos Auto Desk",
        at: new Date().toISOString(),
        id: makeId("tl"),
        note: "Application created from journey payload and routed to BRE checks.",
        title: "Application created",
      },
    ],
    verificationStatus: "In Progress",
  };
}
