"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Link2, Plus, Search } from "lucide-react";
import {
  buildGitHubUserSearchQuery,
  buildGitHubUserSearchUrl,
  EMPTY_SEARCH_BUILDER,
  parseGitHubUserSearchQuery,
  type GitHubSearchBuilderState,
  type NumericComparator,
} from "@/lib/github-search-builder";
import { Button, Input, Select } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Props = {
  value: GitHubSearchBuilderState;
  onChange: (next: GitHubSearchBuilderState) => void;
  className?: string;
};

const COMPARATORS: { value: NumericComparator; label: string }[] = [
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: "", label: "=" },
];

type AdvancedKey =
  | "organization"
  | "fullname"
  | "repos"
  | "followers"
  | "location"
  | "language"
  | "created"
  | "sponsorable"
  | "hireable";

const ADVANCED_OPTIONS: { key: AdvancedKey; label: string }[] = [
  { key: "organization", label: "Organization" },
  { key: "fullname", label: "Full name" },
  { key: "repos", label: "Number of repositories" },
  { key: "followers", label: "Number of followers" },
  { key: "location", label: "Location" },
  { key: "language", label: "Language" },
  { key: "created", label: "Creation date" },
  { key: "sponsorable", label: "Sponsorable" },
  { key: "hireable", label: "Hireable" },
];

function isActive(state: GitHubSearchBuilderState, key: AdvancedKey): boolean {
  switch (key) {
    case "organization":
      return Boolean(state.organization.trim());
    case "fullname":
      return Boolean(state.fullname.trim());
    case "location":
      return Boolean(state.location.trim());
    case "language":
      return Boolean(state.language.trim());
    case "repos":
      return Boolean(state.repos.trim());
    case "followers":
      return Boolean(state.followers.trim());
    case "created":
      return Boolean(state.created.trim());
    case "sponsorable":
      return state.sponsorable;
    case "hireable":
      return state.hireable;
  }
}

