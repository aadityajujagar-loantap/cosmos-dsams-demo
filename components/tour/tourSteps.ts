import { TourRole, TourStep } from "./types";

export const MAKER_STEPS: TourStep[] = [
  {
    id: "maker-step-1-tab",
    role: "maker",
    badge: "Step 1 of 6 · Documents Checklist",
    target: '[data-tour="tab-documents"]',
    title: "1. Open Documents Checklist",
    description:
      "As Branch Maker, intake begins with document verification. Click 'Documents Checklist' to access all applicant KYC proofs, entity documents, and visit inspection files.",
    position: "bottom",
    tab: "documents",
    docSubTab: "kyc",
  },
  {
    id: "maker-step-2-visit-report",
    role: "maker",
    badge: "Step 2 of 6 · Physical Visit Report",
    target: '[data-tour="maker-documents-section"]',
    title: "2. Upload All Pending Documents",
    description:
      "Review the document checklist for missing items. Critical: You MUST upload the Physical Visit Report. The system will lock bulk verification until the visit report is uploaded and present.",
    position: "top",
    tab: "documents",
    docSubTab: "kyc",
  },
  {
    id: "maker-step-3-mass-verify",
    role: "maker",
    badge: "Step 3 of 6 · Mass Verify Docs",
    target: '[data-tour="maker-mass-verify-btn"]',
    title: "3. Mass Verify All Documents",
    description:
      "Once all pending applicant documents (including the Physical Visit Report) are uploaded, this 'Verify All Documents' button becomes active. Click it to verify all partner documents in a single click.",
    position: "bottom",
    tab: "documents",
    docSubTab: "kyc",
  },
  {
    id: "maker-step-4-approval-tab",
    role: "maker",
    badge: "Step 4 of 6 · DSA Approval Tab",
    target: '[data-tour="tab-actions"]',
    title: "4. Return to DSA Approval",
    description:
      "After verifying all documents, switch back to the 'DSA Approval' tab to complete the Maker stage and record your intake summary.",
    position: "bottom",
    tab: "actions",
  },
  {
    id: "maker-step-5-submit",
    role: "maker",
    badge: "Step 5 of 6 · Submit / Approve",
    target: '[data-tour="workflow-approve-btn"]',
    title: "5. Submit Case to Checker",
    description:
      "Click the green 'Submit to Checker' (or 'Approve') button, enter your Maker verification remarks in the dialog, and submit the case forward to Level 2 (Checker).",
    position: "top",
    tab: "actions",
  },
  {
    id: "maker-step-6-query-back",
    role: "maker",
    badge: "Step 6 of 6 · Query Response",
    target: '[data-tour="workflow-query-back-btn"]',
    title: "6. Query Back to Checker",
    description:
      "When Checker or an Approver returns a query on missing documents or discrepancies, review the query remarks, upload the rectified documents, and click 'Query Back to Checker' to resubmit the case.",
    position: "top",
    tab: "actions",
  },
];

export const CHECKER_STEPS: TourStep[] = [
  {
    id: "checker-step-1-app-form",
    role: "checker",
    badge: "Step 1 of 8 · Application Form",
    target: '[data-tour="tab-overview"]',
    title: "1. Review DSA Application Form",
    description:
      "As Branch Checker, start by reviewing the partner's core registration, entity classification, and branch details under the 'DSA Application Form' tab.",
    position: "bottom",
    tab: "overview",
    appFormSubTab: "applicant",
  },
  {
    id: "checker-step-2-kyc-blocks",
    role: "checker",
    badge: "Step 2 of 8 · 6 KYC Blocks",
    target: '[data-tour="checker-kyc-6-blocks"]',
    title: "2. Verify 6 Statutory KYC Blocks",
    description:
      "Inspect all 6 statutory KYC verification blocks: (1) PAN via Income Tax gateway, (2) GSTIN lookup, (3) Bank Account Verification (Pennyless/Penny Drop BAV), (4) Udyam MSME registration, (5) CIBIL Consumer/Commercial Hard Pull, and (6) Compass AML anti-money laundering screening. Use 'Check All KYC' to run any pending statutory checks.",
    position: "top",
    tab: "overview",
    appFormSubTab: "kyc",
  },
  {
    id: "checker-step-3-dd-note-btn",
    role: "checker",
    badge: "Step 3 of 8 · Due Diligence (DDL)",
    target: '[data-tour="checker-dd-note-btn"]',
    title: "3. Due Diligence (DDL) Note",
    description:
      "Next, navigate to the Due Diligence Report section and click the 'DD Note *' button to document your comprehensive due diligence observations regarding partner credibility and business profile.",
    position: "bottom",
    tab: "overview",
    appFormSubTab: "ddl",
  },
  {
    id: "checker-step-4-deviations",
    role: "checker",
    badge: "Step 4 of 8 · Deviations Modal",
    target: '[data-tour="deviations-modal-content"]',
    title: "4. Review Business Rule Deviations Dialog",
    description:
      "Here is the Policy Evaluation & Deviation Details dialog. Inspect all BRE deviations (such as CIBIL score variance or business vintage). You can enter mitigation remarks directly for each deviation in this dialog.",
    position: "bottom",
    openModal: "deviations",
  },
  {
    id: "checker-step-5-approval-tab",
    role: "checker",
    badge: "Step 5 of 8 · DSA Approval",
    target: '[data-tour="tab-actions"]',
    title: "5. Return to DSA Approval",
    description:
      "Switch back to the 'DSA Approval' tab to execute your workflow recommendation decision.",
    position: "bottom",
    tab: "actions",
  },
  {
    id: "checker-step-6-approve",
    role: "checker",
    badge: "Step 6 of 8 · Approve Decision",
    target: '[data-tour="workflow-approve-btn"]',
    title: "6. Approve with Remarks",
    description:
      "Click 'Submit to Sub-Region Head' (or 'Approve'), enter your mandatory due diligence remarks (up to 256 characters), and forward the case to Level 3.",
    position: "top",
    tab: "actions",
  },
  {
    id: "checker-step-7-raise-query",
    role: "checker",
    badge: "Step 7 of 8 · Raise Query",
    target: '[data-tour="workflow-raise-query-btn"]',
    title: "7. Action: Raise Query to Maker",
    description:
      "If any documents, bank proofs, or details are incomplete or ambiguous, click 'Raise Query to Maker'. The file is returned to Maker with your specific query details without rejecting.",
    position: "top",
    tab: "actions",
  },
  {
    id: "checker-step-8-reject",
    role: "checker",
    badge: "Step 8 of 8 · Reject",
    target: '[data-tour="workflow-reject-btn"]',
    title: "8. Action: Reject Application",
    description:
      "If the entity fails fundamental KYC or bank compliance standards, click 'Reject Application' and provide an auditable rejection reason.",
    position: "top",
    tab: "actions",
  },
];

