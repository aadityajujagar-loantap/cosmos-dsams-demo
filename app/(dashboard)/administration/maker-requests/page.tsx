"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Eye, RefreshCw, ShieldAlert, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useMakerChecker } from "@/hooks/useMakerChecker";
import { Button, Card, CardContent, CardHeader, EmptyState, Input, Modal, Select, StatusBadge, Textarea } from "@/components/ui/primitives";
import type { MakerRequest, MakerRequestActionType, MakerRequestStatus } from "@/types/makerChecker";

const PAGE_SIZE = 10;
const STATUS_TABS: MakerRequestStatus[] = ["pending", "approved", "rejected"];
const ACTION_FILTERS: MakerRequestActionType[] = ["add", "update", "delete"];

function titleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function displayUser(user?: MakerRequest["requester"] | MakerRequest["reviewer"]) {
  return user?.name || user?.email || "-";
}

function JsonBlock({ data, tone }: { data: Record<string, unknown> | null; tone: "blue" | "green" | "slate" }) {
  const toneClass =
    tone === "blue"
      ? "border-blue-100 bg-blue-50/50 text-blue-950"
      : tone === "green"
        ? "border-emerald-100 bg-emerald-50/50 text-emerald-950"
        : "border-slate-100 bg-slate-50 text-slate-800";

  return (
    <pre className={`max-h-56 overflow-x-auto rounded-md border p-2 text-[10px] font-mono ${toneClass}`}>
      {JSON.stringify(data ?? {}, null, 2)}
    </pre>
  );
}

