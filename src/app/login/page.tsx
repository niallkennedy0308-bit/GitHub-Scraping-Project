"use client";

import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Alert, Button, Input, Label } from "@/components/admin/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(45,212,191,0.22),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.18),transparent_28%),linear-gradient(160deg,#020617_0%,#0b1220_45%,#082f2b_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:36px_36px]"
      />

      <form
        onSubmit={onSubmit}
        className="ui-enter relative w-full max-w-md rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400/25 to-cyan-500/10 text-teal-200 ring-1 ring-teal-300/30">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Admin sign in</h1>
            <p className="text-sm text-muted">GitHub scraping & validation console</p>
          </div>
        </div>

        <div>
          <Label className="text-muted">Email</Label>
          <Input
            className="border-white/10 bg-slate-950/70 text-white placeholder:text-muted focus:border-teal-400/70"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mt-4">
          <Label className="text-muted">Password</Label>
          <Input
            className="border-white/10 bg-slate-950/70 text-white placeholder:text-muted focus:border-teal-400/70"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <Button type="submit" disabled={loading} className="mt-7 w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>

        <p className="mt-5 text-xs text-muted">
          Seeded admin: admin@example.com / admin123
          <br />
          Seeded user: user@example.com / user123
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  );
}
