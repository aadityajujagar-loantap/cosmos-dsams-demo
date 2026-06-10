"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { cn, makeId } from "@/lib/utils";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "success" | "info" | "warning";
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((nextToast: Omit<Toast, "id">) => {
    const id = makeId("toast");
    setToasts((current) => [...current, { id, ...nextToast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((item) => (
          <div
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-4 text-sm shadow-xl shadow-slate-900/10",
              item.variant === "warning" && "border-sky-200 bg-sky-50",
              item.variant === "success" && "border-emerald-200 bg-emerald-50",
            )}
            key={item.id}
            role="status"
          >
            {item.variant === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-950">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-slate-600">{item.description}</p>
              ) : null}
            </div>
            <button
              aria-label="Dismiss notification"
              className="rounded-md p-1 text-slate-400 hover:bg-white/70 hover:text-slate-700"
              onClick={() =>
                setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))
              }
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
