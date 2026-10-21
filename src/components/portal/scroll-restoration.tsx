"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { readScroll, restoreScroll, saveScroll } from "@/lib/scroll-memory";

/**
 * Keeps portal page scroll when navigating away and back.
 * Discover restores after its async table load (handled in the page).
 */
export function PortalScrollRestoration() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (pathname === "/portal/discover") {
      const onScroll = () => {
        const y = window.scrollY || window.pageYOffset || 0;
        if (y > 0) saveScroll(pathnameRef.current, y);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", onScroll);
      };
    }

    const saved = readScroll(pathname);
    let cancelled = false;

    const restore = () => {
      if (cancelled || saved == null || saved <= 0) return;
      restoreScroll(pathname);
    };

    restore();
    const raf = requestAnimationFrame(restore);
    const timers = [50, 150, 300, 600].map((ms) => window.setTimeout(restore, ms));

    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y > 0) saveScroll(pathnameRef.current, y);
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  return null;
}
