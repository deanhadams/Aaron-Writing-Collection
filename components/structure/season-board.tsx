"use client";

import { rectSortingStrategy } from "@dnd-kit/sortable";
import { useMemo, useState, type CSSProperties } from "react";
import { EpisodeCard } from "@/components/library/episode-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { getSeason } from "@/lib/queries/library";
import {
  bringBackEpisode,
  bringBackScene,
  newEpisode,
  patchEpisode,
  removeEpisode,
  saveSeason,
  sendEpisodeOrder,
} from "@/lib/structure/client";
import type { EpisodePatch } from "@/lib/structure/episode";
import { moveItem, nextNumber, renumber, type Status } from "@/lib/structure/order";
import { DownIcon, CheckCircleIcon, PencilIcon, TrashIcon, UpIcon } from "./icons";
import { ActionMenu, MenuDivider, MenuItem } from "./action-menu";
import {
  DeleteDialog,
  EpisodeDeleteText,
  EpisodeSettingsDialog,
  NewEpisodeDialog,
  SeasonSettingsDialog,
} from "./episode-dialogs";
import { RecentlyDeletedDialog } from "./recently-deleted-dialog";
import { SeasonOverview } from "./season-overview";
import { DragHandle, SortableBoard, useSortableRow } from "./sortable";
import { StatusSelect } from "./status-select";
import { useBoard } from "./use-board";
import { useFeedback } from "./use-feedback";

type Season = NonNullable<Awaited<ReturnType<typeof getSeason>>>;
type Episode = Season["episodes"][number];

type Dialog =
  | { type: "new" | "season" | "deleted" }
  | { type: "settings" | "delete"; episode: Episode };

function EpisodeTile({
  episode,
  index,
  count,
  now,
  onMove,
  onStatus,
  onOpen,
}: {
  episode: Episode;
  index: number;
  count: number;
  now: Date;
  onMove: (from: number, to: number) => void;
  onStatus: (id: string, status: Status) => void;
  onOpen: (dialog: Dialog) => void;
}) {
  const { setNodeRef, style, handle, isDragging, isDropTarget } = useSortableRow(episode.id);
  const label = `Episode ${episode.number}`;

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      data-drop-target={isDropTarget || undefined}
      className="sort-row"
    >
      <div className="rise h-full" style={{ "--i": index } as CSSProperties}>
        <EpisodeCard
          episode={episode}
          now={now}
          statusControl={
            <StatusSelect status={episode.status} label={`Status of ${label}`} onChange={(status) => onStatus(episode.id, status)} />
          }
          toolbar={
            <>
              <DragHandle label={label} handle={handle} className="ep-tool ep-tool-handle" />
              <ActionMenu label={`Options for ${label}`} triggerClass="ep-tool" keepFocusOn={index}>
                <MenuItem icon={<PencilIcon />} onSelect={() => onOpen({ type: "settings", episode })}>
                  Rename and settings
                </MenuItem>
                {episode.status !== "done" && (
                  <MenuItem icon={<CheckCircleIcon />} onSelect={() => onStatus(episode.id, "done")}>
                    Mark done
                  </MenuItem>
                )}
                {index > 0 && (
                  <MenuItem icon={<UpIcon />} onSelect={() => onMove(index, index - 1)}>
                    Move up
                  </MenuItem>
                )}
                {index < count - 1 && (
                  <MenuItem icon={<DownIcon />} onSelect={() => onMove(index, index + 1)}>
                    Move down
                  </MenuItem>
                )}
                <MenuDivider />
                <MenuItem icon={<TrashIcon />} danger onSelect={() => onOpen({ type: "delete", episode })}>
                  Delete
                </MenuItem>
              </ActionMenu>
            </>
          }
        />
      </div>
    </li>
  );
}

