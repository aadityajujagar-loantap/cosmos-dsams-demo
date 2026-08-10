import { useCallback, useState } from "react";
import { adminApi } from "@/apis/admin";
import type { MakerRequest } from "@/types/makerChecker";
import { useToast } from "@/components/ui/toast";

export function useMakerChecker() {
  const [requests, setRequests] = useState<MakerRequest[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    total: number;
    lastPage: number;
  }>({ page: 1, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRequests = useCallback(
    async (params?: {
      status?: "pending" | "approved" | "rejected";
      group?: string;
      page?: number;
    }) => {
      setLoading(true);
      try {
        const response = await adminApi.getMakerRequests(params);
        setRequests(response.data);
        setPagination({
          page: response.current_page,
          total: response.total,
          lastPage: response.last_page,
        });
      } catch (error: any) {
        toast({
          title: "Error fetching requests",
          description: error.message || "Failed to query pending requests.",
          variant: "warning",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const approveRequest = useCallback(
    async (uuid: string) => {
      try {
        const response = await adminApi.approveRequest(uuid);
        toast({
          title: "Request Approved",
          description: response.message || "The change has been successfully applied.",
          variant: "success",
        });
        // Refresh list
        fetchRequests({ status: "pending" });
        return true;
      } catch (error: any) {
        toast({
          title: "Approval Failed",
          description: error.message || "Could not approve the request.",
          variant: "warning",
        });
        return false;
      }
    },
    [fetchRequests, toast]
  );

  const rejectRequest = useCallback(
    async (uuid: string, reason?: string) => {
      try {
        const response = await adminApi.rejectRequest(uuid, reason);
        toast({
          title: "Request Rejected",
          description: response.message || "The change request was rejected.",
          variant: "warning",
        });
        // Refresh list
        fetchRequests({ status: "pending" });
        return true;
      } catch (error: any) {
        toast({
          title: "Rejection Failed",
          description: error.message || "Could not reject the request.",
          variant: "warning",
        });
        return false;
      }
    },
    [fetchRequests, toast]
  );

  return {
    requests,
    pagination,
    loading,
    fetchRequests,
    approveRequest,
    rejectRequest,
  };
}
