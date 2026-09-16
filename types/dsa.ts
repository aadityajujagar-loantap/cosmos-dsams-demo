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
  dsa_code?: string;
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
  } | null;
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
