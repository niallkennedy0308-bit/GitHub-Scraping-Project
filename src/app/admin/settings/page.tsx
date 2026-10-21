"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, KeyRound, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ThemeSwitcher } from "@/components/admin/theme-switcher";
import { Alert, Badge, Button, Card, Input } from "@/components/admin/ui";

type RateLimitInfo = {
  coreLimit?: number;
  coreRemaining?: number;
  coreReset?: number;
  searchLimit?: number;
  searchRemaining?: number;
  searchReset?: number;
  authenticated?: boolean;
  error?: string;
};

type SettingsResponse = {
  email: string;
  githubToken: {
    configured: boolean;
    maskedToken: string | null;
  };
  rateLimit?: RateLimitInfo | null;
  verifiedAs?: string;
};

const EXPECTED = {
  classicCore: 5000,
  classicSearch: 30,
  unauthCore: 60,
  unauthSearch: 10,
} as const;

function tokenKind(masked: string | null | undefined): "classic" | "fine-grained" | "unknown" {
  const value = (masked || "").toLowerCase();
  if (value.startsWith("ghp_")) return "classic";
  if (value.startsWith("github_pat_")) return "fine-grained";
  return "unknown";
}

function QuotaBar({
  label,
  remaining,
  limit,
  hint,
}: {
  label: string;
  remaining?: number;
  limit?: number;
  hint?: string;
}) {
  const safeLimit = typeof limit === "number" && limit > 0 ? limit : 0;
  const safeRemaining = typeof remaining === "number" ? Math.max(0, remaining) : 0;
  const pct = safeLimit > 0 ? Math.min(100, Math.round((safeRemaining / safeLimit) * 100)) : 0;
  const depleted = safeLimit > 0 && safeRemaining <= 0;
  const low = safeLimit > 0 && safeRemaining > 0 && pct <= 15;

  return (
    <div className="rounded-xl border border-border bg-[color:var(--surface)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span
          className={`font-mono text-sm tabular-nums ${
            depleted
              ? "text-[color:var(--badge-danger-fg)]"
              : low
                ? "text-[color:var(--badge-warning-fg)]"
                : "text-foreground"
          }`}
        >
          {safeLimit > 0 ? `${safeRemaining} / ${safeLimit}` : "—"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
        <div
          className={`h-full rounded-full transition-all ${
            depleted
              ? "bg-[color:var(--badge-danger-fg)]"
              : low
                ? "bg-[color:var(--badge-warning-fg)]"
                : "bg-[color:var(--accent)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load settings");
    setSettings(await res.json());
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const rateLimit = settings?.rateLimit;
  const hasQuotaError = Boolean(rateLimit && "error" in rateLimit && rateLimit.error);
  const kind = tokenKind(settings?.githubToken.maskedToken);
  const healthyQuota = Boolean(rateLimit?.authenticated);
  const coreLimit = rateLimit?.coreLimit ?? 0;
  const coreRemaining = rateLimit?.coreRemaining ?? 0;
  const resetLabel = rateLimit?.coreReset
    ? new Date(rateLimit.coreReset * 1000).toLocaleString()
    : null;

  const status = useMemo(() => {
    if (!settings?.githubToken.configured) {
      return {
        badge: "Not configured" as const,
        tone: "warning" as const,
        summary: "Add a GitHub token before you can scrape.",
      };
    }
    if (hasQuotaError) {
      return {
        badge: "Quota unavailable" as const,
        tone: "warning" as const,
        summary: rateLimit?.error || "Could not read GitHub quota.",
      };
    }
    if (!healthyQuota) {
      return {
        badge: "Low access limit" as const,
        tone: "danger" as const,
        summary: `GitHub is only allowing ~${coreLimit || EXPECTED.unauthCore} core requests/hour (need ~${EXPECTED.classicCore}).`,
      };
    }
    if (coreRemaining < 10) {
      return {
        badge: "Quota exhausted" as const,
        tone: "warning" as const,
        summary: resetLabel
          ? `Authenticated, but almost no requests left. Resets ${resetLabel}.`
          : "Authenticated, but almost no requests left. Wait for the hourly reset.",
      };
    }
    return {
      badge: "Ready to scrape" as const,
      tone: "success" as const,
      summary: `Authenticated access · up to ~${coreLimit} core requests/hour.`,
    };
  }, [
    settings?.githubToken.configured,
    hasQuotaError,
    healthyQuota,
    coreLimit,
    coreRemaining,
    resetLabel,
    rateLimit?.error,
  ]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubToken: token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save token");
        return;
      }
      setSettings(data);
      setToken("");
      const limit = data.rateLimit?.coreLimit;
      setSuccess(
        data.verifiedAs
          ? `Saved and verified as @${data.verifiedAs}${
              typeof limit === "number" ? ` · core limit ${limit}/hour` : ""
            }.`
          : "Token saved successfully.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onClear() {
    if (!window.confirm("Remove your GitHub personal access token from this account?")) {
      return;
    }
    setError(null);
    setSuccess(null);
    setClearing(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearToken: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to remove token");
        return;
      }
      setSettings(data);
      setSuccess("GitHub token removed. Scraping is blocked until you add a new token.");
    } finally {
      setClearing(false);
    }
  }

  async function onRefreshQuota() {
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh quota");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your personal GitHub access token. Each admin uses their own token for scraping."
      />

      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <Card className="p-5">
        <ThemeSwitcher />
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">GitHub access</h2>
                <p className="mt-1 text-sm text-muted">
                  Encrypted for {settings?.email || "your account"} · never shown in full again
                </p>
              </div>
              <Badge tone={status.tone}>{status.badge}</Badge>
            </div>
            <p className="mt-3 text-sm text-foreground">{status.summary}</p>

            {settings?.githubToken.configured ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <span>
                  Token:{" "}
                  <code className="font-mono text-foreground">
                    {settings.githubToken.maskedToken}
                  </code>
                </span>
                <span>
                  Type:{" "}
                  {kind === "classic"
                    ? "Classic (ghp_)"
                    : kind === "fine-grained"
                      ? "Fine-grained (github_pat_)"
                      : "Unknown"}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Expected limits */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-foreground">Possible access limits</h3>
          <p className="mt-1 text-xs text-muted">
            Scraping uses core requests (about 1 per user profile). Search is used for discovery.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-[color:var(--surface-muted)] text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Token situation</th>
                  <th className="px-4 py-2.5 font-medium">Core / hour</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Search / hour</th>
                  <th className="px-4 py-2.5 font-medium">Rough users / hour</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr
                  className={
                    settings?.githubToken.configured && !healthyQuota && !hasQuotaError
                      ? "bg-[color:var(--badge-danger-bg)]/40"
                      : undefined
                  }
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">No token / low access</div>
                    <div className="text-xs text-muted">What you have now if limit is 60</div>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">{EXPECTED.unauthCore}</td>
                  <td className="hidden px-4 py-3 font-mono tabular-nums sm:table-cell">
                    {EXPECTED.unauthSearch}
                  </td>
                  <td className="px-4 py-3 text-muted">~60</td>
                </tr>
                <tr
                  className={
                    healthyQuota ? "bg-[color:var(--badge-success-bg)]/35" : undefined
                  }
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">Classic PAT (recommended)</div>
                    <div className="text-xs text-muted">
                      Starts with <code className="font-mono">ghp_</code>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">~{EXPECTED.classicCore}</td>
                  <td className="hidden px-4 py-3 font-mono tabular-nums sm:table-cell">
                    ~{EXPECTED.classicSearch}
                  </td>
                  <td className="px-4 py-3 text-muted">thousands</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Live quota */}
        {settings?.githubToken.configured ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">Your current quota</h3>
              <Button
                type="button"
                variant="secondary"
                className="!px-3 !py-1.5 text-xs"
                onClick={onRefreshQuota}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
            </div>

            {hasQuotaError ? (
              <div className="mt-3">
                <Alert tone="warning">{rateLimit?.error}</Alert>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <QuotaBar
                  label="Core API"
                  remaining={rateLimit?.coreRemaining}
                  limit={rateLimit?.coreLimit}
                  hint={
                    resetLabel
                      ? `Resets ${resetLabel}${
                          !healthyQuota
                            ? ` · target ~${EXPECTED.classicCore}/hour`
                            : ""
                        }`
                      : undefined
                  }
                />
                <QuotaBar
                  label="Search API"
                  remaining={rateLimit?.searchRemaining}
                  limit={rateLimit?.searchLimit}
                  hint={
                    !healthyQuota
                      ? `Target ~${EXPECTED.classicSearch}/hour with a classic token`
                      : undefined
                  }
                />
              </div>
            )}

            {!hasQuotaError && !healthyQuota ? (
              <div className="mt-3">
                <Alert tone="warning">
                  Your token is saved and GitHub accepts it, but GitHub still assigned only ~
                  {EXPECTED.unauthCore}/hour (not ~{EXPECTED.classicCore}). Fine-grained tokens (
                  <code className="font-mono">github_pat_</code>) often stay on this low bucket —
                  create a <strong>classic</strong> token (
                  <code className="font-mono">ghp_</code>) under Tokens (classic), save it here, then
                  Refresh. If Core is still {EXPECTED.unauthCore}, the GitHub account itself is
                  restricted (common on new/untrusted accounts).
                </Alert>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Save form */}
        <form onSubmit={onSave} className="mt-6 space-y-4 border-t border-border pt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <label className="block min-w-[16rem] flex-1 text-sm text-muted">
              {settings?.githubToken.configured ? "Replace token" : "Paste personal access token"}
              <Input
                className="mt-1 font-mono"
                type="password"
                autoComplete="off"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </label>
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="ui-link mb-2 inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              Create on GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
            <li>
              Open GitHub → Settings → Developer settings → Personal access tokens →{" "}
              <strong className="text-foreground">Tokens (classic)</strong>
            </li>
            <li>Generate a token (no special scopes needed for public profiles)</li>
            <li>Paste it here and save — confirm Core limit becomes ~{EXPECTED.classicCore}</li>
          </ol>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving || !token.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Save & verify
                </>
              )}
            </Button>
            {settings?.githubToken.configured ? (
              <Button type="button" variant="danger" onClick={onClear} disabled={clearing}>
                {clearing ? "Removing…" : "Remove token"}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {!settings?.githubToken.configured ? (
        <Alert tone="warning">
          Scraping is blocked until you save a token.{" "}
          <Link href="/admin/configurations" className="font-medium underline">
            Go to configurations
          </Link>{" "}
          after saving.
        </Alert>
      ) : null}
    </div>
  );
}
