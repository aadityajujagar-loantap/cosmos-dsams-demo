import { authService } from "@/services/authService";
import { withBasePath } from "@/lib/base-path";
import {
  encryptPayload,
  decryptPayload,
  isEncryptionEnabled,
} from "@/lib/payload-crypto";

export const getBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined" && window.location.hostname) {
    const host = window.location.hostname;
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && !isLocalhost) {
          parsed.hostname = host;
          return parsed.toString().replace(/\/$/, "");
        }
      } catch {}
      return envUrl.replace(/\/$/, "");
    }
    return `${window.location.protocol}//${host}:8000/api`;
  }
  return envUrl ? envUrl.replace(/\/$/, "") : "http://localhost:8000/api";
};

export const BASE_URL = getBaseUrl();

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

  if (isEncryptionEnabled()) {
    headers["X-Payload-Encrypted"] = "true";
  }

  let finalBody = options.body;
  if (
    isEncryptionEnabled() &&
    !isFormData &&
    typeof options.body === "string" &&
    options.body.length > 0
  ) {
    try {
      const parsed = JSON.parse(options.body);
      const encryptedEnvelope = await encryptPayload(parsed);
      finalBody = JSON.stringify(encryptedEnvelope);
    } catch {
      // If not JSON or encryption fails, send raw body
    }
  }

  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/${endpoint.replace(/^\//, "")}`, {
    ...options,
    body: finalBody,
    headers,
  });

  if (!response.ok) {
    let errorData: Record<string, unknown> = {};
    try {
      const rawJson = (await response.json()) as Record<string, unknown>;
      if (
        isEncryptionEnabled() &&
        rawJson &&
        typeof rawJson.payload === "string" &&
        typeof rawJson.iv === "string" &&
        typeof rawJson.tag === "string"
      ) {
        errorData = await decryptPayload<Record<string, unknown>>(rawJson as any);
      } else {
        errorData = rawJson;
      }
    } catch {
      errorData = { error: response.statusText };
    }

    const dataField = errorData.data && typeof errorData.data === "object" ? (errorData.data as Record<string, unknown>) : null;
    const errorsField = (
      dataField?.errors ||
      errorData.errors ||
      (errorData.error && typeof errorData.error === "object" ? errorData.error : null)
    ) as Record<string, unknown> | null;
    const errorsMsg =
      errorsField && typeof errorsField === "object"
        ? Object.values(errorsField)
            .flat()
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .join(" ")
        : null;

    const rawMsg =
      (typeof errorData.message === "string" ? errorData.message : null) ||
      (typeof dataField?.message === "string" ? dataField.message : null);
    const isGenericValidationMsg =
      !rawMsg ||
      rawMsg === "The given data was invalid." ||
      rawMsg === "Validation failed.";

    const serverMsg =
      (isGenericValidationMsg && errorsMsg ? errorsMsg : rawMsg) ||
      errorsMsg ||
      (typeof errorData.error === "string" ? errorData.error : null) ||
      `HTTP error ${response.status}`;

    const normalizedEndpoint = endpoint.replace(/^\//, "");
    const isAuthAttemptOrLogout =
      normalizedEndpoint.startsWith("auth/login") ||
      normalizedEndpoint.startsWith("auth/verify-otp") ||
      normalizedEndpoint.startsWith("auth/captcha") ||
      normalizedEndpoint === "logout";

    const isLoanJourneyEndpoint = normalizedEndpoint.startsWith("v1/loan/");
    const isSanctumUnauthenticated =
      serverMsg === "Unauthenticated." ||
      serverMsg.toLowerCase().includes("unauthenticated") ||
      errorData.message === "Unauthenticated." ||
      errorData.error === "Please provide a valid authentication token.";

    if (
      response.status === 401 &&
      Boolean(token) &&
      !isAuthAttemptOrLogout &&
      !isLoanJourneyEndpoint &&
      isSanctumUnauthenticated
    ) {
      handleUnauthorizedSession();
    }

    const error = new Error(serverMsg) as RequestError;
    error.status = response.status;
    error.data = errorData;
    throw error;
  }

  const rawResult = await response.json();
  if (
    isEncryptionEnabled() &&
    rawResult &&
    typeof rawResult.payload === "string" &&
    typeof rawResult.iv === "string" &&
    typeof rawResult.tag === "string"
  ) {
    return (await decryptPayload<T>(rawResult as any)) as T;
  }

  return rawResult as T;
}

export async function requestBlob(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ blob: Blob; fileName?: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const baseUrl = getBaseUrl();

  const headers: Record<string, string> = {
    "Accept": "application/pdf, application/octet-stream, */*",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ? (options.headers as Record<string, string>) : {}),
  };

  const response = await fetch(`${baseUrl}/${endpoint.replace(/^\//, "")}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP error ${response.status}`;
    try {
      let errJson = await response.json();
      if (
        isEncryptionEnabled() &&
        errJson &&
        typeof errJson.payload === "string" &&
        typeof errJson.iv === "string" &&
        typeof errJson.tag === "string"
      ) {
        errJson = await decryptPayload<Record<string, unknown>>(errJson);
      }
      errorMsg = errJson.message || errJson.error || errorMsg;
    } catch {}
    const error = new Error(errorMsg) as RequestError;
    error.status = response.status;
    throw error;
  }

  let fileName: string | undefined;
  const disposition = response.headers.get("Content-Disposition");
  if (disposition) {
    const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
    if (filenameMatch?.[1]) {
      fileName = filenameMatch[1].replace(/['"]/g, "").trim();
    }
  }

  const blob = await response.blob();
  return { blob, fileName };
}

export async function rawRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const rootUrl = getBaseUrl().replace(/\/api$/, "");
  const response = await fetch(`${rootUrl}/${endpoint.replace(/^\//, "")}`, options);
  return response;
}
