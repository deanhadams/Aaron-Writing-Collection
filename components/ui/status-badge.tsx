type Status = "idea" | "drafting" | "done";

const STYLES: Record<Status, string> = {
  idea: "border-line bg-background text-ink/70",
  drafting: "border-primary/30 bg-primary/10 text-primary",
  done: "border-primary bg-primary text-white",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
