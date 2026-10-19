"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { BackLink } from "@/components/admin/back-link";
import { PageHeader } from "@/components/admin/page-header";
import {
  ScrapingJobStatus,
  type ScrapingJobStatusData,
} from "@/components/admin/scraping-job-status";
import { Alert, Button } from "@/components/admin/ui";

const TERMINAL = new Set([
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<ScrapingJobStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const res = await fetch(`/api/admin/jobs/${params.id}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
      const data = (await res.json()) as ScrapingJobStatusData;
      if (!active) return;
      setJob(data);
      setInitialLoading(false);
      return data;
    }

    load().catch((err: Error) => {
      if (!active) return;
      setError(err.message);
      setInitialLoading(false);
    });

    const id = setInterval(() => {
      load()
        .then((data) => {
          if (data && TERMINAL.has(data.status)) {
            clearInterval(id);
          }
        })
        .catch(() => undefined);
    }, 1500);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [params.id]);

  async function cancelJob() {
    if (!job) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to cancel");
        return;
      }
      const updated = await res.json();
      setJob((prev) => (prev ? { ...prev, ...updated } : updated));
    } finally {
      setCancelling(false);
    }
  }

  async function deleteJob() {
    if (!job) return;
    if (!window.confirm("Delete this job from scraping history?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError((await res.json()).error || "Failed to delete");
        return;
      }
      router.push("/admin/history");
    } finally {
      setDeleting(false);
    }
  }

  const canDelete = job ? TERMINAL.has(job.status) : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scraping status"
        description="Live progress for this job. Counters refresh automatically while scraping is active."
        actions={
          <>
            {canDelete ? (
              <Button variant="danger" onClick={deleteJob} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting…" : "Delete from history"}
              </Button>
            ) : null}
            <BackLink href="/admin/jobs">← Back to jobs</BackLink>
          </>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <ScrapingJobStatus
        job={job}
        loading={initialLoading}
        onCancel={cancelJob}
        cancelling={cancelling}
      />
    </div>
  );
}
