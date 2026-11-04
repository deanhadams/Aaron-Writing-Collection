"use client";

import { useEffect, useRef } from "react";

/**
 * Opens a dialog as a modal, and closes it when the route is hidden. Next keeps
 * left routes alive, and a modal still open in one would block the next page.
 */
export function useModal() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return dialog;
}
