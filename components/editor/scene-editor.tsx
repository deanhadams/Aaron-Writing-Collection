"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { createBeat, type EditorStore } from "@/lib/editor/store";
import type { SceneKind } from "@/lib/format";
import { BeatList } from "./beat-list";
import { EditorProvider, useEditor, useFocusField, useOrder, type CastMember, type Toast } from "./editor-context";
import { EditorFooter } from "./editor-footer";
import { SceneHeaderFields } from "./scene-header-fields";

const TOAST_MS = 6000;

function EmptyScene() {
  const { store } = useEditor();
  const focus = useFocusField();
  const order = useOrder();
  if (order.length > 0) return null;

  return (
    <button
      type="button"
      className="btn-ghost w-full text-sm"
      onClick={() => {
        const beat = createBeat("action");
        flushSync(() => store.insertAfter(null, beat));
        focus.text(beat.id);
      }}
    >
      Add the first beat
    </button>
  );
}

function UndoToast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <div className="editor-toast" role="status">
      {toast.message}
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onClose();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

export function SceneEditor({
  store,
  kind,
  cast,
}: {
  store: EditorStore;
  kind: SceneKind;
  cast: CastMember[];
}) {
  const [toast, setToast] = useState<Toast | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((next: Toast) => setToast(next), []);
  const root = useRef<HTMLDivElement>(null);

  // Undo works for this session's edits in every field, not the browser's per-field undo.
  const handleKey = (event: KeyboardEvent) => {
    const isUndoKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";
    const isRedoKey = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y";
    if (!isUndoKey && !isRedoKey) return;

    event.preventDefault();
    if (isRedoKey || event.shiftKey) store.redo();
    else store.undo();
  };

  return (
    <EditorProvider store={store} cast={cast} showToast={showToast}>
      <div ref={root} className="scene-editor" onKeyDown={handleKey}>
        <SceneHeaderFields store={store} kind={kind} />
        <BeatList />
        <EmptyScene />
        <EditorFooter store={store} />
        {toast && <UndoToast toast={toast} onClose={closeToast} />}
      </div>
    </EditorProvider>
  );
}