export function GitHubSearchBuilder({ value, onChange, className }: Props) {
  const [openFields, setOpenFields] = useState<AdvancedKey[]>(() =>
    ADVANCED_OPTIONS.filter((o) => isActive(value, o.key)).map((o) => o.key),
  );
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteValue, setPasteValue] = useState("");

  const query = useMemo(() => buildGitHubUserSearchQuery(value), [value]);
  const url = useMemo(() => buildGitHubUserSearchUrl(value), [value]);

  function patch(partial: Partial<GitHubSearchBuilderState>) {
    onChange({ ...value, ...partial });
  }

  function addField(key: AdvancedKey) {
    setOpenFields((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function removeField(key: AdvancedKey) {
    setOpenFields((prev) => prev.filter((k) => k !== key));
    switch (key) {
      case "organization":
        patch({ organization: "" });
        break;
      case "fullname":
        patch({ fullname: "" });
        break;
      case "location":
        patch({ location: "" });
        break;
      case "language":
        patch({ language: "" });
        break;
      case "repos":
        patch({ repos: "", reposComparator: ">" });
        break;
      case "followers":
        patch({ followers: "", followersComparator: ">" });
        break;
      case "created":
        patch({ created: "", createdComparator: ">" });
        break;
      case "sponsorable":
        patch({ sponsorable: false });
        break;
      case "hireable":
        patch({ hireable: false });
        break;
    }
  }

  function applyPastedUrl() {
    const trimmed = pasteValue.trim();
    if (!trimmed) return;

    let q = trimmed;
    try {
      if (trimmed.includes("://")) {
        const parsed = new URL(trimmed);
        q = parsed.searchParams.get("q") || trimmed;
      }
    } catch {
      // treat as raw query
    }

    const next = parseGitHubUserSearchQuery(q);
    onChange(next);
    setOpenFields(ADVANCED_OPTIONS.filter((o) => isActive(next, o.key)).map((o) => o.key));
    setPasteMode(false);
  }

  const available = ADVANCED_OPTIONS.filter((o) => !openFields.includes(o.key));

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">GitHub user search</h3>
          <p className="text-xs text-muted">
            Build the search like GitHub — the scrape URL updates as you type.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-xs"
          onClick={() => {
            setPasteMode((v) => !v);
            setPasteValue(url || "");
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
          {pasteMode ? "Use builder" : "Paste existing URL"}
        </Button>
      </div>

      {pasteMode ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-[color:var(--accent)]/35 bg-[color:var(--accent-soft)] p-4">
          <label className="block text-sm text-muted">
            Paste a GitHub users search URL or query
            <Input
              className="mt-1 font-mono text-xs"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="https://github.com/search?q=full+stack&type=users"
            />
          </label>
          <Button type="button" onClick={applyPastedUrl}>
            Import into builder
          </Button>
        </div>
      ) : null}

      <label className="block text-sm text-muted">
        Search keywords
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            value={value.keywords}
            onChange={(e) => patch({ keywords: e.target.value })}
            placeholder="full stack"
          />
        </div>
      </label>

      <div className="rounded-2xl border border-border bg-[color:var(--surface-muted)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Advanced</p>
          {openFields.length > 0 ? (
            <button
              type="button"
              className="text-xs text-muted hover:text-foreground/90"
              onClick={() => {
                setOpenFields([]);
                onChange({ ...EMPTY_SEARCH_BUILDER, keywords: value.keywords });
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="space-y-3">
          {openFields.includes("organization") ? (
            <FilterRow label="Organization" onRemove={() => removeField("organization")}>
              <Input
                value={value.organization}
                onChange={(e) => patch({ organization: e.target.value })}
                placeholder="github"
              />
            </FilterRow>
          ) : null}

          {openFields.includes("fullname") ? (
            <FilterRow label="Full name" onRemove={() => removeField("fullname")}>
              <Input
                value={value.fullname}
                onChange={(e) => patch({ fullname: e.target.value })}
                placeholder="Jane Doe"
              />
            </FilterRow>
          ) : null}

          {openFields.includes("repos") ? (
            <FilterRow label="Number of repositories" onRemove={() => removeField("repos")}>
              <div className="grid grid-cols-[88px_1fr] gap-2">
                <Select
                  value={value.reposComparator}
                  onChange={(e) =>
                    patch({ reposComparator: e.target.value as NumericComparator })
                  }
                >
                  {COMPARATORS.map((c) => (
                    <option key={c.label} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={0}
                  value={value.repos}
                  onChange={(e) => patch({ repos: e.target.value })}
                  placeholder="10"
                />
              </div>
            </FilterRow>
          ) : null}

          {openFields.includes("followers") ? (
            <FilterRow label="Number of followers" onRemove={() => removeField("followers")}>
              <div className="grid grid-cols-[88px_1fr] gap-2">
                <Select
                  value={value.followersComparator}
                  onChange={(e) =>
                    patch({ followersComparator: e.target.value as NumericComparator })
                  }
                >
                  {COMPARATORS.map((c) => (
                    <option key={c.label} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={0}
                  value={value.followers}
                  onChange={(e) => patch({ followers: e.target.value })}
                  placeholder="100"
                />
              </div>
            </FilterRow>
          ) : null}

          {openFields.includes("location") ? (
            <FilterRow label="Location" onRemove={() => removeField("location")}>
              <Input
                value={value.location}
                onChange={(e) => patch({ location: e.target.value })}
                placeholder="London"
              />
            </FilterRow>
          ) : null}

          {openFields.includes("language") ? (
            <FilterRow label="Language" onRemove={() => removeField("language")}>
              <Input
                value={value.language}
                onChange={(e) => patch({ language: e.target.value })}
                placeholder="TypeScript"
              />
            </FilterRow>
          ) : null}

          {openFields.includes("created") ? (
            <FilterRow label="Creation date" onRemove={() => removeField("created")}>
              <div className="grid grid-cols-[88px_1fr] gap-2">
                <Select
                  value={value.createdComparator}
                  onChange={(e) =>
                    patch({ createdComparator: e.target.value as NumericComparator })
                  }
                >
                  {COMPARATORS.map((c) => (
                    <option key={c.label} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="date"
                  value={value.created}
                  onChange={(e) => patch({ created: e.target.value })}
                />
              </div>
            </FilterRow>
          ) : null}

          {openFields.includes("sponsorable") ? (
            <FilterRow label="Sponsorable" onRemove={() => removeField("sponsorable")}>
              <label className="flex items-center gap-2 text-sm text-foreground/90">
                <input
                  type="checkbox"
                  checked={value.sponsorable}
                  onChange={(e) => patch({ sponsorable: e.target.checked })}
                />
                Only sponsorable users
              </label>
            </FilterRow>
          ) : null}

          {openFields.includes("hireable") ? (
            <FilterRow label="Hireable" onRemove={() => removeField("hireable")}>
              <label className="flex items-center gap-2 text-sm text-foreground/90">
                <input
                  type="checkbox"
                  checked={value.hireable}
                  onChange={(e) => patch({ hireable: e.target.checked })}
                />
                Only hireable users
              </label>
            </FilterRow>
          ) : null}
        </div>

        {available.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {available.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  addField(option.key);
                  if (option.key === "sponsorable") patch({ sponsorable: true });
                  if (option.key === "hireable") patch({ hireable: true });
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--surface-solid)] px-3 py-1 text-xs font-medium text-foreground transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                <Plus className="h-3 w-3" />
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[color:var(--accent)]/30 bg-[color:var(--accent-soft)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--accent)]">
          Generated GitHub URL
        </p>
        {url ? (
          <>
            <p className="mt-2 break-all font-mono text-xs text-foreground">{url}</p>
            <p className="mt-2 text-xs text-muted">
              Query: <span className="font-mono">{query}</span>
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--accent-strong)] hover:underline"
            >
              Preview on GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Enter keywords or add advanced filters to generate a search URL.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-[color:var(--surface-solid)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted hover:text-rose-600"
        >
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}
