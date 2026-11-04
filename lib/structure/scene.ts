import { and, eq, isNull, sql } from "drizzle-orm";
import { episodes, sceneCharacters, scenes, seasons, type Beat } from "@/lib/db/schema";
import { sceneTitle, type SceneKind } from "@/lib/format";
import type { Database, Transaction } from "@/lib/scenes/save-scene";
import { rebuildSceneLinks } from "@/lib/scenes/scene-links";
import { bumpScenes, liveSceneIds, lockEpisode, writePositions } from "./episode";
import { conflict, notFound, retentionCutoff } from "./result";
import { purgeExpired } from "./season";

type Input = { sceneId: string; version: number; userId: string };

const seriesOf = async (tx: Transaction, seasonId: string) => {
  const [{ seriesId }] = await tx
    .select({ seriesId: seasons.seriesId })
    .from(seasons)
    .where(eq(seasons.id, seasonId));
  return seriesId;
};

const placeOf = async (tx: Transaction, sceneId: string) => {
  const [scene] = await tx
    .select({ episodeId: scenes.episodeId })
    .from(scenes)
    .where(eq(scenes.id, sceneId));
  return scene ?? null;
};

/** Episode first, as every list change does, so two of them cannot deadlock. */
async function lockSceneInEpisode(tx: Transaction, sceneId: string) {
  const place = await placeOf(tx, sceneId);
  if (!place) return null;

  const episode = await lockEpisode(tx, place.episodeId);
  const [scene] = await tx.select().from(scenes).where(eq(scenes.id, sceneId)).for("update");
  // It moved between the two reads, so the episode locked is the wrong one.
  if (!episode || !scene || scene.episodeId !== episode.id) return null;
  return { episode, scene };
}

export async function addScene(
  db: Database,
  input: {
    episodeId: string;
    version: number;
    afterId: string | null;
    kind: SceneKind;
    title: string | null;
    userId: string;
  },
) {
  const { episodeId, version, afterId, kind, title, userId } = input;

  return db.transaction(async (tx) => {
    const episode = await lockEpisode(tx, episodeId);
    if (!episode || episode.deletedAt) return notFound;
    if (episode.scenesVersion !== version) return conflict;

    const ids = await liveSceneIds(tx, episodeId);
    if (afterId && !ids.includes(afterId)) return conflict;

    const [created] = await tx
      .insert(scenes)
      .values({ episodeId, kind, title, position: 0, updatedBy: userId, updatedAt: new Date() })
      .returning({ id: scenes.id, version: scenes.version });

    ids.splice(afterId ? ids.indexOf(afterId) + 1 : 0, 0, created.id);
    await writePositions(tx, ids);

    return { status: "ok" as const, version: await bumpScenes(tx, episodeId), scene: created };
  });
}

const withFreshIds = (beats: Beat[]) => beats.map((beat) => ({ ...beat, id: crypto.randomUUID() }));

