"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Cog,
  Folder,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { adminApi } from "@/apis/admin";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { MasterValue, MasterValuePayload } from "@/types/masterValue";

export function MasterValuesPage() {
  const { toast } = useToast();

  // Data & loading states
  const [items, setItems] = useState<MasterValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Summary counts
  const [allCategoriesList, setAllCategoriesList] = useState<string[]>([]);
  const [totalMasterCount, setTotalMasterCount] = useState<number>(0);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterValue | null>(null);
  const [formCategory, setFormCategory] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formOrder, setFormOrder] = useState<number>(0);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<MasterValue | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch overall stats (all distinct categories & grand total)
  const fetchGlobalStats = useCallback(async () => {
    try {
      // Fetch a wider list to extract all categories and counts
      const res = await adminApi.getMasterValuesPage({ per_page: 500 });
      if (res && res.data) {
        const uniqueCats = Array.from(new Set(res.data.map((v) => v.call_type))).sort();
        setAllCategoriesList(uniqueCats);
        setTotalMasterCount(res.total || res.data.length);
      }
    } catch {
      // Ignore background stats fetch errors
    }
  }, []);

  // Fetch paginated data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page,
        per_page: perPage,
      };
      if (selectedCategory && selectedCategory !== "all") {
        params.call_type = selectedCategory;
      }

      const res = await adminApi.getMasterValuesPage(params);
      if (res) {
        setItems(res.data || []);
        setTotal(res.total || 0);
        setLastPage(res.last_page || 1);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load master values.");
      toast({
        title: "Error Loading Data",
        description: err?.message || "Could not retrieve master values.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, selectedCategory, toast]);

  useEffect(() => {
    fetchGlobalStats();
  }, [fetchGlobalStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle client-side search filtering if search query exists
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.call_type.toLowerCase().includes(q) ||
        item.meta_key.toLowerCase().includes(q) ||
        item.meta_value.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormCategory(selectedCategory !== "all" ? selectedCategory : "");
    setFormKey("");
    setFormLabel("");
    setFormOrder(0);
    setFormActive(true);
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: MasterValue) => {
    setEditingItem(item);
    setFormCategory(item.call_type);
    setFormKey(item.meta_key);
    setFormLabel(item.meta_value);
    setFormOrder(item.sort_order ?? 0);
    setFormActive(item.is_active ?? true);
    setModalOpen(true);
  };

  // Save (Create or Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategory.trim() || !formKey.trim() || !formLabel.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in Category, Key, and Label.",
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload: MasterValuePayload = {
        call_type: formCategory.trim(),
        meta_key: formKey.trim().toUpperCase(),
        meta_value: formLabel.trim(),
        sort_order: Number(formOrder) || 0,
        is_active: Boolean(formActive),
      };

      if (editingItem) {
        const res: any = await adminApi.updateMasterValue(editingItem.id, payload);
        if (res && res.status === "pending" && res.reference) {
          toast({
            title: "Maker-Checker Pending",
            description: `Update submitted for approval. Reference: ${res.reference}`,
            variant: "info",
          });
        } else {
          toast({
            title: "Master Value Updated",
            description: `Successfully updated "${payload.meta_value}".`,
            variant: "success",
          });
        }
      } else {
        const res: any = await adminApi.createMasterValue(payload);
        if (res && res.status === "pending" && res.reference) {
          toast({
            title: "Maker-Checker Pending",
            description: `Creation submitted for approval. Reference: ${res.reference}`,
            variant: "info",
          });
        } else {
          toast({
            title: "Master Value Created",
            description: `Successfully created "${payload.meta_value}".`,
            variant: "success",
          });
        }
      }

      setModalOpen(false);
      fetchData();
      fetchGlobalStats();
    } catch (err: any) {
      toast({
        title: editingItem ? "Update Failed" : "Creation Failed",
        description: err?.message || "Failed to save master value.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Action
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res: any = await adminApi.deleteMasterValue(deleteTarget.id);
      if (res && res.status === "pending" && res.reference) {
        toast({
          title: "Maker-Checker Pending",
          description: `Deletion submitted for approval. Reference: ${res.reference}`,
          variant: "info",
        });
      } else {
        toast({
          title: "Deleted Successfully",
          description: `Master value "${deleteTarget.meta_value}" deleted.`,
          variant: "success",
        });
      }
      setDeleteTarget(null);
      fetchData();
      fetchGlobalStats();
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err?.message || "Could not delete master value.",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-[#151c38]">
            Master Values
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configuration for dropdowns and system constants
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#151c38] hover:bg-[#1f2852] rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Value</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        {/* Total Values Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700">
            <Cog className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg lg:text-xl font-bold text-slate-900 leading-tight">
              {totalMasterCount || total || 0}
            </div>
            <div className="text-xs text-slate-500 font-normal">Total Values</div>
          </div>
        </div>

        {/* Categories Card */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600">
            <Folder className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg lg:text-xl font-bold text-slate-900 leading-tight">
              {allCategoriesList.length || 0}
            </div>
            <div className="text-xs text-slate-500 font-normal">Categories</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-2 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category, key or label..."
            className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 bg-transparent border-0 focus:outline-none focus:ring-0"
          />
        </div>

        <div className="w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-56 text-xs text-slate-700 bg-transparent border-0 rounded-md focus:outline-none focus:ring-0 cursor-pointer font-medium"
          >
            <option value="all">All Categories</option>
            {allCategoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RotateCcw className="h-6 w-6 animate-spin text-[#151c38] mb-2" />
            <p className="text-xs font-medium text-slate-600">Loading master values...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <p className="text-xs font-semibold text-rose-600 mb-1">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-sm font-semibold text-slate-700">No master values found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search criteria or create a new master value.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#151c38] text-white">
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider">
                    CATEGORY
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider">
                    KEY
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider">
                    LABEL
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider">
                    ORDER
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider">
                    STATUS
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider">
                    UPDATED
                  </th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-right">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Category */}
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-800">
                      {item.call_type}
                    </td>

                    {/* Key */}
                    <td className="px-5 py-3.5 text-xs">
                      <span className="inline-block px-2 py-0.5 rounded font-mono text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/70 uppercase">
                        {item.meta_key}
                      </span>
                    </td>

                    {/* Label */}
                    <td className="px-5 py-3.5 text-xs text-slate-800 font-medium">
                      {item.meta_value}
                    </td>

                    {/* Order */}
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      {item.sort_order ?? 0}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 text-xs">
                      {item.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/80">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Updated */}
                    <td className="px-5 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(item.updated_at || item.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Edit Master Value"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 transition-colors cursor-pointer"
                          title="Delete Master Value"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer & Pagination */}
        {!loading && total > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Page {page} of {lastPage} ({total} total)
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                &larr; Prev
              </button>

              {/* Numbered page buttons */}
              {Array.from({ length: Math.min(7, lastPage) }, (_, i) => {
                let pNum = i + 1;
                if (lastPage > 7) {
                  const start = Math.max(1, Math.min(page - 3, lastPage - 6));
                  pNum = start + i;
                }
                const isActive = pNum === page;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setPage(pNum)}
                    className={`h-7 min-w-7 px-2 rounded font-medium text-xs transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[#151c38] text-white"
                        : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: New / Edit Master Value (Matches Screenshot 2) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#151c38] px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {editingItem ? "Edit Master Value" : "New Master Value"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs text-slate-700">
              {/* Category (Call Type) */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Category (Call Type) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="categories-list"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Select or type a category..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#151c38] focus:ring-1 focus:ring-[#151c38]"
                />
                <datalist id="categories-list">
                  {allCategoriesList.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              {/* Key */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. personal_loan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#151c38] focus:ring-1 focus:ring-[#151c38]"
                />
              </div>

              {/* Label (Value) */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Label (Value) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Personal Loan"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#151c38] focus:ring-1 focus:ring-[#151c38]"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Sort Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={formOrder}
                  onChange={(e) => setFormOrder(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#151c38] focus:ring-1 focus:ring-[#151c38]"
                />
              </div>

              {/* Active Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="active-checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#151c38] focus:ring-[#151c38] cursor-pointer"
                />
                <label
                  htmlFor="active-checkbox"
                  className="font-medium text-slate-800 cursor-pointer select-none"
                >
                  Active
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#151c38] hover:bg-[#1f2852] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RotateCcw className="h-3 w-3 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : editingItem ? (
                    "Save Changes"
                  ) : (
                    "+ Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100 p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Delete Master Value?</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-800">
                &quot;{deleteTarget.meta_value}&quot;
              </span>{" "}
              ({deleteTarget.call_type} / {deleteTarget.meta_key})? This action can be
              subject to Maker-Checker review.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? (
                  <>
                    <RotateCcw className="h-3 w-3 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
