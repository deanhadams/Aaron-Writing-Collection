import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CharacterEditor } from "@/components/characters/character-editor";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { loadCharacter, loadCharacterChoices } from "@/lib/characters/read";
import type { Role } from "@/lib/characters/validate";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { imageUrl } from "@/lib/images";

async function Editor({ params }: { params: PageProps<"/characters/[slug]/edit">["params"] }) {
  await connection();
  const { slug } = await params;
  const [character, everyone] = await Promise.all([
    loadCharacter(db, decodeURIComponent(slug)),
    loadCharacterChoices(db),
  ]);
  if (!character) notFound();

  const { id, name, fullName, role, gift, appearance, personality, backstory, powers, notes, color, aliases } = character;
  const edited =
    character.editedBy && character.updatedAt
      ? `Last edited by ${character.editedBy} · ${formatRelative(character.updatedAt, new Date())}`
      : null;

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { label: "Characters", href: "/characters" },
          { label: name, href: `/characters/${character.slug}` },
        ]}
      />
      <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight">Edit {name}</h1>
      <CharacterEditor
        id={id}
        slug={character.slug}
        version={character.version ?? 1}
        lines={character.totalLines}
        edited={edited}
        portraitUrl={imageUrl(character.portraitKey, character.updatedAt?.getTime())}
        choices={everyone.filter((choice) => choice.id !== id)}
        fields={{
          name,
          fullName,
          role: role as Role | null,
          gift,
          appearance,
          personality,
          backstory,
          powers,
          notes,
          color,
          aliases,
          relationships: character.relationships.map(({ relatedId, note }) => ({ relatedId, note })),
        }}
      />
    </>
  );
}

export default function EditCharacterPage({ params }: PageProps<"/characters/[slug]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton shape="profile" />}>
      <Editor params={params} />
    </Suspense>
  );
}
