"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu, MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Button, Modal } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { UserAccountModal } from "@/components/user-account-modal";
import { useMockStore } from "@/lib/store";
import { withBasePath } from "@/lib/base-path";
import type { MockStore, Notification } from "@/lib/types";
import { cn, formatDate, initials } from "@/lib/utils";
import { isRoleAllowedOnPortal, portalDeniedMessage } from "@/lib/portal";
import { getUserBranchScopeSync, getCachedBranches } from "@/lib/branch-scope";
import type { BranchOption } from "@/types/dsa";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  items: NavItem[];
  label: string;
}

interface NotificationRow {
  body: string;
  createdAt: string;
  href?: string;
  id: string;
  source: "stored" | "generated";
  title: string;
}

const OVERDUE_ALERT_NOW = new Date("2026-07-30T00:00:00+05:30").getTime();
const READ_NOTIFICATIONS_STORAGE_KEY = "cosmos_dsa_read_notifications";
const subscribeToClient = () => () => {};

function useIsClient() {
  return useSyncExternalStore(subscribeToClient, () => true, () => false);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isSuperAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().replace(/[-_ ]/g, "");
  return normalized === "superadmin" || normalized === "admin";
}

function isPathAllowedForRole(role: string, pathname: string) {
  // Dashboard routes allowed for all authenticated users
  if (pathname === "/" || pathname === "/dashboard") {
    return true;
  }

  // DSA Management page is strictly restricted to Super Admin
  if (pathname === "/dsa/management" || pathname.startsWith("/dsa/management/") || pathname === "/dsa") {
    return isSuperAdminRole(role);
  }

  if (
    role === "Sub-Region Head" ||
    role === "DGM" ||
    role === "Region Head" ||
    role === "Branch Regional Head" ||
    role === "HO Credit Officer" ||
    role === "HO Credit Head" ||
    role === "DSA Credit"
  ) {
    return (
      (pathname.startsWith("/dsa/") &&
        !["/dsa/management", "/dsa/product-setting", "/dsa/onboarding"].some(
          (path) => pathname === path || pathname.startsWith(`${path}/`),
        ))
    );
  }

  // Universal: Internal workflow authorities (L1–L7) can access DSA detail pages (/dsa/[id])
  const isDsaApprovalPage =
    pathname.startsWith("/dsa/") &&
    !["/dsa/onboarding", "/dsa/product-setting", "/dsa/management"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  if (isDsaApprovalPage) return true;

  if (role === "DSA Partner" || role === "DSA Agent") {
    const partnerDsaProfile =
      pathname.startsWith("/dsa/") &&
      !["/dsa/management", "/dsa/product-setting"].some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );

    return (
      partnerDsaProfile ||
      pathname === "/leads" ||
      pathname.startsWith("/leads/") ||
      pathname === "/applications" ||
      pathname.startsWith("/applications/") ||
      pathname === "/sell-now" ||
      pathname === "/finance/invoices" ||
      pathname === "/finance/commissions" ||
      pathname.startsWith("/journey/")
    );
  }

  if (role === "Customer") {
    return (
      pathname === "/applications" ||
      pathname.startsWith("/applications/") ||
      pathname.startsWith("/journey/")
    );
  }

  if (role === "Checker") {
    return (
      (pathname.startsWith("/dsa/") &&
        !["/dsa/management", "/dsa/product-setting", "/dsa/onboarding"].some(
          (path) => pathname === path || pathname.startsWith(`${path}/`),
        )) ||
      pathname === "/leads" ||
      pathname.startsWith("/leads/") ||
      pathname === "/applications" ||
      pathname.startsWith("/applications/") ||
      pathname === "/finance/invoices" ||
      pathname === "/finance/commissions"
    );
  }

  if (role === "Branch User" || role === "Maker") {
    return (
      (pathname.startsWith("/dsa/") &&
        !["/dsa/management", "/dsa/product-setting"].some(
          (path) => pathname === path || pathname.startsWith(`${path}/`),
        )) ||
      pathname === "/leads" ||
      pathname.startsWith("/leads/") ||
      pathname === "/applications" ||
      pathname.startsWith("/applications/") ||
      pathname === "/finance/invoices" ||
      pathname === "/finance/commissions"
    );
  }

  return true;
}

function defaultPathForRole(role: string) {
  return "/dashboard";
}

function canReviewInvoicesRole(role: string) {
  return role === "DSA Manager" || role === "DSA Credit";
}

