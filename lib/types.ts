export type BusinessType =
  | "Sole Proprietor"
  | "Partnership"
  | "LLP"
  | "Private Limited"
  | "Public Limited";

export type DsaStatus =
  | "Draft"
  | "Submitted"
  | "Pending Credit Approval"
  | "KYC Pending"
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
  | "Branch User"
  | "DSA Partner"
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
}

export interface ProductCommissionRange {
  id: string;
  min: number;
  max: number;
  effectiveDate: string;
  endDate: string;
  frequency: string;
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

export interface User extends Entity {
  name: string;
  email: string;
  role: UserRole;
  region: string;
  status: "Active" | "Invited" | "Disabled";
  lastLogin: string;
}

export interface RolePermission extends Entity {
  role: UserRole;
  module: string;
  permissions: Record<PermissionAction, boolean>;
}

export interface AuditLog extends Entity {
  at: string;
  actor: string;
  action: string;
  entity: string;
  severity: "Info" | "Warning" | "Critical";
  ipAddress: string;
}

export interface Notification extends Entity {
  title: string;
  body: string;
  priority: Priority;
  status: NotificationStatus;
  category: "Workflow" | "Risk" | "Payout" | "System" | "Lead";
  createdAt: string;
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
  users: User;
  roles: RolePermission;
  auditLogs: AuditLog;
  notifications: Notification;
  settings: SettingItem;
}
