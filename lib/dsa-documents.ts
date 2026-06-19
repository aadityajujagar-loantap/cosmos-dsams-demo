import type { DocumentRecord, DocumentType } from "@/lib/types";

export type RequiredDsaDocument = { key: string; label: string };

export const requiredDsaDocumentGroups: { documents: RequiredDsaDocument[]; title: string }[] = [
  {
    documents: [
      { key: "applicantPan", label: "Applicant PAN Card" },
      { key: "aadhaarFront", label: "Applicant Aadhaar (Front)" },
      { key: "aadhaarBack", label: "Applicant Aadhaar (Back)" },
    ],
    title: "Upload Applicant Documents",
  },
  {
    documents: [
      { key: "companyPan", label: "Company PAN Card" },
      { key: "bankProof", label: "Bank Account Proof" },
      { key: "mouDoc", label: "MOU Document" },
      { key: "empanelmentLetter", label: "Empanelment Letter" },
      { key: "gstin", label: "GSTIN" },
      { key: "others", label: "Others" },
    ],
    title: "Upload Company Documents",
  },
];

export const requiredDsaDocuments = requiredDsaDocumentGroups.flatMap((group) => group.documents);

export function dsaDocumentType(key: string): DocumentType {
  if (key.toLowerCase().includes("pan")) return "PAN";
  if (key.toLowerCase().includes("aadhaar")) return "Aadhaar";
  if (key.toLowerCase().includes("bank")) return "Bank Statement";
  return "Photograph";
}

export function isMissingDsaDocumentRecord(document: DocumentRecord) {
  return document.size === "0 KB" || document.fileName.startsWith("Missing - ") || document.remarks.includes("Mandatory document missing");
}
