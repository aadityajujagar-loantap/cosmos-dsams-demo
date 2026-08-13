export type MakerRequestStatus = "pending" | "approved" | "rejected";
export type MakerRequestActionType = "add" | "update" | "delete";
export type MakerRequestPayload = Record<string, unknown>;

export interface MakerRequest {
  id: number;
  uuid: string;
  group: string;
  action_type: MakerRequestActionType;
  model_class: string;
  record_id: number | null;
  request_data: MakerRequestPayload;
  original_data: MakerRequestPayload | null;
  requested_by: number;
  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  status: MakerRequestStatus;
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
