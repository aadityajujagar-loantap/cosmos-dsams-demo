"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Filter,
  History,
  Layers,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
  Unlock,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { Button, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { useDsa } from "@/hooks/useDsa";
import { cn } from "@/lib/utils";
import type { DsaActivityHistory, DsaWorkflowActivity } from "@/types/dsa";

type FilterCategory = "all" | "approvals" | "transfers" | "remarks" | "documents";

interface ActionStyle {
  label: string;
  badge: string;
  iconBg: string;
  iconColor: string;
  cardBorder: string;
  icon: typeof CheckCircle2;
}

/** Visual tone & styling per canonical action */
function getActionStyle(action: string): ActionStyle {
  const a = String(action || "").toUpperCase();

  if (a.includes("REJECT") || a.includes("DEACTIVATED") || a.includes("EXPIRY") || a.includes("FAILED")) {
    return {
      label: actionLabel(action),
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      iconBg: "bg-rose-50 border-rose-200",
      iconColor: "text-rose-600",
      cardBorder: "border-l-rose-500",
      icon: XCircle,
    };
  }

  if (
    a.includes("APPROVE") ||
    a.includes("VERIFIED") ||
    a.includes("ACTIVATED") ||
    a.includes("ACCEPTED") ||
    a.includes("SANCTION") ||
    a.includes("RECOMMEND")
  ) {
    return {
      label: actionLabel(action),
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
      iconBg: "bg-emerald-50 border-emerald-200",
      iconColor: "text-emerald-600",
      cardBorder: "border-l-emerald-500",
      icon: CheckCircle2,
    };
  }

  if (
    a.includes("RELEASE") ||
    a.includes("REVERT") ||
    a.includes("CALL_BACK") ||
    a.includes("REALLOCATED") ||
    a.includes("FORWARD")
  ) {
    return {
      label: actionLabel(action),
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      iconBg: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-600",
      cardBorder: "border-l-amber-500",
      icon: a.includes("RELEASE") ? Unlock : ArrowRightLeft,
    };
  }

  if (
    a.includes("ASSIGNED") ||
    a.includes("ACQUIRED") ||
    a.includes("PROCESSING") ||
    a.includes("LOCKED")
  ) {
    return {
      label: actionLabel(action),
      badge: "border-blue-200 bg-blue-50 text-blue-700",
      iconBg: "bg-blue-50 border-blue-200",
      iconColor: "text-blue-600",
      cardBorder: "border-l-blue-500",
      icon: a.includes("ACQUIRED") || a.includes("LOCKED") ? Lock : UserCheck,
    };
  }

  if (
    a.includes("GENERATED") ||
    a.includes("UPLOADED") ||
    a.includes("EMPANELMENT") ||
    a.includes("AGREEMENT") ||
    a.includes("DOCUMENT")
  ) {
    return {
      label: actionLabel(action),
      badge: "border-purple-200 bg-purple-50 text-purple-700",
      iconBg: "bg-purple-50 border-purple-200",
      iconColor: "text-purple-600",
      cardBorder: "border-l-purple-500",
      icon: FileText,
    };
  }

  return {
    label: actionLabel(action),
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    iconBg: "bg-slate-50 border-slate-200",
    iconColor: "text-slate-600",
    cardBorder: "border-l-slate-400",
    icon: History,
  };
}

function actionLabel(action: string) {
  return String(action || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDateTime(value?: string | number | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDateHeader(value?: string | number | null) {
  if (!value) return "Activity Events";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Activity Events";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const formatted = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (isToday) return `Today · ${formatted}`;
  if (isYesterday) return `Yesterday · ${formatted}`;
  return formatted;
}

function getActorAvatar(actor: string) {
  const clean = String(actor || "System").trim();
  if (clean.toLowerCase() === "system") {
    return {
      initials: "SY",
      bg: "bg-slate-700 text-white",
    };
  }

  const parts = clean.split(" ").filter(Boolean);
  const initials =
    parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : clean.slice(0, 2).toUpperCase();

  const colors = [
    "bg-blue-600 text-white",
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-violet-600 text-white",
    "bg-teal-600 text-white",
    "bg-cyan-700 text-white",
    "bg-slate-800 text-white",
  ];

  let sum = 0;
  for (let i = 0; i < clean.length; i++) sum += clean.charCodeAt(i);
  return {
    initials,
    bg: colors[sum % colors.length],
  };
}

/** Individual Timeline Card for a single audit event */
function ActivityCard({
  activity,
  isLast,
}: {
  activity: DsaWorkflowActivity;
  isLast: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  const actor = activity.actor_name || activity.user_name || "System";
  const role = activity.designation || activity.actor_role || activity.role;
  const stage = activity.stage_name || activity.stage_code;
  const at = activity.timestamp || activity.created_at || activity.activity_at;
  const remarks = activity.remarks || activity.comments;
  const handoff = activity.target_user_name || activity.previous_user_name || null;
  const style = getActionStyle(activity.action);
  const avatar = getActorAvatar(actor);
  const ActionIcon = style.icon;

  const hasStatusChange =
    activity.previous_status &&
    activity.new_status &&
    activity.previous_status !== activity.new_status;

  const hasStageChange =
    activity.previous_stage &&
    activity.new_stage &&
    activity.previous_stage !== activity.new_stage;

  const hasMetadata =
    (activity.metadata && Object.keys(activity.metadata).length > 0) ||
    (activity.context_data && Object.keys(activity.context_data).length > 0);

  return (
    <div className="relative flex items-start gap-4 pb-6 last:pb-2">
      {/* Vertical Spine Line */}
      {!isLast && (
        <span
          className="absolute left-4 top-8 -bottom-1 w-0.5 bg-gradient-to-b from-slate-300 via-slate-200 to-slate-100"
          aria-hidden="true"
        />
      )}

      {/* Node Icon on Timeline */}
      <div
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-xs transition-transform duration-200 hover:scale-110",
          style.iconBg,
        )}
      >
        <ActionIcon className={cn("h-4 w-4", style.iconColor)} />
      </div>

      {/* Main Event Card */}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md",
          "border-l-4",
          style.cardBorder,
        )}
      >
        {/* Card Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            {/* User Avatar */}
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-2xs",
                avatar.bg,
              )}
            >
              {avatar.initials}
            </span>

            {/* Actor Info */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-900">{actor}</span>
              {role ? (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {role}
                </span>
              ) : null}
              {activity.branch_name ? (
                <span className="text-[11px] text-slate-500">
                  · {activity.branch_name}
                </span>
              ) : null}
            </div>
          </div>

          {/* Action Badge & Level Pill */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                style.badge,
              )}
            >
              {style.label}
            </span>

            {activity.approval_level != null && (
              <span className="inline-flex items-center rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                L{activity.approval_level}
              </span>
            )}

            {stage && (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {stage}
              </span>
            )}
          </div>
        </div>

        {/* Remarks / Reviewer Comments (Speech Bubble Quote) */}
        {remarks && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 text-xs text-slate-700 shadow-2xs">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                {remarks}
              </p>
            </div>
          </div>
        )}

        {/* Status Transition & Workflow Routing Handoff */}
        {(hasStatusChange || hasStageChange || handoff) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            {hasStatusChange && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]">
                <span className="font-medium text-slate-500">Status:</span>
                <span className="font-mono text-slate-600">
                  {activity.previous_status}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="font-mono font-semibold text-emerald-700">
                  {activity.new_status}
                </span>
              </div>
            )}

            {hasStageChange && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]">
                <span className="font-medium text-slate-500">Stage:</span>
                <span className="text-slate-600">{activity.previous_stage}</span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
                <span className="font-semibold text-blue-700">
                  {activity.new_stage}
                </span>
              </div>
            )}

            {handoff && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50/70 px-2 py-1 text-[11px] text-sky-800">
                <UserCheck className="h-3.5 w-3.5 text-sky-600" />
                <span className="font-medium">Handoff:</span>
                {activity.previous_user_name ? (
                  <>
                    <span className="font-semibold">{activity.previous_user_name}</span>
                    <ArrowRight className="h-3 w-3 text-sky-400" />
                  </>
                ) : null}
                <span className="font-semibold text-sky-950">
                  {activity.target_user_name ?? "Unassigned"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Card Footer: Timestamp & Metadata Toggle */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          <div className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>{formatDateTime(at)}</span>
          </div>

          {hasMetadata && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {showDetails ? (
                <>
                  Hide payload <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  View context <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Expandable Technical Context / Payload */}
        {showDetails && hasMetadata && (
          <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-900 p-2.5 text-[11px] font-mono text-slate-200 overflow-x-auto">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(activity.metadata || activity.context_data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function DsaCaseActivityTab({ dsaId }: { dsaId: number | string }) {
  const { fetchApprovalHistory, acquireCase, releaseCase } = useDsa();
  const [history, setHistory] = useState<DsaActivityHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"acquire" | "release" | null>(null);
  const [failed, setFailed] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const requestedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchApprovalHistory(dsaId);
    if (data) {
      setHistory(data);
      setFailed(false);
    } else {
      setFailed(true);
    }
    setLoading(false);
  }, [dsaId, fetchApprovalHistory]);

  useEffect(() => {
    if (requestedRef.current === String(dsaId)) return;
    requestedRef.current = String(dsaId);
    void load();
  }, [dsaId, load]);

  const lock = history?.current_assignment ?? null;
  const heldByMe = Boolean(lock?.is_locked_by_current_user);
  const heldByOther = Boolean(lock?.is_locked_by_other_user);

  const rawActivities = useMemo(() => history?.activities ?? [], [history]);

  // Activity counts per category for the filter tabs
  const categoryCounts = useMemo(() => {
    let approvals = 0;
    let transfers = 0;
    let remarks = 0;
    let documents = 0;

    for (const a of rawActivities) {
      const act = String(a.action || "").toUpperCase();
      if (
        act.includes("APPROVE") ||
        act.includes("RECOMMEND") ||
        act.includes("SANCTION") ||
        act.includes("ACTIVATED") ||
        act.includes("REJECT")
      ) {
        approvals++;
      }
      if (
        act.includes("ACQUIRED") ||
        act.includes("RELEASE") ||
        act.includes("ASSIGN") ||
        act.includes("FORWARD") ||
        act.includes("CALL_BACK") ||
        act.includes("REALLOCAT")
      ) {
        transfers++;
      }
      if (a.remarks || a.comments) {
        remarks++;
      }
      if (
        act.includes("DOCUMENT") ||
        act.includes("UPLOAD") ||
        act.includes("GENERAT") ||
        act.includes("AGREEMENT") ||
        act.includes("EMPANELMENT")
      ) {
        documents++;
      }
    }

    return {
      all: rawActivities.length,
      approvals,
      transfers,
      remarks,
      documents,
    };
  }, [rawActivities]);

  // Filter and sort activities
  const filteredActivities = useMemo(() => {
    let list = [...rawActivities];

    // Filter by Category
    if (activeCategory === "approvals") {
      list = list.filter((a) => {
        const act = String(a.action || "").toUpperCase();
        return (
          act.includes("APPROVE") ||
          act.includes("RECOMMEND") ||
          act.includes("SANCTION") ||
          act.includes("ACTIVATED") ||
          act.includes("REJECT")
        );
      });
    } else if (activeCategory === "transfers") {
      list = list.filter((a) => {
        const act = String(a.action || "").toUpperCase();
        return (
          act.includes("ACQUIRED") ||
          act.includes("RELEASE") ||
          act.includes("ASSIGN") ||
          act.includes("FORWARD") ||
          act.includes("CALL_BACK") ||
          act.includes("REALLOCAT")
        );
      });
    } else if (activeCategory === "remarks") {
      list = list.filter((a) => Boolean(a.remarks || a.comments));
    } else if (activeCategory === "documents") {
      list = list.filter((a) => {
        const act = String(a.action || "").toUpperCase();
        return (
          act.includes("DOCUMENT") ||
          act.includes("UPLOAD") ||
          act.includes("GENERAT") ||
          act.includes("AGREEMENT") ||
          act.includes("EMPANELMENT")
        );
      });
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((a) => {
        return (
          (a.actor_name && a.actor_name.toLowerCase().includes(q)) ||
          (a.user_name && a.user_name.toLowerCase().includes(q)) ||
          (a.action && a.action.toLowerCase().includes(q)) ||
          (a.stage_name && a.stage_name.toLowerCase().includes(q)) ||
          (a.stage_code && a.stage_code.toLowerCase().includes(q)) ||
          (a.role && a.role.toLowerCase().includes(q)) ||
          (a.designation && a.designation.toLowerCase().includes(q)) ||
          (a.remarks && a.remarks.toLowerCase().includes(q)) ||
          (a.comments && a.comments.toLowerCase().includes(q)) ||
          (a.branch_name && a.branch_name.toLowerCase().includes(q)) ||
          (a.previous_status && a.previous_status.toLowerCase().includes(q)) ||
          (a.new_status && a.new_status.toLowerCase().includes(q))
        );
      });
    }

    // Sort Order
    list.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at || a.activity_at || 0).getTime();
      const timeB = new Date(b.timestamp || b.created_at || b.activity_at || 0).getTime();
      const diff = timeA - timeB || (a.id ?? 0) - (b.id ?? 0);
      return sortOrder === "desc" ? -diff : diff;
    });

    return list;
  }, [rawActivities, activeCategory, searchQuery, sortOrder]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; items: DsaWorkflowActivity[] }[] = [];
    const map = new Map<string, DsaWorkflowActivity[]>();

    for (const act of filteredActivities) {
      const rawDate = act.timestamp || act.created_at || act.activity_at;
      const dateObj = rawDate ? new Date(rawDate) : null;
      const key =
        dateObj && !isNaN(dateObj.getTime())
          ? dateObj.toISOString().slice(0, 10)
          : "undated";

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(act);
    }

    for (const [key, items] of map.entries()) {
      const label =
        key === "undated"
          ? "Other Events"
          : formatDateHeader(
              items[0]?.timestamp || items[0]?.created_at || items[0]?.activity_at,
            );
      groups.push({ dateKey: key, dateLabel: label, items });
    }

    return groups;
  }, [filteredActivities]);

  const runLockAction = async (kind: "acquire" | "release") => {
    setBusy(kind);
    try {
      if (kind === "acquire") {
        await acquireCase(dsaId);
      } else {
        await releaseCase(dsaId);
      }
    } finally {
      await load();
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── 1. Case Lock & Assignment Bar ───────────────────────────────── */}
      <div
        className={cn(
          "rounded-xl border p-4 transition-all shadow-xs",
          lock?.is_locked
            ? heldByMe
              ? "border-emerald-200 bg-gradient-to-r from-emerald-50/60 via-teal-50/40 to-blue-50/40"
              : "border-amber-200 bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-amber-50/30"
            : "border-slate-200 bg-gradient-to-r from-slate-50/90 to-white",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-2xs",
                lock?.is_locked
                  ? heldByMe
                    ? "border-emerald-200 bg-emerald-100/70 text-emerald-700"
                    : "border-amber-200 bg-amber-100/70 text-amber-700"
                  : "border-slate-200 bg-slate-100 text-slate-600",
              )}
            >
              {lock?.is_locked ? (
                heldByMe ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )
              ) : (
                <Unlock className="h-4 w-4" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {lock?.is_locked
                    ? heldByMe
                      ? "You hold this case"
                      : "Case locked by another user"
                    : "Case is unassigned & open"}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    lock?.is_locked
                      ? heldByMe
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {lock?.is_locked ? "Locked" : "Available"}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-600">
                {lock?.is_locked ? (
                  <>
                    Assigned to{" "}
                    <span className="font-semibold text-slate-800">
                      {lock.assigned_user_name ?? "Unknown user"}
                    </span>
                    {lock.assigned_user_role ? ` (${lock.assigned_user_role})` : ""}
                    {lock.assigned_branch ? ` · ${lock.assigned_branch}` : ""}
                    {lock.assigned_at
                      ? ` · since ${formatDateTime(lock.assigned_at)}`
                      : ""}
                  </>
                ) : (
                  "Available in the eligible queue. Acquire case to lock and begin verification/processing."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={load}
              size="sm"
              type="button"
              variant="outline"
              disabled={loading}
              className="h-8 gap-1.5 text-xs border-slate-200 bg-white"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>

            {heldByMe ? (
              <Button
                onClick={() => runLockAction("release")}
                size="sm"
                type="button"
                variant="outline"
                disabled={busy !== null}
                className="h-8 gap-1.5 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-semibold"
              >
                {busy === "release" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                Release Case
              </Button>
            ) : (
              <Button
                onClick={() => runLockAction("acquire")}
                size="sm"
                type="button"
                disabled={busy !== null || heldByOther}
                className="h-8 gap-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-xs"
              >
                {busy === "acquire" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                Acquire Case
              </Button>
            )}
          </div>
        </div>

        {heldByOther && (
          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              This application is currently locked by another officer. You may
              review the complete audit history, but cannot modify or approve it
              until it is released.
            </span>
          </div>
        )}
      </div>

      {/* ── 2. Audit Trail Main Section ─────────────────────────────────── */}
      <Card className="overflow-hidden border-slate-200/90 shadow-xs">
        <CardContent className="p-5">
          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
                <History className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">
                    Audit Trail & Lifecycle Thread
                  </h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                    {rawActivities.length} {rawActivities.length === 1 ? "Event" : "Events"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Immutable event ledger recorded from{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-700">
                    dsa_workflow_audit_logs
                  </code>
                </p>
              </div>
            </div>

            {/* Quick Sort Toggle Button */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className="h-8 gap-1.5 text-xs border-slate-200 font-medium"
              >
                <ArrowDownUp className="h-3.5 w-3.5 text-slate-500" />
                {sortOrder === "desc" ? "Newest First" : "Oldest First"}
              </Button>
            </div>
          </div>

          {/* Controls: Search & Category Filter Pills */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search actor, action, remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  activeCategory === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                <span>All</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    activeCategory === "all"
                      ? "bg-slate-800 text-slate-200"
                      : "bg-white text-slate-700",
                  )}
                >
                  {categoryCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("approvals")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  activeCategory === "approvals"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                )}
              >
                <span>Decisions & Approvals</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    activeCategory === "approvals"
                      ? "bg-emerald-800 text-emerald-100"
                      : "bg-emerald-200/70 text-emerald-900",
                  )}
                >
                  {categoryCounts.approvals}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("transfers")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  activeCategory === "transfers"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100",
                )}
              >
                <span>Handoffs & Locks</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    activeCategory === "transfers"
                      ? "bg-blue-700 text-blue-100"
                      : "bg-blue-200/70 text-blue-900",
                  )}
                >
                  {categoryCounts.transfers}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("remarks")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  activeCategory === "remarks"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100",
                )}
              >
                <span>With Remarks</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    activeCategory === "remarks"
                      ? "bg-amber-700 text-amber-100"
                      : "bg-amber-200/70 text-amber-900",
                  )}
                >
                  {categoryCounts.remarks}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory("documents")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  activeCategory === "documents"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100",
                )}
              >
                <span>Documents</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    activeCategory === "documents"
                      ? "bg-purple-700 text-purple-100"
                      : "bg-purple-200/70 text-purple-900",
                  )}
                >
                  {categoryCounts.documents}
                </span>
              </button>
            </div>
          </div>

          {/* ── Timeline Thread List ───────────────────────────────────── */}
          <div className="mt-6">
            {loading ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-xs text-slate-500">
                  Loading immutable workflow trail...
                </p>
              </div>
            ) : failed ? (
              <EmptyState
                title="Activity history unavailable"
                description="We could not load the case activity history. Please retry."
                action={
                  <Button onClick={load} size="sm" type="button" variant="outline">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </Button>
                }
              />
            ) : filteredActivities.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Filter className="h-6 w-6" />
                </div>
                <h4 className="mt-3 text-sm font-semibold text-slate-900">
                  No matching audit events found
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  {searchQuery || activeCategory !== "all"
                    ? "Try clearing your search query or selecting a different filter category."
                    : "Actions performed on this application will appear here chronologically."}
                </p>
                {(searchQuery || activeCategory !== "all") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("all");
                    }}
                    className="mt-3 text-xs"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="relative">
                {groupedActivities.map((group) => (
                  <div key={group.dateKey} className="relative mb-6 last:mb-0">
                    {/* Date Section Divider Badge */}
                    <div className="sticky top-0 z-20 mb-4 flex items-center gap-3 bg-white/95 py-1 backdrop-blur-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {group.dateLabel}
                      </span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>

                    {/* Timeline items for this date */}
                    <div className="relative pl-1">
                      {group.items.map((activity, idx) => (
                        <ActivityCard
                          key={activity.id ?? `${activity.action}-${activity.timestamp}-${idx}`}
                          activity={activity}
                          isLast={idx === group.items.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Workflow Steps Table ─────────────────────────────────────── */}
      {history?.approvals?.length ? (
        <Card className="overflow-hidden border-slate-200/90 shadow-xs">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                  <Layers className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Level-by-Level Approval Routing
                  </h4>
                  <p className="text-xs text-slate-500">
                    Hierarchical routing snapshot across approval tiers (L1–L7)
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {history.approvals.length} Tiers
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[36rem] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">Level</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Actioned At</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.approvals.map((step) => {
                    const statusStr = String(step.status || "").toUpperCase();
                    const isApproved =
                      statusStr.includes("APPROV") || statusStr.includes("RECOMMEND");
                    const isRejected = statusStr.includes("REJECT");

                    return (
                      <tr
                        key={step.id}
                        className="transition hover:bg-slate-50/60"
                      >
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            L{step.level ?? "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {step.stage_code || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {step.assigned_role || "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                              isApproved
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : isRejected
                                ? "bg-rose-50 text-rose-800 border border-rose-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200",
                            )}
                          >
                            {isApproved ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            ) : isRejected ? (
                              <XCircle className="h-3 w-3 text-rose-600" />
                            ) : null}
                            {step.status || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {step.actioned_at ? formatDateTime(step.actioned_at) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                          {step.remarks || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
