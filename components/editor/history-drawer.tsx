"use client";

import { useEffect, useState } from "react";
import { useModal } from "@/components/ui/use-modal";
import { ScriptBeat } from "@/components/script/script-beat";
import { fetchRevisions, restoreVersion, type Revision } from "@/lib/editor/api";
import type { SaveQueue } from "@/lib/editor/save-queue";
import type { EditorStore } from "@/lib/editor/store";
import { formatRelative, plural } from "@/lib/format";

type Props = {
  sceneId: string;
  store: EditorStore;
  queue: SaveQueue;
  characterColors: Map<string, string | null>;
  onClose: () => void;
};

function RevisionPreview({
  revision,
  characterColors,
  isRestoring,
  onRestore,
}: {
  revision: Revision;
  characterColors: Props["characterColors"];
  isRestoring: boolean;
  onRestore: () => void;
}) {
  const hidden = revision.beatCount - revision.preview.length;
  const hasHeader = Boolean(revision.title || revision.timecode || revision.location);

  return (
    <div className="history-preview">
      {hasHeader ? (
        <p className="mt-2 text-sm">
          <span className="font-medium">{revision.title ?? "Untitled"}</span>
          {revision.timecode && <span className="text-muted"> · {revision.timecode}</span>}
          {revision.location && <span className="block text-muted">{revision.location}</span>}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Saved before headers were kept, so restoring leaves the title, timecode and location as
          they are.
        </p>
      )}
      <div className="font-script text-sm">
        {revision.preview.map((beat) => (
          <ScriptBeat key={beat.id} beat={beat} characterColors={characterColors} />
        ))}
      </div>
      {hidden > 0 && <p className="text-xs text-muted">and {plural(hidden, "more beat")}</p>}
      <button type="button" className="btn-primary mt-3 text-sm" disabled={isRestoring} onClick={onRestore}>
        {isRestoring ? "Restoring…" : "Restore this version"}
      </button>
    </div>
  );
}

export function HistoryDrawer({ sceneId, store, queue, characterColors, onClose }: Props) {
  const dialog = useModal();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isRestoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    fetchRevisions(sceneId)
      .then(setRevisions)
      .catch(() => setError("Could not load the history."));
  }, [sceneId]);

  const restore = async (revisionId: string) => {
    setRestoring(true);
    setError(null);

    // Unsaved work goes in first, so it lands in history rather than vanishing.
    const isClean = await queue.flush();
    const result = isClean
      ? await restoreVersion(sceneId, revisionId, queue.getVersion())
      : ({ kind: "failed" } as const);

    setRestoring(false);

    if (result.kind === "saved") {
      const { title, timecode, location, beats, version } = result;
      store.replace({ title, timecode, location, beats });
      queue.adopt(version);
      onClose();
    } else if (result.kind === "conflict") {
      queue.markConflict();
      onClose();
    } else {
      setError("Could not restore. Your scene has not changed.");
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="history-title" className="history-drawer" onClose={onClose}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-title" className="text-xl font-semibold">
          History
        </h2>
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="mt-1 text-sm text-muted">
        Autosaves are grouped, keeping one version for every 5 minutes each person edits.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-status-idea">
          {error}
        </p>
      )}
      {revisions === null && !error && <p className="mt-4 text-sm text-muted">Loading…</p>}
      {revisions?.length === 0 && (
        <p className="mt-4 text-sm text-muted">No earlier versions yet. Each save adds one.</p>
      )}

      <ul className="mt-4 grid gap-2">
        {revisions?.map((revision) => {
          const isOpen = openId === revision.id;

          return (
            <li key={revision.id} className="history-item">
              <button
                type="button"
                aria-expanded={isOpen}
                className="history-row"
                onClick={() => setOpenId(isOpen ? null : revision.id)}
              >
                <span className="font-medium">
                  {revision.savedBy ?? "Imported"}
                  {revision.sealed && <span className="history-tag">Before a restore</span>}
                </span>
                <span className="text-muted">
                  {formatRelative(new Date(revision.savedAt), now)} · {plural(revision.beatCount, "beat")}
                </span>
              </button>
              {isOpen && (
                <RevisionPreview
                  revision={revision}
                  characterColors={characterColors}
                  isRestoring={isRestoring}
                  onRestore={() => restore(revision.id)}
                />
              )}
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
