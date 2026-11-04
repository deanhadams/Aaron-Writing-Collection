import type { CSSProperties } from "react";
import type { Beat } from "@/lib/db/schema";
import type { ScriptEpisode } from "@/lib/export/load";
import { sceneTitle } from "@/lib/format";
import { episodePageName, episodePageRule, sceneHeading, sceneNumbers, spokenText } from "@/lib/script/format";
import { speakerParts } from "@/lib/script/scene-summary";

type Colors = Map<string, string | null>;

function SpeakerName({ speaker, colors }: { speaker: string; colors: Colors }) {
  const voice = speaker.match(/^(.*?)( \(V\.O\.\))$/);
  const names = voice ? voice[1] : speaker;

  return (
    <strong>
      {speakerParts(names).map(({ text, isName }, index) =>
        isName ? (
          <span key={index} className="rd-name" style={{ "--char": colors.get(text) ?? undefined } as CSSProperties}>
            {text}
          </span>
        ) : (
          text
        ),
      )}
      {voice?.[2]}:
    </strong>
  );
}

function ReaderBeat({ beat, colors }: { beat: Beat; colors: Colors }) {
  switch (beat.type) {
    case "dialogue":
    case "vo": {
      const { speaker, parenthetical, text } = spokenText(beat);
      return (
        <p className="rd-line">
          {speaker && <SpeakerName speaker={speaker} colors={colors} />}
          {parenthetical && <span className="rd-aside"> ({parenthetical})</span>} {text}
        </p>
      );
    }
    case "visual":
      return (
        <p className="rd-line rd-italic">
          <strong className="rd-label">(VISUAL):</strong> {beat.text}
        </p>
      );
    case "sound":
      return (
        <p className="rd-line rd-italic">
          <strong className="rd-label">SOUND:</strong> {beat.text}
        </p>
      );
    case "action":
      return <p className="rd-line rd-italic rd-action">{beat.text}</p>;
    case "note":
      return <p className="rd-line">{beat.text}</p>;
  }
}

function Scene({ scene, number, colors }: { scene: ScriptEpisode["scenes"][number]; number: number | null; colors: Colors }) {
  // An outro's export heading is only for the importer; a reader wants its name.
  const heading = scene.kind === "outro" ? sceneTitle(scene) : sceneHeading(scene, number);

  return (
    <section id={`scene-${scene.id}`} data-scene={scene.id} data-kind={scene.kind} className="rd-scene">
      <h3 className="rd-heading">{heading}</h3>
      {(scene.timecode || scene.location) && (
        <p className="rd-where">
          {scene.timecode && <span className="rd-time">({scene.timecode}) </span>}
          {scene.location}
        </p>
      )}
      {scene.beats.map((beat) => (
        <ReaderBeat key={beat.id} beat={beat} colors={colors} />
      ))}
    </section>
  );
}

function Theme({ label, value }: { label: string; value: string | null }) {
  return value ? (
    <p className="rd-line">
      <strong className="rd-label">{label}:</strong> {value}
    </p>
  ) : null;
}

export function ScriptDocument({
  seasonNumber,
  episodes,
  colors,
}: {
  seasonNumber: number;
  episodes: ScriptEpisode[];
  colors: Colors;
}) {
  return (
    <article className="script-page rd-page">
      {/* Puts each episode's title in the top margin of every page it prints on. */}
      <style dangerouslySetInnerHTML={{ __html: episodes.map(episodePageRule).join(" ") }} />
      {episodes.map((episode, position) => {
        const numbers = sceneNumbers(episode.scenes);

        return (
          <section
            key={episode.id}
            id={`episode-${episode.id}`}
            data-episode={episode.id}
            className="rd-episode"
            style={{ page: episodePageName(episode) } as CSSProperties}
          >
            {position === 0 && <p className="eyebrow rd-season">Season {seasonNumber}</p>}
            <h2 className="rd-title">
              EPISODE {episode.number}: {episode.title}
            </h2>
            <Theme label="Opening theme" value={episode.openingTheme} />
            <Theme label="Outro theme" value={episode.outroTheme} />
            {episode.scenes.map((scene, index) => (
              <Scene key={scene.id} scene={scene} number={numbers[index]} colors={colors} />
            ))}
          </section>
        );
      })}
    </article>
  );
}