function roleSafeHref(role: string, href: string) {
  return isPathAllowedForRole(role, href) ? href : defaultPathForRole(role);
}

function inferStoredNotificationHref(notification: Notification, store: MockStore, role: string) {
  const explicitHref = notification.href?.trim();
  if (explicitHref) return roleSafeHref(role, explicitHref);

  const text = `${notification.title} ${notification.body}`.toLowerCase();
  const matchedInvoice = store.dsaInvoices.find((invoice) =>
    text.includes(invoice.invoiceNumber.toLowerCase()),
  );
  if (matchedInvoice) return roleSafeHref(role, "/finance/invoices");

  const matchedApplication = store.applications.find(
    (application) =>
      text.includes(application.applicationId.toLowerCase()) ||
      text.includes(application.id.toLowerCase()),
  );
  if (matchedApplication) return roleSafeHref(role, `/applications/${matchedApplication.id}`);

  const matchedDsa = store.dsas.find(
    (dsa) =>
      text.includes(dsa.name.toLowerCase()) ||
      text.includes(dsa.code.toLowerCase()) ||
      text.includes(dsa.id.toLowerCase()),
  );
  if (matchedDsa) return roleSafeHref(role, `/dsa/${matchedDsa.id}`);

  if (notification.category === "Payout") return roleSafeHref(role, "/finance/invoices");
  if (notification.category === "Risk" || notification.category === "Lead") return roleSafeHref(role, "/applications");
  if (notification.category === "Workflow" && (text.includes("dsa") || text.includes("onboarding"))) {
    return roleSafeHref(role, "/dashboard");
  }
  if (notification.category === "Workflow") return roleSafeHref(role, "/applications");
  return defaultPathForRole(role);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [navOpenGroup, setNavOpenGroup] = useState<string | null>();
  const [readNotificationsVersion, setReadNotificationsVersion] = useState(0);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [flyoutGroup, setFlyoutGroup] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const { store, currentUser, logout, hasPermission } = useMockStore();
  const { toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cosmos_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!flyoutGroup) return;
    const handleClickOutside = () => setFlyoutGroup(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [flyoutGroup]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      setFlyoutGroup(null);
      try {
        localStorage.setItem("cosmos_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    getCachedBranches()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setBranches(list);
      })
      .catch(() => {});
  }, []);

  const branchScope = useMemo(() => {
    return getUserBranchScopeSync(currentUser, branches);
  }, [currentUser, branches]);

  const branchNameDisplay = useMemo(() => {
    const code = branchScope?.primaryBranchCode || currentUser?.code || "";
    const name = branchScope?.primaryBranchName || currentUser?.branchName || "";
    return { name, code };
  }, [branchScope, currentUser]);

  const mounted = useIsClient();

  // Branch portal boundary (web1-agent = DSA only, web2-branch = bank staff only).
  // Runs on mount too, so a stale localStorage session from the other branch cannot
  // keep rendering the wrong portal. logout() clears the token, so the unauthenticated
  // branch below then sends them to /login as well.
  useEffect(() => {
    if (!mounted) return;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (!isRoleAllowedOnPortal(currentUser.role)) {
      // Stale session from the other branch. Surface the reason on /login instead of
      // dropping the user at the sign-in screen with no explanation.
      try {
        sessionStorage.setItem("auth_portal_denied_notice", portalDeniedMessage());
      } catch {
        // Ignore storage errors
      }
      logout();
      router.replace("/login");
      return;
    }

    if (!isPathAllowedForRole(currentUser.role, pathname)) {
      if (pathname === "/dsa/onboarding" || pathname.startsWith("/dsa/onboarding")) {
        toast({
          title: "Access Denied",
          description: "Only Maker can onboard a DSA. Checker is not authorized.",
          variant: "destructive",
        });
      }
      router.replace(defaultPathForRole(currentUser.role));
    }
  }, [currentUser, pathname, router, mounted, logout, toast]);

  const readNotificationIds = useMemo(() => {
    if (readNotificationsVersion < 0) return [];
    if (!mounted || !currentUser || typeof window === "undefined") return [];

    const readScope = encodeURIComponent(`${currentUser.role}:${currentUser.id}:${currentUser.email}:${currentUser.code ?? ""}`);
    const key = `${READ_NOTIFICATIONS_STORAGE_KEY}_${readScope}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }, [currentUser, mounted, readNotificationsVersion]);

  const navGroups = useMemo<NavGroup[]>(() => {
    if (!currentUser) return [];

    if (currentUser.role === "DSA Manager") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [
            ...(isSuperAdminRole(currentUser.role)
              ? [{ href: "/dsa/management", icon: Users, label: "DSA Management" }]
              : []),
            { href: "/dsa/onboarding", icon: UserPlus, label: "Onboard DSA" },
            { href: "/dsa/product-setting", icon: Settings, label: "Product Setting" },
          ],
          label: "Partners",
        },
        {
          items: [
            { href: "/leads", icon: ClipboardCheck, label: "Lead Management" },
            { href: "/applications", icon: ClipboardCheck, label: "Applications" },
          ],
          label: "Applications & Leads",
        },
        {
          items: [{ href: "/sell-now", icon: Send, label: "Sell Now" }],
          label: "Journeys",
        },
        {
          items: [{ href: "/bre/rules", icon: ShieldCheck, label: "BRE Rules" }],
          label: "Rules",
        },
        {
          items: [
            { href: "/finance/invoices", icon: FileText, label: "Invoices" },
            { href: "/finance/commissions", icon: Wallet, label: "Commissions" },
          ],
          label: "Finance",
        },
        {
          items: [{ href: "/analytics/reports", icon: LineChart, label: "Reports" }],
          label: "Analytics",
        },
        ...(currentUser.role === "DSA Manager"
          ? [
              {
                items: [
                  { href: "/administration/users", icon: Users, label: "User Management" },
                  { href: "/administration/roles", icon: ShieldCheck, label: "Roles & Permissions" },
                  { href: "/administration/branch-roles", icon: ShieldCheck, label: "Branch Roles" },
                  { href: "/administration/user-branch-mappings", icon: Users, label: "User Branch Mappings" },
                  { href: "/administration/master-values", icon: Settings, label: "Master Values" },
                ],
                label: "Administration",
              },
              {
                items: [
                  { href: "/administration/location-hierarchy", icon: MapPin, label: "Location Hierarchy" },
                  { href: "/administration/audit-logs", icon: FileText, label: "Audit Logs" },
                  ...(hasPermission("maker_requests.view")
                    ? [{ href: "/administration/maker-requests", icon: ClipboardCheck, label: "Maker Requests" }]
                    : []),
                ],
                label: "System Operations",
              },
            ]
          : []),
        {
          items: [{ href: "/administration/master-values", icon: Settings, label: "Master Values" }],
          label: "Master Values",
        },
      ];
    } else if (
      currentUser.role === "Sub-Region Head" ||
      currentUser.role === "DGM" ||
      currentUser.role === "Region Head" ||
      currentUser.role === "Branch Regional Head" ||
      currentUser.role === "HO Credit Officer" ||
      currentUser.role === "HO Credit Head" ||
      currentUser.role === "DSA Credit"
    ) {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
      ];
    } else if (currentUser.role === "Checker") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [{ href: "/applications", icon: ClipboardCheck, label: "Applications & Leads" }],
          label: "Sourcing",
        },
        {
          items: [
            { href: "/finance/invoices", icon: FileText, label: "Invoices" },
            { href: "/finance/commissions", icon: Wallet, label: "Commissions" },
          ],
          label: "Finance",
        },
      ];
    } else if (currentUser.role === "Branch User" || currentUser.role === "Maker") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [
            { href: "/dsa/onboarding", icon: UserPlus, label: "Onboard DSA" },
          ],
          label: "Branch Initiator",
        },
        {
          items: [{ href: "/applications", icon: ClipboardCheck, label: "Applications & Leads" }],
          label: "Sourcing",
        },
        {
          items: [
            { href: "/finance/invoices", icon: FileText, label: "Invoices" },
            { href: "/finance/commissions", icon: Wallet, label: "Commissions" },
          ],
          label: "Finance",
        },
      ];
    } else if (currentUser.role === "DSA Partner") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [
            { href: "/leads", icon: ClipboardCheck, label: "Lead Management" },
            { href: "/applications", icon: ClipboardCheck, label: "Applications" },
          ],
          label: "Applications & Leads",
        },
        {
          items: [{ href: "/sell-now", icon: Send, label: "Sell Now" }],
          label: "Journeys",
        },
        {
          items: [
            { href: "/finance/invoices", icon: FileText, label: "Raise Invoices" },
            { href: "/finance/commissions", icon: Wallet, label: "My Commissions" },
          ],
          label: "Finance",
        },
      ];
    } else if (currentUser.role === "DSA Agent") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [{ href: "/applications", icon: ClipboardCheck, label: "Sourced Applications" }],
          label: "Applications",
        },
        {
          items: [{ href: "/sell-now", icon: Send, label: "Lead Sourcing" }],
          label: "Journeys",
        },
      ];
    } else {
      // Customer
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "My Status" }],
          label: "Overview",
        },
        {
          items: [{ href: "/applications", icon: ClipboardCheck, label: "My Applications" }],
          label: "Loan Journey",
        },
      ];
    }
  }, [currentUser]);

  const notificationRows = useMemo(() => {
    if (!currentUser) return [];

    const now = OVERDUE_ALERT_NOW;
    const readIds = new Set(readNotificationIds);
    const stale = (date: string) => {
      const parsed = new Date(date).getTime();
      return Number.isFinite(parsed) && now - parsed >= 4 * 24 * 60 * 60 * 1000;
    };
    const rows: NotificationRow[] = store.notifications
      .filter((item) => item.status === "Unread" && !readIds.has(item.id))
      .map((item) => ({
        body: item.body,
        createdAt: item.createdAt,
        href: inferStoredNotificationHref(item, store, currentUser.role),
        id: item.id,
        source: "stored",
        title: item.title,
      }));
    const addGeneratedAlert = (item: Omit<NotificationRow, "source">) => {
      if (readIds.has(item.id)) return;
      rows.push({
        ...item,
        href: item.href ?? defaultPathForRole(currentUser.role),
        source: "generated",
      });
    };

    const canSeeInternal = [
      "DSA Manager",
      "DSA Credit",
      "Branch User",
      "Branch Regional Head",
      "Checker",
      "Sub-Region Head",
      "DGM",
      "Region Head",
      "HO Credit Officer",
      "HO Credit Head",
    ].includes(currentUser.role);
    store.dsas.forEach((dsa) => {
      const ownsDsa = currentUser.role === "DSA Partner" && currentUser.id === dsa.id;
      if ((canSeeInternal || ownsDsa) && !["Active", "Rejected", "Blacklisted"].includes(dsa.status) && stale(dsa.onboardingDate)) {
        addGeneratedAlert({
          body: `${dsa.name} has had no onboarding action since ${formatDate(dsa.onboardingDate)}.`,
          createdAt: dsa.onboardingDate,
          href: `/dsa/${dsa.id}`,
          id: `stale-dsa-${dsa.id}`,
          title: "DSA onboarding action overdue",
        });
      }
    });

    store.applications.forEach((application) => {
      const ownerVisible =
        currentUser.role === "DSA Partner"
          ? application.dsaId === currentUser.id
          : currentUser.role === "Customer"
            ? application.customer === currentUser.name
            : canSeeInternal;
      const latest = application.timeline[0]?.at ?? application.createdAt;
      if (ownerVisible && !["Approved", "Rejected", "Disbursed"].includes(application.status) && stale(latest)) {
        addGeneratedAlert({
          body: `${application.applicationId} is still ${application.status} at ${application.stage}.`,
          createdAt: latest,
          href: `/applications/${application.id}`,
          id: `stale-app-${application.id}`,
          title: "Application TAT breached",
        });
      }
    });

    store.documents.forEach((document) => {
      const application = document.applicationId ? store.applications.find((item) => item.id === document.applicationId || item.applicationId === document.applicationId) : undefined;
      const dsa = document.dsaId ? store.dsas.find((item) => item.id === document.dsaId) : undefined;
      const ownerVisible = application
        ? currentUser.role === "DSA Partner"
          ? application.dsaId === currentUser.id
          : currentUser.role === "Customer"
            ? application.customer === currentUser.name
            : canSeeInternal
        : canSeeInternal;
      if (ownerVisible && document.status !== "Verified" && stale(document.uploadedAt)) {
        addGeneratedAlert({
          body: `${document.fileName} is still ${document.status}.`,
          createdAt: document.uploadedAt,
          href: application ? `/applications/${application.id}` : dsa ? `/dsa/${dsa.id}` : "/applications",
          id: `stale-doc-${document.id}`,
          title: "Document checking overdue",
        });
      }
    });

    store.approvals.forEach((approval) => {
      const application = store.applications.find((item) => item.applicationId === approval.applicationId);
      if (canSeeInternal && approval.status === "Pending" && stale(approval.updatedAt)) {
        addGeneratedAlert({
          body: `${approval.workflowId} is pending at ${approval.stage}.`,
          createdAt: approval.updatedAt,
          href: application ? `/applications/${application.id}` : "/applications",
          id: `stale-approval-${approval.id}`,
          title: "Approval workflow overdue",
        });
      }
    });

    store.leads.forEach((lead) => {
      const ownerVisible =
        currentUser.role === "DSA Partner" ? lead.dsaId === currentUser.id : currentUser.role === "Customer" ? lead.customer === currentUser.name : canSeeInternal;
      if (ownerVisible && !["Converted", "Lost"].includes(lead.status) && stale(lead.createdAt)) {
        addGeneratedAlert({
          body: `${lead.leadId} needs follow-up: ${lead.nextAction}.`,
          createdAt: lead.createdAt,
          href: "/applications",
          id: `stale-lead-${lead.id}`,
          title: "Lead follow-up overdue",
        });
      }
    });

    store.dsaInvoices.forEach((invoice) => {
      const ownerVisible = currentUser.role === "DSA Partner" ? invoice.dsaId === currentUser.id : canReviewInvoicesRole(currentUser.role);
      if (ownerVisible && !["Approved", "Rejected"].includes(invoice.status) && stale(invoice.updatedAt)) {
        addGeneratedAlert({
          body: `${invoice.invoiceNumber} is ${invoice.status} since ${formatDate(invoice.updatedAt)}.`,
          createdAt: invoice.updatedAt,
          href: "/finance/invoices",
          id: `stale-invoice-${invoice.id}`,
          title: "Invoice action overdue",
        });
      }
    });

    return rows.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [currentUser, readNotificationIds, store.applications, store.approvals, store.documents, store.dsas, store.dsaInvoices, store.leads, store.notifications]);

  function markNotificationIdsRead(ids: string[]) {
    if (!ids.length) return;
    if (!currentUser || typeof window === "undefined") return;
    const readScope = encodeURIComponent(`${currentUser.role}:${currentUser.id}:${currentUser.email}:${currentUser.code ?? ""}`);
    const key = `${READ_NOTIFICATIONS_STORAGE_KEY}_${readScope}`;
    const stored = localStorage.getItem(key);
    let current: string[] = [];
    try {
      const parsed = stored ? JSON.parse(stored) : [];
      current = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      current = [];
    }
    const next = Array.from(new Set([...current, ...ids])).slice(-500);
    localStorage.setItem(key, JSON.stringify(next));
    setReadNotificationsVersion((version) => version + 1);
  }

  function markNotificationRead(item: NotificationRow) {
    markNotificationIdsRead([item.id]);
  }

  function markAllNotificationsRead() {
    markNotificationIdsRead(notificationRows.map((item) => item.id));
  }

  if (!mounted || !currentUser) return null;

  function renderNavigation(collapsed: boolean) {
    if (collapsed) {
      return (
        <nav className="scrollbar-subtle flex flex-1 flex-col items-center gap-2 overflow-y-auto px-2 py-3">
          {navGroups.map((group) => {
            const hasDropdown = group.items.length > 1;
            const groupActive = group.items.some((item) => isActive(pathname, item.href));

            if (!hasDropdown) {
              const item = group.items[0];
              const Icon = item.icon;
              const active = isActive(pathname, item.href);

              return (
                <div key={group.label} className="relative flex justify-center">
                  <Link
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                      active && "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
                    )}
                    href={item.href}
                    title={item.label}
                    onClick={() => {
                      setMobileOpen(false);
                      setNavOpenGroup(null);
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </Link>
                </div>
              );
            }

            const GroupIcon = group.items[0].icon;

            return (
              <div key={group.label} className="relative flex justify-center">
                <button
                  aria-label={group.label}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                    groupActive && "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
                    flyoutGroup === group.label && "bg-slate-100 text-slate-950 ring-2 ring-blue-500",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setFlyoutPos({ top: rect.top, left: rect.right + 8 });
                    setFlyoutGroup((current) => (current === group.label ? null : group.label));
                  }}
                  title={group.label}
                  type="button"
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                </button>
              </div>
            );
          })}
        </nav>
      );
    }

    return (
      <nav className="scrollbar-subtle flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-3">
        {navGroups.map((group) => {
          const hasDropdown = group.items.length > 1;
          const groupActive = group.items.some((item) => isActive(pathname, item.href));
          const groupOpen = navOpenGroup === undefined ? groupActive : navOpenGroup === group.label;

          if (!hasDropdown) {
            const item = group.items[0];
            const Icon = item.icon;
            const active = isActive(pathname, item.href);

            return (
              <div key={group.label}>
                <Link
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium leading-5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                    active && "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
                  )}
                  href={item.href}
                  onClick={() => {
                    setMobileOpen(false);
                    setNavOpenGroup(null);
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-sm font-medium leading-5">{item.label}</span>
                </Link>
              </div>
            );
          }

          const GroupIcon = group.items[0].icon;

          return (
            <div key={group.label}>
              <button
                aria-expanded={groupOpen}
                className={cn(
                  "group flex h-9 w-full items-center justify-between gap-2.5 rounded-md px-2.5 text-left text-sm font-medium leading-5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                  groupOpen && "bg-slate-50 ring-1 ring-slate-100",
                )}
                onClick={() =>
                  setNavOpenGroup((current) => {
                    const resolved = current === undefined && groupActive ? group.label : current;
                    return resolved === group.label ? null : group.label;
                  })
                }
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate text-sm font-medium leading-5">{group.label}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-600",
                    groupOpen && "rotate-180",
                  )}
                />
              </button>
              <div
                className={cn(
                  "grid transition-all duration-200 ease-out",
                  hasDropdown && !groupOpen ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className={cn("space-y-0.5", hasDropdown && "pt-0.5")}>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item.href);
                      return (
                        <Link
                          className={cn(
                            "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium leading-5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                            hasDropdown && "ml-1.5 border-l border-slate-100 pl-3",
                            active && "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
                          )}
                          href={item.href}
                          key={item.href}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-sm font-medium leading-5">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 hidden h-screen border-r border-slate-200 bg-white lg:flex lg:flex-col transition-all duration-300 ease-in-out",
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-slate-100 shrink-0",
            isCollapsed ? "justify-center px-2" : "px-4",
          )}
        >
          {isCollapsed ? null : (
            <Image
              alt="Cosmos Bank"
              className="h-9 w-auto max-w-[230px]"
              height={40}
              priority
              src={withBasePath("/logo-dsasm-cosmos.png")}
              unoptimized
              width={220}
            />
          )}
        </div>
        {renderNavigation(isCollapsed)}
        {/* Collapse Option at bottom left */}
        <div className={cn("border-t border-slate-200 shrink-0", isCollapsed ? "p-2 flex flex-col items-center" : "p-2.5")}>
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "group flex items-center rounded-lg border border-slate-200/80 bg-slate-50/70 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300",
              isCollapsed
                ? "h-10 w-10 justify-center"
                : "w-full justify-between gap-2 px-3 py-2 text-xs font-semibold",
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4 text-slate-500 group-hover:text-slate-800 transition-colors" />
            ) : (
              <>
                <span className="flex items-center gap-2">
                  <PanelLeftClose className="h-4 w-4 text-slate-500 group-hover:text-slate-800 transition-colors" />
                  <span>Collapse</span>
                </span>
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </>
            )}
          </button>
          {!isCollapsed && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 select-none">
              <span>DSA - CRM © powered by</span>
              <Image
                alt="iFlow"
                className="h-4 w-auto object-contain shrink-0"
                height={14}
                src={withBasePath("/image.png")}
                unoptimized
                width={41}
              />
            </div>
          )}
        </div>
      </aside>

      {/* Flyout menu for collapsed grouped nav items */}
      {isCollapsed && flyoutGroup && flyoutPos && (
        <div
          className="fixed z-50 min-w-[13rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
          style={{ top: `${flyoutPos.top}px`, left: `${flyoutPos.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {flyoutGroup}
          </div>
          <div className="mt-1 space-y-0.5">
            {navGroups
              .find((g) => g.label === flyoutGroup)
              ?.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setFlyoutGroup(null);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950",
                      active && "bg-blue-50 text-blue-700 font-semibold ring-1 ring-blue-100",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-300 ease-in-out",
          isCollapsed ? "lg:pl-16" : "lg:pl-64",
        )}
      >
        {/* Top Header across all pages & all roles */}
        <header className="relative sticky top-0 z-20 flex min-h-[4.25rem] items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              aria-label="Open navigation"
              className="mr-2 shrink-0 lg:hidden"
              onClick={() => setMobileOpen(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 bg-slate-50/80 px-2 py-1 shadow-2xs">
              <span className="text-sm font-semibold tracking-tight text-slate-900 leading-none">
                {branchNameDisplay.name}
                {branchNameDisplay.code ? ` (${branchNameDisplay.code})` : ""}
              </span>
            </div>
          </div>

          {/* Centered logo on top bar when sidebar is collapsed */}
          {isCollapsed && (
            <div className="pointer-events-none hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <Image
                alt="Cosmos Bank"
                className="h-9 w-auto max-w-[230px]"
                height={40}
                priority
                src={withBasePath("/logo-dsasm-cosmos.png")}
                unoptimized
                width={220}
              />
            </div>
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              aria-label="Open notifications"
              title={`Notifications (${notificationRows.length ? `${notificationRows.length} new` : "All read"})`}
              className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 shadow-2xs"
            >
              <Bell className="h-4 w-4 transition-transform group-hover:scale-105" />
              {notificationRows.length ? (
                <span className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs">
                  {notificationRows.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              aria-label="User account menu"
              className="group flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white p-1 pr-2.5 transition hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-900 text-xs font-bold text-white shadow-xs">
                {initials(currentUser.name)}
              </span>
              <span className="hidden sm:inline-block max-w-[120px] truncate text-xs font-semibold text-slate-800">
                {currentUser.name}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </button>
          </div>
        </header>
        <main className="compact-dashboard flex flex-1 flex-col w-full px-3 py-3 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4">{children}</main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[86vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center border-b border-slate-100 px-4 shrink-0">
              <Image
                alt="Cosmos Bank"
                className="h-10 w-auto max-w-[210px]"
                height={40}
                priority
                src={withBasePath("/logo-dsasm-cosmos.png")}
                unoptimized
                width={210}
              />
            </div>
            {renderNavigation(false)}
            <div className="border-t border-slate-200 p-3 shrink-0 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setNotificationsOpen(true);
                }}
                aria-label="Open notifications"
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white p-2 text-left transition hover:bg-slate-50 hover:border-slate-300"
              >
                <div className="flex items-center gap-2.5">
                  <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700 transition group-hover:bg-slate-200">
                    <Bell className="h-4 w-4" />
                    {notificationRows.length ? (
                      <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                        {notificationRows.length}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">Notifications</span>
                </div>
                {notificationRows.length ? (
                  <span className="text-[11px] font-semibold text-rose-600">
                    {notificationRows.length} new
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">All read</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setProfileOpen(true);
                }}
                className="group flex w-full items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 p-2 text-left transition hover:bg-slate-100 hover:border-slate-300"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-900 text-xs font-bold text-white shadow-xs">
                  {initials(currentUser.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-900 leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="block truncate text-[11px] font-medium text-slate-500">
                    {currentUser.role}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <Modal
        description=""
        onClose={() => setNotificationsOpen(false)}
        open={notificationsOpen}
        title="Notification alerts"
        width="max-w-3xl"
      >
        <div className="space-y-3">
          {notificationRows.length ? (
            <>
              <div className="flex flex-col gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{notificationRows.length} active alert{notificationRows.length === 1 ? "" : "s"}</p>
                  <p className="text-xs text-slate-500">Mark alerts as read once they no longer need attention.</p>
                </div>
                <Button onClick={markAllNotificationsRead} size="sm" type="button" variant="outline">
                  Mark all as read
                </Button>
              </div>
              {notificationRows.map((item) => (
                <div className="rounded-md border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/40" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-xs font-medium text-slate-400">{formatDate(item.createdAt)}</span>
                      <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-100">
                        {item.source === "stored" ? "Unread" : "Overdue"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {item.href ? (
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 transition hover:bg-slate-50"
                        href={item.href}
                        onClick={() => setNotificationsOpen(false)}
                      >
                        View
                      </Link>
                    ) : null}
                    <Button onClick={() => markNotificationRead(item)} size="sm" type="button" variant="secondary">
                      Mark as read
                    </Button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">No unread or overdue workflow alerts.</p>
          )}
        </div>
      </Modal>
      <UserAccountModal
        fallbackUser={currentUser}
        onClose={() => setProfileOpen(false)}
        onSignOut={async () => {
          setProfileOpen(false);
          await logout();
          router.push("/login");
        }}
        open={profileOpen}
      />
    </div>
  );
}


