import { Suspense } from "react";
import { Hero } from "@/components/library/hero";
import { SeasonCard } from "@/components/library/season-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getSeasonCards } from "@/lib/queries/library";

async function SeasonGrid() {
  const seasons = await getSeasonCards();
  const now = new Date();

  if (seasons.length === 0) {
    return (
      <EmptyState title="No seasons yet">
        They will appear here once a script is imported.
      </EmptyState>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {seasons.map((season, index) => (
        <SeasonCard key={season.id} season={season} index={index} now={now} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense fallback={<PageSkeleton shape="covers" />}>
        <SeasonGrid />
      </Suspense>
    </>
  );
}
