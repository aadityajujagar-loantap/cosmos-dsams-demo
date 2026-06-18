import {
  ApprovalItem,
  ApprovalStage,
  Application,
  ApplicationStage,
  ApplicationStatus,
  AuditLog,
  BreRule,
  BusinessType,
  CibilScoreBand,
  Commission,
  DocumentRecord,
  DocumentType,
  Dsa,
  DsaProductConfig,
  DsaStatus,
  GenderFilter,
  Lead,
  LeadStatus,
  LoanSlab,
  MockStore,
  Notification,
  Product,
  RolePermission,
  SettingItem,
  User,
  UserRole,
  VerificationCheck,
  VerificationStatus,
} from "@/lib/types";
import { DEMO_USERS, demoActor } from "@/lib/demo-identities";
import { journeyPath } from "@/lib/journey-links";
import { buildApplicationJourney } from "@/lib/product-journeys";

const states = [
  ["Mumbai", "Maharashtra", "400001"],
  ["Pune", "Maharashtra", "411006"],
  ["Bengaluru", "Karnataka", "560001"],
  ["Hyderabad", "Telangana", "500001"],
  ["Delhi", "Delhi", "110001"],
  ["Chennai", "Tamil Nadu", "600001"],
  ["Ahmedabad", "Gujarat", "380001"],
  ["Jaipur", "Rajasthan", "302001"],
  ["Kolkata", "West Bengal", "700001"],
  ["Indore", "Madhya Pradesh", "452001"],
];

const firstNames = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Vihaan",
  "Arjun",
  "Sai",
  "Ishaan",
  "Reyansh",
  "Ananya",
  "Diya",
  "Myra",
  "Kavya",
  "Aanya",
  "Saanvi",
  "Naira",
  "Meera",
  "Riya",
  "Tara",
  "Kabir",
  "Rohan",
];

const lastNames = [
  "Sharma",
  "Patel",
  "Iyer",
  "Kapoor",
  "Nair",
  "Mehta",
  "Reddy",
  "Gupta",
  "Kulkarni",
  "Agarwal",
  "Bose",
  "Menon",
  "Joshi",
  "Chopra",
  "Desai",
];

const products: Product[] = [
  "Personal Loan",
  "Home Loan",
  "Loan Against Property",
  "Business Loan",
  "Auto Loan",
];

const businessTypes: BusinessType[] = [
  "Sole Proprietor",
  "Partnership",
  "LLP",
  "Private Limited",
  "Public Limited",
];

const dsaStatuses: DsaStatus[] = [
  "Active",
  "Active",
  "KYC Pending",
  "Submitted",
  "Pending Credit Approval",
  "Suspended",
  "Rejected",
];

const leadStatuses: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "In Progress",
  "Converted",
  "Lost",
];

const verificationStatuses: VerificationStatus[] = [
  "Pending",
  "In Progress",
  "Verified",
  "Failed",
];

const roles: UserRole[] = [
  "Admin",
  "DSA Credit",
  "Branch User",
  "DSA Partner",
  "Customer",
];

const managers = [
  DEMO_USERS.admin.name,
  DEMO_USERS.credit.name,
  DEMO_USERS.branch.name,
  DEMO_USERS.dsa.name,
];

const months = [
  "Jan 2026",
  "Feb 2026",
  "Mar 2026",
  "Apr 2026",
  "May 2026",
  "Jun 2026",
];

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function person(index: number) {
  return `${pick(firstNames, index)} ${pick(lastNames, index * 3)}`;
}

