import Link from "next/link";
import type { CSSProperties } from "react";
import { characterStyle } from "@/components/characters/character-card";
import { Portrait } from "@/components/characters/portrait";
import { LocationChips } from "@/components/library/location-chips";
import { SCENE_KIND_LABELS, plural, sceneTitle } from "@/lib/format";
import { formatTimecode } from "@/lib/script/scene-summary";
import type { CharacterResult, EpisodeResult, LoreResult, SceneResult } from "@/lib/search/run";
import { Highlighted } from "./highlighted";
import { SceneLink } from "./scene-link";

export function SceneHit({ scene, index }: { scene: SceneResult; index: number }) {
  const { snippet } = scene;

  return (
    <li data-kind={scene.kind} className="rise" style={{ "--i": Math.min(index, 8) } as CSSProperties}>
      <article className="glass glass-link scene-card search-hit">
        <p className="eyebrow scene-card-kind">
          Episode {scene.episodeNumber} · {SCENE_KIND_LABELS[scene.kind]}
        </p>
        <h3 className="mt-0.5 font-semibold leading-snug">
          <SceneLink target={{ ...scene, beatId: snippet?.beatId }}>{sceneTitle(scene)}</SceneLink>
        </h3>

        {snippet && (
          <p className="search-snippet">
            {snippet.speaker && <strong>{snippet.speaker}: </strong>}
            {snippet.parenthetical && <span className="text-muted">({snippet.parenthetical}) </span>}
            <Highlighted segments={snippet.segments} />
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {scene.timecode && <span className="eyebrow text-muted">{formatTimecode(scene.timecode)}</span>}
          <LocationChips location={scene.location} />
        </div>
      </article>
    </li>
  );
}

export function SceneGroup({ results, total }: { results: SceneResult[]; total: number }) {
  return results.length > 0 ? (
    <section aria-labelledby="results-scenes">
      <h2 id="results-scenes" className="search-group">
        Scenes <span>{plural(total, "match").replace("matchs", "matches")}</span>
      </h2>
      <ol className="grid grid-cols-1 gap-4">
        {results.map((scene, index) => (
          <SceneHit key={scene.id} scene={scene} index={index} />
        ))}
      </ol>
    </section>
  ) : null;
}

export function SideGroups({
  episodes,
  characters,
  lore,
}: {
  episodes: EpisodeResult[];
  characters: CharacterResult[];
  lore: LoreResult[];
}) {
  return (
    <>
      {episodes.length > 0 && (
        <section aria-labelledby="results-episodes">
          <h2 id="results-episodes" className="search-group">
            Episodes
          </h2>
          <ul className="search-side">
            {episodes.map((episode) => (
              <li key={episode.id}>
                <Link href={`/episodes/${episode.id}`} className="glass glass-link search-row">
                  <span className="eyebrow text-muted">Episode {episode.number}</span>
                  <span className="block font-semibold">
                    <Highlighted segments={episode.segments} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {characters.length > 0 && (
        <section aria-labelledby="results-characters">
          <h2 id="results-characters" className="search-group">
            Characters
          </h2>
          <ul className="search-side">
            {characters.map((character) => (
              <li key={character.id}>
                <Link href={`/characters/${character.slug}`} className="glass glass-link search-row flex items-center gap-3" style={characterStyle(character.color)}>
                  <Portrait name={character.name} color={character.color} url={character.portraitUrl} className="size-10 shrink-0 rounded-full" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      <Highlighted segments={character.segments} />
                    </span>
                    {character.fullName && <span className="block truncate text-xs text-muted">{character.fullName}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lore.length > 0 && (
        <section aria-labelledby="results-lore">
          <h2 id="results-lore" className="search-group">
            Lore
          </h2>
          <ul className="search-side">
            {lore.map((entry) => (
              <li key={entry.id}>
                <Link href={`/lore/${entry.slug}`} className="glass glass-link search-row">
                  <span className="eyebrow text-muted">{entry.category}</span>
                  <span className="block font-semibold">
                    <Highlighted segments={entry.segments} />
                  </span>
                  {entry.summary && <span className="block truncate text-xs text-muted">{entry.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
