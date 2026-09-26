import { request } from './client';

export interface LeadFacility {
  id?: number;
  facility_type: string;
  sanctioned_amount: number;
  disbursed_amount: number;
  loan_account_no?: string;
  disbursement_date?: string;
  has_deviation?: boolean;
  deviation_type?: string;
  status?: string;
}

export interface LeadQuery {
  id: number;
  lead_id: number;
  query_type: string;
  query_text: string;
  response_text?: string;
  status: 'OPEN' | 'RESPONDED' | 'RESOLVED';
  raised_by?: any;
  responded_by?: any;
  created_at: string;
}

export interface LeadStatusHistory {
  id: number;
  old_status?: string;
  new_status: string;
  action_by_type: string;
  remarks?: string;
  created_at: string;
}

export interface LeadData {
  id?: number;
  lead_uuid?: string;
  application_id?: string;
  CustName?: string;
  constitution: string;
  mobile: string;
  email?: string;
  pincode?: string;
  city?: string;
  state?: string;
  Branch_id?: string;
  subregion_id?: string;
  DSACode?: string;
  dsa_code?: string;
  dsa?: any;
  application_link?: string;
  branch?: any;
  subRegion?: any;
  title?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender?: string;
  dob?: string;
  age?: number;
  address?: string;
  employment_type?: string;
  occupation_type?: string;
  employer_business_name?: string;
  avg_gross_monthly_income?: number;
  avg_net_monthly_income?: number;
  pan_no?: string;
  entity_name?: string;
  doi?: string;
  business_address?: string;
  proprietor_partner_director_name?: string;
  avg_annual_gross_income?: number;
  avg_annual_net_income?: number;
  annual_gross_turnover_last_fy?: number;
  existing_monthly_repayment_obligation?: number;
  loan_product_id: number;
  loan_type_id?: number;
  loan_scheme_id?: number;
  loan_purpose?: string;
  loan_amount_required: number;
  loan_period_months: number;
  status?: string;
  created_by_type?: string;
  sanction_amount?: number;
  sanction_letter_no?: string;
  sanction_date?: string;
  disbursed_amount?: number;
  disbursement_date?: string;
  rejection_reason?: string;
  product?: any;
  loan_type?: any;
  loanType?: any;
  facilities?: LeadFacility[];
  queries?: LeadQuery[];
  status_histories?: LeadStatusHistory[];
  created_at?: string;
}

// Helper to convert query params to URL query string
const toQueryString = (params?: Record<string, any>) => {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

// ── Authenticated APIs ────────────────────────────────────────────────────────

export const fetchLeads = async (params?: Record<string, any>): Promise<any> => {
  return request(`/leads${toQueryString(params)}`, { method: 'GET' });
};

export const fetchLeadById = async (id: string | number): Promise<any> => {
  return request(`/leads/${id}`, { method: 'GET' });
};

export const createLead = async (leadData: LeadData): Promise<any> => {
  return request('/leads', { method: 'POST', body: JSON.stringify(leadData) });
};

export const updateLead = async (id: string | number, leadData: Partial<LeadData>): Promise<any> => {
  return request(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(leadData) });
};

export const generateShareableToken = async (): Promise<any> => {
  return request('/leads/public/generate-token', { method: 'POST' });
};

export const fetchMakerQueue = async (params?: Record<string, any>): Promise<any> => {
  return request(`/leads/maker-queue${toQueryString(params)}`, { method: 'GET' });
};

export const forwardToChecker = async (id: string | number, remarks?: string): Promise<any> => {
  return request(`/leads/${id}/forward-to-checker`, { method: 'POST', body: JSON.stringify({ remarks }) });
};

export const raiseLeadQuery = async (id: string | number, queryData: { query_text: string; query_type?: string }): Promise<any> => {
  return request(`/leads/${id}/raise-query`, { method: 'POST', body: JSON.stringify(queryData) });
};

export const fetchLeadQueries = async (id: string | number): Promise<any> => {
  return request(`/leads/${id}/queries`, { method: 'GET' });
};

export const respondLeadQuery = async (queryId: number, responseText: string): Promise<any> => {
  return request(`/leads/queries/${queryId}/respond`, { method: 'POST', body: JSON.stringify({ response_text: responseText }) });
};

export const sanctionLead = async (id: string | number, sanctionData: { sanction_amount: number; sanction_letter_no?: string; sanction_date?: string; remarks?: string }): Promise<any> => {
  return request(`/leads/${id}/sanction`, { method: 'POST', body: JSON.stringify(sanctionData) });
};

export const rejectLead = async (id: string | number, rejection_reason: string): Promise<any> => {
  return request(`/leads/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejection_reason }) });
};

export const disburseLead = async (id: string | number, disbursementData: {
  disbursed_amount?: number;
  disbursement_date?: string;
  loan_account_no?: string | null;
  has_deviation?: boolean;
  deviation_type?: string | null;
  facilities?: LeadFacility[];
  remarks?: string;
}): Promise<any> => {
  return request(`/leads/${id}/disburse`, { method: 'POST', body: JSON.stringify(disbursementData) });
};

export const cancelLead = async (id: string | number, cancellation_reason: string): Promise<any> => {
  return request(`/leads/${id}/cancel`, { method: 'POST', body: JSON.stringify({ cancellation_reason }) });
};

export const updateLeadStatus = async (id: string | number, statusData: { status: string; remarks?: string }): Promise<any> => {
  return request(`/leads/${id}/update-status`, { method: 'POST', body: JSON.stringify(statusData) });
};

export const fetchLeadReports = async (params?: Record<string, any>): Promise<any> => {
  return request(`/leads/reports/summary${toQueryString(params)}`, { method: 'GET' });
};

// ── Public Unauthenticated APIs ────────────────────────────────────────────────

export const fetchPublicTokenInfo = async (token: string): Promise<any> => {
  return request(`/public/lead/token/${token}`, { method: 'GET' });
};

export const submitCustomerLeadPublic = async (token: string, leadData: LeadData): Promise<any> => {
  return request(`/public/lead/submit/${token}`, { method: 'POST', body: JSON.stringify(leadData) });
};

export const sendLeadOtp = async (mobile: string): Promise<any> => {
  return request('/v1/lead/send-otp', { method: 'POST', body: JSON.stringify({ mobile }) });
};

export const verifyLeadOtp = async (referenceId: string, otp: string): Promise<any> => {
  return request('/v1/lead/verify-otp', { method: 'POST', body: JSON.stringify({ reference_id: referenceId, otp }) });
};


