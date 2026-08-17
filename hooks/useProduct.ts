import { useState, useCallback } from "react";
import { adminApi } from "@/apis/admin";
import { useToast } from "@/components/ui/toast";
import type { LoanProduct, LoanScheme, SchemeParameter, SchemeSlab } from "@/types/product";

export function useProduct() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [schemes, setSchemes] = useState<LoanScheme[]>([]);
  const [currentParameter, setCurrentParameter] = useState<SchemeParameter | null>(null);
  const [slabs, setSlabs] = useState<SchemeSlab[]>([]);

  const errorMessage = (err: unknown, fallback: string) => {
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: unknown }).message);
    }
    return fallback;
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getProducts();
      setProducts(response.data);
    } catch (err) {
      console.error("Failed to load products:", err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load loan products."),
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSchemes = useCallback(async (productId: number) => {
    setLoading(true);
    try {
      const response = await adminApi.getSchemes(productId);
      setSchemes(response.data);
    } catch (err) {
      console.error(`Failed to load schemes for product ${productId}:`, err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load product schemes."),
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSchemeParameters = useCallback(async (schemeId: number) => {
    setLoading(true);
    try {
      const response = await adminApi.getSchemeParameters(schemeId);
      setCurrentParameter(response.data);
    } catch (err) {
      console.error(`Failed to load parameters for scheme ${schemeId}:`, err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load scheme parameters."),
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchSchemeSlabs = useCallback(async (schemeId: number) => {
    setLoading(true);
    try {
      const response = await adminApi.getSchemeSlabs(schemeId);
      setSlabs(response.data);
    } catch (err) {
      console.error(`Failed to load slabs for scheme ${schemeId}:`, err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load scheme slabs."),
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createProduct = useCallback(async (payload: Partial<LoanProduct> & { maker_comment?: string }) => {
    setActionLoading(true);
    try {
      const response = await adminApi.createProduct(payload);
      toast({
        title: "Request Created",
        description: response.message || "Loan product request created successfully under Maker-Checker workflow.",
        variant: "success",
      });
      return response.data;
    } catch (err) {
      toast({
        title: "Action Failed",
        description: errorMessage(err, "Failed to create product."),
        variant: "warning",
      });
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [toast]);

  const createSchemeSlab = useCallback(async (schemeId: number, payload: Partial<SchemeSlab> & { maker_comment?: string }) => {
    setActionLoading(true);
    try {
      const response = await adminApi.createSchemeSlab(schemeId, payload);
      toast({
        title: "Request Submitted",
        description: response.message || "Slab creation request submitted for review.",
        variant: "success",
      });
      return response.data;
    } catch (err) {
      toast({
        title: "Action Failed",
        description: errorMessage(err, "Failed to submit slab creation request."),
        variant: "warning",
      });
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [toast]);

  const updateSchemeSlab = useCallback(async (slabId: number, payload: Partial<SchemeSlab> & { maker_comment?: string }) => {
    setActionLoading(true);
    try {
      const response = await adminApi.updateSchemeSlab(slabId, payload);
      toast({
        title: "Update Submitted",
        description: response.message || "Slab update request submitted for review.",
        variant: "success",
      });
      return response.data;
    } catch (err) {
      toast({
        title: "Action Failed",
        description: errorMessage(err, "Failed to submit slab update request."),
        variant: "warning",
      });
      return null;
    } finally {
      setActionLoading(false);
    }
  }, [toast]);

  const deleteSchemeSlab = useCallback(async (slabId: number) => {
    setActionLoading(true);
    try {
      const response = await adminApi.deleteSchemeSlab(slabId);
      toast({
        title: "Delete Request Submitted",
        description: response.message || "Slab deletion request submitted for review.",
        variant: "success",
      });
      return true;
    } catch (err) {
      toast({
        title: "Action Failed",
        description: errorMessage(err, "Failed to submit slab delete request."),
        variant: "warning",
      });
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [toast]);

  return {
    loading,
    actionLoading,
    products,
    schemes,
    currentParameter,
    slabs,
    setSlabs,
    fetchProducts,
    fetchSchemes,
    fetchSchemeParameters,
    fetchSchemeSlabs,
    createProduct,
    createSchemeSlab,
    updateSchemeSlab,
    deleteSchemeSlab,
  };
}
