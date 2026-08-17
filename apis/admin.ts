import { request } from "./client";
import type { MakerRequest, MakerRequestActionType, MakerRequestStatus } from "@/types/makerChecker";
import type { Permission, Role, User } from "@/types/auth";
import type { ActivityLog } from "@/types/activityLog";
import type {
  Dsa,
  DsaDocument,
  StateOption,
  DistrictOption,
  BranchOption,
  SubRegionOption,
  RegionOption,
} from "@/types/dsa";
import type { LoanProduct, LoanScheme, SchemeParameter, SchemeSlab } from "@/types/product";

export interface BackendResponse<T> {
  status: string;
  message?: string;
  status_code?: number;
  data: T;
}

export interface DsaListResponse {
  items: Dsa[];
  pagination: {
    total: number;
    count: number;
    per_page: number;
    current_page: number;
    total_pages: number;
  };
}

export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

export interface MakerCheckerActionResponse {
  message: string;
  reference: string;
  status: "pending";
  action_type: "add" | "update" | "delete";
  group: string;
}

export interface MakerRequestListParams {
  action_type?: MakerRequestActionType;
  group?: string;
  page?: number;
  per_page?: number;
  status?: MakerRequestStatus;
}

export interface MakerRequestReviewResponse {
  maker_request: MakerRequest;
  message: string;
  result?: unknown;
}

interface ApiEnvelope<T> {
  status?: string;
  message?: string;
  data: T;
}

export interface UserListParams {
  page?: number;
  per_page?: number;
  status?: "active" | "deactivated";
}

export interface UserPayload {
  name: string;
  email: string;
  phone?: string;
  ticket_no?: string;
  password?: string;
  branch_role_id?: string;
  branch_code?: string;
  zone_code?: string;
}

export interface RolePayload {
  name: string;
  description?: string;
}

export interface PermissionPayload {
  name: string;
  description?: string;
}

function compactParams(params?: object) {
  const query = new URLSearchParams();
  Object.entries((params ?? {}) as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function isMakerCheckerResponse(value: unknown): value is MakerCheckerActionResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { status?: unknown }).status === "pending" &&
      typeof (value as { reference?: unknown }).reference === "string"
  );
}

function unwrapData<T>(response: ApiEnvelope<T> | T): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }
  return response as T;
}

function unwrapMutation<T>(response: ApiEnvelope<T> | T | MakerCheckerActionResponse) {
  if (isMakerCheckerResponse(response)) return response;
  return unwrapData<T>(response as ApiEnvelope<T> | T);
}

