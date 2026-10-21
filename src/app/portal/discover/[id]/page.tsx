"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  ExternalLink,
  Flag,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card } from "@/components/admin/ui";
import { GithubReadme } from "@/components/portal/github-readme";
import { reportStatusLabel } from "@/lib/portal/constants";
import { markDiscoverListRestorePending } from "@/lib/scroll-memory";
import { formatDate } from "@/lib/utils";

type Detail = {
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
  hireable?: boolean | null;
  publicRepos: number;
  publicGists: number;
  followers: number;
  following: number;
  githubCreatedAt?: string | null;
  lastScrapedAt?: string | null;
  validationStatus: string;
  isSaved: boolean;
  contactId?: string | null;
  openReport?: { id: string; status: string; reason: string } | null;
  validationHints?: string[];
  profileReadme?: string | null;
};

function toHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

function CopyIconButton({ value, label }: { value: string; label: string }) {
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

export default function PortalDiscoverDetailPage() {
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reporting, setReporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/github/${params.id}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load profile");
      setUser(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function toggleContact() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (user.isSaved && user.contactId) {
        const res = await fetch(`/api/portal/contacts/${user.contactId}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to remove");
        setSuccess("Removed from your contacts.");
      } else {
        const res = await fetch("/api/portal/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ githubUserId: user.id }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
        setSuccess("Saved to your contacts.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Contact update failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitReport() {
    if (!user) return;
    if (!window.confirm(`Report @${user.login} for administrator review?`)) return;
    setReporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/portal/scam-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubUserId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit report");
      setSuccess(
        data.message ||
          "Report submitted. An administrator will verify this profile and decide.",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setReporting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading profile…</p>;
  }
  if (!user) {
    return (
      <div className="space-y-4">
        <Alert>{error || "Profile not available"}</Alert>
        <Link
          href="/portal/discover"
          scroll={false}
          onClick={() => markDiscoverListRestorePending()}
          className="ui-link inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to discover
        </Link>
      </div>
    );
  }

  const isScam = user.validationStatus === "confirmed_scam";
  const githubUrl = user.htmlUrl || `https://github.com/${user.login}`;
  const email = user.email?.trim() || "";
  const linkedin = user.linkedinUrl?.trim() ? toHttpUrl(user.linkedinUrl) || user.linkedinUrl.trim() : "";
  const website = user.blog?.trim() || "";
  const websiteHref = website ? toHttpUrl(website) : null;
  const twitter = user.twitterUsername?.trim().replace(/^@/, "") || "";
  const company = user.company?.trim() || "";
  const companyHref = company.startsWith("@")
    ? `https://github.com/${company.slice(1)}`
    : toHttpUrl(company);
  const location = user.location?.trim() || "";
  const locationHref = location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
    : null;
  const readme = user.profileReadme?.trim() || "";

  const details: {
    label: string;
    text: string | null;
    href?: string | null;
    copy?: string | null;
  }[] = [
    { label: "Company", text: company || null, href: companyHref, copy: company || null },
    { label: "Location", text: location || null, href: locationHref, copy: location || null },
    { label: "Email", text: email || null, href: email ? `mailto:${email}` : null, copy: email || null },
    { label: "LinkedIn", text: linkedin || null, href: linkedin || null, copy: linkedin || null },
    {
      label: "Website",
      text: website || null,
      href: websiteHref,
      copy: websiteHref || website || null,
    },
    {
      label: "Twitter / X",
      text: twitter ? `@${twitter}` : null,
      href: twitter ? `https://x.com/${twitter}` : null,
      copy: twitter ? `https://x.com/${twitter}` : null,
    },
    { label: "Repos / Gists", text: `${user.publicRepos} / ${user.publicGists}` },
    { label: "Followers / Following", text: `${user.followers} / ${user.following}` },
    { label: "Hireable", text: user.hireable == null ? null : user.hireable ? "Yes" : "No" },
    { label: "Account created", text: formatDate(user.githubCreatedAt) },
    { label: "Last synced", text: formatDate(user.lastScrapedAt) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/portal/discover"
          scroll={false}
          onClick={() => markDiscoverListRestorePending()}
          className="ui-link mb-3 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to discover
        </Link>
        <PageHeader
          title={user.name || user.login}
          description="Stored GitHub profile details from the shared database."
        />
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      {isScam ? (
        <Alert tone="warning">
          This profile is marked as a confirmed scam and is not eligible as a contact.
        </Alert>
      ) : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.login}
              width={72}
              height={72}
              className="rounded-2xl ring-2 ring-white"
              unoptimized
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{user.login}</h2>
              <Badge
                tone={
                  user.validationStatus === "legitimate"
                    ? "success"
                    : user.validationStatus === "suspicious"
                      ? "warning"
                      : "info"
                }
              >
                {user.validationStatus}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{user.bio || "No bio"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="ui-link inline-flex items-center gap-1 text-sm font-medium"
              >
                Open GitHub profile
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <CopyIconButton value={githubUrl} label="GitHub profile URL" />
            </div>
          </div>
          <Button
            type="button"
            disabled={saving || isScam}
            onClick={toggleContact}
          >
            {user.isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4" />
                Remove contact
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" />
                Save contact
              </>
            )}
          </Button>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {details.map((field) => (
            <div key={field.label} className="rounded-xl border border-border px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-muted">{field.label}</dt>
              <dd className="mt-1 text-sm text-foreground">
                {field.text ? (
                  <div className="flex items-start gap-2">
                    {field.href ? (
                      <a
                        href={field.href}
                        target={field.href.startsWith("mailto:") ? undefined : "_blank"}
                        rel="noreferrer"
                        className="ui-link min-w-0 flex-1 break-all"
                      >
                        {field.text}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 break-all">{field.text}</span>
                    )}
                    {field.copy ? <CopyIconButton value={field.copy} label={field.label} /> : null}
                  </div>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          ))}
        </dl>

        {user.validationHints && user.validationHints.length > 0 ? (
          <div className="mt-4 rounded-xl border border-[color:var(--alert-warning-border)] bg-[color:var(--alert-warning-bg)] px-4 py-3 text-sm">
            <p className="font-medium text-[color:var(--alert-warning-fg)]">Under review signals</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--alert-warning-fg)]">
              {user.validationHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {readme ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Profile README</h2>
              <p className="mt-1 text-sm text-muted">
                Rendered from the public profile repository {user.login}/{user.login}.
              </p>
            </div>
            <CopyIconButton value={readme} label="README" />
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <GithubReadme login={user.login} markdown={readme} />
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Flag className="h-4 w-4 text-[color:var(--accent)]" />
          Report
        </h2>
        <p className="mt-1 text-sm text-muted">
          One click sends this profile to an administrator. They verify the report and decide
          whether it is fraud.
        </p>

        {user.openReport ? (
          <div className="mt-4 space-y-3">
            <Alert tone="info">
              Report status: {reportStatusLabel(user.openReport.status)}.
            </Alert>
            <Link href="/portal/reports" className="ui-link text-sm">
              View your reports
            </Link>
          </div>
        ) : (
          <div className="mt-4">
            <Button type="button" variant="danger" disabled={reporting || isScam} onClick={submitReport}>
              <Flag className="h-4 w-4" />
              {reporting ? "Reporting…" : "Report"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
