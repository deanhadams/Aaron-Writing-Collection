"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreIcon } from "./icons";

const GAP = 6;
const SHEET_QUERY = "(max-width: 640px)";

const itemsIn = (panel: HTMLElement | null) => [...(panel?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

/** Runs a row's action after the menu has closed and handed focus back. */
const MenuContext = createContext<(action: () => void) => void>((action) => action());

/**
 * Portalled to the body, so no card can clip it or stack over it. It opens as a
 * dropdown, or as a bottom sheet on a phone.
 *
 * keepFocusOn: a row moved by this menu is a DOM node moved, which blurs the
 * trigger, so pass the row's index and focus comes back after the move.
 */
export function ActionMenu({
  label,
  text,
  trigger: triggerContent,
  triggerClass = "tool-button",
  keepFocusOn,
  children,
}: {
  label: string;
  text?: string;
  trigger?: ReactNode;
  triggerClass?: string;
  keepFocusOn?: number;
  children: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const isReturning = useRef(false);
  const [isOpen, setOpen] = useState(false);
  const [isSheet, setSheet] = useState(false);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  const toggle = () => {
    setSheet(window.matchMedia?.(SHEET_QUERY).matches ?? false);
    setOpen((open) => !open);
  };

  const select = useCallback(
    (action: () => void) => {
      isReturning.current = true;
      close();
      action();
      setTimeout(() => {
        isReturning.current = false;
      });
    },
    [close],
  );

  useLayoutEffect(() => {
    if (isReturning.current) trigger.current?.focus();
  }, [keepFocusOn]);

  const place = useCallback(() => {
    if (!panel.current || !trigger.current || panel.current.dataset.sheet !== undefined) return;

    const box = trigger.current.getBoundingClientRect();
    const { offsetWidth, offsetHeight, style } = panel.current;
    const fitsBelow = box.bottom + GAP + offsetHeight <= window.innerHeight;

    style.left = `${Math.max(GAP, Math.min(box.right - offsetWidth, window.innerWidth - offsetWidth - GAP))}px`;
    style.top = `${fitsBelow ? box.bottom + GAP : Math.max(GAP, box.top - GAP - offsetHeight)}px`;
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    place();
    itemsIn(panel.current)[0]?.focus({ preventScroll: true });
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOutside = ({ target }: PointerEvent) => {
      if (!(target instanceof Element)) return;
      // The scrim closes on its own click, so that tap cannot reach the card below.
      if (panel.current?.contains(target) || trigger.current?.contains(target) || target.closest(".menu-scrim")) return;
      close(false);
    };

    // Follows its trigger: a scroll can arrive just after opening, so it must not close.
    document.addEventListener("pointerdown", closeOutside, true);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", closeOutside, true);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen, place, close]);

  // Hidden routes stay mounted, and a portal would stay on screen with them.
  useEffect(() => () => setOpen(false), []);

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
      return;
    }

    const items = itemsIn(panel.current);
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

  const menu = useMemo(() => select, [select]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        aria-label={label}
        className={text ? "btn-ghost text-sm" : triggerClass}
        onClick={toggle}
      >
        {text ?? triggerContent ?? <MoreIcon />}
      </button>

      {isOpen &&
        createPortal(
          <MenuContext.Provider value={menu}>
            {isSheet && <div aria-hidden className="menu-scrim" onClick={() => close()} />}
            <div
              ref={panel}
              id={id}
              role="menu"
              aria-label={label}
              data-sheet={isSheet || undefined}
              className="action-menu"
              onKeyDown={handleKey}
            >
              {isSheet && (
                <p aria-hidden className="action-menu-title">
                  {label}
                </p>
              )}
              {children}
            </div>
          </MenuContext.Provider>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  onSelect,
  icon,
  danger,
  children,
}: {
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  const select = useContext(MenuContext);

  return (
    <button
      type="button"
      role="menuitem"
      data-danger={danger || undefined}
      className="action-menu-item"
      onClick={() => select(onSelect)}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div role="separator" className="action-menu-divider" />;
}
