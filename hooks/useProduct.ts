import { useState, useCallback } from "react";
import { adminApi } from "@/apis/admin";
import { useToast } from "@/components/ui/toast";
import type { LoanProduct, LoanType, LoanTypeParameter, LoanTypeSlab } from "@/types/product";

export function useProduct() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [currentParameter, setCurrentParameter] = useState<LoanTypeParameter | null>(null);
  const [slabs, setSlabs] = useState<LoanTypeSlab[]>([]);

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

  const fetchLoanTypes = useCallback(async (productId: number) => {
    setLoading(true);
    try {
      const response = await adminApi.getLoanTypes(productId);
      setLoanTypes(response.data);
    } catch (err) {
      console.error(`Failed to load loan types for product ${productId}:`, err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load product loan types."),
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchLoanTypeParameters = useCallback(async (typeId: number) => {
    setLoading(true);
    try {
      const response = await adminApi.getLoanTypeParameters(typeId);
      setCurrentParameter(response.data);
    } catch (err) {
      console.error(`Failed to load parameters for loan type ${typeId}:`, err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load loan type parameters."),
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchLoanTypeSlabs = useCallback(async (typeId: number) => {
    setLoading(true);
    try {
      const response = await adminApi.getLoanTypeSlabs(typeId);
      setSlabs(response.data);
    } catch (err) {
      console.error(`Failed to load slabs for loan type ${typeId}:`, err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load loan type slabs."),
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

  const createLoanTypeSlab = useCallback(async (typeId: number, payload: Partial<LoanTypeSlab> & { maker_comment?: string }) => {
    setActionLoading(true);
    try {
      const response = await adminApi.createLoanTypeSlab(typeId, payload);
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

  const updateLoanTypeSlab = useCallback(async (slabId: number, payload: Partial<LoanTypeSlab> & { maker_comment?: string }) => {
    setActionLoading(true);
    try {
      const response = await adminApi.updateLoanTypeSlab(slabId, payload);
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

  const deleteLoanTypeSlab = useCallback(async (slabId: number) => {
    setActionLoading(true);
    try {
      const response = await adminApi.deleteLoanTypeSlab(slabId);
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

  const fetchAllProductSlabs = useCallback(async (params?: { search?: string; status?: string }) => {
    setLoading(true);
    try {
      const response = await adminApi.getAllProductSlabs(params);
      return response.data;
    } catch (err) {
      console.error("Failed to load all product slabs:", err);
      toast({
        title: "Load Failed",
        description: errorMessage(err, "Failed to load product slabs."),
        variant: "warning",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    actionLoading,
    products,
    loanTypes,
    schemes: loanTypes, // legacy alias
    currentParameter,
    slabs,
    setSlabs,
    fetchProducts,
    fetchLoanTypes,
    fetchSchemes: fetchLoanTypes, // legacy alias
    fetchLoanTypeParameters,
    fetchSchemeParameters: fetchLoanTypeParameters, // legacy alias
    fetchLoanTypeSlabs,
    fetchSchemeSlabs: fetchLoanTypeSlabs, // legacy alias
    fetchAllProductSlabs,
    createProduct,
    createLoanTypeSlab,
    createSchemeSlab: createLoanTypeSlab, // legacy alias
    updateLoanTypeSlab,
    updateSchemeSlab: updateLoanTypeSlab, // legacy alias
    deleteLoanTypeSlab,
    deleteSchemeSlab: deleteLoanTypeSlab, // legacy alias
  };
}
