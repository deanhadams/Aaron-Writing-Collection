import type { CSSProperties } from "react";
import type { EpisodeLines } from "@/lib/characters/stats";
import { plural } from "@/lib/format";

/** Lines per episode, one thin bar each. Zero stays a gap on the baseline. */
export function LinesChart({ episodes }: { episodes: EpisodeLines[] }) {
  const highest = Math.max(1, ...episodes.map(({ lines }) => lines));
  const peak = episodes.find(({ lines }) => lines === highest);
  const count = episodes.length;

  return (
    <figure className="lines-chart">
      <figcaption className="text-sm font-medium">
        Lines per episode
        {peak && <span className="font-normal text-muted"> · most in Episode {peak.episodeNumber}, {highest}</span>}
      </figcaption>

      <div aria-hidden className="lines-bars" style={{ "--count": count } as CSSProperties}>
        {episodes.map(({ seasonNumber, episodeNumber, title, lines }, index) => (
          <a
            key={`${seasonNumber}-${episodeNumber}`}
            href={lines > 0 ? `#episode-${seasonNumber}-${episodeNumber}` : undefined}
            tabIndex={-1}
            data-side={index >= count / 2 ? "end" : undefined}
            className="lines-bar"
          >
            <span className="lines-bar-fill" style={{ height: lines ? `${Math.max(4, (lines / highest) * 100)}%` : 0 }} />
            <span className="chip-tooltip">
              Episode {episodeNumber}: {title}, {plural(lines, "line")}
            </span>
          </a>
        ))}
      </div>

      <div aria-hidden className="flex justify-between text-xs text-muted">
        <span>Ep {episodes[0]?.episodeNumber}</span>
        <span>Ep {episodes.at(-1)?.episodeNumber}</span>
      </div>

      {/* On a wrapper: a table ignores the width that sr-only sets. */}
      <div className="sr-only">
        <table>
          <caption>Lines per episode</caption>
          <thead>
            <tr>
              <th scope="col">Episode</th>
              <th scope="col">Lines</th>
            </tr>
          </thead>
          <tbody>
            {episodes.map(({ seasonNumber, episodeNumber, title, lines }) => (
              <tr key={`${seasonNumber}-${episodeNumber}`}>
                <th scope="row">
                  Episode {episodeNumber}: {title}
                </th>
                <td>{lines}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
