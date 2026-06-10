"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  Gauge,
  Landmark,
  LayoutDashboard,
  LineChart,
  Menu,
  Network,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import { ReactNode, useMemo, useState, useEffect } from "react";

import { Button, Input, Modal } from "@/components/ui/primitives";
import { useMockStore } from "@/lib/store";
import { cn, initials } from "@/lib/utils";

const navGroups = [
  {
    items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
    label: "Overview",
  },
  {
    items: [
      { href: "/dsa/onboarding", icon: Building2, label: "Onboarding" },
      { href: "/dsa/management", icon: Users, label: "DSA Management" },
    ],
    label: "DSA",
  },
  {
    items: [{ href: "/leads", icon: FileSearch, label: "Lead Management" }],
    label: "Pipeline",
  },
  {
    items: [
      { href: "/applications", icon: ClipboardCheck, label: "Applications" },
      { href: "/applications/dedupe", icon: Network, label: "DSA & Dedupe" },
    ],
    label: "Applications",
  },
  {
    items: [{ href: "/bre/rules", icon: ShieldCheck, label: "Rule Configuration" }],
    label: "BRE",
  },
  {
    items: [
      { href: "/operations/verification", icon: Gauge, label: "Verification" },
      { href: "/operations/documents", icon: FileSearch, label: "Documents" },
      { href: "/operations/approval", icon: Workflow, label: "Approval Workflow" },
    ],
    label: "Operations",
  },
  {
    items: [{ href: "/finance/commissions", icon: Wallet, label: "Commission Management" }],
    label: "Finance",
  },
  {
    items: [{ href: "/analytics/reports", icon: LineChart, label: "Reports" }],
    label: "Analytics",
  },
  {
    items: [
      { href: "/administration/users", icon: Users, label: "Users" },
      { href: "/administration/roles", icon: ShieldCheck, label: "Roles" },
      { href: "/administration/audit-logs", icon: FileSearch, label: "Audit Logs" },
      { href: "/administration/notifications", icon: Bell, label: "Notifications" },
      { href: "/administration/settings", icon: Settings, label: "Settings" },
    ],
    label: "Administration",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { store, currentUser, logout } = useMockStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, router, mounted]);

  const navGroups = useMemo(() => {
    if (!currentUser) return [];

    if (currentUser.role === "DSA Manager") {
      // Super Admin
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [
            { href: "/dsa/onboarding", icon: Building2, label: "Onboard DSA" },
            { href: "/dsa/management", icon: Users, label: "DSA Management" },
            { href: "/dsa/product-setting", icon: Settings, label: "Product Setting", badge: "New" },
          ],
          label: "Partners",
        },
        {
          items: [{ href: "/leads", icon: FileSearch, label: "Lead Pipeline" }],
          label: "Leads",
        },
        {
          items: [{ href: "/applications", icon: ClipboardCheck, label: "Applications" }],
          label: "Applications",
        },
        {
          items: [{ href: "/bre/rules", icon: ShieldCheck, label: "BRE Rules" }],
          label: "Rules",
        },
        {
          items: [{ href: "/finance/commissions", icon: Wallet, label: "Commissions" }],
          label: "Finance",
        },
        {
          items: [{ href: "/analytics/reports", icon: LineChart, label: "Reports" }],
          label: "Analytics",
        },
      ];
    } else if (currentUser.role === "DSA Partner") {
      // DSA Partner
      return [
        {
          items: [{ href: "/", icon: LayoutDashboard, label: "Dashboard" }],
          label: "Overview",
        },
        {
          items: [
            { href: "/dsa/onboarding", icon: Building2, label: "Onboard Sub-DSA" },
            { href: "/dsa/management", icon: Users, label: "My Agent Network" },
          ],
          label: "DSA Network",
        },
        {
          items: [{ href: "/leads", icon: FileSearch, label: "Submit Leads" }],
          label: "Sourcing",
        },
        {
          items: [{ href: "/finance/commissions", icon: Wallet, label: "My Earnings" }],
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
          items: [
            { href: "/leads", icon: FileSearch, label: "Apply for Loan" },
            { href: "/applications", icon: ClipboardCheck, label: "My Applications" },
          ],
          label: "Loan Journey",
        },
      ];
    }
  }, [currentUser]);

  const unread = store.notifications.filter((item) => item.status === "Unread").length;
  const globalResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) return [];

    return [
      ...store.dsas
        .filter((item) =>
          [item.name, item.code, item.pan, item.mobile, item.email].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
        .map((item) => ({
          href: `/dsa/${item.id}`,
          kind: "DSA",
          label: item.name,
          meta: `${item.code} · ${item.pan}`,
        })),
      ...store.applications
        .filter((item) =>
          [item.applicationId, item.customer, item.pan, item.aadhaar, item.mobile, item.email].some(
            (value) => value.toLowerCase().includes(query),
          ),
        )
        .map((item) => ({
          href: `/applications/${item.id}`,
          kind: "Application",
          label: `${item.applicationId} · ${item.customer}`,
          meta: `${item.product} · ${item.status}`,
        })),
      ...store.leads
        .filter((item) =>
          [item.leadId, item.customer, item.mobile, item.email].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
        .map((item) => ({
          href: "/leads",
          kind: "Lead",
          label: `${item.leadId} · ${item.customer}`,
          meta: `${item.product} · ${item.status}`,
        })),
    ].slice(0, 10);
  }, [globalQuery, store.applications, store.dsas, store.leads]);

  if (!mounted || !currentUser) return null;

  const navigation = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>
          ) : null}
          <div className="space-y-1">
            {group.items.map((item: any) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                    active && "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
                    collapsed && "justify-center px-2",
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed ? (
                    <span className="flex-1 flex items-center justify-between min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.badge && (
                        <span className="ml-2 rounded-full bg-orange-500 text-[10px] font-bold text-white px-2 py-0.5 uppercase tracking-wide">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 hidden h-screen border-r border-slate-200 bg-white lg:flex lg:flex-col",
          collapsed ? "w-20" : "w-72",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-4">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
            <Landmark className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Cosmos DSA Console</p>
              <p className="truncate text-xs text-slate-500">Direct selling operations</p>
            </div>
          ) : null}
        </div>
        {navigation}
        <div className="border-t border-slate-100 p-3">
          <Button
            className="w-full"
            onClick={() => setCollapsed((current) => !current)}
            type="button"
            variant="ghost"
          >
            <PanelLeftClose className="h-4 w-4" />
            {!collapsed ? "Collapse" : null}
          </Button>
        </div>
      </aside>

      <div className={cn("min-h-screen transition-[padding]", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
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
                placeholder="Search DSAs, applications, PAN, Aadhaar, leads"
                value={globalQuery}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/administration/notifications">
                <Button aria-label="Notifications" className="relative" size="icon" type="button" variant="ghost">
                  <Bell className="h-5 w-5" />
                  {unread ? (
                    <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                      {unread}
                    </span>
                  ) : null}
                </Button>
              </Link>
              <div className="relative">
                <button
                  aria-expanded={profileOpen}
                  className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 pr-3 text-left text-sm hover:bg-slate-50"
                  onClick={() => setProfileOpen((current) => !current)}
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
                {profileOpen ? (
                  <div className="absolute right-0 top-12 z-30 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-950">{currentUser.name}</p>
                      <p className="text-xs text-slate-500 truncate">{currentUser.email || currentUser.code || "Active Session"}</p>
                    </div>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        logout();
                        router.push("/login");
                      }}
                      className="mt-1 w-full text-left block rounded-md px-3 py-2 text-sm text-rose-600 font-semibold hover:bg-rose-50 hover:text-rose-700 transition"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">{children}</main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[86vw] flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-4">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
                <Landmark className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Cosmos DSA Console</p>
                <p className="text-xs text-slate-500">Direct selling operations</p>
              </div>
            </div>
            {navigation}
          </aside>
        </div>
      ) : null}

      <Modal
        description="Search across partner, application, and lead identifiers."
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
    </div>
  );
}
