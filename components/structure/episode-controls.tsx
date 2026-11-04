"use client";

import { useMemo, useState } from "react";
import type { getEpisode } from "@/lib/queries/library";
import { patchEpisode } from "@/lib/structure/client";
import type { EpisodePatch } from "@/lib/structure/episode";
import type { Status } from "@/lib/structure/order";
import { EpisodeSettingsDialog } from "./episode-dialogs";
import { StatusSelect } from "./status-select";
import { useBoard } from "./use-board";
import { useFeedback } from "./use-feedback";

type Episode = Pick<
  NonNullable<Awaited<ReturnType<typeof getEpisode>>>,
  "id" | "number" | "status" | "title" | "summary" | "openingTheme" | "outroTheme" | "version"
>;

/** A board of one, so the status and settings get the same queue and conflict handling. */
export function EpisodeControls({ episode }: { episode: Episode }) {
  const server = useMemo(() => ({ items: [episode], version: 1 }), [episode]);
  const { board, items } = useBoard(server);
  const { report, feedback } = useFeedback();
  const [isOpen, setOpen] = useState(false);
  const current = items[0];

  const patch = (fields: EpisodePatch) =>
    board.run({
      change: (list) => list.map((item) => ({ ...item, ...fields })),
      request: ({ item }) => patchEpisode(episode.id, { ...fields, version: item(episode.id)?.version ?? 0 }),
      settle: (list, { version }) => list.map((item) => ({ ...item, version })),
    });

  const setStatus = async (status: Status) => {
    report(await patch({ status }), "episode");
  };

  return (
    <>
      <StatusSelect status={current.status} label={`Status of Episode ${episode.number}`} onChange={(status) => void setStatus(status)} />
      <button type="button" className="btn-ghost text-sm" onClick={() => setOpen(true)}>
        Settings
      </button>

      {isOpen && (
        <EpisodeSettingsDialog
          number={episode.number}
          episode={current}
          onClose={() => setOpen(false)}
          onSave={async (settings) => (report(await patch(settings), "episode") ? null : "")}
        />
      )}

      {feedback}
    </>
  );
}
