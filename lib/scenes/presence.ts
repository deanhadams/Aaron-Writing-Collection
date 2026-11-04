import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { scenePresence, users } from "@/lib/db/schema";
import type { Database } from "./save-scene";

export const HEARTBEAT_MS = 15_000;

// Two missed heartbeats and a bit of slack, so one slow request is no goodbye.
const FRESH_MS = 2 * HEARTBEAT_MS + 5_000;

/** Records this editor and returns who else has the scene open. */
export async function heartbeat(
  db: Database,
  { sceneId, userId, now = new Date() }: { sceneId: string; userId: string; now?: Date },
) {
  const cutoff = new Date(now.getTime() - FRESH_MS);

  await db
    .insert(scenePresence)
    .values({ sceneId, userId, lastSeen: now })
    .onConflictDoUpdate({
      target: [scenePresence.sceneId, scenePresence.userId],
      set: { lastSeen: sql`excluded.last_seen` },
    });

  await db
    .delete(scenePresence)
    .where(and(eq(scenePresence.sceneId, sceneId), lt(scenePresence.lastSeen, cutoff)));

  const others = await db
    .select({ name: users.name })
    .from(scenePresence)
    .innerJoin(users, eq(scenePresence.userId, users.id))
    .where(
      and(
        eq(scenePresence.sceneId, sceneId),
        ne(scenePresence.userId, userId),
        gt(scenePresence.lastSeen, cutoff),
      ),
    );

  return others.map(({ name }) => name);
}

export async function leaveScene(
  db: Database,
  { sceneId, userId }: { sceneId: string; userId: string },
) {
  await db
    .delete(scenePresence)
    .where(and(eq(scenePresence.sceneId, sceneId), eq(scenePresence.userId, userId)));
}
