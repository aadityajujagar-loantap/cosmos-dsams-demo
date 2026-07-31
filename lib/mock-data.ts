import seedData from "@/lib/demo-seed-data.json";
import { DEMO_USERS } from "@/lib/demo-identities";
import { buildApplicationJourney } from "@/lib/product-journeys";
import {
  Application,
  ApprovalItem,
  AuditLog,
  BreRule,
  BusinessType,
  CibilScoreBand,
  Commission,
  DocumentRecord,
  Dsa,
  DsaInvoice,
  DsaProductConfig,
  DsaRecovery,
  GenderFilter,
  Lead,
  LoanSlab,
  MockStore,
  Notification,
  Product,
  RolePermission,
  SettingItem,
  User,
  UserRole,
  VerificationCheck,
} from "@/lib/types";

const roles: UserRole[] = [
  "Admin",
  "DSA Credit",
  "Branch Regional Head",
  "Branch User",
  "DSA Partner",
  "DSA Agent",
  "Customer",
];

const products: Product[] = [
  "Personal Loan",
  "Home Loan",
  "Loan Against Property",
  "Business Loan",
  "Auto Loan",
];

const BASE_DATE = new Date("2026-07-30T14:30:00+05:30");
const stateGstCodes: Record<string, string> = {
  Delhi: "07",
  Gujarat: "24",
  Karnataka: "29",
  Kerala: "32",
  Maharashtra: "27",
  "Madhya Pradesh": "23",
  Punjab: "03",
  Rajasthan: "08",
  "Tamil Nadu": "33",
  Telangana: "36",
  "Uttar Pradesh": "09",
  "West Bengal": "19",
};

type DsaProfile = {
  businessType: BusinessType;
  city: string;
  cityCode: string;
  contactPerson: string;
  name: string;
  pincode: string;
  state: string;
  stateCode: string;
  status: Dsa["status"];
  tier: Dsa["tier"];
};

