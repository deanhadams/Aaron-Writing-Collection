"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Fragment } from "react";
import { flushSync } from "react-dom";
import { createBeat } from "@/lib/editor/store";
import { BeatRow } from "./beat-row";
import { useEditor, useFocusField, useOrder } from "./editor-context";

function InsertButton({ after }: { after: string | null }) {
  const { store } = useEditor();
  const focus = useFocusField();

  const insert = () => {
    const beat = createBeat("action");
    flushSync(() => store.insertAfter(after, beat));
    focus.text(beat.id);
  };

  return (
    <li className="beat-insert">
      <button type="button" aria-label={after ? "Add a beat here" : "Add a beat at the top"} onClick={insert}>
        +
      </button>
    </li>
  );
}

export function BeatList() {
  const { store } = useEditor();
  const order = useOrder();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) store.moveBeatTo(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="beat-list" aria-label="Beats">
          <InsertButton after={null} />
          {order.map((id, index) => (
            <Fragment key={id}>
              <BeatRow id={id} position={index + 1} />
              <InsertButton after={id} />
            </Fragment>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
