"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Bookmark,
  Flag,
  LogOut,
  Menu,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { ThemeSwitcher } from "@/components/admin/theme-switcher";
import { cn } from "@/lib/utils";

const links = [
  { href: "/portal/discover", label: "Discover GitHub Users", icon: Search },
  { href: "/portal/contacts", label: "My Contacts", icon: Bookmark },
  { href: "/portal/reports", label: "My Reports", icon: Flag },
];

export function PortalSidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-[color:var(--surface-solid)]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <UserRound className="h-5 w-5 text-[color:var(--accent)]" />
          User portal
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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col overflow-y-auto bg-[color:var(--sidebar)] text-sidebar-text shadow-2xl transition-transform duration-300 ease-out lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="relative overflow-hidden border-b border-white/10 px-5 py-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[color:var(--accent)]/20 blur-2xl"
          />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/30">
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-wide text-white">
                GitHub Scraping
              </p>
              <p className="truncate text-xs text-[color:var(--sidebar-muted)]">User portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-200",
                  active
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-1 ring-[color:var(--accent)]/30"
                    : "text-slate-300 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[color:var(--accent)]" />
                ) : null}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-3">
          <ThemeSwitcher compact />
          <div className="rounded-2xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/10">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--sidebar-muted)]">
              Signed in
            </p>
            <p className="truncate text-sm text-slate-100">{data?.user?.email || "User"}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="hidden w-72 shrink-0 lg:block" aria-hidden="true" />
    </>
  );
}
