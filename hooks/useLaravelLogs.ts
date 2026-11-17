import { useCallback, useState } from "react";
import { adminApi } from "@/apis/admin";
import type { LaravelLogEntry } from "@/types/activityLog";
import { useToast } from "@/components/ui/toast";

export function useLaravelLogs() {
  const [logs, setLogs] = useState<LaravelLogEntry[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<LaravelLogEntry | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    total: number;
    lastPage: number;
  }>({ page: 1, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchLaravelLogs = useCallback(
    async (params?: {
      date?: string;
      date_from?: string;
      date_to?: string;
      level?: string;
      search?: string;
      page?: number;
      per_page?: number;
    }) => {
      setLoading(true);
      try {
        const response = await adminApi.getLaravelLogs(params);
        setLogs(response.data || []);
        setPagination({
          page: response.current_page || 1,
          total: response.total || 0,
          lastPage: response.last_page || 1,
        });
        if (response.available_dates && response.available_dates.length > 0) {
          setAvailableDates(response.available_dates);
        }
        if (response.levels && response.levels.length > 0) {
          setAvailableLevels(response.levels);
        }
      } catch {
        setLogs([]);
        toast({
          title: "Failed to load Laravel logs",
          description: "Could not retrieve system log entries.",
          variant: "warning",
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  return {
    logs,
    availableDates,
    availableLevels,
    selectedLog,
    pagination,
    loading,
    fetchLaravelLogs,
    setSelectedLog,
  };
}
