export type TourRole = "maker" | "checker" | "approver";

export interface TourStep {
  id: string;
  role: TourRole | "all";
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right" | "auto";
  badge?: string;
  requiredRole?: string;
  // Navigation hook before displaying step
  tab?: "actions" | "overview" | "documents" | "agreements" | "case-activity";
  appFormSubTab?: "applicant" | "kyc" | "ddl";
  docSubTab?: "kyc" | "exp" | "other";
  openModal?: "ddNote" | "deviations" | "approval" | "query" | "reallocate" | "reject";
}

export interface TourContextValue {
  isOpen: boolean;
  activeRole: TourRole;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: TourStep | null;
  startTour: (role?: TourRole) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  setRole: (role: TourRole) => void;
}

