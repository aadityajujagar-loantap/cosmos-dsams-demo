"use client";

import { X, ChevronDown, Search } from "lucide-react";
import React, {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useState,
  useRef,
  useMemo,
  Children,
  isValidElement,
} from "react";

import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "icon" && "h-9 w-9",
        variant === "primary" && "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
        variant === "secondary" && "bg-slate-100 text-slate-900 hover:bg-slate-200",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
        variant === "outline" && "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-slate-100 p-3", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-3", className)} {...props} />;
}

export function Badge({
  children,
  className,
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: "slate" | "blue" | "green" | "amber" | "rose" | "violet";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium",
        tone === "slate" && "border-slate-200 bg-slate-50 text-slate-700",
        tone === "blue" && "border-blue-200 bg-blue-50 text-blue-700",
        tone === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "amber" && "border-sky-200 bg-sky-50 text-blue-800",
        tone === "rose" && "border-rose-200 bg-rose-50 text-rose-700",
        tone === "violet" && "border-violet-200 bg-violet-50 text-violet-700",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes("active") ||
    normalized.includes("approved") ||
    normalized.includes("verified") ||
    normalized.includes("converted") ||
    normalized.includes("processed") ||
    normalized.includes("read")
      ? "green"
      : normalized.includes("pending") ||
          normalized.includes("progress") ||
          normalized.includes("draft") ||
          normalized.includes("hold") ||
          normalized.includes("submitted")
        ? "amber"
        : normalized.includes("reject") ||
            normalized.includes("failed") ||
            normalized.includes("lost") ||
            normalized.includes("suspend") ||
            normalized.includes("blacklist") ||
            normalized.includes("critical")
          ? "rose"
          : "blue";
  return <Badge tone={tone}>{status}</Badge>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  onChange,
  value,
  disabled,
  name,
  id,
  placeholder,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === "option") {
        const props = child.props as any;
        list.push({
          value: String(props.value ?? ""),
          label: String(props.children ?? props.value ?? ""),
        });
      }
    });
    return list;
  }, [children]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) || options[0];
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(q)
    );
  }, [options, searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelect = (selectedValue: string) => {
    if (onChange) {
      const event = {
        target: {
          value: selectedValue,
          name: name || "",
          id: id || "",
        },
        currentTarget: {
          value: selectedValue,
          name: name || "",
          id: id || "",
        }
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(event);
    }
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <select
        className="sr-only"
        value={value}
        onChange={onChange}
        disabled={disabled}
        name={name}
        id={id}
        tabIndex={-1}
        {...props}
      >
        {children}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 disabled:pointer-events-none disabled:bg-slate-50",
          isOpen && "border-blue-500 ring-2 ring-blue-100"
        )}
      >
        <span className="truncate">{selectedOption?.label || placeholder || "Select..."}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 flex max-h-60 w-full flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="flex items-center border-b border-slate-100 bg-slate-50 px-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 w-full bg-transparent px-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                      isSelected
                        ? "bg-blue-50 font-medium text-blue-700"
                        : "text-slate-700"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2.5 text-center text-xs text-slate-400">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Label({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label className={cn("text-xs font-semibold uppercase tracking-wide text-slate-500", className)} {...props}>
      {children}
    </label>
  );
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}

export function Modal({
  children,
  open,
  title,
  description,
  onClose,
  width = "max-w-2xl",
}: {
  children: ReactNode;
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="fixed -inset-1 z-40 flex items-center justify-center p-5" style={{ outline: 'none' }}>
      <button
        aria-label="Close modal overlay"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
        style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
        type="button"
      />
      <div
        className={cn(
          "relative max-h-[92vh] w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl",
          width,
        )}
        role="dialog"
        aria-modal="true"
        style={{ outline: 'none' }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100" style={{ padding: '20px 24px' }}>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <Button aria-label="Close" onClick={onClose} size="icon" type="button" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[calc(92vh-140px)] overflow-auto" style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  );
}

export function Drawer({
  children,
  open,
  title,
  description,
  onClose,
}: {
  children: ReactNode;
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="fixed -inset-1 z-40" style={{ outline: 'none' }}>
      <button
        aria-label="Close drawer overlay"
        className="absolute inset-0 bg-slate-950/35"
        onClick={onClose}
        style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
        type="button"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl" style={{ outline: 'none' }}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100" style={{ padding: '20px 24px' }}>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <Button aria-label="Close" onClick={onClose} size="icon" type="button" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto" style={{ padding: '24px' }}>{children}</div>
      </aside>
    </div>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid w-full max-w-full auto-cols-[minmax(max-content,1fr)] grid-flow-col gap-[clamp(0.6rem,1.1vw,1rem)] overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => (
        <button
          className={cn(
            "h-8 w-full whitespace-nowrap rounded px-[0.875rem] text-sm font-medium text-slate-600 transition",
            value === tab.value && "bg-white text-slate-950 shadow-sm",
          )}
          key={tab.value}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-100", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <p className="text-base font-semibold text-slate-950">{title}</p>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
