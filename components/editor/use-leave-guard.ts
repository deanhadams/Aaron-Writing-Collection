"use client";

import { useEffect } from "react";
const MESSAGE = "This scene has changes that have not been saved yet. Leave anyway?";

/** Warns on closing the tab, and on in-app links, which skip beforeunload. */
export function useLeaveGuard(queue: { isDirty: () => boolean }) {
  useEffect(() => {
    const handleUnload = (event: BeforeUnloadEvent) => {
      if (queue.isDirty()) event.preventDefault();
    };

    const handleClick = (event: MouseEvent) => {
      if (!queue.isDirty() || event.defaultPrevented) return;

      const link = (event.target as Element).closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (window.confirm(MESSAGE)) return;

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      document.removeEventListener("click", handleClick, true);
    };
  }, [queue]);
}
