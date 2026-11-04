import { BEAT_TYPES, type BeatType } from "@/lib/db/schema";
import { SCENE_KIND_LABELS } from "@/lib/format";
import { NAME_MERGES, possibleVariants, seedCharacters, speakerTotals } from "./characters";
import { VOICE_LABELS } from "./parse-beat";
import type { ParsedScene, ParsedScript } from "./parse-script";

const NOTE_LIMIT = 20;

const sceneLabel = (scene: ParsedScene) =>
  `${scene.position}. ${scene.title ?? SCENE_KIND_LABELS[scene.kind]}`;

export function missingEpisodes(numbers: number[]) {
  const found = new Set(numbers);
  const highest = Math.max(0, ...numbers);
  return Array.from({ length: highest }, (_, i) => i + 1).filter((n) => !found.has(n));
}

export function buildReport(
  script: ParsedScript,
  merged: Map<string, { name: string; lines: number }>,
) {
  const beatCounts = Object.fromEntries(BEAT_TYPES.map((type) => [type, 0])) as Record<BeatType, number>;
  const notes: { episode: number; scene: string; text: string }[] = [];
  let unattributedVo = 0;

  for (const episode of script.episodes) {
    for (const scene of episode.scenes) {
      for (const beat of scene.beats) {
        beatCounts[beat.type]++;
        if (beat.type === "note") {
          notes.push({ episode: episode.number, scene: sceneLabel(scene), text: beat.text });
        }
        if (beat.type === "vo" && !beat.character) unattributedVo++;
      }
    }
  }

  const speakers = speakerTotals(script);

  return {
    seasonNumber: script.seasonNumber,
    repeatedSeasonHeadings: script.repeatedSeasonHeadings,
    droppedEndLines: script.droppedEndLines,
    ignoredLines: script.ignoredLines,
    warnings: script.warnings,
    episodes: script.episodes.map(({ number, title, scenes, openingTheme, outroTheme }) => ({
      number,
      title,
      scenes: scenes.length,
      beats: scenes.reduce((total, scene) => total + scene.beats.length, 0),
      openingTheme,
      outroTheme,
    })),
    missingEpisodes: missingEpisodes(script.episodes.map(({ number }) => number)),
    sceneTotal: script.episodes.reduce((total, { scenes }) => total + scenes.length, 0),
    beatCounts,
    unattributedVo,
    speakers,
    characters: seedCharacters(script),
    merged: [...merged].map(([variant, { name, lines }]) => ({ variant, name, lines })),
    unusedMerges: Object.keys(NAME_MERGES).filter((variant) => !merged.has(variant)),
    possibleVariants: possibleVariants(speakers.map(([name]) => name)),
    notes,
  };
}

export type ImportReport = ReturnType<typeof buildReport>;

export function formatReport(report: ImportReport) {
  const out: string[] = [];
  const section = (title: string) => out.push("", `== ${title} ==`);

  out.push(`Season ${report.seasonNumber ?? "?"}`);
  out.push(`Repeated season headings ignored: ${report.repeatedSeasonHeadings}`);
  out.push(`END EPISODE lines dropped: ${report.droppedEndLines}`);

  section(`Episodes found: ${report.episodes.length}`);
  out.push(`Missing numbers: ${report.missingEpisodes.join(", ") || "none"}`);
  for (const episode of report.episodes) {
    const number = String(episode.number).padStart(2, " ");
    const counts = `${String(episode.scenes).padStart(3)} scenes ${String(episode.beats).padStart(4)} beats`;
    const themes = [
      episode.openingTheme && `opening: ${episode.openingTheme}`,
      episode.outroTheme && `outro: ${episode.outroTheme}`,
    ].filter(Boolean);
    out.push(`  ${number}  ${counts}  ${episode.title}${themes.length ? `  [${themes.join(" | ")}]` : ""}`);
  }
  out.push(`  Total: ${report.sceneTotal} scenes`);

  section("Beats per type");
  for (const [type, count] of Object.entries(report.beatCounts)) {
    out.push(`  ${type.padEnd(9)} ${count}`);
  }
  out.push(`  V.O. lines with no named speaker: ${report.unattributedVo}`);

  section(`Speakers: ${report.speakers.length}`);
  for (const [name, lines] of report.speakers) {
    const label = VOICE_LABELS.has(name) ? "  (voice label, no character card)" : "";
    out.push(`  ${String(lines).padStart(4)}  ${name}${label}`);
  }

  section("Merged names");
  if (report.merged.length === 0) out.push("  none");
  for (const { variant, name, lines } of report.merged) {
    out.push(`  ${variant} -> ${name} (${lines} lines)`);
  }
  if (report.unusedMerges.length > 0) {
    out.push(`  Not in this file: ${report.unusedMerges.join(", ")}`);
  }

  section("Possible variants NOT merged");
  if (report.possibleVariants.length === 0) out.push("  none");
  for (const [longer, shorter] of report.possibleVariants) {
    out.push(`  ${longer} ~ ${shorter}`);
  }

  section(`Character portraits: ${report.characters.length}`);
  for (const { name, fullName, portraitKey } of report.characters) {
    out.push(`  ${portraitKey}  (${fullName ?? name})`);
  }

  section(`Lines that became note: ${report.notes.length} (first ${NOTE_LIMIT})`);
  for (const { episode, scene, text } of report.notes.slice(0, NOTE_LIMIT)) {
    out.push(`  Ep ${episode}, ${scene}: ${text}`);
  }

  section(`Warnings: ${report.warnings.length}`);
  for (const warning of report.warnings) out.push(`  ${warning}`);

  section(`Lines before the first episode, ignored: ${report.ignoredLines.length}`);
  for (const line of report.ignoredLines) out.push(`  ${line}`);

  return out.join("\n");
}
