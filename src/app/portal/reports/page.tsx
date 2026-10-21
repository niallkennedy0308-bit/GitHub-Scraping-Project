"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Card, Select } from "@/components/admin/ui";
import { reportStatusLabel } from "@/lib/portal/constants";
import { formatDate } from "@/lib/utils";

type ReportRow = {
  id: string;
  reason: string;
  description: string;
  evidenceUrl?: string | null;
  status: string;
  createdAt: string;
  githubUser: {
    id: string;
    login: string;
    name?: string | null;
    validationStatus: string;
  };
};

export default function PortalReportsPage() {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<ReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (status) params.set("status", status);
    fetch(`/api/portal/scam-reports?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load reports");
        return res.json();
      })
      .then((data) => {
        setItems(data.items);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [status]);

  function tone(s: string) {
    if (s === "resolved") return "success" as const;
    if (s === "dismissed") return "neutral" as const;
    if (s === "under_review") return "info" as const;
    return "warning" as const;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Reports"
        description="Reports you submitted. An administrator verifies each one and decides whether the profile is fraud."
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <label className="block text-xs text-muted">
          Status
          <Select className="mt-1 min-w-[12rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Awaiting review</option>
            <option value="under_review">Under review</option>
            <option value="resolved">Confirmed</option>
            <option value="dismissed">Not confirmed</option>
          </Select>
        </label>
        <Link href="/portal/discover" className="ui-btn ui-btn-secondary !px-3 !py-2 text-xs">
          Find profiles to report
        </Link>
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="ui-table-head text-[11px] font-semibold uppercase tracking-[0.06em]">
              <tr>
                <th className="px-3 py-3.5">Profile</th>
                <th className="px-3 py-3.5">Submitted</th>
                <th className="px-3 py-3.5">Your report</th>
                <th className="px-3 py-3.5">Admin decision</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    You have not submitted any reports yet.
                  </td>
                </tr>
              ) : null}
              {items.map((report) => (
                <tr key={report.id} className="ui-row-hover border-t border-border align-top">
                  <td className="px-3 py-3.5">
                    <Link
                      href={`/portal/discover/${report.githubUser.id}`}
                      className="ui-link font-semibold hover:underline"
                    >
                      @{report.githubUser.login}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-muted">{formatDate(report.createdAt)}</td>
                  <td className="px-3 py-3.5">
                    <Badge tone={tone(report.status)}>{reportStatusLabel(report.status)}</Badge>
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge
                      tone={
                        report.githubUser.validationStatus === "confirmed_scam"
                          ? "danger"
                          : "info"
                      }
                    >
                      {report.githubUser.validationStatus}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
