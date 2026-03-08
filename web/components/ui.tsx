import { PropsWithChildren } from "react";

export function StatusBadge({ enabled }: { enabled: boolean }) {
  return <span className={`badge ${enabled ? "badge-enabled" : "badge-disabled"}`}>{enabled ? "enabled" : "disabled"}</span>;
}

export function Card({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section className="card">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

