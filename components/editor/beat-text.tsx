"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { BEAT_TYPES, type Beat, type BeatType } from "@/lib/db/schema";
import { createBeat, nextType } from "@/lib/editor/store";
import { hasSpeaker } from "@/lib/script/beat-fields";
import { BEAT_LABELS } from "./beat-types";
import { useEditor, useFocusField, useRegisterField } from "./editor-context";

const PLACEHOLDERS: Record<BeatType, string> = {
  dialogue: "What do they say?",
  visual: "What do we see?",
  sound: "What do we hear?",
  vo: "What does the voice say?",
  action: "What happens?",
  note: "A note for the writers. Type / for beat types",
};

function slashMatches(text: string) {
  if (!text.startsWith("/") || /\s/.test(text)) return null;
  const query = text.slice(1).toLowerCase();
  return BEAT_TYPES.filter((type) => BEAT_LABELS[type].toLowerCase().startsWith(query));
}

export function BeatText({ beat, label }: { beat: Beat; label: string }) {
  const { store } = useEditor();
  const focus = useFocusField();
  const register = useRegisterField(beat.id, "text");
  const element = useRef<HTMLTextAreaElement | null>(null);
  const isTabReleased = useRef(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const [isMenuDismissed, setMenuDismissed] = useState(false);

  const matches = isMenuDismissed ? null : slashMatches(beat.text);
  const isMenuOpen = Boolean(matches?.length);
  const menuId = `slash-${beat.id}`;

  const chooseType = (type: BeatType) => {
    flushSync(() => store.setType(beat.id, type, { text: "" }));
    setMenuIndex(0);
    if (hasSpeaker(type)) focus.speaker(beat.id);
    else focus.text(beat.id);
  };

  const addAfter = (caret: number) => {
    const next = createBeat(beat.type, hasSpeaker(beat.type) ? beat.character : undefined);

    flushSync(() => {
      if (caret < beat.text.length) store.splitBeat(beat.id, caret, next);
      else store.insertAfter(beat.id, next);
    });

    if (beat.type === "dialogue" && caret >= beat.text.length) focus.speaker(next.id, { prompt: true });
    else focus.text(next.id, "start");
  };

  const handleMenuKey = (event: KeyboardEvent, options: BeatType[]) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setMenuIndex((index) => (index + step + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      chooseType(options[Math.min(menuIndex, options.length - 1)]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMenuDismissed(true);
    }
  };

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (matches?.length) {
      handleMenuKey(event, matches);
      if (event.defaultPrevented) return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      addAfter(event.currentTarget.selectionStart);
    } else if (event.key === "Backspace" && beat.text === "") {
      event.preventDefault();
      if (store.getOrder().length === 1) return;
      const removed = flushSync(() => store.removeBeat(beat.id));
      if (removed?.previous) focus.text(removed.previous);
    } else if (event.key === "Tab" && !isTabReleased.current) {
      event.preventDefault();
      store.setType(beat.id, nextType(beat.type, event.shiftKey ? -1 : 1));
    } else if (event.key === "Escape") {
      // Tab changes the type here, so Escape hands it back for leaving the field.
      isTabReleased.current = true;
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const caret = event.currentTarget.selectionStart;
      flushSync(() => store.moveBeat(beat.id, event.key === "ArrowUp" ? -1 : 1));
      element.current?.focus();
      element.current?.setSelectionRange(caret, caret);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={(node) => {
          element.current = node;
          register(node);
        }}
        rows={1}
        value={beat.text}
        placeholder={PLACEHOLDERS[beat.type]}
        aria-label={label}
        aria-describedby="editor-keys"
        role={isMenuOpen ? "combobox" : undefined}
        aria-expanded={isMenuOpen ? true : undefined}
        aria-controls={isMenuOpen ? menuId : undefined}
        aria-activedescendant={isMenuOpen ? `${menuId}-${menuIndex}` : undefined}
        className="beat-textarea"
        onChange={(event) => {
          setMenuDismissed(false);
          setMenuIndex(0);
          store.updateBeat(beat.id, { text: event.target.value }, `text:${beat.id}`);
        }}
        onKeyDown={handleKey}
        onBlur={() => {
          isTabReleased.current = false;
        }}
      />

      {isMenuOpen && (
        <ul id={menuId} role="listbox" aria-label="Beat type" className="editor-menu">
          {matches?.map((type, index) => (
            <li
              key={type}
              id={`${menuId}-${index}`}
              role="option"
              aria-selected={index === menuIndex}
              data-beat={type}
              className="editor-menu-item"
              onMouseDown={(event) => {
                event.preventDefault();
                chooseType(type);
              }}
            >
              <span className="editor-menu-dot" />
              {BEAT_LABELS[type]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
