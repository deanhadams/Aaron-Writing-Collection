"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useBeatJump } from "@/components/script/use-beat-jump";
import { ActionMenu, MenuItem } from "@/components/structure/action-menu";
import { startDownload } from "@/lib/download";
import { currentIndex, readerKey, scrollProgress, stepIndex } from "@/lib/reader/navigation";
import type { Outline } from "@/lib/reader/read";
import { readerVariables, settingsStore } from "@/lib/reader/settings";
import { rememberView } from "@/lib/search/client";
import { ContentsDrawer, SettingsDialog } from "./reader-dialogs";

/** How far down the screen counts as "reading this". Jumps land at the 4rem scroll margin, just above it. */
const READING_LINE = 72;
const SAVE_DELAY_MS = 1500;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

function saveProgress(sceneId: string) {
  void fetch("/api/reader/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneId }),
    keepalive: true,
  }).catch(() => {});
}

function jumpTo(element: Element) {
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  element.scrollIntoView({ behavior, block: "start" });
}

function step(root: HTMLElement | null, selector: string, direction: 1 | -1) {
  const sections = [...(root?.querySelectorAll(selector) ?? [])];
  const index = stepIndex(sections.map((section) => section.getBoundingClientRect().top), READING_LINE, direction);
  if (index !== null) jumpTo(sections[index]);
  return index !== null;
}

export function ReaderShell({
  seasonId,
  backHref,
  outline,
  pageEpisodeId,
  wordHref,
  children,
}: {
  seasonId: string;
  backHref: string;
  outline: Outline;
  /** The one episode on this page, or null when the whole season is. */
  pageEpisodeId: string | null;
  wordHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.server);
  const bar = useRef<HTMLSpanElement>(null);
  // Hidden routes stay in the DOM, so everything here looks only inside this page.
  const root = useRef<HTMLDivElement>(null);
  const [scrolledEpisodeId, setScrolledEpisodeId] = useState(outline[0]?.id ?? null);
  const activeEpisodeId = pageEpisodeId ?? scrolledEpisodeId;
  const [open, setOpen] = useState<"contents" | "settings" | null>(null);

  const position = outline.findIndex(({ id }) => id === activeEpisodeId);
  const active = outline[position];
  const previous = outline[position - 1];
  const next = outline[position + 1];

  // An effect, not a CSS :has(), because hidden routes stay in the DOM and the
  // app's top bar must come back the moment the reader is left.
  useBeatJump(root, children);

  useLayoutEffect(() => {
    rememberView("reader");
    document.body.classList.add("is-reading");
    return () => document.body.classList.remove("is-reading");
  }, []);

  useEffect(() => {
    const page = root.current;
    const sections = [...(page?.querySelectorAll<HTMLElement>("[data-scene]") ?? [])];
    const episodes = [...(page?.querySelectorAll<HTMLElement>("[data-episode]") ?? [])];
    let frame = 0;
    let saved: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const measure = (hasScrolled: boolean) => {
      frame = 0;
      const { scrollTop, scrollHeight } = document.documentElement;
      if (bar.current) bar.current.style.transform = `scaleX(${scrollProgress(scrollTop, scrollHeight, innerHeight)})`;

      const line = (list: HTMLElement[]) => currentIndex(list.map((section) => section.getBoundingClientRect().top), READING_LINE);
      const episode = episodes[Math.max(0, line(episodes))]?.dataset.episode;
      if (episode) setScrolledEpisodeId(episode);

      // Only reading counts: opening a page must not move someone's place.
      const scene = sections[line(sections)]?.dataset.scene;
      if (!hasScrolled || !scene || scene === saved) return;
      saved = scene;
      clearTimeout(timer);
      timer = setTimeout(() => saveProgress(scene), SAVE_DELAY_MS);
    };

    const onScroll = () => {
      frame ||= requestAnimationFrame(() => measure(true));
    };

    if (location.hash) page?.querySelector(`[id="${location.hash.slice(1)}"]`)?.scrollIntoView();
    measure(false);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [children]);

  const goEpisode = useCallback(
    (direction: 1 | -1) => {
      if (pageEpisodeId === null) {
        step(root.current, "[data-episode]", direction);
        return;
      }
      const target = direction === 1 ? next : previous;
      if (target) router.push(`/read/${seasonId}/${target.id}`);
    },
    [pageEpisodeId, next, previous, router, seasonId],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || document.querySelector("dialog[open]")) return;

      const action = readerKey(event);
      if (!action) return;

      event.preventDefault();
      if (action.target === "scene") step(root.current, "[data-scene]", action.direction);
      else goEpisode(action.direction);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goEpisode]);

  const jumpToSection = (id: string) => {
    const section = root.current?.querySelector(`[id="${id}"]`);
    if (section) jumpTo(section);
    history.replaceState(history.state, "", `#${id}`);
    setOpen(null);
  };

  const style = useMemo(() => readerVariables(settings) as CSSProperties, [settings]);
  const episodeButton = (target: Outline[number] | undefined, direction: 1 | -1) => {
    const label = direction === 1 ? "Next episode" : "Previous episode";
    const arrow = direction === 1 ? "›" : "‹";

    if (!target) {
      return (
        <span aria-hidden className="rd-tool" data-off>
          {arrow}
        </span>
      );
    }
    return pageEpisodeId === null ? (
      <button type="button" className="rd-tool" aria-label={label} onClick={() => goEpisode(direction)}>
        {arrow}
      </button>
    ) : (
      <Link href={`/read/${seasonId}/${target.id}`} className="rd-tool" aria-label={label}>
        {arrow}
      </Link>
    );
  };

  return (
    <div ref={root} className="reader" style={style} data-colors={settings.colors ? "on" : "off"} data-timecodes={settings.timecodes ? "on" : "off"}>
      <header className="rd-header">
        <div className="rd-header-row">
          <Link href={backHref} className="rd-tool" aria-label="Back to the library">
            ←
          </Link>
          <p className="rd-header-title">{active ? `Episode ${active.number}: ${active.title}` : "Reader"}</p>
          {episodeButton(previous, -1)}
          {episodeButton(next, 1)}
          <button type="button" className="rd-tool rd-tool-wide" aria-label="Contents" onClick={() => setOpen("contents")}>
            ☰
          </button>
          <button type="button" className="rd-tool rd-tool-wide" aria-label="Reader settings" onClick={() => setOpen("settings")}>
            Aa
          </button>
          <ActionMenu label="Print and export" triggerClass="rd-tool">
            <MenuItem onSelect={() => window.print()}>Print or save as PDF</MenuItem>
            <MenuItem onSelect={() => startDownload(wordHref)}>Download Word</MenuItem>
          </ActionMenu>
        </div>
        <span aria-hidden className="rd-progress">
          <span ref={bar} />
        </span>
      </header>

      {children}

      {open === "contents" && (
        <ContentsDrawer
          seasonId={seasonId}
          outline={outline}
          pageEpisodeId={pageEpisodeId}
          activeEpisodeId={activeEpisodeId}
          onJump={jumpToSection}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "settings" && <SettingsDialog settings={settings} onClose={() => setOpen(null)} />}
    </div>
  );
}
