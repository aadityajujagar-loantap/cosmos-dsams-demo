export interface Permission {
  id: number;
  name: string;
  description?: string | null;
}

export interface Role {
  id: number;
  name: string;
  description?: string | null;
  permissions?: Permission[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  ticket_no?: string | null;
  phone?: string | null;
  branch_role_id?: string | null;
  branch_code?: string | null;
  zone_code?: string | null;
  deactivated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  roles?: Role[];
}

export interface RolesPermissionsData {
  roles: Role[];
}

export interface AuthSession {
  token: string;
  user: User;
  roles: {
    id: number;
    name: string;
    permissions: {
      id: number;
      name: string;
    }[];
  }[];
}

export interface BranchRole {
  id: number;
  branch_role_id: string;
  rolename: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserBranchMappingUser {
  id: number;
  name: string;
  email: string;
}

export interface UserBranchMappingBranch {
  id?: number;
  branch_code: string;
  branch_name: string;
}

export interface UserBranchMapping {
  id: number;
  user_id: number;
  branch_code: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  user?: UserBranchMappingUser;
  branch?: UserBranchMappingBranch;
}

export interface BulkAssignResult {
  created: UserBranchMapping[];
  skipped: string[];
  errors: string[];
  summary: {
    total: number;
    created_count: number;
    skipped_count: number;
    error_count: number;
  };
}

export interface CsvUploadResult {
  created: UserBranchMapping[];
  skipped: string[];
  errors: string[];
  summary: {
    total_lines: number;
    created_count: number;
    skipped_count: number;
    error_count: number;
  };
}

export interface RegionItem {
  id: number;
  region_code: string;
  region_name: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SubRegionItem {
  id: number;
  sub_region_code: string;
  sub_region_name: string;
  region_code: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface StateItem {
  id: number;
  state_code: string;
  state_name: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DistrictItem {
  id: number;
  district_code: string;
  district_name: string;
  state_code: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BranchItem {
  id: number;
  branch_code: string;
  branch_name: string;
  branch_number?: string | null;
  region_code: string;
  sub_region_code: string;
  district_code?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BranchSyncResult {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped: string[];
}
