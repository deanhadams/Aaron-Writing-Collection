export type SourceLine = {
  text: string;
  /** 0 for paragraphs and top-level bullets, 1 and up for sub-bullets. */
  depth: number;
};

const BLOCK_TAGS = new Set([
  "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "td", "th", "br",
]);
const LIST_TAGS = new Set(["ul", "ol"]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] !== "#") return ENTITIES[code] ?? match;
    const hex = code[1].toLowerCase() === "x";
    return String.fromCodePoint(parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

// Word's bold and italics are already gone by here. Literal asterisks are
// leftover markdown, so they go too; every other character stays as written.
function flatten(text: string) {
  return text.replace(/\*+/g, "").replace(/ /g, " ").trim();
}

/** Walks mammoth's HTML in document order, one line per paragraph or bullet. */
export function htmlToLines(html: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let listDepth = 0;
  let buffer = "";

  const flush = () => {
    const text = flatten(decodeEntities(buffer));
    buffer = "";
    if (text) lines.push({ text, depth: Math.max(0, listDepth - 1) });
  };

  for (const [token, closing, rawTag] of html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>|[^<]+/gi)) {
    if (!rawTag) {
      buffer += token;
      continue;
    }

    const tag = rawTag.toLowerCase();
    if (LIST_TAGS.has(tag)) {
      flush();
      listDepth += closing ? -1 : 1;
    } else if (BLOCK_TAGS.has(tag)) {
      flush();
    }
  }

  flush();
  return lines;
}