export const APPROVER_STEPS: TourStep[] = [
  {
    id: "approver-step-1-chevron",
    role: "approver",
    badge: "Step 1 of 7 · Workflow Hierarchy",
    target: '[data-tour="workflow-chevron-bar"]',
    title: "1. Empanelment Progression Bar",
    description:
      "Review the multi-stage review pipeline (Maker -> Checker -> Sub-Region Head -> Region Head -> HO Credit Officer -> HO Credit Head). Skipped or conditional levels (e.g. DGM) are automatically designated.",
    position: "bottom",
  },
  {
    id: "approver-step-2-dd-report",
    role: "approver",
    badge: "Step 2 of 7 · Due Diligence Report",
    target: '[data-tour="btn-dd-report"]',
    title: "2. Inspect Due Diligence Report",
    description:
      "Click 'Due Diligence Report' to preview or download the unified verification and branch due diligence report compiled by the Checker.",
    position: "bottom",
  },
  {
    id: "approver-step-3-deviations",
    role: "approver",
    badge: "Step 3 of 7 · Policy Deviations",
    target: '[data-tour="deviations-modal-content"]',
    title: "3. Inspect Policy Deviations Dialog",
    description:
      "Here is the Policy Evaluation & Deviation Details dialog. Inspect all BRE flagged deviations, impact risk assessments, and the mitigation remarks supplied by the Branch Checker.",
    position: "bottom",
    openModal: "deviations",
  },
  {
    id: "approver-step-4-review-remarks",
    role: "approver",
    badge: "Step 4 of 7 · Prior Remarks Audit",
    target: '[data-tour="workflow-review-section"]',
    title: "4. Audit Prior Stage Remarks",
    description:
      "Review chronological remarks and timestamps from Maker, Checker, and prior approval tiers in the audit card before recording your decision.",
    position: "top",
    tab: "actions",
  },
  {
    id: "approver-step-5-approve-btn",
    role: "approver",
    badge: "Step 5 of 7 · Approve with Remark",
    target: '[data-tour="workflow-approve-btn"]',
    title: "5. Approve / Sanction with Remarks",
    description:
      "Click the green decision button ('Recommend' for L3-L6, or 'Sanction & Approve' for Level 7 HO Credit Head). Enter your mandatory review remarks to advance the file.",
    position: "top",
    tab: "actions",
  },
  {
    id: "approver-step-6-reallocate-btn",
    role: "approver",
    badge: "Step 6 of 7 · Re-allocate Authority",
    target: '[data-tour="workflow-reallocate-btn"]',
    title: "6. Re-allocate to Another Authority",
    description:
      "Use 'Re-allocate' to delegate this case to an eligible colleague at your stage (Level 3 Sub-Region Head, Level 4 DGM, or Level 5 Region Head) for expedited review.",
    position: "top",
    tab: "actions",
  },
  {
    id: "approver-step-7-revert-btn",
    role: "approver",
    badge: "Step 7 of 7 · Revert or Reject",
    target: '[data-tour="workflow-revert-btn"]',
    title: "7. Revert or Reject Application",
    description:
      "Use 'Revert' to send the file back to the previous reviewing authority with correction instructions. Use 'Reject Application' if underwriting or statutory criteria fail.",
    position: "top",
    tab: "actions",
  },
];

export function getTourStepsForRole(role: TourRole): TourStep[] {
  switch (role) {
    case "maker":
      return MAKER_STEPS;
    case "checker":
      return CHECKER_STEPS;
    case "approver":
      return APPROVER_STEPS;
    default:
      return MAKER_STEPS;
  }
}
