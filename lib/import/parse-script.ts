import { randomUUID } from "node:crypto";
import type { Beat } from "@/lib/db/schema";
import type { SceneKind } from "@/lib/format";
import { parseHeading, splitTimecode, type Heading } from "./headings";
import { parseBeat } from "./parse-beat";
import type { SourceLine } from "./source-lines";

export type ParsedScene = {
  position: number;
  kind: SceneKind;
  title: string | null;
  timecode: string | null;
  location: string | null;
  beats: Beat[];
};

export type ParsedEpisode = {
  number: number;
  title: string;
  openingTheme: string | null;
  outroTheme: string | null;
  scenes: ParsedScene[];
};

export type ParsedScript = {
  seasonNumber: number | null;
  episodes: ParsedEpisode[];
  warnings: string[];
  /** Text before the first episode heading, which has nowhere to go. */
  ignoredLines: string[];
  repeatedSeasonHeadings: number;
  droppedEndLines: number;
};

type Implicit = Pick<ParsedScene, "kind" | "title" | "timecode">;

const THEME_FIELD = { opening: "openingTheme", outro: "outroTheme" } as const;
const THEME_LEAD = /^(?:Play Anime Intro|Episode Outro Plays)\s*:\s*/i;
const AFTER_THEME: Record<"opening" | "outro", Pick<ParsedScene, "kind" | "title">> = {
  opening: { kind: "scene", title: "Opening Theme" },
  outro: { kind: "outro", title: "Episode Outro" },
};

export function parseScript(
  lines: SourceLine[],
  createId: () => string = randomUUID,
): ParsedScript {
  const script: ParsedScript = {
    seasonNumber: null,
    episodes: [],
    warnings: [],
    ignoredLines: [],
    repeatedSeasonHeadings: 0,
    droppedEndLines: 0,
  };

  const state: {
    episode: ParsedEpisode | null;
    scene: ParsedScene | null;
    awaitingTheme: "opening" | "outro" | null;
    implicit: Implicit | null;
    /** The first cold open runs before Episode 1's heading, so it waits for it. */
    isLeadIn: boolean;
  } = { episode: null, scene: null, awaitingTheme: null, implicit: null, isLeadIn: false };

  const warn = (message: string) =>
    script.warnings.push(state.episode ? `Episode ${state.episode.number}: ${message}` : message);

  const openScene = (fields: Omit<ParsedScene, "position" | "beats">) => {
    if (!state.episode) return null;
    const scene = { ...fields, position: state.episode.scenes.length + 1, beats: [] };
    state.episode.scenes.push(scene);
    state.scene = scene;
    state.implicit = null;
    return scene;
  };

  // Beats with no heading above them still get kept, in a scene of their own.
  const currentScene = (text: string) => {
    if (state.scene) return state.scene;
    const fields = state.implicit ?? { kind: "scene" as const, title: null, timecode: null };
    warn(`text outside any scene, kept in a new ${fields.title ?? "untitled"} scene: "${text.slice(0, 60)}"`);
    return openScene({ ...fields, location: null })!;
  };

  const applyHeading = (heading: Heading) => {
    switch (heading.type) {
      case "season":
        if (script.seasonNumber === null) script.seasonNumber = heading.number;
        else if (script.seasonNumber === heading.number) script.repeatedSeasonHeadings++;
        else warn(`ignored heading for Season ${heading.number} inside Season ${script.seasonNumber}`);
        return;

      case "episode": {
        const existing = script.episodes.find(({ number }) => number === heading.number);
        if (state.isLeadIn && state.episode) {
          state.episode.number = heading.number;
          state.episode.title = heading.title;
          script.episodes.push(state.episode);
          state.isLeadIn = false;
        } else if (existing) {
          state.episode = existing;
          warn(`heading appears twice, so the scenes were joined ("${heading.title}")`);
        } else {
          state.episode = { number: heading.number, title: heading.title, openingTheme: null, outroTheme: null, scenes: [] };
          script.episodes.push(state.episode);
        }
        state.scene = null;
        state.awaitingTheme = null;
        state.implicit = null;
        return;
      }

      case "end":
        script.droppedEndLines++;
        return;

      case "theme":
        if (!state.episode) return;
        state.scene = null;
        state.implicit = { ...AFTER_THEME[heading.which], timecode: heading.timecode };
        if (heading.value) state.episode[THEME_FIELD[heading.which]] = heading.value;
        state.awaitingTheme = heading.value ? null : heading.which;
        return;

      case "scene": {
        state.awaitingTheme = null;

        // "End Scene (The Watcher)" then "(20:30 - END) POST-CREDIT SCENE" is one block.
        const open = state.scene;
        if (open && heading.kind !== "scene" && open.kind === heading.kind && open.beats.length === 0 && !open.timecode) {
          open.timecode = heading.timecode;
          open.title ??= heading.title;
          return;
        }

        openScene({
          kind: heading.kind,
          title: heading.title,
          timecode: heading.timecode,
          location: heading.location,
        });
        return;
      }
    }
  };

  for (const line of lines) {
    const parsed = parseHeading(line.text);

    // A scene header field only counts at the top of a scene.
    if (parsed?.type === "field" && state.scene?.beats.length === 0) {
      state.scene[parsed.field] = parsed.value;
      continue;
    }
    const heading = parsed?.type === "field" ? null : parsed;

    if (heading?.type === "season" || heading?.type === "episode") {
      applyHeading(heading);
      continue;
    }

    if (!state.episode) {
      if (heading?.type !== "scene" && heading?.type !== "theme") {
        script.ignoredLines.push(line.text);
        continue;
      }
      state.episode = { number: 0, title: "", openingTheme: null, outroTheme: null, scenes: [] };
      state.isLeadIn = true;
    }

    if (heading) {
      applyHeading(heading);
      continue;
    }

    const { timecode, rest } = splitTimecode(line.text);

    if (state.awaitingTheme) {
      if (timecode && !rest) continue;
      state.episode[THEME_FIELD[state.awaitingTheme]] = rest.replace(THEME_LEAD, "");
      state.awaitingTheme = null;
      continue;
    }

    if (timecode) {
      const target = currentScene(line.text);
      if (target.beats.length === 0 && !target.timecode) {
        target.timecode = timecode;
        target.location = rest || null;
        continue;
      }
    }

    currentScene(line.text).beats.push(parseBeat(line, createId));
  }

  return script;
}
