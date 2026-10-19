"use client";

import { useState } from "react";
import { Link2, Mail } from "lucide-react";
import { Alert, Button, Input } from "@/components/admin/ui";

type Props = {
  userId: string;
  missingEmail: boolean;
  missingLinkedIn: boolean;
  onSaved: () => Promise<void> | void;
};

export function MissingContactForm({
  userId,
  missingEmail,
  missingLinkedIn,
  onSaved,
}: Props) {
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!missingEmail && !missingLinkedIn) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const payload: { email?: string; linkedinUrl?: string } = {};
      if (missingEmail && email.trim()) payload.email = email.trim();
      if (missingLinkedIn && linkedinUrl.trim()) payload.linkedinUrl = linkedinUrl.trim();

      if (!payload.email && !payload.linkedinUrl) {
        setError("Enter an email and/or LinkedIn URL to save.");
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save contact info");
        return;
      }

      setEmail("");
      setLinkedinUrl("");
      setSuccess("Contact information saved. Validation signals were refreshed when applicable.");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 rounded-2xl border border-[color:var(--accent)]/25 bg-[color:var(--accent-soft)] p-4"
    >
      <p className="text-sm font-semibold text-foreground">Add missing contact info</p>
      <p className="mt-1 text-xs text-muted">
        Admins and regular users can supply email or LinkedIn when GitHub did not provide them.
      </p>

      <div className="mt-4 space-y-3">
        {missingEmail ? (
          <label className="block text-sm text-muted">
            <span className="mb-1.5 inline-flex items-center gap-1.5 font-medium text-foreground">
              <Mail className="h-3.5 w-3.5" />
              Email
            </span>
            <Input
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : null}

        {missingLinkedIn ? (
          <label className="block text-sm text-muted">
            <span className="mb-1.5 inline-flex items-center gap-1.5 font-medium text-foreground">
              <Link2 className="h-3.5 w-3.5" />
              LinkedIn profile URL
            </span>
            <Input
              type="url"
              autoComplete="url"
              placeholder="https://www.linkedin.com/in/username"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {success ? (
        <div className="mt-3">
          <Alert tone="success">{success}</Alert>
        </div>
      ) : null}

      <Button type="submit" className="mt-4" disabled={saving}>
        {saving ? "Saving…" : "Save contact info"}
      </Button>
    </form>
  );
}
