import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AppearsIn } from "@/components/characters/appears-in";
import { characterStyle } from "@/components/characters/character-card";
import { ImageGallery } from "@/components/characters/image-gallery";
import { Portrait } from "@/components/characters/portrait";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { loadCharacter, type CharacterDetail } from "@/lib/characters/read";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { imageUrl } from "@/lib/images";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Prose({ text }: { text: string | null }) {
  return text ? (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
  ) : (
    <p className="text-sm text-muted">Not written yet.</p>
  );
}

function Hero({ character }: { character: CharacterDetail }) {
  const { slug, name, fullName, role, gift, color, portraitKey, updatedAt, aliases, editedBy } = character;
  const gifts = gift?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];

  return (
    <header className="char-hero rise" style={characterStyle(color)}>
      <div className="char-hero-portrait">
        <Portrait name={name} color={color} url={imageUrl(portraitKey, updatedAt?.getTime())} className="aspect-[3/4] w-full rounded-2xl" />
      </div>
      <div className="min-w-0">
        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">{name}</h1>
        {fullName && <p className="mt-1 text-lg text-muted">{fullName}</p>}
        {(role || gifts.length > 0) && (
          <p className="mt-3 flex flex-wrap gap-2">
            {role && <span className="char-chip capitalize">{role}</span>}
            {gifts.map((part) => (
              <span key={part} className="char-chip char-chip-quiet">
                {part}
              </span>
            ))}
          </p>
        )}
        {aliases.length > 0 && <p className="mt-3 text-sm text-muted">Also written as {aliases.join(", ")}</p>}
        <Link href={`/characters/${slug}/edit`} className="btn-primary mt-4 inline-block text-sm">
          Edit
        </Link>
        {updatedAt && editedBy && (
          <p className="mt-3 text-xs text-muted">
            Last edited by {editedBy} · {formatRelative(updatedAt, new Date())}
          </p>
        )}
      </div>
    </header>
  );
}

function Partners({ partners }: { partners: CharacterDetail["partners"] }) {
  if (partners.length === 0) return null;

  return (
    <Section title="Top scene partners">
      <ul className="flex flex-wrap gap-4">
        {partners.map(({ id, slug, name, color, portraitKey, updatedAt, scenes }) => (
          <li key={id}>
            <Link href={`/characters/${slug}`} className="partner">
              <Portrait name={name} color={color} url={imageUrl(portraitKey, updatedAt?.getTime())} className="size-14 rounded-full" />
              <span className="block max-w-20 truncate text-xs font-medium">{name}</span>
              <span className="block text-xs text-muted">{scenes} scenes</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Relationships({ rows }: { rows: CharacterDetail["relationships"] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">None yet.</p>;

  return (
    <ul className="grid gap-1 text-sm">
      {rows.map(({ id, slug, name, note }) => (
        <li key={id}>
          <Link href={`/characters/${slug}`} className="font-medium text-primary-strong hover:underline">
            {name}
          </Link>
          {note && <span className="text-muted"> · {note}</span>}
        </li>
      ))}
    </ul>
  );
}

async function Character({ params }: { params: PageProps<"/characters/[slug]">["params"] }) {
  await connection();
  const { slug } = await params;
  const character = await loadCharacter(db, decodeURIComponent(slug));
  if (!character) notFound();

  const images = character.images.map(({ id, r2Key, caption }) => ({ id, caption, url: imageUrl(r2Key) }));

  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Characters", href: "/characters" }]} />
      <Hero character={character} />

      <div className="char-columns" style={characterStyle(character.color)}>
        <div className="grid min-w-0 grid-cols-1 content-start gap-5">
          <Section title="Appearance"><Prose text={character.appearance} /></Section>
          <Section title="Personality"><Prose text={character.personality} /></Section>
          <Section title="Backstory"><Prose text={character.backstory} /></Section>
          <Section title="Powers / Gift"><Prose text={character.powers} /></Section>
          <Section title="Relationships"><Relationships rows={character.relationships} /></Section>
          <Section title="Notes"><Prose text={character.notes} /></Section>
        </div>
        <div className="grid min-w-0 grid-cols-1 content-start gap-5">
          <Section title="Appears in"><AppearsIn character={character} /></Section>
          <Partners partners={character.partners} />
          <Section title="Gallery">
            <ImageGallery characterId={character.id} images={images} />
          </Section>
        </div>
      </div>
    </>
  );
}

export default function CharacterPage({ params }: PageProps<"/characters/[slug]">) {
  return (
    <Suspense fallback={<PageSkeleton shape="profile" />}>
      <Character params={params} />
    </Suspense>
  );
}
