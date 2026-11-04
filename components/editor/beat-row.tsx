"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, type CSSProperties } from "react";
import { BEAT_TYPES, type Beat, type BeatType } from "@/lib/db/schema";
import { BEAT_LABELS } from "./beat-types";
import { BeatText } from "./beat-text";
import { useBeat, useEditor, useFocusField } from "./editor-context";
import { SpeakerField } from "./speaker-field";

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="currentColor">
      {[3, 8, 13].flatMap((y) => [5, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
    </svg>
  );
}

function TypeChip({ beat, position }: { beat: Beat; position: number }) {
  const { store } = useEditor();

  return (
    <select
      value={beat.type}
      aria-label={`Type of beat ${position}`}
      className="beat-chip"
      onChange={(event) => store.setType(beat.id, event.target.value as BeatType)}
    >
      {BEAT_TYPES.map((type) => (
        <option key={type} value={type}>
          {BEAT_LABELS[type]}
        </option>
      ))}
    </select>
  );
}

function SpeakerLine({ beat, position }: { beat: Beat; position: number }) {
  const { store } = useEditor();
  const isVoice = beat.type === "vo";

  return (
    <div className="beat-speaker">
      {isVoice ? (
        <input
          value={beat.character ?? ""}
          placeholder="Voice label (optional)"
          aria-label={`Voice label for beat ${position}`}
          className="speaker-input"
          onChange={(event) =>
            store.updateBeat(beat.id, { character: event.target.value.toUpperCase() }, `voice:${beat.id}`)
          }
        />
      ) : (
        <SpeakerField beat={beat} />
      )}
      <input
        value={beat.parenthetical ?? ""}
        placeholder="(parenthetical)"
        aria-label={`Parenthetical for beat ${position}`}
        className="beat-parenthetical"
        onChange={(event) =>
          store.updateBeat(beat.id, { parenthetical: event.target.value }, `aside:${beat.id}`)
        }
      />
    </div>
  );
}

export const BeatRow = memo(function BeatRow({ id, position }: { id: string; position: number }) {
  const { store, showToast } = useEditor();
  const focus = useFocusField();
  const beat = useBeat(id);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, animateLayoutChanges: () => true });

  if (!beat) return null;

  const remove = () => {
    const removed = store.removeBeat(id);
    if (!removed) return;

    showToast({
      message: "Beat deleted",
      onUndo: () => store.restoreBeat(removed.beat, removed.index),
    });
    if (removed.previous) focus.text(removed.previous);
  };

  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition };
  const label = `${BEAT_LABELS[beat.type]} text, beat ${position}`;

  return (
    <li ref={setNodeRef} style={style} data-beat={beat.type} data-dragging={isDragging || undefined} className="beat-row">
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="beat-handle"
        {...attributes}
        {...listeners}
        aria-label={`Move beat ${position}`}
      >
        <GripIcon />
      </button>

      <TypeChip beat={beat} position={position} />

      <div className="beat-body">
        {(beat.type === "dialogue" || beat.type === "vo") && <SpeakerLine beat={beat} position={position} />}
        <BeatText beat={beat} label={label} />
      </div>

      <button type="button" className="beat-delete" aria-label={`Delete beat ${position}`} onClick={remove}>
        ×
      </button>
    </li>
  );
});
