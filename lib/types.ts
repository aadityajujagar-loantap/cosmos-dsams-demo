export type BusinessType =
  | "Sole Proprietor"
  | "Partnership"
  | "LLP"
  | "Private Limited"
  | "Public Limited";

export type DsaStatus =
  | "Draft"
  | "Submitted"
  | "Pending Branch Approval"
  | "Pending BRH Approval"
  | "Pending Credit Approval"
  | "KYC Pending"
  | "On Hold"
  | "Active"
  | "Suspended"
  | "Rejected"
  | "Blacklisted";

export type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "In Progress"
  | "Converted"
  | "Lost";

export type ApplicationStage =
  | "Lead Capture"
  | "Document Review"
  | "BRE Check"
  | "Credit Underwriting"
  | "Risk Review"
  | "Approval"
  | "Disbursal";

export type ApplicationStatus =
  | "Draft"
  | "In Review"
  | "Approved"
  | "Rejected"
  | "Disbursed"
  | "On Hold";

export type VerificationStatus =
  | "Pending"
  | "In Progress"
  | "Verified"
  | "Failed";

export type DocumentType =
  | "PAN"
  | "Aadhaar"
  | "Salary Slip"
  | "Bank Statement"
  | "Photograph";

export type Product =
  | "Personal Loan"
  | "Home Loan"
  | "Loan Against Property"
  | "Business Loan"
  | "Auto Loan";

export type CommissionType = "Percentage-based" | "Fixed-fee" | "Tiered";

export type RuleStatus = "Active" | "Inactive" | "Draft";
export type RuleOperator = "AND" | "OR";
export type RuleConditionOperator = ">" | ">=" | "<" | "<=" | "=" | "contains";

export type CibilScoreBand = "Above 800" | "751-800" | "700-750" | "Below 700";
export type GenderFilter = "All" | "Male" | "Female";

export type ApprovalStage =
  | "Maker"
  | "Checker"
  | "Risk Review"
  | "Final Approval";

export type ApprovalStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Returned";

export type UserRole =
  | "Admin"
  | "DSA Credit"
  | "Branch Regional Head"
  | "Branch User"
  | "DSA Partner"
  | "DSA Agent"
  | "Customer";

export type PermissionAction = "View" | "Create" | "Edit" | "Delete" | "Approve";
export type NotificationStatus = "Unread" | "Read" | "Archived";
export type Priority = "Low" | "Medium" | "High" | "Critical";

