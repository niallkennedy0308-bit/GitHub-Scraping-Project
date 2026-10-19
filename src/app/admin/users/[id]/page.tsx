"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  ExternalLink,
  Globe,
  Link2,
  Mail,
  MapPin,
  Users,
} from "lucide-react";
import { MissingContactForm } from "@/components/admin/missing-contact-form";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card, Textarea } from "@/components/admin/ui";
import { markUsersListRestorePending } from "@/lib/scroll-memory";
import { profileHasLinkedIn } from "@/lib/scam-rules/simple-form";
import { formatDate } from "@/lib/utils";

type UserDetail = {
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
  followers: number;
  following: number;
  githubCreatedAt?: string | null;
  validationStatus: string;
  riskScore: number;
  matchedRuleIds: string[];
  validationReasons: string[];
  firstScrapedAt: string;
  lastScrapedAt: string;
  deletedAt?: string | null;
  jobUsers: {
    id: string;
    outcome: string;
    job: { id: string; status: string; createdAt: string };
  }[];
};

function statusTone(status: string) {
  if (status === "legitimate") return "success" as const;
  if (status === "suspicious") return "warning" as const;
  if (status === "confirmed_scam") return "danger" as const;
  return "neutral" as const;
}

function toWebUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function companyHref(company: string): string | null {
  const trimmed = company.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes(".")) {
    return toWebUrl(trimmed);
  }
  if (trimmed.startsWith("@")) {
    return `https://github.com/${trimmed.slice(1)}`;
  }
  return `https://github.com/search?q=${encodeURIComponent(trimmed)}&type=users`;
}

function ExternalTextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 break-all font-medium text-[color:var(--link)] hover:underline"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 border-b border-border py-3 last:border-b-0">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--surface-muted)] text-muted">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <div className="mt-1 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/users/${params.id}`);
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
    setUser(await res.json());
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function review(action: string) {
    if (action === "soft_delete" && !window.confirm("Soft-delete this user from the main collection?")) {
      return;
    }
    if (action === "confirm_scam" && !window.confirm("Confirm this user as scam?")) {
      return;
    }
    const res = await fetch(`/api/admin/users/${params.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Action failed");
      return;
    }
    setNote("");
    await load();
  }

  if (error && !user) return <Alert>{error}</Alert>;
  if (!user) return <Card className="p-6 text-sm text-muted">Loading user…</Card>;

  const githubUrl = user.htmlUrl || `https://github.com/${user.login}`;
  const companyUrl = user.company ? companyHref(user.company) : null;
  const blogUrl = user.blog?.trim() ? toWebUrl(user.blog) : null;
  const linkedinDisplay = user.linkedinUrl?.trim()
    ? toWebUrl(user.linkedinUrl)
    : blogUrl && /linkedin\.com/i.test(blogUrl)
      ? blogUrl
      : null;
  const twitterUrl = user.twitterUsername?.trim()
    ? `https://x.com/${user.twitterUsername.replace(/^@/, "")}`
    : null;
  const missingEmail = !user.email?.trim();
  const missingLinkedIn = !profileHasLinkedIn({
    blog: user.blog,
    bio: user.bio,
    twitter_username: user.twitterUsername,
    company: user.company,
    linkedin_url: user.linkedinUrl,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          scroll={false}
          onClick={() => markUsersListRestorePending()}
          className="text-sm font-semibold text-[color:var(--link)] transition hover:text-[color:var(--link)] hover:underline underline-offset-4"
        >
          ← Back to users
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="relative overflow-hidden bg-[linear-gradient(125deg,#07111f_0%,#0f2740_48%,#0f766e_100%)] px-5 py-6 text-white sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-teal-300/20 blur-3xl"
          />
          <div className="relative flex flex-wrap items-center gap-4">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.login}
                width={72}
                height={72}
                className="rounded-full ring-2 ring-white/30 shadow-lg"
                unoptimized
              />
            ) : (
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/10 text-xl font-semibold ring-1 ring-white/20">
                {user.login.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{user.login}</h1>
                <Badge tone={statusTone(user.validationStatus)}>{user.validationStatus}</Badge>
              </div>
              <p className="mt-1 text-white/70">{user.name || "No display name"}</p>
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-teal-200 transition hover:text-teal-100 hover:underline underline-offset-2"
              >
                Open GitHub profile
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <PageHeader title="Profile" description="Public GitHub profile details and links." />
          <div className="mt-2">
            <DetailRow icon={Users} label="Bio">
              {user.bio || "—"}
            </DetailRow>

            <DetailRow icon={Building2} label="Company">
              {user.company ? (
                companyUrl ? (
                  <ExternalTextLink href={companyUrl}>{user.company}</ExternalTextLink>
                ) : (
                  user.company
                )
              ) : (
                "—"
              )}
            </DetailRow>

            <DetailRow icon={MapPin} label="Location">
              {user.location || "—"}
            </DetailRow>

            <DetailRow icon={Mail} label="Email">
              {user.email ? (
                <a
                  href={`mailto:${user.email}`}
                  className="break-all font-medium text-[color:var(--link)] hover:underline"
                >
                  {user.email}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>

            <DetailRow icon={Link2} label="LinkedIn">
              {linkedinDisplay ? (
                <ExternalTextLink href={linkedinDisplay}>
                  {user.linkedinUrl || user.blog}
                </ExternalTextLink>
              ) : (
                "—"
              )}
            </DetailRow>

            <DetailRow icon={Globe} label="Blog / website">
              {blogUrl ? <ExternalTextLink href={blogUrl}>{user.blog}</ExternalTextLink> : "—"}
            </DetailRow>

            <DetailRow icon={Globe} label="Twitter / X">
              {twitterUrl ? (
                <ExternalTextLink href={twitterUrl}>@{user.twitterUsername}</ExternalTextLink>
              ) : (
                "—"
              )}
            </DetailRow>

            <DetailRow icon={Users} label="Repos / Followers / Following">
              {user.publicRepos} / {user.followers} / {user.following}
            </DetailRow>

            <DetailRow icon={Calendar} label="Account created">
              {formatDate(user.githubCreatedAt)}
            </DetailRow>

            <DetailRow icon={Calendar} label="First / last scraped">
              {formatDate(user.firstScrapedAt)} / {formatDate(user.lastScrapedAt)}
            </DetailRow>

            <DetailRow icon={Users} label="Hireable">
              {user.hireable == null ? "—" : user.hireable ? "Yes" : "No"}
            </DetailRow>
          </div>

          <MissingContactForm
            userId={user.id}
            missingEmail={missingEmail}
            missingLinkedIn={missingLinkedIn}
            onSaved={load}
          />
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold text-foreground">{isAdmin ? "Review" : "Validation"}</h2>
            <p className="mt-1 text-sm text-muted">
              {isAdmin
                ? "Update validation status for this profile."
                : "Current automated validation signals for this profile."}
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Status</span>
                <Badge tone={statusTone(user.validationStatus)}>{user.validationStatus}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">Risk score</span>
                <span className="font-semibold text-foreground">{user.riskScore}</span>
              </div>
              {isAdmin ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Deleted</span>
                  <span>{user.deletedAt ? formatDate(user.deletedAt) : "No"}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Matched reasons
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                {user.validationReasons.length === 0 ? <li>None</li> : null}
                {user.validationReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>

            {isAdmin ? (
              <>
                <label className="mt-4 block text-sm text-muted">
                  Review note (optional)
                  <Textarea
                    className="mt-1"
                    rows={3}
                    placeholder="Add a note for this decision"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => review("mark_legitimate")}>
                    Legitimate
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => review("mark_suspicious")}>
                    Suspicious
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => review("confirm_scam")}>
                    Confirm scam
                  </Button>
                  {user.deletedAt ? (
                    <Button type="button" variant="secondary" onClick={() => review("restore")}>
                      Restore
                    </Button>
                  ) : (
                    <Button type="button" variant="danger" onClick={() => review("soft_delete")}>
                      Soft delete
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-foreground">Job history</h2>
            <p className="mt-1 text-sm text-muted">Scraping jobs that discovered or updated this user.</p>
            <ul className="mt-4 space-y-2">
              {user.jobUsers.length === 0 ? (
                <li className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-3 text-sm text-muted">No job history</li>
              ) : null}
              {user.jobUsers.map((ju) => (
                <li key={ju.id} className="rounded-xl bg-[color:var(--surface-muted)] px-3 py-3 text-sm">
                  <Link
                    href={`/admin/jobs/${ju.job.id}`}
                    className="font-medium text-[color:var(--link)] hover:underline"
                  >
                    Job {ju.job.id.slice(0, 8)}
                  </Link>
                  <div className="mt-1 text-xs text-muted">
                    {ju.outcome} · {formatDate(ju.job.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
