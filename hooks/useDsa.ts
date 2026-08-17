import { useCallback, useState } from "react";
import { adminApi } from "@/apis/admin";
import type {
  Dsa,
  DsaDocument,
  StateOption,
  DistrictOption,
  BranchOption,
  SubRegionOption,
  RegionOption,
} from "@/types/dsa";
import { useToast } from "@/components/ui/toast";

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: unknown; message?: unknown } }).data;
    const details = Array.isArray(data?.error) ? data.error.map(String).join(" ") : String(data?.error ?? "");
    if (details.includes("Table 'cosmos_dsa.dsas' doesn't exist") || details.includes("Base table or view not found")) {
      return "DSA list API is unavailable because the backend database table `dsas` is missing. Run the backend migrations and seed data before retrying.";
    }
    if (typeof data?.message === "string") return data.message;
  }
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export function useDsa() {
  const [dsas, setDsas] = useState<Dsa[]>([]);
  const [currentDsa, setCurrentDsa] = useState<Dsa | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [dsaListError, setDsaListError] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    count: 0,
    perPage: 20,
    currentPage: 1,
    totalPages: 1,
  });

  // Dropdowns state
  const [states, setStates] = useState<StateOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegionOption[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);

  const { toast } = useToast();

  const fetchDsas = useCallback(
    async (params?: {
      search?: string;
      onboarding_status?: string;
      operational_status?: string;
      tier?: string;
      city?: string;
      state?: string;
      business_type?: string;
      per_page?: number;
      page?: number;
      sort_by?: string;
      sort_order?: string;
    }) => {
      setListLoading(true);
      try {
        const response = await adminApi.getDsas(params);
        setDsaListError("");
        setDsas(response.data.items);
        setPagination({
          total: response.data.pagination.total,
          count: response.data.pagination.count,
          perPage: response.data.pagination.per_page,
          currentPage: response.data.pagination.current_page,
          totalPages: response.data.pagination.total_pages,
        });
        return response.data.items;
      } catch (error: unknown) {
        const message = errorMessage(error, "Failed to load DSA list.");
        setDsaListError(message);
        setDsas([]);
        setPagination({
          total: 0,
          count: 0,
          perPage: params?.per_page ?? 20,
          currentPage: params?.page ?? 1,
          totalPages: 1,
        });
        toast({
          title: "Error listing partners",
          description: message,
          variant: "warning",
        });
        return [];
      } finally {
        setListLoading(false);
      }
    },
    [toast]
  );

  const fetchDsaDetail = useCallback(
    async (idOrCode: number | string) => {
      setLoading(true);
      try {
        const response = await adminApi.getDsaDetail(idOrCode);
        setCurrentDsa(response.data);
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Error loading partner details",
          description: errorMessage(error, "Failed to fetch DSA profile details."),
          variant: "warning",
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const createDsa = useCallback(
    async (payload: Partial<Dsa>) => {
      setActionLoading(true);
      try {
        const response = await adminApi.createDsa(payload);
        toast({
          title: "Onboarding initiated",
          description: "DSA partner onboarding request registered successfully.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Registration failed",
          description: errorMessage(error, "Failed to submit DSA onboarding request."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  const updateDsaProfile = useCallback(
    async (idOrCode: number | string, payload: Partial<Dsa> & { action?: string; remarks?: string }) => {
      setActionLoading(true);
      try {
        const response = await adminApi.updateDsaProfile(idOrCode, payload);
        setCurrentDsa(response.data);
        toast({
          title: "Profile updated",
          description: "DSA profile updated successfully.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Profile update failed",
          description: errorMessage(error, "Failed to save profile changes."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  const updateDsaStatus = useCallback(
    async (
      idOrCode: number | string,
      payload: { onboarding_status?: string; operational_status?: string; reason: string }
    ) => {
      setActionLoading(true);
      try {
        const response = await adminApi.updateDsaStatus(idOrCode, payload);
        setCurrentDsa(response.data);
        toast({
          title: "Status updated",
          description: "DSA lifecycle status has been updated.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Status update failed",
          description: errorMessage(error, "Failed to change lifecycle status."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  const generateAgreement = useCallback(
    async (idOrCode: number | string) => {
      setActionLoading(true);
      try {
        const response = await adminApi.generateDsaAgreement(idOrCode);
        toast({
          title: "Agreement generated",
          description: "DSA Master Service Agreement PDF created.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Agreement generation failed",
          description: errorMessage(error, "Failed to generate PDF agreement."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  const downloadAgreement = useCallback(
    async (idOrCode: number | string) => {
      try {
        const response = await adminApi.downloadDsaAgreement(idOrCode);
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Download failed",
          description: errorMessage(error, "Could not fetch agreement details."),
          variant: "warning",
        });
        return null;
      }
    },
    [toast]
  );

  const uploadSignedAgreement = useCallback(
    async (idOrCode: number | string, file: File) => {
      setActionLoading(true);
      try {
        const response = await adminApi.uploadSignedAgreement(idOrCode, file);
        toast({
          title: "Agreement uploaded",
          description: "Signed agreement successfully uploaded. DSA activated.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Upload failed",
          description: errorMessage(error, "Failed to upload signed agreement file."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  const uploadDsaDocument = useCallback(
    async (idOrCode: number | string, payload: { file: File; document_type: string; owner_name?: string }) => {
      setActionLoading(true);
      try {
        const response = await adminApi.uploadDsaDocument(idOrCode, payload);
        toast({
          title: "Document uploaded",
          description: "File uploaded successfully.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Upload failed",
          description: errorMessage(error, "Failed to upload document file."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  const updateDsaDocumentStatus = useCallback(
    async (idOrCode: number | string, payload: { document_id: number; status: string; remarks?: string }) => {
      setActionLoading(true);
      try {
        const response = await adminApi.updateDsaDocumentStatus(idOrCode, payload);
        toast({
          title: "Document verified",
          description: "Document verification status updated.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Verification failed",
          description: errorMessage(error, "Failed to update verification status."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  const deleteDsaDocument = useCallback(
    async (idOrCode: number | string, payload: { document_id: number }) => {
      setActionLoading(true);
      try {
        const response = await adminApi.deleteDsaDocument(idOrCode, payload);
        toast({
          title: "Document deleted",
          description: "Document removed successfully.",
          variant: "success",
        });
        return response.data;
      } catch (error: unknown) {
        toast({
          title: "Deletion failed",
          description: errorMessage(error, "Failed to remove document record."),
          variant: "warning",
        });
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [toast]
  );

  // ── Location Dropdowns ───────────────────────────────────────────────────

  const fetchStatesDropdown = useCallback(async () => {
    try {
      const response = await adminApi.getStatesDropdown();
      setStates(response.data);
      return response.data;
    } catch {
      return [];
    }
  }, []);

  const fetchDistrictsDropdown = useCallback(async (stateCode: string) => {
    try {
      const response = await adminApi.getDistrictsDropdown(stateCode);
      setDistricts(response.data);
      return response.data;
    } catch {
      return [];
    }
  }, []);

  const fetchBranchesDropdown = useCallback(async (districtCode: string) => {
    try {
      const response = await adminApi.getBranchesDropdown(districtCode);
      setBranches(response.data);
      return response.data;
    } catch {
      return [];
    }
  }, []);

  const fetchSubRegionsDropdown = useCallback(async () => {
    try {
      const response = await adminApi.getSubRegionsDropdown();
      setSubRegions(response.data);
      return response.data;
    } catch {
      return [];
    }
  }, []);

  const fetchRegionsDropdown = useCallback(async () => {
    try {
      const response = await adminApi.getRegionsDropdown();
      setRegions(response.data);
      return response.data;
    } catch {
      return [];
    }
  }, []);

  return {
    dsas,
    currentDsa,
    loading,
    listLoading,
    actionLoading,
    dsaListError,
    pagination,
    states,
    districts,
    branches,
    subRegions,
    regions,
    fetchDsas,
    fetchDsaDetail,
    createDsa,
    updateDsaProfile,
    updateDsaStatus,
    generateAgreement,
    downloadAgreement,
    uploadSignedAgreement,
    uploadDsaDocument,
    updateDsaDocumentStatus,
    deleteDsaDocument,
    fetchStatesDropdown,
    fetchDistrictsDropdown,
    fetchBranchesDropdown,
    fetchSubRegionsDropdown,
    fetchRegionsDropdown,
    setCurrentDsa,
    setDistricts,
    setBranches,
  };
}