/** A new scene with no import key and no history. It sits right after the original. */
export async function duplicateScene(db: Database, { sceneId, version, userId }: Input) {
  return db.transaction(async (tx) => {
    const locked = await lockSceneInEpisode(tx, sceneId);
    if (!locked || locked.scene.deletedAt || locked.episode.deletedAt) return notFound;

    const { episode, scene } = locked;
    if (episode.scenesVersion !== version) return conflict;

    const [copy] = await tx
      .insert(scenes)
      .values({
        episodeId: episode.id,
        position: 0,
        kind: scene.kind,
        title: `${sceneTitle(scene)} (copy)`,
        timecode: scene.timecode,
        location: scene.location,
        beats: withFreshIds(scene.beats),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .returning({ id: scenes.id, version: scenes.version, title: scenes.title });

    const ids = await liveSceneIds(tx, episode.id);
    const withoutCopy = ids.filter((id) => id !== copy.id);
    withoutCopy.splice(withoutCopy.indexOf(sceneId) + 1, 0, copy.id);
    await writePositions(tx, withoutCopy);

    await rebuildSceneLinks(tx, await seriesOf(tx, episode.seasonId), [{ id: copy.id, beats: scene.beats }]);

    return { status: "ok" as const, version: await bumpScenes(tx, episode.id), scene: copy };
  });
}

/** Keeps the scene's version, so re-importing it after an undo still sees it unedited. */
export async function deleteScene(db: Database, { sceneId, version, userId }: Input) {
  return db.transaction(async (tx) => {
    const locked = await lockSceneInEpisode(tx, sceneId);
    if (!locked || locked.scene.deletedAt || locked.episode.deletedAt) return notFound;
    if (locked.scene.version !== version) return conflict;

    await tx
      .update(scenes)
      .set({ deletedAt: new Date(), deletedBy: userId })
      .where(eq(scenes.id, sceneId));
    await tx.delete(sceneCharacters).where(eq(sceneCharacters.sceneId, sceneId));
    await purgeExpired(tx);

    return { status: "ok" as const, scenesVersion: await bumpScenes(tx, locked.episode.id) };
  });
}

/** Goes back before the first live scene at or past its old position. */
export async function restoreScene(db: Database, { sceneId, version }: Omit<Input, "userId">) {
  return db.transaction(async (tx) => {
    const locked = await lockSceneInEpisode(tx, sceneId);
    if (!locked) return notFound;

    const { episode, scene } = locked;
    if (episode.deletedAt) return { status: "episode_deleted" as const, number: episode.number };
    if (!scene.deletedAt || scene.version !== version) return conflict;
    if (scene.deletedAt < retentionCutoff()) return notFound;

    const live = await tx
      .select({ id: scenes.id, position: scenes.position })
      .from(scenes)
      .where(and(eq(scenes.episodeId, episode.id), isNull(scenes.deletedAt)))
      .orderBy(scenes.position, scenes.id);

    const after = live.findIndex(({ position }) => position >= scene.position);
    const ids = live.map(({ id }) => id);
    ids.splice(after === -1 ? ids.length : after, 0, sceneId);

    await tx.update(scenes).set({ deletedAt: null, deletedBy: null }).where(eq(scenes.id, sceneId));
    await writePositions(tx, ids);
    await rebuildSceneLinks(tx, await seriesOf(tx, episode.seasonId), [{ id: sceneId, beats: scene.beats }]);

    return { status: "ok" as const, scenesVersion: await bumpScenes(tx, episode.id) };
  });
}

/**
 * Goes to the end of an episode in the same season. Its import key and version
 * go with it, so a later re-import still finds it, unedited, in its new home.
 */
export async function moveScene(
  db: Database,
  input: { sceneId: string; targetEpisodeId: string; version: number },
) {
  const { sceneId, targetEpisodeId, version } = input;

  return db.transaction(async (tx) => {
    const place = await placeOf(tx, sceneId);
    if (!place) return notFound;
    if (place.episodeId === targetEpisodeId) return conflict;

    // A fixed lock order, so two opposite moves cannot deadlock.
    const [first, second] = [place.episodeId, targetEpisodeId].sort();
    const locked = [await lockEpisode(tx, first), await lockEpisode(tx, second)];
    const source = locked.find((row) => row?.id === place.episodeId);
    const target = locked.find((row) => row?.id === targetEpisodeId);

    if (!source || !target || source.deletedAt || target.deletedAt) return notFound;
    if (source.seasonId !== target.seasonId) return notFound;
    if (source.scenesVersion !== version) return conflict;

    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${scenes.position}), 0)::int` })
      .from(scenes)
      .where(and(eq(scenes.episodeId, target.id), isNull(scenes.deletedAt)));

    const moved = await tx
      .update(scenes)
      .set({ episodeId: target.id, position: last + 1 })
      .where(and(eq(scenes.id, sceneId), eq(scenes.episodeId, source.id), isNull(scenes.deletedAt)))
      .returning({ id: scenes.id });
    if (moved.length === 0) return notFound;

    const [{ number }] = await tx
      .select({ number: episodes.number })
      .from(episodes)
      .where(eq(episodes.id, target.id));
    await bumpScenes(tx, target.id);

    return { status: "ok" as const, version: await bumpScenes(tx, source.id), targetNumber: number };
  });
}
