// Imports a season from a Word file.
//   npm run import:season -- --dry-run            parse and report, no database
//   npm run import:season                         write to the database
//   npm run import:season -- --force              also overwrite scenes edited on the site
//   npm run import:season -- --remove-sample      also delete the sample series
//   npm run import:season -- path/to/file.docx    use another file
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import mammoth from "mammoth";
import { mergeSpeakers, seedCharacters } from "../lib/import/characters";
import { parseScript } from "../lib/import/parse-script";
import { buildReport, formatReport } from "../lib/import/report";
import { htmlToLines } from "../lib/import/source-lines";

const DEFAULT_FILE = "import/Season_1.docx";

// Strict, so a mistyped --dry-run stops here instead of writing to the database.
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    "remove-sample": { type: "boolean", default: false },
  },
});

async function main() {
  const file = positionals[0] ?? DEFAULT_FILE;
  if (!existsSync(file)) throw new Error(`File not found: ${file}`);

  const { value: html } = await mammoth.convertToHtml({ path: file });
  const lines = htmlToLines(html);
  const { script, merged } = mergeSpeakers(parseScript(lines));
  const cast = seedCharacters(script);

  console.log(`${file}: ${lines.length} lines`);
  console.log(formatReport(buildReport(script, merged)));

  if (values["dry-run"]) {
    console.log("\nDry run: nothing was written.");
    return;
  }

  // Loaded here so a dry run needs no DATABASE_URL and opens no connection.
  const [{ db }, { writeImport }] = await Promise.all([
    import("../lib/db"),
    import("../lib/import/write-import"),
  ]);

  const result = await db.transaction((tx) =>
    writeImport(tx, script, cast, {
      force: values.force,
      removeSample: values["remove-sample"],
    }),
  );

  console.log("\n== Written ==");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
