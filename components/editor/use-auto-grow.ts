"use client";

import { useLayoutEffect, type RefObject } from "react";

const supportsFieldSizing = () =>
  typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content") === true;

export function growToFit(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

/** Browsers with field-sizing grow in CSS, so this only runs in the others. */
export function useAutoGrow(element: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    if (element.current && !supportsFieldSizing()) growToFit(element.current);
  }, [element, value]);

  // A narrower row wraps the same text onto more lines.
  useLayoutEffect(() => {
    const node = element.current;
    if (!node || supportsFieldSizing() || typeof ResizeObserver === "undefined") return;

    let width = node.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (node.offsetWidth === width) return;
      width = node.offsetWidth;
      growToFit(node);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
}
