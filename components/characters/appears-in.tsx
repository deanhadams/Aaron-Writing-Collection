import Link from "next/link";
import type { CharacterDetail } from "@/lib/characters/read";
import { plural, sceneTitle } from "@/lib/format";
import { LinesChart } from "./lines-chart";

type Scene = CharacterDetail["appearances"][number]["scenes"][number];

function Milestone({ label, scene }: { label: string; scene: Scene }) {
  return (
    <p className="text-sm">
      <span className="eyebrow mr-2 text-muted">{label}</span>
      <Link href={`/scenes/${scene.sceneId}`} className="font-medium text-primary-strong hover:underline">
        Episode {scene.episodeNumber}: {sceneTitle(scene)}
      </Link>
    </p>
  );
}

export function AppearsIn({ character }: { character: CharacterDetail }) {
  const { appearances, chart, first, last, totalLines } = character;

  if (!first || !last) {
    return <p className="text-muted">Not in any scene yet.</p>;
  }

  return (
    <>
      <p className="text-sm text-muted">
        {plural(totalLines, "line")} across {plural(appearances.length, "episode")}
      </p>
      <div className="mt-2 grid gap-1">
        <Milestone label="First" scene={first} />
        <Milestone label="Last" scene={last} />
      </div>

      <div className="mt-5">
        <LinesChart episodes={chart} />
      </div>

      <ol className="mt-6 grid grid-cols-1 gap-2">
        {appearances.map((episode) => (
          <li key={episode.id} id={`episode-${episode.seasonNumber}-${episode.number}`} className="appears-episode">
            <details>
              <summary>
                <span className="min-w-0 truncate font-medium">
                  Episode {episode.number}: {episode.title}
                </span>
                <span className="shrink-0 text-xs text-muted">{plural(episode.lines, "line")}</span>
              </summary>
              <ul className="grid grid-cols-1 gap-1 px-3 pb-3">
                {episode.scenes.map((scene) => (
                  <li key={scene.sceneId} className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/scenes/${scene.sceneId}`} className="min-w-0 truncate text-primary-strong hover:underline">
                      {sceneTitle(scene)}
                    </Link>
                    <span className="shrink-0 text-xs text-muted">{plural(scene.lineCount, "line")}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </>
  );
}
