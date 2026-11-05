import { connection } from "next/server";
import { Suspense } from "react";
import { LoreGallery } from "@/components/lore/lore-gallery";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/images";
import { loadLoreGallery } from "@/lib/lore/read";

async function Gallery() {
  await connection();
  const entries = await loadLoreGallery(db);

  return <LoreGallery entries={entries.map((entry) => ({ ...entry, coverUrl: imageUrl(entry.coverKey, entry.updatedAt.getTime()) }))} />;
}

export default function LorePage() {
  return (
    <>
      <p className="eyebrow text-primary-strong">World bible</p>
      <h1 className="text-gradient mb-6 w-fit text-4xl font-bold tracking-tight sm:text-5xl">Lore</h1>
      <Suspense fallback={<PageSkeleton shape="cards" />}>
        <Gallery />
      </Suspense>
    </>
  );
}
