"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity,
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  Shield,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ThemeSwitcher } from "@/components/admin/theme-switcher";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

type NavRole = "ADMIN" | "USER";

const links: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: NavRole[];
}[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, roles: ["ADMIN"] },
  {
    href: "/admin/configurations",
    label: "Scraping Configurations",
    icon: Settings2,
    roles: ["ADMIN"],
  },
  { href: "/admin/rules", label: "Scam Detection Rules", icon: Shield, roles: ["ADMIN"] },
  { href: "/admin/jobs", label: "Scraping Jobs", icon: Activity, roles: ["ADMIN"] },
  { href: "/admin/users", label: "GitHub Users", icon: Users, roles: ["ADMIN"] },
  { href: "/admin/review", label: "Scam Review", icon: AlertTriangle, roles: ["ADMIN"] },
  { href: "/admin/reports", label: "User Scam Reports", icon: ClipboardList, roles: ["ADMIN"] },
  { href: "/admin/history", label: "Scraping History", icon: History, roles: ["ADMIN"] },
  { href: "/admin/settings", label: "Settings", icon: KeyRound, roles: ["ADMIN"] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = (data?.user?.role || "USER") as NavRole;
  const visibleLinks = useMemo(
    () => links.filter((link) => link.roles.includes(role)),
    [role],
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-[color:var(--surface-solid)]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <ClipboardList className="h-5 w-5 text-[color:var(--accent)]" />
          Admin
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-secondary !rounded-xl !px-2.5 !py-2"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-y-auto bg-[color:var(--sidebar)] text-sidebar-text shadow-2xl transition-[width,transform] duration-300 ease-out lg:translate-x-0 lg:shadow-none",
          collapsed ? "lg:w-[4.75rem]" : "lg:w-72",
          "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          !ready && "lg:transition-none",
        )}
      >
        <div
          className={cn(
            "relative overflow-hidden border-b border-white/10",
            collapsed ? "px-2.5 py-4" : "px-5 py-6",
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[color:var(--accent)]/20 blur-2xl"
          />
          <div
            className={cn(
              "relative flex items-center",
              collapsed ? "justify-center" : "gap-3",
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/30">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div
              className={cn(
                "min-w-0 overflow-hidden transition-all duration-300",
                collapsed ? "pointer-events-none w-0 opacity-0" : "w-auto opacity-100",
              )}
            >
              <p className="truncate text-sm font-semibold tracking-wide text-white">
                GitHub Scraping
              </p>
              <p className="truncate text-xs text-[color:var(--sidebar-muted)]">Admin console</p>
            </div>
          </div>
        </div>

        <nav className={cn("flex-1 space-y-1", collapsed ? "p-2" : "p-3")}>
          {visibleLinks.map((link) => {
            const active =
              link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center rounded-xl text-sm transition duration-200",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/30"
                    : "text-slate-300 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                {active && !collapsed ? (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[color:var(--accent)]" />
                ) : null}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition",
                    active ? "text-[color:var(--accent)]" : "text-muted group-hover:text-slate-200",
                  )}
                />
                <span
                  className={cn(
                    "truncate transition-all duration-300",
                    collapsed ? "pointer-events-none w-0 overflow-hidden opacity-0" : "opacity-100",
                  )}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className={cn("space-y-3 border-t border-white/10", collapsed ? "p-2" : "p-3")}>
          <ThemeSwitcher compact rail={collapsed} />

          {!collapsed ? (
            <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--sidebar-muted)]">
                Signed in
              </p>
              <p className="truncate text-sm text-slate-100">{data?.user?.email || "Admin"}</p>
            </div>
          ) : null}

          <button
            type="button"
            title={collapsed ? "Sign out" : undefined}
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex w-full items-center rounded-xl text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed ? <span>Sign out</span> : null}
          </button>

          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "hidden w-full items-center rounded-xl text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white lg:flex",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Spacer keeps main content aligned with the fixed sidebar */}
      <div
        className={cn(
          "hidden shrink-0 transition-[width] duration-300 ease-out lg:block",
          collapsed ? "w-[4.75rem]" : "w-72",
          !ready && "transition-none",
        )}
        aria-hidden="true"
      />
    </>
  );
}
