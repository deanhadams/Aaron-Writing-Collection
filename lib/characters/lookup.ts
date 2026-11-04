import { readableColor } from "./colors";

export type CastMember = {
  name: string;
  fullName: string | null;
  color: string | null;
  slug: string;
  aliases: string[];
};

/** Color and link for every name a script may use, aliases included. */
export function castLookups(cast: CastMember[]) {
  const colors = new Map<string, string | null>();
  const links = new Map<string, string>();

  for (const { name, aliases, color, slug } of cast) {
    for (const key of [name.toUpperCase(), ...aliases]) {
      colors.set(key, readableColor(color));
      links.set(key, slug);
    }
  }

  return { colors, links };
}
