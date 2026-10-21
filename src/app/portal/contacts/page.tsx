"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Badge, Button, Card, Input } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

type ContactRow = {
  id: string;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  company?: string | null;
  location?: string | null;
  followers: number;
  validationStatus: string;
  contactId: string | null;
  savedAt?: string | null;
  unavailable?: boolean;
};

type Response = {
  items: ContactRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function PortalContactsPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      sort: "lastScrapedAt",
      order: "desc",
    });
    if (debouncedQ) params.set("q", debouncedQ);
    return params.toString();
  }, [page, debouncedQ]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/portal/contacts?${queryString}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load contacts");
        return res.json();
      })
      .then((json: Response) => {
        setData(json);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [queryString]);

  async function removeContact(row: ContactRow) {
    if (!row.contactId) return;
    if (!window.confirm(`Remove @${row.login} from your contacts?`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/portal/contacts/${row.contactId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove");
      const refreshed = await fetch(`/api/portal/contacts?${queryString}`);
      setData(await refreshed.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Contacts"
        description="GitHub profiles you saved. Confirmed scams stay listed with a warning but are not recommended."
      />

      <Card className="p-4">
        <Input
          placeholder="Search your saved contacts…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      <Card className="overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="ui-table-head text-[11px] font-semibold uppercase tracking-[0.06em]">
              <tr>
                <th className="px-3 py-3.5">User</th>
                <th className="px-3 py-3.5">Company</th>
                <th className="px-3 py-3.5">Location</th>
                <th className="px-3 py-3.5">Followers</th>
                <th className="px-3 py-3.5">Added</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-3 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No saved contacts yet.{" "}
                    <Link href="/portal/discover" className="ui-link font-medium underline">
                      Discover GitHub users
                    </Link>{" "}
                    and click Save.
                  </td>
                </tr>
              ) : null}
              {data?.items.map((row) => (
                <tr key={row.id} className="ui-row-hover border-t border-border">
                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {row.avatarUrl ? (
                        <Image
                          src={row.avatarUrl}
                          alt={row.login}
                          width={34}
                          height={34}
                          className="rounded-full"
                          unoptimized
                        />
                      ) : null}
                      <div>
                        <div className="font-semibold">{row.login}</div>
                        <div className="text-xs text-muted">{row.name || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">{row.company || "—"}</td>
                  <td className="px-3 py-3.5">{row.location || "—"}</td>
                  <td className="px-3 py-3.5 tabular-nums">{row.followers}</td>
                  <td className="px-3 py-3.5 text-xs text-muted">{formatDate(row.savedAt)}</td>
                  <td className="px-3 py-3.5">
                    <Badge tone={row.unavailable ? "danger" : "info"}>
                      {row.unavailable ? "confirmed scam" : row.validationStatus}
                    </Badge>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap gap-2">
                      {!row.unavailable ? (
                        <Link
                          href={`/portal/discover/${row.id}`}
                          className="ui-btn ui-btn-secondary !px-2.5 !py-1.5 text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      ) : null}
                      <Button
                        type="button"
                        variant="danger"
                        className="!px-2.5 !py-1.5 text-xs"
                        disabled={busyId === row.id}
                        onClick={() => removeContact(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
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
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
