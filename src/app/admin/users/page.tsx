"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Mail } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  markUsersListRestorePending,
  peekUsersListRestorePending,
  readUsersListMemory,
  restoreScroll,
  saveScroll,
  saveUsersListMemory,
  consumeUsersListRestorePending,
} from "@/lib/scroll-memory";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card, Input, Select } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

type UserRow = {
  id: string;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  htmlUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  company?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  blog?: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  githubCreatedAt?: string | null;
  riskScore: number;
  validationStatus: string;
  firstScrapedAt: string;
  lastScrapedAt: string;
};

type ContactItem = { kind: "linkedin" | "email"; value: string };

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function contactItems(user: UserRow): ContactItem[] {
  const items: ContactItem[] = [];
  const linkedin =
    user.linkedinUrl?.trim() ||
    (user.blog?.trim() && /linkedin\.com/i.test(user.blog) ? user.blog.trim() : "");
  if (user.email?.trim()) items.push({ kind: "email", value: user.email.trim() });
  if (linkedin) items.push({ kind: "linkedin", value: linkedin });
  return items;
}

function CopyContactChip({ kind, value }: ContactItem) {
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

  const label = kind === "linkedin" ? "LinkedIn" : "Email";

  return (
    <button
      type="button"
      onClick={copyValue}
      title={`${label}: ${value} (click to copy)`}
      aria-label={`Copy ${label}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-300/90 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : kind === "linkedin" ? (
        <LinkedInIcon className="h-3.5 w-3.5" />
      ) : (
        <Mail className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

type Response = {
  items: UserRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function UsersTable() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const remembered = useMemo(() => readUsersListMemory(), []);
  const [q, setQ] = useState(remembered?.q || "");
  const [debouncedQ, setDebouncedQ] = useState(remembered?.q || "");
  const [location, setLocation] = useState(remembered?.location || "");
  const [debouncedLocation, setDebouncedLocation] = useState(remembered?.location || "");
  const [status, setStatus] = useState(remembered?.status || "");
  const [sort, setSort] = useState(remembered?.sort || "lastScrapedAt");
  const [order, setOrder] = useState<"asc" | "desc">(remembered?.order || "desc");
  const [page, setPage] = useState(remembered?.page || 1);
  const [pageSize, setPageSize] = useState(remembered?.pageSize || 20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const jobId = searchParams.get("jobId") || "";
  const shouldRestoreRef = useRef(peekUsersListRestorePending());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(location), 300);
    return () => clearTimeout(t);
  }, [location]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort,
      order,
    });
    if (debouncedQ) params.set("q", debouncedQ);
    if (debouncedLocation) params.set("location", debouncedLocation);
    if (status) params.set("status", status);
    if (jobId) params.set("jobId", jobId);
    return params.toString();
  }, [page, pageSize, sort, order, debouncedQ, debouncedLocation, status, jobId]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users?${queryString}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load users");
        return res.json();
      })
      .then((json: Response) => {
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [queryString]);

  // Persist filters continuously; only persist scroll while Y > 0.
  useEffect(() => {
    const persistScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y <= 0) return;
      saveUsersListMemory({
        q,
        location,
        status,
        sort,
        order,
        page,
        pageSize,
        scrollY: y,
      });
    };
    window.addEventListener("scroll", persistScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", persistScroll);
    };
  }, [q, location, status, sort, order, page, pageSize]);

  useEffect(() => {
    saveUsersListMemory({
      q,
      location,
      status,
      sort,
      order,
      page,
      pageSize,
      scrollY: window.scrollY || window.pageYOffset || 0,
    });
  }, [q, location, status, sort, order, page, pageSize]);

  // Restore after table content is ready (and when returning from detail).
  useEffect(() => {
    if (loading || !data) return;
    if (!shouldRestoreRef.current && !peekUsersListRestorePending()) return;

    let done = false;
    const tryRestore = () => {
      if (done) return;
      const y = restoreScroll("/admin/users");
      if (y == null || y <= 0) return;
      if (Math.abs((window.scrollY || 0) - y) <= 4) {
        done = true;
        shouldRestoreRef.current = false;
        consumeUsersListRestorePending();
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
  }, [loading, data]);

  function rememberBeforeOpenDetail() {
    const y = window.scrollY || window.pageYOffset || 0;
    markUsersListRestorePending();
    saveScroll("/admin/users", y, { force: true });
    saveUsersListMemory(
      {
        q,
        location,
        status,
        sort,
        order,
        page,
        pageSize,
        scrollY: y,
      },
      { forceScroll: true },
    );
  }

  function toggleAll() {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((u) => u.id)));
    }
  }

  async function bulk(action: "mark_legitimate" | "mark_suspicious" | "confirm_scam" | "soft_delete") {
    if (selected.size === 0) return;
    const label =
      action === "soft_delete"
        ? `soft-delete ${selected.size} users`
        : `update ${selected.size} users to ${action.replace("mark_", "").replace("_", " ")}`;
    if (!window.confirm(`Confirm: ${label}?`)) return;

    const res = await fetch("/api/admin/users/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], action, confirm: true }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Bulk action failed");
      return;
    }
    setSelected(new Set());
    setPage(1);
    const refreshed = await fetch(`/api/admin/users?${queryString}`);
    setData(await refreshed.json());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="GitHub Users"
        description="Search, filter, and review stored profiles. Usernames open the public GitHub profile."
      />

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12">
          <label className="block text-xs text-muted sm:col-span-2 xl:col-span-4">
            Search
            <Input
              className="mt-1"
              placeholder="Login, name, bio, company"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-muted sm:col-span-1 xl:col-span-3">
            Location
            <Input
              className="mt-1"
              placeholder="e.g. USA, Remote, Texas"
              value={location}
              onChange={(e) => {
                setPage(1);
                setLocation(e.target.value);
              }}
            />
          </label>
          <label className="block text-xs text-muted sm:col-span-1 xl:col-span-2">
            Status
            <Select
              className="mt-1"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="legitimate">legitimate (0%)</option>
              <option value="pending">pending (1–29%)</option>
              <option value="suspicious">suspicious (30–69%)</option>
              <option value="confirmed_scam">confirmed scam (70%+)</option>
            </Select>
          </label>
          <label className="block text-xs text-muted sm:col-span-1 xl:col-span-2">
            Sort by
            <Select
              className="mt-1"
              value={sort}
              onChange={(e) => {
                setPage(1);
                setSort(e.target.value);
              }}
            >
              <option value="lastScrapedAt">Last synced</option>
              <option value="followers">Followers</option>
              <option value="publicRepos">Repos</option>
              <option value="riskScore">Risk score</option>
              <option value="githubCreatedAt">Account created</option>
              <option value="login">Login</option>
            </Select>
          </label>
          <label className="block text-xs text-muted sm:col-span-1 xl:col-span-1">
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
      </Card>

      {isAdmin && selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--alert-warning-border)] bg-[color:var(--alert-warning-bg)] px-4 py-3 text-sm shadow-sm">
          <span className="mr-1 font-semibold text-[color:var(--alert-warning-fg)]">
            {selected.size} selected
          </span>
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => bulk("mark_legitimate")}>
            Mark legitimate
          </Button>
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => bulk("mark_suspicious")}>
            Mark suspicious
          </Button>
          <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => bulk("confirm_scam")}>
            Confirm scam
          </Button>
          <Button variant="danger" className="!px-3 !py-1.5 text-xs" onClick={() => bulk("soft_delete")}>
            Soft delete
          </Button>
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="ui-table-head text-[11px] font-semibold uppercase tracking-[0.06em]">
              <tr>
                <th className="px-3 py-3.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-[color:var(--accent)]"
                    onChange={toggleAll}
                    checked={!!data && selected.size === data.items.length && data.items.length > 0}
                  />
                </th>
                <th className="px-3 py-3.5">User</th>
                <th className="px-3 py-3.5">Contact</th>
                <th className="px-3 py-3.5">Bio</th>
                <th className="px-3 py-3.5">Location</th>
                <th className="px-3 py-3.5">Repos</th>
                <th className="px-3 py-3.5">Followers</th>
                <th className="px-3 py-3.5">Risk</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5">Scraped</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && data?.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted">
                    No users found
                  </td>
                </tr>
              ) : null}
              {data?.items.map((user) => {
                const contacts = contactItems(user);
                return (
                  <tr
                    key={user.id}
                    className="ui-row-hover border-t border-border align-top transition"
                  >
                    <td className="px-3 py-3.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-[color:var(--accent)]"
                        checked={selected.has(user.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(user.id);
                          else next.delete(user.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Link
                          href={`/admin/users/${user.id}`}
                          scroll={false}
                          onClick={rememberBeforeOpenDetail}
                          className="shrink-0 transition hover:opacity-90"
                          title={`Open ${user.login}`}
                        >
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt={user.login}
                              width={34}
                              height={34}
                              className="rounded-full ring-2 ring-white shadow-sm"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-xs font-semibold text-muted">
                              {user.login.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </Link>
                        <div>
                          <a
                            href={user.htmlUrl || `https://github.com/${user.login}`}
                            target="_blank"
                            rel="noreferrer"
                            className="ui-link font-semibold transition hover:underline underline-offset-2"
                          >
                            {user.login}
                          </a>
                          <div className="text-xs text-muted">{user.name || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {contacts.length === 0 ? (
                        <span className="text-xs text-muted/80">empty</span>
                      ) : (
                        <div className="flex flex-nowrap items-center gap-1.5">
                          {contacts.map((item) => (
                            <CopyContactChip key={item.kind} kind={item.kind} value={item.value} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3.5 text-muted">
                      {user.bio || "—"}
                    </td>
                    <td className="px-3 py-3.5 text-foreground/90">{user.location || "—"}</td>
                    <td className="px-3 py-3.5 font-medium tabular-nums text-foreground">
                      {user.publicRepos}
                    </td>
                    <td className="px-3 py-3.5 font-medium tabular-nums text-foreground">
                      {user.followers}
                    </td>
                    <td className="px-3 py-3.5 font-medium tabular-nums text-foreground">
                      {Math.min(100, Math.max(0, user.riskScore))}%
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge
                        tone={
                          user.validationStatus === "confirmed_scam"
                            ? "danger"
                            : user.validationStatus === "suspicious"
                              ? "warning"
                              : user.validationStatus === "legitimate"
                                ? "success"
                                : "info"
                        }
                      >
                        {user.validationStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-muted">
                      {formatDate(user.firstScrapedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted">
            Page {data.page} of {data.totalPages} · {data.total} users
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-muted">
              <span className="whitespace-nowrap">Rows per page</span>
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
            </label>
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

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading users…</div>}>
      <UsersTable />
    </Suspense>
  );
}
