"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
} from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string; // Accepts ISO "YYYY-MM-DD" or "DD/MM/YYYY"
  onChange?: (event: React.ChangeEvent<HTMLInputElement> | { target: { value: string; name?: string; id?: string } }) => void;
  placeholder?: string;
  min?: string; // ISO "YYYY-MM-DD"
  max?: string; // ISO "YYYY-MM-DD"
  disabled?: boolean;
  required?: boolean;
  className?: string;
  displayFormat?: "DD/MM/YYYY" | "YYYY-MM-DD";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const dateOnly = iso.trim().split("T")[0];
  const parts = dateOnly.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(iso.trim())) {
    const [d, m, y] = iso.trim().split("/");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return iso;
}

function displayToIso(display: string): string | null {
  if (!display) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(display.trim());
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const maxDays = new Date(year, month, 0).getDate();
  if (day > maxDays) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(function DatePicker(
  {
    id,
    name,
    value = "",
    onChange,
    placeholder = "DD/MM/YYYY",
    min,
    max,
    disabled = false,
    required = false,
    className,
    displayFormat = "DD/MM/YYYY",
  },
  ref
) {
  // Normalize value to ISO YYYY-MM-DD
  const isoValue = useMemo(() => {
    if (!value) return "";
    if (value.includes("/")) {
      return displayToIso(value) || "";
    }
    return value;
  }, [value]);

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState(() => isoToDisplay(isoValue));

  // Sync displayed text whenever incoming value changes
  useEffect(() => {
    setInputText(isoToDisplay(isoValue));
  }, [isoValue]);

  // Calendar view year and month
  const today = new Date();
  const initialDate = useMemo(() => {
    if (isoValue) {
      const parsed = new Date(isoValue);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (max) {
      const maxDate = new Date(max);
      if (!isNaN(maxDate.getTime()) && maxDate.getTime() < today.getTime()) {
        return maxDate;
      }
    }
    return today;
  }, [isoValue, max]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // When calendar opens, reset view to selected date or fallback
  useEffect(() => {
    if (isOpen) {
      if (isoValue) {
        const d = new Date(isoValue);
        if (!isNaN(d.getTime())) {
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
          return;
        }
      }
      if (max) {
        const maxD = new Date(max);
        if (!isNaN(maxD.getTime()) && maxD.getTime() < today.getTime()) {
          setViewYear(maxD.getFullYear());
          setViewMonth(maxD.getMonth());
          return;
        }
      }
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
    }
  }, [isOpen, isoValue, max]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const emitChange = (newIso: string) => {
    if (onChange) {
      const event = {
        target: {
          value: newIso,
          name: name || "",
          id: id || "",
        },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  // Direct typing handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d/]/g, "");

    // Auto-insert slashes
    if (raw.length === 2 && !raw.includes("/") && inputText.length < raw.length) {
      raw = raw + "/";
    } else if (raw.length === 5 && raw.split("/").length === 2 && inputText.length < raw.length) {
      raw = raw + "/";
    }

    if (raw.length > 10) raw = raw.slice(0, 10);
    setInputText(raw);

    const parsedIso = displayToIso(raw);
    if (parsedIso) {
      if (min && parsedIso < min) return;
      if (max && parsedIso > max) return;
      emitChange(parsedIso);
    } else if (raw === "") {
      emitChange("");
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputText("");
    emitChange("");
  };

  // Year range options
  const minYear = min ? parseInt(min.split("-")[0], 10) : 1920;
  const maxYear = max ? parseInt(max.split("-")[0], 10) : today.getFullYear() + 20;
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  // Navigate months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Calendar days calculation
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: { day: number; dateStr: string; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: 0, dateStr: "", isCurrentMonth: false, isDisabled: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      let isDisabled = false;
      if (min && dateStr < min) isDisabled = true;
      if (max && dateStr > max) isDisabled = true;

      cells.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        isDisabled,
      });
    }

    return cells;
  }, [viewYear, viewMonth, min, max]);

  const handleSelectDate = (dateStr: string) => {
    setInputText(isoToDisplay(dateStr));
    emitChange(dateStr);
    setIsOpen(false);
  };

  const handleTodayClick = () => {
    const todayIso = today.toISOString().slice(0, 10);
    if (min && todayIso < min) return;
    if (max && todayIso > max) return;
    handleSelectDate(todayIso);
  };

  const todayIso = today.toISOString().slice(0, 10);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {/* Hidden real input for standard form serialization */}
      <input
        type="hidden"
        name={name}
        value={isoValue}
        required={required}
      />

      <div className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          value={inputText}
          onChange={handleInputChange}
          onClick={() => {
            if (!disabled) setIsOpen(true);
          }}
          className={cn(
            "h-9 w-full rounded-md border border-slate-200 bg-white pl-3 pr-16 text-sm text-slate-950 font-mono outline-none transition placeholder:text-slate-400 placeholder:font-sans focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 disabled:pointer-events-none disabled:bg-slate-50",
            isOpen && "border-blue-500 ring-2 ring-blue-100"
          )}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {inputText && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
              title="Clear date"
              tabIndex={-1}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-slate-500 hover:text-blue-600 rounded transition disabled:opacity-50"
            title="Open calendar"
            tabIndex={-1}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Floating Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1.5 w-72 sm:w-80 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl animate-in fade-in slide-in-from-top-1 select-none">
          {/* Header with Month / Year selectors and Nav buttons */}
          <div className="flex items-center justify-between gap-1 pb-2.5 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-md transition"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-md transition"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center">
            {WEEKDAY_NAMES.map((w) => (
              <span key={w} className="text-[11px] font-semibold text-slate-400">
                {w}
              </span>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return <div key={`empty-${idx}`} className="h-8 w-8" />;
              }

              const isSelected = isoValue === cell.dateStr;
              const isToday = todayIso === cell.dateStr;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  disabled={cell.isDisabled}
                  onClick={() => handleSelectDate(cell.dateStr)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition mx-auto",
                    isSelected
                      ? "bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700"
                      : isToday
                      ? "border border-blue-400 text-blue-700 font-semibold hover:bg-blue-50"
                      : "text-slate-700 hover:bg-slate-100",
                    cell.isDisabled && "opacity-25 cursor-not-allowed pointer-events-none"
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Bottom actions */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
            <button
              type="button"
              onClick={handleTodayClick}
              disabled={Boolean((max && todayIso > max) || (min && todayIso < min))}
              className="font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:pointer-events-none"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-medium text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
