"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useModal } from "@/components/ui/use-modal";
import { sceneTitle } from "@/lib/format";
import {
  addRecent,
  clearRecent,
  fetchSearch,
  loadRecent,
  quickActions,
  sceneHref,
  type SearchResponse,
} from "@/lib/search/client";
import { BookIcon, FilmIcon, LayersIcon, SearchIcon, UserIcon } from "./icons";
import { Highlighted } from "./highlighted";

const DEBOUNCE_MS = 120;

type Item = { id: string; group: string; href: string; icon: ReactNode; label: ReactNode; detail?: ReactNode; recent?: string };

function resultItems(data: SearchResponse | null): Item[] {
  if (!data) return [];

  return [
    ...data.scenes.results.map((scene): Item => ({
      id: `scene-${scene.id}`,
      group: "Scenes",
      href: sceneHref({ ...scene, beatId: scene.snippet?.beatId }),
      icon: <LayersIcon className="size-4" />,
      label: scene.snippet ? (
        <span className="palette-script">
          {scene.snippet.speaker && <strong>{scene.snippet.speaker}: </strong>}
          <Highlighted segments={scene.snippet.segments} />
        </span>
      ) : (
        sceneTitle(scene)
      ),
      detail: `Episode ${scene.episodeNumber} · ${sceneTitle(scene)}`,
    })),
    ...data.episodes.results.map((episode): Item => ({
      id: `episode-${episode.id}`,
      group: "Episodes",
      href: `/episodes/${episode.id}`,
      icon: <FilmIcon className="size-4" />,
      label: <Highlighted segments={episode.segments} />,
      detail: `Episode ${episode.number}`,
    })),
    ...data.characters.results.map((character): Item => ({
      id: `character-${character.id}`,
      group: "Characters",
      href: `/characters/${character.slug}`,
      icon: <UserIcon className="size-4" />,
      label: <Highlighted segments={character.segments} />,
      detail: character.fullName ?? character.role ?? undefined,
    })),
    ...data.lore.results.map((entry): Item => ({
      id: `lore-${entry.id}`,
      group: "Lore",
      href: `/lore/${entry.slug}`,
      icon: <BookIcon className="size-4" />,
      label: <Highlighted segments={entry.segments} />,
      detail: entry.category ?? undefined,
    })),
  ];
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const dialog = useModal();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ query: string; response: SearchResponse | null } | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const [active, setActive] = useState(0);
  const text = query.trim();

  useEffect(() => {
    if (!text) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSearch(text, controller.signal)
        .then((response) => {
          setData({ query: text, response });
          setActive(0);
        })
        .catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  const results = text && data?.query === text ? data.response : null;

  const items = useMemo<Item[]>(() => {
    const actions = quickActions(text).map(
      ({ id, label, href }): Item => ({ id: `action-${id}`, group: "Quick actions", href, icon: <SearchIcon className="size-4" />, label }),
    );
    const jump: Item[] = results?.jump
      ? [
          {
            id: "jump",
            group: "Quick actions",
            href: `/episodes/${results.jump.id}`,
            icon: <FilmIcon className="size-4" />,
            label: `Go to episode ${results.jump.number}`,
            detail: results.jump.title,
          },
        ]
      : [];
    const history: Item[] = text
      ? []
      : recent.map((item) => ({
          id: `recent-${item}`,
          group: "Recent searches",
          href: `/search?q=${encodeURIComponent(item)}`,
          icon: <SearchIcon className="size-4" />,
          label: item,
          recent: item,
        }));
    const all: Item[] = text
      ? [
          {
            id: "all",
            group: "All results",
            href: `/search?q=${encodeURIComponent(text)}`,
            icon: <SearchIcon className="size-4" />,
            label: `See all results for “${text}”`,
          },
        ]
      : [];

    return [...jump, ...resultItems(results), ...actions, ...history, ...all];
  }, [text, results, recent]);

  const open = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      if (text) addRecent(text);
      router.push(item.href);
      onClose();
    },
    [text, router, onClose],
  );

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") setActive((index) => (index + 1) % items.length);
    else if (event.key === "ArrowUp") setActive((index) => (index - 1 + items.length) % items.length);
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(items.length - 1);
    else if (event.key === "Enter") open(items[active]);
    else return;
    event.preventDefault();
  };

  const optionId = (index: number) => `${listId}-${index}`;
  const groups = [...new Set(items.map(({ group }) => group))];
  const count = resultItems(results).length;

  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });

  return (
    <dialog ref={dialog} aria-label="Search everything" className="palette" onClose={onClose}>
      <div className="palette-input">
        <SearchIcon className="size-5 shrink-0 text-muted" />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={items.length > 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Search scenes, episodes, characters and lore"
          placeholder="Search scenes, characters, lore…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={handleKey}
        />
        <kbd>Esc</kbd>
      </div>

      <div id={listId} role="listbox" aria-label="Results" className="palette-list">
        {groups.map((group) => (
          <div key={group} role="group" aria-label={group}>
            <p aria-hidden className="eyebrow palette-group">
              {group}
              {group === "Recent searches" && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="palette-clear"
                  onClick={() => {
                    clearRecent();
                    setRecent([]);
                  }}
                >
                  Clear
                </button>
              )}
            </p>
            {items.map((item, index) =>
              item.group === group ? (
                <div
                  key={item.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className="palette-item"
                  onMouseMove={() => setActive(index)}
                  onClick={() => open(item)}
                >
                  <span className="palette-icon">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.detail && <span className="block truncate text-xs text-muted">{item.detail}</span>}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>

      <p role="status" className="sr-only">
        {text ? (results ? `${count} results` : "Searching") : ""}
      </p>
      {text && results && count === 0 && !results.jump && (
        <p className="palette-empty">Nothing matches “{text}”. Check the spelling, or try fewer words.</p>
      )}
    </dialog>
  );
}

export function SearchPalette() {
  const [isOpen, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((open) => !open);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button ref={trigger} type="button" aria-label="Search" aria-keyshortcuts="Control+K Meta+K" className="search-button" onClick={() => setOpen(true)}>
        <SearchIcon className="size-4" />
        <span className="search-button-text">Search</span>
        <kbd className="search-button-text">Ctrl K</kbd>
      </button>
      {isOpen && (
        <PaletteDialog
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
