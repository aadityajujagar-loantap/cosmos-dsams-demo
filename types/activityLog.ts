export interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  group: string;
  model_class: string | null;
  record_id: number | null;
  route_name: string | null;
  request_method: string;
  request_url: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string;
  user_agent: string | null;
  status_code: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  } | null;
}
