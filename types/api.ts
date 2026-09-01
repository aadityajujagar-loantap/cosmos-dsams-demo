export interface ApiResponse<T = any> {
  status: "0" | "1"; // "0" for success, "1" for error
  message: string;
  respData: T;
}

export interface ValidationErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}

export interface HttpErrorResponse {
  error: string;
  message?: string;
  required?: string;
}
