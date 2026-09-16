import { request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { AuthSession, RolesPermissionsData, User } from "@/types/auth";

export interface CaptchaData {
  captcha_key: string;
  captcha_img: string; // Base64 image data
}

export interface LoginResponse {
  reference_id: string;
  mobile_hint: string;
}

export const authApi = {
  /**
   * Fetch a fresh CAPTCHA key and image
   */
  getCaptcha: (): Promise<ApiResponse<CaptchaData>> => {
    return request<ApiResponse<CaptchaData>>("/auth/captcha", {
      method: "GET",
      cache: "no-store",
    });
  },

  /**
   * Submit username, password, and CAPTCHA code to send OTP
   */
  login: (payload: {
    userName: string;
    password: string;
    captcha_key: string;
    captcha_value: string;
  }): Promise<ApiResponse<LoginResponse>> => {
    return request<ApiResponse<LoginResponse>>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Verify the OTP sent in the login step
   */
  verifyOtp: (payload: {
    reference_id: string;
    otp: string;
  }): Promise<ApiResponse<AuthSession>> => {
    return request<ApiResponse<AuthSession>>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Logout and revoke token on the backend
   */
  logout: (): Promise<{ message: string }> => {
    return request<{ message: string }>("/logout", {
      method: "POST",
    });
  },

  /**
   * DSA partner portal login (Task 14).
   * POST /api/auth/dsa-login
   * Checks operational_status === 'ACTIVE'; returns 403 if DSA is not yet activated.
   */
  dsaLogin: (payload: {
    email: string;
    password: string;
  }): Promise<{
    token: string;
    user: {
      id: number;
      name: string;
      email: string;
      phone?: string;
      ticket_no?: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
  }> => {
    return request<any>("/auth/dsa-login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch the authenticated backend user backing the current token
   */
  getCurrentUser: (): Promise<User> => {
    return request<User>("/user", {
      method: "GET",
      cache: "no-store",
    });
  },

  /**
   * Fetch the authenticated user's backend roles and permissions
   */
  getRolesPermissions: (): Promise<ApiResponse<RolesPermissionsData>> => {
    return request<ApiResponse<RolesPermissionsData>>("/user/roles-permissions", {
      method: "GET",
      cache: "no-store",
    });
  },
};
