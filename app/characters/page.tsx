import { connection } from "next/server";
import { Suspense } from "react";
import { Gallery } from "@/components/characters/gallery";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { loadGallery } from "@/lib/characters/read";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/images";

async function Characters() {
  await connection();
  const { cards, noCard } = await loadGallery(db);

  return (
    <Gallery
      noCard={noCard}
      cards={cards.map(({ portraitKey, updatedAt, ...card }) => ({
        ...card,
        portraitUrl: imageUrl(portraitKey, updatedAt?.getTime()),
      }))}
    />
  );
}

export default function CharactersPage() {
  return (
    <>
      <h1 className="text-gradient mb-6 font-heading text-4xl font-bold tracking-tight">Characters</h1>
      <Suspense fallback={<PageSkeleton shape="portraits" />}>
        <Characters />
      </Suspense>
    </>
  );
}
