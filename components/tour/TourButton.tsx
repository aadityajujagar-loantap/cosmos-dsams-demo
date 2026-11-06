"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { TourRole } from "./types";

interface TourButtonProps {
  onStartTour: (role: TourRole) => void;
  defaultRole?: TourRole;
}

export function TourButton({ onStartTour, defaultRole = "maker" }: TourButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onStartTour(defaultRole)}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100 hover:text-blue-900 transition shadow-2xs text-xs font-bold cursor-pointer"
      title="Start Walkthrough Guide for your role"
    >
      <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
      <span>Walkthrough</span>
    </button>
  );
}
