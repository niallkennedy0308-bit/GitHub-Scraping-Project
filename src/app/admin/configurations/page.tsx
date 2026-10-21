"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { GitHubSearchBuilder } from "@/components/admin/github-search-builder";
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Textarea } from "@/components/admin/ui";
import {
  buildGitHubUserSearchUrl,
  EMPTY_SEARCH_BUILDER,
  type GitHubSearchBuilderState,
} from "@/lib/github-search-builder";
import { formatDate } from "@/lib/utils";

type RuleSet = { id: string; name: string };
type Config = {
  id: string;
  name: string;
  description?: string | null;
  githubSearchUrl: string;
  searchQuery?: string | null;
  enabled: boolean;
  ruleSet?: RuleSet | null;
  createdBy?: { email: string; name?: string | null };
  updatedAt: string;
  _count?: { jobs: number };
};

export default function ConfigurationsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [startingConfigId, setStartingConfigId] = useState<string | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);
  const [search, setSearch] = useState<GitHubSearchBuilderState>({
    ...EMPTY_SEARCH_BUILDER,
    keywords: "fullstack",
  });
  const [form, setForm] = useState({
    name: "",
    description: "",
    ruleSetId: "",
    enabled: true,
  });

  const generatedUrl = useMemo(() => buildGitHubUserSearchUrl(search), [search]);

  async function load() {
    const [cRes, rRes, sRes] = await Promise.all([
      fetch("/api/admin/configurations"),
      fetch("/api/admin/rule-sets"),
      fetch("/api/admin/settings"),
    ]);
    if (!cRes.ok) throw new Error((await cRes.json()).error || "Failed to load configs");
    if (!rRes.ok) throw new Error((await rRes.json()).error || "Failed to load rule sets");
    setConfigs(await cRes.json());
    setRuleSets(await rRes.json());
    if (sRes.ok) {
      const settings = await sRes.json();
      setTokenConfigured(Boolean(settings.githubToken?.configured));
    } else {
      setTokenConfigured(false);
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function validateGeneratedUrl() {
    setValidationMsg(null);
    if (!generatedUrl) {
      setValidationMsg("Add keywords or advanced filters first");
      return false;
    }

    const res = await fetch("/api/admin/configurations/validate-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: generatedUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      setValidationMsg(data.error || "Invalid search");
      return false;
    }
    setValidationMsg(`Valid · query: ${data.searchQuery}`);
    return true;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!generatedUrl) {
      setError("Build a GitHub user search before saving");
      return;
    }

    const ok = await validateGeneratedUrl();
    if (!ok) return;

    const res = await fetch("/api/admin/configurations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        githubSearchUrl: generatedUrl,
        ruleSetId: form.ruleSetId || null,
        enabled: form.enabled,
      }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Create failed");
      return;
    }

    setForm({ name: "", description: "", ruleSetId: "", enabled: true });
    setSearch({ ...EMPTY_SEARCH_BUILDER });
    setValidationMsg(null);
    await load();
  }

  async function toggleEnabled(config: Config) {
    await fetch(`/api/admin/configurations/${config.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !config.enabled }),
    });
    await load();
  }

  async function removeConfig(config: Config) {
    const used = (config._count?.jobs || 0) > 0;
    const message = used
      ? `Delete “${config.name}”? This removes the search URL from the deduplication list so it can be set up again. Existing job history is kept.`
      : `Delete “${config.name}”? This search URL will no longer be reserved.`;
    if (!window.confirm(message)) return;
    setError(null);
    const res = await fetch(`/api/admin/configurations/${config.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error || "Delete failed");
      return;
    }
    await load();
  }

  async function startJob(configId: string) {
    setError(null);
    if (tokenConfigured === false) {
      setError("Add your GitHub personal access token in Settings before starting a scraping job.");
      return;
    }
    setStartingConfigId(configId);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configurationId: configId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start job");
        setStartingConfigId(null);
        if (data.code === "GITHUB_TOKEN_REQUIRED") {
          setTokenConfigured(false);
        }
        return;
      }
      router.push(`/admin/jobs/${data.id}`);
    } catch {
      setError("Failed to start job");
      setStartingConfigId(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scraping Configurations"
        description="Each GitHub search URL can be saved and scraped once. Saved URLs are kept only to block duplicates. Delete a configuration to remove that URL from the list."
      />

      {error ? <Alert>{error}</Alert> : null}

      {tokenConfigured === false ? (
        <Alert tone="warning">
          Scraping is blocked until you add a GitHub personal access token.{" "}
          <Link href="/admin/settings" className="font-medium underline">
            Open Settings
          </Link>
        </Alert>
      ) : null}

      {startingConfigId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[1px]">
          <Card className="flex w-full max-w-md flex-col items-center gap-3 px-6 py-10 text-center shadow-xl">
            <Loader2 className="h-8 w-8 animate-spin text-[color:var(--link)]" />
            <div>
              <p className="font-semibold text-foreground">Starting scraping…</p>
              <p className="mt-1 text-sm text-muted">
                Creating the job and opening the live status page.
              </p>
            </div>
          </Card>
        </div>
      ) : null}

      <Card className="p-5">
        <h2 className="font-semibold text-foreground">Create configuration</h2>
        <form onSubmit={onCreate} className="mt-4 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-muted">
              Name
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="text-sm text-muted">
              Rule set
              <Select
                className="mt-1"
                value={form.ruleSetId}
                onChange={(e) => setForm({ ...form, ruleSetId: e.target.value })}
              >
                <option value="">None</option>
                {ruleSets.map((rs) => (
                  <option key={rs.id} value={rs.id}>
                    {rs.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-muted md:col-span-2">
              Description
              <Textarea
                className="mt-1"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-border p-4 md:p-5">
            <GitHubSearchBuilder value={search} onChange={setSearch} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => validateGeneratedUrl()}>
              Validate search
            </Button>
            <Button type="submit" disabled={!generatedUrl}>
              Save configuration
            </Button>
            {validationMsg ? <span className="text-sm text-muted">{validationMsg}</span> : null}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--surface-muted)] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Query</th>
                <th className="px-4 py-3 font-medium">Rules</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => {
                const used = (config._count?.jobs || 0) > 0;
                return (
                <tr key={config.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{config.name}</div>
                    <div className="text-xs text-muted">{config.createdBy?.email}</div>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted">
                    {config.searchQuery || config.githubSearchUrl}
                  </td>
                  <td className="px-4 py-3">{config.ruleSet?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {used ? <Badge tone="info">Used</Badge> : null}
                      <Badge tone={config.enabled ? "success" : "neutral"}>
                        {config.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(config.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => toggleEnabled(config)}>
                        {config.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        onClick={() => startJob(config.id)}
                        disabled={
                          used ||
                          !config.enabled ||
                          startingConfigId === config.id ||
                          tokenConfigured === false
                        }
                      >
                        {startingConfigId === config.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Starting…
                          </>
                        ) : used ? (
                          "Already used"
                        ) : (
                          "Start job"
                        )}
                      </Button>
                      <Button variant="danger" onClick={() => removeConfig(config)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {configs.length === 0 ? (
            <EmptyState title="No configurations yet" description="Create one above to get started." />
          ) : null}
        </div>
      </Card>
    </div>
  );
}
