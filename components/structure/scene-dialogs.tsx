"use client";

import { useState } from "react";
import { useModal } from "@/components/ui/use-modal";
import { SCENE_KIND_LABELS, type SceneKind } from "@/lib/format";
import { FormDialog, TextField, type Submit } from "./form-dialog";

const KINDS: { value: SceneKind; label: string }[] = [
  { value: "prologue", label: "Prologue" },
  { value: "scene", label: "Scene" },
  { value: "outro", label: "Outro" },
  { value: "post_credit", label: "Post-credit" },
];

export type SceneForm = { title: string | null; kind: SceneKind };

function KindField({ value }: { value: SceneKind }) {
  return (
    <fieldset>
      <legend className="eyebrow text-muted">Kind</legend>
      <div className="kind-options mt-1">
        {KINDS.map(({ value: kind, label }) => (
          <label key={kind} data-kind={kind} className="kind-option">
            <input type="radio" name="kind" value={kind} defaultChecked={kind === value} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const readForm = (data: FormData): SceneForm => ({
  title: String(data.get("title") ?? "").trim() || null,
  kind: data.get("kind") as SceneKind,
});

export function AddSceneDialog({
  onSave,
  onClose,
}: {
  onSave: (form: SceneForm) => Promise<string | null>;
  onClose: () => void;
}) {
  const submit: Submit = (data) => onSave(readForm(data));

  return (
    <FormDialog title="Add a scene" submitLabel="Add scene" busyLabel="Adding…" onSubmit={submit} onClose={onClose}>
      <KindField value="scene" />
      <TextField label="Title (optional)" name="title" autoFocus />
    </FormDialog>
  );
}

export function SceneDetailsDialog({
  scene,
  onSave,
  onClose,
}: {
  scene: SceneForm;
  onSave: (form: SceneForm) => Promise<string | null>;
  onClose: () => void;
}) {
  const submit: Submit = (data) => onSave(readForm(data));

  return (
    <FormDialog title="Rename or change kind" submitLabel="Save" onSubmit={submit} onClose={onClose}>
      <TextField
        label="Title"
        name="title"
        autoFocus
        defaultValue={scene.title}
        placeholder={SCENE_KIND_LABELS[scene.kind]}
      />
      <KindField value={scene.kind} />
    </FormDialog>
  );
}

export function MoveSceneDialog({
  title,
  episodes,
  onMove,
  onClose,
}: {
  title: string;
  episodes: { id: string; number: number; title: string }[];
  onMove: (episodeId: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useModal();
  const [isMoving, setMoving] = useState(false);

  const move = async (id: string) => {
    setMoving(true);
    await onMove(id);
    onClose();
  };

  return (
    <dialog ref={dialog} aria-labelledby="move-title" className="editor-dialog" onClose={onClose}>
      <h2 id="move-title" className="text-xl font-semibold">
        Move to…
      </h2>
      <p className="mt-1 truncate text-sm text-muted">{title} goes to the end of the episode you pick.</p>

      {episodes.length === 0 ? (
        <p className="mt-4 text-sm text-muted">This season has no other episodes.</p>
      ) : (
        <ul className="deleted-list mt-3">
          {episodes.map((episode) => (
            <li key={episode.id}>
              <button type="button" className="move-option" disabled={isMoving} onClick={() => void move(episode.id)}>
                <span className="shrink-0 font-semibold">Episode {episode.number}</span>
                <span className="min-w-0 truncate text-muted">{episode.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
