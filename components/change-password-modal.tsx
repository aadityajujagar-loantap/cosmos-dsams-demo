"use client";

import { useState, useMemo, useEffect } from "react";
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  LogOut,
  X,
} from "lucide-react";
import { authApi } from "@/apis/auth";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useMockStore } from "@/lib/store";
import { authService } from "@/services/authService";
import { cn } from "@/lib/utils";

interface ChangePasswordModalProps {
  open: boolean;
  isForced?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  onSignOut?: () => void;
}

export function ChangePasswordModal({
  open,
  isForced = false,
  onClose,
  onSuccess,
  onSignOut,
}: ChangePasswordModalProps) {
  const { toast } = useToast();
  const { currentUser, setCurrentUser } = useMockStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [open]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isForced && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isForced, onClose]);

  const criteria = useMemo(() => {
    return {
      minLength: newPassword.length >= 8,
      hasLower: /[a-z]/.test(newPassword),
      hasUpper: /[A-Z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      hasSpecial: /[@$!%*#?&]/.test(newPassword),
      matches: newPassword.length > 0 && newPassword === confirmPassword,
      diffFromCurrent:
        currentPassword.length > 0 &&
        newPassword.length > 0 &&
        currentPassword !== newPassword,
    };
  }, [currentPassword, newPassword, confirmPassword]);

  const allCriteriaMet =
    criteria.minLength &&
    criteria.hasLower &&
    criteria.hasUpper &&
    criteria.hasNumber &&
    criteria.hasSpecial &&
    criteria.matches;

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Please enter your current temporary password.");
      return;
    }

    if (!allCriteriaMet) {
      setError("Please ensure new password fulfills all security requirements.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password cannot be identical to the current temporary password.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });

      // Update store and session state
      if (currentUser) {
        const updated = {
          ...currentUser,
          must_change_password: false,
        };
        setCurrentUser(updated);
        try {
          localStorage.setItem("cosmos_dsa_user", JSON.stringify(updated));
          const rawUser = authService.getUser();
          if (rawUser) {
            rawUser.must_change_password = false;
            localStorage.setItem("auth_user", JSON.stringify(rawUser));
          }
        } catch {
          // ignore storage errors
        }
      }

      toast({
        title: "Password Updated",
        description: res.message || "Your password has been changed successfully.",
        variant: "success",
      });

      if (onSuccess) {
        onSuccess();
      }
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to change password. Please verify your current password and try again.";
      setError(msg);
      toast({
        title: "Password Change Failed",
        description: msg,
        variant: "warning",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ outline: "none" }}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity",
          !isForced && "cursor-pointer"
        )}
        onClick={() => {
          if (!isForced && onClose) {
            onClose();
          }
        }}
      />

      {/* Modal Dialog */}
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl z-10"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                isForced
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
              )}
            >
              {isForced ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <KeyRound className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">
                {isForced ? "Set Your New Password" : "Change Password"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isForced
                  ? "First-Time Login: Set a permanent password to secure your account."
                  : "Enter your current password and choose a new secure password."}
              </p>
            </div>
          </div>
          {!isForced && onClose ? (
            <Button
              aria-label="Close"
              onClick={onClose}
              size="icon"
              type="button"
              variant="ghost"
              className="h-8 w-8 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Security Alert if Forced */}
          {isForced ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">Security Requirement</p>
                <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                  You are logging in with a temporary password sent via email. For
                  your security, you must update your password before accessing the
                  partner dashboard.
                </p>
              </div>
            </div>
          ) : null}

          {/* Error Message */}
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <p className="font-medium">{error}</p>
            </div>
          ) : null}

          {/* Current Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Current / Temporary Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showCurrent ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyRound className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyRound className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-10 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Password Criteria Checklist */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Password Requirements
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                {criteria.minLength ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                )}
                <span className={criteria.minLength ? "text-emerald-800 font-medium" : "text-slate-500"}>
                  At least 8 characters
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {criteria.hasUpper && criteria.hasLower ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                )}
                <span
                  className={
                    criteria.hasUpper && criteria.hasLower
                      ? "text-emerald-800 font-medium"
                      : "text-slate-500"
                  }
                >
                  Uppercase & lowercase
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {criteria.hasNumber ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                )}
                <span className={criteria.hasNumber ? "text-emerald-800 font-medium" : "text-slate-500"}>
                  At least 1 digit (0-9)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {criteria.hasSpecial ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                )}
                <span className={criteria.hasSpecial ? "text-emerald-800 font-medium" : "text-slate-500"}>
                  Special symbol (@$!%*#?&)
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:col-span-2">
                {criteria.matches ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                )}
                <span className={criteria.matches ? "text-emerald-800 font-medium" : "text-slate-500"}>
                  Passwords match
                </span>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {isForced && onSignOut ? (
              <Button
                type="button"
                variant="outline"
                onClick={onSignOut}
                disabled={loading}
                className="h-9 gap-1.5 px-3.5 text-xs font-medium text-rose-700 border-rose-200 hover:bg-rose-50 rounded-lg transition"
              >
                <LogOut className="h-3.5 w-3.5 text-rose-600" />
                Sign Out
              </Button>
            ) : !isForced && onClose ? (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="h-9 px-4 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </Button>
            ) : <div />}
            <Button
              type="submit"
              disabled={loading || !currentPassword || !allCriteriaMet}
              className={cn(
                "h-9 px-5 text-xs font-semibold rounded-lg shadow-sm transition",
                isForced
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Updating...</span>
                </div>
              ) : (
                "Update Password"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
