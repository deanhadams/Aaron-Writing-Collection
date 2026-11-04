import { Suspense } from "react";
import { ReaderPage } from "@/components/reader/reader-page";
import { PageSkeleton } from "@/components/ui/page-skeleton";

async function Episode({ params }: { params: PageProps<"/read/[season]/[episode]">["params"] }) {
  const { season, episode } = await params;
  return <ReaderPage seasonId={season} episodeId={episode} />;
}

export default function ReadEpisodePage({ params }: PageProps<"/read/[season]/[episode]">) {
  return (
    <Suspense fallback={<PageSkeleton shape="script" />}>
      <Episode params={params} />
    </Suspense>
  );
}
