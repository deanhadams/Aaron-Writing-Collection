import mammoth from "mammoth";
import { parseScript, type ParsedScript } from "@/lib/import/parse-script";
import { htmlToLines } from "@/lib/import/source-lines";
import type { ExportEpisode } from "./lines";

/** The importer's own dry run, on a file instead of the master document. */
export async function parseDocx(buffer: Buffer): Promise<ParsedScript> {
  const { value } = await mammoth.convertToHtml({ buffer });
  return parseScript(htmlToLines(value));
}

/** Everything that differs, as readable lines. Empty means the two match. */
export function compareScript(expected: ExportEpisode[], parsed: ParsedScript) {
  const differences: string[] = [];
  if (parsed.warnings.length > 0) differences.push(...parsed.warnings.map((warning) => `warning: ${warning}`));

  if (expected.length !== parsed.episodes.length) {
    differences.push(`episodes: ${expected.length} in the database, ${parsed.episodes.length} read back`);
  }

  expected.forEach((episode, index) => {
    const found = parsed.episodes[index];
    if (!found) return;

    const label = `Episode ${episode.number}`;
    if (found.number !== episode.number) differences.push(`${label}: read back as ${found.number}`);
    if (found.title !== episode.title) differences.push(`${label}: title "${found.title}"`);
    if ((found.openingTheme ?? null) !== (episode.openingTheme ?? null)) differences.push(`${label}: opening theme`);
    if ((found.outroTheme ?? null) !== (episode.outroTheme ?? null)) differences.push(`${label}: outro theme`);
    if (found.scenes.length !== episode.scenes.length) {
      differences.push(`${label}: ${episode.scenes.length} scenes, ${found.scenes.length} read back`);
    }

    episode.scenes.forEach((scene, sceneIndex) => {
      const back = found.scenes[sceneIndex];
      if (!back) return;

      const where = `${label} scene ${sceneIndex + 1}`;
      if (back.kind !== scene.kind) differences.push(`${where}: kind ${scene.kind} read back as ${back.kind}`);
      if ((back.title ?? null) !== (scene.title ?? null)) differences.push(`${where}: title "${scene.title}" read back as "${back.title}"`);
      if ((back.timecode ?? null) !== (scene.timecode ?? null)) differences.push(`${where}: timecode "${scene.timecode}" read back as "${back.timecode}"`);
      if ((back.location ?? null) !== (scene.location ?? null)) differences.push(`${where}: location "${scene.location}" read back as "${back.location}"`);

      const types = scene.beats.map(({ type }) => type).join(" ");
      const backTypes = back.beats.map(({ type }) => type).join(" ");
      if (types !== backTypes) {
        differences.push(`${where}: ${scene.beats.length} beats, ${back.beats.length} read back, types differ`);
      }
    });
  });

  return differences;
}
