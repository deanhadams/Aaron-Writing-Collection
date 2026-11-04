"use client";

import { verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { SceneCard, type SceneCardData } from "@/components/library/scene-card";
import { EmptyState } from "@/components/ui/empty-state";
import { sceneTitle } from "@/lib/format";
import type { getEpisode } from "@/lib/queries/library";
import {
  bringBackScene,
  copyScene,
  newScene,
  patchScene,
  relocateScene,
  removeScene,
  sendSceneOrder,
} from "@/lib/structure/client";
import { moveItem } from "@/lib/structure/order";
import { ActionMenu, MenuItem } from "./action-menu";
import { DeleteDialog } from "./episode-dialogs";
import { AddSceneDialog, MoveSceneDialog, SceneDetailsDialog, type SceneForm } from "./scene-dialogs";
import { InsertLine, ReorderTools, SortableBoard, useSortableRow } from "./sortable";
import { useBoard } from "./use-board";
import { useFeedback } from "./use-feedback";

type Episode = NonNullable<Awaited<ReturnType<typeof getEpisode>>>;

type Dialog =
  | { type: "add"; afterId: string | null }
  | { type: "details" | "move" | "delete"; scene: SceneCardData };

function SceneTile({
  scene,
  number,
  index,
  count,
  onMove,
  onDuplicate,
  onOpen,
}: {
  scene: SceneCardData;
  number: number | null;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onDuplicate: (scene: SceneCardData) => void;
  onOpen: (dialog: Dialog) => void;
}) {
  const { setNodeRef, style, handle, isDragging } = useSortableRow(scene.id);
  const label = sceneTitle(scene);

  return (
    <li ref={setNodeRef} style={style} data-dragging={isDragging || undefined} data-kind={scene.kind} className="sort-row relative">
      <div className="rise" style={{ "--i": index } as CSSProperties}>
        <SceneCard
          scene={scene}
          number={number}
          tools={
            <>
              <ReorderTools label={label} handle={handle} index={index} count={count} onMove={onMove} />
              <ActionMenu label={`Options for ${label}`}>
                <MenuItem onSelect={() => onOpen({ type: "details", scene })}>Rename or change kind</MenuItem>
                <MenuItem onSelect={() => onDuplicate(scene)}>Duplicate</MenuItem>
                <MenuItem onSelect={() => onOpen({ type: "move", scene })}>Move to…</MenuItem>
                <MenuItem danger onSelect={() => onOpen({ type: "delete", scene })}>
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

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <InsertLine>
      <button type="button" aria-label={label} onClick={onClick}>
        +
      </button>
    </InsertLine>
  );
}

export function SceneBoard({ episode }: { episode: Episode }) {
  const server = useMemo(() => ({ items: episode.scenes, version: episode.scenesVersion }), [episode]);
  const { board, items } = useBoard(server);
  const { report, showToast, feedback } = useFeedback();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);

  const ids = useMemo(() => items.map(({ id }) => id), [items]);
  const labels = useMemo(() => new Map(items.map((scene) => [scene.id, sceneTitle(scene)])), [items]);

  const reorder = async (order: string[]) => {
    const before = board.getItems().map(({ id }) => id);
    const outcome = await board.run({
      change: (list) => order.flatMap((id) => list.find((scene) => scene.id === id) ?? []),
      request: ({ version }) => sendSceneOrder(episode.id, { version, ids: order }),
      versionOf: ({ version }) => version,
    });
    return report(outcome, "episode") ? before : null;
  };

  const moveScene = async (from: number, to: number) => {
    const before = await reorder(moveItem(ids, from, to));
    if (before) showToast("Scene moved", () => void reorder(before));
  };

  const add = async ({ title, kind }: SceneForm, afterId: string | null) => {
    const outcome = await board.run({
      request: ({ version }) => newScene(episode.id, { version, afterId, kind, title }),
      versionOf: ({ version }) => version,
    });
    return report(outcome, "episode") ? null : "";
  };

  const duplicate = async (scene: SceneCardData) => {
    const outcome = await board.run({
      request: ({ version }) => copyScene(scene.id, version),
      versionOf: ({ version }) => version,
    });
    if (report(outcome, "episode")) showToast("Scene duplicated");
  };

  const saveDetails = async (scene: SceneCardData, { title, kind }: SceneForm) => {
    const outcome = await board.run({
      change: (list) => list.map((item) => (item.id === scene.id ? { ...item, title, kind } : item)),
      request: ({ item }) => patchScene(scene.id, { title, kind, version: item(scene.id)?.version ?? 0 }),
      settle: (list, { version }) => list.map((item) => (item.id === scene.id ? { ...item, version } : item)),
    });
    return report(outcome, "scene") ? null : "";
  };

  const restore = async (scene: SceneCardData, index: number) => {
    const outcome = await board.run({
      change: (list) => [...list.slice(0, index), scene, ...list.slice(index)],
      request: () => bringBackScene(scene.id, scene.version),
      versionOf: ({ scenesVersion }) => scenesVersion,
    });
    report(outcome, "scene");
  };

  const remove = async (scene: SceneCardData) => {
    const index = board.getItems().findIndex(({ id }) => id === scene.id);
    const outcome = await board.run({
      change: (list) => list.filter(({ id }) => id !== scene.id),
      request: ({ item }) => removeScene(scene.id, item(scene.id)?.version ?? 0),
      versionOf: ({ scenesVersion }) => scenesVersion,
    });
    if (report(outcome, "scene")) showToast(`${sceneTitle(scene)} deleted`, () => void restore(scene, index));
  };

  const relocate = async (scene: SceneCardData, targetId: string) => {
    const outcome = await board.run({
      change: (list) => list.filter(({ id }) => id !== scene.id),
      request: ({ version }) => relocateScene(scene.id, targetId, version),
      versionOf: ({ version }) => version,
    });
    if (report(outcome, "episode")) showToast(`Moved to Episode ${outcome.data.targetNumber}`);
  };

  // Prologues and outros are not numbered scenes in the script.
  let sceneNumber = 0;
  const numbers = items.map(({ kind }) => (kind === "scene" ? ++sceneNumber : null));

  return (
    <>
      {items.length === 0 ? (
        <EmptyState title="No scenes yet">
          <button type="button" className="btn-primary mt-2 text-sm" onClick={() => setDialog({ type: "add", afterId: null })}>
            Add a scene
          </button>
        </EmptyState>
      ) : (
        <SortableBoard
          id="scene-board"
          items={ids}
          strategy={verticalListSortingStrategy}
          labelFor={(id) => labels.get(id) ?? "Scene"}
          onMove={(from, to) => void moveScene(from, to)}
        >
          <ol className="timeline">
            <AddButton label="Add a scene at the top" onClick={() => setDialog({ type: "add", afterId: null })} />
            {items.map((scene, index) => (
              <Fragment key={scene.id}>
                <SceneTile
                  scene={scene}
                  number={numbers[index]}
                  index={index}
                  count={items.length}
                  onMove={(from, to) => void moveScene(from, to)}
                  onDuplicate={(target) => void duplicate(target)}
                  onOpen={setDialog}
                />
                <AddButton
                  label={`Add a scene after ${sceneTitle(scene)}`}
                  onClick={() => setDialog({ type: "add", afterId: scene.id })}
                />
              </Fragment>
            ))}
          </ol>
        </SortableBoard>
      )}

      {dialog?.type === "add" && (
        <AddSceneDialog onClose={close} onSave={(form) => add(form, dialog.afterId)} />
      )}

      {dialog?.type === "details" && (
        <SceneDetailsDialog scene={dialog.scene} onClose={close} onSave={(form) => saveDetails(dialog.scene, form)} />
      )}

      {dialog?.type === "move" && (
        <MoveSceneDialog
          title={sceneTitle(dialog.scene)}
          episodes={episode.otherEpisodes}
          onClose={close}
          onMove={(targetId) => relocate(dialog.scene, targetId)}
        />
      )}

      {dialog?.type === "delete" && (
        <DeleteDialog
          title={`Delete ${sceneTitle(dialog.scene)}?`}
          onClose={close}
          onConfirm={async () => {
            void remove(dialog.scene);
            return null;
          }}
        >
          <p>You can restore it from Recently deleted, in the season menu, for 30 days.</p>
        </DeleteDialog>
      )}

      {feedback}
    </>
  );
}
