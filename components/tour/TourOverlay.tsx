"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Award,
} from "lucide-react";
import { TourRole, TourStep } from "./types";
import { getTourStepsForRole } from "./tourSteps";

interface TourOverlayProps {
  isOpen: boolean;
  activeRole: TourRole;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  onNavigateAppFormSubTab?: (subTab: "applicant" | "kyc" | "ddl") => void;
  onNavigateDocSubTab?: (subTab: "kyc" | "exp" | "other") => void;
  onOpenModal?: (modal: "ddNote" | "deviations" | "approval" | "query" | "reallocate" | "reject" | null) => void;
}

export function TourOverlay({
  isOpen,
  activeRole,
  onClose,
  onNavigateTab,
  onNavigateAppFormSubTab,
  onNavigateDocSubTab,
  onOpenModal,
}: TourOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const steps = useMemo(() => getTourStepsForRole(activeRole), [activeRole]);
  const currentStep: TourStep | undefined = steps[stepIndex];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset step index when role changes or opened
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen, activeRole]);

  // Position and target measurement
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) return;

    // Handle automated navigation if step requires switching tabs
    if (currentStep.tab && onNavigateTab) {
      onNavigateTab(currentStep.tab);
    }
    if (currentStep.appFormSubTab && onNavigateAppFormSubTab) {
      onNavigateAppFormSubTab(currentStep.appFormSubTab);
    }
    if (currentStep.docSubTab && onNavigateDocSubTab) {
      onNavigateDocSubTab(currentStep.docSubTab);
    }

    // Modal triggering
    if (currentStep.openModal && onOpenModal) {
      onOpenModal(currentStep.openModal);
    } else if (onOpenModal) {
      onOpenModal(null);
    }

    // Delay slightly to let tab / subtab / modal transition complete
    const timer = setTimeout(() => {
      let el = document.querySelector(currentStep.target);
      if (!el && currentStep.openModal === "deviations") {
        el =
          document.querySelector('[data-tour="deviations-modal-content"]') ||
          document.querySelector('[data-tour="btn-view-deviations"]');
      }
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 150);
      } else {
        // Center fallback if target not in DOM
        setTargetRect(null);
      }
    }, 160);

    return () => clearTimeout(timer);
  }, [currentStep, onNavigateTab, onNavigateAppFormSubTab, onNavigateDocSubTab, onOpenModal]);

  useEffect(() => {
    if (!isOpen) return;
    const cleanup = updateTargetPosition();
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition, true);
    return () => {
      if (cleanup) cleanup();
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition, true);
    };
  }, [isOpen, stepIndex, currentStep, updateTargetPosition]);

  const handleClose = useCallback(() => {
    if (onOpenModal) onOpenModal(null);
    onClose();
  }, [onClose, onOpenModal]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowRight") {
        if (stepIndex < steps.length - 1) setStepIndex((i) => i + 1);
        else handleClose();
      } else if (e.key === "ArrowLeft") {
        if (stepIndex > 0) setStepIndex((i) => i - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, stepIndex, steps.length, handleClose]);

  if (!mounted || !isOpen || !currentStep) return null;

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;

  // Calculate Popover Position (Expanded 520px max-width)
  const popoverWidth = 520;
  const padding = 20;
  let top = window.innerHeight / 2 - 140;
  let left = window.innerWidth / 2 - popoverWidth / 2;
  let arrowPlacement: "top" | "bottom" | "none" = "none";

  if (targetRect) {
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const preferredPos = currentStep.position || "auto";

    if (preferredPos === "bottom" || (preferredPos === "auto" && spaceBelow >= 260)) {
      top = Math.min(window.innerHeight - 300, targetRect.bottom + 14);
      left = Math.max(
        padding,
        Math.min(
          window.innerWidth - popoverWidth - padding,
          targetRect.left + targetRect.width / 2 - popoverWidth / 2
        )
      );
      arrowPlacement = "top";
    } else if (preferredPos === "top" || (preferredPos === "auto" && spaceAbove >= 260)) {
      top = Math.max(padding, targetRect.top - 280);
      left = Math.max(
        padding,
        Math.min(
          window.innerWidth - popoverWidth - padding,
          targetRect.left + targetRect.width / 2 - popoverWidth / 2
        )
      );
      arrowPlacement = "bottom";
    } else {
      top = Math.max(padding, Math.min(window.innerHeight - 300, targetRect.top));
      left =
        targetRect.right + popoverWidth + padding < window.innerWidth
          ? targetRect.right + 14
          : Math.max(padding, targetRect.left - popoverWidth - 14);
      arrowPlacement = "none";
    }
  }

  const roleMeta: Record<
    TourRole,
    { title: string; badge: string; icon: React.ReactNode; color: string; progressColor: string }
  > = {
    maker: {
      title: "Branch Maker Guide",
      badge: "Maker Workflow",
      icon: <UserCheck className="h-3.5 w-3.5" />,
      color: "bg-blue-600 text-white shadow-blue-500/20",
      progressColor: "bg-blue-600",
    },
    checker: {
      title: "Branch Checker Due Diligence",
      badge: "Checker Verification",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      color: "bg-emerald-600 text-white shadow-emerald-500/20",
      progressColor: "bg-emerald-600",
    },
    approver: {
      title: "Approver Review & Sanction (L3 - L7)",
      badge: "Sanctioning Authority",
      icon: <Award className="h-3.5 w-3.5" />,
      color: "bg-purple-600 text-white shadow-purple-500/20",
      progressColor: "bg-purple-600",
    },
  };

  const currentRole = roleMeta[activeRole] || roleMeta.maker;
  const progressPercent = Math.round(((stepIndex + 1) / steps.length) * 100);

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-auto select-none font-sans">
      {/* SVG Mask Backdrop Cutout */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none transition-all duration-300">
        <defs>
          <mask id="cos-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.72)"
          mask="url(#cos-tour-mask)"
        />
      </svg>

      {/* Pulsing Target Border */}
      {targetRect && (
        <div
          style={{
            position: "fixed",
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
          className="rounded-xl border-2 border-sky-400 ring-4 ring-sky-400/30 pointer-events-none transition-all duration-300 shadow-xl"
        />
      )}

      {/* Popover Card - Expanded & Beautified (No Role Toggle Buttons) */}
      <div
        style={{
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          width: `min(${popoverWidth}px, calc(100vw - 32px))`,
        }}
        className="rounded-2xl border border-slate-200/90 bg-white shadow-2xl p-5 text-slate-800 transition-all duration-200 z-[10000] animate-in fade-in zoom-in-95"
      >
        {/* Pointer Arrow */}
        {arrowPlacement === "top" && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-t border-l border-slate-200/90 rotate-45 shadow-sm" />
        )}
        {arrowPlacement === "bottom" && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-200/90 rotate-45 shadow-sm" />
        )}

        {/* Card Header: Role Badge & Step Count */}
        <div className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full shadow-sm ${currentRole.color}`}
              >
                {currentRole.icon}
                {currentRole.title}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 font-mono">
                Step {stepIndex + 1} of {steps.length}
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-700 transition p-1 rounded-md hover:bg-slate-100 cursor-pointer"
                title="Quit Walkthrough (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${currentRole.progressColor}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Card Body */}
        <div className="py-4 space-y-2.5">
          <h4 className="text-[15px] font-bold text-slate-950 flex items-center gap-2 leading-snug">
            <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
            {currentStep.title}
          </h4>
          <div className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal bg-slate-50/80 p-3.5 rounded-xl border border-slate-150">
            {currentStep.description}
          </div>
        </div>

        {/* Card Footer with Prominent Quit Button */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-900 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Quit Walkthrough completely"
          >
            <X className="h-3.5 w-3.5 text-rose-600" />
            <span>Quit Walkthrough</span>
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLastStep) handleClose();
                else setStepIndex((i) => i + 1);
              }}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold shadow-sm transition cursor-pointer ${
                isLastStep
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isLastStep ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Finish Tour
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
