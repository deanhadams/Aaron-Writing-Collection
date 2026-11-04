"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  defaultAnimateLayoutChanges,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  type AnimateLayoutChanges,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useLayoutEffect, useMemo, useRef, type MouseEvent, type ReactNode } from "react";
import { DownIcon, GripIcon, UpIcon } from "./icons";

const SETTLE = { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };

// Also slides a row on a button press or an undo, not only after a drag.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

export function SortableBoard({
  id,
  items,
  strategy,
  labelFor,
  onMove,
  children,
}: {
  id: string;
  items: string[];
  strategy: SortingStrategy;
  labelFor: (id: string) => string;
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const announcements = useMemo<Announcements>(() => {
    const place = (over: string | number | undefined) => items.indexOf(String(over)) + 1;
    return {
      onDragStart: ({ active }) => `Picked up ${labelFor(String(active.id))}.`,
      onDragOver: ({ active, over }) =>
        over ? `${labelFor(String(active.id))} is over position ${place(over.id)}.` : undefined,
      onDragEnd: ({ active, over }) =>
        over ? `${labelFor(String(active.id))} dropped at position ${place(over.id)}.` : undefined,
      onDragCancel: ({ active }) => `Moving ${labelFor(String(active.id))} was cancelled.`,
    };
  }, [items, labelFor]);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMove(items.indexOf(String(active.id)), items.indexOf(String(over.id)));
  };

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={strategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges,
    transition: SETTLE,
  });

  return {
    setNodeRef,
    isDragging,
    style: { transform: CSS.Translate.toString(transform), transition },
    handle: { ref: setActivatorNodeRef, ...attributes, ...listeners },
  };
}

export type RowHandle = ReturnType<typeof useSortableRow>["handle"];

/** The handle is for a mouse or a finger; the two buttons do the same from a keyboard. */
export function ReorderTools({
  label,
  handle,
  index,
  count,
  onMove,
}: {
  label: string;
  handle: RowHandle;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const { ref, ...handleProps } = handle;
  const pressed = useRef<HTMLButtonElement | null>(null);

  // Moving a row moves its DOM node, which blurs it, so a keyboard user would
  // otherwise lose their place after one press.
  useLayoutEffect(() => {
    pressed.current?.focus();
    pressed.current = null;
  }, [index]);

  // aria-disabled, because a real disabled button would drop keyboard focus too.
  const press = (event: MouseEvent<HTMLButtonElement>, to: number) => {
    if (to < 0 || to >= count) return;
    pressed.current = event.currentTarget;
    onMove(index, to);
  };

  return (
    <>
      <button ref={ref} type="button" className="tool-button tool-handle" {...handleProps} aria-label={`Drag to reorder ${label}`}>
        <GripIcon />
      </button>
      <button type="button" className="tool-button" aria-label={`Move ${label} up`} aria-disabled={index === 0} onClick={(event) => press(event, index - 1)}>
        <UpIcon />
      </button>
      <button
        type="button"
        className="tool-button"
        aria-label={`Move ${label} down`}
        aria-disabled={index === count - 1}
        onClick={(event) => press(event, index + 1)}
      >
        <DownIcon />
      </button>
    </>
  );
}

export function InsertLine({ children }: { children: ReactNode }) {
  return <li className="scene-insert">{children}</li>;
}
