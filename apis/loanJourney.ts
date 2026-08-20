import { request } from "./client";

export interface ProcessStepPayload {
  step_key: string;
  loan_type: string;
  payload: Record<string, any>;
}

export interface ProcessStepResponse {
  status: "success" | "error";
  data: {
    status_code: number;
    application_id?: string;
    opt_reference_id?: string; // OTP service reference ID
    current_step?: string;
    section_id?: string;
    status?: string;
    stage?: string;
    next_step?: string;
    next_section?: string;
    application_data?: string; // base64 encoded
    message?: string;
    errors?: Record<string, string>;
  };
}

export const loanJourneyApi = {
  /**
   * Process a step in the loan application journey
   */
  processStep: (payload: ProcessStepPayload): Promise<ProcessStepResponse> => {
    return request<ProcessStepResponse>("/v1/loan/process-step", {
      method: "POST",
      headers: {
        "X-Tenant-ID": "cosmos-bank",
        "X-API-Token": "ijkyWTMMuVWqDaGJFiEWQd2jogOuvO8QdkDBMWUG882HXQPvqg2StcydbAUiNH4J",
      },
      body: JSON.stringify(payload),
    });
  },
};
