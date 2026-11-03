type Status = "idea" | "drafting" | "done";

// Tints are mixed with white, not transparent: pills often sit directly on
// the moving mesh, and their text must stay AA whatever drifts behind them.
const STYLES: Record<Status, string> = {
  idea: "bg-[color-mix(in_srgb,var(--color-violet)_15%,white)] text-status-idea",
  drafting: "bg-[color-mix(in_srgb,var(--color-neon)_15%,white)] text-status-drafting",
  done: "bg-[color-mix(in_srgb,var(--color-status-done)_15%,white)] text-status-done",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`eyebrow shrink-0 rounded-full px-2.5 py-1 ${STYLES[status]}`}>
      {status}
    </span>
  );
}
