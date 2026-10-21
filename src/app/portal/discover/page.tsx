"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Flag,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe,
  LayoutGrid,
  LayoutList,
  Mail,
  MapPin,
  RotateCcw,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card, Input, Select } from "@/components/admin/ui";
import {
  consumeDiscoverListRestorePending,
  type DiscoverViewMode,
  markDiscoverListRestorePending,
  peekDiscoverListRestorePending,
  readDiscoverListMemory,
  restoreScroll,
  saveDiscoverListMemory,
  saveScroll,
} from "@/lib/scroll-memory";
import { reportStatusLabel } from "@/lib/portal/constants";
import { cn } from "@/lib/utils";

function formatCreatedDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB");
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function resolveLinkedIn(user: UserRow) {
  const direct = user.linkedinUrl?.trim();
  if (direct) return normalizeHttpUrl(direct);
  const blog = user.blog?.trim();
  if (blog && /linkedin\.com/i.test(blog)) return normalizeHttpUrl(blog);
  return null;
}

function resolveBlog(user: UserRow) {
  const blog = user.blog?.trim();
  if (!blog) return null;
  if (/linkedin\.com/i.test(blog)) return null;
  return normalizeHttpUrl(blog);
}

function resolveCompanyHref(company?: string | null) {
  const value = company?.trim();
  if (!value) return null;
  if (value.startsWith("@")) {
    return `https://github.com/${value.slice(1)}`;
  }
  const asUrl = normalizeHttpUrl(value);
  if (asUrl && /^https?:\/\//i.test(value)) return asUrl;
  return null;
}

function CopyIconButton({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-[color:var(--surface-muted)]/50 text-muted transition hover:border-[color:var(--border-strong)] hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

type UserRow = {
  id: string;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  htmlUrl?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  blog?: string | null;
  twitterUsername?: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  githubCreatedAt?: string | null;
  validationStatus: string;
  isSaved: boolean;
  contactId?: string | null;
  reportStatus?: string | null;
};

type Response = {
  items: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function statusTone(status: string) {
  if (status === "legitimate") return "success" as const;
  if (status === "suspicious") return "warning" as const;
  return "info" as const;
}

function parseViewMode(value?: string | null): DiscoverViewMode {
  return value === "cards" ? "cards" : "table";
}

export default function PortalDiscoverPage() {
  const remembered = useMemo(() => readDiscoverListMemory(), []);
  const [q, setQ] = useState(remembered?.q || "");
  const [debouncedQ, setDebouncedQ] = useState(remembered?.q || "");
  const [location, setLocation] = useState(remembered?.location || "");
  const [debouncedLocation, setDebouncedLocation] = useState(remembered?.location || "");
  const [company, setCompany] = useState(remembered?.company || "");
  const [debouncedCompany, setDebouncedCompany] = useState(remembered?.company || "");
  const [minFollowers, setMinFollowers] = useState(remembered?.minFollowers || "");
  const [minRepos, setMinRepos] = useState(remembered?.minRepos || "");
  const [hireable, setHireable] = useState(remembered?.hireable || "");
  const [sort, setSort] = useState(remembered?.sort || "followers");
  const [order, setOrder] = useState<"asc" | "desc">(remembered?.order || "desc");
  const [page, setPage] = useState(remembered?.page || 1);
  const [pageSize, setPageSize] = useState(remembered?.pageSize || 20);
  const [viewMode, setViewMode] = useState<DiscoverViewMode>(parseViewMode(remembered?.viewMode));
  const [lastUserId, setLastUserId] = useState<string | null>(remembered?.lastUserId || null);
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const shouldRestoreRef = useRef(peekDiscoverListRestorePending());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(location), 300);
    return () => clearTimeout(t);
  }, [location]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCompany(company), 300);
    return () => clearTimeout(t);
  }, [company]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort,
      order,
    });
    if (debouncedQ) params.set("q", debouncedQ);
    if (debouncedLocation) params.set("location", debouncedLocation);
    if (debouncedCompany) params.set("company", debouncedCompany);
    if (minFollowers) params.set("minFollowers", minFollowers);
    if (minRepos) params.set("minRepos", minRepos);
    if (hireable) params.set("hireable", hireable);
    return params.toString();
  }, [
    page,
    pageSize,
    sort,
    order,
    debouncedQ,
    debouncedLocation,
    debouncedCompany,
    minFollowers,
    minRepos,
    hireable,
  ]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/portal/github?${queryString}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
        return res.json();
      })
      .then((json: Response) => {
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [queryString]);

  const memorySnapshot = useMemo(
    () => ({
      q,
      location,
      company,
      minFollowers,
      minRepos,
      hireable,
      sort,
      order,
      page,
      pageSize,
      lastUserId,
      viewMode,
    }),
    [
      q,
      location,
      company,
      minFollowers,
      minRepos,
      hireable,
      sort,
      order,
      page,
      pageSize,
      lastUserId,
      viewMode,
    ],
  );

  useEffect(() => {
    const persistScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y <= 0) return;
      saveDiscoverListMemory({ ...memorySnapshot, scrollY: y });
    };
    window.addEventListener("scroll", persistScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", persistScroll);
    };
  }, [memorySnapshot]);

  useEffect(() => {
    saveDiscoverListMemory({
      ...memorySnapshot,
      scrollY: window.scrollY || window.pageYOffset || 0,
    });
  }, [memorySnapshot]);

  useEffect(() => {
    if (loading || !data) return;
    if (!shouldRestoreRef.current && !peekDiscoverListRestorePending()) return;

    let done = false;
    const tryRestore = () => {
      if (done) return;
      const y = restoreScroll("/portal/discover");
      if (y == null || y <= 0) return;
      if (Math.abs((window.scrollY || 0) - y) <= 4) {
        done = true;
        shouldRestoreRef.current = false;
        consumeDiscoverListRestorePending();
      }
    };

    tryRestore();
    const raf = requestAnimationFrame(tryRestore);
    const timers = [50, 100, 200, 400, 700, 1000, 1600].map((ms) =>
      window.setTimeout(tryRestore, ms),
    );
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [loading, data, viewMode]);

  function rememberBeforeOpenDetail(userId: string) {
    const y = window.scrollY || window.pageYOffset || 0;
    setLastUserId(userId);
    markDiscoverListRestorePending();
    saveScroll("/portal/discover", y, { force: true });
    saveDiscoverListMemory(
      {
        ...memorySnapshot,
        lastUserId: userId,
        scrollY: y,
      },
      { forceScroll: true },
    );
  }

  function resetFilters() {
    setQ("");
    setLocation("");
    setCompany("");
    setMinFollowers("");
    setMinRepos("");
    setHireable("");
    setSort("followers");
    setOrder("desc");
    setPage(1);
    setLastUserId(null);
    saveDiscoverListMemory(
      {
        q: "",
        location: "",
        company: "",
        minFollowers: "",
        minRepos: "",
        hireable: "",
        sort: "followers",
        order: "desc",
        page: 1,
        pageSize,
        lastUserId: null,
        viewMode,
        scrollY: 0,
      },
      { forceScroll: true },
    );
  }

  function reportIsOpen(status?: string | null) {
    return status === "pending" || status === "under_review";
  }

  async function reportUser(user: UserRow) {
    if (reportIsOpen(user.reportStatus)) return;
    if (!window.confirm(`Report @${user.login} for administrator review?`)) return;
    setBusyId(user.id);
    setError(null);
    try {
      const res = await fetch("/api/portal/scam-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUserId: user.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to submit report");
      const refreshed = await fetch(`/api/portal/github?${queryString}`);
      setData(await refreshed.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleContact(user: UserRow) {
    setBusyId(user.id);
    setError(null);
    try {
      if (user.isSaved && user.contactId) {
        const res = await fetch(`/api/portal/contacts/${user.contactId}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to remove contact");
      } else {
        const res = await fetch("/api/portal/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ githubUserId: user.id }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save contact");
      }
      const refreshed = await fetch(`/api/portal/github?${queryString}`);
      setData(await refreshed.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Contact update failed");
    } finally {
      setBusyId(null);
    }
  }

  const emptyMessage = "No eligible profiles found. Try widening your filters.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discover GitHub Users"
        description="Search stored profiles from the shared database. Confirmed scams are hidden."
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <label className="block text-xs text-muted sm:col-span-2 xl:col-span-3">
            Search
            <Input
              className="mt-1"
              placeholder="Login, name, bio…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-muted xl:col-span-2">
            Location
            <Input
              className="mt-1"
              value={location}
              onChange={(e) => {
                setPage(1);
                setLocation(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-muted xl:col-span-2">
            Company
            <Input
              className="mt-1"
              value={company}
              onChange={(e) => {
                setPage(1);
                setCompany(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-muted xl:col-span-1">
            Min followers
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={minFollowers}
              onChange={(e) => {
                setPage(1);
                setMinFollowers(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-muted xl:col-span-1">
            Min repos
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={minRepos}
              onChange={(e) => {
                setPage(1);
                setMinRepos(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-muted xl:col-span-1">
            Hireable
            <Select
              className="mt-1"
              value={hireable}
              onChange={(e) => {
                setPage(1);
                setHireable(e.target.value);
              }}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </Select>
          </label>
          <label className="block text-xs text-muted xl:col-span-1">
            Sort by
            <Select
              className="mt-1"
              value={sort}
              onChange={(e) => {
                setPage(1);
                setSort(e.target.value);
              }}
            >
              <option value="followers">Followers</option>
              <option value="publicRepos">Repos</option>
              <option value="githubCreatedAt">Account created</option>
              <option value="login">Login</option>
              <option value="lastScrapedAt">Last synced</option>
            </Select>
          </label>
          <label className="block text-xs text-muted xl:col-span-1">
            Order
            <Select
              className="mt-1"
              value={order}
              onChange={(e) => {
                setPage(1);
                setOrder(e.target.value as "asc" | "desc");
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={resetFilters}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset filters
          </Button>
          <div
            className="inline-flex rounded-xl border border-border bg-[color:var(--surface-muted)]/40 p-1"
            role="group"
            aria-label="Result layout"
          >
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "table"
                  ? "bg-[color:var(--surface-solid)] text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
              aria-pressed={viewMode === "table"}
              onClick={() => setViewMode("table")}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "cards"
                  ? "bg-[color:var(--surface-solid)] text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
              aria-pressed={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </button>
          </div>
        </div>
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      {viewMode === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="ui-table-head text-[11px] font-semibold uppercase tracking-[0.06em]">
                <tr>
                  <th className="px-3 py-3.5">User</th>
                  <th className="px-3 py-3.5">Company</th>
                  <th className="px-3 py-3.5">Location</th>
                  <th className="px-3 py-3.5">Repos</th>
                  <th className="px-3 py-3.5">Followers</th>
                  <th className="px-3 py-3.5">Created</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : null}
                {data?.items.map((user) => {
                  const isHighlighted = lastUserId === user.id;
                  return (
                    <tr
                      key={user.id}
                      id={`discover-user-${user.id}`}
                      className={cn(
                        "ui-row-hover border-t border-border align-top transition-colors",
                        isHighlighted &&
                          "bg-[color:var(--accent-soft)] ring-1 ring-inset ring-[color:var(--accent)]/35",
                      )}
                    >
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Link
                            href={`/portal/discover/${user.id}`}
                            scroll={false}
                            onClick={() => rememberBeforeOpenDetail(user.id)}
                            className="shrink-0 rounded-full outline-offset-2 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
                            aria-label={`View ${user.login} details`}
                            title="View details"
                          >
                            {user.avatarUrl ? (
                              <Image
                                src={user.avatarUrl}
                                alt=""
                                width={34}
                                height={34}
                                className={cn(
                                  "rounded-full ring-2",
                                  isHighlighted ? "ring-[color:var(--accent)]" : "ring-white",
                                )}
                                unoptimized
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-xs font-semibold ring-2",
                                  isHighlighted ? "ring-[color:var(--accent)]" : "ring-transparent",
                                )}
                              >
                                {user.login.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </Link>
                          <div>
                            <a
                              href={user.htmlUrl || `https://github.com/${user.login}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-link font-semibold hover:underline"
                            >
                              {user.login}
                            </a>
                            <div className="text-xs text-muted">{user.name || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">{user.company || "—"}</td>
                      <td className="px-3 py-3.5">{user.location || "—"}</td>
                      <td className="px-3 py-3.5 tabular-nums">{user.publicRepos}</td>
                      <td className="px-3 py-3.5 tabular-nums">{user.followers}</td>
                      <td className="px-3 py-3.5 text-xs text-muted tabular-nums">
                        {formatCreatedDate(user.githubCreatedAt)}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge tone={statusTone(user.validationStatus)}>{user.validationStatus}</Badge>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="!px-2.5 !py-1.5 text-xs"
                            disabled={busyId === user.id}
                            onClick={() => toggleContact(user)}
                          >
                            {user.isSaved ? (
                              <>
                                <BookmarkCheck className="h-3.5 w-3.5" />
                                Saved
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-3.5 w-3.5" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="!px-2.5 !py-1.5 text-xs"
                            disabled={busyId === user.id || reportIsOpen(user.reportStatus)}
                            onClick={() => reportUser(user)}
                          >
                            <Flag className="h-3.5 w-3.5" />
                            {reportIsOpen(user.reportStatus)
                              ? reportStatusLabel(user.reportStatus || "")
                              : "Report"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div>
          {loading ? (
            <Card className="px-4 py-10 text-center text-sm text-muted">Loading…</Card>
          ) : null}
          {!loading && data?.items.length === 0 ? (
            <Card className="px-4 py-10 text-center text-sm text-muted">{emptyMessage}</Card>
          ) : null}
          {!loading && data && data.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((user) => {
                const isHighlighted = lastUserId === user.id;
                const githubUrl = user.htmlUrl || `https://github.com/${user.login}`;
                const email = user.email?.trim() || "";
                const linkedin = resolveLinkedIn(user);
                const blog = resolveBlog(user);
                const companyHref = resolveCompanyHref(user.company);
                const twitter = user.twitterUsername?.trim()
                  ? `https://x.com/${user.twitterUsername.trim().replace(/^@/, "")}`
                  : null;
                const locationQuery = user.location?.trim()
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(user.location.trim())}`
                  : null;

                return (
                  <article
                    key={user.id}
                    id={`discover-user-${user.id}`}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-[1.35rem] border border-border bg-[color:var(--surface-solid)]/80 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.65)]",
                      isHighlighted &&
                        "border-[color:var(--accent)]/55 bg-[color:var(--accent-soft)]/40 ring-1 ring-[color:var(--accent)]/35",
                    )}
                  >
                    <div
                      aria-hidden
                      className="h-16 bg-[linear-gradient(125deg,rgba(45,212,191,0.22),rgba(56,189,248,0.12)_48%,transparent)]"
                    />
                    <div className="relative flex flex-1 flex-col px-5 pb-5 pt-0">
                      <div className="-mt-10 flex items-end justify-between gap-3">
                        <Link
                          href={`/portal/discover/${user.id}`}
                          scroll={false}
                          onClick={() => rememberBeforeOpenDetail(user.id)}
                          className="shrink-0 rounded-full outline-offset-2 transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
                          aria-label={`View ${user.login} details`}
                          title="View details"
                        >
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt=""
                              width={88}
                              height={88}
                              className={cn(
                                "h-[88px] w-[88px] rounded-full object-cover shadow-lg ring-4 ring-[color:var(--surface-solid)]",
                                isHighlighted && "ring-[color:var(--accent)]/50",
                              )}
                              unoptimized
                            />
                          ) : (
                            <div
                              className={cn(
                                "flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-2xl font-semibold shadow-lg ring-4 ring-[color:var(--surface-solid)]",
                                isHighlighted && "ring-[color:var(--accent)]/50",
                              )}
                            >
                              {user.login.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </Link>
                        <Badge tone={statusTone(user.validationStatus)}>
                          {user.validationStatus}
                        </Badge>
                      </div>

                      <div className="mt-4 min-w-0">
                        <Link
                          href={`/portal/discover/${user.id}`}
                          scroll={false}
                          onClick={() => rememberBeforeOpenDetail(user.id)}
                          className="block truncate text-lg font-semibold tracking-tight text-foreground transition hover:text-[color:var(--accent)]"
                        >
                          {user.login}
                        </Link>
                        <p className="mt-0.5 truncate text-sm text-muted">{user.name || "—"}</p>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-muted" />
                          {companyHref ? (
                            <a
                              href={companyHref}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-link truncate"
                            >
                              {user.company}
                            </a>
                          ) : (
                            <span className="truncate text-muted">{user.company || "—"}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-muted" />
                          {locationQuery ? (
                            <a
                              href={locationQuery}
                              target="_blank"
                              rel="noreferrer"
                              className="ui-link truncate"
                            >
                              {user.location}
                            </a>
                          ) : (
                            <span className="truncate text-muted">—</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-[color:var(--surface-muted)]/35 px-2.5 py-2">
                          <Mail className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                          {email ? (
                            <>
                              <a
                                href={`mailto:${email}`}
                                className="ui-link min-w-0 flex-1 truncate text-sm"
                                title={email}
                              >
                                {email}
                              </a>
                              <CopyIconButton value={email} label="email" />
                            </>
                          ) : (
                            <span className="flex-1 text-sm text-muted">No email</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-[color:var(--surface-muted)]/35 px-2.5 py-2">
                          <LinkedInIcon className="h-4 w-4 shrink-0 text-[color:var(--accent)]" />
                          {linkedin ? (
                            <>
                              <a
                                href={linkedin}
                                target="_blank"
                                rel="noreferrer"
                                className="ui-link min-w-0 flex-1 truncate text-sm"
                                title={linkedin}
                              >
                                LinkedIn profile
                              </a>
                              <CopyIconButton value={linkedin} label="LinkedIn URL" />
                            </>
                          ) : (
                            <span className="flex-1 text-sm text-muted">No LinkedIn</span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-border/70 bg-[color:var(--surface-muted)]/25 px-2 py-3 text-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted">Repos</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums">{user.publicRepos}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted">Followers</p>
                          <p className="mt-1 inline-flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
                            <Users className="h-3 w-3 text-muted" />
                            {user.followers}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted">Created</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums">
                            {formatCreatedDate(user.githubCreatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-[color:var(--accent)]/40 hover:text-[color:var(--accent)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          GitHub
                        </a>
                        {blog ? (
                          <a
                            href={blog}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-[color:var(--accent)]/40 hover:text-[color:var(--accent)]"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Website
                          </a>
                        ) : null}
                        {twitter ? (
                          <a
                            href={twitter}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-[color:var(--accent)]/40 hover:text-[color:var(--accent)]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            X / Twitter
                          </a>
                        ) : null}
                        <div className="ml-auto flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="!px-2.5 !py-1.5 text-xs"
                            disabled={busyId === user.id}
                            onClick={() => toggleContact(user)}
                          >
                            {user.isSaved ? (
                              <>
                                <BookmarkCheck className="h-3.5 w-3.5" />
                                Saved
                              </>
                            ) : (
                              <>
                                <Bookmark className="h-3.5 w-3.5" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="!px-2.5 !py-1.5 text-xs"
                            disabled={busyId === user.id || reportIsOpen(user.reportStatus)}
                            onClick={() => reportUser(user)}
                          >
                            <Flag className="h-3.5 w-3.5" />
                            {reportIsOpen(user.reportStatus)
                              ? reportStatusLabel(user.reportStatus || "")
                              : "Report"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted">
            Page {data.page} of {data.totalPages} · {data.total} profiles
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              className="!w-auto min-w-[5.5rem]"
              value={String(pageSize)}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
            <Button
              variant="secondary"
              className="!px-3.5 !py-1.5"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              className="!px-3.5 !py-1.5"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
