import { asc, count, gt } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { strToU8, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import {
  backupsLog,
  characterImages,
  characterRelationships,
  characters,
  episodes,
  loreEntries,
  loreRevisions,
  sceneRevisions,
  scenes,
  seasons,
  series,
} from "@/lib/db/schema";
import { imageUrl } from "@/lib/images";
import type { Database } from "@/lib/scenes/save-scene";
import { seasonDocx } from "./load";

/** Big enough to be quick, small enough that no table is ever held in memory at once. */
const PAGE_SIZE = 200;

/** Users are left out on purpose: the file must never carry password hashes. */
const TABLES: [string, PgTable & { id: PgColumn }][] = [
  ["series", series],
  ["seasons", seasons],
  ["episodes", episodes],
  ["scenes", scenes],
  ["scene_revisions", sceneRevisions],
  ["characters", characters],
  ["character_relationships", characterRelationships],
  ["character_images", characterImages],
  ["lore_entries", loreEntries],
  ["lore_revisions", loreRevisions],
];

export const backupFileName = (date: Date) => `aarons-writing-collection-backup-${date.toISOString().slice(0, 10)}.zip`;

/** Walks a table by id, so memory stays at one page however large it grows. */
async function* tablePages(db: Database, table: PgTable & { id: PgColumn }) {
  let after: string | null = null;

  for (;;) {
    const page: { id: string }[] = await db
      .select()
      .from(table as PgTable)
      .where(after ? gt(table.id, after) : undefined)
      .orderBy(asc(table.id))
      .limit(PAGE_SIZE) as { id: string }[];
    if (page.length === 0) return;

    yield page;
    after = page[page.length - 1].id;
  }
}

async function imageKeys(db: Database) {
  const [covers, loreCovers, portraits, gallery] = await Promise.all([
    db.select({ key: series.coverKey }).from(series),
    db.select({ key: loreEntries.coverKey }).from(loreEntries),
    db.select({ key: characters.portraitKey }).from(characters),
    db.select({ key: characterImages.r2Key }).from(characterImages),
  ]);

  const keys = [...covers, ...loreCovers, ...portraits, ...gallery].flatMap(({ key }) => (key ? [key] : []));
  return [...new Set(keys)].sort().map((key) => ({ key, url: imageUrl(key) }));
}

/**
 * Yields the zip as it is written: each table a page at a time and each season's
 * Word file on its own, so the size of the backup is not the size held in memory.
 */
export async function* backupChunks(db: Database, { userId, now = new Date() }: { userId: string; now?: Date }) {
  await db.insert(backupsLog).values({ userId, createdAt: now });
  console.log(`backup: downloaded by ${userId} at ${now.toISOString()}`);

  let ready: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else ready.push(chunk);
  });

  const drain = () => {
    if (failure) throw failure;
    const chunks = ready;
    ready = [];
    return chunks;
  };

  const counts: Record<string, number> = {};

  for (const [name, table] of TABLES) {
    const file = new ZipDeflate(`content/${name}.json`, { level: 6 });
    zip.add(file);
    file.push(strToU8("["));

    let rows = 0;
    for await (const page of tablePages(db, table)) {
      for (const row of page) {
        file.push(strToU8(`${rows === 0 ? "" : ","}\n${JSON.stringify(row)}`));
        rows++;
      }
      yield* drain();
    }

    file.push(strToU8("\n]\n"), true);
    counts[name] = rows;
    yield* drain();
  }

  const seasonRows = await db.select({ id: seasons.id, number: seasons.number }).from(seasons).orderBy(asc(seasons.number));
  const documents: string[] = [];

  for (const { id } of seasonRows) {
    const document = await seasonDocx(db, id);
    if (!document) continue;

    const name = `word/${document.fileName}`;
    const file = new ZipPassThrough(name);
    zip.add(file);
    file.push(document.buffer, true);
    documents.push(name);
    yield* drain();
  }

  const manifest = new ZipDeflate("manifest.json", { level: 6 });
  zip.add(manifest);
  manifest.push(
    strToU8(
      JSON.stringify(
        { createdAt: now.toISOString(), app: "Aaron's Writing Collection", counts, documents, images: await imageKeys(db) },
        null,
        2,
      ),
    ),
    true,
  );

  zip.end();
  yield* drain();
}

export async function backupCount(db: Database) {
  const [{ total }] = await db.select({ total: count() }).from(backupsLog);
  return total;
}
