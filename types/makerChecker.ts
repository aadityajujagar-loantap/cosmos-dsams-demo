export interface MakerRequest {
  id: number;
  uuid: string;
  group: string;
  action_type: "add" | "update" | "delete";
  model_class: string;
  record_id: number | null;
  request_data: Record<string, any>;
  original_data: Record<string, any> | null;
  status: "pending" | "approved" | "rejected";
  requested_by: number;
  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  requester?: {
    id: number;
    name: string;
    email: string;
  };
  reviewer?: {
    id: number;
    name: string;
    email: string;
  } | null;
}