export const adminApi = {
  /**
   * Get list of maker requests (pending, approved, etc.)
   */
  getMakerRequests: (params?: MakerRequestListParams): Promise<PaginatedResponse<MakerRequest>> => {
    return request<PaginatedResponse<MakerRequest>>(
      `/admin/maker-requests${compactParams(params)}`,
      { method: "GET" }
    );
  },

  /**
   * Fetch single maker request detail
   */
  getMakerRequestDetail: (uuid: string): Promise<MakerRequest> => {
    return request<MakerRequest>(`/admin/maker-requests/${uuid}`, {
      method: "GET",
    });
  },

  /**
   * Approve a pending maker request
   */
  approveRequest: (uuid: string): Promise<MakerRequestReviewResponse> => {
    return request<MakerRequestReviewResponse>(`/admin/maker-requests/${uuid}/approve`, {
      method: "POST",
    });
  },

  /**
   * Reject a pending maker request
   */
  rejectRequest: (uuid: string, reason: string): Promise<MakerRequestReviewResponse> => {
    return request<MakerRequestReviewResponse>(`/admin/maker-requests/${uuid}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: reason }),
    });
  },

  /**
   * Get list of users (Admin Panel)
   */
  getUsers: (): Promise<User[]> => {
    return adminApi.getUsersPage({ per_page: 100 }).then((page) => page.data);
  },

  /**
   * Get paginated users from the backend
   */
  getUsersPage: async (params?: UserListParams): Promise<PaginatedResponse<User>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<User>>>(
      `/admin/users${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  /**
   * Fetch a single user with backend role details
   */
  getUser: async (id: number): Promise<User> => {
    const response = await request<ApiEnvelope<User>>(`/admin/users/${id}`, {
      method: "GET",
    });
    return response.data;
  },

  /**
   * Create a new user (Maker-Checker protected)
   */
  createUser: async (payload: UserPayload): Promise<User | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<User> | MakerCheckerActionResponse>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<User>(response);
  },

  /**
   * Update an existing user (Maker-Checker protected)
   */
  updateUser: async (
    id: number,
    payload: Partial<UserPayload>
  ): Promise<User | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<User> | MakerCheckerActionResponse>(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<User>(response);
  },

  /**
   * Deactivate a user (Maker-Checker protected)
   */
  deactivateUser: async (id: number): Promise<User | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<User> | MakerCheckerActionResponse>(`/admin/users/${id}/deactivate`, {
      method: "POST",
    });
    return unwrapMutation<User>(response);
  },

  /**
   * Reactivate a user (Maker-Checker protected)
   */
  reactivateUser: async (id: number): Promise<User | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<User> | MakerCheckerActionResponse>(`/admin/users/${id}/reactivate`, {
      method: "POST",
    });
    return unwrapMutation<User>(response);
  },

  /**
   * Delete a user (Maker-Checker protected)
   */
  deleteUser: async (id: number): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<{ message?: string } | MakerCheckerActionResponse>(`/admin/users/${id}`, {
      method: "DELETE",
    });
    return response;
  },

  /**
   * User-role assignment APIs
   */
  getUserRoles: (id: number): Promise<Role[]> => {
    return request<Role[]>(`/admin/users/${id}/roles`, { method: "GET" });
  },

  assignUserRoles: (id: number, roleNames: string[]): Promise<User> => {
    return request<User>(`/admin/users/${id}/roles`, {
      method: "POST",
      body: JSON.stringify({ roles: roleNames }),
    });
  },

  assignUserRole: (userId: number, roleId: number): Promise<User> => {
    return request<User>(`/admin/users/${userId}/roles/${roleId}`, {
      method: "POST",
    });
  },

  revokeUserRole: (userId: number, roleId: number): Promise<User> => {
    return request<User>(`/admin/users/${userId}/roles/${roleId}`, {
      method: "DELETE",
    });
  },

  /**
   * Roles and permissions APIs
   */
  getRoles: (): Promise<Role[]> => {
    return request<Role[]>("/admin/roles", { method: "GET" });
  },

  createRole: (payload: RolePayload): Promise<Role> => {
    return request<Role>("/admin/roles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateRole: (id: number, payload: RolePayload): Promise<Role> => {
    return request<Role>(`/admin/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteRole: (id: number): Promise<{ message?: string }> => {
    return request<{ message?: string }>(`/admin/roles/${id}`, {
      method: "DELETE",
    });
  },

  syncRolePermissions: (roleId: number, permissionNames: string[]): Promise<Role> => {
    return request<Role>(`/admin/roles/${roleId}/permissions`, {
      method: "POST",
      body: JSON.stringify({ permissions: permissionNames }),
    });
  },

  getPermissions: (): Promise<Permission[]> => {
    return request<Permission[]>("/admin/permissions", { method: "GET" });
  },

  createPermission: (payload: PermissionPayload): Promise<Permission> => {
    return request<Permission>("/admin/permissions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updatePermission: (id: number, payload: PermissionPayload): Promise<Permission> => {
    return request<Permission>(`/admin/permissions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deletePermission: (id: number): Promise<{ message?: string }> => {
    return request<{ message?: string }>(`/admin/permissions/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Get paginated activity logs (Audit Trail)
   */
  getActivityLogs: async (params?: {
    user_id?: number;
    action?: string;
    group?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<ActivityLog>> => {
    return request<PaginatedResponse<ActivityLog>>(
      `/admin/activity-logs${compactParams(params)}`,
      { method: "GET" }
    );
  },

  /**
   * Fetch single activity log detail
   */
  getActivityLogDetail: async (id: number): Promise<ActivityLog> => {
    return request<ActivityLog>(`/admin/activity-logs/${id}`, {
      method: "GET",
    });
  },

  // ── DSA Dropdowns ────────────────────────────────────────────────────────
  getStatesDropdown: async (): Promise<BackendResponse<StateOption[]>> => {
    return request<BackendResponse<StateOption[]>>("/states/dropdown", { method: "GET" });
  },

  getDistrictsDropdown: async (stateCode: string): Promise<BackendResponse<DistrictOption[]>> => {
    return request<BackendResponse<DistrictOption[]>>(`/districts/dropdown?state_code=${stateCode}`, {
      method: "GET",
    });
  },

  getBranchesDropdown: async (districtCode: string): Promise<BackendResponse<BranchOption[]>> => {
    return request<BackendResponse<BranchOption[]>>(`/branches/dropdown?district_code=${districtCode}`, {
      method: "GET",
    });
  },

  getSubRegionsDropdown: async (): Promise<BackendResponse<SubRegionOption[]>> => {
    return request<BackendResponse<SubRegionOption[]>>("/sub-regions/dropdown", { method: "GET" });
  },

  getRegionsDropdown: async (): Promise<BackendResponse<RegionOption[]>> => {
    return request<BackendResponse<RegionOption[]>>("/regions/dropdown", { method: "GET" });
  },

  // ── DSA CRUD ─────────────────────────────────────────────────────────────
  getDsas: async (params?: {
    search?: string;
    onboarding_status?: string;
    operational_status?: string;
    tier?: string;
    city?: string;
    state?: string;
    business_type?: string;
    per_page?: number;
    page?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<BackendResponse<DsaListResponse>> => {
    return request<BackendResponse<DsaListResponse>>(`/dsas${compactParams(params)}`, {
      method: "GET",
    });
  },

  getDsaDetail: async (idOrCode: number | string): Promise<BackendResponse<Dsa & { related_users?: any[] }>> => {
    return request<BackendResponse<Dsa & { related_users?: any[] }>>(`/dsas/${idOrCode}`, {
      method: "GET",
    });
  },

  createDsa: async (payload: Partial<Dsa>): Promise<BackendResponse<Dsa>> => {
    return request<BackendResponse<Dsa>>("/dsas-create", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateDsaProfile: async (idOrCode: number | string, payload: Partial<Dsa> & { action?: string; remarks?: string }): Promise<BackendResponse<Dsa>> => {
    return request<BackendResponse<Dsa>>(`/dsas/${idOrCode}/update-profile`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateDsaStatus: async (
    idOrCode: number | string,
    payload: { onboarding_status?: string; operational_status?: string; reason: string }
  ): Promise<BackendResponse<Dsa>> => {
    return request<BackendResponse<Dsa>>(`/dsas/${idOrCode}/update-status`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── DSA Agreements ────────────────────────────────────────────────────────
  generateDsaAgreement: async (idOrCode: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/dsas/${idOrCode}/agreements/generate`, {
      method: "POST",
    });
  },

  downloadDsaAgreement: async (idOrCode: number | string): Promise<BackendResponse<{ file_url: string; agreement_status: string }>> => {
    return request<BackendResponse<{ file_url: string; agreement_status: string }>>(`/dsas/${idOrCode}/agreements/download`, {
      method: "GET",
    });
  },

  uploadSignedAgreement: async (idOrCode: number | string, file: File): Promise<BackendResponse<any>> => {
    const formData = new FormData();
    formData.append("signed_agreement", file);
    return request<BackendResponse<any>>(`/dsas/${idOrCode}/agreements/upload-signed`, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "",
      },
    });
  },

  // ── DSA Documents ─────────────────────────────────────────────────────────
  getDsaDocuments: async (idOrCode: number | string): Promise<BackendResponse<DsaDocument[]>> => {
    return request<BackendResponse<DsaDocument[]>>(`/dsas/${idOrCode}/documents`, {
      method: "GET",
    });
  },

  uploadDsaDocument: async (
    idOrCode: number | string,
    payload: { file: File; document_type: string; owner_name?: string }
  ): Promise<BackendResponse<DsaDocument>> => {
    const formData = new FormData();
    formData.append("file", payload.file);
    formData.append("document_type", payload.document_type);
    if (payload.owner_name) {
      formData.append("owner_name", payload.owner_name);
    }
    return request<BackendResponse<DsaDocument>>(`/dsas/${idOrCode}/documents`, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "",
      },
    });
  },

  updateDsaDocumentStatus: async (
    idOrCode: number | string,
    payload: { document_id: number; status: string; remarks?: string }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/dsas/${idOrCode}/documents/update-status`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteDsaDocument: async (
    idOrCode: number | string,
    payload: { document_id: number }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/dsas/${idOrCode}/documents/delete`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Product Management ──
  getProducts: async (): Promise<BackendResponse<LoanProduct[]>> => {
    return request<BackendResponse<LoanProduct[]>>("/v1/loan-products", { method: "GET" });
  },

  getProductsList: async (): Promise<BackendResponse<LoanProduct[]>> => {
    return request<BackendResponse<LoanProduct[]>>("/loan-products-list", { method: "GET" });
  },

  getProductDetail: async (id: number): Promise<BackendResponse<LoanProduct>> => {
    return request<BackendResponse<LoanProduct>>(`/v1/loan-products/${id}`, { method: "GET" });
  },

  createProduct: async (payload: Partial<LoanProduct> & { maker_comment?: string }): Promise<BackendResponse<LoanProduct>> => {
    return request<BackendResponse<LoanProduct>>("/v1/loan-products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateProduct: async (id: number, payload: Partial<LoanProduct> & { maker_comment?: string }): Promise<BackendResponse<LoanProduct>> => {
    return request<BackendResponse<LoanProduct>>(`/v1/loan-products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  archiveProduct: async (id: number, payload?: { maker_comment?: string }): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/loan-products/${id}/archive`, {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    });
  },

  deleteProduct: async (id: number): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/loan-products/${id}`, { method: "DELETE" });
  },

  getSchemes: async (productId: number): Promise<BackendResponse<LoanScheme[]>> => {
    return request<BackendResponse<LoanScheme[]>>(`/v1/loan-products/${productId}/schemes`, { method: "GET" });
  },

  createScheme: async (productId: number, payload: Partial<LoanScheme> & { maker_comment?: string }): Promise<BackendResponse<LoanScheme>> => {
    return request<BackendResponse<LoanScheme>>(`/v1/loan-products/${productId}/schemes`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getSchemeDetail: async (schemeId: number): Promise<BackendResponse<LoanScheme>> => {
    return request<BackendResponse<LoanScheme>>(`/v1/schemes/${schemeId}`, { method: "GET" });
  },

  updateScheme: async (schemeId: number, payload: Partial<LoanScheme> & { maker_comment?: string }): Promise<BackendResponse<LoanScheme>> => {
    return request<BackendResponse<LoanScheme>>(`/v1/schemes/${schemeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteScheme: async (schemeId: number): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/schemes/${schemeId}`, { method: "DELETE" });
  },

  getSchemeParameters: async (schemeId: number): Promise<BackendResponse<SchemeParameter>> => {
    return request<BackendResponse<SchemeParameter>>(`/v1/schemes/${schemeId}/parameters`, { method: "GET" });
  },

  upsertSchemeParameters: async (schemeId: number, payload: Partial<SchemeParameter> & { maker_comment?: string }): Promise<BackendResponse<SchemeParameter>> => {
    return request<BackendResponse<SchemeParameter>>(`/v1/schemes/${schemeId}/parameters`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  getSchemeSlabs: async (schemeId: number): Promise<BackendResponse<SchemeSlab[]>> => {
    return request<BackendResponse<SchemeSlab[]>>(`/v1/schemes/${schemeId}/slabs`, { method: "GET" });
  },

  createSchemeSlab: async (schemeId: number, payload: Partial<SchemeSlab> & { maker_comment?: string }): Promise<BackendResponse<SchemeSlab>> => {
    return request<BackendResponse<SchemeSlab>>(`/v1/schemes/${schemeId}/slabs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateSchemeSlab: async (slabId: number, payload: Partial<SchemeSlab> & { maker_comment?: string }): Promise<BackendResponse<SchemeSlab>> => {
    return request<BackendResponse<SchemeSlab>>(`/v1/slabs/${slabId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteSchemeSlab: async (slabId: number): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/slabs/${slabId}`, { method: "DELETE" });
  },

  bulkStoreSchemeSlabs: async (schemeId: number, payload: { slabs: Partial<SchemeSlab>[]; maker_comment?: string }): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/schemes/${schemeId}/slabs/bulk`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getProductMasterSlabs: async (productId: number): Promise<BackendResponse<{ product: LoanProduct; schemes: { id: number; name: string; slabs: SchemeSlab[] }[] }>> => {
    return request<BackendResponse<{ product: LoanProduct; schemes: { id: number; name: string; slabs: SchemeSlab[] }[] }>>(`/v1/loan-products/${productId}/slabs`, { method: "GET" });
  },
};
