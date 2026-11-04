"use client";

import { countWords } from "@/lib/editor/store";
import type { EditorStore } from "@/lib/editor/store";
import { plural } from "@/lib/format";
import { summarizeBeats } from "@/lib/script/scene-summary";
import { useDoc } from "./editor-context";

export function EditorFooter({ store }: { store: EditorStore }) {
  const { beats } = useDoc(store);

  return (
    <footer className="editor-footer">
      <span>
        {plural(countWords(beats), "word")} · {plural(summarizeBeats(beats).lineCount, "line")}
      </span>
      <details className="editor-keys">
        <summary>Keyboard shortcuts</summary>
        <p id="editor-keys">
          Enter adds a beat, Shift+Enter adds a line break. Backspace on an empty beat deletes it.
          Tab and Shift+Tab change the type; press Escape first to Tab out of the field instead.
          Alt+Up and Alt+Down move a beat. Ctrl+Z undoes, Ctrl+Shift+Z redoes. Type / in an empty
          beat to pick a type.
        </p>
      </details>
    </footer>
  );
}
