"use client";

import { useEffect, useState } from "react";
import { useModal } from "@/components/ui/use-modal";
import type { LoreDraft } from "@/lib/db/schema";
import type { SaveQueue } from "@/lib/editor/save-queue";
import { formatRelative } from "@/lib/format";
import { fetchRevisions, restoreRevision, type LoreRevision } from "@/lib/lore/client";

/** The scene editor's conflict message, for an entry. */
export function LoreConflict({ onReload }: { onReload: () => Promise<boolean> }) {
  const dialog = useModal();
  const [failed, setFailed] = useState(false);

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby="lore-conflict-title"
      aria-describedby="lore-conflict-body"
      className="editor-dialog"
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="lore-conflict-title" className="text-xl font-semibold">
        Someone else edited this entry
      </h2>
      <p id="lore-conflict-body" className="mt-2 text-sm text-muted">
        Your latest changes have not been saved, and nothing of theirs was overwritten. Copy your text first if you
        want to keep it, then reload their version.
      </p>
      {failed && (
        <p className="mt-3 text-sm font-medium text-status-idea">
          Could not load it. The entry may have been deleted: check Recently deleted in the lore menu.
        </p>
      )}
      <div className="mt-5">
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={async () => {
            if (!(await onReload())) setFailed(true);
          }}
        >
          Reload their version
        </button>
      </div>
    </dialog>
  );
}

export function LoreHistory({
  id,
  queue,
  onRestored,
  onClose,
}: {
  id: string;
  queue: SaveQueue;
  onRestored: (draft: LoreDraft) => void;
  onClose: () => void;
}) {
  const dialog = useModal();
  const [revisions, setRevisions] = useState<LoreRevision[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isRestoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    fetchRevisions(id)
      .then(setRevisions)
      .catch(() => setError("Could not load the history."));
  }, [id]);

  const restore = async (revisionId: string) => {
    setRestoring(true);
    setError(null);

    // Unsaved work goes in first, so it lands in history rather than vanishing.
    const isClean = await queue.flush();
    const result = isClean ? await restoreRevision(id, revisionId, queue.getVersion()) : ({ kind: "failed" } as const);
    setRestoring(false);

    if (result.kind === "saved") {
      onRestored(result.draft);
      queue.adopt(result.version);
      onClose();
    } else if (result.kind === "conflict") {
      queue.markConflict();
      onClose();
    } else {
      setError("Could not restore. Your entry has not changed.");
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="lore-history-title" className="history-drawer" onClose={onClose}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="lore-history-title" className="text-xl font-semibold">
          History
        </h2>
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Autosaves are grouped, keeping one version for every 5 minutes each person edits.</p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-status-idea">
          {error}
        </p>
      )}
      {revisions === null && !error && <p className="mt-4 text-sm text-muted">Loading…</p>}
      {revisions?.length === 0 && <p className="mt-4 text-sm text-muted">No earlier versions yet. Each save adds one.</p>}

      <ul className="mt-4 grid gap-2">
        {revisions?.map((revision) => {
          const isOpen = openId === revision.id;

          return (
            <li key={revision.id} className="history-item">
              <button type="button" aria-expanded={isOpen} className="history-row" onClick={() => setOpenId(isOpen ? null : revision.id)}>
                <span className="font-medium">
                  {revision.savedBy ?? "Starter entry"}
                  {revision.sealed && <span className="history-tag">Before a restore</span>}
                </span>
                <span className="text-muted">{formatRelative(new Date(revision.savedAt), now)}</span>
              </button>
              {isOpen && (
                <div className="history-preview">
                  <p className="mt-2 text-sm font-medium">{revision.content.title}</p>
                  <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm text-muted">{revision.content.body}</p>
                  <button type="button" className="btn-primary mt-3 text-sm" disabled={isRestoring} onClick={() => restore(revision.id)}>
                    {isRestoring ? "Restoring…" : "Restore this version"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
