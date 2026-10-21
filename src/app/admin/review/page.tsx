"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert, Button, Card } from "@/components/admin/ui";
import { formatDate, parseJsonArray } from "@/lib/utils";

type UserRow = {
  id: string;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  htmlUrl?: string | null;
  riskScore: number;
  validationStatus: string;
  validationReasons: string;
  lastScrapedAt: string;
};

export default function ReviewPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    // Review queue: suspicious (30–69%) and auto/manual scams (70%+).
    const [suspiciousRes, scamRes] = await Promise.all([
      fetch("/api/admin/users?status=suspicious&pageSize=100&sort=riskScore&order=desc"),
      fetch("/api/admin/users?status=confirmed_scam&pageSize=100&sort=riskScore&order=desc"),
    ]);
    if (!suspiciousRes.ok) {
      throw new Error((await suspiciousRes.json()).error || "Failed to load");
    }
    if (!scamRes.ok) {
      throw new Error((await scamRes.json()).error || "Failed to load");
    }
    const suspicious = (await suspiciousRes.json()).items as UserRow[];
    const scams = (await scamRes.json()).items as UserRow[];
    const merged = [...suspicious, ...scams].sort((a, b) => b.riskScore - a.riskScore);
    setUsers(merged);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function review(id: string, action: "mark_legitimate" | "confirm_scam" | "soft_delete") {
    if (action === "soft_delete" && !window.confirm("Soft-delete this user?")) return;
    if (action === "confirm_scam" && !window.confirm("Confirm this user as scam?")) return;

    const res = await fetch(`/api/admin/users/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Review failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scam Review"
        description="Manual review queue for profiles flagged by detection rules. Flagged ≠ confirmed scam."
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="space-y-3">
        {users.map((user) => {
          const reasons = Array.isArray(user.validationReasons)
            ? (user.validationReasons as unknown as string[])
            : parseJsonArray(user.validationReasons);
          return (
            <Card key={user.id} className="p-4 transition duration-200 hover:-translate-y-0.5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt=""
                      width={42}
                      height={42}
                      className="rounded-full ring-2 ring-white shadow-sm"
                      unoptimized
                    />
                  ) : null}
                  <div>
                    <a
                      href={user.htmlUrl || `https://github.com/${user.login}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-link font-semibold transition hover:underline underline-offset-2"
                    >
                      {user.login}
                    </a>
                    <div className="text-xs text-foreground/75">
                      Risk {user.riskScore} · scraped {formatDate(user.lastScrapedAt)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/users/${user.id}`}>
                    <Button variant="secondary" className="!px-3 !py-1.5 text-xs">
                      Details
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => review(user.id, "mark_legitimate")}
                  >
                    Legitimate
                  </Button>
                  <Button
                    variant="secondary"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => review(user.id, "confirm_scam")}
                  >
                    Confirm scam
                  </Button>
                  <Button
                    variant="danger"
                    className="!px-3 !py-1.5 text-xs"
                    onClick={() => review(user.id, "soft_delete")}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <ul className="mt-3 list-disc pl-5 text-sm text-foreground/85">
                {reasons.length === 0 ? <li>No reasons recorded</li> : null}
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Card>
          );
        })}
        {users.length === 0 ? (
          <Card className="px-4 py-10 text-center text-muted">
            No suspicious users awaiting review
          </Card>
        ) : null}
      </div>
    </div>
  );
}
