/** Toolbar actions as plain text edits, so they can be tested without an editor. */

export type Edit = { text: string; start: number; end: number };

export type Format = "h2" | "h3" | "bold" | "italic" | "list" | "quote" | "table" | "link";

const TABLE = "| Column | Column |\n| --- | --- |\n| Text | Text |\n";

function wrap({ text, start, end }: Edit, mark: string, fallback: string): Edit {
  const selected = text.slice(start, end) || fallback;
  const next = `${text.slice(0, start)}${mark}${selected}${mark}${text.slice(end)}`;
  return { text: next, start: start + mark.length, end: start + mark.length + selected.length };
}

/** Puts a prefix on every line the selection touches. */
function prefixLines({ text, start, end }: Edit, prefix: string): Edit {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const block = text.slice(lineStart, end).split("\n").map((line) => `${prefix}${line}`).join("\n");
  const next = text.slice(0, lineStart) + block + text.slice(end);
  return { text: next, start: lineStart + prefix.length, end: lineStart + block.length };
}

function insertBlock({ text, start, end }: Edit, block: string): Edit {
  const before = text.slice(0, start);
  const gap = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const at = start + gap.length;
  return { text: `${before}${gap}${block}${text.slice(end)}`, start: at, end: at + block.length };
}

export function applyFormat(edit: Edit, format: Format): Edit {
  switch (format) {
    case "h2":
      return prefixLines(edit, "## ");
    case "h3":
      return prefixLines(edit, "### ");
    case "bold":
      return wrap(edit, "**", "bold text");
    case "italic":
      return wrap(edit, "*", "italic text");
    case "list":
      return prefixLines(edit, "- ");
    case "quote":
      return prefixLines(edit, "> ");
    case "table":
      return insertBlock(edit, TABLE);
    case "link": {
      const label = edit.text.slice(edit.start, edit.end) || "link text";
      const link = `[${label}](https://)`;
      const urlAt = edit.start + label.length + 3;
      const next = edit.text.slice(0, edit.start) + link + edit.text.slice(edit.end);
      return { text: next, start: urlAt, end: urlAt + "https://".length };
    }
  }
}

export const insertImage = (edit: Edit, url: string) => insertBlock(edit, `![Image description](${url})\n`);

/** Finishes a [[link]] at the caret with the chosen name. */
export function completeLink(text: string, start: number, caret: number, name: string): Edit {
  const closing = text.slice(caret, caret + 2) === "]]" ? 2 : 0;
  const link = `[[${name}]]`;
  const next = text.slice(0, start) + link + text.slice(caret + closing);
  return { text: next, start: start + link.length, end: start + link.length };
}

export const parseList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
