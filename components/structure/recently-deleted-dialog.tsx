"use client";

import { useCallback, useEffect, useState } from "react";
import { useModal } from "@/components/ui/use-modal";
import { plural, sceneTitle } from "@/lib/format";
import { fetchDeleted, type DeletedList } from "@/lib/structure/client";
import { daysLeft } from "@/lib/structure/result";

type Loaded = { list: DeletedList; now: Date };

function Row({
  title,
  detail,
  deletedAt,
  deletedBy,
  now,
  onRestore,
}: {
  title: string;
  detail: string | null;
  deletedAt: string;
  deletedBy: string | null;
  now: Date;
  onRestore: () => void;
}) {
  const days = plural(daysLeft(new Date(deletedAt), now), "day");

  return (
    <li className="deleted-row">
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="block text-xs text-muted">
          {[detail, deletedBy && `Deleted by ${deletedBy}`, `${days} left`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <button type="button" className="btn-ghost shrink-0 text-sm" aria-label={`Restore ${title}`} onClick={onRestore}>
        Restore
      </button>
    </li>
  );
}

export function RecentlyDeletedDialog({
  seasonId,
  onRestoreEpisode,
  onRestoreScene,
  onClose,
}: {
  seasonId: string;
  onRestoreEpisode: (id: string, version: number) => Promise<void>;
  onRestoreScene: (id: string, version: number) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useModal();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchDeleted(seasonId);
    setFailed(!list);
    if (list) setLoaded({ list, now: new Date() });
  }, [seasonId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once the dialog opens
    void load();
  }, [load]);

  const restore = (work: Promise<void>) => void work.then(load);
  const isEmpty = loaded && loaded.list.episodes.length === 0 && loaded.list.scenes.length === 0;

  return (
    <dialog ref={dialog} aria-labelledby="deleted-title" className="editor-dialog" onClose={onClose}>
      <h2 id="deleted-title" className="text-xl font-semibold">
        Recently deleted
      </h2>
      <p className="mt-1 text-sm text-muted">Episodes and scenes stay here for 30 days.</p>

      <div aria-live="polite" className="deleted-list mt-4">
        {failed && <p className="text-sm font-medium text-status-idea">Could not load the list. Close this and try again.</p>}
        {!loaded && !failed && <p className="text-sm text-muted">Loading…</p>}
        {isEmpty && <p className="text-sm text-muted">Nothing here.</p>}

        {loaded && loaded.list.episodes.length > 0 && (
          <section aria-label="Deleted episodes">
            <h3 className="eyebrow text-muted">Episodes</h3>
            <ul className="mt-1">
              {loaded.list.episodes.map((episode) => (
                <Row
                  key={episode.id}
                  title={`Episode ${episode.number}: ${episode.title}`}
                  detail={plural(episode.sceneCount, "scene")}
                  deletedAt={episode.deletedAt}
                  deletedBy={episode.deletedBy}
                  now={loaded.now}
                  onRestore={() => restore(onRestoreEpisode(episode.id, episode.version))}
                />
              ))}
            </ul>
          </section>
        )}

        {loaded && loaded.list.scenes.length > 0 && (
          <section aria-label="Deleted scenes" className="mt-4">
            <h3 className="eyebrow text-muted">Scenes</h3>
            <ul className="mt-1">
              {loaded.list.scenes.map((scene) => (
                <Row
                  key={scene.id}
                  title={sceneTitle(scene)}
                  detail={`Episode ${scene.episodeNumber}`}
                  deletedAt={scene.deletedAt}
                  deletedBy={scene.deletedBy}
                  now={loaded.now}
                  onRestore={() => restore(onRestoreScene(scene.id, scene.version))}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="mt-5">
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
