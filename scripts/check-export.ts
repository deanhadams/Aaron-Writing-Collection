// Exports every season to Word in memory, reads each file back with the importer's
// parser, and reports anything that differs from the database. Read-only.
//   npm run export:check
import { renderDocx } from "../lib/export/docx";
import { scriptLines } from "../lib/export/lines";

async function main() {
  const [{ db }, { seasons }, { loadScript }, { compareScript, parseDocx }] = await Promise.all([
    import("../lib/db"),
    import("../lib/db/schema"),
    import("../lib/export/load"),
    import("../lib/export/round-trip"),
  ]);

  let problems = 0;

  for (const { id, number } of await db.select({ id: seasons.id, number: seasons.number }).from(seasons)) {
    const script = await loadScript(db, id);
    if (!script) continue;

    const buffer = await renderDocx(scriptLines(number, script.episodes), `Season ${number}`);
    const differences = compareScript(script.episodes, await parseDocx(buffer));

    const scenes = script.episodes.reduce((total, { scenes: list }) => total + list.length, 0);
    const beats = script.episodes.reduce((total, { scenes: list }) => total + list.reduce((sum, scene) => sum + scene.beats.length, 0), 0);
    console.log(`Season ${number}: ${script.episodes.length} episodes, ${scenes} scenes, ${beats} beats, ${differences.length} differences, ${Math.round(buffer.length / 1024)} KB`);
    for (const difference of differences) console.log(`  ${difference}`);
    problems += differences.length;
  }

  if (problems > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
