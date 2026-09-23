import type { ReactNode } from "react";

export function LogicPulse({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <span className={`logic-pulse ${className}`}>{children}</span>;
}

export function LogicCountdown({ value, className = "" }: { value: number | string; className?: string }) {
  return <span aria-live="polite" className={`logic-countdown ${className}`}>{value}</span>;
}

export function LogicFeedbackState({ state, children, className = "", role }: { state: "success" | "failure" | "warning" | "neutral"; children: ReactNode; className?: string; role?: "status" | "alert" }) {
  return <div role={role} data-feedback-state={state} className={`logic-feedback-state ${className}`}>{children}</div>;
}
