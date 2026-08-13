import { useCallback, useState } from "react";
import { adminApi, type MakerRequestListParams } from "@/apis/admin";
import type { MakerRequest } from "@/types/makerChecker";
import { useToast } from "@/components/ui/toast";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export function useMakerChecker() {
  const [requests, setRequests] = useState<MakerRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MakerRequest | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    total: number;
    lastPage: number;
  }>({ page: 1, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast } = useToast();

  const fetchRequests = useCallback(
    async (params?: MakerRequestListParams) => {
      setLoading(true);
      try {
        const response = await adminApi.getMakerRequests(params);
        setRequests(response.data);
        setPagination({
          page: response.current_page,
          total: response.total,
          lastPage: response.last_page,
        });
      } catch (error: unknown) {
        toast({
          title: "Error fetching requests",
          description: errorMessage(error, "Failed to query maker-checker requests."),
          variant: "warning",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const fetchRequestDetail = useCallback(
    async (uuid: string) => {
      setDetailLoading(true);
      try {
        const response = await adminApi.getMakerRequestDetail(uuid);
        setSelectedRequest(response);
        return response;
      } catch (error: unknown) {
        toast({
          title: "Request detail failed",
          description: errorMessage(error, "Could not load maker request detail."),
          variant: "warning",
        });
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  const approveRequest = useCallback(
    async (uuid: string) => {
      try {
        const response = await adminApi.approveRequest(uuid);
        setSelectedRequest(response.maker_request);
        toast({
          title: "Request Approved",
          description: response.message || "The change has been successfully applied.",
          variant: "success",
        });
        return response.maker_request;
      } catch (error: unknown) {
        toast({
          title: "Approval Failed",
          description: errorMessage(error, "Could not approve the request."),
          variant: "warning",
        });
        return null;
      }
    },
    [toast],
  );

  const rejectRequest = useCallback(
    async (uuid: string, reason: string) => {
      try {
        const response = await adminApi.rejectRequest(uuid, reason);
        setSelectedRequest(response.maker_request);
        toast({
          title: "Request Rejected",
          description: response.message || "The change request was rejected.",
          variant: "warning",
        });
        return response.maker_request;
      } catch (error: unknown) {
        toast({
          title: "Rejection Failed",
          description: errorMessage(error, "Could not reject the request."),
          variant: "warning",
        });
        return null;
      }
    },
    [toast],
  );

  return {
    requests,
    selectedRequest,
    pagination,
    loading,
    detailLoading,
    fetchRequests,
    fetchRequestDetail,
    setSelectedRequest,
    approveRequest,
    rejectRequest,
  };
}
