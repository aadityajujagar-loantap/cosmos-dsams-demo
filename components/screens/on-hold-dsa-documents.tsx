"use client";

import Link from "next/link";
import { UploadCloud } from "lucide-react";

import { DetailItem } from "@/components/module";
import { Button, Card, CardContent, CardHeader, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { isMissingDsaDocumentRecord } from "@/lib/dsa-documents";
import { useMockStore } from "@/lib/store";
import type { Dsa } from "@/lib/types";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function OnHoldDsaDocuments({
  description = "Upload pending mandatory documents to release DSAs from hold.",
  dsas,
  emptyDescription = "No DSAs are currently on hold.",
  maxRows,
  title = "On-Hold DSAs",
}: {
  description?: string;
  dsas: Dsa[];
  emptyDescription?: string;
  maxRows?: number;
  title?: string;
}) {
  const { currentUser, updateItem } = useMockStore();
  const { toast } = useToast();
  const visibleDsas = maxRows ? dsas.slice(0, maxRows) : dsas;
  const canUpload =
    currentUser?.role === "DSA Manager" ||
    currentUser?.role === "DSA Credit" ||
    currentUser?.role === "Branch Regional Head" ||
    currentUser?.role === "Branch User";

  function uploadMissingDocument(dsa: Dsa, documentId: string, file?: File) {
    if (!file || !canUpload) return;

    const actor = currentUser?.name ?? "system";
    const nextDocuments = dsa.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            fileName: file.name,
            remarks: `Uploaded from on-hold queue by ${actor}.`,
            size: formatFileSize(file.size),
            status: "Pending" as const,
            uploadedAt: new Date().toISOString(),
          }
        : document,
    );
    const stillMissing = nextDocuments.some(isMissingDsaDocumentRecord);

    updateItem("dsas", dsa.id, {
      documents: nextDocuments,
      status: stillMissing ? "On Hold" : "Pending Credit Approval",
    });

    toast({
      title: stillMissing ? "Document uploaded" : "DSA released from hold",
      description: stillMissing
        ? `${dsa.name} still has pending mandatory documents.`
        : `${dsa.name} is now ready for approval review.`,
      variant: "success",
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <StatusBadge status={`${dsas.length} On Hold`} />
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleDsas.length ? (
          visibleDsas.map((dsa) => {
            const missingDocuments = dsa.documents.filter(isMissingDsaDocumentRecord);
            return (
              <div className="rounded-lg border border-slate-100 p-4" key={dsa.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{dsa.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-mono">{dsa.code}</span> - {dsa.businessType} - {dsa.city}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={dsa.status} />
                    <Link href={`/dsa/${dsa.id}`}>
                      <Button size="sm" type="button" variant="outline">
                        Open
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <DetailItem label="Manager" value={dsa.manager} />
                  <DetailItem label="Submitted" value={new Date(dsa.onboardingDate).toLocaleDateString("en-IN")} />
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Missing documents
                  </p>
                  {missingDocuments.length ? (
                    <div className="grid gap-2 lg:grid-cols-2">
                      {missingDocuments.map((document) => {
                        const inputId = `on-hold-doc-${dsa.id}-${document.id}`;
                        return (
                          <div className="flex items-center justify-between gap-3 rounded-md border border-sky-100 bg-sky-50 p-3" key={document.id}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-blue-950">{document.fileName.replace("Missing - ", "")}</p>
                              <p className="text-xs text-blue-700">{document.remarks}</p>
                            </div>
                            {canUpload ? (
                              <>
                                <input
                                  accept=".jpg,.jpeg,.png,.pdf"
                                  className="sr-only"
                                  id={inputId}
                                  onChange={(event) => uploadMissingDocument(dsa, document.id, event.currentTarget.files?.[0])}
                                  type="file"
                                />
                                <label
                                  className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                                  htmlFor={inputId}
                                  title="Upload missing document"
                                >
                                  <UploadCloud className="h-3.5 w-3.5" />
                                  Upload
                                </label>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                      All mandatory documents are uploaded. This DSA can be moved to approval review.
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-500">{emptyDescription}</p>
        )}
      </CardContent>
    </Card>
  );
}
