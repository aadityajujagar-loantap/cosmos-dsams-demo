export interface DsaDocument {
  id: number;
  dsa_id: number;
  owner_name: string | null;
  document_type: string;
  file_name: string;
  file_path: string;
  file_url: string | null;
  size: number | null;
  status: string;
  uploaded_at: string;
  remarks: string | null;
}

export interface DsaApproval {
  id: number;
  dsa_id: number;
  approval_level: number;
  assigned_role: string;
  status: "PENDING" | "APPROVED" | "RECOMMENDED" | "QUERY" | "REJECTED" | "REVERTED" | "SKIPPED";
  action?: string | null;
  remarks: string | null;
  query_response?: string | null;
  action_by?: number | null;
  action_at?: string | null;
  actioned_at?: string | null;
  actioned_by?: string | number | null;
  created_at: string;
  updated_at: string;
}

export interface DsaVerification {
  id: number;
  dsa_id: number;
  verification_code: string;
  execution_status: string;
  is_success: boolean;
  attempt_number?: number;
  request_reference?: string | null;
  normalized_data?: any;
  error_code?: string | null;
  error_message?: string | null;
  executed_at?: string | null;
  execution_duration_ms?: number | null;
}

export interface DsaDueDiligenceNote {
  id: number;
  dsa_id: number;
  approval_id?: number | null;
  checker_user_id?: string | null;
  observations?: string | null;
  remarks?: string | null;
  exception_remarks?: string | null;
  recommendation?: string | null;
  structured_data?: any;
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Dsa {
  id: number;
  code: string;
  name: string;
  business_type: string;
  pan: string;
  gst: string | null;
  contact_person: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  subregion_id: string | null;
  pincode: string;
  account_name: string;
  account_number: string;
  ifsc: string;
  bank_name: string;
  onboarding_status: string;
  operational_status: string;
  bre_status: string;
  deviation: boolean;
  current_approval_level: number;
  /** Task 22 — user-level case lock. Set once the case is claimed by a user. */
  lock_status?: string;
  assigned_user_id?: number | null;
  assigned_role?: string | null;
  assigned_workflow_level?: number | null;
  assigned_at?: string | null;
  released_at?: string | null;
  onboarding_date: string | null;
  manager: string | null;
  tier: string;
  risk_rating: string;
  monthly_leads: number;
  approval_rate: number;
  commission_earned: number;
  rejection_reason: string | null;
  status_reason: string | null;
  status_reason_action: string | null;
  status_reason_at: string | null;
  status_reason_by: string | null;
  created_at: string;
  updated_at: string;
  login_username?: string;
  login_password?: string;
  documents?: DsaDocument[];
  approvals?: DsaApproval[];
  verifications?: DsaVerification[];
  due_diligence_notes?: DsaDueDiligenceNote[];
  related_users?: {
    id: number;
    name: string;
    email: string;
    phone: string;
    branch_code: string | null;
    deactivated_at: string | null;
    created_at: string;
  }[];
  branch_id?: number | null;
  branch_name?: string | null;
  branch_code?: string | null;
  branchId?: number | null;
  entity_type?: string | null;
  dsa_type?: string | null;
  dsa_code?: string | null;
  dsa_code_generated_at?: string | null;
  applicant_email?: string;
  agreement_status?: string;
  agreement_generated_at?: string | null;
  digital_acceptance_status?: string;
  digital_accepted_at?: string | null;
  latest_due_diligence_note?: DsaDueDiligenceNote | null;
  branch?: {
    id?: number;
    branch_code?: string;
    branch_name?: string;
    sub_region_code?: string;
  } | null;
  submission_mode?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  applicant_title?: string | null;
  date_of_birth?: string | null;
  age?: number | string | null;
  education_qualification?: string | null;
  aadhaar_no?: string | null;
  entity_name?: string | null;
  constitution?: string | null;
  nature_of_business?: string | null;
  registration_no_llpin_cin?: string | null;
  gst_applicable?: boolean | null;
  business_license_type?: string | null;
  business_license_no?: string | null;
  shop_act_no?: string | null;
  udyam_no?: string | null;
  experience_years?: string | number | null;
  applicant_prior_experience?: string | null;
  registered_business_proof?: string | null;
  empanelment_since_year?: string | number | null;
  selected_licenses?: string[] | string | null;
  key_person_contact_no?: string | null;
  landline_no?: string | null;
  website?: string | null;
  office_address_different?: boolean | null;
  office_address_line_1?: string | null;
  office_city?: string | null;
  office_state?: string | null;
  office_pincode?: string | null;
  office_landline_no?: string | null;
  office_mobile_no?: string | null;
  business_premises_ownership?: string | null;
  account_type?: string | null;
  reference_1_name?: string | null;
  reference_1_contact_no?: string | null;
  reference_2_name?: string | null;
  reference_2_contact_no?: string | null;
  visit_report_remarks?: string | null;
  visit_conducted_by?: string | null;
  visit_conducted_at?: string | null;
  mobile_verified_at?: string | null;
  email_verified_at?: string | null;
  stakeholders?: Array<{
    id?: number;
    stakeholder_type?: string;
    name: string;
    mobile_no?: string;
    pan?: string;
    aadhaar?: string;
    din_dpin_no?: string;
  }>;
  associate_concerns?: Array<{
    id?: number;
    name?: string;
    entity_name?: string;
    nature_of_business?: string;
    activity?: string;
    relationship?: string;
    bank_name?: string;
  }>;
}

export type DsaWorkBucket = "all" | "received" | "in_process" | "rejected" | "approved";

/** Task 20C — candidate returned by GET /api/v1/dsa/{id}/eligible-users. */
export interface DsaEligibleUser {
  id: number;
  name: string;
  email: string;
  role: string;
  level: number;
  stage_code: string;
}

export interface DsaEligibleUsersResponse {
  dsa_id: number;
  workflow_level: number;
  assigned_role: string | null;
  current_user_id: number | null;
  eligible_users: DsaEligibleUser[];
}

export const DSA_WORK_BUCKETS: {
  value: DsaWorkBucket;
  label: string;
  description: string;
}[] = [
  {
    value: "all",
    label: "All",
    description:
      "Every DSA visible to you. Open one to lock it and start processing.",
  },
  {
    value: "received",
    label: "Received",
    description:
      "Applications routed to your stage that still need your decision.",
  },
  {
    value: "in_process",
    label: "In Process",
    description:
      "Applications sitting at your stage awaiting your approve, recommend or query action.",
  },
  {
    value: "rejected",
    label: "Rejected",
    description: "Applications rejected and returned to the Maker.",
  },
  {
    value: "approved",
    label: "Approved",
    description: "Applications that completed sanction and approval.",
  },
];

/** Task 22 — User-level case lock.
 * Mirrors `Dsa::currentLockDetails()`.
 */
export interface DsaCaseLockAssignment {
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assigned_user_role: string | null;
  assigned_role: string | null;
  assigned_branch: string | null;
  assigned_workflow_level: number | null;
  assigned_at: string | null;
  lock_status: string;
  is_locked: boolean;
  is_locked_by_current_user: boolean;
  is_locked_by_other_user: boolean;
  released_at: string | null;
}

/**
 * Task 22 — Single immutable row of `dsa_workflow_audit_logs`.
 * Field aliases are emitted by `DsaCaseAssignmentService::getActivityHistory()`.
 */
export interface DsaWorkflowActivity {
  id: number;
  dsa_id: number;
  user_id: number | null;
  actor_id: number | null;
  user_name: string | null;
  actor_name: string | null;
  role: string | null;
  actor_role: string | null;
  designation: string | null;
  workflow_level: number | null;
  approval_level: number | null;
  stage: string | null;
  stage_code: string | null;
  stage_name: string | null;
  branch_id: number | null;
  branch: string | null;
  branch_name: string | null;
  action: string;
  previous_user_id: number | null;
  previous_user_name: string | null;
  target_user_id: number | null;
  target_user_name: string | null;
  previous_status: string | null;
  new_status: string | null;
  previous_stage: string | null;
  new_stage: string | null;
  remarks: string | null;
  comments: string | null;
  context_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  activity_at: string | null;
  created_at: string | null;
  timestamp: string | null;
}

/** Workflow step snapshot from `dsa_approvals`. */
export interface DsaWorkflowStepHistory {
  id: number;
  sequence: number | null;
  level: number | null;
  stage_code: string | null;
  assigned_role: string | null;
  action: string | null;
  status: string | null;
  remarks: string | null;
  actioned_by: number | string | null;
  assigned_user_id: number | null;
  actioned_at: string | null;
  created_at: string | null;
}

export interface DsaActivityHistory {
  dsa_id: number;
  dsa_code: string | null;
  name: string | null;
  onboarding_status: string | null;
  current_approval_level: number | null;
  current_stage: string | null;
  current_assignment: DsaCaseLockAssignment | null;
  activities: DsaWorkflowActivity[];
  approvals: DsaWorkflowStepHistory[];
}

/** Payload of `POST /api/v1/dsa/{id}/acquire-case` and `/release-case`. */
export interface DsaCaseLockResult {
  dsa: Dsa;
  lock_status: string;
  current_assignment: DsaCaseLockAssignment | null;
  message: string;
}

export interface StateOption {
  state_code: string;
  state_name: string;
}

export interface DistrictOption {
  district_code: string;
  district_name: string;
  state_code: string;
}

export interface BranchOption {
  id?: number;
  branch_code: string;
  branch_name: string;
  branch_number?: string | null;
  region_code?: string;
  sub_region_code?: string;
  district_code?: string;
}

export interface SubRegionOption {
  sub_region_code: string;
  sub_region_name: string;
  region_code: string;
}

export interface RegionOption {
  region_code: string;
  region_name: string;
}
