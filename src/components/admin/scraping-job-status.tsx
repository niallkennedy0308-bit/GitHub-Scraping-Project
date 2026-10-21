"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge, Button, Card } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type ScrapingJobStatusData = {
  id: string;
  status: string;
  githubSearchUrl: string;
  profilesDiscovered: number;
  newUsers: number;
  duplicateUsers: number;
  excludedUsers: number;
  flaggedUsers: number;
  errorCount: number;
  progressMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  configuration?: { id: string; name: string } | null;
  startedBy?: { email: string } | null;
  errors?: { id: string; message: string; createdAt: string }[];
};

function statusTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status.includes("fail")) return "danger" as const;
  if (status.includes("error") || status === "cancelled") return "warning" as const;
  return "info" as const;
}

function isActive(status: string) {
  return status === "queued" || status === "running";
}

export function ScrapingJobStatus({
  job,
  loading,
  onCancel,
  cancelling,
}: {
  job?: ScrapingJobStatusData | null;
  loading?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  if (loading || !job) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[color:var(--link)]" />
        <div>
          <p className="font-medium text-foreground">Starting scraping job…</p>
          <p className="mt-1 text-sm text-muted">Creating the job and preparing the worker.</p>
        </div>
      </Card>
    );
  }

  const active = isActive(job.status);
  const progressHint =
    job.progressMessage ||
    (job.status === "queued"
      ? "Waiting for the worker to pick up this job…"
      : job.status === "running"
        ? "Scraping in progress…"
        : "Job finished");

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">
                {job.configuration?.name || "Scraping job"}
              </h2>
              <Badge tone={statusTone(job.status)}>{job.status.replaceAll("_", " ")}</Badge>
              {active ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--link)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Live
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-3xl break-all text-sm text-muted">{job.githubSearchUrl}</p>
          </div>
          {active && onCancel ? (
            <Button variant="secondary" onClick={onCancel} disabled={cancelling}>
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Cancel job"
              )}
            </Button>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] px-4 py-3.5 shadow-sm ring-1 ring-inset ring-[color:var(--accent)]/20">
          <div className="flex items-start gap-3">
            {active ? (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[color:var(--accent)]" />
            ) : (
              <div
                className={cn(
                  "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[color:var(--surface-solid)]",
                  job.status === "completed"
                    ? "bg-emerald-400"
                    : job.status.includes("fail")
                      ? "bg-rose-400"
                      : "bg-amber-400",
                )}
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {active ? "Scraping status" : "Final status"}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{progressHint}</p>
              {job.status === "queued" ? (
                <p className="mt-2 text-xs text-foreground/80">
                  Tip: keep{" "}
                  <code className="rounded border border-border bg-[color:var(--surface-solid)] px-1 text-foreground">
                    npm run worker
                  </code>{" "}
                  running, or the job will stay queued.
                </p>
              ) : null}
            </div>
          </div>

          {active ? (
            <div className="mt-4 space-y-2">
              <div className="h-2.5 overflow-hidden rounded-full bg-[color:var(--surface-solid)]/70 ring-1 ring-[color:var(--border-strong)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-all duration-500"
                  style={{
                    // Approximate progress against default scrape cap (10 pages × 30 users).
                    width: `${Math.min(99, Math.max(8, Math.round((job.profilesDiscovered / 300) * 100)))}%`,
                  }}
                />
              </div>
              <p className="text-xs font-medium text-foreground/85">
                Processed {job.profilesDiscovered} profiles so far
                {job.progressMessage?.toLowerCase().includes("waiting") ||
                job.progressMessage?.toLowerCase().includes("rate limit")
                  ? " · temporarily paused by GitHub rate limits"
                  : " · still working"}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Discovered", job.profilesDiscovered],
          ["New users", job.newUsers],
          ["Duplicates", job.duplicateUsers],
          ["Excluded", job.excludedUsers],
          ["Flagged", job.flaggedUsers],
          ["Errors", job.errorCount],
          ["Started", formatDate(job.startedAt || job.createdAt)],
          ["Completed", formatDate(job.completedAt)],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="font-medium text-[color:var(--link)] hover:underline" href={`/admin/users?jobId=${job.id}`}>
            View users from this job
          </Link>
          <Link className="font-medium text-[color:var(--link)] hover:underline" href="/admin/review">
            Review suspicious users
          </Link>
          <Link className="font-medium text-[color:var(--link)] hover:underline" href="/admin/jobs">
            All jobs
          </Link>
        </div>
        {job.startedBy?.email ? (
          <p className="mt-3 text-xs text-muted">Started by {job.startedBy.email}</p>
        ) : null}
      </Card>

      {job.errors && job.errors.length > 0 ? (
        <Card className="p-5">
          <h3 className="font-medium text-foreground">Errors</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {job.errors.map((err) => (
              <li key={err.id} className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">
                <div>{err.message}</div>
                <div className="text-xs opacity-70">{formatDate(err.createdAt)}</div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
