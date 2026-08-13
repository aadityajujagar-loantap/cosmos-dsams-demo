import { request } from "./client";
import type { MakerRequest, MakerRequestActionType, MakerRequestStatus } from "@/types/makerChecker";
import type { Permission, Role, User } from "@/types/auth";

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
};
