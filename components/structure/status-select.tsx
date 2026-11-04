"use client";

import { CheckIcon } from "@/components/library/scene-icons";
import type { Status } from "@/lib/structure/order";

const STATUSES: Status[] = ["idea", "drafting", "done"];

/** The status pill, as a native select so it works the same by touch and keyboard. */
export function StatusSelect({
  status,
  label,
  onChange,
}: {
  status: Status;
  label: string;
  onChange: (status: Status) => void;
}) {
  return (
    <span className="ep-status status-select" data-status={status}>
      {status === "done" ? <CheckIcon className="size-3.5" /> : <span aria-hidden className="ep-status-dot" />}
      <select aria-label={label} value={status} onChange={(event) => onChange(event.target.value as Status)}>
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </span>
  );
}
