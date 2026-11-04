import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  characters,
  episodes,
  scenes,
  seasons,
  series,
  users,
  type Beat,
} from "@/lib/db/schema";
import * as schema from "@/lib/db/schema";

/** A real Postgres in memory, built from the same migrations as production. */
export async function createTestDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

export async function seedScene(db: Awaited<ReturnType<typeof createTestDb>>, beats: Beat[] = []) {
  const [dean, kim] = await db
    .insert(users)
    .values([
      { email: "dean@example.com", name: "Dean", passwordHash: "x" },
      { email: "kim@example.com", name: "Kim", passwordHash: "x" },
    ])
    .returning();

  const [{ id: seriesId }] = await db.insert(series).values({ title: "Test" }).returning();
  const [{ id: seasonId }] = await db.insert(seasons).values({ seriesId, number: 1 }).returning();
  const [{ id: episodeId }] = await db
    .insert(episodes)
    .values({ seasonId, number: 1, title: "One" })
    .returning();

  const [scene] = await db
    .insert(scenes)
    .values({ episodeId, position: 1, title: "Start", beats })
    .returning();

  const cast = await db
    .insert(characters)
    .values(["REVOC", "DESRUC"].map((name) => ({ seriesId, name, slug: name.toLowerCase() })))
    .returning();

  return { dean, kim, scene, cast };
}
