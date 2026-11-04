"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useModal } from "@/components/ui/use-modal";
import { sceneTitle } from "@/lib/format";
import type { Outline } from "@/lib/reader/read";
import { LINE_SPACINGS, settingsStore, TEXT_SIZES, type ReaderSettings } from "@/lib/reader/settings";

function ChoiceRow<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="eyebrow text-muted">{legend}</legend>
      <div className="rd-choices mt-1">
        {options.map((option) => (
          <label key={option.value} className="rd-choice">
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsDialog({ settings, onClose }: { settings: ReaderSettings; onClose: () => void }) {
  const dialog = useModal();

  return (
    <dialog ref={dialog} aria-labelledby="reader-settings-title" className="editor-dialog" onClose={onClose}>
      <h2 id="reader-settings-title" className="text-xl font-semibold">
        Reader settings
      </h2>
      <p className="mt-1 text-sm text-muted">Saved in this browser.</p>

      <div className="mt-4 grid gap-4">
        <ChoiceRow legend="Text size" name="size" options={TEXT_SIZES} value={settings.size} onChange={(size) => settingsStore.update({ size })} />
        <ChoiceRow
          legend="Line spacing"
          name="spacing"
          options={LINE_SPACINGS}
          value={settings.spacing}
          onChange={(spacing) => settingsStore.update({ spacing })}
        />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={settings.colors} onChange={(event) => settingsStore.update({ colors: event.target.checked })} />
          Character colors
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={settings.timecodes} onChange={(event) => settingsStore.update({ timecodes: event.target.checked })} />
          Show timecodes
        </label>
      </div>

      <div className="mt-5">
        <button type="button" className="btn-primary text-sm" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}

const KEYS = "J or → next scene · K or ← previous scene · ] next episode · [ previous episode";

export function ContentsDrawer({
  seasonId,
  outline,
  pageEpisodeId,
  activeEpisodeId,
  onJump,
  onClose,
}: {
  seasonId: string;
  outline: Outline;
  /** The one episode on this page, or null when the whole season is. */
  pageEpisodeId: string | null;
  activeEpisodeId: string | null;
  onJump: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useModal();
  const isOnPage = (episodeId: string) => pageEpisodeId === null || pageEpisodeId === episodeId;

  // On this page it scrolls; a plain hash link could land on a hidden route's copy.
  const jump = (id: string, onPage: boolean) => (event: MouseEvent) => {
    if (onPage) {
      event.preventDefault();
      onJump(id);
    } else {
      onClose();
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="reader-contents-title" className="history-drawer" onClose={onClose}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="reader-contents-title" className="text-xl font-semibold">
          Contents
        </h2>
        <button type="button" className="btn-ghost text-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">{KEYS}</p>

      <nav aria-label="Episodes and scenes" className="mt-4">
        <Link href={`/read/${seasonId}`} className="rd-toc-season" onClick={onClose}>
          Read the whole season
        </Link>
        <ol className="grid gap-3">
          {outline.map((episode) => {
            const episodeHref = `/read/${seasonId}/${episode.id}`;
            const onPage = isOnPage(episode.id);

            return (
              <li key={episode.id}>
                <Link
                  href={onPage ? `#episode-${episode.id}` : episodeHref}
                  aria-current={episode.id === activeEpisodeId ? "true" : undefined}
                  className="rd-toc-episode"
                  onClick={jump(`episode-${episode.id}`, onPage)}
                >
                  Episode {episode.number}: {episode.title}
                </Link>
                <ol className="mt-1 grid gap-0.5">
                  {episode.scenes.map((scene) => (
                    <li key={scene.id}>
                      <Link
                        href={onPage ? `#scene-${scene.id}` : `${episodeHref}#scene-${scene.id}`}
                        className="rd-toc-scene"
                        onClick={jump(`scene-${scene.id}`, onPage)}
                      >
                        {sceneTitle(scene)}
                      </Link>
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ol>
      </nav>
    </dialog>
  );
}
