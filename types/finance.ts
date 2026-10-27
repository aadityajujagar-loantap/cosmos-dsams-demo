export interface ApiResponse<T> {
  status: "success" | "error";
  message: string;
  status_code: number;
  data: T;
}

export interface Pagination {
  total: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export type CommissionPeriodStatus = "OPEN" | "COMPLETED" | "INVOICED";

export interface CommissionPeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: CommissionPeriodStatus;
  completed_at: string | null;
  completed_by: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  commissions_count?: number;
  commission_items_count?: number;
  invoices_count?: number;
  completed_by_user?: { id: number; name: string; email?: string } | null;
  created_by_user?: { id: number; name: string; email?: string } | null;
}

export interface BranchOption {
  branch_code: string;
  branch_name: string;
}

export interface EligibleDisbursement {
  lead_facility_id: number;
  lead_id: number;
  lead_uuid?: string;
  application_id: string;
  customer_name: string;
  branch_code: string;
  dsa_code: string;
  loan_product_id: number;
  product_name: string;
  facility_type?: string;
  sanctioned_amount?: number | string;
  loan_account_no: string;
  disbursed_amount: number | string;
  disbursement_date: string;
  has_deviation?: boolean;
  deviation_type?: string | null;
  deviation_label?: string;
  is_commission_eligible?: boolean;
}

export interface EligibleDisbursementsData {
  count: number;
  total_amount: number | string;
  items: EligibleDisbursement[];
}

export interface CommissionPreviewItem {
  lead_id: number;
  lead_facility_id: number;
  loan_product_id: number;
  loan_account_no: string;
  customer_name: string;
  dsa_id: number;
  dsa_code: string;
  disbursed_amount: number | string;
  commission_basis?: "DISBURSED_AMOUNT" | "SANCTIONED_AMOUNT" | string;
  commission_basis_amount?: number | string;
  disbursement_date: string;
  has_deviation?: boolean;
  deviation_type?: string | null;
  deviation_label?: string;
  is_commission_eligible?: boolean;
  rate_type: "PERCENTAGE" | "FIXED" | "INELIGIBLE_DEVIATION" | string;
  commission_rate: number | string;
  gross_commission: number | string;
  tds_rate: number | string;
  tds_amount: number | string;
  net_commission: number | string;
}

export interface CommissionPreview {
  period_id: number;
  period_name: string;
  branch_id: string;
  total_disbursed_amount: number | string;
  total_commission_amount: number | string;
  total_tds_amount: number | string;
  net_payable_amount: number | string;
  items_count: number;
  items: CommissionPreviewItem[];
}

export interface CommissionLineItem {
  id: number;
  commission_id: number;
  lead_id: number;
  lead_facility_id: number;
  dsa_id: number;
  dsa_code: string;
  loan_account_no: string;
  disbursed_amount: number | string;
  disbursement_date: string;
  gross_commission: number | string;
  tds_amount: number | string;
  net_commission: number | string;
  rate_type: string;
  commission_rate: number | string;
  customer_name?: string;
  product_name?: string;
  lead?: {
    id: number;
    CustName: string;
    application_id: string;
  };
}

export interface FinalizedCommission {
  id: number;
  commission_period_id: number;
  branch_id: string;
  total_disbursed_amount: number | string;
  total_commission_amount: number | string;
  total_tds_amount: number | string;
  net_payable_amount: number | string;
  status: "COMPUTED" | "FINALIZED";
  calculated_by: number;
  calculated_at: string;
  items?: CommissionLineItem[];
  branch?: {
    branch_code: string;
    branch_name: string;
  };
  period?: {
    id: number;
    period_name: string;
    status: string;
  };
}

export type DsaInvoiceStatus = "DRAFT" | "SUBMITTED" | "RECOMMENDED" | "APPROVED" | "REJECTED" | "PAID";

export interface DsaProfile {
  code: string;
  name: string;
  constitution?: string;
  pan?: string;
  gst?: string;
  bav_status?: string;
  account_number?: string;
  ifsc?: string;
  bank_name?: string;
}

export interface DsaInvoiceItem {
  id: number;
  loan_account_no: string;
  disbursed_amount: number | string;
  disbursement_date: string;
  gross_commission: number | string;
  tds_amount: number | string;
  net_commission: number | string;
  lead?: {
    id: number;
    CustName: string;
    application_id: string;
    product?: {
      id: number;
      name: string;
    };
  };
}

export interface DsaInvoiceEvent {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string;
  remarks: string;
  created_at: string;
  created_by_user?: {
    id: number;
    name: string;
  };
}

export interface DsaInvoice {
  id: number;
  invoice_no: string;
  commission_period_id: number;
  commission_id: number | null;
  dsa_id: number;
  dsa_code: string;
  branch_code: string;
  invoice_date: string;
  gross_amount: number | string;
  tds_amount: number | string;
  gst_amount: number | string;
  cgst_amount?: number | string;
  sgst_amount?: number | string;
  net_payable_amount: number | string;
  is_rcm?: boolean;
  dsa_category?: string;
  status: DsaInvoiceStatus;
  payment_reference: string | null;
  payment_mode?: string | null;
  paid_at: string | null;
  items_count?: number;
  dsa_profile?: DsaProfile | null;
  items?: DsaInvoiceItem[];
  events?: DsaInvoiceEvent[];
}

export interface CbsDisbursementEvent {
  id: number;
  source_event_id: string;
  loan_account_no: string;
  disbursed_amount: number | string;
  disbursement_date: string;
  branch_code: string;
  dsa_code: string | null;
  sync_status: "MATCHED" | "UNMATCHED_EXCEPTION";
  matched_lead_id: number | null;
  matched_facility_id: number | null;
  exception_reason: string | null;
}

export interface CbsSyncResult {
  status: "success" | "error";
  total: number;
  matched: number;
  unmatched: number;
  events: CbsDisbursementEvent[];
}
