"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card, EmptyState } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

type Job = {
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
  createdAt: string;
  configuration?: { id: string; name: string };
};

function statusTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status.includes("fail")) return "danger" as const;
  if (status.includes("error") || status === "cancelled") return "warning" as const;
  return "info" as const;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/jobs?take=50");
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load jobs");
    setJobs(await res.json());
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
    const id = setInterval(() => {
      load().catch(() => undefined);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  async function cancelJob(id: string) {
    await fetch(`/api/admin/jobs/${id}/cancel`, { method: "POST" });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scraping Jobs"
        description="Monitor queued and running jobs. Counters update automatically while a job is active."
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--surface-muted)] text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Counters</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="font-medium text-[color:var(--link)] hover:underline"
                    >
                      {job.configuration?.name || job.id.slice(0, 8)}
                    </Link>
                    <div className="mt-1 max-w-xs truncate text-xs text-muted">
                      {job.githubSearchUrl}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                      {["queued", "running"].includes(job.status) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[color:var(--link)]" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/90">{job.progressMessage || "—"}</td>
                  <td className="px-4 py-3 text-xs text-foreground/85">
                    <div>discovered {job.profilesDiscovered}</div>
                    <div>
                      new {job.newUsers} · dup {job.duplicateUsers} · excl {job.excludedUsers}
                    </div>
                    <div>
                      flagged {job.flaggedUsers} · errors {job.errorCount}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(job.startedAt || job.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {["queued", "running"].includes(job.status) ? (
                      <Button variant="secondary" onClick={() => cancelJob(job.id)}>
                        Cancel
                      </Button>
                    ) : (
                      <Link href={`/admin/jobs/${job.id}`} className="text-sm text-[color:var(--link)] underline">
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 ? (
            <EmptyState
              title="No jobs yet"
              description="Start one from Scraping Configurations."
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}
