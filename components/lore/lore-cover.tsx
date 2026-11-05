import type { CSSProperties } from "react";
import { BookIcon } from "@/components/search/icons";
import { LORE_CATEGORIES, loreCategory } from "@/lib/lore/categories";

const GRADIENTS = [
  ["#1a45c4", "#7c5cff"],
  ["#5b3bd6", "#ff4fa3"],
  ["#0a6c9f", "#00d9ff"],
  ["#b01c72", "#7c5cff"],
  ["#1a45c4", "#00d9ff"],
  ["#5b3bd6", "#2563ff"],
  ["#0b6a85", "#7c5cff"],
];

function PATHS(category: string) {
  switch (category) {
    case "World":
      return <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />;
    case "Powers":
      return <path d="M13 2 4 14h7l-1 8 9-12h-7z" />;
    case "Organisations":
      return <path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21c1-4 4-6 8-6s7 2 8 6" />;
    case "Places":
      return <path d="M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />;
    case "Items":
      return <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />;
    case "Events":
      return <path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />;
    default:
      return null;
  }
}

export function coverGradient(category: string | null) {
  const [from, to] = GRADIENTS[LORE_CATEGORIES.indexOf(loreCategory(category)) % GRADIENTS.length];
  return { "--lore-a": from, "--lore-b": to } as CSSProperties;
}

/** The uploaded cover, or a gradient with the category's icon. */
export function LoreCover({ category, url, className }: { category: string | null; url: string | null; className?: string }) {
  const paths = PATHS(loreCategory(category));

  return (
    <div className={`lore-cover ${className ?? ""}`} style={coverGradient(category)}>
      {url ? (
        <span className="lore-cover-image" style={{ backgroundImage: `url(${JSON.stringify(url)})` }} />
      ) : paths ? (
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="lore-cover-icon">
          {paths}
        </svg>
      ) : (
        <BookIcon strokeWidth="1.4" className="lore-cover-icon" />
      )}
    </div>
  );
}
