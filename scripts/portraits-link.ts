// Checks the R2 bucket for each character's portrait.
//   npm run portraits:link
// A character with no portrait_key gets one when the conventional file exists.
// Characters that already have a key are checked and reported, never changed.
import { asc, eq } from "drizzle-orm";
import { conventionalPortraitKey } from "../lib/characters/slug";
import { db } from "../lib/db";
import { characters } from "../lib/db/schema";

async function exists(base: string, key: string) {
  const response = await fetch(`${base}/${key}`, { method: "HEAD" });
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`HEAD ${key} returned ${response.status}`);
}

async function main() {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) throw new Error("R2_PUBLIC_URL is not set");

  const cast = await db.select().from(characters).orderBy(asc(characters.name));
  const linked: string[] = [];
  const found: string[] = [];
  const missing: string[] = [];

  for (const { id, name, slug, portraitKey } of cast) {
    const key = portraitKey ?? conventionalPortraitKey(slug);

    if (!(await exists(base, key))) {
      missing.push(`${name}  (${key})`);
    } else if (portraitKey) {
      found.push(`${name}  (${key})`);
    } else {
      await db.update(characters).set({ portraitKey: key }).where(eq(characters.id, id));
      linked.push(`${name}  (${key})`);
    }
  }

  const section = (title: string, rows: string[]) => {
    console.log(`\n${title}: ${rows.length}`);
    rows.forEach((row) => console.log(`  ${row}`));
  };

  console.log(`Checked ${cast.length} characters`);
  section("Newly linked", linked);
  section("Already linked, file found", found);
  section("Still no image", missing);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
