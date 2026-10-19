"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Navigate back via history when possible so list pages can restore scroll.
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={cn(
        "ui-link text-sm font-semibold transition hover:underline underline-offset-4",
        className,
      )}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(href);
      }}
    >
      {children}
    </button>
  );
}
