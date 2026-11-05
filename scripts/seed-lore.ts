// Adds the starter lore entries: titles and categories only, for Aaron to fill in.
// Safe to run again: an entry that already exists is left alone.
//   npm run lore:seed
import { STARTER_ENTRIES } from "../lib/lore/categories";

async function main() {
  const [{ db }, { createEntry }] = await Promise.all([import("../lib/db"), import("../lib/lore/write")]);

  for (const { title, category } of STARTER_ENTRIES) {
    const result = await createEntry(db, { title, category, userId: null });
    console.log(`${result.status === "created" ? "added  " : "skipped"} ${title}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
