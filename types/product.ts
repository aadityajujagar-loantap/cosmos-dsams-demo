export type ProductStatus = "draft" | "pending_approval" | "active" | "rejected" | "archived";

export interface LoanProduct {
  id: number;
  name: string;
  min_age_salaried: number;
  max_age_salaried: number;
  min_age_self_emp: number;
  max_age_self_emp: number;
  status: ProductStatus;
  loan_types_count?: number;
  schemes_count?: number; // legacy alias for compatibility
  created_at: string;
  updated_at: string;
}

export interface LoanType {
  id: number;
  loan_product_id: number;
  name: string;
  status: ProductStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Legacy alias
export type LoanScheme = LoanType;

export interface RoiSlab {
  id?: number;
  loan_type_parameter_id?: number;
  scheme_parameter_id?: number;
  slab_order: number;
  range_type: "upto" | "above";
  amount_lakhs: number;
  roi_pct: number;
}

export interface LtvSlab {
  id?: number;
  loan_type_parameter_id?: number;
  scheme_parameter_id?: number;
  slab_order: number;
  range_type: "upto" | "above";
  amount_lakhs: number;
  min_margin_pct: number;
}

export interface FoirSlab {
  id?: number;
  loan_type_parameter_id?: number;
  scheme_parameter_id?: number;
  slab_order: number;
  range_type: "upto" | "above";
  income_lakhs: number;
  max_foir_pct: number;
}

export interface LoanTypeParameter {
  id: number;
  loan_type_id: number;
  min_loan_amount: number | string;
  max_loan_amount: number | string;
  min_period_months: number;
  max_period_months: number;
  roi_label?: string;
  ltv_label: string;
  max_ltv?: number | string;
  foir_income_range_label?: string;
  foir_deviation_pct?: number;
  status?: "draft" | "pending_approval" | "active" | "rejected";
  roi_slabs?: RoiSlab[];
  ltv_slabs?: LtvSlab[];
  foir_slabs?: FoirSlab[];
}

// Legacy alias
export type SchemeParameter = LoanTypeParameter;

export interface ScoreBand {
  operator: "NA" | "gt" | "gte" | "lt" | "lte" | "between";
  value1: number | null;
  value2: number | null;
  label: string;
}

export interface LoanTypeSlab {
  id: number;
  loan_type_id: number;
  slab_label: string;
  max_loan_amount: string;
  max_loan_amount_val: number | null;
  score_band: ScoreBand;
  location: "india" | "abroad";
  gender: "Both" | "Male" | "Female" | "Transgender";
  roi_floating_pct: number | null;
  roi_fixed_pct: number | null;
  max_period_months: number | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

// Legacy alias
export type SchemeSlab = LoanTypeSlab;
