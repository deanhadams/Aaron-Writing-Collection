import { cleanText } from "@/lib/search/query";

const WIKI_LINK = /\[\[([^\[\]\n|]+)(?:\|([^\[\]\n]+))?\]\]/g;
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/g;
export const WIKI_PREFIX = "wiki:";

export type WikiLink = { target: string; label: string };

/** Applies a change to everything outside code, where [[ ]] is only text. */
const outsideCode = (markdown: string, change: (text: string) => string) =>
  markdown
    .split(CODE)
    .map((part, index) => (index % 2 === 1 ? part : change(part)))
    .join("");

/** Every [[link]] in a text, in order. */
export function parseWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = [];
  outsideCode(markdown, (text) => {
    for (const [, target, label] of text.matchAll(WIKI_LINK)) {
      links.push({ target: target.trim(), label: (label ?? target).trim() });
    }
    return text;
  });
  return links;
}

/** Turns [[Name]] into a markdown link the renderer can pick out. */
export const wikiLinksToMarkdown = (markdown: string) =>
  outsideCode(markdown, (text) =>
    text.replace(WIKI_LINK, (_whole, target: string, label?: string) => {
      const shown = (label ?? target).trim().replace(/[\[\]]/g, "");
      // encodeURIComponent leaves brackets, and one would end the markdown link early.
      const href = encodeURIComponent(target.trim()).replace(/[()]/g, (char) => `%${char.charCodeAt(0).toString(16)}`);
      return `[${shown}](${WIKI_PREFIX}${href})`;
    }),
  );

export const wikiTarget = (href: string) => decodeURIComponent(href.slice(WIKI_PREFIX.length));

export const linkKey = (name: string) => cleanText(name).trim();

export type LinkTarget = { kind: "character" | "lore"; name: string; href: string; color: string | null };

export type LinkLookup = Map<string, LinkTarget>;

type LookupInput = {
  characters: { name: string; fullName: string | null; aliases: string[]; slug: string; color: string | null }[];
  entries: { title: string; aliases: string[]; slug: string }[];
};

/** Lore wins a shared name, since lore links are usually written on purpose. */
export function buildLinkLookup({ characters, entries }: LookupInput): LinkLookup {
  const lookup: LinkLookup = new Map();

  for (const { name, fullName, aliases, slug, color } of characters) {
    const target: LinkTarget = { kind: "character", name, href: `/characters/${slug}`, color };
    for (const key of [name, fullName, ...aliases]) if (key) lookup.set(linkKey(key), target);
  }
  for (const { title, aliases, slug } of entries) {
    const target: LinkTarget = { kind: "lore", name: title, href: `/lore/${slug}`, color: null };
    for (const key of [title, ...aliases]) lookup.set(linkKey(key), target);
  }

  return lookup;
}

export const slugifyHeading = (text: string) =>
  cleanText(text)
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

export type Heading = { level: 2 | 3; text: string; id: string };

/** "## Title" lines outside code, for the table of contents. */
export function headingsIn(markdown: string): Heading[] {
  const headings: Heading[] = [];
  outsideCode(markdown, (text) => {
    for (const [, hashes, title] of text.matchAll(/^(##{1,2})\s+(.+?)\s*#*$/gm)) {
      const clean = title.replace(WIKI_LINK, (_whole, target: string, label?: string) => label ?? target).replace(/[*_`]/g, "");
      headings.push({ level: hashes.length as 2 | 3, text: clean, id: slugifyHeading(clean) });
    }
    return text;
  });
  return headings;
}

/** What [[ is being typed at the caret, if any: for the autocomplete. */
export function openLinkAt(text: string, caret: number) {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf("[[");
  if (start === -1) return null;

  const typed = before.slice(start + 2);
  return /[\]\n]/.test(typed) ? null : { start, typed };
}
