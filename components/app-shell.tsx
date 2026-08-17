"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu, MapPin,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Button, Input, Modal } from "@/components/ui/primitives";
import { UserAccountModal } from "@/components/user-account-modal";
import { useMockStore } from "@/lib/store";
import type { MockStore, Notification } from "@/lib/types";
import { cn, formatDate, initials } from "@/lib/utils";

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

function isPathAllowedForRole(role: string, pathname: string) {
  if (role === "Branch Regional Head") {
    const brhDsaProfile =
      pathname.startsWith("/dsa/") &&
      !["/dsa/management", "/dsa/onboarding", "/dsa/product-setting"].some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );

    return pathname === "/dsa/management" || brhDsaProfile;
  }

  if (role === "DSA Partner") {
    const partnerDsaProfile =
      pathname.startsWith("/dsa/") &&
      !["/dsa/management", "/dsa/onboarding", "/dsa/product-setting"].some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      );

    return (
      pathname === "/" ||
      pathname === "/dsa/management" ||
      partnerDsaProfile ||
      pathname === "/applications" ||
      pathname.startsWith("/applications/") ||
      pathname === "/sell-now" ||
      pathname === "/finance/invoices" ||
      pathname === "/finance/commissions" ||
      pathname.startsWith("/journey/")
    );
  }

  if (role !== "Branch User") return true;

  const branchDsaProfile =
    pathname.startsWith("/dsa/") &&
    !["/dsa/management", "/dsa/onboarding", "/dsa/product-setting"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  return pathname === "/" || pathname === "/dsa/management" || pathname === "/dsa/onboarding" || branchDsaProfile;
}

