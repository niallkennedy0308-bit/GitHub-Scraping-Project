"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card, Input, Select, Textarea } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

type ReportRow = {
  id: string;
  reason: string;
  description: string;
  evidenceUrl?: string | null;
  status: string;
  adminNotes?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  githubUser: {
    id: string;
    login: string;
    name?: string | null;
    avatarUrl?: string | null;
    htmlUrl?: string | null;
    validationStatus: string;
    riskScore: number;
  };
  reporter: { id: string; email: string; name?: string | null };
  reviewedBy?: { email: string } | null;
};

export default function AdminScamReportsPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReportRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (status) params.set("status", status);
    if (debouncedQ) params.set("q", debouncedQ);
    return params.toString();
  }, [page, status, debouncedQ]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/scam-reports?${queryString}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load reports");
      const data = await res.json();
      setItems(data.items);
      setTotalPages(data.totalPages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  async function updateReport(nextStatus: string) {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/scam-reports/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, adminNotes: notes }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to update");
      setSuccess(`Report marked as ${nextStatus}.`);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Scam Reports"
        description="Review reports submitted by regular users. Confirming a profile as scam uses the existing validation workflow on the profile page."
      />

      <Card className="grid gap-3 p-4 sm:grid-cols-3">
        <label className="block text-xs text-muted sm:col-span-2">
          Search
          <Input
            className="mt-1"
            placeholder="GitHub login, reporter email, description…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </label>
        <label className="block text-xs text-muted">
          Status
          <Select
            className="mt-1"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="pending">pending</option>
            <option value="under_review">under_review</option>
            <option value="resolved">resolved</option>
            <option value="dismissed">dismissed</option>
          </Select>
        </label>
      </Card>

      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="ui-table-head text-[11px] font-semibold uppercase tracking-[0.06em]">
                <tr>
                  <th className="px-3 py-3.5">Profile</th>
                  <th className="px-3 py-3.5">Reporter</th>
                  <th className="px-3 py-3.5">Reason</th>
                  <th className="px-3 py-3.5">Submitted</th>
                  <th className="px-3 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      No reports match these filters.
                    </td>
                  </tr>
                ) : null}
                {items.map((report) => (
                  <tr
                    key={report.id}
                    className="ui-row-hover cursor-pointer border-t border-border"
                    onClick={() => {
                      setSelected(report);
                      setNotes(report.adminNotes || "");
                      setSuccess(null);
                    }}
                  >
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        {report.githubUser.avatarUrl ? (
                          <Image
                            src={report.githubUser.avatarUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="rounded-full"
                            unoptimized
                          />
                        ) : null}
                        <span className="font-semibold">@{report.githubUser.login}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-xs">{report.reporter.email}</td>
                    <td className="px-3 py-3.5">{report.reason}</td>
                    <td className="px-3 py-3.5 text-xs text-muted">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone="warning">{report.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="flex justify-end gap-2 border-t border-border p-3">
              <Button
                variant="secondary"
                className="!px-3 !py-1.5"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                className="!px-3 !py-1.5"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          {!selected ? (
            <p className="text-sm text-muted">Select a report to review details and update status.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-foreground">
                  Report on @{selected.githubUser.login}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Reporter: {selected.reporter.email} · {formatDate(selected.createdAt)}
                </p>
              </div>
              <div className="rounded-xl border border-border px-3 py-2 text-sm">
                <p className="font-medium">{selected.reason}</p>
                <p className="mt-2 whitespace-pre-wrap text-muted">{selected.description}</p>
                {selected.evidenceUrl ? (
                  <a
                    href={selected.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ui-link mt-2 inline-block text-xs"
                  >
                    Evidence link
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge
                  tone={
                    selected.githubUser.validationStatus === "confirmed_scam"
                      ? "danger"
                      : "warning"
                  }
                >
                  profile: {selected.githubUser.validationStatus}
                </Badge>
                <Badge tone="info">risk {selected.githubUser.riskScore}%</Badge>
              </div>
              <Link
                href={`/admin/users/${selected.githubUser.id}`}
                className="ui-btn ui-btn-secondary inline-flex !px-3 !py-1.5 text-xs"
              >
                Open profile review
              </Link>
              <label className="block text-sm text-muted">
                Admin notes
                <Textarea
                  className="mt-1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes for this report"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => updateReport("under_review")}
                >
                  Under review
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => updateReport("resolved")}
                >
                  Resolve
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={saving}
                  onClick={() => updateReport("dismissed")}
                >
                  Dismiss
                </Button>
              </div>
              <p className="text-xs text-muted">
                Resolving a report does not automatically confirm the profile as a scam. Use{" "}
                <strong>Open profile review</strong> for that.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
