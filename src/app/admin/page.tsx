"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Users,
  Workflow,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { Alert, Badge, Button, Card, EmptyState } from "@/components/admin/ui";
import { formatDate, formatNumber } from "@/lib/utils";

type Stats = {
  totalUsers: number;
  legitimateUsers: number;
  suspiciousUsers: number;
  confirmedScamUsers: number;
  totalJobs: number;
  latestJobNewUsers: number;
};

type Job = {
  id: string;
  status: string;
  newUsers: number;
  profilesDiscovered: number;
  flaggedUsers: number;
  createdAt: string;
  completedAt?: string | null;
  configuration?: { name: string };
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load stats");
        return res.json();
      }),
      fetch("/api/admin/jobs?take=5").then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load jobs");
        return res.json();
      }),
    ])
      .then(([statsData, jobsData]) => {
        setStats(statsData);
        setJobs(jobsData);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Monitor scraping health, validation outcomes, and review workload. Counts are unique by GitHub user ID."
        actions={
          <>
            <Link href="/admin/configurations">
              <Button>Start from configuration</Button>
            </Link>
            <Link href="/admin/review">
              <Button variant="secondary">Open scam review</Button>
            </Link>
          </>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      {!stats && !error ? (
        <Card className="p-6 text-sm text-muted">Loading dashboard…</Card>
      ) : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total users stored"
            value={formatNumber(stats.totalUsers)}
            icon={Users}
            tone="info"
          />
          <StatCard
            label="Legitimate users"
            value={formatNumber(stats.legitimateUsers)}
            icon={UserCheck}
            tone="success"
          />
          <StatCard
            label="Suspicious awaiting review"
            value={formatNumber(stats.suspiciousUsers)}
            icon={AlertTriangle}
            tone="warning"
          />
          <StatCard
            label="Confirmed scam"
            value={formatNumber(stats.confirmedScamUsers)}
            icon={ShieldAlert}
            tone="danger"
          />
          <StatCard
            label="Total scraping jobs"
            value={formatNumber(stats.totalJobs)}
            icon={Workflow}
            tone="default"
          />
          <StatCard
            label="New users (latest completed job)"
            value={formatNumber(stats.latestJobNewUsers)}
            icon={Activity}
            tone="info"
            hint="From the most recent completed job"
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold text-foreground">Recent jobs</h2>
              <p className="text-sm text-muted">Latest scraping activity and outcomes</p>
            </div>
            <Link href="/admin/jobs" className="ui-link text-sm font-medium hover:underline">
              View all
            </Link>
          </div>
          {jobs.length === 0 ? (
            <EmptyState
              title="No scraping jobs yet"
              description="Create a configuration and start your first job."
            />
          ) : (
            <div className="divide-y divide-border">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/admin/jobs/${job.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[color:var(--surface-muted)]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {job.configuration?.name || job.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(job.completedAt || job.createdAt)} · {job.profilesDiscovered}{" "}
                      discovered · {job.newUsers} new · {job.flaggedUsers} flagged
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        job.status.includes("fail")
                          ? "danger"
                          : job.status.includes("error") || job.status === "cancelled"
                            ? "warning"
                            : job.status === "completed"
                              ? "success"
                              : "info"
                      }
                    >
                      {job.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Quick actions</h2>
          <p className="mt-1 text-sm text-muted">Jump into the most common admin workflows.</p>
          <div className="mt-5 space-y-3">
            {[
              {
                href: "/admin/configurations",
                title: "Manage scraping configurations",
                desc: "Save GitHub search targets and start jobs",
              },
              {
                href: "/admin/rules",
                title: "Tune scam detection rules",
                desc: "Configure typed rules and test sample profiles",
              },
              {
                href: "/admin/users",
                title: "Browse collected GitHub users",
                desc: "Search, filter, sort, and open profile details",
              },
              {
                href: "/admin/review",
                title: "Review suspicious profiles",
                desc: "Make final legitimate / scam decisions",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl border border-border bg-[color:var(--surface-muted)] px-4 py-3.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent)]/40 hover:shadow-[var(--shadow-soft)]"
              >
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.desc}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
