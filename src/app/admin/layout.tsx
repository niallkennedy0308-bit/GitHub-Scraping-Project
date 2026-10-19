import { AdminSidebar } from "@/components/admin/sidebar";
import { JobNotifier } from "@/components/admin/job-notifier";
import { AdminScrollRestoration } from "@/components/admin/scroll-restoration";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen text-foreground lg:flex">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 admin-shell-bg" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 admin-shell-grid" />
      <AdminScrollRestoration />
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
      <JobNotifier />
    </div>
  );
}
