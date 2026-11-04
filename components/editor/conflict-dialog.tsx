"use client";

import { useEffect, useRef, useState } from "react";
import { fetchScene } from "@/lib/editor/api";
import type { SaveQueue } from "@/lib/editor/save-queue";
import type { EditorStore } from "@/lib/editor/store";
import { beatsToPlainText } from "@/lib/script/beat-fields";

export function ConflictDialog({
  sceneId,
  store,
  queue,
}: {
  sceneId: string;
  store: EditorStore;
  queue: SaveQueue;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [loadFailed, setLoadFailed] = useState(false);
  const plainText = beatsToPlainText(store.getDoc().beats);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopyState("copied");
    } catch {
      // No clipboard over plain http: show the text to select by hand.
      setCopyState("manual");
    }
  };

  const reload = async () => {
    if (copyState === "idle" && !window.confirm("Your changes will be replaced. Reload without copying them?")) {
      return;
    }

    const latest = await fetchScene(sceneId).catch(() => null);
    if (!latest) {
      setLoadFailed(true);
      return;
    }

    const { version, title, timecode, location, beats } = latest;
    store.replace({ title, timecode, location, beats });
    queue.adopt(version);
  };

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby="conflict-title"
      aria-describedby="conflict-body"
      className="editor-dialog"
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="conflict-title" className="text-xl font-semibold">
        Someone else edited this scene
      </h2>
      <p id="conflict-body" className="mt-2 text-sm text-muted">
        Your latest changes have not been saved, and nothing of theirs was overwritten. Copy your
        text first if you want to keep it, then reload their version.
      </p>

      {copyState === "manual" && (
        <textarea
          readOnly
          value={plainText}
          aria-label="Your text"
          className="field mt-3 h-40 w-full font-script text-sm"
          onFocus={(event) => event.target.select()}
        />
      )}
      {copyState === "copied" && <p className="mt-3 text-sm font-medium text-status-done">Copied.</p>}
      {loadFailed && (
        <p className="mt-3 text-sm font-medium text-status-idea">
          Could not reach the server. Your text is still here, so try again.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-primary text-sm" onClick={copy}>
          Copy my text
        </button>
        <button type="button" className="btn-ghost text-sm" onClick={reload}>
          Reload their version
        </button>
      </div>
    </dialog>
  );
}
