"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLeaveGuard } from "@/components/editor/use-leave-guard";
import { attachPortrait, saveCard } from "@/lib/characters/client";
import { isHexColor } from "@/lib/characters/colors";
import { ROLES, type CharacterFields } from "@/lib/characters/validate";
import { ColorPicker } from "./color-picker";
import { DangerZone } from "./danger-zone";
import { Portrait } from "./portrait";
import { RelationshipFields, type Choice } from "./relationship-fields";
import { UploadZone } from "./upload-zone";

const LONG_FIELDS = [
  ["appearance", "Appearance"],
  ["personality", "Personality"],
  ["backstory", "Backstory"],
  ["powers", "Powers / Gift"],
  ["notes", "Notes"],
] as const;

type Props = {
  id: string;
  slug: string;
  version: number;
  fields: CharacterFields;
  choices: Choice[];
  lines: number;
  portraitUrl: string | null;
  edited: string | null;
};

const parseAliases = (text: string) =>
  text.split(",").map((alias) => alias.trim()).filter(Boolean);

export function CharacterEditor({ id, slug, version: startVersion, fields: start, choices, lines, portraitUrl, edited }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState(start);
  const [saved, setSaved] = useState(start);
  const [version, setVersion] = useState(startVersion);
  const [aliasText, setAliasText] = useState(start.aliases.join(", "));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "conflict">("idle");
  const [error, setError] = useState<string | null>(null);

  const isDirty = JSON.stringify(fields) !== JSON.stringify(saved);
  const guard = useMemo(() => ({ isDirty: () => isDirty }), [isDirty]);
  useLeaveGuard(guard);

  const set = <K extends keyof CharacterFields>(field: K, value: CharacterFields[K]) => {
    setFields((current) => ({ ...current, [field]: value }));
    setState("idle");
  };

  const colorError = fields.color && !isHexColor(fields.color) ? "Use a hex color like #2563FF" : null;

  const save = async () => {
    if (colorError) return;

    setState("saving");
    setError(null);
    const result = await saveCard(id, version, fields);

    if (result.kind === "saved") {
      setVersion(result.version);
      setSaved(fields);
      setState("saved");
      router.refresh();
    } else if (result.kind === "conflict") {
      setState("conflict");
    } else {
      setState("idle");
      setError(result.message);
    }
  };

  return (
    <div className="grid gap-6">
      <section className="glass p-5">
        <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
          <Portrait name={fields.name} color={isHexColor(fields.color ?? "") ? fields.color : null} url={portraitUrl} className="aspect-[3/4] w-40 max-w-full rounded-xl" />
          <UploadZone
            characterId={id}
            kind="portrait"
            label="Upload a new portrait"
            onUploaded={async (key) => {
              await attachPortrait(id, key);
              router.refresh();
            }}
          />
        </div>
      </section>

      <section className="glass grid gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow text-muted">Name in scripts</span>
            <input value={fields.name} required className="field mt-1 w-full uppercase" onChange={(event) => set("name", event.target.value.toUpperCase())} />
          </label>
          <label className="block">
            <span className="eyebrow text-muted">Full name</span>
            <input value={fields.fullName ?? ""} className="field mt-1 w-full" onChange={(event) => set("fullName", event.target.value)} />
          </label>
          <label className="block">
            <span className="eyebrow text-muted">Role</span>
            <select
              value={fields.role ?? ""}
              className="field mt-1 w-full capitalize"
              onChange={(event) => set("role", (event.target.value || null) as CharacterFields["role"])}
            >
              <option value="">No role</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow text-muted">Gift (commas make separate chips)</span>
            <input value={fields.gift ?? ""} className="field mt-1 w-full" onChange={(event) => set("gift", event.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="eyebrow text-muted">Other names in scripts (separate with commas)</span>
          <input
            value={aliasText}
            className="field mt-1 w-full uppercase"
            onChange={(event) => {
              setAliasText(event.target.value);
              set("aliases", parseAliases(event.target.value.toUpperCase()));
            }}
          />
        </label>

        <ColorPicker value={fields.color ?? ""} onChange={(color) => set("color", color || null)} />
        {colorError && (
          <p role="alert" className="text-sm font-medium text-status-idea">
            {colorError}
          </p>
        )}
      </section>

      <section className="glass grid gap-4 p-5">
        {LONG_FIELDS.map(([field, label]) => (
          <label key={field} className="block">
            <span className="eyebrow text-muted">{label}</span>
            <textarea value={fields[field] ?? ""} rows={5} className="field mt-1 w-full" onChange={(event) => set(field, event.target.value)} />
          </label>
        ))}
        <RelationshipFields rows={fields.relationships} choices={choices} onChange={(rows) => set("relationships", rows)} />
      </section>

      <div className="char-save-bar">
        <button type="button" className="btn-primary text-sm" disabled={state === "saving" || state === "conflict"} onClick={save}>
          {state === "saving" ? "Saving…" : "Save"}
        </button>
        <Link href={`/characters/${slug}`} className="btn-ghost text-sm">
          Back to card
        </Link>
        <span role="status" className="text-sm text-muted">
          {state === "saved" ? "Saved" : isDirty ? "Unsaved changes" : edited}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-status-idea">
          {error}
        </p>
      )}

      {state === "conflict" && (
        <div role="alert" className="glass p-4">
          <p className="font-semibold">Someone else edited this card</p>
          <p className="mt-1 text-sm text-muted">
            Nothing was overwritten, and your changes are still in the fields. Copy anything you
            want to keep, then reload to see their version.
          </p>
          <button type="button" className="btn-ghost mt-2 text-sm" onClick={() => window.location.reload()}>
            Reload their version
          </button>
        </div>
      )}

      <DangerZone id={id} name={fields.name} version={version} lines={lines} choices={choices} />
    </div>
  );
}
