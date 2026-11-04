import Link from "next/link";
import type { CSSProperties } from "react";
import { readableColor } from "@/lib/characters/colors";
import type { AppearanceStats } from "@/lib/characters/stats";
import { plural } from "@/lib/format";
import { Portrait } from "./portrait";

export type CardData = {
  id: string;
  slug: string;
  name: string;
  fullName: string | null;
  aliases: string[];
  role: string | null;
  gift: string | null;
  color: string | null;
  portraitUrl: string | null;
  stats: AppearanceStats;
};

export function characterStyle(color: string | null) {
  return {
    "--char": color ?? "var(--color-primary)",
    "--char-text": readableColor(color) ?? "var(--color-primary-strong)",
  } as CSSProperties;
}

export function CharacterCard({ card, index }: { card: CardData; index: number }) {
  const { slug, name, fullName, role, gift, color, portraitUrl, stats } = card;

  return (
    <li className="rise" style={{ "--i": Math.min(index, 12) } as CSSProperties}>
      <Link href={`/characters/${slug}`} className="char-card" style={characterStyle(color)}>
        <span className="char-card-frame">
          <Portrait name={name} color={color} url={portraitUrl} className="aspect-[3/4] w-full rounded-[calc(var(--radius-xl)-2px)]" />
        </span>
        <span className="char-card-body">
          <span className="block font-heading text-lg font-semibold leading-tight">{name}</span>
          {fullName && <span className="block truncate text-sm text-muted">{fullName}</span>}
          {(role || gift) && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {role && <span className="char-chip capitalize">{role}</span>}
              {gift && <span className="char-chip char-chip-quiet">{gift}</span>}
            </span>
          )}
          <span className="mt-2 block text-xs font-medium text-muted">
            {plural(stats.lines, "line")} · {plural(stats.episodes, "episode")}
          </span>
        </span>
      </Link>
    </li>
  );
}
