import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("ui-panel ui-enter rounded-2xl", className)}>{children}</div>;
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "ui-btn-primary",
    secondary: "ui-btn-secondary",
    danger: "ui-btn-danger",
    ghost: "ui-btn-ghost",
  };

  return (
    <button className={cn("ui-btn", styles[variant], className)} {...props}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("ui-field", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("ui-field", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn("ui-field min-h-[6.5rem] resize-y leading-relaxed", props.className)}
    />
  );
}

export function Label({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral:
      "bg-[color:var(--badge-neutral-bg)] text-[color:var(--badge-neutral-fg)] ring-[color:var(--badge-neutral-ring)]",
    success:
      "bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-fg)] ring-[color:var(--badge-success-ring)]",
    warning:
      "bg-[color:var(--badge-warning-bg)] text-[color:var(--badge-warning-fg)] ring-[color:var(--badge-warning-ring)]",
    danger:
      "bg-[color:var(--badge-danger-bg)] text-[color:var(--badge-danger-fg)] ring-[color:var(--badge-danger-ring)]",
    info: "bg-[color:var(--accent-soft)] text-[color:var(--accent)] ring-[color:var(--border-strong)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto mb-3 h-10 w-10 rounded-2xl bg-[color:var(--accent-soft)] ring-1 ring-[color:var(--border-strong)]" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export function Alert({
  children,
  tone = "danger",
}: {
  children: React.ReactNode;
  tone?: "danger" | "warning" | "info" | "success";
}) {
  const tones = {
    danger:
      "border-[color:var(--alert-danger-border)] bg-[color:var(--alert-danger-bg)] text-[color:var(--alert-danger-fg)]",
    warning:
      "border-[color:var(--alert-warning-border)] bg-[color:var(--alert-warning-bg)] text-[color:var(--alert-warning-fg)]",
    info: "border-[color:var(--border-strong)] bg-[color:var(--accent-soft)] text-foreground",
    success:
      "border-[color:var(--alert-success-border)] bg-[color:var(--alert-success-bg)] text-[color:var(--alert-success-fg)]",
  };
  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm shadow-sm", tones[tone])}>
      {children}
    </div>
  );
}
