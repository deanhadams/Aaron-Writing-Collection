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
