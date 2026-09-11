import { authService } from "@/services/authService";
import { withBasePath } from "@/lib/base-path";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface RequestError extends Error {
  status?: number;
  data?: unknown;
}

let isHandlingUnauthorized = false;

export function handleUnauthorizedSession(): void {
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;

  authService.endSession();

  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("cosmos_dsa_user");
      sessionStorage.setItem("auth_expired_notice", "Your session has expired. Please log in again.");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    } catch {
      // Ignore storage errors in restricted environments
    }

    const currentPath = window.location.pathname;
    const isLoginPath = currentPath.endsWith("/login") || currentPath.includes("/login");
    if (!isLoginPath) {
      window.location.replace(withBasePath("/login"));
    } else {
      window.setTimeout(() => {
        isHandlingUnauthorized = false;
      }, 1000);
    }
  }
}

export async function request<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    "Accept": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ? (options.headers as Record<string, string>) : {}),
  };

  if (headers["Content-Type"] === "") {
    delete headers["Content-Type"];
  }

  const response = await fetch(`${BASE_URL}/${endpoint.replace(/^\//, "")}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: Record<string, unknown> = {};
    try {
      errorData = (await response.json()) as Record<string, unknown>;
    } catch {
      errorData = { error: response.statusText };
    }

    const dataField = errorData.data && typeof errorData.data === "object" ? (errorData.data as Record<string, unknown>) : null;
    const errorsField = (dataField?.errors || errorData.errors) as Record<string, unknown> | null;
    const errorsMsg = errorsField && typeof errorsField === "object" ? Object.values(errorsField).flat().join(" ") : null;

    const serverMsg =
      (typeof errorData.message === "string" ? errorData.message : null) ||
      (typeof dataField?.message === "string" ? dataField.message : null) ||
      errorsMsg ||
      (typeof errorData.error === "string" ? errorData.error : null) ||
      `HTTP error ${response.status}`;

    const normalizedEndpoint = endpoint.replace(/^\//, "");
    const isAuthAttemptOrLogout =
      normalizedEndpoint.startsWith("auth/login") ||
      normalizedEndpoint.startsWith("auth/verify-otp") ||
      normalizedEndpoint.startsWith("auth/captcha") ||
      normalizedEndpoint === "logout";

    if (response.status === 401 && !isAuthAttemptOrLogout) {
      handleUnauthorizedSession();
    }

    const error = new Error(serverMsg) as RequestError;
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  return response.json() as Promise<T>;
}

export async function rawRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const rootUrl = BASE_URL.replace(/\/api$/, "");
  const response = await fetch(`${rootUrl}/${endpoint.replace(/^\//, "")}`, options);
  return response;
}
