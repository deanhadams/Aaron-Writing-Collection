import { speakerLineCounts } from "@/lib/script/scene-summary";
import { VOICE_LABELS } from "./parse-beat";
import type { ParsedScript } from "./parse-script";

/** Confirmed variants for Season 1. Beats store the merged name. */
export const NAME_MERGES: Record<string, string> = {
  "CAPTAIN SARAH CALYDON": "SARAH",
  "ZECHT BALASTER": "ZECHT",
  "XAVIERA ROIVAS": "XAVIERA",
  "RYAN STRIKER": "RYAN",
  "REVOC ERIFLLEH": "REVOC",
  "CAPTAIN MAKIMA": "MAKIMA",
  "KRAD (ASSA)": "KRAD",
  "THE WATCHER": "WATCHER",
  "BEAR'DION": "BEAR’DION",
  "BEAR’DION SLAGDON": "BEAR’DION",
  "SARAH CALYDON": "SARAH",
  "CAPTAIN SARAH": "SARAH",
  "ATHRON SECROWN": "ATHRON",
  "FARRAH BLOOM": "FARRAH",
  "KRAD NISSASSA": "KRAD",
  ASSA: "KRAD",
  "MAKIMA SILVERTONGUE": "MAKIMA",
  "MORLACH WITHERSTIL": "MORLACH",
  "TYLER WITHNOR": "TYLER",
  "UMIKO URCHIN": "UMIKO",
  "VANDAL AQUARION": "VANDAL",
  "ZEPHYRA COLDBERG": "ZEPHYRA",
  CB: "CHAOS BRINGER",
  "LIGHT KNIGHT (LK)": "LIGHT KNIGHT",
  "CARETAKER (LIDA)": "LIDA",
};

const FULL_NAMES: Record<string, string> = {
  SARAH: "Sarah Calydon",
  ZECHT: "Zecht Balaster",
  XAVIERA: "Xaviera Roivas",
  RYAN: "Ryan Striker",
  REVOC: "Revoc Eriflleh",
  DESRUC: "Desruc Nemo",
  DANIEL: "Daniel Michael",
  "BEAR’DION": "Bear’dion Slagdon",
  ATHRON: "Athron Secrown",
  FARRAH: "Farrah Bloom",
  GNILAEH: "Gnilaeh Rethgif",
  KRAD: "Krad Nissassa",
  MAKIMA: "Makima Silvertongue",
  MORLACH: "Morlach Witherstil",
  TERA: "Tera Silvertongue",
  TYLER: "Tyler Withnor",
  UMIKO: "Umiko Urchin",
  VANDAL: "Vandal Aquarion",
  ZEPHYRA: "Zephyra Coldberg",
};

// Used as text on white and behind white initials, so each one passes AA both ways.
export const CHARACTER_PALETTE = [
  "#B4237A", "#0F766E", "#B45309", "#4338CA", "#0369A1", "#7E22CE",
  "#BE123C", "#15803D", "#1D4ED8", "#A21CAF", "#9A3412", "#0E7490",
];

export type SeedCharacter = {
  name: string;
  fullName: string | null;
  color: string;
  portraitKey: string;
  lineCount: number;
};

export function portraitKey(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
  return `characters/${slug}.png`;
}

/** Rewrites speakers to their merged names and counts the lines each merge moved. */
export function mergeSpeakers(script: ParsedScript) {
  const merged = new Map<string, { name: string; lines: number }>();

  const episodes = script.episodes.map((episode) => ({
    ...episode,
    scenes: episode.scenes.map((scene) => ({
      ...scene,
      beats: scene.beats.map((beat) => {
        if (!beat.character) return beat;

        // Keeps the separators, so "BEAR'DION / TYLER" merges name by name.
        const character = beat.character
          .split(/(\s*[,&/]\s*)/)
          .map((part) => {
            const name = NAME_MERGES[part];
            if (!name) return part;

            const entry = merged.get(part) ?? { name, lines: 0 };
            merged.set(part, { ...entry, lines: entry.lines + 1 });
            return name;
          })
          .join("");

        return character === beat.character ? beat : { ...beat, character };
      }),
    })),
  }));

  return { script: { ...script, episodes }, merged };
}

export function speakerTotals(script: ParsedScript) {
  const totals = new Map<string, number>();

  for (const { scenes } of script.episodes) {
    for (const { beats } of scenes) {
      for (const [name, lines] of speakerLineCounts(beats)) {
        totals.set(name, (totals.get(name) ?? 0) + lines);
      }
    }
  }

  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Busiest speakers get the first colors, so the main cast never shares one. */
export function seedCharacters(script: ParsedScript): SeedCharacter[] {
  return speakerTotals(script)
    .filter(([name]) => !VOICE_LABELS.has(name))
    .map(([name, lineCount], index) => {
      const fullName = FULL_NAMES[name] ?? null;
      return {
        name,
        fullName,
        color: CHARACTER_PALETTE[index % CHARACTER_PALETTE.length],
        portraitKey: portraitKey(fullName ?? name),
        lineCount,
      };
    });
}

/** Names that share a word with another speaker, for a person to review. */
export function possibleVariants(names: string[]) {
  const pairs: [string, string][] = [];

  for (const longer of names) {
    const words = longer.split(/[\s()]+/).filter(Boolean);
    if (words.length < 2) continue;
    for (const shorter of names) {
      if (shorter !== longer && words.includes(shorter)) pairs.push([longer, shorter]);
    }
  }

  return pairs;
}
