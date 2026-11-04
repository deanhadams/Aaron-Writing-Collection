/** "Bear’dion Slagdon" to "beardion-slagdon". Matches the importer's portrait keys. */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

/** Adds -2, -3 and so on when a slug is taken. */
export function uniqueSlug(base: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const root = base || "character";
  if (!used.has(root)) return root;

  let suffix = 2;
  while (used.has(`${root}-${suffix}`)) suffix++;
  return `${root}-${suffix}`;
}

export function conventionalPortraitKey(slug: string) {
  return `characters/${slug}.png`;
}
