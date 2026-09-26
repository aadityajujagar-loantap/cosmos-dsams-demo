import { request } from "./client";
import type { MakerRequest, MakerRequestActionType, MakerRequestStatus } from "@/types/makerChecker";
import type { Permission, Role, User, BranchRole } from "@/types/auth";
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
import type { LoanProduct, LoanType, LoanScheme, LoanTypeParameter, SchemeParameter, LoanTypeSlab, SchemeSlab } from "@/types/product";
import type {
  MasterValue,
  MasterValueDropdownItem,
  MasterValueListParams,
  MasterValuePayload,
} from "@/types/masterValue";

export interface BackendResponse<T> {
  status: string;
  message?: string;
  status_code?: number;
  data: T;
}

export interface KycApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  dsa_temp_id?: string;
  count?: number;
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

  grantRolePermission: (roleId: number, permissionId: number): Promise<{ message?: string }> => {
    return request<{ message?: string }>(`/admin/roles/${roleId}/permissions/${permissionId}`, {
      method: "POST",
    });
  },

  revokeRolePermission: (roleId: number, permissionId: number): Promise<{ message?: string }> => {
    return request<{ message?: string }>(`/admin/roles/${roleId}/permissions/${permissionId}`, {
      method: "DELETE",
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

  // â”€â”€ DSA Dropdowns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getStatesDropdown: async (): Promise<BackendResponse<StateOption[]>> => {
    return request<BackendResponse<StateOption[]>>("/states/dropdown", { method: "GET" });
  },

  getDistrictsDropdown: async (stateCode: string): Promise<BackendResponse<DistrictOption[]>> => {
    return request<BackendResponse<DistrictOption[]>>(`/districts/dropdown?state_code=${stateCode}`, {
      method: "GET",
    });
  },

  getBranchesDropdown: async (districtCode?: string): Promise<BackendResponse<BranchOption[]>> => {
    const query = districtCode ? `?district_code=${districtCode}` : "";
    return request<BackendResponse<BranchOption[]>>(`/branches/dropdown${query}`, {
      method: "GET",
    });
  },

  getSubRegionsDropdown: async (): Promise<BackendResponse<SubRegionOption[]>> => {
    return request<BackendResponse<SubRegionOption[]>>("/sub-regions/dropdown", { method: "GET" });
  },

  getRegionsDropdown: async (): Promise<BackendResponse<RegionOption[]>> => {
    return request<BackendResponse<RegionOption[]>>("/regions/dropdown", { method: "GET" });
  },

  // â”€â”€ DSA CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    return request<BackendResponse<DsaListResponse>>(`/v1/dsa${compactParams(params)}`, {
      method: "GET",
    });
  },

  getDsaDetail: async (idOrCode: number | string): Promise<BackendResponse<Dsa & { related_users?: any[] }>> => {
    return request<BackendResponse<Dsa & { related_users?: any[] }>>(`/v1/dsa/${idOrCode}`, {
      method: "GET",
    });
  },

  createDsa: async (payload: Partial<Dsa>): Promise<BackendResponse<Dsa>> => {
    return request<BackendResponse<Dsa>>("/v1/dsas-create", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateDsa: async (idOrCode: number | string, payload: Partial<Dsa>): Promise<BackendResponse<Dsa>> => {
    return request<BackendResponse<Dsa>>(`/v1/dsa/${idOrCode}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  // ── DSA Onboarding (V1 Multi-Step Architecture) ───────────────────────────
  sendSelfOnboardingOtp: async (payload: { mobile: string; branch_id: number }): Promise<BackendResponse<{ mobile: string; reference_id: string; expires_at: string }>> => {
    return request<BackendResponse<any>>("/v1/dsa/self/send-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  verifySelfOnboardingOtp: async (payload: {
    mobile: string;
    otp: string;
    reference_id?: string;
    branch_id: number;
    dsa_type?: string;
  }): Promise<BackendResponse<{ mobile: string; verified_at: string }>> => {
    return request<BackendResponse<any>>("/v1/dsa/self/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  submitSelfOnboarding: async (payload: any): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>("/v1/dsa/self/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  submitBranchOnboarding: async (payload: any): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>("/v1/dsa/branch/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  verifyDsaEmail: async (token: string): Promise<any> => {
    return request<any>(`/v1/dsa/verify-email/${token}`, {
      method: "GET",
    });
  },

  uploadDsaVisitReport: async (
    idOrCode: number | string,
    file: File,
    remarks?: string
  ): Promise<BackendResponse<any>> => {
    if (file && file.size > 2 * 1024 * 1024) {
      throw new Error("File size exceeds maximum allowed limit of 2MB.");
    }
    const formData = new FormData();
    formData.append("visit_report_file", file);
    if (remarks) {
      formData.append("visit_report_remarks", remarks);
    }
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/visit-report`, {
      method: "POST",
      body: formData,
    });
  },

  getDsaDocumentChecklist: async (idOrCode: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/documents/checklist`, {
      method: "GET",
    });
  },

  submitMakerApplication: async (
    idOrCode: number | string,
    payload?: { remarks?: string; verification_context?: any }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/maker/submit`, {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    });
  },

  getMakerDeviationReport: async (idOrCode: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/maker/deviation-report`, {
      method: "GET",
    });
  },

  getMakerBucket: async (params?: { page?: number; per_page?: number; search?: string; status?: string; dsa_type?: string }): Promise<BackendResponse<any>> => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return request<BackendResponse<any>>(`/v1/dsa/maker/bucket${query}`, { method: "GET" });
  },

  // ── Checker Workflow APIs ──────────────────────────────────────────────────
  getCheckerBucket: async (params?: { page?: number; per_page?: number }): Promise<BackendResponse<any>> => {
    const query = params ? `?${new URLSearchParams(params as any).toString()}` : "";
    return request<BackendResponse<any>>(`/v1/dsa/checker/bucket${query}`, { method: "GET" });
  },

  getCheckerApplicationDetails: async (idOrCode: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/checker`, { method: "GET" });
  },

  triggerCheckerVerification: async (
    idOrCode: number | string,
    code: string,
    context?: Record<string, any>
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/checker/verification/${code}`, {
      method: "POST",
      body: JSON.stringify(context ?? {}),
    });
  },

  getCheckerDdNote: async (idOrCode: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/checker/dd-note`, { method: "GET" });
  },

  saveCheckerDdNote: async (
    idOrCode: number | string,
    payload: {
      observations?: string;
      remarks?: string;
      exception_remarks?: string;
      recommendation?: string;
      structured_data?: any;
    }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/checker/dd-note`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getCheckerDdReviewReport: async (idOrCode: number | string, evaluationId?: string): Promise<BackendResponse<any>> => {
    const query = evaluationId ? `?evaluation_id=${evaluationId}` : "";
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/checker/dd-review-report${query}`, { method: "GET" });
  },

  submitCheckerApplication: async (
    idOrCode: number | string,
    payload?: { remarks?: string; dd_note?: any }
  ): Promise<BackendResponse<any>> => {
    const formattedDdNote =
      typeof payload?.dd_note === "string"
        ? {
            observations: payload.dd_note,
            remarks: payload.remarks || payload.dd_note,
            recommendation: "RECOMMEND",
          }
        : payload?.dd_note && typeof payload.dd_note === "object"
        ? {
            recommendation: "RECOMMEND",
            remarks: payload.remarks,
            ...payload.dd_note,
          }
        : undefined;

    const body: Record<string, any> = {};
    if (payload?.remarks) body.remarks = payload.remarks;
    if (formattedDdNote) body.dd_note = formattedDdNote;

    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/checker/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateWorkflowAction: async (
    idOrCode: number | string,
    payload: {
      action: "RECOMMEND" | "APPROVE" | "REJECT" | "REVERT" | "QUERY" | "RESUBMIT";
      remarks?: string;
      query?: string;
    }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/update-workflow-action`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getEmailActionDetails: async (token: string): Promise<BackendResponse<{
    dsa_id: number;
    dsa_code: string;
    applicant_name: string;
    dsa_type: string;
    branch_name: string;
    stage_level: number;
    stage_name: string;
    token_action: string;
    allowed_actions: string[];
    expires_at: string;
    designated_user: string;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/email-action/${token}`, {
      method: "GET",
    });
  },

  submitEmailAction: async (
    token: string,
    payload: { action?: string; remarks?: string }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/email-action/${token}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getFinalApprovalReview: async (idOrCode: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/final-approval-review`, {
      method: "GET",
    });
  },

  getEmpanelmentLetter: async (idOrCode: number | string): Promise<BackendResponse<{
    dsa_id: number;
    document_id: number;
    document_type: string;
    file_name: string;
    file_path: string;
    file_url: string;
    size: number;
    status: string;
    uploaded_at?: string;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/empanelment-letter`, {
      method: "GET",
    });
  },

  getDigitalAcceptance: async (token: string): Promise<BackendResponse<{
    valid: boolean;
    dsa_id: number;
    dsa_code: string;
    applicant_name: string;
    company_name: string;
    email: string;
    mobile_no: string;
    branch_code: string;
    branch_name: string;
    letter_document_id: number | null;
    letter_file_name: string | null;
    letter_file_url: string | null;
    digital_acceptance_status: string;
    expires_at: string;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/digital-acceptance/${token}`, {
      method: "GET",
    });
  },

  submitDigitalAcceptance: async (token: string): Promise<BackendResponse<{
    success: boolean;
    message: string;
    dsa_id: number;
    dsa_code: string;
    digital_acceptance_status: string;
    digital_accepted_at: string;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/digital-acceptance/${token}`, {
      method: "POST",
    });
  },

  updateDsaProfile: async (idOrCode: number | string, payload: Partial<Dsa> & { action?: string; remarks?: string; query?: string }): Promise<BackendResponse<Dsa>> => {
    return request<BackendResponse<Dsa>>(`/v1/dsa/${idOrCode}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  updateDsaStatus: async (
    idOrCode: number | string,
    payload: { onboarding_status?: string; operational_status?: string; reason: string }
  ): Promise<BackendResponse<Dsa>> => {
    return request<BackendResponse<Dsa>>(`/v1/dsa/${idOrCode}/update-status`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── DSA Agreements ──────────────────────────────────────────────────────────
  generateDsaAgreement: async (idOrCode: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/agreements/generate`, {
      method: "POST",
    });
  },

  downloadDsaAgreement: async (idOrCode: number | string): Promise<BackendResponse<{ file_url: string; agreement_status: string }>> => {
    return request<BackendResponse<{ file_url: string; agreement_status: string }>>(`/v1/dsa/${idOrCode}/agreements/download`, {
      method: "GET",
    });
  },

  uploadSignedAgreement: async (idOrCode: number | string, file: File): Promise<BackendResponse<any>> => {
    const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
      });
    };

    const base64Data = await fileToBase64(file);

    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/agreements/upload-signed`, {
      method: "POST",
      body: JSON.stringify({
        document_base64: base64Data,
        file_name: file.name,
        remarks: "Physical signed agreement copy uploaded and verified"
      }),
    });
  },

  getDsaAgreement: async (idOrCode: number | string): Promise<BackendResponse<{
    dsa_id: number;
    document_id: number;
    document_type: string;
    file_name: string;
    file_path: string;
    file_url: string;
    size: string;
    status: string;
    uploaded_at: string;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/agreement`, {
      method: "GET",
    });
  },

  getSignedAgreementUploadPreview: async (token: string): Promise<BackendResponse<{
    valid: boolean;
    dsa_id: number;
    dsa_code: string;
    applicant_name: string;
    company_name: string | null;
    email: string;
    mobile_no: string;
    branch_code: string;
    branch_name: string;
    agreement_document_id: number;
    agreement_file_name: string;
    agreement_file_url: string;
    agreement_status: string;
    expires_at: string;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/upload-signed-agreement/${token}`, {
      method: "GET",
    });
  },

  uploadPartnerSignedAgreement: async (
    token: string,
    payload: { file?: File; document_base64?: string; file_name?: string; remarks?: string }
  ): Promise<BackendResponse<{
    success: boolean;
    message: string;
    dsa_id: number;
    dsa_code: string;
    agreement_status: string;
    document: {
      document_id: number;
      file_name: string;
      file_path: string;
      file_url: string;
      size: string;
      status: string;
      uploaded_at: string;
    };
  }>> => {
    if (payload.file && payload.file.size > 2 * 1024 * 1024) {
      throw new Error("File size exceeds maximum allowed limit of 2MB.");
    }
    if (payload.file) {
      const formData = new FormData();
      formData.append("file", payload.file);
      if (payload.remarks) {
        formData.append("remarks", payload.remarks);
      }
      return request<BackendResponse<any>>(`/v1/dsa/upload-signed-agreement/${token}`, {
        method: "POST",
        body: formData,
      });
    }

    return request<BackendResponse<any>>(`/v1/dsa/upload-signed-agreement/${token}`, {
      method: "POST",
      body: JSON.stringify({
        document_base64: payload.document_base64,
        file_name: payload.file_name,
        remarks: payload.remarks,
      }),
    });
  },

  getSignedAgreementReview: async (idOrCode: number | string): Promise<BackendResponse<{
    dsa_id: number;
    dsa_code: string;
    applicant_name: string;
    company_name: string | null;
    email: string;
    mobile_no: string;
    branch_code: string;
    branch_name: string;
    onboarding_status: string;
    operational_status: string;
    agreement_status: string;
    digital_acceptance_status: string;
    digital_accepted_at: string;
    generated_agreement: {
      document_id: number;
      file_name: string;
      file_url: string;
      size: string;
      status: string;
      uploaded_at: string;
    } | null;
    latest_signed_agreement: {
      document_id: number;
      file_name: string;
      file_url: string;
      size: string;
      status: string;
      remarks?: string;
      uploaded_at: string;
    } | null;
    signed_agreement_history: Array<{
      document_id: number;
      file_name: string;
      file_path?: string;
      file_url: string;
      size: string;
      status: string;
      remarks?: string;
      uploaded_at: string;
    }>;
    allowed_actions: string[];
    can_decision: boolean;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/agreement/review`, {
      method: "GET",
    });
  },

  verifySignedAgreement: async (
    idOrCode: number | string,
    payload: { action: "APPROVE" | "REJECT" | "approve" | "reject"; remarks?: string }
  ): Promise<BackendResponse<{
    success: boolean;
    message: string;
    dsa_id: number;
    dsa_code: string;
    agreement_status: string;
    operational_status: string;
    document: {
      document_id: number;
      status: string;
      remarks?: string;
      file_name?: string;
      file_url?: string;
    };
    reupload_token?: {
      token: string;
      expires_at: string;
      upload_url: string;
    };
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/agreement/verify-signed`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── DSA Documents ───────────────────────────────────────────────────────────
  getDsaDocuments: async (idOrCode: number | string): Promise<BackendResponse<DsaDocument[]>> => {
    return request<BackendResponse<DsaDocument[]>>(`/v1/dsa/${idOrCode}/documents`, {
      method: "GET",
    });
  },

  getDsaDocumentFileUrl: (idOrCode: number | string, documentId: number | string): string => {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
    return `${apiBase}/api/v1/dsa/${idOrCode}/documents/${documentId}/file`;
  },

  uploadDsaDocument: async (
    idOrCode: number | string,
    payload: { file?: File; document_base64?: string; file_name?: string; document_type: string; owner_name?: string; remarks?: string }
  ): Promise<BackendResponse<DsaDocument>> => {
    if (payload.file && payload.file.size > 2 * 1024 * 1024) {
      throw new Error("File size exceeds maximum allowed limit of 2MB.");
    }
    let base64Data = payload.document_base64;
    let fileName = payload.file_name;

    if (payload.file && !base64Data) {
      const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      };
      base64Data = await fileToBase64(payload.file);
      fileName = payload.file.name;
    }

    return request<BackendResponse<DsaDocument>>(`/v1/dsa/${idOrCode}/documents`, {
      method: "POST",
      body: JSON.stringify({
        document_type: payload.document_type,
        file_name: fileName || "document.pdf",
        document_base64: base64Data,
        owner_name: payload.owner_name || null,
        remarks: payload.remarks || "Uploaded during onboarding"
      }),
    });
  },

  updateDsaDocumentStatus: async (
    idOrCode: number | string,
    payload: { document_id: number; status: string; remarks?: string }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/documents/update-status`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteDsaDocument: async (
    idOrCode: number | string,
    payload: { document_id: number }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/documents/delete`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // â”€â”€ Product Management â”€â”€
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

  getLoanTypes: async (productId: number): Promise<BackendResponse<LoanType[]>> => {
    return request<BackendResponse<LoanType[]>>(`/v1/loan-products/${productId}/loan-types`, { method: "GET" });
  },
  getSchemes: async (productId: number): Promise<BackendResponse<LoanType[]>> => {
    return adminApi.getLoanTypes(productId);
  },

  createLoanType: async (productId: number, payload: Partial<LoanType> & { maker_comment?: string }): Promise<BackendResponse<LoanType>> => {
    return request<BackendResponse<LoanType>>(`/v1/loan-products/${productId}/loan-types`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createScheme: async (productId: number, payload: Partial<LoanType> & { maker_comment?: string }): Promise<BackendResponse<LoanType>> => {
    return adminApi.createLoanType(productId, payload);
  },

  getLoanTypeDetail: async (typeId: number): Promise<BackendResponse<LoanType>> => {
    return request<BackendResponse<LoanType>>(`/v1/loan-types/${typeId}`, { method: "GET" });
  },
  getSchemeDetail: async (schemeId: number): Promise<BackendResponse<LoanType>> => {
    return adminApi.getLoanTypeDetail(schemeId);
  },

  updateLoanType: async (typeId: number, payload: Partial<LoanType> & { maker_comment?: string }): Promise<BackendResponse<LoanType>> => {
    return request<BackendResponse<LoanType>>(`/v1/loan-types/${typeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  updateScheme: async (schemeId: number, payload: Partial<LoanType> & { maker_comment?: string }): Promise<BackendResponse<LoanType>> => {
    return adminApi.updateLoanType(schemeId, payload);
  },

  deleteLoanType: async (typeId: number): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/loan-types/${typeId}`, { method: "DELETE" });
  },
  deleteScheme: async (schemeId: number): Promise<BackendResponse<any>> => {
    return adminApi.deleteLoanType(schemeId);
  },

  getLoanTypeParameters: async (typeId: number): Promise<BackendResponse<LoanTypeParameter>> => {
    return request<BackendResponse<LoanTypeParameter>>(`/v1/loan-types/${typeId}/parameters`, { method: "GET" });
  },
  getSchemeParameters: async (schemeId: number): Promise<BackendResponse<LoanTypeParameter>> => {
    return adminApi.getLoanTypeParameters(schemeId);
  },

  upsertLoanTypeParameters: async (typeId: number, payload: Partial<LoanTypeParameter> & { maker_comment?: string }): Promise<BackendResponse<LoanTypeParameter>> => {
    return request<BackendResponse<LoanTypeParameter>>(`/v1/loan-types/${typeId}/parameters`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  upsertSchemeParameters: async (schemeId: number, payload: Partial<LoanTypeParameter> & { maker_comment?: string }): Promise<BackendResponse<LoanTypeParameter>> => {
    return adminApi.upsertLoanTypeParameters(schemeId, payload);
  },

  getLoanTypeSlabs: async (typeId: number): Promise<BackendResponse<LoanTypeSlab[]>> => {
    return request<BackendResponse<LoanTypeSlab[]>>(`/v1/loan-types/${typeId}/slabs`, { method: "GET" });
  },
  getSchemeSlabs: async (schemeId: number): Promise<BackendResponse<LoanTypeSlab[]>> => {
    return adminApi.getLoanTypeSlabs(schemeId);
  },

  createLoanTypeSlab: async (typeId: number, payload: Partial<LoanTypeSlab> & { maker_comment?: string }): Promise<BackendResponse<LoanTypeSlab>> => {
    return request<BackendResponse<LoanTypeSlab>>(`/v1/loan-types/${typeId}/slabs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  createSchemeSlab: async (schemeId: number, payload: Partial<LoanTypeSlab> & { maker_comment?: string }): Promise<BackendResponse<LoanTypeSlab>> => {
    return adminApi.createLoanTypeSlab(schemeId, payload);
  },

  updateLoanTypeSlab: async (slabId: number, payload: Partial<LoanTypeSlab> & { maker_comment?: string }): Promise<BackendResponse<LoanTypeSlab>> => {
    return request<BackendResponse<LoanTypeSlab>>(`/v1/slabs/${slabId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  updateSchemeSlab: async (slabId: number, payload: Partial<LoanTypeSlab> & { maker_comment?: string }): Promise<BackendResponse<LoanTypeSlab>> => {
    return adminApi.updateLoanTypeSlab(slabId, payload);
  },

  deleteLoanTypeSlab: async (slabId: number): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/slabs/${slabId}`, { method: "DELETE" });
  },
  deleteSchemeSlab: async (slabId: number): Promise<BackendResponse<any>> => {
    return adminApi.deleteLoanTypeSlab(slabId);
  },

  bulkStoreLoanTypeSlabs: async (typeId: number, payload: { slabs: Partial<LoanTypeSlab>[]; maker_comment?: string }): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/loan-types/${typeId}/slabs/bulk`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  bulkStoreSchemeSlabs: async (schemeId: number, payload: { slabs: Partial<LoanTypeSlab>[]; maker_comment?: string }): Promise<BackendResponse<any>> => {
    return adminApi.bulkStoreLoanTypeSlabs(schemeId, payload);
  },

  getProductMasterSlabs: async (productId: number): Promise<BackendResponse<{ product: LoanProduct; loan_types: { id: number; name: string; slabs: LoanTypeSlab[] }[] }>> => {
    return request<BackendResponse<{ product: LoanProduct; loan_types: { id: number; name: string; slabs: LoanTypeSlab[] }[] }>>(`/v1/loan-products/${productId}/slabs`, { method: "GET" });
  },

  getAllProductSlabs: async (params?: { search?: string; status?: string }): Promise<BackendResponse<LoanProduct[]>> => {
    return request<BackendResponse<LoanProduct[]>>(`/v1/loan-products/slabs${compactParams(params)}`, { method: "GET" });
  },

  // â”€â”€ Branch Role CRUD â”€â”€
  getBranchRoles: async (params?: { search?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<BranchRole>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<BranchRole>>>(
      `/admin/branch-roles${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  getBranchRolesDropdown: (): Promise<BackendResponse<BranchRole[]>> => {
    return request<BackendResponse<BranchRole[]>>("/admin/branch-roles/dropdown", { method: "GET" });
  },

  createBranchRole: async (payload: { branch_role_id: string; rolename: string }): Promise<BranchRole | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<BranchRole> | MakerCheckerActionResponse>("/admin/branch-roles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<BranchRole>(response);
  },

  updateBranchRole: async (branchRoleId: string, payload: Partial<{ branch_role_id: string; rolename: string }>): Promise<BranchRole | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<BranchRole> | MakerCheckerActionResponse>(`/admin/branch-roles/${branchRoleId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<BranchRole>(response);
  },

  deleteBranchRole: async (branchRoleId: string): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<{ message?: string } | MakerCheckerActionResponse>(`/admin/branch-roles/${branchRoleId}`, {
      method: "DELETE",
    });
    return response;
  },

  // ── User Branch Mappings ──────────────────────────────────────────────────

  /**
   * List all user-branch mappings (paginated)
   */
  getUserBranchMappings: async (params?: {
    search?: string;
    user_id?: number;
    branch_code?: string;
    per_page?: number;
    page?: number;
  }): Promise<PaginatedResponse<import("@/types/auth").UserBranchMapping>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<import("@/types/auth").UserBranchMapping>>>(
      `/admin/user-branch-mappings${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  /**
   * Create a single user-branch mapping
   */
  createUserBranchMapping: async (payload: {
    user_id: number;
    branch_code: string;
  }): Promise<import("@/types/auth").UserBranchMapping> => {
    const response = await request<ApiEnvelope<import("@/types/auth").UserBranchMapping>>(
      "/admin/user-branch-mappings",
      { method: "POST", body: JSON.stringify(payload) }
    );
    return response.data;
  },

  /**
   * Bulk assign multiple branches to a user (comma-separated branch_codes)
   */
  bulkAssignBranches: async (payload: {
    user_id: number;
    branch_codes: string;
  }): Promise<import("@/types/auth").BulkAssignResult> => {
    const response = await request<ApiEnvelope<import("@/types/auth").BulkAssignResult>>(
      "/admin/user-branch-mappings/bulk",
      { method: "POST", body: JSON.stringify(payload) }
    );
    return response.data;
  },

  /**
   * Upload CSV for batch user-branch mapping import
   */
  uploadBranchMappingCsv: async (file: File): Promise<import("@/types/auth").CsvUploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await request<ApiEnvelope<import("@/types/auth").CsvUploadResult>>(
      "/admin/user-branch-mappings/upload-csv",
      { method: "POST", body: formData, headers: { "Content-Type": "" } }
    );
    return response.data;
  },

  /**
   * Delete a user-branch mapping (soft delete)
   */
  deleteUserBranchMapping: async (id: number): Promise<{ message?: string }> => {
    return request<{ message?: string }>(`/admin/user-branch-mappings/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Get all branches assigned to a specific user
   */
  getUserBranches: async (userId: number): Promise<import("@/types/auth").UserBranchMapping[]> => {
    const response = await request<ApiEnvelope<import("@/types/auth").UserBranchMapping[]>>(
      `/admin/user-branch-mappings/user/${userId}`,
      { method: "GET" }
    );
    return response.data;
  },

  /**
   * Get all users assigned to a specific branch
   */
  getBranchUsers: async (branchCode: string): Promise<import("@/types/auth").UserBranchMapping[]> => {
    const response = await request<ApiEnvelope<import("@/types/auth").UserBranchMapping[]>>(
      `/admin/user-branch-mappings/branch/${branchCode}`,
      { method: "GET" }
    );
    return response.data;
  },

  // ── Region APIs ──────────────────────────────────────────────────────────

  getRegions: async (params?: { search?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<import("@/types/auth").RegionItem>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<import("@/types/auth").RegionItem>>>(
      `/admin/regions${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  getRegionDetail: async (regionCode: string): Promise<import("@/types/auth").RegionItem> => {
    const response = await request<ApiEnvelope<import("@/types/auth").RegionItem>>(`/admin/regions/${regionCode}`, {
      method: "GET",
    });
    return response.data;
  },

  createRegion: async (payload: { region_code: string; region_name: string }): Promise<import("@/types/auth").RegionItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").RegionItem> | MakerCheckerActionResponse>("/admin/regions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").RegionItem>(response);
  },

  updateRegion: async (regionCode: string, payload: Partial<{ region_code: string; region_name: string }>): Promise<import("@/types/auth").RegionItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").RegionItem> | MakerCheckerActionResponse>(`/admin/regions/${regionCode}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").RegionItem>(response);
  },

  deleteRegion: async (regionCode: string): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<{ message?: string } | MakerCheckerActionResponse>(`/admin/regions/${regionCode}`, {
      method: "DELETE",
    });
    return response;
  },

  getAdminRegionsDropdown: async (): Promise<BackendResponse<RegionOption[]>> => {
    return request<BackendResponse<RegionOption[]>>("/admin/regions/dropdown", { method: "GET" });
  },

  // ── Sub-Region APIs ───────────────────────────────────────────────────────

  getSubRegions: async (params?: { search?: string; region_code?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<import("@/types/auth").SubRegionItem>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<import("@/types/auth").SubRegionItem>>>(
      `/admin/sub-regions${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  getSubRegionDetail: async (subRegionCode: string): Promise<import("@/types/auth").SubRegionItem> => {
    const response = await request<ApiEnvelope<import("@/types/auth").SubRegionItem>>(`/admin/sub-regions/${subRegionCode}`, {
      method: "GET",
    });
    return response.data;
  },

  createSubRegion: async (payload: { sub_region_code: string; sub_region_name: string; region_code: string }): Promise<import("@/types/auth").SubRegionItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").SubRegionItem> | MakerCheckerActionResponse>("/admin/sub-regions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").SubRegionItem>(response);
  },

  updateSubRegion: async (subRegionCode: string, payload: Partial<{ sub_region_code: string; sub_region_name: string; region_code: string }>): Promise<import("@/types/auth").SubRegionItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").SubRegionItem> | MakerCheckerActionResponse>(`/admin/sub-regions/${subRegionCode}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").SubRegionItem>(response);
  },

  deleteSubRegion: async (subRegionCode: string): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<{ message?: string } | MakerCheckerActionResponse>(`/admin/sub-regions/${subRegionCode}`, {
      method: "DELETE",
    });
    return response;
  },

  getAdminSubRegionsDropdown: async (): Promise<BackendResponse<SubRegionOption[]>> => {
    return request<BackendResponse<SubRegionOption[]>>("/admin/sub-regions/dropdown", { method: "GET" });
  },

  // ── State APIs ─────────────────────────────────────────────────────────────

  getStates: async (params?: { search?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<import("@/types/auth").StateItem>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<import("@/types/auth").StateItem>>>(
      `/admin/states${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  getStateDetail: async (stateCode: string): Promise<import("@/types/auth").StateItem> => {
    const response = await request<ApiEnvelope<import("@/types/auth").StateItem>>(`/admin/states/${stateCode}`, {
      method: "GET",
    });
    return response.data;
  },

  createState: async (payload: { state_code: string; state_name: string }): Promise<import("@/types/auth").StateItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").StateItem> | MakerCheckerActionResponse>("/admin/states", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").StateItem>(response);
  },

  updateState: async (stateCode: string, payload: Partial<{ state_code: string; state_name: string }>): Promise<import("@/types/auth").StateItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").StateItem> | MakerCheckerActionResponse>(`/admin/states/${stateCode}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").StateItem>(response);
  },

  deleteState: async (stateCode: string): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<{ message?: string } | MakerCheckerActionResponse>(`/admin/states/${stateCode}`, {
      method: "DELETE",
    });
    return response;
  },

  getAdminStatesDropdown: async (): Promise<BackendResponse<StateOption[]>> => {
    return request<BackendResponse<StateOption[]>>("/admin/states/dropdown", { method: "GET" });
  },

  // ── District APIs ──────────────────────────────────────────────────────────

  getDistricts: async (params?: { search?: string; state_code?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<import("@/types/auth").DistrictItem>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<import("@/types/auth").DistrictItem>>>(
      `/admin/districts${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  getDistrictDetail: async (districtCode: string): Promise<import("@/types/auth").DistrictItem> => {
    const response = await request<ApiEnvelope<import("@/types/auth").DistrictItem>>(`/admin/districts/${districtCode}`, {
      method: "GET",
    });
    return response.data;
  },

  createDistrict: async (payload: { district_code: string; district_name: string; state_code: string }): Promise<import("@/types/auth").DistrictItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").DistrictItem> | MakerCheckerActionResponse>("/admin/districts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").DistrictItem>(response);
  },

  updateDistrict: async (districtCode: string, payload: Partial<{ district_code: string; district_name: string; state_code: string }>): Promise<import("@/types/auth").DistrictItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").DistrictItem> | MakerCheckerActionResponse>(`/admin/districts/${districtCode}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").DistrictItem>(response);
  },

  deleteDistrict: async (districtCode: string): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<{ message?: string } | MakerCheckerActionResponse>(`/admin/districts/${districtCode}`, {
      method: "DELETE",
    });
    return response;
  },

  getAdminDistrictsDropdown: async (): Promise<BackendResponse<DistrictOption[]>> => {
    return request<BackendResponse<DistrictOption[]>>("/admin/districts/dropdown", { method: "GET" });
  },

  // ── Branch APIs & Sync ─────────────────────────────────────────────────────

  getBranches: async (params?: { search?: string; region_code?: string; sub_region_code?: string; district_code?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<import("@/types/auth").BranchItem>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<import("@/types/auth").BranchItem>>>(
      `/admin/branches${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  getBranchDetail: async (branchCode: string): Promise<import("@/types/auth").BranchItem> => {
    const response = await request<ApiEnvelope<import("@/types/auth").BranchItem>>(`/admin/branches/${branchCode}`, {
      method: "GET",
    });
    return response.data;
  },

  createBranch: async (payload: { branch_code: string; branch_name: string; branch_number?: string; region_code: string; sub_region_code: string; district_code?: string }): Promise<import("@/types/auth").BranchItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").BranchItem> | MakerCheckerActionResponse>("/admin/branches", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").BranchItem>(response);
  },

  updateBranch: async (branchCode: string, payload: Partial<{ branch_code: string; branch_name: string; branch_number?: string; region_code: string; sub_region_code: string; district_code: string }>): Promise<import("@/types/auth").BranchItem | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<import("@/types/auth").BranchItem> | MakerCheckerActionResponse>(`/admin/branches/${branchCode}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return unwrapMutation<import("@/types/auth").BranchItem>(response);
  },

  deleteBranch: async (branchCode: string): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<{ message?: string } | MakerCheckerActionResponse>(`/admin/branches/${branchCode}`, {
      method: "DELETE",
    });
    return response;
  },

  getAdminBranchesDropdown: async (): Promise<BackendResponse<BranchOption[]>> => {
    return request<BackendResponse<BranchOption[]>>("/admin/branches/dropdown", { method: "GET" });
  },

  syncBranches: async (): Promise<BackendResponse<import("@/types/auth").BranchSyncResult>> => {
    return request<BackendResponse<import("@/types/auth").BranchSyncResult>>("/admin/branches/sync", {
      method: "POST",
    });
  },

  createLead: async (payload: {
    CustName: string;
    mobile: string;
    email: string;
    city: string;
    state: string;
    Branch_id: string;
    subregion_id: string;
    DSACode: string;
  }): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>("/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  convertLead: async (id: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/leads/${id}/convert`, {
      method: "POST",
    });
  },

  getAdminBranches: async (params?: { sub_region_code?: string; per_page?: number }): Promise<BackendResponse<any>> => {
    const searchParams = new URLSearchParams();
    if (params?.sub_region_code) searchParams.append("sub_region_code", params.sub_region_code);
    if (params?.per_page) searchParams.append("per_page", String(params.per_page));
    return request<BackendResponse<any>>(`/admin/branches?${searchParams.toString()}`, { method: "GET" });
  },

  getLeads: async (params?: { search?: string; status?: string; per_page?: number; page?: number }): Promise<BackendResponse<any>> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append("search", params.search);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.per_page) searchParams.append("per_page", String(params.per_page));
    if (params?.page) searchParams.append("page", String(params.page));
    return request<BackendResponse<any>>(`/leads?${searchParams.toString()}`, { method: "GET" });
  },

  getLeadDetail: async (id: number | string): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/leads/${id}`, { method: "GET" });
  },

  getCaptcha: async (): Promise<any> => {
    return request<any>("/auth/captcha", { method: "GET" });
  },

  processLoanStep: async (
    stepKey: string,
    payload: any,
    loanType: string = "PERSONAL_LOAN"
  ): Promise<any> => {
    return request<any>("/v1/loan/process-step", {
      method: "POST",
      headers: {
        "X-Tenant-ID": "cosmos-bank",
        "X-API-Token": "ijkyWTMMuVWqDaGJFiEWQd2jogOuvO8QdkDBMWUG882HXQPvqg2StcydbAUiNH4J",
      },
      body: JSON.stringify({
        step_key: stepKey,
        loan_type: loanType,
        payload,
      }),
    });
  },

  getApplicationDetails: async (applicationId: string): Promise<any> => {
    return request<any>(`/v1/loan/applications/${applicationId}`, {
      method: "GET",
      headers: {
        "X-Tenant-ID": "cosmos-bank",
        "X-API-Token": "ijkyWTMMuVWqDaGJFiEWQd2jogOuvO8QdkDBMWUG882HXQPvqg2StcydbAUiNH4J",
      },
    });
  },

  downloadOfferLetter: async (applicationId: string, currentStep: string = "LOAN_APPLICATION", sectionId: string = "loan_application_submitted"): Promise<any> => {
    return request<any>("/v1/loan/loan-offers", {
      method: "POST",
      headers: {
        "X-Tenant-ID": "cosmos-bank",
        "X-API-Token": "ijkyWTMMuVWqDaGJFiEWQd2jogOuvO8QdkDBMWUG882HXQPvqg2StcydbAUiNH4J",
      },
      body: JSON.stringify({
        step_key: currentStep,
        payload: {
          application_id: applicationId,
          section_id: sectionId,
        },
      }),
    });
  },

  /**
   * GET /api/v1/loan/verify-email?token={token}
   * Borrower email verification endpoint for external Loan Journey (Task 19 / Phase 4).
   */
  verifyLoanEmail: async (token: string): Promise<any> => {
    return request<any>(`/v1/loan/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
      headers: {
        "X-Tenant-ID": "cosmos-bank",
        "X-API-Token": "ijkyWTMMuVWqDaGJFiEWQd2jogOuvO8QdkDBMWUG882HXQPvqg2StcydbAUiNH4J",
      },
    });
  },

  /**
   * POST /api/v1/loan/resend-email-verification
   * Resend borrower email verification link for external Loan Journey (Task 19 / Phase 4).
   */
  resendLoanEmailVerification: async (applicationId: string): Promise<any> => {
    return request<any>("/v1/loan/resend-email-verification", {
      method: "POST",
      headers: {
        "X-Tenant-ID": "cosmos-bank",
        "X-API-Token": "ijkyWTMMuVWqDaGJFiEWQd2jogOuvO8QdkDBMWUG882HXQPvqg2StcydbAUiNH4J",
      },
      body: JSON.stringify({
        application_id: applicationId,
      }),
    });
  },

  // ── DSA Portal Users ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/dsa/{id}/users
   * Fetch all authorized user contacts mapped to this DSA.
   */
  getDsaUsers: async (idOrCode: number | string): Promise<BackendResponse<{
    users: Array<{
      mapping_id: number;
      user_id: number;
      name: string;
      email: string;
      mobile?: string;
      phone?: string;
      ticket_no?: string;
      role_in_dsa: string;
      is_primary_admin: boolean;
      deactivated_at?: string | null;
      created_at: string;
    }>;
    total: number;
  }>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/users`, {
      method: "GET",
    });
  },

  /**
   * POST /api/v1/dsa/{id}/users
   * Create and map a new authorized portal user to the DSA.
   * Payload: { name, email, mobile?, phone?, ticket_no?, password?, role_in_dsa? }
   */
  createDsaUser: async (
    idOrCode: number | string,
    payload: {
      name: string;
      email: string;
      mobile?: string;
      phone?: string;
      ticket_no?: string;
      password?: string;
      role_in_dsa?: string;
    }
  ): Promise<BackendResponse<any>> => {
    return request<BackendResponse<any>>(`/v1/dsa/${idOrCode}/users`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Master Values ──────────────────────────────────────────────────────────

  /**
   * GET /api/admin/master-values
   * Paginated listing of master values with optional call_type and is_active filters
   */
  getMasterValuesPage: async (params?: MasterValueListParams): Promise<PaginatedResponse<MasterValue>> => {
    const response = await request<ApiEnvelope<PaginatedResponse<MasterValue>>>(
      `/admin/master-values${compactParams(params)}`,
      { method: "GET" }
    );
    return response.data;
  },

  /**
   * GET /api/admin/master-values/{id}
   * Fetch single master value record
   */
  getMasterValue: async (id: number): Promise<MasterValue> => {
    const response = await request<ApiEnvelope<MasterValue>>(`/admin/master-values/${id}`, {
      method: "GET",
    });
    return response.data;
  },

  /**
   * POST /api/admin/master-values
   * Create new master value (Maker-Checker protected)
   */
  createMasterValue: async (
    payload: MasterValuePayload
  ): Promise<MasterValue | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<MasterValue> | MakerCheckerActionResponse>(
      "/admin/master-values",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return unwrapMutation<MasterValue>(response);
  },

  /**
   * PUT /api/admin/master-values/{id}
   * Update existing master value (Maker-Checker protected)
   */
  updateMasterValue: async (
    id: number,
    payload: Partial<MasterValuePayload>
  ): Promise<MasterValue | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<MasterValue> | MakerCheckerActionResponse>(
      `/admin/master-values/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
    return unwrapMutation<MasterValue>(response);
  },

  /**
   * DELETE /api/admin/master-values/{id}
   * Soft-delete master value (Maker-Checker protected)
   */
  deleteMasterValue: async (
    id: number
  ): Promise<{ message?: string } | MakerCheckerActionResponse> => {
    const response = await request<ApiEnvelope<{ message?: string }> | MakerCheckerActionResponse>(
      `/admin/master-values/${id}`,
      {
        method: "DELETE",
      }
    );
    return unwrapMutation<{ message?: string }>(response);
  },

  /**
   * GET /api/master-values/dropdown?call_type={call_type}
   * Get active master values for a specific call_type (UI select options)
   */
  getMasterValuesDropdown: async (callType: string, state?: string): Promise<MasterValueDropdownItem[]> => {
    const url = state
      ? `/master-values/dropdown?call_type=${encodeURIComponent(callType)}&state=${encodeURIComponent(state)}`
      : `/master-values/dropdown?call_type=${encodeURIComponent(callType)}`;
    const response = await request<ApiEnvelope<MasterValueDropdownItem[]>>(
      url,
      { method: "GET" }
    );
    return response.data || [];
  },

  // ── 11. KYC & Verification Gateways (ScoreMe / BAV) ─────────────────────────
  /**
   * POST /api/v1/kyc/scoreme/gst-info
   * GSTIN filing and registration lookup (ScoreMe API Gateway - Flags 1 to 7)
   */
  verifyGstInfo: async (payload: {
    gstin: string;
    flag?: number;
    dsa_temp_id?: string;
    dsa_id?: number;
  }): Promise<KycApiResponse<any>> => {
    return request<KycApiResponse<any>>("/v1/kyc/scoreme/gst-info", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/kyc/scoreme/pan-to-gstin
   * Resolve all GSTIN numbers linked to a PAN
   */
  resolvePanToGstin: async (payload: {
    pan: string;
    dsa_temp_id?: string;
    dsa_id?: number;
  }): Promise<KycApiResponse<any>> => {
    return request<KycApiResponse<any>>("/v1/kyc/scoreme/pan-to-gstin", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/kyc/scoreme/udyam-verification
   * Verify MSME Udyam Certificate registration details
   */
  verifyUdyam: async (payload: {
    registration_number: string;
    dsa_temp_id?: string;
    dsa_id?: number;
  }): Promise<KycApiResponse<any>> => {
    return request<KycApiResponse<any>>("/v1/kyc/scoreme/udyam-verification", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/kyc/scoreme/pan-advance
   * Advanced PAN verification with name match and status
   */
  verifyPanAdvance: async (payload: {
    pan: string;
    dsa_temp_id?: string;
    dsa_id?: number;
  }): Promise<KycApiResponse<any>> => {
    return request<KycApiResponse<any>>("/v1/kyc/scoreme/pan-advance", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/kyc/bank-verification
   * Penny-drop Bank Account Verification (₹1.00 Verification)
   */
  verifyBankAccount: async (payload: {
    account_number: string;
    ifsc: string;
    dsa_temp_id?: string;
    dsa_id?: number;
  }): Promise<KycApiResponse<any>> => {
    return request<KycApiResponse<any>>("/v1/kyc/bank-verification", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * POST /api/v1/kyc/bank-verification-pennyless
   * Pennyless Bank Account Verification
   */
  verifyBankAccountPennyless: async (payload: {
    account_number: string;
    ifsc: string;
    dsa_temp_id?: string;
    dsa_id?: number;
  }): Promise<KycApiResponse<any>> => {
    return request<KycApiResponse<any>>("/v1/kyc/bank-verification-pennyless", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * GET /api/v1/kyc/verifications/{tempId}
   * Query verification records and historical logs by temp ID or DSA ID
   */
  getKycVerifications: async (tempIdOrDsaId: string | number): Promise<KycApiResponse<any[]>> => {
    return request<KycApiResponse<any[]>>(`/v1/kyc/verifications/${tempIdOrDsaId}`, {
      method: "GET",
    });
  },
};

export const fetchLoanProducts = async (): Promise<any> => {
  return request<any>("/loan-products-list", { method: "GET" });
};

export const fetchLoanTypesByProduct = async (productId: number | string): Promise<any> => {
  return request<any>(`/loan-types/${productId}`, { method: "GET" });
};

export const getMasterValues = async (params: { group?: string; call_type?: string }): Promise<any> => {
  const group = params.group || params.call_type;
  return request<any>(`/master-values/dropdown?call_type=${encodeURIComponent(group || '')}`, { method: "GET" });
};

export const verifyPanAdvance = async (pan: string): Promise<any> => {
  return adminApi.verifyPanAdvance({ pan });
};

export const fetchBranchesDropdown = async (): Promise<any> => {
  return request<any>("/branches/dropdown", { method: "GET" });
};

export const fetchDsasDropdown = async (): Promise<any> => {
  return request<any>("/dsas/dropdown", { method: "GET" });
};




