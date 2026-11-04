import type { Beat } from "@/lib/db/schema";
import type { SceneKind } from "@/lib/format";
import { parseHeading, splitTimecode } from "@/lib/import/headings";
import { parseBeat } from "@/lib/import/parse-beat";
import { oneLine, sceneHeading, sceneNumbers, spokenText } from "@/lib/script/format";

export type ExportScene = {
  kind: SceneKind;
  title: string | null;
  timecode: string | null;
  location: string | null;
  beats: Beat[];
};

export type ExportEpisode = {
  number: number;
  title: string;
  openingTheme: string | null;
  outroTheme: string | null;
  scenes: ExportScene[];
};

export type Run = { text: string; bold?: boolean; italics?: boolean };

export type ScriptLine = {
  style: "season" | "episode" | "scene" | "bold" | "bullet" | "sub";
  runs: Run[];
};

const plain = (text: string, style: ScriptLine["style"]): ScriptLine => ({ style, runs: [{ text, bold: style === "bold" }] });

const textRun = (text: string, italics = false): Run[] => (text ? [{ text: ` ${text}`, italics }] : []);

/**
 * The importer's parser is the judge of what a line means. A plain line is used
 * when it reads back as the same beat; otherwise it gets an explicit label.
 */
function readsAs(text: string, depth: number, type: Beat["type"]) {
  return (
    text !== "" &&
    parseHeading(text) === null &&
    splitTimecode(text).timecode === null &&
    parseBeat({ text, depth }, () => "").type === type
  );
}

function spokenLine(beat: Beat): ScriptLine {
  const { speaker, parenthetical, text } = spokenText(beat);
  const body = [parenthetical && `(${parenthetical})`, oneLine(text)].filter(Boolean).join(" ");
  const head = speaker ? `${speaker}:` : "";

  if (readsAs([head, body].filter(Boolean).join(" "), 0, beat.type)) {
    return { style: "bullet", runs: [{ text: head, bold: true }, ...textRun(body)] };
  }

  const label = beat.type === "vo" ? "(VO):" : "(DIALOGUE):";
  return { style: "bullet", runs: [{ text: label, bold: true }, ...textRun([head, body].filter(Boolean).join(" "))] };
}

function beatLine(beat: Beat): ScriptLine {
  const text = oneLine(beat.text);

  switch (beat.type) {
    case "dialogue":
    case "vo":
      return spokenLine(beat);
    case "visual":
      return { style: "bullet", runs: [{ text: "(VISUAL):", bold: true }, ...textRun(text, true)] };
    case "sound":
      return { style: "bullet", runs: [{ text: "SOUND:", bold: true, italics: true }, ...textRun(text, true)] };
    case "action":
      return readsAs(text, 1, "action")
        ? { style: "sub", runs: [{ text }] }
        : { style: "sub", runs: [{ text: "(ACTION):", bold: true }, ...textRun(text)] };
    case "note":
      return readsAs(text, 0, "note")
        ? { style: "bullet", runs: [{ text }] }
        : { style: "bullet", runs: [{ text: "(NOTE):", bold: true }, ...textRun(text)] };
  }
}

const OPENING_LINES: Partial<Record<SceneKind, string>> = {
  prologue: "OPENING SCENE",
  post_credit: "POST-CREDIT SCENE",
};

/** "(2:00 - 6:00) CLASSROOM - DAY", or labelled lines when that shape can't hold them. */
function headerLines({ kind, timecode, location }: ExportScene): ScriptLine[] {
  const time = timecode?.trim();
  const place = location?.trim() || null;

  if (time && splitTimecode(`(${time})`).timecode) {
    const line = [`(${time})`, place ?? OPENING_LINES[kind]].filter(Boolean).join(" ");
    if (!place || parseHeading(line) === null) return [plain(line, "bold")];
  }

  return [
    ...(time ? [plain(`Timecode: ${time}`, "bold")] : []),
    ...(place ? [plain(`Location: ${place}`, "bold")] : []),
  ];
}

const themeLines = (heading: string, lead: string, value: string | null): ScriptLine[] =>
  value
    ? [
        plain(heading, "bold"),
        { style: "bullet", runs: [{ text: `${lead}:`, bold: true, italics: true }, { text: ` ${value}` }] },
      ]
    : [];

/** The themes sit where the source has them: after the cold open, and before the closing scenes. */
function episodeBody({ scenes, openingTheme, outroTheme }: ExportEpisode): ScriptLine[] {
  const numbers = sceneNumbers(scenes);
  const opening = themeLines("OPENING THEME", "Play Anime Intro", openingTheme);
  const outro = themeLines("EPISODE OUTRO", "Episode Outro Plays", outroTheme);

  const firstBody = scenes.findIndex(({ kind }) => kind !== "prologue");
  const openingAt = firstBody === -1 ? scenes.length : firstBody;
  const firstClosing = scenes.findIndex(({ kind }) => kind === "outro" || kind === "post_credit");
  const outroAt = Math.max(firstClosing === -1 ? scenes.length : firstClosing, openingAt);

  const lines: ScriptLine[] = [];
  scenes.forEach((scene, index) => {
    if (index === openingAt) lines.push(...opening);
    if (index === outroAt) lines.push(...outro);
    lines.push(plain(sceneHeading(scene, numbers[index]), "scene"), ...headerLines(scene), ...scene.beats.map(beatLine));
  });

  if (openingAt === scenes.length) lines.push(...opening);
  if (outroAt === scenes.length) lines.push(...outro);
  return lines;
}

export function scriptLines(seasonNumber: number, episodes: ExportEpisode[]): ScriptLine[] {
  return [
    plain(`SEASON ${seasonNumber}`, "season"),
    ...episodes.flatMap((episode) => [
      plain(`EPISODE ${episode.number}: ${episode.title}`, "episode"),
      ...episodeBody(episode),
      plain("END EPISODE.", "bold"),
    ]),
  ];
}
