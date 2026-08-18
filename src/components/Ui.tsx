import type { WeightRole } from "../lib/types";
import { roleLabel } from "../lib/weights";

export function RolePill({ role }: { role: WeightRole }) {
  return <span className={`pill ${role}`}>{roleLabel(role)}</span>;
}

export function Stat({
  value,
  label,
  warn,
}: {
  value: string | number;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className={`stat${warn ? " warn" : ""}`}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
