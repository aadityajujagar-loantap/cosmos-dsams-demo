export interface MasterValue {
  id: number;
  call_type: string;
  meta_key: string;
  meta_value: string;
  sort_order: number;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface MasterValueDropdownItem {
  id: number;
  meta_key: string;
  meta_value: string;
}

export interface MasterValuePayload {
  call_type: string;
  meta_key: string;
  meta_value: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface MasterValueListParams {
  call_type?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
  search?: string;
}
