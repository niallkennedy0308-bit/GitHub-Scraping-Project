"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card, EmptyState } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

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
  createdAt: string;
  configuration?: { name: string };
  startedBy?: { email: string };
};

const TERMINAL = ["completed", "completed_with_errors", "failed", "cancelled"];

function statusTone(status: string) {
  if (status === "completed") return "success" as const;
  if (status.includes("fail")) return "danger" as const;
  return "warning" as const;
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/jobs?take=100");
    if (!res.ok) throw new Error((await res.json()).error || "Failed to load history");
    setJobs(await res.json());
    setSelected(new Set());
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const finished = jobs.filter((j) => TERMINAL.includes(j.status));

  function toggleAll() {
    if (selected.size === finished.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(finished.map((j) => j.id)));
    }
  }

  async function removeSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} finished job(s) from history?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (finished.length === 0) return;
    if (
      !window.confirm(
        `Clear all ${finished.length} finished scraping history records? Collected GitHub users are kept.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAllFinished: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Clear failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(id: string) {
    if (!window.confirm("Delete this job from scraping history?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scraping History"
        description="Finished job results. Deleting history removes job records only — stored GitHub users remain."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={removeSelected}
              disabled={busy || selected.size === 0}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete selected
            </Button>
            <Button variant="danger" onClick={clearAll} disabled={busy || finished.length === 0}>
              Clear all history
            </Button>
          </>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[color:var(--surface-muted)] text-muted">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={finished.length > 0 && selected.size === finished.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium">Configuration</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Results</th>
                <th className="px-4 py-3 font-medium">Completed</th>
                <th className="px-4 py-3 font-medium">By</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {finished.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(job.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(job.id);
                        else next.delete(job.id);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="font-medium text-[color:var(--link)] hover:underline"
                    >
                      {job.configuration?.name || job.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {job.profilesDiscovered} discovered · {job.newUsers} new · {job.duplicateUsers}{" "}
                    dup · {job.excludedUsers} excl · {job.flaggedUsers} flagged · {job.errorCount}{" "}
                    errors
                  </td>
                  <td className="px-4 py-3">{formatDate(job.completedAt || job.createdAt)}</td>
                  <td className="px-4 py-3">{job.startedBy?.email}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      className="text-rose-700"
                      onClick={() => removeOne(job.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {finished.length === 0 ? (
            <EmptyState
              title="No completed jobs yet"
              description="Finished scraping jobs will appear here."
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}
