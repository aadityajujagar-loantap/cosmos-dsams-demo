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

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
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
