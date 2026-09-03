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
        const raw = response as any;
        const paginated = (raw && typeof raw === "object" && "data" in raw && !Array.isArray(raw.data) && typeof raw.data === "object")
          ? raw.data
          : raw;

        const items: ActivityLog[] = Array.isArray(paginated?.data)
          ? paginated.data
          : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []));

        const currentPage = Number(paginated?.current_page ?? raw?.current_page ?? params?.page ?? 1);
        const total = Number(paginated?.total ?? raw?.total ?? items.length);
        const lastPage = Number(paginated?.last_page ?? raw?.last_page ?? (total ? Math.ceil(total / (params?.per_page || 10)) : 1));

        setLogs(items);
        setPagination({
          page: currentPage,
          total: total,
          lastPage: Math.max(1, lastPage),
        });
      } catch (error: unknown) {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    []
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
