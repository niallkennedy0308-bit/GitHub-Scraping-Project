import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    default: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-[color:var(--border-strong)]",
    success: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25",
    warning: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
    danger: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
    info: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-[color:var(--border-strong)]",
  };

  return (
    <div className="ui-panel ui-enter group rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-lift)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint ? <p className="mt-2 text-xs text-muted/80">{hint}</p> : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-2xl ring-1 transition group-hover:scale-105",
              tones[tone],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