function isoDay(daysAgo: number) {
  const date = new Date("2026-06-09T09:00:00+05:30");
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function mobile(index: number) {
  return `9${(843200000 + index * 7919).toString().slice(0, 9)}`;
}

function pan(index: number) {
  const suffix = (1000 + index).toString();
  return `ABCP${String.fromCharCode(65 + (index % 20))}${suffix}Q`;
}

function aadhaar(index: number) {
  return `XXXX-XXXX-${(2100 + index * 17).toString().slice(0, 4)}`;
}

function document(
  index: number,
  ownerName: string,
  type: DocumentType,
  applicationId?: string,
  dsaId?: string,
): DocumentRecord {
  return {
    id: `doc-${index}`,
    applicationId,
    dsaId,
    documentId: `DOC-${String(index).padStart(5, "0")}`,
    fileName: `${type.toLowerCase().replace(" ", "-")}-${index}.pdf`,
    ownerName,
    remarks: pick(
      ["Clean OCR match", "Name mismatch flagged", "Awaiting re-upload", "Verified against source"],
      index,
    ),
    size: `${180 + index * 7} KB`,
    status: pick(verificationStatuses, index),
    type,
    uploadedAt: isoDay(index % 24),
  };
}

function timeline(seed: number) {
  return [
    {
      actor: pick(managers, seed),
      at: isoDay(seed + 6),
      id: `tl-${seed}-1`,
      note: "Lead accepted by sales operations and assigned for document collection.",
      title: "Application created",
    },
    {
      actor: "System BRE",
      at: isoDay(seed + 4),
      id: `tl-${seed}-2`,
      note: "Primary eligibility rules evaluated with bureau and income signals.",
      title: "BRE check completed",
    },
    {
      actor: pick(["Credit Desk", "Risk Desk", "Ops Desk"], seed),
      at: isoDay(seed + 2),
      id: `tl-${seed}-3`,
      note: "Manual review completed with two open evidence items.",
      title: "Verification updated",
    },
  ];
}

export function createMockStore(): MockStore {
  const users: User[] = [
    {
      email: DEMO_USERS.admin.email,
      id: "usr-admin",
      lastLogin: isoDay(0),
      name: DEMO_USERS.admin.name,
      region: "West",
      role: "Admin",
      status: "Active",
    },
    {
      email: DEMO_USERS.credit.email,
      id: "usr-credit",
      lastLogin: isoDay(1),
      name: DEMO_USERS.credit.name,
      region: "West",
      role: "DSA Credit",
      status: "Active",
    },
    {
      email: DEMO_USERS.branch.email,
      id: "usr-branch",
      lastLogin: isoDay(2),
      name: DEMO_USERS.branch.name,
      region: "West",
      role: "Branch User",
      status: "Active",
    },
    {
      email: DEMO_USERS.dsa.email,
      id: "usr-dsa",
      lastLogin: isoDay(3),
      name: DEMO_USERS.dsa.name,
      region: "West",
      role: "DSA Partner",
      status: "Active",
    },
    {
      email: DEMO_USERS.user.email,
      id: "usr-user",
      lastLogin: isoDay(4),
      name: DEMO_USERS.user.name,
      region: "West",
      role: "Customer",
      status: "Active",
    },
  ];

  const dsas: Dsa[] = Array.from({ length: 56 }, (_, index) => {
    const city = pick(states, index);
    const name = `${pick(["Cosmos", "Prime", "Apex", "Nexora", "Credence", "BluePeak"], index)} ${pick(
      ["Financial Services", "Capital Partners", "Loan Point", "Credit Advisors", "Finserv"],
      index + 2,
    )}`;
    const dsaDocs = [
      document(index * 3 + 1, name, "PAN", undefined, `dsa-${index + 1}`),
      document(index * 3 + 2, name, "Aadhaar", undefined, `dsa-${index + 1}`),
    ];

    return {
      address: `${21 + index}, ${pick(["Market Road", "MG Road", "Ring Road", "Station Road"], index)}`,
      approvalRate: 42 + ((index * 7) % 48),
      bank: {
        accountName: name,
        accountNumber: `10${index}92837465${index}`,
        bankName: pick(["HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank"], index),
        ifsc: `CBIN0${String(30000 + index).padStart(6, "0")}`,
      },
      businessType: pick(businessTypes, index),
      city: city[0],
      code: `DSA-${String(index + 1).padStart(4, "0")}`,
      commissionEarned: 86000 + index * 9400,
      contactPerson: person(index),
      documents: dsaDocs,
      email: `partner${index + 1}@${name.toLowerCase().replaceAll(" ", "")}.example`,
      gst: `27${pan(index).slice(0, 10)}1Z${index % 9}`,
      id: `dsa-${index + 1}`,
      manager:
        index % 11 === 0
          ? DEMO_USERS.branch.name
          : index % 8 === 0
            ? DEMO_USERS.dsa.name
            : DEMO_USERS.admin.name,
      mobile: mobile(index),
      monthlyLeads: 12 + ((index * 5) % 62),
      name,
      onboardingDate: isoDay(index + 6),
      pan: pan(index),
      pincode: city[2],
      riskRating: pick(["Low", "Medium", "High"], index),
      state: city[1],
      status: pick(dsaStatuses, index),
      tier: pick(["Bronze", "Silver", "Gold", "Platinum"], index),
    };
  });

  const leads: Lead[] = Array.from({ length: 128 }, (_, index) => {
    const customer = person(index + 30);
    const dsa = pick(dsas, index);
    const city = pick(states, index + 4);
    
    const isDemoCustomer = index === 4 || index === 10;
    const finalCustomer = isDemoCustomer ? DEMO_USERS.user.name : customer;
    const finalMobile = isDemoCustomer ? DEMO_USERS.user.mobile : mobile(index + 100);
    const finalEmail = isDemoCustomer ? DEMO_USERS.user.email : `${customer.toLowerCase().replace(" ", ".")}@example.com`;

    return {
      amount: 250000 + ((index * 137000) % 4200000),
      city: city[0],
      createdAt: isoDay(index % 48),
      customer: finalCustomer,
      dsaId: dsa.id,
      dsaName: dsa.name,
      email: finalEmail,
      id: `lead-${index + 1}`,
      leadId: `LD-${String(index + 1).padStart(5, "0")}`,
      mobile: finalMobile,
      nextAction: pick(
        ["Collect bank statement", "Schedule verification", "Call back", "Send product quote"],
        index,
      ),
      owner: pick(managers, index),
      product: pick(products, index),
      source: pick(["Referral", "Branch", "Website", "DSA Campaign", "Partner"], index),
      status: pick(leadStatuses, index),
    };
  });

  const applications: Application[] = Array.from({ length: 64 }, (_, index) => {
    const lead = index === 2 ? leads[4] : index === 5 ? leads[10] : pick(leads, index * 2);
    const score = 52 + ((index * 9) % 46);
    const salary = 28000 + ((index * 5300) % 180000);
    return {
      aadhaar: aadhaar(index),
      applicationId: `APP-${String(index + 1).padStart(5, "0")}`,
      city: lead.city,
      createdAt: isoDay(index % 36),
      creditScore: 610 + ((index * 17) % 210),
      customer: lead.customer,
      decisionSummary: pick(
        [
          "Eligible with standard income documentation.",
          "Manual review required due to bureau deviation.",
          "Low risk profile with strong repayment indicators.",
          "Hold until address verification is closed.",
        ],
        index,
      ),
      dsaId: lead.dsaId,
      dsaName: lead.dsaName,
      email: lead.email,
      id: `app-${index + 1}`,
      loanAmount: lead.amount,
      mobile: lead.mobile,
      journey: buildApplicationJourney(lead.product, index, {
        city: lead.city,
        customer: lead.customer,
        loanAmount: lead.amount,
        salary,
      }),
      notes: [
        "Customer requested flexible EMI date.",
        "DSA confirmed all documents collected.",
        "Risk desk asked for one additional clarification.",
      ],
      pan: pan(index + 120),
      product: lead.product,
      riskScore: score,
      salary,
      stage: pick(
        [
          "Lead Capture",
          "Document Review",
          "BRE Check",
          "Credit Underwriting",
          "Risk Review",
          "Approval",
          "Disbursal",
        ],
        index,
      ),
      status: pick(["Draft", "In Review", "Approved", "Rejected", "Disbursed", "On Hold"], index),
      timeline: timeline(index),
      verificationStatus: pick(verificationStatuses, index + 1),
    };
  });

  const dsaProductConfigs: DsaProductConfig[] = dsas
    .filter((dsa) => dsa.status === "Active")
    .slice(0, 12)
    .flatMap((dsa, dsaIndex) =>
      products.slice(0, dsaIndex % 3 === 0 ? 2 : 1).map((product, productIndex) => {
        const id = `dsa-product-${dsaIndex + 1}-${productIndex + 1}`;
        return {
          bannerName: `${product.toLowerCase().replaceAll(" ", "-")}-banner.png`,
          commissionType: pick(["Percentage-based", "Tiered"], dsaIndex + productIndex),
          configuredAt: isoDay(dsaIndex + productIndex),
          configuredBy: DEMO_USERS.admin.name,
          dsaCode: dsa.code,
          dsaId: dsa.id,
          dsaName: dsa.name,
          id,
          loanUrl: journeyPath(id),
          product,
          ranges: [
            {
              effectiveDate: "2026-06-01",
              endDate: "2027-06-01",
              frequency: "Monthly",
              id: `${product.slice(0, 2).toUpperCase()}-${dsaIndex + 1}-${productIndex + 1}`,
              max: 3000000 + productIndex * 2000000,
              min: 500000,
              rate: 0.5 + productIndex * 0.25,
            },
          ],
          status: "Active" as const,
        };
      }),
    );

  applications.push(
    ...dsaProductConfigs.slice(0, 14).flatMap((config, configIndex) => {
      const dsa = dsas.find((item) => item.id === config.dsaId);
      return [0, 1].map((inner) => {
        const seed = 300 + configIndex * 2 + inner;
        const customer = person(seed);
        const loanAmount = 400000 + ((seed * 91000) % 3200000);
        const salary = 35000 + ((seed * 3200) % 140000);
        return {
          aadhaar: aadhaar(seed),
          applicationId: `APP-D${String(configIndex * 2 + inner + 1).padStart(4, "0")}`,
          city: dsa?.city ?? pick(states, seed)[0],
          createdAt: isoDay(seed % 30),
          creditScore: 650 + ((seed * 11) % 160),
          customer,
          decisionSummary: "Demo product-linked application for DSA profile product filtering.",
          dsaId: config.dsaId,
          dsaName: config.dsaName,
          email: `${customer.toLowerCase().replace(" ", ".")}@example.com`,
          id: `app-product-demo-${configIndex + 1}-${inner + 1}`,
          loanAmount,
          mobile: mobile(seed),
          journey: buildApplicationJourney(config.product, seed, {
            city: dsa?.city ?? pick(states, seed)[0],
            customer,
            loanAmount,
            salary,
          }),
          notes: [
            `Application mapped to configured ${config.product}.`,
            "Dummy record added for DSA profile product filtering.",
          ],
          pan: pan(seed),
          product: config.product,
          riskScore: 48 + ((seed * 7) % 45),
          salary,
          stage: pick(
            [
              "Lead Capture",
              "Document Review",
              "BRE Check",
              "Credit Underwriting",
              "Risk Review",
              "Approval",
              "Disbursal",
            ] as ApplicationStage[],
            seed,
          ),
          status: pick(["Draft", "In Review", "Approved", "Rejected", "Disbursed", "On Hold"] as ApplicationStatus[], seed),
          timeline: timeline(seed),
          verificationStatus: pick(verificationStatuses, seed),
        };
      });
    }),
  );


  const documents = [
    ...dsas.flatMap((dsa) => dsa.documents),
    ...applications.flatMap((application, index) => [
      document(200 + index * 2, application.customer, "Salary Slip", application.id),
      document(201 + index * 2, application.customer, "Bank Statement", application.id),
    ]),
  ];

  const breRules: BreRule[] = Array.from({ length: 24 }, (_, index) => ({
    conditions: [
      {
        field: pick(["Age", "Salary", "Credit Score", "FOIR", "Loan Amount"], index),
        id: `cond-${index}-1`,
        operator: pick([">", ">=", "<=", "="], index),
        value: pick(["21", "25000", "700", "55", "500000"], index),
      },
      {
        field: pick(["Residence Stability", "Bureau Hit", "Employment Type"], index),
        id: `cond-${index}-2`,
        operator: pick([">=", "=", "contains"], index),
        value: pick(["12 months", "Positive", "Salaried"], index),
      },
    ],
    id: `rule-${index + 1}`,
    operator: pick(["AND", "OR"], index),
    outcome: pick(["Auto approve", "Route to risk", "Reject", "Ask for documents"], index),
    priority: index + 1,
    product: pick(products, index),
    ruleCode: `BRE-${String(index + 1).padStart(3, "0")}`,
    ruleName: pick(
      [
        "Age > 21",
        "Salary > 25000",
        "Credit Score > 700",
        "Low FOIR Guardrail",
        "High Ticket Risk Review",
      ],
      index,
    ),
    status: pick(["Active", "Active", "Draft", "Inactive"], index),
    updatedAt: isoDay(index % 18),
  }));

  const verificationChecks: VerificationCheck[] = applications.flatMap((application, index) =>
    ["KYC", "Address", "Employment", "Bank"].map((type, inner) => ({
      applicationId: application.applicationId,
      assignedTo: pick(users, index + inner).name,
      checkId: `VER-${String(index * 4 + inner + 1).padStart(5, "0")}`,
      customer: application.customer,
      dueDate: isoDay(Math.max(1, 10 - inner - (index % 5))),
      evidence: pick(
        ["PAN NSDL match", "Geo-tag pending", "Employer email sent", "Penny drop verified"],
        inner,
      ),
      id: `ver-${index * 4 + inner + 1}`,
      status: pick(verificationStatuses, index + inner),
      type: type as VerificationCheck["type"],
    })),
  );

  const approvals: ApprovalItem[] = applications.slice(0, 42).map((application, index) => ({
    applicationId: application.applicationId,
    approver: pick(users, index + 3).name,
    customer: application.customer,
    history: timeline(index + 80),
    id: `approval-${index + 1}`,
    stage: pick(["Maker", "Checker", "Risk Review", "Final Approval"] as ApprovalStage[], index),
    status: pick(["Pending", "Approved", "Returned", "Rejected"], index),
    updatedAt: isoDay(index % 22),
    workflowId: `WF-${String(index + 1).padStart(5, "0")}`,
  }));

  const commissions: Commission[] = Array.from({ length: 78 }, (_, index) => {
    const dsa = pick(dsas, index);
    const applicationsCount = 2 + ((index * 3) % 22);
    const disbursedAmount = 850000 + ((index * 415000) % 18500000);
    const rate = pick([0.8, 1, 1.2, 1.5, 1.8], index);
    return {
      applications: applicationsCount,
      disbursedAmount,
      dsaId: dsa.id,
      dsaName: dsa.name,
      id: `com-${index + 1}`,
      month: pick(months, index),
      payout: Math.round((disbursedAmount * rate) / 100),
      payoutId: `PAY-${String(index + 1).padStart(5, "0")}`,
      product: pick(products, index),
      rate,
      status: pick(["Pending", "Processed", "Hold"], index),
    };
  });

  const rolePermissions: RolePermission[] = roles.flatMap((role, roleIndex) =>
    ["Dashboard", "DSA", "Leads", "Applications", "BRE", "Operations", "Finance", "Admin"].map(
      (module, moduleIndex) => ({
        id: `role-${roleIndex}-${moduleIndex}`,
        module,
        permissions: {
          Approve: role === "Admin" || role === "DSA Credit" || (role === "DSA Partner" && module === "DSA"),
          Create:
            role === "Branch User"
              ? module === "Dashboard" || module === "DSA"
              : role !== "Customer" || module === "Leads" || module === "Applications",
          Delete: role === "Admin",
          Edit: role !== "Customer" && (role !== "Branch User" || module === "DSA"),
          View:
            role === "Admin" ||
            role === "DSA Credit" ||
            (role === "Branch User" ? module === "Dashboard" || module === "DSA" : module !== "Admin"),
        },
        role,
      }),
    ),
  );

  const auditLogs: AuditLog[] = Array.from({ length: 42 }, (_, index) => ({
    action: pick(
      [
        "Updated DSA status",
        "Created loan application",
        "Approved workflow stage",
        "Changed BRE rule",
        "Downloaded audit extract",
      ],
      index,
    ),
    actor: demoActor(index),
    at: isoDay(index),
    entity: pick(["DSA", "Lead", "Application", "BRE Rule", "Commission"], index),
    id: `audit-${index + 1}`,
    ipAddress: `10.24.${index % 9}.${32 + index}`,
    severity: pick(["Info", "Info", "Warning", "Critical"], index),
  }));

  const notifications: Notification[] = Array.from({ length: 32 }, (_, index) => ({
    body: pick(
      [
        "A high-value application is waiting for risk review.",
        "A partner uploaded replacement KYC documents.",
        "Monthly payout batch has exceptions.",
        "A BRE rule changed from draft to active.",
      ],
      index,
    ),
    category: pick(["Workflow", "Risk", "Payout", "System", "Lead"], index),
    createdAt: isoDay(index % 16),
    id: `note-${index + 1}`,
    priority: pick(["Low", "Medium", "High", "Critical"], index),
    status: pick(["Unread", "Read", "Archived"], index),
    title: pick(
      ["Approval SLA breached", "Document re-uploaded", "Payout exception", "Rule activated"],
      index,
    ),
  }));

  const settings: SettingItem[] = [
    ["General", "Default region", "West", true],
    ["General", "DSA code prefix", "DSA", true],
    ["Workflow", "Auto-assign verification", "Enabled", true],
    ["Workflow", "Final approval threshold", "INR 25,00,000", true],
    ["Notifications", "Risk alerts", "Instant", true],
    ["Notifications", "Daily digest", "08:30", true],
    ["Security", "Session timeout", "30 minutes", true],
    ["Security", "Maker-checker enforced", "Enabled", true],
    ["Branding", "Workspace name", "Cosmos DSA Console", true],
    ["Branding", "Accent color", "Blue", true],
  ].map(([section, label, value, enabled], index) => ({
    enabled: enabled as boolean,
    id: `setting-${index + 1}`,
    label: label as string,
    section: section as SettingItem["section"],
    value: value as string,
  }));

  // Real-world slab data based on 2025-26 Indian banking market rates
  // Sources: SBI, HDFC, ICICI, Cosmos Bank published rate cards
  const loanSlabs: LoanSlab[] = [
    // ── HOME LOAN — Up to Rs. 35 Lakhs ──────────────────────────────────
    { id: "slab-hl-1-1", schemeName: "Up to Rs. 35 Lakhs", product: "Home Loan", maxLoanAmount: 3500000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 8.15, roiFixed: 9.20, maxLoanPeriodMonths: 240, createdAt: isoDay(1), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-1-2", schemeName: "Up to Rs. 35 Lakhs", product: "Home Loan", maxLoanAmount: 3500000, cibilScoreBand: "751-800", gender: "All", roiFloating: 8.35, roiFixed: 9.40, maxLoanPeriodMonths: 240, createdAt: isoDay(1), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-1-3", schemeName: "Up to Rs. 35 Lakhs", product: "Home Loan", maxLoanAmount: 3500000, cibilScoreBand: "700-750", gender: "All", roiFloating: 8.55, roiFixed: 9.65, maxLoanPeriodMonths: 240, createdAt: isoDay(1), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-1-4", schemeName: "Up to Rs. 35 Lakhs", product: "Home Loan", maxLoanAmount: 3500000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 9.05, roiFixed: 10.15, maxLoanPeriodMonths: 240, createdAt: isoDay(1), createdBy: DEMO_USERS.admin.name },
    // ── HOME LOAN — Rs. 35 to Rs. 70 Lakhs ─────────────────────────────
    { id: "slab-hl-2-1", schemeName: "Rs. 35 to Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 7000000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 8.20, roiFixed: 9.25, maxLoanPeriodMonths: 240, createdAt: isoDay(2), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-2-2", schemeName: "Rs. 35 to Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 7000000, cibilScoreBand: "751-800", gender: "All", roiFloating: 8.40, roiFixed: 9.45, maxLoanPeriodMonths: 240, createdAt: isoDay(2), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-2-3", schemeName: "Rs. 35 to Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 7000000, cibilScoreBand: "700-750", gender: "All", roiFloating: 8.60, roiFixed: 9.70, maxLoanPeriodMonths: 240, createdAt: isoDay(2), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-2-4", schemeName: "Rs. 35 to Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 7000000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 9.15, roiFixed: 10.20, maxLoanPeriodMonths: 240, createdAt: isoDay(2), createdBy: DEMO_USERS.admin.name },
    // ── HOME LOAN — Above Rs. 70 Lakhs ──────────────────────────────────
    { id: "slab-hl-3-1", schemeName: "Above Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 15000000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 8.25, roiFixed: 9.30, maxLoanPeriodMonths: 360, createdAt: isoDay(3), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-3-2", schemeName: "Above Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 15000000, cibilScoreBand: "751-800", gender: "All", roiFloating: 8.45, roiFixed: 9.50, maxLoanPeriodMonths: 360, createdAt: isoDay(3), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-3-3", schemeName: "Above Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 15000000, cibilScoreBand: "700-750", gender: "All", roiFloating: 8.65, roiFixed: 9.75, maxLoanPeriodMonths: 360, createdAt: isoDay(3), createdBy: DEMO_USERS.admin.name },
    { id: "slab-hl-3-4", schemeName: "Above Rs. 70 Lakhs", product: "Home Loan", maxLoanAmount: 15000000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 9.25, roiFixed: 10.35, maxLoanPeriodMonths: 360, createdAt: isoDay(3), createdBy: DEMO_USERS.admin.name },
    // ── LOAN AGAINST PROPERTY — Residential ─────────────────────────────
    { id: "slab-lap-1-1", schemeName: "Residential LAP", product: "Loan Against Property", maxLoanAmount: 10000000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 9.00, roiFixed: 10.25, maxLoanPeriodMonths: 180, createdAt: isoDay(4), createdBy: DEMO_USERS.credit.name },
    { id: "slab-lap-1-2", schemeName: "Residential LAP", product: "Loan Against Property", maxLoanAmount: 10000000, cibilScoreBand: "751-800", gender: "All", roiFloating: 9.50, roiFixed: 10.75, maxLoanPeriodMonths: 180, createdAt: isoDay(4), createdBy: DEMO_USERS.credit.name },
    { id: "slab-lap-1-3", schemeName: "Residential LAP", product: "Loan Against Property", maxLoanAmount: 10000000, cibilScoreBand: "700-750", gender: "All", roiFloating: 10.00, roiFixed: 11.25, maxLoanPeriodMonths: 180, createdAt: isoDay(4), createdBy: DEMO_USERS.credit.name },
    { id: "slab-lap-1-4", schemeName: "Residential LAP", product: "Loan Against Property", maxLoanAmount: 10000000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 11.00, roiFixed: 12.50, maxLoanPeriodMonths: 180, createdAt: isoDay(4), createdBy: DEMO_USERS.credit.name },
    // ── LOAN AGAINST PROPERTY — Commercial ──────────────────────────────
    { id: "slab-lap-2-1", schemeName: "Commercial LAP", product: "Loan Against Property", maxLoanAmount: 20000000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 9.50, roiFixed: 10.75, maxLoanPeriodMonths: 120, createdAt: isoDay(5), createdBy: DEMO_USERS.credit.name },
    { id: "slab-lap-2-2", schemeName: "Commercial LAP", product: "Loan Against Property", maxLoanAmount: 20000000, cibilScoreBand: "751-800", gender: "All", roiFloating: 10.00, roiFixed: 11.25, maxLoanPeriodMonths: 120, createdAt: isoDay(5), createdBy: DEMO_USERS.credit.name },
    { id: "slab-lap-2-3", schemeName: "Commercial LAP", product: "Loan Against Property", maxLoanAmount: 20000000, cibilScoreBand: "700-750", gender: "All", roiFloating: 10.75, roiFixed: 12.00, maxLoanPeriodMonths: 120, createdAt: isoDay(5), createdBy: DEMO_USERS.credit.name },
    { id: "slab-lap-2-4", schemeName: "Commercial LAP", product: "Loan Against Property", maxLoanAmount: 20000000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 12.00, roiFixed: 13.50, maxLoanPeriodMonths: 120, createdAt: isoDay(5), createdBy: DEMO_USERS.credit.name },
    // ── PERSONAL LOAN — Salaried ─────────────────────────────────────────
    { id: "slab-pl-1-1", schemeName: "Salaried Gold", product: "Personal Loan", maxLoanAmount: 1500000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 10.50, roiFixed: 11.75, maxLoanPeriodMonths: 60, createdAt: isoDay(6), createdBy: DEMO_USERS.credit.name },
    { id: "slab-pl-1-2", schemeName: "Salaried Gold", product: "Personal Loan", maxLoanAmount: 1500000, cibilScoreBand: "751-800", gender: "All", roiFloating: 12.00, roiFixed: 13.25, maxLoanPeriodMonths: 60, createdAt: isoDay(6), createdBy: DEMO_USERS.credit.name },
    { id: "slab-pl-1-3", schemeName: "Salaried Gold", product: "Personal Loan", maxLoanAmount: 1500000, cibilScoreBand: "700-750", gender: "All", roiFloating: 14.50, roiFixed: 15.75, maxLoanPeriodMonths: 60, createdAt: isoDay(6), createdBy: DEMO_USERS.credit.name },
    { id: "slab-pl-1-4", schemeName: "Salaried Gold", product: "Personal Loan", maxLoanAmount: 1500000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 18.00, roiFixed: 19.50, maxLoanPeriodMonths: 48, createdAt: isoDay(6), createdBy: DEMO_USERS.credit.name },
    // ── PERSONAL LOAN — Self Employed ────────────────────────────────────
    { id: "slab-pl-2-1", schemeName: "Self-Employed Premier", product: "Personal Loan", maxLoanAmount: 2500000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 11.00, roiFixed: 12.50, maxLoanPeriodMonths: 60, createdAt: isoDay(7), createdBy: DEMO_USERS.credit.name },
    { id: "slab-pl-2-2", schemeName: "Self-Employed Premier", product: "Personal Loan", maxLoanAmount: 2500000, cibilScoreBand: "751-800", gender: "All", roiFloating: 13.00, roiFixed: 14.50, maxLoanPeriodMonths: 60, createdAt: isoDay(7), createdBy: DEMO_USERS.credit.name },
    { id: "slab-pl-2-3", schemeName: "Self-Employed Premier", product: "Personal Loan", maxLoanAmount: 2500000, cibilScoreBand: "700-750", gender: "All", roiFloating: 16.00, roiFixed: 17.50, maxLoanPeriodMonths: 60, createdAt: isoDay(7), createdBy: DEMO_USERS.credit.name },
    { id: "slab-pl-2-4", schemeName: "Self-Employed Premier", product: "Personal Loan", maxLoanAmount: 2500000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 20.00, roiFixed: 22.00, maxLoanPeriodMonths: 36, createdAt: isoDay(7), createdBy: DEMO_USERS.credit.name },
    // ── BUSINESS LOAN — MSME ─────────────────────────────────────────────
    { id: "slab-bl-1-1", schemeName: "MSME Business Loan", product: "Business Loan", maxLoanAmount: 5000000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 10.00, roiFixed: 11.25, maxLoanPeriodMonths: 84, createdAt: isoDay(8), createdBy: DEMO_USERS.admin.name },
    { id: "slab-bl-1-2", schemeName: "MSME Business Loan", product: "Business Loan", maxLoanAmount: 5000000, cibilScoreBand: "751-800", gender: "All", roiFloating: 11.50, roiFixed: 12.75, maxLoanPeriodMonths: 84, createdAt: isoDay(8), createdBy: DEMO_USERS.admin.name },
    { id: "slab-bl-1-3", schemeName: "MSME Business Loan", product: "Business Loan", maxLoanAmount: 5000000, cibilScoreBand: "700-750", gender: "All", roiFloating: 13.00, roiFixed: 14.50, maxLoanPeriodMonths: 60, createdAt: isoDay(8), createdBy: DEMO_USERS.admin.name },
    { id: "slab-bl-1-4", schemeName: "MSME Business Loan", product: "Business Loan", maxLoanAmount: 5000000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 16.00, roiFixed: 18.00, maxLoanPeriodMonths: 48, createdAt: isoDay(8), createdBy: DEMO_USERS.admin.name },
    // ── BUSINESS LOAN — Larger Enterprises ───────────────────────────────
    { id: "slab-bl-2-1", schemeName: "Enterprise Growth Loan", product: "Business Loan", maxLoanAmount: 20000000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 9.50, roiFixed: 10.75, maxLoanPeriodMonths: 120, createdAt: isoDay(9), createdBy: DEMO_USERS.admin.name },
    { id: "slab-bl-2-2", schemeName: "Enterprise Growth Loan", product: "Business Loan", maxLoanAmount: 20000000, cibilScoreBand: "751-800", gender: "All", roiFloating: 10.75, roiFixed: 12.00, maxLoanPeriodMonths: 120, createdAt: isoDay(9), createdBy: DEMO_USERS.admin.name },
    { id: "slab-bl-2-3", schemeName: "Enterprise Growth Loan", product: "Business Loan", maxLoanAmount: 20000000, cibilScoreBand: "700-750", gender: "All", roiFloating: 12.25, roiFixed: 13.75, maxLoanPeriodMonths: 96, createdAt: isoDay(9), createdBy: DEMO_USERS.admin.name },
    { id: "slab-bl-2-4", schemeName: "Enterprise Growth Loan", product: "Business Loan", maxLoanAmount: 20000000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 15.00, roiFixed: 17.00, maxLoanPeriodMonths: 72, createdAt: isoDay(9), createdBy: DEMO_USERS.admin.name },
    // ── AUTO LOAN — New Vehicle ───────────────────────────────────────────
    { id: "slab-al-1-1", schemeName: "New Vehicle Loan", product: "Auto Loan", maxLoanAmount: 2500000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 7.45, roiFixed: 8.50, maxLoanPeriodMonths: 84, createdAt: isoDay(10), createdBy: DEMO_USERS.credit.name },
    { id: "slab-al-1-2", schemeName: "New Vehicle Loan", product: "Auto Loan", maxLoanAmount: 2500000, cibilScoreBand: "751-800", gender: "All", roiFloating: 8.00, roiFixed: 9.00, maxLoanPeriodMonths: 84, createdAt: isoDay(10), createdBy: DEMO_USERS.credit.name },
    { id: "slab-al-1-3", schemeName: "New Vehicle Loan", product: "Auto Loan", maxLoanAmount: 2500000, cibilScoreBand: "700-750", gender: "All", roiFloating: 8.75, roiFixed: 9.75, maxLoanPeriodMonths: 60, createdAt: isoDay(10), createdBy: DEMO_USERS.credit.name },
    { id: "slab-al-1-4", schemeName: "New Vehicle Loan", product: "Auto Loan", maxLoanAmount: 2500000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 10.25, roiFixed: 11.50, maxLoanPeriodMonths: 60, createdAt: isoDay(10), createdBy: DEMO_USERS.credit.name },
    // ── AUTO LOAN — Used Vehicle ─────────────────────────────────────────
    { id: "slab-al-2-1", schemeName: "Pre-Owned Vehicle Loan", product: "Auto Loan", maxLoanAmount: 1000000, cibilScoreBand: "Above 800", gender: "All", roiFloating: 10.50, roiFixed: 11.75, maxLoanPeriodMonths: 60, createdAt: isoDay(11), createdBy: DEMO_USERS.credit.name },
    { id: "slab-al-2-2", schemeName: "Pre-Owned Vehicle Loan", product: "Auto Loan", maxLoanAmount: 1000000, cibilScoreBand: "751-800", gender: "All", roiFloating: 12.00, roiFixed: 13.25, maxLoanPeriodMonths: 60, createdAt: isoDay(11), createdBy: DEMO_USERS.credit.name },
    { id: "slab-al-2-3", schemeName: "Pre-Owned Vehicle Loan", product: "Auto Loan", maxLoanAmount: 1000000, cibilScoreBand: "700-750", gender: "All", roiFloating: 14.00, roiFixed: 15.50, maxLoanPeriodMonths: 48, createdAt: isoDay(11), createdBy: DEMO_USERS.credit.name },
    { id: "slab-al-2-4", schemeName: "Pre-Owned Vehicle Loan", product: "Auto Loan", maxLoanAmount: 1000000, cibilScoreBand: "Below 700", gender: "All", roiFloating: 16.00, roiFixed: 18.00, maxLoanPeriodMonths: 36, createdAt: isoDay(11), createdBy: DEMO_USERS.credit.name },
  ];

  return {
    applications,
    approvals,
    auditLogs,
    breRules,
    commissions,
    documents,
    dsas,
    dsaProductConfigs,
    leads,
    loanSlabs,
    notifications,
    roles: rolePermissions,
    settings,
    users,
    verificationChecks,
  };
}