const cosmosDsaProfiles: DsaProfile[] = [
  { businessType: "Private Limited", city: "Mumbai", cityCode: "MUM", contactPerson: "Aarav Mehta", name: "Aarohi Financial Services Pvt Ltd", pincode: "400001", state: "Maharashtra", stateCode: "MH", status: "Active", tier: "Platinum" },
  { businessType: "LLP", city: "Pune", cityCode: "PUN", contactPerson: "Nisha Kulkarni", name: "Sahyadri Credit Associates LLP", pincode: "411001", state: "Maharashtra", stateCode: "MH", status: "Active", tier: "Gold" },
  { businessType: "Partnership", city: "Nagpur", cityCode: "NAG", contactPerson: "Rohit Deshmukh", name: "Vidarbha Loan Connect", pincode: "440001", state: "Maharashtra", stateCode: "MH", status: "Active", tier: "Silver" },
  { businessType: "Private Limited", city: "Ahmedabad", cityCode: "AHM", contactPerson: "Mehul Shah", name: "Amdavad Capital Partners Pvt Ltd", pincode: "380009", state: "Gujarat", stateCode: "GJ", status: "Active", tier: "Gold" },
  { businessType: "Sole Proprietor", city: "Surat", cityCode: "SUR", contactPerson: "Krina Patel", name: "Surat Growth Finance", pincode: "395003", state: "Gujarat", stateCode: "GJ", status: "Pending Branch Approval", tier: "Bronze" },
  { businessType: "Private Limited", city: "Bengaluru", cityCode: "BLR", contactPerson: "Karthik Rao", name: "Namma Finserve Pvt Ltd", pincode: "560001", state: "Karnataka", stateCode: "KA", status: "Active", tier: "Platinum" },
  { businessType: "LLP", city: "Mysuru", cityCode: "MYS", contactPerson: "Divya Hegde", name: "Mysuru Credit Network LLP", pincode: "570001", state: "Karnataka", stateCode: "KA", status: "Active", tier: "Silver" },
  { businessType: "Private Limited", city: "Hyderabad", cityCode: "HYD", contactPerson: "Saanvi Reddy", name: "Charminar Loan Services Pvt Ltd", pincode: "500001", state: "Telangana", stateCode: "TS", status: "Active", tier: "Gold" },
  { businessType: "Sole Proprietor", city: "Warangal", cityCode: "WGL", contactPerson: "Arjun Naik", name: "Kakatiya Finance Desk", pincode: "506002", state: "Telangana", stateCode: "TS", status: "On Hold", tier: "Bronze" },
  { businessType: "Private Limited", city: "New Delhi", cityCode: "DEL", contactPerson: "Ishaan Malhotra", name: "Capital Bridge DSA Pvt Ltd", pincode: "110001", state: "Delhi", stateCode: "DL", status: "Active", tier: "Gold" },
  { businessType: "Partnership", city: "Jaipur", cityCode: "JAI", contactPerson: "Mahi Rathore", name: "Pinkcity Credit Hub", pincode: "302001", state: "Rajasthan", stateCode: "RJ", status: "Active", tier: "Silver" },
  { businessType: "Private Limited", city: "Jodhpur", cityCode: "JOD", contactPerson: "Kabir Singhvi", name: "Marwar Lending Partners Pvt Ltd", pincode: "342001", state: "Rajasthan", stateCode: "RJ", status: "Pending BRH Approval", tier: "Bronze" },
  { businessType: "LLP", city: "Chennai", cityCode: "CHN", contactPerson: "Ananya Iyer", name: "Marina Retail Finance LLP", pincode: "600001", state: "Tamil Nadu", stateCode: "TN", status: "Active", tier: "Gold" },
  { businessType: "Private Limited", city: "Coimbatore", cityCode: "CBE", contactPerson: "Vikram Narayanan", name: "Kovai Loan Channels Pvt Ltd", pincode: "641001", state: "Tamil Nadu", stateCode: "TN", status: "Active", tier: "Silver" },
  { businessType: "Partnership", city: "Kochi", cityCode: "COK", contactPerson: "Neha Menon", name: "Malabar Credit Links", pincode: "682001", state: "Kerala", stateCode: "KL", status: "Active", tier: "Silver" },
  { businessType: "LLP", city: "Thiruvananthapuram", cityCode: "TRV", contactPerson: "Aditya Nair", name: "Travancore Lending LLP", pincode: "695001", state: "Kerala", stateCode: "KL", status: "Active", tier: "Bronze" },
  { businessType: "Private Limited", city: "Indore", cityCode: "IDR", contactPerson: "Suhani Jain", name: "Malwa Finance Channels Pvt Ltd", pincode: "452001", state: "Madhya Pradesh", stateCode: "MP", status: "Active", tier: "Gold" },
  { businessType: "Sole Proprietor", city: "Bhopal", cityCode: "BHO", contactPerson: "Harsh Tiwari", name: "Lakecity Loan Desk", pincode: "462001", state: "Madhya Pradesh", stateCode: "MP", status: "Pending Credit Approval", tier: "Bronze" },
  { businessType: "Private Limited", city: "Kolkata", cityCode: "KOL", contactPerson: "Riya Banerjee", name: "Hooghly Capital Services Pvt Ltd", pincode: "700001", state: "West Bengal", stateCode: "WB", status: "Active", tier: "Gold" },
  { businessType: "LLP", city: "Siliguri", cityCode: "SLG", contactPerson: "Debjit Roy", name: "North Bengal Credit LLP", pincode: "734001", state: "West Bengal", stateCode: "WB", status: "Active", tier: "Silver" },
  { businessType: "Private Limited", city: "Lucknow", cityCode: "LKO", contactPerson: "Prisha Srivastava", name: "Awadh Finserve Pvt Ltd", pincode: "226001", state: "Uttar Pradesh", stateCode: "UP", status: "Active", tier: "Silver" },
  { businessType: "Partnership", city: "Noida", cityCode: "NOI", contactPerson: "Raghav Bansal", name: "Noida Retail Loan Partners", pincode: "201301", state: "Uttar Pradesh", stateCode: "UP", status: "Active", tier: "Gold" },
  { businessType: "Private Limited", city: "Ludhiana", cityCode: "LDH", contactPerson: "Simran Gill", name: "Punjab Growth Finance Pvt Ltd", pincode: "141001", state: "Punjab", stateCode: "PB", status: "Active", tier: "Silver" },
  { businessType: "Sole Proprietor", city: "Amritsar", cityCode: "ASR", contactPerson: "Gurpreet Sandhu", name: "Amritsar Loan Bazaar", pincode: "143001", state: "Punjab", stateCode: "PB", status: "Active", tier: "Bronze" },
  { businessType: "Private Limited", city: "Vadodara", cityCode: "BDQ", contactPerson: "Hetal Trivedi", name: "Baroda Credit Square Pvt Ltd", pincode: "390001", state: "Gujarat", stateCode: "GJ", status: "Active", tier: "Silver" },
];

const customerNames = [
  "Rohan Sharma",
  "Priya Nair",
  "Amit Verma",
  "Sneha Kapoor",
  "Kunal Joshi",
  "Meera Iyer",
  "Farhan Khan",
  "Anika Shah",
  "Dev Patel",
  "Ritika Sen",
  "Siddharth Rao",
  "Ayesha Qureshi",
];