export interface Entity {
  id: string;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface Dsa extends Entity {
  code: string;
  name: string;
  businessType: BusinessType;
  pan: string;
  gst: string;
  contactPerson: string;
  mobile: string;
  email: string;
  loginUsername: string;
  loginPassword: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  bank: BankDetails;
  status: DsaStatus;
  onboardingDate: string;
  manager: string;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  riskRating: "Low" | "Medium" | "High";
  monthlyLeads: number;
  approvalRate: number;
  commissionEarned: number;
  documents: DocumentRecord[];
  rejectionReason?: string;
  statusReason?: string;
  statusReasonAction?: "Deactivated" | "Blacklisted";
  statusReasonAt?: string;
  statusReasonBy?: string;
}

export interface ProductCommissionRange {
  id: string;
  min: number;
  max: number;
  effectiveDate: string;
  endDate: string;
  frequency: string;
  commissionAmount?: number;
  growthRequired?: boolean;
  rate: number;
}

export interface DsaProductConfig extends Entity {
  dsaId: string;
  dsaName: string;
  dsaCode: string;
  product: Product;
  commissionType: CommissionType;
  ranges: ProductCommissionRange[];
  loanUrl: string;
  bannerName?: string;
  status: "Active" | "Inactive";
  configuredAt: string;
  configuredBy: string;
}

export interface Lead extends Entity {
  leadId: string;
  customer: string;
  mobile: string;
  email: string;
  city: string;
  source: "Referral" | "Branch" | "Website" | "DSA Campaign" | "Partner";
  product: Product;
  amount: number;
  status: LeadStatus;
  dsaId: string;
  dsaName: string;
  owner: string;
  createdAt: string;
  nextAction: string;
}

export interface ApplicationJourneyField {
  id: string;
  label: string;
  value: string;
  group: string;
}

export interface ApplicationJourney {
  journeyId: string;
  name: string;
  product: Product;
  channel: string;
  completedSteps: string[];
  currentStep: string;
  fields: ApplicationJourneyField[];
}

export type DeviationStatus = "Pending" | "Approved" | "Rejected";
export type DeviationApproverRole = "Branch User" | "Branch Regional Head" | "DSA Credit" | "DSA Manager";

export interface ApplicationDeviation {
  id: string;
  required: true;
  status: DeviationStatus;
  reasons: string[];
  requestedAt: string;
  requestedBy: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByRole?: DeviationApproverRole;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedByRole?: DeviationApproverRole;
  remarks?: string;
}

export interface Application extends Entity {
  applicationId: string;
  customer: string;
  mobile: string;
  email: string;
  pan: string;
  aadhaar: string;
  city: string;
  dsaId: string;
  dsaName: string;
  product: Product;
  loanAmount: number;
  stage: ApplicationStage;
  riskScore: number;
  status: ApplicationStatus;
  createdAt: string;
  salary: number;
  creditScore: number;
  verificationStatus: VerificationStatus;
  decisionSummary: string;
  journey: ApplicationJourney;
  deviation?: ApplicationDeviation;
  notes: string[];
  timeline: TimelineEvent[];
}

export interface TimelineEvent {
  id: string;
  at: string;
  actor: string;
  title: string;
  note: string;
}

export interface RuleCondition {
  id: string;
  field: string;
  operator: RuleConditionOperator;
  value: string;
}

export interface BreRule extends Entity {
  ruleName: string;
  ruleCode: string;
  product: Product;
  priority: number;
  status: RuleStatus;
  operator: RuleOperator;
  conditions: RuleCondition[];
  outcome: string;
  updatedAt: string;
  mandatory?: boolean;
}

export interface LoanSlab extends Entity {
  schemeName: string;
  product: Product;
  maxLoanAmount: number;
  cibilScoreBand: CibilScoreBand;
  gender: GenderFilter;
  roiFloating: number;
  roiFixed: number;
  maxLoanPeriodMonths: number;
  createdAt: string;
  createdBy: string;
}

export interface VerificationCheck extends Entity {
  checkId: string;
  applicationId: string;
  customer: string;
  type: "KYC" | "Address" | "Employment" | "Bank";
  status: VerificationStatus;
  assignedTo: string;
  dueDate: string;
  evidence: string;
}

export interface DocumentRecord extends Entity {
  documentId: string;
  applicationId?: string;
  dsaId?: string;
  ownerName: string;
  type: DocumentType;
  fileName: string;
  size: string;
  status: VerificationStatus;
  uploadedAt: string;
  remarks: string;
}

export interface ApprovalItem extends Entity {
  workflowId: string;
  applicationId: string;
  customer: string;
  stage: ApprovalStage;
  status: ApprovalStatus;
  approver: string;
  updatedAt: string;
  history: TimelineEvent[];
}

export interface Commission extends Entity {
  payoutId: string;
  dsaId: string;
  dsaName: string;
  month: string;
  product: Product;
  applications: number;
  disbursedAmount: number;
  rate: number;
  payout: number;
  status: "Pending" | "Processed" | "Hold";
}

export type DsaInvoiceStatus =
  | "Raised by DSA"
  | "Countered by Bank"
  | "Countered by DSA"
  | "Pending Approval"
  | "Approved"
  | "Rejected";

export type DsaInvoiceParty = "DSA" | "Bank" | "DSA Credit" | "Super Admin";

export interface DsaInvoiceEvent {
  id: string;
  action: "Raised" | "Countered" | "Approved" | "Rejected" | "CSV Imported" | "Commented";
  actor: string;
  party: DsaInvoiceParty;
  amount: number;
  at: string;
  note: string;
}

export interface DsaInvoice extends Entity {
  invoiceNumber: string;
  dsaId: string;
  dsaName: string;
  dsaCode: string;
  month: string;
  grossAmount: number;
  adjustmentAmount: number;
  taxAmount: number;
  netAmount: number;
  requestedAmount: number;
  approvedAmount?: number;
  status: DsaInvoiceStatus;
  raisedBy: string;
  raisedByRole: UserRole | "DSA Manager";
  source: "Manual" | "CSV Upload";
  csvBatchId?: string;
  remarks: string;
  createdAt: string;
  updatedAt: string;
  history: DsaInvoiceEvent[];
}

/**
 * DsaRecovery captures per-DSA per-month recovery metrics.
 * The carry-forward concept: if a DSA recovers less than their target in month N,
 * the shortfall is carried forward and deducted from the next month's invoice.
 * E.g. target=10000, recovered=8000 → carryForward=2000;
 * next month if recovered=20000 → invoiceAmount = 20000 - 2000 = 18000.
 */
export interface DsaRecovery extends Entity {
  dsaId: string;
  dsaName: string;
  month: string;
  zone: string;
  targetAmount: number;
  recoveredAmount: number;
  /** Shortfall brought in from the previous month */
  carryForwardIn: number;
  /** Shortfall generated in this month (carried to next month) */
  carryForwardOut: number;
  /** Invoice raised = recoveredAmount - carryForwardIn (floored at 0) */
  invoiceAmount: number;
  totalCases: number;
  totalBilling: number;
  pendingAmount: number;
  npaCases: number;
}

export interface User extends Entity {
  name: string;
  email: string;
  role: UserRole;
  region: string;
  status: "Active" | "Invited" | "Disabled";
  lastLogin: string;
  dsaId?: string;
}

export interface RolePermission extends Entity {
  role: UserRole;
  module: string;
  permissions: Record<PermissionAction, boolean>;
}

export interface AuditLog extends Entity {
  at: string;
  actor: string;
  actorId?: string;
  actorRole?: UserRole | "DSA Manager";
  action: string;
  actionType?: string;
  affectedDsaId?: string;
  affectedDsaName?: string;
  affectedRole?: string;
  changedFields?: string[];
  collection?: CollectionName;
  entityId?: string;
  entityName?: string;
  entity: string;
  fromValue?: string;
  severity: "Info" | "Warning" | "Critical";
  summary?: string;
  toValue?: string;
  ipAddress: string;
}

export interface Notification extends Entity {
  title: string;
  body: string;
  priority: Priority;
  status: NotificationStatus;
  category: "Workflow" | "Risk" | "Payout" | "System" | "Lead";
  createdAt: string;
  href?: string;
}

export interface SettingItem extends Entity {
  section: "General" | "Workflow" | "Notifications" | "Security" | "Branding";
  label: string;
  value: string;
  enabled: boolean;
}

export interface MockStore {
  dsas: Dsa[];
  dsaProductConfigs: DsaProductConfig[];
  leads: Lead[];
  applications: Application[];
  breRules: BreRule[];
  loanSlabs: LoanSlab[];
  verificationChecks: VerificationCheck[];
  documents: DocumentRecord[];
  approvals: ApprovalItem[];
  commissions: Commission[];
  dsaInvoices: DsaInvoice[];
  dsaRecovery: DsaRecovery[];
  users: User[];
  roles: RolePermission[];
  auditLogs: AuditLog[];
  notifications: Notification[];
  settings: SettingItem[];
}

export type CollectionName = keyof MockStore;

export interface EntityMap {
  dsas: Dsa;
  dsaProductConfigs: DsaProductConfig;
  leads: Lead;
  applications: Application;
  breRules: BreRule;
  loanSlabs: LoanSlab;
  verificationChecks: VerificationCheck;
  documents: DocumentRecord;
  approvals: ApprovalItem;
  commissions: Commission;
  dsaInvoices: DsaInvoice;
  dsaRecovery: DsaRecovery;
  users: User;
  roles: RolePermission;
  auditLogs: AuditLog;
  notifications: Notification;
  settings: SettingItem;
}
