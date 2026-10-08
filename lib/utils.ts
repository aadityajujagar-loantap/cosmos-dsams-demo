import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProductCommissionRange } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

type CommissionRangeDisplay = Pick<ProductCommissionRange, "commissionAmount" | "max" | "min" | "rate">;

function formatCommissionRateValue(rate: number) {
  return `${Number(rate.toFixed(2)).toString()}%`;
}

export function usesCommissionAmount(range: Pick<ProductCommissionRange, "max" | "min">) {
  return Number(range.max) > Number(range.min);
}

export function commissionDisplayLabel(range: Pick<ProductCommissionRange, "max" | "min">) {
  return usesCommissionAmount(range) ? "Commission Amount" : "Commission Rate";
}

export function formatCommissionDisplay(range: CommissionRangeDisplay) {
  if (usesCommissionAmount(range)) {
    const fallbackAmount = Math.round((Number(range.max) * Number(range.rate || 0)) / 100);
    const amount = Number(range.commissionAmount ?? fallbackAmount);
    return amount > 0 ? formatCurrency(amount) : "-";
  }

  return formatCommissionRateValue(Number(range.rate || 0));
}

export function formatDate(value?: string | number | null) {
  if (!value) return "N/A";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (isoMatch) {
      return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }
    const ddmmyyyyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(trimmed);
    if (ddmmyyyyMatch) {
      return `${ddmmyyyyMatch[1].padStart(2, "0")}/${ddmmyyyyMatch[2].padStart(2, "0")}/${ddmmyyyyMatch[3]}`;
    }
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) return "N/A";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseDobToIso(raw?: string | null): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[\/\-]/);
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return trimmed;
}

export function calculateAgeFromDob(dobString?: string | null): number | undefined {
  if (!dobString) return undefined;
  const iso = parseDobToIso(dobString);
  const parts = iso.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y > 1900) {
      const birthDate = new Date(y, m, d);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 && age < 130 ? age : undefined;
    }
  }
  const parsed = new Date(dobString);
  if (!isNaN(parsed.getTime())) {
    const today = new Date();
    let age = today.getFullYear() - parsed.getFullYear();
    const monthDiff = today.getMonth() - parsed.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
      age--;
    }
    return age >= 0 && age < 130 ? age : undefined;
  }
  return undefined;
}


export function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

export function percent(value: number) {
  return `${Math.round(value)}%`;
}
export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

let lastDsaIdTimestamp = 0;

function padDatePart(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function formatDsaIdDate(date: Date) {
  return [
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
    date.getFullYear(),
  ].join("");
}

function formatDsaIdTime(date: Date) {
  return [
    padDatePart(date.getHours()),
    padDatePart(date.getMinutes()),
  ].join("");
}

export function formatDsaTimestampId(date: Date) {
  return `COSDSA${formatDsaIdDate(date)}${formatDsaIdTime(date)}`;
}

export function seededDsaId(index: number) {
  return formatDsaTimestampId(new Date(2026, 5, 3 - index, 9, 0, 0, index));
}

export function generateDsaId(existingIds: Iterable<string> = []) {
  const reservedIds = new Set(existingIds);
  let timestamp = Math.max(Date.now(), lastDsaIdTimestamp + 60_000);
  let id = "";

  do {
    const date = new Date(timestamp);
    id = formatDsaTimestampId(date);
    timestamp += 60_000;
  } while (reservedIds.has(id));

  lastDsaIdTimestamp = timestamp - 60_000;
  return id;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isCheckerLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const rolesStr = localStorage.getItem("auth_roles");
    const roles: string[] = rolesStr ? JSON.parse(rolesStr) : [];
    const userStr = localStorage.getItem("auth_user");
    const user = userStr ? JSON.parse(userStr) : null;
    const sessionUserStr = localStorage.getItem("cosmos_dsa_user");
    const sessionUser = sessionUserStr ? JSON.parse(sessionUserStr) : null;

    const roleStr = String(user?.role || sessionUser?.role || "").toLowerCase();
    const email = String(user?.email || sessionUser?.email || "").toLowerCase();
    const ticket = String(user?.ticket_no || user?.emp_id || sessionUser?.ticket_no || "").toLowerCase();

    const isCheckerRole =
      roles.some((r) => {
        const lower = String(r).toLowerCase();
        return lower.includes("checker") || lower.includes("sub_region") || lower.includes("subregion");
      }) ||
      roleStr.includes("checker") ||
      roleStr.includes("sub-region") ||
      roleStr.includes("sub region") ||
      ticket.startsWith("chk") ||
      email.includes("checker");

    return isCheckerRole;
  } catch {
    return false;
  }
}

export function formatStatusLabel(status: string, isChecker?: boolean): string {
  if (!status) return "";
  const norm = status.trim().toLowerCase();
  if (norm === "awaiting_agreement_generate") {
    return "Awaiting Agreement Generate";
  }
  const checker = isChecker !== undefined ? isChecker : isCheckerLoggedIn();
  if (checker) {
    if (norm === "verified") {
      return "Checked";
    }
    return status.replace(/\bVerified\b/g, "Checked").replace(/\bverified\b/g, "checked");
  }
  return status;
}
