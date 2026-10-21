import { PortalSidebar } from "@/components/portal/sidebar";
import { PortalScrollRestoration } from "@/components/portal/scroll-restoration";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen text-foreground lg:flex">
      <PortalScrollRestoration />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 admin-shell-bg" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 admin-shell-grid" />
      <PortalSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-5 sm:px-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
