"use client";

import { useSyncExternalStore } from "react";
import type { SaveQueue, SaveStatus } from "@/lib/editor/save-queue";

const LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  offline: "Offline / retrying",
  signed_out: "Signed out, log in to save",
  conflict: "Conflict",
};

export function useSaveStatus(queue: SaveQueue) {
  return useSyncExternalStore(queue.subscribe, queue.getStatus, queue.getStatus);
}

export function SaveIndicator({ queue }: { queue: SaveQueue }) {
  const status = useSaveStatus(queue);

  return (
    <span role="status" className="save-indicator" data-status={status}>
      <span aria-hidden className="save-dot" />
      {LABELS[status]}
    </span>
  );
}
