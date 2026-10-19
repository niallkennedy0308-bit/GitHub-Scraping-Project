"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Button, Card, Input } from "@/components/admin/ui";
import { evaluateRules } from "@/lib/scam-rules/evaluate";
import {
  EMPTY_SIMPLE_RULE_FORM,
  rulesToSimpleForm,
  simpleFormToRules,
  type SimpleRuleForm,
} from "@/lib/scam-rules/simple-form";

type Rule = {
  id?: string;
  name: string;
  field: string;
  operator: string;
  value?: string | null;
  valueTo?: string | null;
  severity: "info" | "low" | "medium" | "high" | "exclusion";
  action: "flag" | "exclude" | "score";
  scoreWeight: number;
  description?: string | null;
  enabled: boolean;
};

type RuleSet = {
  id: string;
  name: string;
  description?: string | null;
  groupLogic: "AND" | "OR";
  enabled: boolean;
  rules: Rule[];
};

const SAMPLE = {
  login: "Tyrese-FullStackGenius",
  id: 133923231,
  name: "Tyrese, Full Stack Genius",
  company: null,
  blog: "",
  location: null,
  email: null,
  hireable: true,
  bio: "Full Stack Web Developer with DevOps experience.",
  twitter_username: null,
  public_repos: 53,
  public_gists: 0,
  followers: 114,
  following: 2,
  created_at: "2023-05-17T22:18:31Z",
  updated_at: "2025-02-10T07:20:34Z",
  type: "User",
  site_admin: false,
};

export default function RulesPage() {
  const [sets, setSets] = useState<RuleSet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("New rule set");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [form, setForm] = useState<SimpleRuleForm>({ ...EMPTY_SIMPLE_RULE_FORM });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => sets.find((s) => s.id === selectedId) || null,
    [sets, selectedId],
  );

  async function load() {
    const res = await fetch("/api/admin/rule-sets");
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
    const data = (await res.json()) as RuleSet[];
    setSets(data);
    if (!selectedId && data[0]) {
      setSelectedId(data[0].id);
    }
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setDescription(selected.description || "");
    setEnabled(selected.enabled);
    setForm(rulesToSimpleForm(selected.rules));
    setTestResult(null);
  }, [selected]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const rules = simpleFormToRules(form);
    if (rules.length === 0) {
      setError("Enable at least one condition before saving.");
      return;
    }

    const payload = {
      name,
      description,
      groupLogic: "OR" as const,
      enabled,
      rules,
    };

    const res = await fetch(
      selectedId ? `/api/admin/rule-sets/${selectedId}` : "/api/admin/rule-sets",
      {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      setError((await res.json()).error || "Save failed");
      return;
    }
    const saved = await res.json();
    setSelectedId(saved.id);
    await load();
  }

  function createNew() {
    setSelectedId(null);
    setName("New rule set");
    setDescription("");
    setEnabled(true);
    setForm({ ...EMPTY_SIMPLE_RULE_FORM });
    setTestResult(null);
  }

  function testRules() {
    const rules = simpleFormToRules(form).map((rule, index) => ({
      ...rule,
      id: `temp-${index}`,
      severity: rule.severity || "medium",
      action: rule.action || "flag",
      scoreWeight: rule.scoreWeight ?? 10,
      enabled: true,
    }));
    const decision = evaluateRules(SAMPLE, rules, "OR");
    setTestResult(
      [
        `Flagged: ${decision.flagged}`,
        `Excluded: ${decision.excluded}`,
        `Risk score: ${decision.riskScore}`,
        `Status: ${decision.status}`,
        decision.reasons.length ? `Reasons:\n- ${decision.reasons.join("\n- ")}` : "No matches",
        "Note: flagged does not mean confirmed scam.",
      ].join("\n"),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scam Detection Rules"
        description="Configure simple profile checks used to flag users for review. Flagged does not mean confirmed scam."
        actions={
          <Button type="button" variant="secondary" onClick={createNew}>
            New rule set
          </Button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <Card className="p-3">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Rule sets
          </p>
          <div className="space-y-1">
            {sets.map((set) => (
              <button
                key={set.id}
                type="button"
                onClick={() => setSelectedId(set.id)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  selectedId === set.id ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]" : "hover:bg-[color:var(--surface-muted)]"
                }`}
              >
                {set.name}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-muted">
                Rule set name
                <Input
                  className="mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="flex items-center gap-2 self-end text-sm text-foreground/90 md:pb-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Rule set enabled
              </label>
              <label className="text-sm text-muted md:col-span-2">
                Description
                <Input
                  className="mt-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes for this rule set"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-border bg-[color:var(--surface-muted)] p-4 md:p-5">
              <h2 className="font-semibold text-foreground">Detection conditions</h2>
              <p className="mt-1 text-sm text-muted">
                Fill only the conditions you want to check. Empty fields are ignored.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-muted">
                  Location
                  <Input
                    className="mt-1"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. London"
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Flag when profile location contains this value.
                  </span>
                </label>

                <label className="text-sm text-muted">
                  Created date
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.createdDate}
                    onChange={(e) => setForm({ ...form, createdDate: e.target.value })}
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Flag accounts created after this date.
                  </span>
                </label>

                <label className="text-sm text-muted md:col-span-2">
                  Repository number
                  <Input
                    className="mt-1 max-w-xs"
                    type="number"
                    min={0}
                    value={form.repositoryNumber}
                    onChange={(e) => setForm({ ...form, repositoryNumber: e.target.value })}
                    placeholder="e.g. 5"
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Flag when public repositories are less than or equal to this number.
                  </span>
                </label>
              </div>

              <div className="mt-6 space-y-3 rounded-xl border border-border bg-[color:var(--surface-solid)] p-4">
                <p className="text-sm font-medium text-foreground">Missing profile signals</p>
                <p className="text-xs text-muted">
                  Checked items flag a user when that information is missing.
                </p>

                <label className="flex items-center gap-3 text-sm text-foreground/90">
                  <input
                    type="checkbox"
                    checked={form.checkEmail}
                    onChange={(e) => setForm({ ...form, checkEmail: e.target.checked })}
                  />
                  Email
                </label>

                <label className="flex items-center gap-3 text-sm text-foreground/90">
                  <input
                    type="checkbox"
                    checked={form.checkLinkedin}
                    onChange={(e) => setForm({ ...form, checkLinkedin: e.target.checked })}
                  />
                  LinkedIn
                </label>

                <label className="flex items-center gap-3 text-sm text-foreground/90">
                  <input
                    type="checkbox"
                    checked={form.checkSocialLinks}
                    onChange={(e) => setForm({ ...form, checkSocialLinks: e.target.checked })}
                  />
                  Any social links
                </label>

                <label className="flex items-center gap-3 text-sm text-foreground/90">
                  <input
                    type="checkbox"
                    checked={form.checkCompany}
                    onChange={(e) => setForm({ ...form, checkCompany: e.target.checked })}
                  />
                  Company
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={testRules}>
                Test against sample profile
              </Button>
              <Button type="submit">Save rule set</Button>
            </div>

            {testResult ? (
              <pre className="whitespace-pre-wrap rounded-xl bg-[color:var(--surface-muted)] p-4 text-xs text-foreground/90">
                {testResult}
              </pre>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  );
}
