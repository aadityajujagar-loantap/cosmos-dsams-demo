"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  LineChart,
  Menu,
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
import { useMockStore } from "@/lib/store";
import { cn, initials } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

interface NavGroup {
  items: NavItem[];
  label: string;
}

const subscribeToClient = () => () => {};

function useIsClient() {
  return useSyncExternalStore(subscribeToClient, () => true, () => false);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isPathAllowedForRole(role: string, pathname: string) {
  if (role === "DSA Credit") {
    return !pathname.startsWith("/dsa/onboarding");
  }

  if (role !== "Branch User") return true;

  const branchDsaProfile =
    pathname.startsWith("/dsa/") &&
    !["/dsa/management", "/dsa/onboarding", "/dsa/product-setting"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

  return pathname === "/" || pathname === "/dsa/management" || pathname === "/dsa/onboarding" || branchDsaProfile;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [globalQuery, setGlobalQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { store, currentUser, logout } = useMockStore();

  const mounted = useIsClient();

  useEffect(() => {
    if (mounted && !currentUser) {
      router.push("/login");
    }
    if (mounted && currentUser && !isPathAllowedForRole(currentUser.role, pathname)) {
      router.replace("/");
    }
  }, [currentUser, pathname, router, mounted]);

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
            ...(currentUser.role === "DSA Manager"
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
          items: [{ href: "/finance/commissions", icon: Wallet, label: "Commissions" }],
          label: "Finance",
        },
        {
          items: [{ href: "/analytics/reports", icon: LineChart, label: "Reports" }],
          label: "Analytics",
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
          items: [
            { href: "/dsa/management", icon: Users, label: "Manage My Network" },
          ],
          label: "Network",
        },
        {
          items: [{ href: "/sell-now", icon: Send, label: "Sell Now" }],
          label: "Journeys",
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
      currentUser?.role === "Branch User"
        ? store.dsas.filter((item) => item.manager === currentUser.name)
        : store.dsas;
    const searchableApplications = currentUser?.role === "Branch User" ? [] : store.applications;

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
          meta: `${item.code} · ${item.pan}`,
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
          label: `${item.applicationId} · ${item.customer}`,
          meta: `${item.product} · ${item.status}`,
        })),
    ].slice(0, 10);
  }, [currentUser, globalQuery, store.applications, store.dsas]);

  if (!mounted || !currentUser) return null;

  const navigation = (
    <nav className="scrollbar-subtle flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
                    active && "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
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
        className="fixed left-0 top-0 z-30 hidden h-screen w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col"
      >
        <div className="flex h-16 items-center border-b border-slate-100 px-4">
          <Image
            alt="Cosmos DSA"
            className="h-10 w-auto max-w-[220px]"
            height={40}
            priority
            src="/logo-dsasm-cosmos.svg"
            width={220}
          />
        </div>
        {navigation}
      </aside>

      <div className="min-h-screen lg:pl-72">
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
                placeholder="Search DSAs, applications, PAN, Aadhaar"
                value={globalQuery}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
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
            <div className="flex h-16 items-center border-b border-slate-100 px-4">
              <Image
                alt="Cosmos DSA"
                className="h-10 w-auto max-w-[210px]"
                height={40}
                priority
                src="/logo-dsasm-cosmos.svg"
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
    </div>
  );
}
