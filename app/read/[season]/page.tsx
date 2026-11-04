import { Suspense } from "react";
import { ReaderPage } from "@/components/reader/reader-page";
import { PageSkeleton } from "@/components/ui/page-skeleton";

async function Season({ params }: { params: PageProps<"/read/[season]">["params"] }) {
  const { season } = await params;
  return <ReaderPage seasonId={season} />;
}

export default function ReadSeasonPage({ params }: PageProps<"/read/[season]">) {
  return (
    <Suspense fallback={<PageSkeleton shape="script" />}>
      <Season params={params} />
    </Suspense>
  );
}
