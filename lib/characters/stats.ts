export type AppearanceRow = {
  characterId: string;
  sceneId: string;
  lineCount: number;
  episodeId: string;
  episodeNumber: number;
  seasonNumber: number;
  position: number;
};

export type FirstAppearance = { seasonNumber: number; episodeNumber: number; position: number };

export type AppearanceStats = {
  lines: number;
  scenes: number;
  episodes: number;
  first: FirstAppearance | null;
};

const EMPTY: AppearanceStats = { lines: 0, scenes: 0, episodes: 0, first: null };

const isEarlier = (a: FirstAppearance, b: FirstAppearance) =>
  a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber || a.position - b.position;

/** Stats for every character from one pass over scene_characters. */
export function summarizeAppearances(rows: AppearanceRow[]) {
  const totals = new Map<string, AppearanceStats & { episodeIds: Set<string> }>();

  for (const { characterId, lineCount, episodeId, episodeNumber, seasonNumber, position } of rows) {
    const entry = totals.get(characterId) ?? { ...EMPTY, episodeIds: new Set<string>() };
    const here = { seasonNumber, episodeNumber, position };

    entry.lines += lineCount;
    entry.scenes += 1;
    entry.episodeIds.add(episodeId);
    entry.episodes = entry.episodeIds.size;
    if (!entry.first || isEarlier(here, entry.first) < 0) entry.first = here;

    totals.set(characterId, entry);
  }

  return (id: string): AppearanceStats => {
    const entry = totals.get(id);
    if (!entry) return EMPTY;
    const { lines, scenes, episodes, first } = entry;
    return { lines, scenes, episodes, first };
  };
}

export type CardSort = "lines" | "name" | "first";

type Sortable = { name: string; stats: AppearanceStats };

const byName = (a: Sortable, b: Sortable) => a.name.localeCompare(b.name);

const COMPARE: Record<CardSort, (a: Sortable, b: Sortable) => number> = {
  name: byName,
  lines: (a, b) => b.stats.lines - a.stats.lines || byName(a, b),
  first(a, b) {
    if (!a.stats.first || !b.stats.first) return a.stats.first ? -1 : b.stats.first ? 1 : byName(a, b);
    return isEarlier(a.stats.first, b.stats.first) || byName(a, b);
  },
};

export function sortCards<T extends Sortable>(cards: T[], sort: CardSort) {
  return [...cards].sort(COMPARE[sort]);
}

export function matchesSearch(
  card: { name: string; fullName: string | null; aliases: string[]; role: string | null; gift: string | null },
  query: string,
) {
  const search = query.trim().toLowerCase();
  if (!search) return true;

  return [card.name, card.fullName, card.role, card.gift, ...card.aliases]
    .some((field) => field?.toLowerCase().includes(search));
}

export type SeasonEpisode = { seasonNumber: number; episodeNumber: number; title: string };

export type EpisodeLines = SeasonEpisode & { lines: number };

/** Every episode of the seasons they are in, so a gap shows as a gap. */
export function linesPerEpisode(
  episodes: SeasonEpisode[],
  appearances: { seasonNumber: number; episodeNumber: number; lineCount: number }[],
): EpisodeLines[] {
  const seasons = new Set(appearances.map(({ seasonNumber }) => seasonNumber));

  return episodes
    .filter(({ seasonNumber }) => seasons.has(seasonNumber))
    .map((episode) => ({
      ...episode,
      lines: appearances
        .filter((row) => row.seasonNumber === episode.seasonNumber && row.episodeNumber === episode.episodeNumber)
        .reduce((total, { lineCount }) => total + lineCount, 0),
    }));
}

/** Script speakers with no card, busiest first. Shared lines count for each name. */
export function speakersWithoutCards(
  counts: { character: string; lines: number }[],
  known: Set<string>,
  labels: Set<string>,
  split: (name: string) => string[],
) {
  const totals = new Map<string, number>();

  for (const { character, lines } of counts) {
    for (const part of split(character.trim().toUpperCase())) {
      if (!known.has(part) && !labels.has(part)) totals.set(part, (totals.get(part) ?? 0) + lines);
    }
  }

  return [...totals]
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name));
}