export default function MakerRequestsPage() {
  const {
    approveRequest,
    detailLoading,
    fetchRequestDetail,
    fetchRequests,
    loading,
    pagination,
    rejectRequest,
    requests,
    selectedRequest,
    setSelectedRequest,
  } = useMakerChecker();
  const { hasPermission, hasRole, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<MakerRequestStatus>("pending");
  const [actionFilter, setActionFilter] = useState<MakerRequestActionType | "">("");
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [targetUuid, setTargetUuid] = useState("");

  const canView = hasPermission("maker_requests.view") || hasRole(["super_admin", "admin", "checker"]);
  const canApprove = hasPermission("maker_requests.approve") || hasRole(["super_admin", "admin", "checker"]);
  const canReject = hasPermission("maker_requests.reject") || hasRole(["super_admin", "admin", "checker"]);

  const requestParams = useMemo(
    () => ({
      action_type: actionFilter || undefined,
      group: groupFilter.trim() || undefined,
      page,
      per_page: PAGE_SIZE,
      status: activeTab,
    }),
    [actionFilter, activeTab, groupFilter, page],
  );

  const loadRequests = useCallback(() => {
    if (!canView) return;
    fetchRequests(requestParams);
  }, [canView, fetchRequests, requestParams]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setSelectedRequest(null);
  }, [actionFilter, activeTab, groupFilter, setSelectedRequest]);

  const openRequest = (request: MakerRequest) => {
    setSelectedRequest(request);
    fetchRequestDetail(request.uuid);
  };

  const handleApprove = async (uuid: string) => {
    if (!canApprove) return;
    const reviewed = await approveRequest(uuid);
    if (!reviewed) return;
    setSelectedRequest(null);
    loadRequests();
  };

  const handleOpenRejectModal = (uuid: string) => {
    if (!canReject) return;
    setTargetUuid(uuid);
    setRejectionReason("");
    setRejectionModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    const reason = rejectionReason.trim();
    if (!canReject || !reason) return;

    const reviewed = await rejectRequest(targetUuid, reason);
    if (!reviewed) return;

    setRejectionModalOpen(false);
    setSelectedRequest(null);
    loadRequests();
  };

  const hasReviewAction = selectedRequest?.status === "pending" && (canApprove || canReject);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <EmptyState
          action={<ShieldAlert className="mx-auto h-8 w-8 text-rose-500" />}
          description="Your authenticated role does not include maker_requests.view."
          title="Maker-checker access restricted"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Maker-Checker Approvals</h1>
          <p className="mt-1 text-sm text-slate-500">Super admin and checker review queue for protected changes.</p>
        </div>
        <Button disabled={loading} onClick={loadRequests} type="button" variant="outline">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-3">
        <div className="flex gap-4">
          {STATUS_TABS.map((tab) => (
            <button
              className={`border-b-2 px-1 pb-3 text-sm font-bold capitalize transition ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="ml-auto grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[180px_180px]">
          <Input
            aria-label="Filter by group"
            onChange={(event) => {
              setGroupFilter(event.target.value);
              setPage(1);
            }}
            placeholder="Group"
            value={groupFilter}
          />
          <Select
            aria-label="Filter by action"
            onChange={(event) => {
              setActionFilter(event.target.value as MakerRequestActionType | "");
              setPage(1);
            }}
            value={actionFilter}
          >
            <option value="">All actions</option>
            {ACTION_FILTERS.map((action) => (
              <option key={action} value={action}>
                {titleCase(action)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_400px]">
        <Card className="lg:min-h-[500px]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            ) : requests.length === 0 ? (
              <div className="px-6 py-12">
                <EmptyState
                  description="Change filters or refresh after makers submit protected changes."
                  title={`No ${activeTab} requests found`}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="p-4">Group</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Maker</th>
                      <th className="p-4">Submitted</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map((request) => (
                      <tr
                        className={`cursor-pointer transition hover:bg-slate-50 ${
                          selectedRequest?.uuid === request.uuid ? "bg-blue-50/50 hover:bg-blue-50" : ""
                        }`}
                        key={request.uuid}
                        onClick={() => openRequest(request)}
                      >
                        <td className="p-4 font-bold text-slate-900">{titleCase(request.group)}</td>
                        <td className="p-4">
                          <StatusBadge status={titleCase(request.action_type)} />
                        </td>
                        <td className="p-4 text-slate-600">{displayUser(request.requester)}</td>
                        <td className="p-4 text-slate-500">{formatDateTime(request.created_at)}</td>
                        <td className="p-4">
                          <StatusBadge status={titleCase(request.status)} />
                        </td>
                        <td className="p-4 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button aria-label="View request details" onClick={() => openRequest(request)} size="sm" type="button" variant="ghost">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {request.status === "pending" && canApprove ? (
                              <Button aria-label="Approve request" onClick={() => handleApprove(request.uuid)} size="icon" type="button" variant="outline">
                                <ThumbsUp className="h-4 w-4 text-emerald-700" />
                              </Button>
                            ) : null}
                            {request.status === "pending" && canReject ? (
                              <Button aria-label="Reject request" onClick={() => handleOpenRejectModal(request.uuid)} size="icon" type="button" variant="outline">
                                <ThumbsDown className="h-4 w-4 text-rose-700" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.lastPage} · {pagination.total} total
            </span>
            <div className="flex gap-2">
              <Button disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} size="sm" type="button" variant="outline">
                Previous
              </Button>
              <Button disabled={loading || page >= pagination.lastPage} onClick={() => setPage((current) => current + 1)} size="sm" type="button" variant="outline">
                Next
              </Button>
            </div>
          </div>
        </Card>

        {selectedRequest ? (
          <Card className="sticky top-6">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">Request Details</h3>
                <p className="mt-0.5 text-xs text-slate-500">UUID: {selectedRequest.uuid}</p>
              </div>
              <Button aria-label="Close details" onClick={() => setSelectedRequest(null)} size="icon" type="button" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[650px] space-y-4 overflow-y-auto p-4 text-xs">
              {detailLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-blue-700">
                  <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />
                  Loading request detail
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Group</span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-900">{titleCase(selectedRequest.group)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Action</span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-900">{titleCase(selectedRequest.action_type)}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Requested By</span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-900">{displayUser(selectedRequest.requester)}</span>
                  <span className="block text-slate-500">{selectedRequest.requester?.email ?? ""}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</span>
                  <span className="mt-1 block"><StatusBadge status={titleCase(selectedRequest.status)} /></span>
                </div>
              </div>

              {selectedRequest.status === "rejected" ? (
                <div className="space-y-1 rounded-md border border-rose-100 bg-rose-50 p-3 text-rose-800">
                  <span className="block text-[10px] font-bold uppercase tracking-wide">Rejection Reason</span>
                  <p className="font-medium">{selectedRequest.rejection_reason || "-"}</p>
                  <span className="block text-[10px] text-rose-600">
                    Reviewed by {displayUser(selectedRequest.reviewer)} on {formatDateTime(selectedRequest.reviewed_at)}
                  </span>
                </div>
              ) : null}

              {selectedRequest.status === "approved" ? (
                <div className="space-y-1 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-emerald-800">
                  <span className="block text-[10px] font-bold uppercase tracking-wide">Approved By</span>
                  <span className="block font-semibold">{displayUser(selectedRequest.reviewer)}</span>
                  <span className="block text-[10px] text-emerald-600">{formatDateTime(selectedRequest.reviewed_at)}</span>
                </div>
              ) : null}

              <div className="space-y-2">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Payload Comparison</span>
                {selectedRequest.original_data ? (
                  <div className="grid grid-cols-1 gap-2">
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase text-slate-500">Original</span>
                      <JsonBlock data={selectedRequest.original_data} tone="slate" />
                    </div>
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase text-blue-600">Proposed</span>
                      <JsonBlock data={selectedRequest.request_data} tone="blue" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="block text-[9px] font-bold uppercase text-emerald-600">New Data</span>
                    <JsonBlock data={selectedRequest.request_data} tone="green" />
                  </div>
                )}
              </div>

              {hasReviewAction ? (
                <div className="flex gap-2 border-t border-slate-100 pt-2">
                  {canApprove ? (
                    <Button className="flex-1" onClick={() => handleApprove(selectedRequest.uuid)} type="button" variant="primary">
                      <ThumbsUp className="h-4 w-4" />
                      Approve
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button className="flex-1" onClick={() => handleOpenRejectModal(selectedRequest.uuid)} type="button" variant="danger">
                      <ThumbsDown className="h-4 w-4" />
                      Reject
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="hidden sticky top-6 lg:block">
            <CardContent className="space-y-3 py-20 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" />
              <div>
                <p className="text-sm font-bold text-slate-800">Select a request</p>
                <p className="mx-auto mt-1 max-w-[220px] text-xs text-slate-500">
                  The detail panel is loaded from the maker request detail API.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Modal
        onClose={() => setRejectionModalOpen(false)}
        open={rejectionModalOpen}
        title="Reject Modification Request"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700" htmlFor="rejection-reason">
              Reason for Rejection
            </label>
            <Textarea
              id="rejection-reason"
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Provide detail explaining why this request is rejected"
              value={rejectionReason}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRejectionModalOpen(false)} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={!rejectionReason.trim()} onClick={handleRejectSubmit} type="button" variant="danger">
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
