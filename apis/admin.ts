import { request } from "./client";
import type { MakerRequest } from "@/types/makerChecker";
import type { User } from "@/types/auth";

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

export const adminApi = {
  /**
   * Get list of maker requests (pending, approved, etc.)
   */
  getMakerRequests: (params?: {
    status?: "pending" | "approved" | "rejected";
    group?: string;
    action_type?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<MakerRequest>> => {
    const query = new URLSearchParams(params as any).toString();
    return request<PaginatedResponse<MakerRequest>>(
      `/admin/maker-requests?${query}`,
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
  approveRequest: (uuid: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/maker-requests/${uuid}/approve`, {
      method: "POST",
    });
  },

  /**
   * Reject a pending maker request
   */
  rejectRequest: (uuid: string, reason?: string): Promise<{ message: string }> => {
    return request<{ message: string }>(`/admin/maker-requests/${uuid}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: reason }),
    });
  },

  /**
   * Get list of users (Admin Panel)
   */
  getUsers: (): Promise<User[]> => {
    return request<User[]>("/admin/users", { method: "GET" });
  },

  /**
   * Create a new user (Maker-Checker protected)
   */
  createUser: (payload: {
    name: string;
    email: string;
    ticket_no: string;
    phone: string;
    branch_code?: string;
    zone_code?: string;
    password?: string;
  }): Promise<User | MakerCheckerActionResponse> => {
    return request<User | MakerCheckerActionResponse>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Update an existing user (Maker-Checker protected)
   */
  updateUser: (
    id: number,
    payload: Partial<{
      name: string;
      email: string;
      ticket_no: string;
      phone: string;
      branch_code?: string;
      zone_code?: string;
    }>
  ): Promise<User | MakerCheckerActionResponse> => {
    return request<User | MakerCheckerActionResponse>(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Deactivate a user (Maker-Checker protected)
   */
  deactivateUser: (id: number): Promise<User | MakerCheckerActionResponse> => {
    return request<User | MakerCheckerActionResponse>(`/admin/users/${id}/deactivate`, {
      method: "POST",
    });
  },

  /**
   * Reactivate a user (Maker-Checker protected)
   */
  reactivateUser: (id: number): Promise<User | MakerCheckerActionResponse> => {
    return request<User | MakerCheckerActionResponse>(`/admin/users/${id}/reactivate`, {
      method: "POST",
    });
  },
};
