import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 px-4">
      <h1 className="text-3xl font-semibold">403 Forbidden</h1>
      <p className="text-muted">You do not have permission to access the admin area.</p>
      <Link href="/login" className="text-[color:var(--link)] underline">
        Back to login
      </Link>
    </div>
  );
}