const agentFirstNames = [
  "Aarav",
  "Nisha",
  "Rohan",
  "Meera",
  "Kabir",
  "Anika",
  "Dev",
  "Riya",
  "Ishaan",
  "Saanvi",
  "Karthik",
  "Divya",
  "Arjun",
  "Neha",
  "Vikram",
  "Prisha",
  "Raghav",
  "Simran",
  "Harsh",
  "Hetal",
];

const agentLastNames = [
  "Sharma",
  "Patel",
  "Rao",
  "Iyer",
  "Mehta",
  "Nair",
  "Kapoor",
  "Shah",
  "Kulkarni",
  "Reddy",
  "Singh",
  "Banerjee",
  "Joshi",
  "Gill",
  "Jain",
  "Verma",
];

function isoDay(daysAgo: number, hour = 14) {
  const date = new Date(BASE_DATE);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

function dsaAgentCount(dsaIndex: number) {
  return 15 + ((dsaIndex * 7 + 3) % 6);
}

function money(seed: number, min: number, spread: number) {
  return min + ((seed * 137000) % spread);
}

function dsaCode(index: number, profile: DsaProfile) {
  return `COS-DSA-${profile.stateCode}-${profile.cityCode}-${String(index + 1).padStart(3, "0")}`;
}

function pan(index: number) {
  const prefixes = ["AAROH", "SAHYA", "VIDAR", "AMDAV", "SURAT", "NAMMA", "MYSUR", "CHARM", "KAKAT", "CAPIT"];
  return `${prefixes[index % prefixes.length]}${String(1000 + index * 37).slice(-4)}${String.fromCharCode(65 + (index % 26))}`;
}

function createDsas(): Dsa[] {
  return cosmosDsaProfiles.map((profile, index) => {
    const branch = index + 1;
    const code = dsaCode(index, profile);
    const dsaPan = pan(index);
    const status = profile.status;
    const hasHoldDocs = status === "On Hold";
    return {
      address: `${profile.name}, ${profile.city} Business District`,
      approvalRate: 0,
      bank: {
        accountName: profile.name,
        accountNumber: `1029${String(28374650 + index * 3197).padStart(8, "0")}`,
        bankName: "Cosmos Co-operative Bank",
        ifsc: `COSB${String(branch).padStart(7, "0")}`,
      },
      businessType: profile.businessType,
      city: profile.city,
      code,
      commissionEarned: 0,
      contactPerson: profile.contactPerson,
      documents: ["PAN", "Aadhaar", "Bank Statement"].map((type, docIndex) => ({
        documentId: `DOC-DSA-${String(index + 1).padStart(3, "0")}-${docIndex + 1}`,
        dsaId: code,
        fileName: hasHoldDocs && docIndex === 2 ? "Missing - Bank Statement" : `${code}-${type.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        id: `doc-dsa-${index + 1}-${docIndex + 1}`,
        ownerName: profile.name,
        remarks: hasHoldDocs && docIndex === 2 ? "Mandatory document missing; held before approval." : "Verified during DSA empanelment.",
        size: hasHoldDocs && docIndex === 2 ? "0 KB" : `${230 + index * 7 + docIndex * 18} KB`,
        status: hasHoldDocs && docIndex === 2 ? "Pending" : "Verified",
        type: type as DocumentRecord["type"],
        uploadedAt: isoDay(30 - (index % 12), 11),
      })),
      email: `partner${branch}@${profile.cityCode.toLowerCase()}-cosdsa.in`,
      gst: `${stateGstCodes[profile.state] ?? "27"}${dsaPan}1Z${(index % 9) + 1}`,
      id: code,
      loginPassword: `branch${branch}@123`,
      loginUsername: `cosdsa@branch${branch}.in`,
      manager: index % 5 === 0 ? DEMO_USERS.admin.name : DEMO_USERS.branch.name,
      mobile: `88${String(70000000 + index * 7919).slice(-8)}`,
      monthlyLeads: 0,
      name: profile.name,
      onboardingDate: isoDay(45 - (index % 20), 10),
      pan: dsaPan,
      pincode: profile.pincode,
      riskRating: index % 11 === 0 ? "Medium" : "Low",
      state: profile.state,
      status,
      tier: profile.tier,
    };
  });
}

function createUsers(dsas: Dsa[]): User[] {
  const internal: User[] = [
    { email: DEMO_USERS.admin.email, id: "usr-admin", lastLogin: isoDay(0), name: DEMO_USERS.admin.name, region: "Head Office", role: "Admin", status: "Active" },
    { email: DEMO_USERS.credit.email, id: "usr-credit", lastLogin: isoDay(1), name: DEMO_USERS.credit.name, region: "Credit", role: "DSA Credit", status: "Active" },
    { email: DEMO_USERS.branch.email, id: "usr-branch", lastLogin: isoDay(2), name: DEMO_USERS.branch.name, region: "West Branch", role: "Branch User", status: "Active" },
    { email: DEMO_USERS.brh.email, id: "usr-brh", lastLogin: isoDay(2), name: DEMO_USERS.brh.name, region: "West Region", role: "Branch Regional Head", status: "Active" },
    { email: DEMO_USERS.user.email, id: "usr-user", lastLogin: isoDay(4), name: DEMO_USERS.user.name, region: "Retail", role: "Customer", status: "Active" },
  ];
  const partners = dsas.map((dsa) => ({
    dsaId: dsa.id,
    email: dsa.loginUsername,
    id: dsa.id,
    lastLogin: isoDay(3 + (dsa.id.length % 8)),
    name: dsa.name,
    region: dsa.city,
    role: "DSA Partner" as const,
    status: dsa.status === "Active" ? "Active" as const : "Invited" as const,
  }));
  const agents = dsas.flatMap((dsa, index) =>
    Array.from({ length: dsaAgentCount(index) }, (_, agentIndex) => {
      const firstName = agentFirstNames[(index * 3 + agentIndex) % agentFirstNames.length];
      const lastName = agentLastNames[(index + agentIndex * 2) % agentLastNames.length];

      return {
        dsaId: dsa.id,
        email: `agent${agentIndex + 1}.branch${index + 1}@cosdsa.in`,
        id: `agent-${index + 1}-${agentIndex + 1}`,
        lastLogin: isoDay(5 + index + agentIndex),
        name: `${firstName} ${lastName}`,
        region: dsa.city,
        role: "DSA Agent" as const,
        status: dsa.status === "Active" ? "Active" as const : "Invited" as const,
      };
    }),
  );
  return [...internal, ...partners, ...agents];
}

function createRolePermissions(): RolePermission[] {
  return roles.flatMap((role, roleIndex) =>
    ["Dashboard", "DSA", "Leads", "Applications", "BRE", "Finance", "Admin"].map((module, moduleIndex) => ({
      id: `role-${roleIndex}-${moduleIndex}`,
      module,
      permissions: {
        Approve: role === "Admin" || role === "DSA Credit",
        Create: role !== "Customer" && !(role === "DSA Partner" && module === "DSA"),
        Delete: role === "Admin",
        Edit: role !== "Customer" && !(role === "DSA Partner" && module === "DSA"),
        View: role !== "Customer" || module === "Applications",
      },
      role,
    })),
  );
}

function createLeads(dsas: Dsa[]): Lead[] {
  return dsas.flatMap((dsa, dsaIndex) =>
    Array.from({ length: 4 }, (_, leadIndex) => {
      const seed = dsaIndex * 4 + leadIndex;
      const product = products[seed % products.length];
      const customer = customerNames[seed % customerNames.length];
      const statuses: Lead["status"][] = ["New", "Contacted", "Qualified", "In Progress", "Converted", "Lost"];
      return {
        amount: money(seed + 4, 300000, 7000000),
        city: dsa.city,
        createdAt: isoDay((seed % 27) + 1, 9 + (seed % 7)),
        customer,
        dsaId: dsa.id,
        dsaName: dsa.name,
        email: `${customer.toLowerCase().replace(/\s+/g, ".")}@example.in`,
        id: `lead-${seed + 1}`,
        leadId: `LEAD-${String(seed + 1).padStart(5, "0")}`,
        mobile: `77${String(80000000 + seed * 1739).slice(-8)}`,
        nextAction: ["Call back", "Collect bank statement", "Schedule document pickup", "Send offer"][seed % 4],
        owner: dsa.contactPerson,
        product,
        source: ["Referral", "Branch", "Website", "DSA Campaign", "Partner"][seed % 5] as Lead["source"],
        status: statuses[seed % statuses.length],
      };
    }),
  );
}

function createApplications(dsas: Dsa[]): Application[] {
  const stages: Application["stage"][] = ["Document Review", "BRE Check", "Credit Underwriting", "Risk Review", "Approval", "Disbursal"];
  const statuses: Application["status"][] = ["In Review", "Approved", "Disbursed", "On Hold", "Rejected"];
  return dsas.flatMap((dsa, dsaIndex) =>
    Array.from({ length: dsa.status === "Active" ? 3 : 1 }, (_, appIndex) => {
      const seed = dsaIndex * 3 + appIndex;
      const product = products[(seed + dsaIndex) % products.length];
      const status = statuses[seed % statuses.length];
      const stage = status === "Disbursed" ? "Disbursal" : status === "Approved" ? "Approval" : stages[seed % stages.length];
      const customer = customerNames[(seed + 2) % customerNames.length];
      const loanAmount = money(seed + 9, 450000, 9200000);
      const salary = money(seed + 3, 38000, 210000);
      const creditScore = 642 + ((seed * 23) % 205);
      return {
        aadhaar: `XXXX-XXXX-${String(4300 + seed * 17).slice(-4)}`,
        applicationId: `APP-${String(seed + 1).padStart(5, "0")}`,
        city: dsa.city,
        createdAt: isoDay((seed % 33) + 1, 10 + (seed % 5)),
        creditScore,
        customer,
        decisionSummary: `${product} application sourced by ${dsa.name}. Current workflow status: ${status}.`,
        dsaId: dsa.id,
        dsaName: dsa.name,
        email: `${customer.toLowerCase().replace(/\s+/g, ".")}${seed}@example.in`,
        id: `app-${seed + 1}`,
        journey: buildApplicationJourney(product, seed, { city: dsa.city, customer, loanAmount, salary }),
        loanAmount,
        mobile: `98${String(60000000 + seed * 2129).slice(-8)}`,
        notes: [`Sourced through ${dsa.city} partner network.`, `BRE score: ${creditScore}.`],
        pan: pan(seed + 6),
        product,
        riskScore: 35 + ((seed * 7) % 56),
        salary,
        stage,
        status,
        timeline: [
          { actor: dsa.contactPerson, at: isoDay((seed % 20) + 1, 11), id: `tl-${seed}-1`, note: "Application captured through DSA channel.", title: "Application created" },
          { actor: "Cosmos Auto BRE", at: isoDay(seed % 12, 15), id: `tl-${seed}-2`, note: `Moved to ${stage}.`, title: stage },
        ],
        verificationStatus: status === "Rejected" ? "Failed" : status === "Disbursed" || status === "Approved" ? "Verified" : "In Progress",
      };
    }),
  );
}

function createDocuments(dsas: Dsa[], applications: Application[]): DocumentRecord[] {
  const appDocs = applications.flatMap((application, index) =>
    ["PAN", "Bank Statement"].map((type, docIndex) => ({
      applicationId: application.applicationId,
      documentId: `DOC-APP-${String(index + 1).padStart(4, "0")}-${docIndex + 1}`,
      fileName: `${application.applicationId}-${type.toLowerCase().replace(/\s+/g, "-")}.pdf`,
      id: `doc-app-${index + 1}-${docIndex + 1}`,
      ownerName: application.customer,
      remarks: application.verificationStatus === "Verified" ? "Verified by operations." : "Pending operations review.",
      size: `${180 + index * 5 + docIndex * 21} KB`,
      status: application.verificationStatus,
      type: type as DocumentRecord["type"],
      uploadedAt: application.createdAt,
    })),
  );
  return [...dsas.flatMap((dsa) => dsa.documents), ...appDocs];
}

function createVerificationChecks(applications: Application[]): VerificationCheck[] {
  return applications.map((application, index) => ({
    applicationId: application.applicationId,
    assignedTo: index % 3 === 0 ? DEMO_USERS.credit.name : DEMO_USERS.branch.name,
    checkId: `VER-${String(index + 1).padStart(5, "0")}`,
    customer: application.customer,
    dueDate: isoDay(Math.max(0, 4 - (index % 4)), 18),
    evidence: application.verificationStatus === "Verified" ? "KYC and banking evidence matched." : "Awaiting field confirmation.",
    id: `verify-${index + 1}`,
    status: application.verificationStatus,
    type: ["KYC", "Address", "Employment", "Bank"][index % 4] as VerificationCheck["type"],
  }));
}

function createApprovals(applications: Application[]): ApprovalItem[] {
  return applications
    .filter((application) => application.status === "In Review" || application.status === "On Hold" || application.status === "Approved")
    .slice(0, 42)
    .map((application, index) => ({
      applicationId: application.applicationId,
      approver: index % 2 === 0 ? DEMO_USERS.credit.name : DEMO_USERS.brh.name,
      customer: application.customer,
      history: [
        { actor: DEMO_USERS.branch.name, at: application.createdAt, id: `approval-tl-${index + 1}-1`, note: "Maker stage completed.", title: "Maker submitted" },
      ],
      id: `approval-${index + 1}`,
      stage: ["Maker", "Checker", "Risk Review", "Final Approval"][index % 4] as ApprovalItem["stage"],
      status: application.status === "Approved" ? "Approved" : "Pending",
      updatedAt: isoDay(index % 16, 12),
      workflowId: `WF-${String(index + 1).padStart(5, "0")}`,
    }));
}

function createProductConfigs(dsas: Dsa[]): DsaProductConfig[] {
  return dsas
    .filter((dsa) => dsa.status === "Active")
    .flatMap((dsa, dsaIndex) =>
      products.slice(0, 3 + (dsaIndex % 2)).map((product, productIndex) => {
        const id = `config-${dsaIndex + 1}-${productIndex + 1}`;
        return {
          bannerName: `${dsa.city} ${product} Campaign`,
          commissionType: productIndex % 3 === 0 ? "Percentage-based" : productIndex % 3 === 1 ? "Tiered" : "Fixed-fee",
          configuredAt: isoDay((dsaIndex + productIndex) % 20, 13),
          configuredBy: DEMO_USERS.admin.name,
          dsaCode: dsa.code,
          dsaId: dsa.id,
          dsaName: dsa.name,
          id,
          loanUrl: `/journey/${id}`,
          product,
          ranges: [
            { effectiveDate: "2026-04-01", endDate: "2027-03-31", frequency: "Monthly", id: `${id}-r1`, max: 2500000, min: 0, rate: 0.75 + productIndex * 0.15 },
            { effectiveDate: "2026-04-01", endDate: "2027-03-31", frequency: "Monthly", growthRequired: true, id: `${id}-r2`, max: 10000000, min: 2500001, rate: 1.1 + productIndex * 0.2 },
          ],
          status: "Active",
        };
      }),
    );
}

function createCommissions(dsas: Dsa[], applications: Application[]): Commission[] {
  return dsas.flatMap((dsa, dsaIndex) =>
    ["May 2026", "Jun 2026", "Jul 2026"].map((month, monthIndex) => {
      const dsaApps = applications.filter((application) => application.dsaId === dsa.id);
      const disbursed = dsaApps
        .filter((application) => application.status === "Disbursed" || application.status === "Approved")
        .reduce((sum, application) => sum + application.loanAmount, 0);
      const rate = 0.65 + ((dsaIndex + monthIndex) % 5) * 0.18;
      const payout = Math.round((Math.max(disbursed, 650000 + dsaIndex * 88000) * rate) / 100);
      return {
        applications: Math.max(1, dsaApps.length + monthIndex),
        disbursedAmount: Math.max(disbursed, 650000 + dsaIndex * 88000),
        dsaId: dsa.id,
        dsaName: dsa.name,
        id: `commission-${dsaIndex + 1}-${monthIndex + 1}`,
        month,
        payout,
        payoutId: `PAY-${String(dsaIndex + 1).padStart(3, "0")}-${monthIndex + 1}`,
        product: products[(dsaIndex + monthIndex) % products.length],
        rate,
        status: monthIndex === 2 ? "Pending" : dsaIndex % 7 === 0 ? "Hold" : "Processed",
      };
    }),
  );
}

function createDsaInvoices(dsas: Dsa[], commissions: Commission[]): DsaInvoice[] {
  const statuses: DsaInvoice["status"][] = ["Raised by DSA", "Pending Approval", "Countered by Bank", "Approved", "Rejected"];
  return dsas.map((dsa, index) => {
    const grossAmount = commissions.filter((commission) => commission.dsaId === dsa.id).reduce((sum, commission) => sum + commission.payout, 0);
    const adjustmentAmount = index % 5 === 0 ? 2500 : index % 6 === 0 ? 5000 : 0;
    const taxAmount = Math.round(grossAmount * 0.18);
    const requestedAmount = grossAmount - adjustmentAmount + taxAmount;
    const status = statuses[index % statuses.length];
    return {
      adjustmentAmount,
      approvedAmount: status === "Approved" ? requestedAmount : undefined,
      createdAt: isoDay(index % 18, 16),
      dsaCode: dsa.code,
      dsaId: dsa.id,
      dsaName: dsa.name,
      grossAmount,
      history: [
        {
          action: "Raised",
          actor: dsa.contactPerson,
          amount: requestedAmount,
          at: isoDay(index % 18, 16),
          id: `inv-event-${index + 1}-1`,
          note: "Monthly commission invoice raised for Cosmos review.",
          party: "DSA",
        },
      ],
      id: `invoice-${index + 1}`,
      invoiceNumber: `INV-COS-${String(index + 1).padStart(4, "0")}`,
      month: "Jul 2026",
      netAmount: grossAmount - adjustmentAmount,
      raisedBy: dsa.contactPerson,
      raisedByRole: "DSA Partner",
      remarks: status === "Approved" ? "Approved after reconciliation." : "Awaiting workflow action.",
      requestedAmount,
      source: "Manual",
      status,
      taxAmount,
      updatedAt: isoDay(index % 9, 17),
    };
  });
}

function createRecovery(dsas: Dsa[]): DsaRecovery[] {
  return dsas.flatMap((dsa, dsaIndex) =>
    ["Apr 2026", "May 2026", "Jun 2026", "Jul 2026"].map((month, monthIndex) => {
      const targetAmount = 180000 + dsaIndex * 9000 + monthIndex * 12000;
      const recoveredAmount = Math.round(targetAmount * (0.72 + ((dsaIndex + monthIndex) % 7) * 0.055));
      const carryForwardIn = monthIndex === 0 ? 0 : Math.max(0, targetAmount - recoveredAmount);
      const carryForwardOut = Math.max(0, targetAmount - recoveredAmount);
      return {
        carryForwardIn,
        carryForwardOut,
        dsaId: dsa.id,
        dsaName: dsa.name,
        id: `recovery-${dsaIndex + 1}-${monthIndex + 1}`,
        invoiceAmount: Math.max(0, recoveredAmount - carryForwardIn),
        month,
        npaCases: (dsaIndex + monthIndex) % 5 === 0 ? 1 + (dsaIndex % 3) : 0,
        pendingAmount: Math.max(0, targetAmount - recoveredAmount),
        recoveredAmount,
        targetAmount,
        totalBilling: recoveredAmount + Math.round(recoveredAmount * 0.12),
        totalCases: 18 + ((dsaIndex + monthIndex) % 14),
        zone: dsa.code.split("-")[2] ?? dsa.state,
      };
    }),
  );
}

function createLoanSlabs(): LoanSlab[] {
  const bands: CibilScoreBand[] = ["Above 800", "751-800", "700-750", "Below 700"];
  const genders: GenderFilter[] = ["All", "Male", "Female"];
  return products.flatMap((product, productIndex) =>
    bands.map((band, bandIndex) => ({
      cibilScoreBand: band,
      createdAt: isoDay(productIndex + bandIndex, 10),
      createdBy: DEMO_USERS.credit.name,
      gender: genders[(productIndex + bandIndex) % genders.length],
      id: `slab-${productIndex + 1}-${bandIndex + 1}`,
      maxLoanAmount: 500000 + productIndex * 850000 + bandIndex * 450000,
      maxLoanPeriodMonths: 36 + productIndex * 24 + bandIndex * 12,
      product,
      roiFixed: 8.85 + productIndex * 0.35 + bandIndex * 0.25,
      roiFloating: 8.25 + productIndex * 0.3 + bandIndex * 0.2,
      schemeName: `${product} ${band} Scheme`,
    })),
  );
}

function createAuditLogs(dsas: Dsa[], applications: Application[], invoices: DsaInvoice[]): AuditLog[] {
  const rows: AuditLog[] = [
    ...dsas.slice(0, 16).map((dsa, index) => ({
      action: dsa.status === "Active" ? "DSA Approval" : "Hierarchy Workflow",
      actionType: dsa.status === "Active" ? "DSA Approval" : "Hierarchy Workflow",
      actor: index % 2 === 0 ? DEMO_USERS.branch.name : DEMO_USERS.credit.name,
      actorId: index % 2 === 0 ? DEMO_USERS.branch.id : DEMO_USERS.credit.id,
      actorRole: (index % 2 === 0 ? "Branch User" : "DSA Credit") as AuditLog["actorRole"],
      affectedDsaId: dsa.id,
      affectedDsaName: dsa.name,
      at: isoDay(index % 18, 12),
      changedFields: ["status"],
      collection: "dsas" as const,
      entity: "Dsas",
      entityId: dsa.id,
      entityName: dsa.name,
      id: `audit-dsa-${index + 1}`,
      ipAddress: "10.24.0.91",
      severity: "Info" as const,
      summary: `${dsa.name} moved to ${dsa.status}.`,
      toValue: `status: ${dsa.status}`,
    })),
    ...applications.slice(0, 18).map((application, index) => ({
      action: application.status === "Approved" ? "Application Approval" : "Application Workflow",
      actionType: application.status === "Approved" ? "Application Approval" : "Application Workflow",
      actor: DEMO_USERS.credit.name,
      actorId: DEMO_USERS.credit.id,
      actorRole: "DSA Credit" as const,
      affectedDsaId: application.dsaId,
      affectedDsaName: application.dsaName,
      at: isoDay(index % 12, 15),
      changedFields: ["stage", "status"],
      collection: "applications" as const,
      entity: "Applications",
      entityId: application.id,
      entityName: application.applicationId,
      id: `audit-app-${index + 1}`,
      ipAddress: "10.24.0.92",
      severity: (application.status === "Rejected" ? "Warning" : "Info") as AuditLog["severity"],
      summary: `${application.applicationId} is ${application.status} at ${application.stage}.`,
      toValue: `status: ${application.status}`,
    })),
    ...invoices.slice(0, 12).map((invoice, index) => ({
      action: "Invoice Workflow",
      actionType: "Invoice Workflow",
      actor: index % 2 === 0 ? DEMO_USERS.admin.name : DEMO_USERS.credit.name,
      actorId: index % 2 === 0 ? DEMO_USERS.admin.id : DEMO_USERS.credit.id,
      actorRole: (index % 2 === 0 ? "DSA Manager" : "DSA Credit") as AuditLog["actorRole"],
      affectedDsaId: invoice.dsaId,
      affectedDsaName: invoice.dsaName,
      at: invoice.updatedAt,
      changedFields: ["status"],
      collection: "dsaInvoices" as const,
      entity: "Dsa Invoices",
      entityId: invoice.id,
      entityName: invoice.invoiceNumber,
      id: `audit-invoice-${index + 1}`,
      ipAddress: "10.24.0.93",
      severity: (invoice.status === "Rejected" ? "Warning" : "Info") as AuditLog["severity"],
      summary: `${invoice.invoiceNumber} is ${invoice.status}.`,
      toValue: `status: ${invoice.status}`,
    })),
  ];
  return rows.sort((left, right) => right.at.localeCompare(left.at));
}

function createNotifications(dsas: Dsa[], applications: Application[], invoices: DsaInvoice[]): Notification[] {
  return [
    {
      body: `${dsas.filter((dsa) => dsa.status !== "Active").length} DSA onboarding files need hierarchy action.`,
      category: "Workflow",
      createdAt: isoDay(0, 9),
      href: "/dsa/management",
      id: "note-dsa-queue",
      priority: "High",
      status: "Unread",
      title: "DSA approval queue pending",
    },
    {
      body: `${applications.filter((application) => application.status === "On Hold").length} applications are waiting on document or deviation clearance.`,
      category: "Risk",
      createdAt: isoDay(1, 10),
      href: "/applications",
      id: "note-app-hold",
      priority: "Medium",
      status: "Unread",
      title: "Application holds need review",
    },
    {
      body: `${invoices.filter((invoice) => !["Approved", "Rejected"].includes(invoice.status)).length} invoices need finance action.`,
      category: "Payout",
      createdAt: isoDay(2, 11),
      href: "/finance/invoices",
      id: "note-invoice-queue",
      priority: "High",
      status: "Unread",
      title: "Invoice actions pending",
    },
  ];
}

function createSettings(): SettingItem[] {
  return [
    ["Branding", "Head bank", seedData.bank.name, true],
    ["General", "DSA code format", "COS-DSA-<STATE>-<CITY>-###", true],
    ["Security", "DSA credential pattern", seedData.bank.dsaProgram.credentialStrategy.usernamePattern, true],
  ].map(([section, label, value, enabled], index) => ({
    enabled: enabled as boolean,
    id: `setting-${index + 1}`,
    label: label as string,
    section: section as SettingItem["section"],
    value: value as string,
  }));
}

function withMetrics(dsas: Dsa[], leads: Lead[], applications: Application[], commissions: Commission[]): Dsa[] {
  return dsas.map((dsa) => {
    const dsaApplications = applications.filter((application) => application.dsaId === dsa.id);
    const approvals = dsaApplications.filter((application) => application.status === "Approved" || application.status === "Disbursed").length;
    return {
      ...dsa,
      approvalRate: dsaApplications.length ? Math.round((approvals / dsaApplications.length) * 100) : 0,
      commissionEarned: commissions.filter((commission) => commission.dsaId === dsa.id).reduce((sum, commission) => sum + commission.payout, 0),
      monthlyLeads: leads.filter((lead) => lead.dsaId === dsa.id).length,
    };
  });
}

export function createMockStore(): MockStore {
  const baseDsas = createDsas();
  const leads = createLeads(baseDsas);
  const applications = createApplications(baseDsas);
  const commissions = createCommissions(baseDsas, applications);
  const dsas = withMetrics(baseDsas, leads, applications, commissions);
  const dsaInvoices = createDsaInvoices(dsas, commissions);

  return {
    applications,
    approvals: createApprovals(applications),
    auditLogs: createAuditLogs(dsas, applications, dsaInvoices),
    breRules: [] as BreRule[],
    commissions,
    documents: createDocuments(dsas, applications),
    dsaInvoices,
    dsaProductConfigs: createProductConfigs(dsas),
    dsaRecovery: createRecovery(dsas),
    dsas,
    leads,
    loanSlabs: createLoanSlabs(),
    notifications: createNotifications(dsas, applications, dsaInvoices),
    roles: createRolePermissions(),
    settings: createSettings(),
    users: createUsers(dsas),
    verificationChecks: createVerificationChecks(applications),
  };
}
