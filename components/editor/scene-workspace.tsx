"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LocationChips } from "@/components/library/location-chips";
import { ScriptBeat } from "@/components/script/script-beat";
import { castLookups } from "@/lib/characters/lookup";
import { fetchScene, sendScene } from "@/lib/editor/api";
import { createSaveQueue, type SaveQueue } from "@/lib/editor/save-queue";
import { createEditorStore, type EditorStore } from "@/lib/editor/store";
import { SCENE_KIND_LABELS, sceneTitle, type SceneKind } from "@/lib/format";
import type { SceneFields } from "@/lib/scenes/validate";
import { ConflictDialog } from "./conflict-dialog";
import { useDoc, type CastMember } from "./editor-context";
import { HistoryDrawer } from "./history-drawer";
import { PresenceChip } from "./presence-chip";
import { SaveIndicator, useSaveStatus } from "./save-indicator";
import { useLeaveGuard } from "./use-leave-guard";

// Loaded on first use, so reading a scene costs none of the editor's weight.
const SceneEditor = dynamic(() => import("./scene-editor").then(({ SceneEditor }) => SceneEditor), {
  ssr: false,
  loading: () => <p className="text-center text-muted">Opening the editor…</p>,
});

function createSession(sceneId: string, fields: SceneFields, version: number) {
  const store = createEditorStore(fields);
  const queue = createSaveQueue({
    getDoc: store.getDoc,
    version,
    send: (doc, sent) => sendScene(sceneId, doc, sent),
  });
  store.onChange(queue.change);
  return { store, queue };
}

// Subscribes on its own, so typing in the editor never re-renders this file.
function ReadView({
  store,
  kind,
  characterColors,
  characterLinks,
}: {
  store: EditorStore;
  kind: SceneKind;
  characterColors: Map<string, string | null>;
  characterLinks: Map<string, string>;
}) {
  const doc = useDoc(store);

  return (
    <>
      <header className="mb-10 text-center">
        {doc.title && <p className="eyebrow font-sans text-primary-strong">{SCENE_KIND_LABELS[kind]}</p>}
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{sceneTitle({ kind, title: doc.title })}</h1>
        {doc.timecode && <p className="mt-3 font-bold">({doc.timecode})</p>}
        <LocationChips location={doc.location} className="mt-3 justify-center" />
      </header>

      {doc.beats.length === 0 ? (
        <p className="text-center text-muted">This scene is empty.</p>
      ) : (
        doc.beats.map((beat) => (
          <ScriptBeat key={beat.id} beat={beat} characterColors={characterColors} characterLinks={characterLinks} />
        ))
      )}
    </>
  );
}

function ConflictGate(props: { sceneId: string; store: EditorStore; queue: SaveQueue }) {
  const status = useSaveStatus(props.queue);
  return status === "conflict" ? <ConflictDialog {...props} /> : null;
}

export function SceneWorkspace({
  sceneId,
  kind,
  version,
  fields,
  cast,
}: {
  sceneId: string;
  kind: SceneKind;
  version: number;
  fields: SceneFields;
  cast: CastMember[];
}) {
  const router = useRouter();
  const [{ store, queue }] = useState(() => createSession(sceneId, fields, version));
  const [isEditing, setEditing] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const { colors: characterColors, links: characterLinks } = useMemo(() => castLookups(cast), [cast]);

  useLeaveGuard(queue);

  // The page may be a cached or hidden copy, so check before trusting its version.
  const catchUp = useCallback(async () => {
    const latest = await fetchScene(sceneId).catch(() => null);
    if (!latest || latest === "deleted" || queue.isDirty() || latest.version <= queue.getVersion()) return;

    const { version: newest, title, timecode, location, beats } = latest;
    store.replace({ title, timecode, location, beats });
    queue.adopt(newest);
  }, [sceneId, store, queue]);

  useEffect(() => {
    void catchUp();

    const handleOnline = () => queue.retry();
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      void queue.flush();
    };
  }, [catchUp, queue]);

  const startEditing = () => {
    setEditing(true);
    void catchUp();
  };

  const stopEditing = async () => {
    setEditing(false);
    await queue.flush();
    router.refresh();
  };

  return (
    <>
      <div className="editor-toolbar">
        <div className="editor-mode" role="group" aria-label="View">
          <button type="button" aria-pressed={!isEditing} onClick={stopEditing}>
            Read
          </button>
          <button type="button" aria-pressed={isEditing} onClick={startEditing}>
            Edit
          </button>
        </div>

        {isEditing && (
          <div className="flex flex-wrap items-center gap-3">
            <PresenceChip sceneId={sceneId} />
            <SaveIndicator queue={queue} />
            <button type="button" className="btn-ghost text-sm" onClick={() => setHistoryOpen(true)}>
              History
            </button>
          </div>
        )}
      </div>

      <article
        data-kind={kind}
        className={`script-page rise mx-auto max-w-3xl font-script text-[17px] leading-relaxed ${
          isEditing ? "px-4 py-6 sm:px-8 sm:py-8" : "px-5 py-10 sm:px-20 sm:py-16"
        }`}
      >
        {isEditing ? (
          <SceneEditor store={store} kind={kind} cast={cast} />
        ) : (
          <ReadView store={store} kind={kind} characterColors={characterColors} characterLinks={characterLinks} />
        )}
      </article>

      <ConflictGate sceneId={sceneId} store={store} queue={queue} />
      {isHistoryOpen && (
        <HistoryDrawer
          sceneId={sceneId}
          store={store}
          queue={queue}
          characterColors={characterColors}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}
