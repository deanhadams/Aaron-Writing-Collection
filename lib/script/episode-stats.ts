export type EpisodeSceneRow = {
  lineCount: number;
  timecode: string | null;
  firstVisual: string | null;
  updatedAt: Date;
  editor: string | null;
};

// Accepts m:ss or h:mm:ss. A timecode can be a range, so the last time wins.
function endInSeconds(timecode: string): number | null {
  const last = timecode.match(/\d+(?::\d{1,2}){1,2}/g)?.at(-1);
  if (!last) return null;
  return last.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

function runtimeMinutes(scenes: EpisodeSceneRow[]): number | null {
  const ends = scenes.flatMap(({ timecode }) => {
    const end = timecode ? endInSeconds(timecode) : null;
    return end === null ? [] : [end];
  });
  if (ends.length === 0) return null;
  return Math.max(1, Math.round(Math.max(...ends) / 60));
}

function lastEdit(scenes: EpisodeSceneRow[]) {
  if (scenes.length === 0) return null;

  const latest = scenes.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
  return { at: latest.updatedAt, by: latest.editor };
}

export type SeasonPhase = "planning" | "in_progress" | "complete";

type Status = "idea" | "drafting" | "done";

export function seasonPhase(statuses: Status[]): SeasonPhase {
  if (statuses.length > 0 && statuses.every((status) => status === "done")) {
    return "complete";
  }
  return statuses.some((status) => status !== "idea") ? "in_progress" : "planning";
}

/** Expects scenes in script order. */
export function summarizeEpisode(scenes: EpisodeSceneRow[]) {
  return {
    sceneCount: scenes.length,
    lineCount: scenes.reduce((total, scene) => total + scene.lineCount, 0),
    runtimeMinutes: runtimeMinutes(scenes),
    firstVisual: scenes[0]?.firstVisual?.trim() || null,
    lastEdited: lastEdit(scenes),
  };
}

export type SeasonSceneRow = EpisodeSceneRow & { id: string; episodeId: string };

export function summarizeSeason(
  episodes: { id: string; status: Status }[],
  scenes: SeasonSceneRow[],
) {
  const perEpisode = episodes.map(({ id }) =>
    summarizeEpisode(scenes.filter((scene) => scene.episodeId === id)),
  );
  const runtimes = perEpisode.flatMap(({ runtimeMinutes }) => runtimeMinutes ?? []);
  const latest = scenes.length
    ? scenes.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
    : null;

  return {
    phase: seasonPhase(episodes.map(({ status }) => status)),
    episodeCount: episodes.length,
    doneCount: episodes.filter(({ status }) => status === "done").length,
    sceneCount: scenes.length,
    lineCount: scenes.reduce((total, scene) => total + scene.lineCount, 0),
    runtimeMinutes: runtimes.length
      ? runtimes.reduce((total, minutes) => total + minutes, 0)
      : null,
    lastEdited: latest ? { at: latest.updatedAt, by: latest.editor } : null,
    continueSceneId: latest?.id ?? null,
  };
}
