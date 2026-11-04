"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type ToggleEvent } from "react";
import { MoreIcon } from "./icons";

const GAP = 6;

const itemsIn = (menu: HTMLElement | null) => [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

/**
 * A native popover: it sits in the top layer, so no card clips it or moves it
 * while dragging, and the browser handles Escape, clicks outside and focus return.
 */
export function ActionMenu({ label, text, children }: { label: string; text?: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const close = () => menu.current?.hidePopover();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  const place = (event: ToggleEvent<HTMLDivElement>) => {
    const opened = event.newState === "open";
    setOpen(opened);
    if (!opened || !trigger.current || !menu.current) return;

    const box = trigger.current.getBoundingClientRect();
    const { offsetWidth, offsetHeight, style } = menu.current;
    const fitsBelow = box.bottom + GAP + offsetHeight <= window.innerHeight;

    style.left = `${Math.max(GAP, Math.min(box.right - offsetWidth, window.innerWidth - offsetWidth - GAP))}px`;
    style.top = `${fitsBelow ? box.bottom + GAP : Math.max(GAP, box.top - GAP - offsetHeight)}px`;
    itemsIn(menu.current)[0]?.focus();
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemsIn(menu.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const targets: Record<string, number> = {
      ArrowDown: (index + 1) % items.length,
      ArrowUp: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    if (!(event.key in targets)) return;

    event.preventDefault();
    items[targets[event.key]]?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget={id}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        className={text ? "btn-ghost text-sm" : "tool-button"}
      >
        {text ?? <MoreIcon />}
      </button>
      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        aria-label={label}
        className="action-menu"
        onToggle={place}
        onKeyDown={moveFocus}
        onClick={() => menu.current?.hidePopover()}
      >
        {children}
      </div>
    </>
  );
}

export function MenuItem({ onSelect, danger, children }: { onSelect: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" data-danger={danger || undefined} className="action-menu-item" onClick={onSelect}>
      {children}
    </button>
  );
}
