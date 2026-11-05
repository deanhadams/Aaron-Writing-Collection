"use client";

import { useEffect, type RefObject } from "react";

const FLASH_MS = 1800;
const SEARCH_MS = 3000;

/**
 * Scrolls to the line in the address, like #beat-abc, and briefly lights it up.
 * Looks only inside this page, because hidden routes keep their copies of the
 * same ids, and keeps looking a moment for a line that is still rendering.
 */
export function useBeatJump(root: RefObject<HTMLElement | null>, trigger?: unknown) {
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id.startsWith("beat-")) return;

    const started = performance.now();
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const find = () => {
      const beat = root.current?.querySelector<HTMLElement>(`[id="${id}"]`);
      if (!beat) {
        if (performance.now() - started < SEARCH_MS) frame = requestAnimationFrame(find);
        return;
      }

      beat.scrollIntoView({ block: "center" });
      beat.dataset.flash = "";
      timer = setTimeout(() => delete beat.dataset.flash, FLASH_MS);
    };

    find();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [root, trigger]);
}
