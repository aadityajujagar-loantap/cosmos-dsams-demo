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
  status: "PENDING" | "APPROVED" | "QUERY" | "REJECTED";
  remarks: string | null;
  query_response: string | null;
  action_by: number | null;
  action_at: string | null;
  created_at: string;
  updated_at: string;
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
  bre_results?: DsaBreResult[];
  related_users?: {
    id: number;
    name: string;
    email: string;
    phone: string;
    branch_code: string | null;
    deactivated_at: string | null;
    created_at: string;
  }[];
}

export interface DsaBreResult {
  id: number;
  dsa_id: number;
  rule_code: string;
  rule_name: string;
  rule_status: "PASS" | "FAIL";
  rule_value: string | null;
  expected_value: string | null;
  remarks: string | null;
  is_deviation_eligible: boolean;
  checked_at: string;
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
  branch_code: string;
  branch_name: string;
  branch_number: string | null;
  region_code: string;
  sub_region_code: string;
  district_code: string;
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