function defaultPathForRole(role: string) {
  if (role === "Branch Regional Head") return "/dsa/management";
  return "/";
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
    return roleSafeHref(role, "/dsa/management");
  }
  if (notification.category === "Workflow") return roleSafeHref(role, "/applications");
  return defaultPathForRole(role);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [globalQuery, setGlobalQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [navOpenGroup, setNavOpenGroup] = useState<string | null>();
  const [readNotificationsVersion, setReadNotificationsVersion] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const { store, currentUser, logout, hasPermission } = useMockStore();

  const mounted = useIsClient();

  useEffect(() => {
    if (mounted && !currentUser) {
      router.push("/login");
    }
    if (mounted && currentUser && !isPathAllowedForRole(currentUser.role, pathname)) {
      router.replace(defaultPathForRole(currentUser.role));
    }
  }, [currentUser, pathname, router, mounted]);

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

    if (currentUser.role === "DSA Manager" || currentUser.role === "DSA Credit") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [
            ...(currentUser.role === "DSA Manager" || currentUser.role === "DSA Credit"
              ? [{ href: "/dsa/onboarding", icon: Building2, label: "Onboard DSA" }]
              : []),
            { href: "/dsa/management", icon: Users, label: "DSA Management" },
            { href: "/dsa/product-setting", icon: Settings, label: "Product Setting" },
          ],
          label: "Partners",
        },
        {
          items: [{ href: "/applications", icon: ClipboardCheck, label: "Applications" }],
          label: "Applications",
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
                  { href: "/administration/location-hierarchy", icon: MapPin, label: "Location Hierarchy" },
                  { href: "/administration/audit-logs", icon: FileText, label: "Audit Logs" },
                  ...(hasPermission("maker_requests.view")
                    ? [{ href: "/administration/maker-requests", icon: ClipboardCheck, label: "Maker Requests" }]
                    : []),
                ],
                label: "Administration",
              },
            ]
          : []),
      ];
    } else if (currentUser.role === "Branch Regional Head") {
      return [
        {
          items: [{ href: "/dsa/management", icon: Users, label: "DSA Management" }],
          label: "Regional DSA",
        },
      ];
    } else if (currentUser.role === "Branch User") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [
            { href: "/dsa/onboarding", icon: Building2, label: "Onboard DSA" },
            { href: "/dsa/management", icon: Users, label: "DSA Management" },
          ],
          label: "Branch DSA",
        },
      ];
    } else if (currentUser.role === "DSA Partner") {
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [{ href: "/dsa/management", icon: Users, label: "Manage My Network" }],
          label: "Network",
        },
        {
          items: [{ href: "/applications", icon: ClipboardCheck, label: "Applications" }],
          label: "Applications",
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

  const globalResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) return [];

    const searchableDsas =
      currentUser?.role === "DSA Partner"
        ? store.dsas.filter((item) => item.id === currentUser.id)
        : currentUser?.role === "Branch User"
        ? store.dsas.filter((item) => item.manager === currentUser.name)
        : store.dsas;
    const searchableApplications =
      currentUser?.role === "Branch User" || currentUser?.role === "Branch Regional Head"
        ? []
        : currentUser?.role === "DSA Partner"
          ? store.applications.filter((item) => item.dsaId === currentUser.id)
          : store.applications;

    return [
      ...searchableDsas
        .filter((item) =>
          [item.name, item.code, item.pan, item.mobile, item.email].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
        .map((item) => ({
          href: `/dsa/${item.id}`,
          kind: "DSA",
          label: item.name,
          meta: `${item.code} Â· ${item.pan}`,
        })),
      ...searchableApplications
        .filter((item) =>
          [item.applicationId, item.customer, item.pan, item.aadhaar, item.mobile, item.email].some(
            (value) => value.toLowerCase().includes(query),
          ),
        )
        .map((item) => ({
          href: `/applications/${item.id}`,
          kind: "Application",
          label: `${item.applicationId} Â· ${item.customer}`,
          meta: `${item.product} Â· ${item.status}`,
        })),
    ].slice(0, 10);
  }, [currentUser, globalQuery, store.applications, store.dsas]);

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

    const canSeeInternal = ["DSA Manager", "DSA Credit", "Branch User", "Branch Regional Head"].includes(currentUser.role);
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
          title: "Document verification overdue",
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

  const navigation = (
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
                <span className="truncate text-sm leading-5">{item.label}</span>
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
                <span className="truncate text-sm leading-5">{group.label}</span>
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
                        <span className="truncate text-sm leading-5">{item.label}</span>
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className="fixed left-0 top-0 z-30 hidden h-screen w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col"
      >
        <div className="flex h-16 items-center border-b border-slate-100 px-4">
          <Image
            alt="Cosmos Bank"
            className="h-10 w-auto max-w-[220px]"
            height={40}
            priority
            src="/logo-dsasm-cosmos.png"
            width={220}
          />
        </div>
        {navigation}
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-5">
            <Button
              aria-label="Open navigation"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative hidden max-w-xl flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="Global search"
                className="bg-slate-50 pl-9"
                onChange={(event) => {
                  setGlobalQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search DSAs, applications, PAN, Aadhaar"
                value={globalQuery}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                aria-label="Open notifications"
                className="relative grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                onClick={() => setNotificationsOpen(true)}
                type="button"
              >
                <Bell className="h-4 w-4" />
                {notificationRows.length ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                    {notificationRows.length}
                  </span>
                ) : null}
              </button>
              <div className="relative">
                <button
                  aria-haspopup="dialog"
                  className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 pr-3 text-left text-sm hover:bg-slate-50"
                  onClick={() => setProfileOpen(true)}
                  type="button"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                    {initials(currentUser.name)}
                  </span>
                  <span className="hidden sm:block">
                    <span className="block text-xs font-semibold text-slate-950">{currentUser.name}</span>
                    <span className="block text-[11px] text-slate-500">{currentUser.role}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="compact-dashboard w-full px-3 py-3 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4">{children}</main>
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
            <div className="flex h-16 items-center border-b border-slate-100 px-4">
              <Image
                alt="Cosmos Bank"
                className="h-10 w-auto max-w-[210px]"
                height={40}
                priority
                src="/logo-dsasm-cosmos.png"
                width={210}
              />
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}

      <Modal
        description="Search across partner and application identifiers."
        onClose={() => setSearchOpen(false)}
        open={searchOpen}
        title="Global search"
        width="max-w-3xl"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            autoFocus
            className="pl-9"
            onChange={(event) => setGlobalQuery(event.target.value)}
            placeholder="Search by name, ID, PAN, Aadhaar, mobile, or email"
            value={globalQuery}
          />
        </div>
        <div className="mt-4 space-y-2">
          {globalQuery.trim() ? (
            globalResults.length ? (
              globalResults.map((result) => (
                <Link
                  className="flex items-center justify-between gap-4 rounded-md border border-slate-100 p-3 hover:border-blue-200 hover:bg-blue-50/40"
                  href={result.href}
                  key={`${result.kind}-${result.label}`}
                  onClick={() => {
                    setGlobalQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{result.label}</p>
                    <p className="truncate text-xs text-slate-500">{result.meta}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {result.kind}
                  </span>
                </Link>
              ))
            ) : (
              <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">No matching records found.</p>
            )
          ) : (
            <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">
              Start typing to search the mock workspace.
            </p>
          )}
        </div>
      </Modal>
      <Modal
        description="Unread alerts plus workflow items with no action for 4+ days."
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
        onSignOut={() => {
          setProfileOpen(false);
          logout();
          router.push("/login");
        }}
        open={profileOpen}
      />
    </div>
  );
}


