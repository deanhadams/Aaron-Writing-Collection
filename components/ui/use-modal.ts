"use client";

import { useEffect, useRef } from "react";

/**
 * Opens a dialog as a modal, and closes it when the route is hidden. Next keeps
 * left routes alive, and a modal still open in one would block the next page.
 *
 * The close waits a tick. Strict Mode runs this effect, its cleanup and the
 * effect again in development, and a real close there would fire a close event
 * after the dialog had reopened, which reads as the person dismissing it.
 */
export function useModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pendingClose = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const element = dialog.current;
    clearTimeout(pendingClose.current);
    if (element && !element.open) element.showModal();

    return () => {
      pendingClose.current = setTimeout(() => element?.close());
    };
  }, []);

  return dialog;
}
