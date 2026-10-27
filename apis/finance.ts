import { request } from "@/apis/client";
import type {
  ApiResponse,
  BranchOption,
  CbsDisbursementEvent,
  CbsSyncResult,
  CommissionPeriod,
  CommissionPreview,
  DsaInvoice,
  EligibleDisbursementsData,
  FinalizedCommission,
  PaginatedResponse,
} from "@/types/finance";

export const financeApi = {
  // ── Commission Periods ──────────────────────────────────────────────────────────
  async getCommissionPeriods(params?: {
    status?: string;
    search?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse<PaginatedResponse<CommissionPeriod>>> {
    const qs = new URLSearchParams();
    if (params?.status) qs.append("status", params.status);
    if (params?.search) qs.append("search", params.search);
    if (params?.per_page) qs.append("per_page", String(params.per_page));
    if (params?.page) qs.append("page", String(params.page));
    const endpoint = `v1/commission-periods-list${qs.toString() ? `?${qs.toString()}` : ""}`;
    return request<ApiResponse<PaginatedResponse<CommissionPeriod>>>(endpoint);
  },

  async createCommissionPeriod(data: {
    period_name: string;
    start_date: string;
    end_date: string;
  }): Promise<ApiResponse<CommissionPeriod>> {
    return request<ApiResponse<CommissionPeriod>>("v1/commission-periods-create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getCommissionPeriodDetails(id: number): Promise<ApiResponse<CommissionPeriod>> {
    return request<ApiResponse<CommissionPeriod>>(`v1/commission-periods-details/${id}`);
  },

  async completeCommissionPeriod(id: number): Promise<ApiResponse<CommissionPeriod>> {
    return request<ApiResponse<CommissionPeriod>>(`v1/commission-periods-complete/${id}`, {
      method: "POST",
    });
  },

  async getCommissionPeriodBranches(id: number): Promise<ApiResponse<BranchOption[]>> {
    return request<ApiResponse<BranchOption[]>>(`v1/commission-periods-branches/${id}`);
  },

  async getEligibleDisbursements(
    periodId: number,
    branchId: string,
  ): Promise<ApiResponse<EligibleDisbursementsData>> {
    return request<ApiResponse<EligibleDisbursementsData>>(
      `v1/commission-periods/${periodId}/branches/${encodeURIComponent(branchId)}/eligible-disbursements`,
    );
  },

  // ── Commission Calculation & Finalization ──────────────────────────────────────
  async computeCommissionPreview(data: {
    period_id: number;
    branch_id: string;
  }): Promise<ApiResponse<CommissionPreview>> {
    return request<ApiResponse<CommissionPreview>>("v1/commissions/compute", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async finalizeCommission(data: {
    period_id: number;
    branch_id: string;
  }): Promise<ApiResponse<FinalizedCommission>> {
    return request<ApiResponse<FinalizedCommission>>("v1/commissions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getCommissionsList(params?: {
    period_id?: number;
    branch_id?: string;
    status?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse<PaginatedResponse<FinalizedCommission>>> {
    const qs = new URLSearchParams();
    if (params?.period_id) qs.append("period_id", String(params.period_id));
    if (params?.branch_id) qs.append("branch_id", params.branch_id);
    if (params?.status) qs.append("status", params.status);
    if (params?.per_page) qs.append("per_page", String(params.per_page));
    if (params?.page) qs.append("page", String(params.page));
    const endpoint = `v1/commissions-list${qs.toString() ? `?${qs.toString()}` : ""}`;
    return request<ApiResponse<PaginatedResponse<FinalizedCommission>>>(endpoint);
  },

  async getCommissionDetails(id: number): Promise<ApiResponse<FinalizedCommission>> {
    return request<ApiResponse<FinalizedCommission>>(`v1/commissions-details/${id}`);
  },

  // ── DSA Invoices ───────────────────────────────────────────────────────────────
  async generateDsaInvoices(data: {
    period_id: number;
    commission_id?: number;
  }): Promise<ApiResponse<{ count: number; invoices: DsaInvoice[] }>> {
    return request<ApiResponse<{ count: number; invoices: DsaInvoice[] }>>("v1/generate-dsa-invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getDsaInvoicesList(params?: {
    status?: string;
    dsa_code?: string;
    branch_code?: string;
    period_id?: number;
    from_date?: string;
    to_date?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse<PaginatedResponse<DsaInvoice>>> {
    const qs = new URLSearchParams();
    if (params?.status) qs.append("status", params.status);
    if (params?.dsa_code) qs.append("dsa_code", params.dsa_code);
    if (params?.branch_code) qs.append("branch_code", params.branch_code);
    if (params?.period_id) qs.append("period_id", String(params.period_id));
    if (params?.from_date) qs.append("from_date", params.from_date);
    if (params?.to_date) qs.append("to_date", params.to_date);
    if (params?.per_page) qs.append("per_page", String(params.per_page));
    if (params?.page) qs.append("page", String(params.page));
    const endpoint = `v1/dsa-invoices-list${qs.toString() ? `?${qs.toString()}` : ""}`;
    return request<ApiResponse<PaginatedResponse<DsaInvoice>>>(endpoint);
  },

  async getDsaInvoiceDetails(id: number | string): Promise<ApiResponse<DsaInvoice>> {
    return request<ApiResponse<DsaInvoice>>(`v1/dsa-invoices-details/${encodeURIComponent(String(id))}`);
  },

  async updateDsaInvoiceStatus(
    id: number | string,
    data: {
      status: "SUBMITTED" | "RECOMMENDED" | "APPROVED" | "REJECTED" | "PAID";
      remarks?: string;
      payment_reference?: string;
      payment_mode?: string;
    },
  ): Promise<ApiResponse<DsaInvoice>> {
    return request<ApiResponse<DsaInvoice>>(
      `v1/dsa-invoices/${encodeURIComponent(String(id))}/update-status`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  async addDsaInvoiceEvent(
    id: number | string,
    data: { action: string; remarks: string },
  ): Promise<ApiResponse<{ id: number; action: string; remarks: string }>> {
    return request<ApiResponse<{ id: number; action: string; remarks: string }>>(
      `v1/dsa-invoices/${encodeURIComponent(String(id))}/events`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  // ── CBS Reconciliation ─────────────────────────────────────────────────────────
  async syncCbsDisbursements(data?: {
    from_date?: string;
    to_date?: string;
    branch_code?: string;
    loan_account_no?: string;
    dsa_code?: string;
  }): Promise<ApiResponse<CbsSyncResult>> {
    return request<ApiResponse<CbsSyncResult>>("v1/cbs/sync-disbursements", {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  },

  async getCbsDisbursementEvents(params?: {
    sync_status?: string;
    branch_code?: string;
    dsa_code?: string;
    per_page?: number;
    page?: number;
  }): Promise<ApiResponse<PaginatedResponse<CbsDisbursementEvent>>> {
    const qs = new URLSearchParams();
    if (params?.sync_status) qs.append("sync_status", params.sync_status);
    if (params?.branch_code) qs.append("branch_code", params.branch_code);
    if (params?.dsa_code) qs.append("dsa_code", params.dsa_code);
    if (params?.per_page) qs.append("per_page", String(params.per_page));
    if (params?.page) qs.append("page", String(params.page));
    const endpoint = `v1/cbs/disbursement-events${qs.toString() ? `?${qs.toString()}` : ""}`;
    return request<ApiResponse<PaginatedResponse<CbsDisbursementEvent>>>(endpoint);
  },
};
