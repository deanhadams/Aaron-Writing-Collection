"use client";

import { plural } from "@/lib/format";
import { FormDialog, TextArea, TextField, type Submit } from "./form-dialog";

const text = (data: FormData, name: string) => String(data.get(name) ?? "");

export type EpisodeForm = { number: number; title: string };

export function NewEpisodeDialog({
  number,
  onSave,
  onClose,
}: {
  number: number;
  onSave: (form: EpisodeForm) => Promise<string | null>;
  onClose: () => void;
}) {
  const submit: Submit = (data) => onSave({ number: Number(data.get("number")), title: text(data, "title") });

  return (
    <FormDialog title="New episode" submitLabel="Create episode" busyLabel="Creating…" onSubmit={submit} onClose={onClose}>
      <label className="block">
        <span className="eyebrow text-muted">Number</span>
        <input name="number" type="number" min={1} max={9999} required defaultValue={number} className="field w-full" />
      </label>
      <TextField label="Title" name="title" required autoFocus />
    </FormDialog>
  );
}

export type EpisodeSettings = {
  title: string;
  summary: string | null;
  openingTheme: string | null;
  outroTheme: string | null;
};

export function EpisodeSettingsDialog({
  number,
  episode,
  onSave,
  onClose,
}: {
  number: number;
  episode: EpisodeSettings;
  onSave: (settings: EpisodeSettings) => Promise<string | null>;
  onClose: () => void;
}) {
  const submit: Submit = (data) =>
    onSave({
      title: text(data, "title"),
      summary: text(data, "summary") || null,
      openingTheme: text(data, "openingTheme") || null,
      outroTheme: text(data, "outroTheme") || null,
    });

  return (
    <FormDialog title={`Episode ${number} settings`} submitLabel="Save settings" onSubmit={submit} onClose={onClose}>
      <TextField label="Title" name="title" required autoFocus defaultValue={episode.title} />
      <TextArea label="Summary" name="summary" defaultValue={episode.summary} />
      <TextField label="Opening theme (song title)" name="openingTheme" defaultValue={episode.openingTheme} />
      <TextField label="Outro theme (song title)" name="outroTheme" defaultValue={episode.outroTheme} />
    </FormDialog>
  );
}

export type SeasonSettings = { title: string | null; summary: string | null };

export function SeasonSettingsDialog({
  number,
  season,
  onSave,
  onClose,
}: {
  number: number;
  season: SeasonSettings;
  onSave: (settings: SeasonSettings) => Promise<string | null>;
  onClose: () => void;
}) {
  const submit: Submit = (data) => onSave({ title: text(data, "title") || null, summary: text(data, "summary") || null });

  return (
    <FormDialog title={`Season ${number} settings`} submitLabel="Save settings" onSubmit={submit} onClose={onClose}>
      <TextField label="Title (optional)" name="title" autoFocus defaultValue={season.title} />
      <TextArea label="Summary" name="summary" defaultValue={season.summary} />
    </FormDialog>
  );
}

export function DeleteDialog({
  title,
  children,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}) {
  return (
    <FormDialog title={title} submitLabel="Delete" busyLabel="Deleting…" danger onSubmit={onConfirm} onClose={onClose}>
      <div className="text-sm text-muted">{children}</div>
    </FormDialog>
  );
}

export function EpisodeDeleteText({ sceneCount }: { sceneCount: number }) {
  return (
    <>
      {sceneCount > 0 && (
        <p className="font-medium text-ink">
          This also removes its {plural(sceneCount, "scene")} from the season and the character pages.
        </p>
      )}
      <p className={sceneCount > 0 ? "mt-2" : undefined}>You can restore it from Recently deleted for 30 days.</p>
    </>
  );
}
