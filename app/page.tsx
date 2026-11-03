import { Suspense } from "react";
import { SeasonCard } from "@/components/library/season-card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getSeasonCards } from "@/lib/queries/library";

async function SeasonGrid() {
  const seasons = await getSeasonCards();

  if (seasons.length === 0) {
    return (
      <p className="card p-8 text-center text-ink/70">
        No seasons yet. They will appear here once a script is imported.
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {seasons.map((season) => (
        <SeasonCard key={season.id} season={season} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold">Library</h1>
      <Suspense fallback={<PageSkeleton />}>
        <SeasonGrid />
      </Suspense>
    </>
  );
}
