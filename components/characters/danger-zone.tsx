"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCard, mergeCard } from "@/lib/characters/client";
import { plural } from "@/lib/format";
import type { Choice } from "./relationship-fields";

export function DangerZone({
  id,
  name,
  version,
  lines,
  choices,
}: {
  id: string;
  name: string;
  version: number;
  lines: number;
  choices: Choice[];
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string>) => {
    setError(null);
    try {
      router.push(await action());
      router.refresh();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That did not work");
    }
  };

  const merge = () => {
    const target = choices.find((choice) => choice.id === targetId);
    if (!target) return;
    if (!window.confirm(`Merge ${name} into ${target.name}? ${name} becomes an alias, and this card goes away.`)) return;

    void run(async () => `/characters/${(await mergeCard(id, targetId, version)).slug}`);
  };

  const remove = () => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;

    void run(async () => {
      await deleteCard(id);
      return "/characters";
    });
  };

  return (
    <section aria-labelledby="danger-title" className="glass p-5">
      <h2 id="danger-title" className="text-lg font-semibold">
        Merge or delete
      </h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="eyebrow text-muted">Merge into…</span>
          <select value={targetId} className="field mt-1 w-full text-sm" onChange={(event) => setTargetId(event.target.value)}>
            <option value="">Choose a character</option>
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-ghost text-sm" disabled={!targetId} onClick={merge}>
          Merge
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Appearances, images and relationships move across. Any text on this card goes into the other
        card&apos;s notes.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost text-sm" disabled={lines > 0} onClick={remove}>
          Delete character
        </button>
        {lines > 0 && (
          <span className="text-xs text-muted">Has {plural(lines, "line")} in scenes, so it can only be merged.</span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-status-idea">
          {error}
        </p>
      )}
    </section>
  );
}
