import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { castLookups } from "@/lib/characters/lookup";
import { getCurrentSession } from "@/lib/auth/current-session";
import { db } from "@/lib/db";
import { loadScript } from "@/lib/export/load";
import { isUuid } from "@/lib/queries/library";
import { loadOutline, loadProgress, seasonCast } from "@/lib/reader/read";
import { ReaderShell } from "./reader-shell";
import { ScriptDocument } from "./script-document";

/** The start and continue links, here and on the season page. */
export async function ReadLinks({ seasonId, firstHref, className }: { seasonId: string; firstHref: string; className?: string }) {
  const session = await getCurrentSession();
  const progress = session ? await loadProgress(db, session.userId, seasonId) : null;

  return (
    <div className={className}>
      <Link href={firstHref} className="btn-primary text-sm">
        Read from the start
      </Link>
      {progress && (
        <Link href={`/read/${seasonId}/${progress.episodeId}#scene-${progress.sceneId}`} className="btn-ghost text-sm">
          Continue where I left off (Episode {progress.episodeNumber})
        </Link>
      )}
    </div>
  );
}

export async function ReaderPage({ seasonId, episodeId }: { seasonId: string; episodeId?: string }) {
  await connection();
  if (!isUuid(seasonId) || (episodeId && !isUuid(episodeId))) notFound();

  const [script, outline, cast] = await Promise.all([
    loadScript(db, seasonId, episodeId),
    loadOutline(db, seasonId),
    seasonCast(db, seasonId),
  ]);
  if (!script || (episodeId && script.episodes.length === 0)) notFound();

  const firstScene = outline.flatMap(({ scenes }) => scenes)[0];

  return (
    <ReaderShell
      seasonId={seasonId}
      backHref={episodeId ? `/episodes/${episodeId}` : `/seasons/${seasonId}`}
      outline={outline}
      pageEpisodeId={episodeId ?? null}
      wordHref={episodeId ? `/api/export/episodes/${episodeId}` : `/api/export/seasons/${seasonId}`}
    >
      {!episodeId && firstScene && (
        <ReadLinks seasonId={seasonId} firstHref={`#scene-${firstScene.id}`} className="rd-start" />
      )}
      <ScriptDocument seasonNumber={script.season.number} episodes={script.episodes} colors={castLookups(cast).colors} />
    </ReaderShell>
  );
}
