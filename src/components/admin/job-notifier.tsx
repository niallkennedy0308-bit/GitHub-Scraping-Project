"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Job = {
  id: string;
  status: string;
  profilesDiscovered: number;
  newUsers: number;
  duplicateUsers: number;
  excludedUsers: number;
  flaggedUsers: number;
  errorCount: number;
  completedAt?: string | null;
};

const TERMINAL = new Set([
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export function JobNotifier() {
  const seen = useRef<Set<string>>(new Set());
  const [notice, setNotice] = useState<Job | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/admin/jobs?take=10");
        if (!res.ok) return;
        const jobs = (await res.json()) as Job[];
        if (!active) return;

        for (const job of jobs) {
          if (!TERMINAL.has(job.status) || !job.completedAt) continue;
          if (seen.current.has(job.id)) continue;
          seen.current.add(job.id);
          // Only notify for recently completed jobs (last 2 minutes)
          const age = Date.now() - new Date(job.completedAt).getTime();
          if (age < 2 * 60 * 1000) {
            setNotice(job);
            break;
          }
        }
      } catch {
        // ignore polling errors
      }
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (!notice) return null;

  const isWarning =
    notice.status === "completed_with_errors" ||
    notice.status === "failed" ||
    notice.status === "cancelled";

  const message =
    notice.status === "failed"
      ? `Scraping failed after discovering ${notice.profilesDiscovered} profiles with ${notice.errorCount} errors.`
      : notice.status === "cancelled"
        ? `Scraping cancelled. Discovered ${notice.profilesDiscovered} profiles before stop.`
        : `Scraping ${notice.status === "completed_with_errors" ? "completed with errors" : "completed successfully"}. Discovered ${notice.profilesDiscovered} profiles, stored ${notice.newUsers} new users, ignored ${notice.duplicateUsers} duplicates, excluded ${notice.excludedUsers} profiles, and flagged ${notice.flaggedUsers} users for review.`;

  return (
    <div
      className={`ui-enter fixed bottom-4 right-4 z-50 max-w-md rounded-2xl border p-4 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.45)] backdrop-blur ${
        isWarning
          ? "border-amber-200/90 bg-gradient-to-br from-amber-50 to-white text-amber-950"
          : "border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-white text-emerald-950"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Job {notice.status.replaceAll("_", " ")}</p>
          <p className="mt-1 text-sm leading-relaxed">{message}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium underline">
            <Link href={`/admin/users?jobId=${notice.id}`}>New users</Link>
            <Link href="/admin/review">Suspicious users</Link>
            <Link href={`/admin/jobs/${notice.id}`}>Full report</Link>
          </div>
        </div>
        <button
          type="button"
          className="text-sm opacity-60 hover:opacity-100"
          onClick={() => setNotice(null)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
