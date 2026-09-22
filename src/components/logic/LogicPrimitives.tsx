import type { ComponentPropsWithoutRef, ReactNode } from "react";

function joinClasses(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function LogicMark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={joinClasses("grid h-9 w-9 grid-cols-2 gap-1", className)}>
      <span className="rounded-[2px] bg-logic-primary" />
      <span className="rounded-[2px] bg-text-primary" />
      <span className="rounded-[2px] bg-text-primary" />
      <span className="rounded-[2px] bg-logic-primary" />
    </span>
  );
}

export function LogicPanel({ children, className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={joinClasses("logic-panel", className)} {...props}>{children}</div>;
}

export function LogicDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-4" aria-hidden="true">
      <span className="h-px flex-1 bg-border-subtle" />
      {label ? <span className="font-mono text-[0.625rem] font-bold uppercase tracking-[0.2em] text-text-muted">{label}</span> : null}
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

export const logicButtonClass = ({ variant = "primary", size = "default", className }: {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "arena";
  size?: "compact" | "default" | "large";
  className?: string;
} = {}) => {
  const variants = {
    primary: "border-logic-primary bg-logic-primary text-text-inverse hover:border-white hover:bg-white",
    secondary: "border-border-default bg-transparent text-text-primary hover:border-border-strong hover:bg-surface-panel-hover",
    ghost: "border-transparent bg-transparent text-text-secondary hover:bg-surface-panel-hover hover:text-text-primary",
    danger: "border-state-danger bg-state-danger text-text-inverse hover:border-white hover:bg-white",
    arena: "border-logic-secondary bg-logic-secondary text-text-inverse shadow-[0_0_24px_rgba(113,219,232,0.12)] hover:border-white hover:bg-white",
  };
  const sizes = {
    compact: "min-h-11 px-4 py-2 text-[0.625rem]",
    default: "min-h-12 px-5 py-3 text-xs",
    large: "min-h-14 px-6 py-4 text-xs",
  };
  return joinClasses("inline-flex items-center justify-center rounded-[var(--radius-control)] border font-mono font-black uppercase tracking-[0.18em] outline-none transition-colors duration-150 disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-surface-elevated disabled:text-text-muted disabled:shadow-none", variants[variant], sizes[size], className);
};

export function LogicButton({ variant = "primary", size = "default", className, ...props }: ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "arena";
  size?: "compact" | "default" | "large";
}) {
  return <button className={logicButtonClass({ variant, size, className })} {...props} />;
}

type LogicStatusName = "waiting" | "ready" | "active" | "qualified" | "eliminated" | "completed" | "cancelled" | "connecting" | "reconnecting" | "error";
const statusStyles: Record<LogicStatusName, string> = {
  waiting: "border-border-default text-state-waiting", ready: "border-state-success/35 text-state-success",
  active: "border-state-active/35 text-state-active", qualified: "border-state-qualified/35 text-state-qualified",
  eliminated: "border-state-eliminated/35 text-state-eliminated", completed: "border-logic-secondary/35 text-logic-secondary",
  cancelled: "border-state-danger/35 text-state-danger", connecting: "border-state-info/35 text-state-info",
  reconnecting: "border-state-warning/35 text-state-warning", error: "border-state-danger/35 text-state-danger",
};

export function LogicStatus({ status, label, className }: { status: LogicStatusName; label?: string; className?: string }) {
  return (
    <span className={joinClasses("inline-flex min-h-7 items-center gap-2 rounded-full border bg-surface-elevated px-3 font-mono text-[0.625rem] font-black uppercase tracking-[0.16em]", statusStyles[status], className)}>
      <span className="h-1.5 w-1.5 rotate-45 bg-current" aria-hidden="true" />{label ?? status}
    </span>
  );
}

export function LogicMetric({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={joinClasses("bg-surface-elevated px-4 py-5", className)}>
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-text-muted">{label}</dt>
      <dd className="mt-2 font-mono text-base font-black text-text-primary">{value}</dd>
    </div>
  );
}

export function LogicCode({ children }: { children: ReactNode }) {
  return <span className="font-mono text-4xl font-black tracking-[0.22em] text-text-primary sm:text-5xl">{children}</span>;
}
