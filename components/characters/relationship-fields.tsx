"use client";

import type { RelationshipInput } from "@/lib/characters/validate";

export type Choice = { id: string; name: string };

export function RelationshipFields({
  rows,
  choices,
  onChange,
}: {
  rows: RelationshipInput[];
  choices: Choice[];
  onChange: (rows: RelationshipInput[]) => void;
}) {
  const update = (index: number, patch: Partial<RelationshipInput>) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  return (
    <fieldset>
      <legend className="eyebrow text-muted">Relationships</legend>
      <ul className="mt-2 grid gap-2">
        {rows.map((row, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <select
              value={row.relatedId}
              aria-label={`Character for relationship ${index + 1}`}
              className="field min-w-0 flex-1 text-sm"
              onChange={(event) => update(index, { relatedId: event.target.value })}
            >
              {choices.map(({ id, name }) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <input
              value={row.note ?? ""}
              placeholder="Rival, Mentor…"
              aria-label={`Note for relationship ${index + 1}`}
              className="field min-w-0 flex-1 text-sm"
              onChange={(event) => update(index, { note: event.target.value })}
            />
            <button
              type="button"
              className="btn-ghost text-sm"
              aria-label={`Remove relationship ${index + 1}`}
              onClick={() => onChange(rows.filter((_, at) => at !== index))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn-ghost mt-2 text-sm"
        disabled={choices.length === 0}
        onClick={() => onChange([...rows, { relatedId: choices[0].id, note: null }])}
      >
        Add a relationship
      </button>
    </fieldset>
  );
}
