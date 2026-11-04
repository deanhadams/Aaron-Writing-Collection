import { and, isNull } from "drizzle-orm";
import { episodes, scenes } from "./schema";

/** Soft-deleted rows stay in their tables for 30 days, so every read filters them. */
export const liveEpisode = isNull(episodes.deletedAt);

/** A scene is hidden with its episode. Needs episodes joined into the query. */
export const liveScene = and(isNull(scenes.deletedAt), liveEpisode);
