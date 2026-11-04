"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useModal } from "@/components/ui/use-modal";
import type { Outcome } from "@/lib/structure/board";

type Toast = { id: number; message: string; onUndo?: () => void };

const TOAST_MS = 8000;

function UndoToast({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  return (
    <div role="status" className="editor-toast">
      <span>{toast.message}</span>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            onDone();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}

/** The editor's conflict message, for changes to a season, episode or scene. */
function ConflictNotice({ noun, onReload }: { noun: string; onReload: () => void }) {
  const dialog = useModal();

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby="structure-conflict-title"
      aria-describedby="structure-conflict-body"
      className="editor-dialog"
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="structure-conflict-title" className="text-xl font-semibold">
        Someone else edited this {noun}
      </h2>
      <p id="structure-conflict-body" className="mt-2 text-sm text-muted">
        Your latest change has not been saved, and nothing of theirs was overwritten. Reload their
        version, then make your change again.
      </p>
      <div className="mt-5">
        <button type="button" className="btn-primary text-sm" onClick={onReload}>
          Reload their version
        </button>
      </div>
    </dialog>
  );
}

/** Toasts, the conflict message and the page refresh every board change needs. */
export function useFeedback() {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const nextToast = useRef(0);
  const hasShown = useRef(false);

  // Effects run again when a hidden route comes back, and it may be out of date.
  useEffect(() => {
    if (hasShown.current) router.refresh();
    hasShown.current = true;
  }, [router]);

  const clearToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    nextToast.current += 1;
    setToast({ id: nextToast.current, message, onUndo });
  }, []);

  /** True when the change landed. Everything else has told the person why it did not. */
  const report = useCallback(
    <R,>(outcome: Outcome<R>, noun: string): outcome is { kind: "ok"; data: R } => {
      if (outcome.kind === "ok") {
        router.refresh();
        return true;
      }

      if (outcome.kind === "conflict") setConflict(noun);
      if (outcome.kind === "signed_out") showToast("You have been signed out. Sign in again, then retry.");
      if (outcome.kind === "failed") showToast(outcome.message);
      return false;
    },
    [router, showToast],
  );

  const feedback = (
    <>
      {toast && <UndoToast key={toast.id} toast={toast} onDone={clearToast} />}
      {conflict && (
        <ConflictNotice
          noun={conflict}
          onReload={() => {
            setConflict(null);
            router.refresh();
          }}
        />
      )}
    </>
  );

  return { report, showToast, feedback };
}