export function SeasonBoard({ season, now }: { season: Season; now: Date }) {
  const server = useMemo(() => ({ items: season.episodes, version: season.version }), [season]);
  const { board, items } = useBoard(server);
  const { report, showToast, feedback } = useFeedback();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);

  const ids = useMemo(() => items.map(({ id }) => id), [items]);
  const labels = useMemo(() => new Map(items.map(({ id, number, title }) => [id, `Episode ${number}, ${title}`])), [items]);

  const reorder = async (order: string[]) => {
    const before = board.getItems().map(({ id }) => id);
    const outcome = await board.run({
      change: (list) => renumber(list, order),
      request: ({ version }) => sendEpisodeOrder(season.id, { version, ids: order }),
      versionOf: ({ version }) => version,
    });
    return report(outcome, "season") ? before : null;
  };

  const moveEpisode = async (from: number, to: number) => {
    const before = await reorder(moveItem(ids, from, to));
    if (before) showToast("Episodes renumbered", () => void reorder(before));
  };

  const patch = (id: string, fields: EpisodePatch) =>
    board.run({
      change: (list) => list.map((episode) => (episode.id === id ? { ...episode, ...fields } : episode)),
      request: ({ item }) => patchEpisode(id, { ...fields, version: item(id)?.version ?? 0 }),
      settle: (list, { version }) => list.map((episode) => (episode.id === id ? { ...episode, version } : episode)),
    });

  const setStatus = async (id: string, status: Status) => {
    report(await patch(id, { status }), "episode");
  };

  const restore = async (episode: Episode) => {
    const outcome = await board.run({
      change: (list) => [...list, episode].sort((a, b) => a.number - b.number),
      request: () => bringBackEpisode(episode.id, episode.version),
      versionOf: ({ seasonVersion }) => seasonVersion,
    });
    report(outcome, "episode");
  };

  const remove = async (episode: Episode) => {
    const outcome = await board.run({
      change: (list) => list.filter(({ id }) => id !== episode.id),
      request: ({ item }) => removeEpisode(episode.id, item(episode.id)?.version ?? 0),
      versionOf: ({ seasonVersion }) => seasonVersion,
    });
    if (report(outcome, "episode")) {
      showToast(`Episode ${episode.number} deleted`, () => void restore(episode));
    }
  };

  const restoreDeleted = async (id: string, version: number) => {
    const outcome = await board.run({
      request: () => bringBackEpisode(id, version),
      versionOf: ({ seasonVersion }) => seasonVersion,
    });
    if (!report(outcome, "episode")) return;

    const { number, renumbered } = outcome.data;
    showToast(renumbered ? `Restored as Episode ${number}, because its number was taken` : `Episode ${number} restored`);
  };

  const restoreDeletedScene = async (id: string, version: number) => {
    if (report(await bringBackScene(id, version), "scene")) showToast("Scene restored");
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <button type="button" className="btn-primary text-sm" onClick={() => setDialog({ type: "new" })}>
          New episode
        </button>
        <ActionMenu label="Season menu" text="Season menu">
          <MenuItem onSelect={() => setDialog({ type: "season" })}>Season settings</MenuItem>
          <MenuItem onSelect={() => setDialog({ type: "deleted" })}>Recently deleted</MenuItem>
        </ActionMenu>
      </div>

      {items.length > 0 && <SeasonOverview episodes={items} onMarkDone={(id) => void setStatus(id, "done")} />}

      {items.length === 0 ? (
        <EmptyState title="No episodes yet">Create the first one to get started.</EmptyState>
      ) : (
        <SortableBoard
          id="episode-board"
          items={ids}
          strategy={rectSortingStrategy}
          labelFor={(id) => labels.get(id) ?? "Episode"}
          onMove={(from, to) => void moveEpisode(from, to)}
        >
          <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((episode, index) => (
              <EpisodeTile
                key={episode.id}
                episode={episode}
                index={index}
                count={items.length}
                now={now}
                onMove={(from, to) => void moveEpisode(from, to)}
                onStatus={(id, status) => void setStatus(id, status)}
                onOpen={setDialog}
              />
            ))}
          </ol>
        </SortableBoard>
      )}

      {dialog?.type === "new" && (
        <NewEpisodeDialog
          number={nextNumber(items.map(({ number }) => number))}
          onClose={close}
          onSave={async ({ number, title }) => {
            const outcome = await board.run({
              request: ({ version }) => newEpisode(season.id, { version, number, title }),
              versionOf: ({ version }) => version,
            });
            if (outcome.kind === "failed") return outcome.message;
            return report(outcome, "season") ? null : "";
          }}
        />
      )}

      {dialog?.type === "season" && (
        <SeasonSettingsDialog
          number={season.number}
          season={season}
          onClose={close}
          onSave={async ({ title, summary }) => {
            const outcome = await board.run({
              request: ({ version }) => saveSeason(season.id, { version, title, summary }),
              versionOf: ({ version }) => version,
            });
            return report(outcome, "season") ? null : "";
          }}
        />
      )}

      {dialog?.type === "settings" && (
        <EpisodeSettingsDialog
          number={dialog.episode.number}
          episode={dialog.episode}
          onClose={close}
          onSave={async (settings) => (report(await patch(dialog.episode.id, settings), "episode") ? null : "")}
        />
      )}

      {dialog?.type === "delete" && (
        <DeleteDialog
          title={`Delete Episode ${dialog.episode.number}: ${dialog.episode.title}?`}
          onClose={close}
          onConfirm={async () => {
            void remove(dialog.episode);
            return null;
          }}
        >
          <EpisodeDeleteText sceneCount={dialog.episode.stats.sceneCount} />
        </DeleteDialog>
      )}

      {dialog?.type === "deleted" && (
        <RecentlyDeletedDialog
          seasonId={season.id}
          onClose={close}
          onRestoreEpisode={restoreDeleted}
          onRestoreScene={restoreDeletedScene}
        />
      )}

      {feedback}
    </>
  );
}
