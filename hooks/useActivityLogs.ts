import { useCallback, useState } from "react";
import { adminApi } from "@/apis/admin";
import type { ActivityLog } from "@/types/activityLog";
import { useToast } from "@/components/ui/toast";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    total: number;
    lastPage: number;
  }>({ page: 1, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const { toast } = useToast();

  const fetchLogs = useCallback(
    async (params?: {
      user_id?: number;
      action?: string;
      group?: string;
      date_from?: string;
      date_to?: string;
      page?: number;
      per_page?: number;
    }) => {
      setLoading(true);
      try {
        const response = await adminApi.getActivityLogs(params);
        setLogs(response.data);
        setPagination({
          page: response.current_page,
          total: response.total,
          lastPage: response.last_page,
        });
      } catch (error: unknown) {
        toast({
          title: "Error fetching logs",
          description: errorMessage(error, "Failed to query activity logs."),
          variant: "warning",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const fetchLogDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      try {
        const response = await adminApi.getActivityLogDetail(id);
        setSelectedLog(response);
        return response;
      } catch (error: unknown) {
        toast({
          title: "Log detail failed",
          description: errorMessage(error, "Could not load activity log detail."),
          variant: "warning",
        });
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [toast]
  );

  return {
    logs,
    selectedLog,
    pagination,
    loading,
    detailLoading,
    fetchLogs,
    fetchLogDetail,
    setSelectedLog,
  };
}
