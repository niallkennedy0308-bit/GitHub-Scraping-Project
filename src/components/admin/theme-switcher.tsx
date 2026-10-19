"use client";

import { Check, Palette } from "lucide-react";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({
  compact = false,
  rail = false,
}: {
  compact?: boolean;
  rail?: boolean;
}) {
  const { theme, setTheme, themes } = useTheme();

  if (compact) {
    return (
      <div className={cn("space-y-2", rail && "space-y-1.5")}>
        {!rail ? (
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--sidebar-muted)]">
            Theme
          </p>
        ) : null}
        <div className={cn(rail ? "flex flex-col items-center gap-1.5" : "grid grid-cols-5 gap-1.5")}>
          {themes.map((item) => {
            const active = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={`Use ${item.label} theme`}
                aria-pressed={active}
                onClick={() => setTheme(item.id)}
                className={cn(
                  "relative overflow-hidden rounded-lg ring-1 transition",
                  rail ? "h-7 w-7" : "h-8",
                  active
                    ? "ring-[color:var(--accent)] ring-offset-1 ring-offset-[color:var(--sidebar)]"
                    : "ring-white/15 hover:ring-white/35",
                )}
              >
                <span
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, ${item.swatches[0]} 0%, ${item.swatches[1]} 55%, ${item.swatches[2]} 100%)`,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)] ring-1 ring-[color:var(--border-strong)]">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Color theme</p>
          <p className="text-xs text-muted">Choose a refined palette for the admin console.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((item) => {
          const active = theme === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              aria-pressed={active}
              className={cn(
                "group rounded-2xl border p-3 text-left transition duration-200",
                active
                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-[var(--shadow-soft)]"
                  : "border-border bg-[color:var(--surface-solid)] hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-soft)]",
              )}
            >
              <div className="mb-3 flex h-14 overflow-hidden rounded-xl ring-1 ring-black/10">
                {item.swatches.map((color) => (
                  <span key={color} className="flex-1" style={{ background: color }} />
                ))}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
                </div>
                {active ? (
                  <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent)] text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
