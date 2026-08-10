"use client";

import { useEffect, useState } from "react";
import { useMakerChecker } from "@/hooks/useMakerChecker";
import { Button, Card, CardContent, CardHeader, EmptyState, Modal, StatusBadge } from "@/components/ui/primitives";
import { ClipboardCheck, Eye, ThumbsDown, ThumbsUp, X } from "lucide-react";

export default function MakerRequestsPage() {
  const { requests, loading, fetchRequests, approveRequest, rejectRequest } = useMakerChecker();
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [targetUuid, setTargetUuid] = useState("");

  useEffect(() => {
    fetchRequests({ status: activeTab });
  }, [activeTab, fetchRequests]);

  const handleApprove = async (uuid: string) => {
    const success = await approveRequest(uuid);
    if (success && selectedRequest?.uuid === uuid) {
      setSelectedRequest(null);
    }
  };

  const handleOpenRejectModal = (uuid: string) => {
    setTargetUuid(uuid);
    setRejectionReason("");
    setRejectionModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) return;
    const success = await rejectRequest(targetUuid, rejectionReason);
    if (success) {
      setRejectionModalOpen(false);
      if (selectedRequest?.uuid === targetUuid) {
        setSelectedRequest(null);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Maker-Checker Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review, approve, or reject administrative data modification requests.
          </p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-6">
        {(["pending", "approved", "rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-bold capitalize transition border-b-2 px-1 ${
              activeTab === tab
                ? "border-blue-600 text-blue-600 font-extrabold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab} Requests
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        <Card className="lg:min-h-[500px]">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></span>
              </div>
            ) : requests.length === 0 ? (
              <div className="py-12 px-6">
                <EmptyState
                  title={`No ${activeTab} requests found`}
                  description={`All submitted changes have been processed.`}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="p-4">Module/Group</th>
                      <th className="p-4">Action</th>
                      <th className="p-4">Maker</th>
                      <th className="p-4">Date Submitted</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requests.map((req) => (
                      <tr
                        key={req.uuid}
                        onClick={() => setSelectedRequest(req)}
                        className={`hover:bg-slate-50 cursor-pointer transition ${
                          selectedRequest?.uuid === req.uuid ? "bg-blue-50/50 hover:bg-blue-50" : ""
                        }`}
                      >
                        <td className="p-4 font-bold text-slate-900 capitalize">
                          {req.group.replace(/_/g, " ")}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                              req.action_type === "add"
                                ? "bg-emerald-50 text-emerald-700"
                                : req.action_type === "update"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {req.action_type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600">{req.requester?.name || "System"}</td>
                        <td className="p-4 text-slate-500">{new Date(req.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedRequest(req)}
                              aria-label="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {activeTab === "pending" && (
                              <>
                                <button
                                  onClick={() => handleApprove(req.uuid)}
                                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                                  title="Approve"
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenRejectModal(req.uuid)}
                                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
                                  title="Reject"
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedRequest ? (
          <Card className="sticky top-6">
            <CardHeader className="flex flex-row justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wider">Request Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">UUID: {selectedRequest.uuid.slice(0, 8)}...</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-4 space-y-4 max-h-[600px] overflow-y-auto text-xs">
              <div>
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[10px]">Requested By</span>
                <span className="text-sm font-semibold text-slate-900 mt-0.5 block">{selectedRequest.requester?.name}</span>
                <span className="text-slate-500 block">{selectedRequest.requester?.email}</span>
              </div>

              {selectedRequest.status === "rejected" && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 space-y-1">
                  <span className="font-bold block uppercase tracking-wide text-[10px]">Rejection Reason</span>
                  <p className="font-medium">{selectedRequest.rejection_reason || "No reason provided."}</p>
                  {selectedRequest.reviewer && (
                    <span className="text-[10px] text-rose-600 block mt-1">
                      Reviewed by {selectedRequest.reviewer.name}
                    </span>
                  )}
                </div>
              )}

              {selectedRequest.status === "approved" && selectedRequest.reviewer && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 space-y-1">
                  <span className="font-bold block uppercase tracking-wide text-[10px]">Approved By</span>
                  <span className="font-semibold block">{selectedRequest.reviewer.name}</span>
                  {selectedRequest.reviewed_at && (
                    <span className="text-[10px] text-emerald-600 block mt-0.5">
                      on {new Date(selectedRequest.reviewed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[10px]">Payload Comparison</span>
                {selectedRequest.original_data ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-500 block text-[9px] uppercase">Original</span>
                      <pre className="p-2 rounded-xl bg-slate-50 text-[10px] overflow-x-auto border border-slate-100 font-mono text-slate-700 max-h-48">
                        {JSON.stringify(selectedRequest.original_data, null, 2)}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-blue-600 block text-[9px] uppercase">Proposed</span>
                      <pre className="p-2 rounded-xl bg-blue-50/50 text-[10px] overflow-x-auto border border-blue-100/50 font-mono text-blue-900 max-h-48">
                        {JSON.stringify(selectedRequest.request_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="font-bold text-emerald-600 block text-[9px] uppercase">New Data</span>
                    <pre className="p-2 rounded-xl bg-emerald-50/50 text-[10px] overflow-x-auto border border-emerald-100/50 font-mono text-emerald-900 max-h-48">
                      {JSON.stringify(selectedRequest.request_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {selectedRequest.status === "pending" && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    className="flex-1"
                    variant="primary"
                    onClick={() => handleApprove(selectedRequest.uuid)}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    className="flex-1"
                    variant="danger"
                    onClick={() => handleOpenRejectModal(selectedRequest.uuid)}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="hidden lg:block sticky top-6">
            <CardContent className="py-20 text-center space-y-3">
              <ClipboardCheck className="h-8 w-8 text-slate-300 mx-auto" />
              <div>
                <p className="font-bold text-slate-800 text-sm">Select a request</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                  Click any row in the table to view the detailed JSON payload changes.
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
            <label htmlFor="rejection-reason" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Reason for Rejection
            </label>
            <textarea
              id="rejection-reason"
              placeholder="Provide detail explaining why this request is rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full h-24 p-3 rounded-xl border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none text-sm transition"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectionModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRejectSubmit} disabled={!rejectionReason.trim()}>
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
