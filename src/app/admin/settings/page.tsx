"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ThemeSwitcher } from "@/components/admin/theme-switcher";
import { Alert, Badge, Button, Card, Input } from "@/components/admin/ui";

type SettingsResponse = {
  email: string;
  githubToken: {
    configured: boolean;
    maskedToken: string | null;
  };
  verifiedAs?: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/settings");
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load settings");
    setSettings(await res.json());
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

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
      setSuccess(
        data.verifiedAs
          ? `Token saved and verified as @${data.verifiedAs}.`
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

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">GitHub personal access token</h2>
            <p className="mt-1 text-sm text-muted">
              Required before starting any scraping job. Stored encrypted for your admin account
              only and never shown in full again.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Account:</span>
              <span className="font-medium text-foreground">{settings?.email || "…"}</span>
              {settings?.githubToken.configured ? (
                <Badge tone="success">Configured ({settings.githubToken.maskedToken})</Badge>
              ) : (
                <Badge tone="warning">Not configured</Badge>
              )}
            </div>

            <form onSubmit={onSave} className="mt-5 space-y-4">
              <label className="block text-sm text-muted">
                Personal access token
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

              <div className="rounded-xl border border-border bg-[color:var(--surface-muted)] px-4 py-3 text-xs text-muted">
                Create a token in GitHub → Settings → Developer settings → Personal access tokens.
                Public user search/profile reads are enough for this app.
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="ui-link mt-2 inline-flex items-center gap-1 font-medium hover:underline"
                >
                  Open GitHub token settings
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

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
                      Save & verify token
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
          </div>
        </div>
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
