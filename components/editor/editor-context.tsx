"use client";

import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CastMember } from "@/lib/characters/lookup";
import type { EditorStore, HeaderField } from "@/lib/editor/store";

export type { CastMember };

export type Toast = { message: string; onUndo?: () => void };

type FieldElements = { text?: HTMLTextAreaElement | null; speaker?: HTMLInputElement | null };

type EditorContextValue = {
  store: EditorStore;
  cast: CastMember[];
  castByName: Map<string, CastMember>;
  fields: Map<string, FieldElements>;
  showToast: (toast: Toast) => void;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  store,
  cast,
  showToast,
  children,
}: {
  store: EditorStore;
  cast: CastMember[];
  showToast: (toast: Toast) => void;
  children: ReactNode;
}) {
  const [fields] = useState(() => new Map<string, FieldElements>());
  const value = useMemo(
    () => ({
      store,
      cast,
      castByName: new Map(
        cast.flatMap((member) => [member.name.toUpperCase(), ...member.aliases].map((key) => [key, member] as const)),
      ),
      fields,
      showToast,
    }),
    [store, cast, fields, showToast],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor needs an EditorProvider");
  return value;
}

export function useBeat(id: string) {
  const { store } = useEditor();
  return useSyncExternalStore(store.subscribe, () => store.getBeat(id), () => store.getBeat(id));
}

export function useOrder() {
  const { store } = useEditor();
  return useSyncExternalStore(store.subscribe, store.getOrder, store.getOrder);
}

export function useDoc(store: EditorStore) {
  return useSyncExternalStore(store.subscribe, store.getDoc, store.getDoc);
}

/** One header field, so typing in the script leaves the header alone. */
export function useHeaderValue(store: EditorStore, field: HeaderField) {
  const read = () => store.getDoc()[field];
  return useSyncExternalStore(store.subscribe, read, read);
}

export function useRegisterField(id: string, kind: keyof FieldElements) {
  const { fields } = useEditor();

  return useMemo(
    () => (element: HTMLTextAreaElement | HTMLInputElement | null) => {
      const entry = fields.get(id) ?? {};
      fields.set(id, { ...entry, [kind]: element });
    },
    [fields, id, kind],
  );
}

export function useFocusField() {
  const { fields } = useEditor();

  return useMemo(
    () => ({
      text(id: string, caret: "start" | "end" = "end") {
        const element = fields.get(id)?.text;
        if (!element) return;
        element.focus();
        const position = caret === "start" ? 0 : element.value.length;
        element.setSelectionRange(position, position);
      },
      /** A prompt offers the carried-over speaker: typing a name replaces it. */
      speaker(id: string, { prompt = false } = {}) {
        const element = fields.get(id)?.speaker;
        if (!element) return;
        if (prompt) element.dataset.prompt = "true";
        element.focus();
      },
    }),
    [fields],
  );
}
