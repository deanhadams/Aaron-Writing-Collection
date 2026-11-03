import type { CSSProperties } from "react";

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const style = { "--progress": value } as CSSProperties;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      className="h-2 overflow-hidden rounded-full bg-line"
    >
      <div className="progress-fill" style={style} />
    </div>
  );
}
