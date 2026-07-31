"use client";

import { ChevronLeft, ChevronRight, ChevronsUpDown, Download, Search } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

import { Button, EmptyState, Input, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface Column<T> {
  cell: (item: T) => ReactNode;
  exportValue?: (item: T) => string | number | boolean | null | undefined;
  header: string;
  key: string;
  sortValue?: (item: T) => string | number;
  sortable?: boolean;
}

export interface TableFilter {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}

export function DataTable<T extends { id: string }>({
  actions,
  columns,
  emptyAction,
  emptyDescription,
  emptyTitle,
  filters = [],
  items,
  pageSize = 10,
  searchKeys,
}: {
  actions?: (item: T) => ReactNode;
  columns: Column<T>[];
  emptyAction?: ReactNode;
  emptyDescription?: string;
  emptyTitle?: string;
  filters?: TableFilter[];
  items: T[];
  pageSize?: number;
  searchKeys: (keyof T)[];
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ direction: "asc" | "desc"; key: string } | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const searched = normalized
      ? items.filter((item) =>
          searchKeys.some((key) => String(item[key] ?? "").toLowerCase().includes(normalized)),
        )
      : items;

    const sorted = sort
      ? [...searched].sort((left, right) => {
          const column = columns.find((item) => item.key === sort.key);
          const leftValue = column?.sortValue?.(left) ?? "";
          const rightValue = column?.sortValue?.(right) ?? "";
          if (leftValue > rightValue) return sort.direction === "asc" ? 1 : -1;
          if (leftValue < rightValue) return sort.direction === "asc" ? -1 : 1;
          return 0;
        })
      : searched;

    return sorted;
  }, [columns, items, query, searchKeys, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(column: Column<T>) {
    if (!column.sortable) return;
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key: column.key, direction: "asc" },
    );
  }

  function csvCell(value: unknown) {
    if (value === undefined || value === null) return "";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => String(item)).join("; ");
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function escapeCsv(value: unknown) {
    const text = csvCell(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportCsv() {
    if (!filtered.length) return;

    const headers = columns.map((column) => column.header);
    const rows = filtered.map((item) =>
      columns.map((column) => {
        const value = column.exportValue?.(item) ?? (item as Record<string, unknown>)[column.key];
        return escapeCsv(value);
      }),
    );
    const csv = [headers.map(escapeCsv).join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    const baseName = headers[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "records";

    anchor.href = url;
    anchor.download = `dsams-${baseName}-${date}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search records"
            value={query}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <Select
              aria-label={filter.label}
              className="w-44"
              key={filter.label}
              onChange={(event) => {
                filter.onChange(event.target.value);
                setPage(1);
              }}
              value={filter.value}
            >
              <option value="">All {filter.label}</option>
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          ))}
          <Button disabled={!filtered.length} onClick={exportCsv} size="sm" type="button" variant="outline">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          action={emptyAction}
          description={emptyDescription ?? "Change your search or create a new record."}
          title={emptyTitle ?? "No records found"}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th className="px-2.5 py-1.5 font-semibold" key={column.key}>
                      <button
                        className={cn(
                          "inline-flex items-center gap-1",
                          column.sortable && "hover:text-slate-950",
                        )}
                        disabled={!column.sortable}
                        onClick={() => toggleSort(column)}
                        type="button"
                      >
                        {column.header}
                        {column.sortable ? <ChevronsUpDown className="h-3.5 w-3.5" /> : null}
                      </button>
                    </th>
                  ))}
                  {actions ? <th className="px-2.5 py-1.5 text-right font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((item) => (
                  <tr className="hover:bg-slate-50/70" key={item.id}>
                    {columns.map((column) => (
                      <td className="px-2.5 py-1.5 align-middle text-slate-700" key={column.key}>
                        {column.cell(item)}
                      </td>
                    ))}
                    {actions ? <td className="px-2.5 py-1.5 text-right">{actions(item)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {visible.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
          {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <Button
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="min-w-20 text-center">
            {safePage} / {totalPages}
          </span>
          <Button
            disabled={safePage >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            size="sm"
            type="button"
            variant="outline"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
