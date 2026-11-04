// Sample content for trying the app. It lives in its own series so it never
// mixes with imported scripts.
//   npm run db:seed:sample             replace the sample data
//   npm run db:seed:sample -- --remove delete it
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { speakerLineCounts } from "../lib/script/scene-summary";
import {
  characters,
  episodes,
  sceneCharacters,
  scenes,
  seasons,
  series,
  type Beat,
  type BeatType,
} from "../lib/db/schema";

const SAMPLE_SERIES_TITLE = "Sample Series";

const beat = (
  type: BeatType,
  text: string,
  extra: Partial<Beat> = {},
): Beat => ({ id: randomUUID(), type, text, ...extra });

const say = (character: string, text: string, parenthetical?: string) =>
  beat("dialogue", text, { character, parenthetical });

const CAST = [
  { name: "MIRA", fullName: "Mira Solenne", color: "#B4237A" },
  { name: "JUN", fullName: "Jun Tarrow", color: "#0F766E" },
  { name: "THE KEEPER", fullName: "The Keeper", color: "#B45309" },
  { name: "ROOK", fullName: "Rook Abara", color: "#4338CA" },
  { name: "ADA", fullName: "Ada Lindqvist", color: "#0369A1" },
  { name: "OLD TOM", fullName: "Tom Pell", color: "#7E22CE" },
];

const EPISODES = [
  {
    number: 1,
    title: "The Lamp That Listened",
    status: "done" as const,
    summary:
      "A courier on her last delivery finds a street lamp that answers back.",
    scenes: [
      {
        kind: "prologue" as const,
        title: "Before the Lights",
        location: "HARBOUR WALL - NIGHT",
        beats: [
          beat("visual", "Fog rolls over black water. One lamp flickers on."),
          beat("sound", "A slow bell, far out at sea."),
          beat("vo", "Every city keeps one light for the people it forgot.", {
            character: "MIRA",
          }),
        ],
      },
      {
        kind: "scene" as const,
        title: "Last Delivery",
        timecode: "1:30 - 4:00",
        location: "LANTERN STREET - DUSK",
        beats: [
          beat("action", "MIRA skids her bike to a stop beneath a dead lamp."),
          say("MIRA", "Number nine. This can't be right.", "checking the parcel"),
          say("JUN", "It's always right. That's the problem."),
          beat("visual", "The lamp above them glows a soft, impossible cyan."),
          beat("sound", "A low hum, almost a voice."),
          say("THE KEEPER", "You are late, little courier.", "from the lamp"),
          say("ROOK", "Did that lamp just talk?"),
          say("ADA", "Lamps do not talk, Rook."),
          say("OLD TOM", "This one always has."),
          beat("note", "Check the hum against the opening theme."),
        ],
      },
      {
        kind: "outro" as const,
        title: "Last Light",
        timecode: "20:30 - 21:00",
        location: "HARBOUR WALL - DAWN",
        beats: [
          say("MIRA", "Same time tomorrow?"),
          say("JUN", "If the street lets us."),
        ],
      },
      {
        kind: "post_credit" as const,
        title: "The Parcel Ticks",
        location: "LANTERN STREET - NIGHT",
        beats: [beat("visual", "The parcel, alone on the kerb, begins to tick.")],
      },
    ],
  },
  {
    number: 2,
    title: "Nine Doors Down",
    status: "drafting" as const,
    summary: "Jun counts the doors on Lantern Street and gets a different number.",
    scenes: [
      {
        kind: "scene" as const,
        title: "The Count",
        timecode: "0:00 - 2:15",
        location: "LANTERN STREET - MORNING",
        beats: [
          say("JUN", "Eight. There were nine yesterday."),
          say("MIRA", "Count again.", "not looking up"),
        ],
      },
      { kind: "outro" as const, title: null, location: null, beats: [] },
    ],
  },
  { number: 3, title: "Untitled Idea", status: "idea" as const, summary: null, scenes: [] },
];

async function removeSample() {
  await db.delete(series).where(eq(series.title, SAMPLE_SERIES_TITLE));
}

async function addSample() {
  await db.transaction(async (tx) => {
    const [{ id: seriesId }] = await tx
      .insert(series)
      .values({ title: SAMPLE_SERIES_TITLE })
      .returning({ id: series.id });

    const cast = await tx
      .insert(characters)
      .values(CAST.map((member) => ({ ...member, seriesId })))
      .returning({ id: characters.id, name: characters.name });
    const castIds = new Map(cast.map(({ id, name }) => [name, id]));

    const [{ id: seasonId }] = await tx
      .insert(seasons)
      .values({ seriesId, number: 1, title: "Lantern Street" })
      .returning({ id: seasons.id });

    for (const { scenes: sceneList, ...episode } of EPISODES) {
      const [{ id: episodeId }] = await tx
        .insert(episodes)
        .values({ ...episode, seasonId })
        .returning({ id: episodes.id });

      for (const [index, scene] of sceneList.entries()) {
        const [{ id: sceneId }] = await tx
          .insert(scenes)
          .values({ ...scene, episodeId, position: index + 1 })
          .returning({ id: scenes.id });

        const speakers = [...speakerLineCounts(scene.beats)].flatMap(
          ([name, lineCount]) => {
            const characterId = castIds.get(name);
            return characterId ? [{ sceneId, characterId, lineCount }] : [];
          },
        );
        if (speakers.length > 0) {
          await tx.insert(sceneCharacters).values(speakers);
        }
      }
    }
  });
}

async function main() {
  await removeSample();
  if (process.argv.includes("--remove")) {
    console.log("Sample data removed");
  } else {
    await addSample();
    console.log("Sample data seeded");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
