"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Copy, Check } from "lucide-react";
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

function contactDisplay(user: UserRow): { kind: "linkedin" | "email" | "empty"; value: string } {
  const linkedin =
    user.linkedinUrl?.trim() ||
    (user.blog?.trim() && /linkedin\.com/i.test(user.blog) ? user.blog.trim() : "");
  if (linkedin) return { kind: "linkedin", value: linkedin };
  if (user.email?.trim()) return { kind: "email", value: user.email.trim() };
  return { kind: "empty", value: "empty" };
}

function CopyContactChip({
  kind,
  value,
}: {
  kind: "linkedin" | "email";
  value: string;
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
      title={`Copy ${value}`}
      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-300/90 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white"
    >
      <span>{kind === "linkedin" ? "Linkedin" : "Email"}</span>
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-70" />
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

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort,
      order,
    });
    if (debouncedQ) params.set("q", debouncedQ);
    if (status) params.set("status", status);
    if (jobId) params.set("jobId", jobId);
    return params.toString();
  }, [page, pageSize, sort, order, debouncedQ, status, jobId]);

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
  }, [q, status, sort, order, page, pageSize]);

  useEffect(() => {
    saveUsersListMemory({
      q,
      status,
      sort,
      order,
      page,
      pageSize,
      scrollY: window.scrollY || window.pageYOffset || 0,
    });
  }, [q, status, sort, order, page, pageSize]);

  // Restore after table content is ready (and when returning from detail).
  useEffect(() => {
    if (loading || !data) return;
    if (!shouldRestoreRef.current && !peekUsersListRestorePending()) return;

    let done = false;
    const tryRestore = () => {
      if (done) return;
      const y = restoreScroll("/admin/users");
      if (y == null || y <= 0) return;
      // Confirm the browser actually landed near the target before clearing the flag.
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

      <Card className="flex flex-wrap gap-3 p-4">
        <Input
          className="min-w-[220px] flex-1"
          placeholder="Search login, name, bio, company, location"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <Select
          className="w-auto min-w-[10rem]"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">pending</option>
          <option value="legitimate">legitimate</option>
          <option value="suspicious">suspicious</option>
          <option value="confirmed_scam">confirmed_scam</option>
        </Select>
        <Select
          className="w-auto min-w-[12rem]"
          value={`${sort}:${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split(":");
            setSort(s);
            setOrder(o as "asc" | "desc");
          }}
        >
          <option value="lastScrapedAt:desc">Last synced ↓</option>
          <option value="followers:desc">Followers ↓</option>
          <option value="publicRepos:desc">Repos ↓</option>
          <option value="riskScore:desc">Risk score ↓</option>
          <option value="githubCreatedAt:desc">Account created ↓</option>
          <option value="login:asc">Login A–Z</option>
        </Select>
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
                const contact = contactDisplay(user);
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
                    {contact.kind === "empty" ? (
                      <span className="text-xs text-muted/80">empty</span>
                    ) : (
                      <CopyContactChip kind={contact.kind} value={contact.value} />
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
                    {user.riskScore}
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
                className="w-auto min-w-[5.5rem]"
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
