"use client";

import { LocationChips } from "@/components/library/location-chips";
import { SCENE_KIND_LABELS, type SceneKind } from "@/lib/format";
import type { EditorStore, HeaderField } from "@/lib/editor/store";
import { useHeaderValue } from "./editor-context";

function HeaderInput({
  store,
  field,
  label,
  placeholder,
  className = "",
}: {
  store: EditorStore;
  field: HeaderField;
  label: string;
  placeholder: string;
  className?: string;
}) {
  const value = useHeaderValue(store, field);

  return (
    <label className="block">
      <span className="eyebrow font-sans text-muted">{label}</span>
      <input
        value={value ?? ""}
        placeholder={placeholder}
        className={`field mt-1 w-full ${className}`}
        onChange={(event) => store.setHeader(field, event.target.value)}
      />
    </label>
  );
}

export function SceneHeaderFields({ store, kind }: { store: EditorStore; kind: SceneKind }) {
  const location = useHeaderValue(store, "location");

  return (
    <header className="mb-8 grid gap-3">
      <HeaderInput
        store={store}
        field="title"
        label={`${SCENE_KIND_LABELS[kind]} title`}
        placeholder={SCENE_KIND_LABELS[kind]}
        className="font-sans text-xl font-bold"
      />
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <HeaderInput store={store} field="timecode" label="Timecode" placeholder="0:00 - 2:00" />
        <HeaderInput store={store} field="location" label="Location" placeholder="CLASSROOM - DAY" />
      </div>
      <LocationChips location={location} />
    </header>
  );
}
